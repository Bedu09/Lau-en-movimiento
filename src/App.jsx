import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Award, 
  BookOpen, 
  Clock, 
  Flame, 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  ChevronRight, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  ArrowLeft, 
  CheckCircle2, 
  Trophy, 
  Search, 
  Sparkles, 
  Compass,
  AlertCircle
} from 'lucide-react';
import { db } from './utils/db';
import { audio } from './utils/audio';
import { exercises } from './data/exercises';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App as CapApp } from '@capacitor/app';

const isNative = Capacitor.getPlatform() !== 'web';
const WORK_NOTIF_ID = 1;
const EX_NOTIF_ID = 2;
const NOTIFICATION_CHANNEL_ID = 'timer_channel';

// Helper to reliably get exercise steps with explicit durations
const getExerciseSteps = (exercise) => {
  if (!exercise) return [];
  if (exercise.steps && exercise.steps.length > 0) {
    return exercise.steps;
  }
  if (exercise.instructions && exercise.instructions.length > 0) {
    const dur = Math.max(5, Math.ceil((exercise.duration || 30) / exercise.instructions.length));
    return exercise.instructions.map((inst, i) => ({
      title: `Paso ${i + 1}`,
      duration: dur,
      instruction: inst
    }));
  }
  return [{ title: 'Ejercicio', duration: exercise.duration || 30, instruction: exercise.title }];
};

function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState('bienvenida');
  
  // Settings & DB State
  const [settings, setSettings] = useState(() => db.getSettings());
  const [logs, setLogs] = useState(() => db.getLogs());
  const [streak, setStreak] = useState(() => db.getStreak());
  const [achievements, setAchievements] = useState(() => db.getAchievements());
  
  // Newly Unlocked Achievement Toast
  const [toast, setToast] = useState(null);
  
  // Work Timer State
  const [workTimer, setWorkTimer] = useState(settings.workDuration * 60);
  const [isWorkTimerRunning, setIsWorkTimerRunning] = useState(false);
  const [workTimerStatus, setWorkTimerStatus] = useState('work'); // 'work', 'break_pending'
  
  // Active Exercise State
  const [activeExercise, setActiveExercise] = useState(null);
  const [exerciseTime, setExerciseTime] = useState(0);
  const [exerciseStepIndex, setExerciseStepIndex] = useState(0);
  const [isExerciseRunning, setIsExerciseRunning] = useState(false);
  const [showCompletionOverlay, setShowCompletionOverlay] = useState(false);
  
  // Library Search and Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // References
  const timerRef = useRef(null);
  const exerciseTimerRef = useRef(null);
  const workEndRef = useRef(null);
  const exerciseEndRef = useRef(null);
  const settingsRef = useRef(settings);
  const activeExerciseRef = useRef(null);

  // Keep refs in sync with latest state (avoids stale closures in timers)
  useEffect(() => { settingsRef.current = settings; });
  useEffect(() => { activeExerciseRef.current = activeExercise; });

  // ---- Background execution helpers (Capacitor local notifications + timestamp timers) ----

  const initNotifications = useCallback(async () => {
    if (!isNative) return;
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
      await LocalNotifications.createChannel({
        id: NOTIFICATION_CHANNEL_ID,
        name: 'Alertas de Pausa Activa',
        description: 'Avisos y alarmas cuando finaliza el tiempo de trabajo o de ejercicio',
        importance: 5, // High importance (sonido, vibración y heads-up en pantalla bloqueada)
        visibility: 1, // Visible en pantalla de bloqueo
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#22c55e',
      });
    } catch (e) {
      console.warn('No se pudo inicializar canal de notificaciones:', e);
    }
  }, []);

  const cancelNotification = useCallback(async (id) => {
    if (!isNative) return;
    try {
      const pending = await LocalNotifications.getPending();
      const matches = pending.notifications.filter((n) => n.id === id);
      if (matches.length > 0) {
        await LocalNotifications.cancel({ notifications: matches });
      }
    } catch (e) {
      console.warn('No se pudo cancelar notificación:', e);
    }
  }, []);

  const scheduleWorkNotification = useCallback(async (endTime) => {
    if (!isNative) return;
    try {
      await cancelNotification(WORK_NOTIF_ID);
      await LocalNotifications.schedule({
        notifications: [{
          id: WORK_NOTIF_ID,
          title: 'Lau en Movimiento ⏱️',
          body: '¡Terminó tu tiempo de concentración! Es momento de tu pausa activa.',
          schedule: { at: new Date(endTime), allowWhileIdle: true },
          sound: 'default',
          channelId: NOTIFICATION_CHANNEL_ID,
          smallIcon: 'ic_launcher',
          extra: { type: 'work' },
        }],
      });
    } catch (e) {
      console.warn('No se pudo programar notificación de trabajo:', e);
    }
  }, [cancelNotification]);

  const scheduleExerciseNotification = useCallback(async (endTime, title) => {
    if (!isNative) return;
    try {
      await cancelNotification(EX_NOTIF_ID);
      await LocalNotifications.schedule({
        notifications: [{
          id: EX_NOTIF_ID,
          title: '¡Pausa activa completada! 🎉',
          body: `Terminaste "${title}". ¡Excelente trabajo por tu salud postural!`,
          schedule: { at: new Date(endTime), allowWhileIdle: true },
          sound: 'default',
          channelId: NOTIFICATION_CHANNEL_ID,
          smallIcon: 'ic_launcher',
          extra: { type: 'exercise' },
        }],
      });
    } catch (e) {
      console.warn('No se pudo programar notificación de ejercicio:', e);
    }
  }, [cancelNotification]);

  const notifyBreakTime = useCallback(() => {
    if (isNative) return;
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Lau en Movimiento ⏱️', { body: 'Terminó tu tiempo de concentración. ¡Hora de una pausa activa!' });
      } catch { /* ignore */ }
    }
  }, []);

  const completeWorkTimer = useCallback(() => {
    workEndRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsWorkTimerRunning(false);
    setWorkTimerStatus('break_pending');
    setWorkTimer(0);
    db.clearWorkTimer();
    cancelNotification(WORK_NOTIF_ID);
    const s = settingsRef.current;
    if (s.soundEnabled) audio.playWorkEnded();
    if (s.vibrationEnabled && navigator.vibrate) navigator.vibrate([300, 150, 300]);
    notifyBreakTime();
  }, [cancelNotification, notifyBreakTime]);

  const showAchievementToast = useCallback((ach) => {
    setToast(ach);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleExerciseCompleted = useCallback((exercise) => {
    const ex = exercise || activeExerciseRef.current;
    if (!ex) return;
    const s = settingsRef.current;
    if (s.soundEnabled) audio.playExerciseEnded();
    if (s.vibrationEnabled && navigator.vibrate) navigator.vibrate([500]);

    exerciseEndRef.current = null;
    setIsExerciseRunning(false);
    db.clearExerciseTimer();
    cancelNotification(EX_NOTIF_ID);

    db.saveLog(ex.id, ex.duration);
    db.updateStreakAfterExercise();

    const newLogs = db.getLogs();
    const newStreak = db.getStreak();
    setLogs(newLogs);
    setStreak(newStreak);

    setWorkTimer(s.workDuration * 60);
    setWorkTimerStatus('work');

    const newlyUnlocked = db.checkAndUnlockAchievements();
    if (newlyUnlocked.length > 0) {
      setAchievements(db.getAchievements());
      showAchievementToast(newlyUnlocked[0]);
    }

    setShowCompletionOverlay(true);
  }, [showAchievementToast, cancelNotification]);

  // Restore timer state after the app was killed/reopened or resumed from background
  const restoreTimerState = useCallback(() => {
    const workState = db.getWorkTimer();
    if (workState && workState.endTime) {
      const remaining = Math.ceil((workState.endTime - Date.now()) / 1000);
      if (remaining > 0) {
        workEndRef.current = workState.endTime;
        setWorkTimer(remaining);
        setWorkTimerStatus('work');
        setIsWorkTimerRunning(true);
      } else {
        workEndRef.current = null;
        db.clearWorkTimer();
        completeWorkTimer();
      }
    }

    const exState = db.getExerciseTimer();
    if (exState && exState.endTime) {
      const ex = exercises.find((e) => e.id === exState.exerciseId);
      if (!ex) {
        db.clearExerciseTimer();
        return;
      }
      const steps = getExerciseSteps(ex);
      const remainingStep = Math.ceil((exState.endTime - Date.now()) / 1000);

      if (remainingStep > 0) {
        exerciseEndRef.current = exState.endTime;
        setActiveExercise(ex);
        activeExerciseRef.current = ex;
        setExerciseStepIndex(exState.stepIndex || 0);
        setExerciseTime(remainingStep);
        setCurrentView('ejercicio_en_curso');
        setIsExerciseRunning(true);
      } else {
        // Step finished while away. Check if subsequent steps or whole exercise finished
        let overTime = Math.abs(remainingStep);
        let nextIdx = (exState.stepIndex || 0) + 1;
        let targetStep = null;
        let targetRemaining = 0;

        while (nextIdx < steps.length) {
          const stepDur = steps[nextIdx].duration;
          if (overTime < stepDur) {
            targetStep = nextIdx;
            targetRemaining = stepDur - overTime;
            break;
          }
          overTime -= stepDur;
          nextIdx++;
        }

        if (targetStep !== null) {
          const newEndTime = Date.now() + targetRemaining * 1000;
          exerciseEndRef.current = newEndTime;
          setActiveExercise(ex);
          activeExerciseRef.current = ex;
          setExerciseStepIndex(targetStep);
          setExerciseTime(targetRemaining);
          setCurrentView('ejercicio_en_curso');
          setIsExerciseRunning(true);
          db.saveExerciseTimer({ endTime: newEndTime, exerciseId: ex.id, stepIndex: targetStep });
        } else {
          // Entire exercise finished while in background
          db.clearExerciseTimer();
          exerciseEndRef.current = null;
          setIsExerciseRunning(false);
          handleExerciseCompleted(ex);
        }
      }
    }
  }, [completeWorkTimer, handleExerciseCompleted]);

  // Screen Wake Lock API: Keep screen awake while user is actively performing an exercise
  useEffect(() => {
    let wakeLock = null;
    if (isExerciseRunning && 'wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then((lock) => { wakeLock = lock; })
        .catch(() => {});
    }
    return () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [isExerciseRunning]);

  // Initialize DB, Notification channels and check permissions
  useEffect(() => {
    initNotifications();
    const handleFirstClick = () => {
      audio.init();
      initNotifications();
      document.removeEventListener('click', handleFirstClick);
    };
    document.addEventListener('click', handleFirstClick);

    // Initial state restore on launch
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitima reconciliacion con estado persistido en localStorage al montar
    restoreTimerState();

    // Listen for notification taps
    let notifActionListener = null;
    if (isNative) {
      LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        const extra = notificationAction?.notification?.extra;
        if (extra?.type === 'work') {
          setWorkTimerStatus('break_pending');
          setWorkTimer(0);
          setCurrentView('dashboard');
        } else if (extra?.type === 'exercise') {
          setShowCompletionOverlay(true);
        }
      }).then((l) => { notifActionListener = l; });
    }

    return () => {
      document.removeEventListener('click', handleFirstClick);
      if (notifActionListener) notifActionListener.remove();
    };
  }, [restoreTimerState, initNotifications]);

  // Sync settings modifications
  useEffect(() => {
    db.saveSettings(settings);
  }, [settings]);

  // Reset idle timer display when the work duration changes (render-phase state adjustment)
  const [prevWorkDuration, setPrevWorkDuration] = useState(settings.workDuration);
  if (settings.workDuration !== prevWorkDuration) {
    setPrevWorkDuration(settings.workDuration);
    if (!isWorkTimerRunning && workTimerStatus === 'work') {
      setWorkTimer(settings.workDuration * 60);
    }
  }

  // Work Timer Countdown Loop (timestamp-based: self-corrects when throttled/backgrounded)
  useEffect(() => {
    if (!isWorkTimerRunning || workTimerStatus !== 'work') return;
    const tick = () => {
      if (!workEndRef.current) return;
      const remaining = Math.max(0, Math.ceil((workEndRef.current - Date.now()) / 1000));
      setWorkTimer(remaining);
      if (remaining <= 0) {
        completeWorkTimer();
      }
    };
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [isWorkTimerRunning, workTimerStatus, completeWorkTimer]);

  // Active Exercise Countdown Loop (timestamp-based with accurate per-step durations)
  useEffect(() => {
    if (!isExerciseRunning || !activeExercise) return;
    const steps = getExerciseSteps(activeExercise);
    const totalSteps = steps.length;

    const tick = () => {
      if (!exerciseEndRef.current) return;
      const remaining = Math.max(0, Math.ceil((exerciseEndRef.current - Date.now()) / 1000));
      setExerciseTime(remaining);

      const s = settingsRef.current;
      if (remaining <= 3 && remaining >= 1 && s.soundEnabled) {
        audio.playExerciseStep();
      }

      if (remaining <= 0) {
        clearInterval(exerciseTimerRef.current);
        if (exerciseStepIndex < totalSteps - 1) {
          const nextIdx = exerciseStepIndex + 1;
          setExerciseStepIndex(nextIdx);
          const nextStepDuration = steps[nextIdx].duration;
          exerciseEndRef.current = Date.now() + nextStepDuration * 1000;
          setExerciseTime(nextStepDuration);
          if (s.soundEnabled) audio.playClick();
          if (s.vibrationEnabled && navigator.vibrate) navigator.vibrate([150]);
          db.saveExerciseTimer({ endTime: exerciseEndRef.current, exerciseId: activeExercise.id, stepIndex: nextIdx });
        } else {
          exerciseEndRef.current = null;
          setIsExerciseRunning(false);
          db.clearExerciseTimer();
          cancelNotification(EX_NOTIF_ID);
          handleExerciseCompleted(activeExercise);
        }
      }
    };
    exerciseTimerRef.current = setInterval(tick, 1000);
    return () => clearInterval(exerciseTimerRef.current);
  }, [isExerciseRunning, activeExercise, exerciseStepIndex, handleExerciseCompleted, cancelNotification]);

  // Background and Screen Off Lifecycle (Capacitor App state + Visibility Change)
  useEffect(() => {
    let appStateListener = null;

    if (isNative) {
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          // Screen turned back on or app reopened: reconcile immediately
          restoreTimerState();
        } else {
          // App minimized or screen turned off: ensure native exact notifications are armed
          if (isWorkTimerRunning && workEndRef.current) {
            scheduleWorkNotification(workEndRef.current);
          }
          if (isExerciseRunning && activeExerciseRef.current) {
            const steps = getExerciseSteps(activeExerciseRef.current);
            const remainingCurrent = exerciseEndRef.current ? Math.max(0, Math.ceil((exerciseEndRef.current - Date.now()) / 1000)) : 0;
            const remainingRest = steps.slice(exerciseStepIndex + 1).reduce((sum, s) => sum + s.duration, 0);
            const totalRemaining = remainingCurrent + remainingRest;
            if (totalRemaining > 0) {
              scheduleExerciseNotification(Date.now() + totalRemaining * 1000, activeExerciseRef.current.title);
            }
          }
        }
      }).then((handle) => {
        appStateListener = handle;
      });
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        restoreTimerState();
      } else {
        if (isWorkTimerRunning && workEndRef.current) {
          scheduleWorkNotification(workEndRef.current);
        }
        if (isExerciseRunning && activeExerciseRef.current) {
          const steps = getExerciseSteps(activeExerciseRef.current);
          const remainingCurrent = exerciseEndRef.current ? Math.max(0, Math.ceil((exerciseEndRef.current - Date.now()) / 1000)) : 0;
          const remainingRest = steps.slice(exerciseStepIndex + 1).reduce((sum, s) => sum + s.duration, 0);
          const totalRemaining = remainingCurrent + remainingRest;
          if (totalRemaining > 0) {
            scheduleExerciseNotification(Date.now() + totalRemaining * 1000, activeExerciseRef.current.title);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (appStateListener) appStateListener.remove();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isWorkTimerRunning, isExerciseRunning, exerciseStepIndex, restoreTimerState, scheduleWorkNotification, scheduleExerciseNotification]);

  // Nav Actions
  const navigateTo = (view) => {
    if (settingsRef.current.soundEnabled) audio.playClick();
    setCurrentView(view);
  };

  const toggleWorkTimer = () => {
    if (settingsRef.current.soundEnabled) audio.playClick();
    if (isWorkTimerRunning) {
      const remaining = workEndRef.current ? Math.max(0, Math.round((workEndRef.current - Date.now()) / 1000)) : workTimer;
      setIsWorkTimerRunning(false);
      setWorkTimer(remaining);
      workEndRef.current = null;
      db.clearWorkTimer();
      cancelNotification(WORK_NOTIF_ID);
    } else {
      const durationSeconds = workTimer > 0 ? workTimer : settingsRef.current.workDuration * 60;
      const endTime = Date.now() + durationSeconds * 1000;
      workEndRef.current = endTime;
      setIsWorkTimerRunning(true);
      db.saveWorkTimer({ endTime, status: 'work' });
      // Schedule background notification immediately so it fires even if screen is locked right away
      scheduleWorkNotification(endTime);
    }
  };

  const resetWorkTimer = () => {
    if (settingsRef.current.soundEnabled) audio.playClick();
    setIsWorkTimerRunning(false);
    setWorkTimer(settingsRef.current.workDuration * 60);
    workEndRef.current = null;
    db.clearWorkTimer();
    cancelNotification(WORK_NOTIF_ID);
  };

  const startExercise = (exercise) => {
    if (settingsRef.current.soundEnabled) audio.playClick();
    const steps = getExerciseSteps(exercise);
    const initialStepDuration = steps[0]?.duration || 15;

    setActiveExercise(exercise);
    activeExerciseRef.current = exercise;
    setExerciseStepIndex(0);
    setExerciseTime(initialStepDuration);
    setCurrentView('ejercicio_en_curso');

    const now = Date.now();
    exerciseEndRef.current = now + initialStepDuration * 1000;
    setIsExerciseRunning(true);
    db.saveExerciseTimer({ endTime: exerciseEndRef.current, exerciseId: exercise.id, stepIndex: 0 });

    const totalSeconds = steps.reduce((sum, s) => sum + s.duration, 0);
    scheduleExerciseNotification(now + totalSeconds * 1000, exercise.title);
  };

  const toggleExercise = () => {
    if (settingsRef.current.soundEnabled) audio.playClick();
    if (isExerciseRunning) {
      const remaining = exerciseEndRef.current ? Math.max(0, Math.round((exerciseEndRef.current - Date.now()) / 1000)) : exerciseTime;
      setIsExerciseRunning(false);
      setExerciseTime(remaining);
      exerciseEndRef.current = null;
      cancelNotification(EX_NOTIF_ID);
    } else {
      if (!activeExercise) return;
      const steps = getExerciseSteps(activeExercise);
      const stepDuration = steps[exerciseStepIndex]?.duration || 15;
      const duration = exerciseTime > 0 ? exerciseTime : stepDuration;
      exerciseEndRef.current = Date.now() + duration * 1000;
      setIsExerciseRunning(true);
      db.saveExerciseTimer({ endTime: exerciseEndRef.current, exerciseId: activeExercise.id, stepIndex: exerciseStepIndex });

      const remainingRest = steps.slice(exerciseStepIndex + 1).reduce((sum, s) => sum + s.duration, 0);
      scheduleExerciseNotification(Date.now() + (duration + remainingRest) * 1000, activeExercise.title);
    }
  };

  const handleSkipStep = () => {
    if (settingsRef.current.soundEnabled) audio.playClick();
    const steps = getExerciseSteps(activeExercise);
    const totalSteps = steps.length;
    if (exerciseStepIndex < totalSteps - 1) {
      const newIdx = exerciseStepIndex + 1;
      setExerciseStepIndex(newIdx);
      const stepDuration = steps[newIdx].duration;
      setExerciseTime(stepDuration);
      exerciseEndRef.current = Date.now() + stepDuration * 1000;
      db.saveExerciseTimer({ endTime: exerciseEndRef.current, exerciseId: activeExercise.id, stepIndex: newIdx });

      const remainingRest = steps.slice(newIdx + 1).reduce((sum, s) => sum + s.duration, 0);
      scheduleExerciseNotification(Date.now() + (stepDuration + remainingRest) * 1000, activeExercise.title);
    } else {
      setIsExerciseRunning(false);
      exerciseEndRef.current = null;
      db.clearExerciseTimer();
      cancelNotification(EX_NOTIF_ID);
      handleExerciseCompleted(activeExercise);
    }
  };

  const handleStopExercise = () => {
    if (settingsRef.current.soundEnabled) audio.playClick();
    setIsExerciseRunning(false);
    exerciseEndRef.current = null;
    db.clearExerciseTimer();
    cancelNotification(EX_NOTIF_ID);
    setActiveExercise(null);
    activeExerciseRef.current = null;
    navigateTo('dashboard');
  };

  // Format MM:SS helper
  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Stats calculation
  const totalActiveMinutes = Math.round(logs.reduce((acc, log) => acc + (log.durationSeconds || 0), 0) / 60);
  const totalBreaksCompleted = logs.length;

  // Recommended Exercise rotation
  const getRecommendedExercise = () => {
    // If work timer is in break pending, recommend a breathing or neck stretch
    if (workTimerStatus === 'break_pending') {
      return exercises.find(e => e.category === 'respiración' || e.id === 'neck-stretch') || exercises[0];
    }
    // Rotate based on completed logs to suggest something new
    if (logs.length > 0) {
      const lastExerciseId = logs[logs.length - 1].exerciseId;
      const nextIndex = (exercises.findIndex(e => e.id === lastExerciseId) + 1) % exercises.length;
      return exercises[nextIndex];
    }
    return exercises[0];
  };

  const recommendedExercise = getRecommendedExercise();

  // Weekly Stats Helper
  const getWeeklyData = () => {
    const data = [];
    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dayName = daysOfWeek[d.getDay()];
      const dateStr = d.toDateString();
      
      const count = logs.filter(log => new Date(log.timestamp).toDateString() === dateStr).length;
      data.push({ name: dayName, count });
    }
    return data;
  };

  const weeklyData = getWeeklyData();
  const maxWeeklyCount = Math.max(...weeklyData.map(d => d.count), 1);

  // Search & Categories Filter
  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          ex.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || ex.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="relative min-h-screen flex flex-col max-w-md mx-auto bg-surface overflow-hidden shadow-2xl border-x border-white/5">
      
      {/* Toast Notification for Achievements */}
      {toast && (
        <div className="absolute top-6 left-4 right-4 z-50 glass-card rounded-xl p-4 flex items-center gap-3 border-secondary/40 glow-secondary fade-in">
          <div className="bg-secondary/20 p-2 rounded-full text-secondary">
            <Trophy size={24} />
          </div>
          <div>
            <h4 className="font-display font-semibold text-sm text-secondary">¡Logro Desbloqueado!</h4>
            <p className="font-display font-bold text-white text-base">{toast.title}</p>
            <p className="text-xs text-on-surface-variant">{toast.desc}</p>
          </div>
        </div>
      )}

      {/* Completion Overlay screen */}
      {showCompletionOverlay && activeExercise && (
        <div className="absolute inset-0 z-40 bg-surface/95 flex flex-col items-center justify-center p-6 text-center fade-in">
          <div className="w-24 h-24 rounded-full bg-secondary/15 flex items-center justify-center text-secondary border border-secondary/35 glow-secondary mb-6 animate-bounce">
            <CheckCircle2 size={54} />
          </div>
          <h2 className="font-display text-3xl font-bold text-white mb-2">¡Excelente Trabajo!</h2>
          <p className="text-on-surface-variant text-base mb-6 max-w-xs">
            Completaste el ejercicio <span className="text-secondary font-bold font-display">"{activeExercise.title}"</span>.
          </p>
          
          <div className="glass-card w-full rounded-2xl p-5 mb-8 border-secondary/20">
            <div className="flex justify-around">
              <div>
                <p className="text-xs text-on-surface-variant uppercase tracking-wider font-display font-semibold mb-1">Racha</p>
                <div className="flex items-center gap-1 justify-center text-orange-400 font-display font-extrabold text-2xl">
                  <Flame size={24} fill="currentColor" /> {streak.current} {streak.current === 1 ? 'día' : 'días'}
                </div>
              </div>
              <div className="w-[1px] bg-white/10" />
              <div>
                <p className="text-xs text-on-surface-variant uppercase tracking-wider font-display font-semibold mb-1">Bienestar</p>
                <p className="text-secondary font-display font-extrabold text-2xl">+{Math.ceil(activeExercise.duration / 60)} min</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => {
              setShowCompletionOverlay(false);
              setActiveExercise(null);
              navigateTo('dashboard');
            }}
            className="w-full py-4 rounded-xl font-display font-bold text-black btn-primary-glow"
          >
            Volver al Tablero
          </button>
        </div>
      )}

      {/* MAIN VIEW CONTENT CONTAINER */}
      <div className="flex-1 overflow-y-auto pb-24">
        
        {/* VIEW: BIENVENIDA */}
        {currentView === 'bienvenida' && (
          <div className="flex flex-col items-center justify-between min-h-screen p-8 text-center bg-mesh">
            <div className="my-auto flex flex-col items-center">
              {/* Animated Glowing Logo */}
              <div className="relative w-36 h-36 mb-8 flex items-center justify-center rounded-3xl glass-card border-primary/30 glow-primary">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-primary/10 to-secondary/10 breathing-glow" />
                <Sparkles size={64} className="text-primary animate-pulse" />
              </div>
              
              <h1 className="font-display text-4xl font-extrabold text-white tracking-tight leading-none mb-3">
                Lau en Movimiento
              </h1>
              
              <p className="text-secondary font-display font-extrabold tracking-widest text-sm uppercase italic mb-8 px-4 py-1.5 rounded-full bg-secondary/10 border border-secondary/20">
                Trabajá mejor PIPILA
              </p>
              
              <p className="text-on-surface-variant text-base max-w-xs leading-relaxed">
                Tu asistente de bienestar en el escritorio. Programá tus pausas activas, estira el cuerpo y relajá tu mente con ejercicios rápidos diseñados para oficina.
              </p>
            </div>

            <button 
              onClick={() => navigateTo('dashboard')}
              className="w-full py-4 rounded-xl font-display font-bold text-black btn-primary-glow"
            >
              Comenzar Jornada
            </button>
          </div>
        )}

        {/* VIEW: DASHBOARD */}
        {currentView === 'dashboard' && (
          <div className="p-6 space-y-6 fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="font-display text-2xl font-bold text-white">¡Hola, Laura!</h1>
                <p className="text-xs text-secondary italic font-display font-semibold">Trabajá mejor PIPILA</p>
              </div>
              
              {/* Quick Streak Badge */}
              <div className="flex items-center gap-1 py-1.5 px-3 rounded-full glass-card border-orange-500/30 text-orange-400">
                <Flame size={18} fill="currentColor" />
                <span className="font-display font-extrabold text-sm">{streak.current}d</span>
              </div>
            </div>

            {/* Circular Timer Visual */}
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative w-64 h-64 flex items-center justify-center rounded-full glass-card border-white/5">
                
                {/* Background breathing pulse */}
                {isWorkTimerRunning && (
                  <div className="absolute inset-8 rounded-full bg-primary/5 breathing-glow" />
                )}
                
                {/* Circular track border SVG */}
                <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="45" 
                    className="stroke-white/5 fill-none" 
                    strokeWidth="3" 
                  />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="45" 
                    className={`fill-none transition-all duration-1000 ${
                      workTimerStatus === 'break_pending' ? 'stroke-secondary' : 'stroke-primary'
                    }`}
                    strokeWidth="3.5" 
                    strokeDasharray={2 * Math.PI * 45}
                    strokeDashoffset={
                      workTimerStatus === 'break_pending' ? 0 : 
                      (2 * Math.PI * 45) * (1 - workTimer / (settings.workDuration * 60))
                    }
                    strokeLinecap="round"
                  />
                </svg>

                {/* Text Timer */}
                <div className="z-10 text-center flex flex-col items-center">
                  <p className="text-xs uppercase tracking-widest text-on-surface-variant font-display font-bold mb-1">
                    {workTimerStatus === 'break_pending' ? '¡PAUSA ACTIVA!' : 'CONCENTRACIÓN'}
                  </p>
                  
                  <span className="font-display text-5xl font-black text-white tracking-tight">
                    {workTimerStatus === 'break_pending' ? "00:00" : formatTime(workTimer)}
                  </span>
                  
                  <span className="text-xs text-on-surface-variant mt-1.5">
                    Meta: {settings.workDuration} min
                  </span>
                </div>
              </div>

              {/* Timer Controls */}
              <div className="flex gap-4 mt-6 z-10">
                {workTimerStatus === 'break_pending' ? (
                  <button 
                    onClick={() => startExercise(recommendedExercise)}
                    className="px-6 py-3 rounded-full font-display font-bold text-black btn-primary-glow flex items-center gap-2"
                  >
                    <Sparkles size={18} /> Iniciar Descanso Sugerido
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={toggleWorkTimer}
                      className={`w-14 h-14 rounded-full flex items-center justify-center border text-white transition-all ${
                        isWorkTimerRunning ? 'bg-white/5 border-white/20' : 'btn-primary-glow text-black border-transparent'
                      }`}
                    >
                      {isWorkTimerRunning ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                    </button>
                    
                    <button 
                      onClick={resetWorkTimer}
                      className="w-14 h-14 rounded-full flex items-center justify-center glass-card text-on-surface-variant hover:text-white"
                    >
                      <RotateCcw size={20} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="glass-card rounded-2xl p-4 text-center border-white/5">
                <span className="text-xs text-on-surface-variant block font-display font-bold mb-1 uppercase tracking-wider">Activo</span>
                <span className="font-display text-2xl font-extrabold text-white">{totalActiveMinutes}m</span>
              </div>
              <div className="glass-card rounded-2xl p-4 text-center border-white/5">
                <span className="text-xs text-on-surface-variant block font-display font-bold mb-1 uppercase tracking-wider">Pausas</span>
                <span className="font-display text-2xl font-extrabold text-white">{totalBreaksCompleted}</span>
              </div>
              <div className="glass-card rounded-2xl p-4 text-center border-white/5">
                <span className="text-xs text-on-surface-variant block font-display font-bold mb-1 uppercase tracking-wider">Racha</span>
                <span className="font-display text-2xl font-extrabold text-orange-400">{streak.current}d</span>
              </div>
            </div>

            {/* Suggested break widget */}
            {recommendedExercise && (
              <div className="glass-card rounded-2xl p-5 border-white/5 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent pointer-events-none" />
                
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs text-primary font-display font-bold uppercase tracking-wider">Pausa Recomendada</span>
                    <h3 className="font-display text-lg font-bold text-white mt-0.5">{recommendedExercise.title}</h3>
                  </div>
                  <span className="px-2.5 py-1 text-xs rounded-full glass-card border-primary/20 text-primary font-display font-bold">
                    {recommendedExercise.duration}s
                  </span>
                </div>
                
                <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
                  {recommendedExercise.description}
                </p>
                
                <button 
                  onClick={() => startExercise(recommendedExercise)}
                  className="w-full py-3 rounded-xl font-display font-bold text-black btn-primary-glow flex items-center justify-center gap-2"
                >
                  Comenzar Estiramiento <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW: BIBLIOTECA DE EJERCICIOS */}
        {currentView === 'biblioteca' && (
          <div className="p-6 space-y-6 fade-in">
            <h1 className="font-display text-2xl font-bold text-white">Biblioteca</h1>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-4 top-3.5 text-on-surface-variant" size={18} />
              <input 
                type="text"
                placeholder="Buscar ejercicio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl glass-card border-white/5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
            </div>

            {/* Category Chips Carousel */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
              {['Todos', 'Cuello', 'Hombros', 'Espalda', 'Fatiga Visual', 'Muñecas', 'Respiración', 'Piernas'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    if (settings.soundEnabled) audio.playClick();
                    setSelectedCategory(cat);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-display font-bold whitespace-nowrap border transition-all ${
                    selectedCategory === cat 
                      ? 'bg-primary text-black border-transparent glow-primary' 
                      : 'glass-card border-white/5 text-on-surface-variant'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Exercises List */}
            <div className="space-y-4">
              {filteredExercises.length > 0 ? (
                filteredExercises.map((ex) => (
                  <div 
                    key={ex.id}
                    className="glass-card rounded-2xl p-5 border-white/5 flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-display text-lg font-bold text-white">{ex.title}</h3>
                      <span className="px-2.5 py-1 text-xs font-display font-bold rounded-full glass-card border-white/10 text-on-surface-variant">
                        {ex.duration}s
                      </span>
                    </div>
                    
                    <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
                      {ex.description}
                    </p>

                    <div className="flex justify-between items-center">
                      {/* Specs */}
                      <div className="flex gap-2">
                        <span className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-on-surface-variant font-display font-bold uppercase tracking-wider">
                          {ex.intensity}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-on-surface-variant font-display font-bold uppercase tracking-wider">
                          {ex.equipment}
                        </span>
                      </div>
                      
                      {/* Play Button */}
                      <button 
                        onClick={() => startExercise(ex)}
                        className="p-2.5 rounded-full btn-primary-glow text-black"
                      >
                        <Play size={16} fill="currentColor" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-on-surface-variant flex flex-col items-center">
                  <AlertCircle size={36} className="mb-2 opacity-50" />
                  <p className="text-sm">No se encontraron ejercicios.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: EJERCICIO EN CURSO */}
        {currentView === 'ejercicio_en_curso' && activeExercise && (() => {
          const currentSteps = getExerciseSteps(activeExercise);
          const currentStep = currentSteps[exerciseStepIndex] || { title: '', instruction: activeExercise.instructions?.[exerciseStepIndex] || '', duration: 15 };
          const totalSteps = currentSteps.length;
          const currentStepTotal = Math.max(1, currentStep.duration || 15);

          return (
            <div className="p-6 min-h-screen flex flex-col justify-between bg-mesh text-center">
              
              {/* Top Bar */}
              <div className="flex items-center justify-between">
                <button 
                  onClick={handleStopExercise}
                  className="p-3 rounded-full glass-card text-on-surface-variant hover:text-white"
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 className="font-display text-lg font-bold text-white max-w-[200px] truncate">
                  {activeExercise.title}
                </h2>
                <div className="w-10 h-10" /> {/* Spacer */}
              </div>

              {/* Circular Timer Visual */}
              <div className="my-auto py-8 flex flex-col items-center">
                <div className="relative w-64 h-64 flex items-center justify-center rounded-full glass-card border-white/5 mb-8">
                  
                  {/* Background breathing pulse */}
                  {isExerciseRunning && (
                    <div className="absolute inset-8 rounded-full bg-secondary/5 breathing-glow" />
                  )}
                  
                  {/* Circular track border SVG */}
                  <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="45" 
                      className="stroke-white/5 fill-none" 
                      strokeWidth="3.5" 
                    />
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="45" 
                      className="stroke-secondary fill-none transition-all duration-1000"
                      strokeWidth="4" 
                      strokeDasharray={2 * Math.PI * 45}
                      strokeDashoffset={
                        (2 * Math.PI * 45) * (1 - exerciseTime / currentStepTotal)
                      }
                      strokeLinecap="round"
                    />
                  </svg>

                  {/* Text Timer */}
                  <div className="z-10 text-center flex flex-col items-center">
                    <span className="font-display text-6xl font-black text-white tracking-tight">
                      {exerciseTime}
                    </span>
                    <span className="text-xs uppercase tracking-widest text-secondary font-display font-bold mt-1.5">
                      Segundos
                    </span>
                  </div>
                </div>

                {/* Steps indicator & Title badge */}
                <div className="flex flex-col items-center gap-1.5 mb-3">
                  <span className="text-xs uppercase font-display font-bold tracking-widest text-secondary">
                    Paso {exerciseStepIndex + 1} de {totalSteps}
                  </span>
                  {currentStep.title && (
                    <span className="px-3 py-0.5 rounded-full text-xs font-display font-bold bg-secondary/15 text-secondary border border-secondary/30">
                      {currentStep.title} ({currentStep.duration}s)
                    </span>
                  )}
                </div>

                {/* Step Instruction Card */}
                <div className="glass-card rounded-2xl p-6 w-full min-h-[120px] flex items-center justify-center border-secondary/10">
                  <p className="text-base text-white leading-relaxed font-medium">
                    {currentStep.instruction || activeExercise.instructions?.[exerciseStepIndex]}
                  </p>
                </div>
              </div>

              {/* Exercise Controls */}
              <div className="flex justify-center items-center gap-6 pb-8">
                <button 
                  onClick={handleStopExercise}
                  className="w-14 h-14 rounded-full flex items-center justify-center glass-card text-red-400 hover:bg-red-500/10 border-red-500/20"
                >
                  <RotateCcw size={20} />
                </button>

                <button 
                  onClick={toggleExercise}
                  className={`w-18 h-18 rounded-full flex items-center justify-center border transition-all ${
                    isExerciseRunning 
                      ? 'bg-white/5 border-white/20 text-white w-18 h-18' 
                      : 'bg-secondary text-black border-transparent glow-secondary w-18 h-18'
                  }`}
                >
                  {isExerciseRunning ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                </button>

                <button 
                  onClick={handleSkipStep}
                  className="w-14 h-14 rounded-full flex items-center justify-center glass-card text-secondary hover:bg-secondary/10 border-secondary/20"
                >
                  <ChevronRight size={22} />
                </button>
              </div>
            </div>
          );
        })()}

        {/* VIEW: LOGROS Y ESTADISTICAS */}
        {currentView === 'logros' && (
          <div className="p-6 space-y-6 fade-in">
            <h1 className="font-display text-2xl font-bold text-white">Estadísticas y Logros</h1>

            {/* Big Streak Card */}
            <div className="glass-card rounded-2xl p-5 border-white/5 flex items-center justify-between relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-bl from-orange-500/10 to-transparent pointer-events-none" />
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20">
                  <Flame size={32} fill="currentColor" />
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant block font-display font-bold uppercase tracking-wider">Consistencia</span>
                  <span className="font-display text-xl font-bold text-white">Racha de {streak.current} {streak.current === 1 ? 'día' : 'días'}</span>
                </div>
              </div>
            </div>

            {/* Weekly Consistency Bar Chart */}
            <div className="glass-card rounded-2xl p-5 border-white/5">
              <h3 className="font-display text-base font-bold text-white mb-4">Consistencia Semanal</h3>
              
              <div className="flex justify-between items-end h-28 pt-2">
                {weeklyData.map((d, index) => {
                  const percent = (d.count / maxWeeklyCount) * 100;
                  return (
                    <div key={index} className="flex flex-col items-center gap-2 flex-1">
                      <div className="relative w-7 bg-white/5 rounded-t-lg overflow-hidden flex-1 flex flex-col justify-end">
                        {d.count > 0 && (
                          <div 
                            style={{ height: `${percent}%` }}
                            className="w-full bg-gradient-to-t from-primary/70 to-primary rounded-t-lg transition-all duration-1000 glow-primary"
                          />
                        )}
                      </div>
                      <span className="text-[10px] font-display font-bold text-on-surface-variant">{d.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Achievements List */}
            <div className="space-y-4">
              <h3 className="font-display text-base font-bold text-white">Medallas y Hitos</h3>
              
              <div className="space-y-3">
                {achievements.map((ach) => (
                  <div 
                    key={ach.id}
                    className={`glass-card rounded-2xl p-4 border flex items-center gap-4 transition-all ${
                      ach.unlocked 
                        ? 'border-secondary/20 bg-secondary/5' 
                        : 'border-white/5 opacity-55'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                      ach.unlocked 
                        ? 'bg-secondary/10 border-secondary/30 text-secondary' 
                        : 'bg-white/5 border-white/10 text-on-surface-variant'
                    }`}>
                      {ach.id === 'zen_master' ? <Compass size={24} /> : <Award size={24} />}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-white text-sm flex items-center gap-1.5">
                        {ach.title}
                        {ach.unlocked && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary font-display font-bold uppercase">Desbloqueado</span>}
                      </h4>
                      <p className="text-xs text-on-surface-variant">{ach.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: CONFIGURACION */}
        {currentView === 'configuracion' && (
          <div className="p-6 space-y-6 fade-in">
            <h1 className="font-display text-2xl font-bold text-white">Configuración</h1>

            {/* Intervals Adjustments */}
            <div className="glass-card rounded-2xl p-5 border-white/5 space-y-5">
              <h3 className="font-display text-base font-bold text-white">Intervalos de Tiempo</h3>
              
              {/* Work Interval Adjust */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Tiempo de Trabajo</span>
                  <span className="text-white font-display font-bold">{settings.workDuration} Minutos</span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      if (settings.soundEnabled) audio.playClick();
                      setSettings(s => ({ ...s, workDuration: Math.max(15, s.workDuration - 5) }));
                    }}
                    className="w-10 h-10 rounded-lg glass-card flex items-center justify-center font-bold text-lg text-white"
                  >
                    -
                  </button>
                  <input 
                    type="range" 
                    min="15" 
                    max="90" 
                    step="5"
                    value={settings.workDuration}
                    onChange={(e) => setSettings(s => ({ ...s, workDuration: parseInt(e.target.value) }))}
                    className="flex-1 accent-primary bg-white/10 rounded-lg h-2"
                  />
                  <button 
                    onClick={() => {
                      if (settings.soundEnabled) audio.playClick();
                      setSettings(s => ({ ...s, workDuration: Math.min(90, s.workDuration + 5) }));
                    }}
                    className="w-10 h-10 rounded-lg glass-card flex items-center justify-center font-bold text-lg text-white"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Break Interval Adjust */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Tiempo de Descanso</span>
                  <span className="text-white font-display font-bold">{settings.restDuration} Minutos</span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      if (settings.soundEnabled) audio.playClick();
                      setSettings(s => ({ ...s, restDuration: Math.max(2, s.restDuration - 1) }));
                    }}
                    className="w-10 h-10 rounded-lg glass-card flex items-center justify-center font-bold text-lg text-white"
                  >
                    -
                  </button>
                  <input 
                    type="range" 
                    min="2" 
                    max="20" 
                    step="1"
                    value={settings.restDuration}
                    onChange={(e) => setSettings(s => ({ ...s, restDuration: parseInt(e.target.value) }))}
                    className="flex-1 accent-primary bg-white/10 rounded-lg h-2"
                  />
                  <button 
                    onClick={() => {
                      if (settings.soundEnabled) audio.playClick();
                      setSettings(s => ({ ...s, restDuration: Math.min(20, s.restDuration + 1) }));
                    }}
                    className="w-10 h-10 rounded-lg glass-card flex items-center justify-center font-bold text-lg text-white"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Sound & Haptic Adjustments */}
            <div className="glass-card rounded-2xl p-5 border-white/5 space-y-4">
              <h3 className="font-display text-base font-bold text-white">Alertas y Notificaciones</h3>
              
              {/* Sound toggle */}
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <div className="flex items-center gap-3">
                  {settings.soundEnabled ? <Volume2 size={20} className="text-primary" /> : <VolumeX size={20} className="text-on-surface-variant" />}
                  <span className="text-sm">Efectos de Sonido</span>
                </div>
                <button
                  onClick={() => {
                    const newSound = !settings.soundEnabled;
                    setSettings(s => ({ ...s, soundEnabled: newSound }));
                    if (newSound) {
                      setTimeout(() => audio.playClick(), 50);
                    }
                  }}
                  className={`w-12 h-6 rounded-full p-1 transition-all ${
                    settings.soundEnabled ? 'bg-primary flex justify-end' : 'bg-white/10 flex justify-start'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full ${settings.soundEnabled ? 'bg-black' : 'bg-on-surface-variant'}`} />
                </button>
              </div>

              {/* Haptics toggle */}
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-3">
                  <Smartphone size={20} className={settings.vibrationEnabled ? 'text-primary' : 'text-on-surface-variant'} />
                  <span className="text-sm">Vibración del Dispositivo</span>
                </div>
                <button
                  onClick={() => {
                    if (settings.soundEnabled) audio.playClick();
                    const newVib = !settings.vibrationEnabled;
                    setSettings(s => ({ ...s, vibrationEnabled: newVib }));
                    if (newVib && navigator.vibrate) {
                      navigator.vibrate([100]);
                    }
                  }}
                  className={`w-12 h-6 rounded-full p-1 transition-all ${
                    settings.vibrationEnabled ? 'bg-primary flex justify-end' : 'bg-white/10 flex justify-start'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full ${settings.vibrationEnabled ? 'bg-black' : 'bg-on-surface-variant'}`} />
                </button>
              </div>
            </div>

            {/* Reset data */}
            <div className="glass-card rounded-2xl p-5 border-red-500/20 text-center space-y-3">
              <h3 className="font-display text-sm font-bold text-red-400">Restablecer Datos</h3>
              <p className="text-xs text-on-surface-variant">Esta acción eliminará de forma permanente tu racha de días, historial de estadísticas y logros.</p>
              <button 
                onClick={() => {
                  if (confirm('¿Estás segura de que deseas eliminar todo tu progreso? Esta acción no se puede deshacer.')) {
                    if (settings.soundEnabled) audio.playClick();
                    localStorage.clear();
                    // Hard reload to reset states
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 border border-red-500/35 rounded-lg text-xs font-display font-bold text-red-400 hover:bg-red-500/10 transition-all"
              >
                Eliminar Todo el Progreso
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER TAB BAR NAVIGATION (ONLY ON SPA VIEWS) */}
      {currentView !== 'bienvenida' && currentView !== 'ejercicio_en_curso' && (
        <div className="absolute bottom-0 left-0 right-0 h-20 glass-panel border-t border-white/5 flex items-center justify-around px-4 z-30">
          
          {/* Nav: Tablero */}
          <button 
            onClick={() => navigateTo('dashboard')}
            className={`flex flex-col items-center gap-1 transition-all ${
              currentView === 'dashboard' ? 'text-primary scale-110' : 'text-on-surface-variant'
            }`}
          >
            <Clock size={22} />
            <span className="text-[10px] font-display font-semibold uppercase tracking-wider">Reloj</span>
          </button>
          
          {/* Nav: Biblioteca */}
          <button 
            onClick={() => navigateTo('biblioteca')}
            className={`flex flex-col items-center gap-1 transition-all ${
              currentView === 'biblioteca' ? 'text-primary scale-110' : 'text-on-surface-variant'
            }`}
          >
            <BookOpen size={22} />
            <span className="text-[10px] font-display font-semibold uppercase tracking-wider">Biblioteca</span>
          </button>

          {/* Nav: Logros */}
          <button 
            onClick={() => navigateTo('logros')}
            className={`flex flex-col items-center gap-1 transition-all ${
              currentView === 'logros' ? 'text-primary scale-110' : 'text-on-surface-variant'
            }`}
          >
            <Award size={22} />
            <span className="text-[10px] font-display font-semibold uppercase tracking-wider">Logros</span>
          </button>

          {/* Nav: Configuración */}
          <button 
            onClick={() => navigateTo('configuracion')}
            className={`flex flex-col items-center gap-1 transition-all ${
              currentView === 'configuracion' ? 'text-primary scale-110' : 'text-on-surface-variant'
            }`}
          >
            <Settings size={22} />
            <span className="text-[10px] font-display font-semibold uppercase tracking-wider">Ajustes</span>
          </button>

        </div>
      )}

    </div>
  );
}

export default App;
