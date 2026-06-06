import React, { useState, useEffect, useRef } from 'react';
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

  // Initialize DB and Check streaks on mount
  useEffect(() => {
    // Check if streak is broken
    setStreak(db.getStreak());
    // Trigger audio init on click
    const handleFirstClick = () => {
      audio.init();
      document.removeEventListener('click', handleFirstClick);
    };
    document.addEventListener('click', handleFirstClick);
    return () => {
      document.removeEventListener('click', handleFirstClick);
    };
  }, []);

  // Sync settings modifications
  useEffect(() => {
    db.saveSettings(settings);
    // Reset timer to new work duration if not currently running
    if (!isWorkTimerRunning && workTimerStatus === 'work') {
      setWorkTimer(settings.workDuration * 60);
    }
  }, [settings]);

  // Work Timer Countdown Loop
  useEffect(() => {
    if (isWorkTimerRunning) {
      timerRef.current = setInterval(() => {
        setWorkTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsWorkTimerRunning(false);
            setWorkTimerStatus('break_pending');
            
            // Alarm & Haptic Alert
            if (settings.soundEnabled) audio.playWorkEnded();
            if (settings.vibrationEnabled && navigator.vibrate) {
              navigator.vibrate([300, 150, 300]);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isWorkTimerRunning]);

  // Active Exercise Countdown Loop
  useEffect(() => {
    if (isExerciseRunning && activeExercise) {
      exerciseTimerRef.current = setInterval(() => {
        setExerciseTime((prev) => {
          // Play tick in final 3 seconds
          if (prev <= 4 && prev > 1 && settings.soundEnabled) {
            audio.playExerciseStep();
          }

          if (prev <= 1) {
            // Check if there are more steps
            const totalSteps = activeExercise.instructions.length;
            if (exerciseStepIndex < totalSteps - 1) {
              // Advance to next step
              setExerciseStepIndex((idx) => idx + 1);
              // Calculate remaining time for the next step
              const stepDuration = Math.ceil(activeExercise.duration / totalSteps);
              if (settings.soundEnabled) audio.playClick();
              return stepDuration;
            } else {
              // Exercise Completed!
              clearInterval(exerciseTimerRef.current);
              setIsExerciseRunning(false);
              handleExerciseCompleted();
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(exerciseTimerRef.current);
    }
    return () => clearInterval(exerciseTimerRef.current);
  }, [isExerciseRunning, activeExercise, exerciseStepIndex]);

  // Handle exercise completion logic
  const handleExerciseCompleted = () => {
    if (settings.soundEnabled) audio.playExerciseEnded();
    if (settings.vibrationEnabled && navigator.vibrate) {
      navigator.vibrate([500]);
    }

    // Save logs
    db.saveLog(activeExercise.id, activeExercise.duration);
    // Update streak
    db.updateStreakAfterExercise();
    
    // Refresh states
    const newLogs = db.getLogs();
    const newStreak = db.getStreak();
    setLogs(newLogs);
    setStreak(newStreak);

    // Reset work timer to concentration mode
    setWorkTimer(settings.workDuration * 60);
    setWorkTimerStatus('work');

    // Check Achievements
    const newlyUnlocked = db.checkAndUnlockAchievements();
    if (newlyUnlocked.length > 0) {
      setAchievements(db.getAchievements());
      // Show first unlocked achievement toast
      showAchievementToast(newlyUnlocked[0]);
    }

    setShowCompletionOverlay(true);
  };

  const showAchievementToast = (ach) => {
    setToast(ach);
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Nav Actions
  const navigateTo = (view) => {
    if (settings.soundEnabled) audio.playClick();
    setCurrentView(view);
  };

  const startExercise = (exercise) => {
    if (settings.soundEnabled) audio.playClick();
    setActiveExercise(exercise);
    setExerciseStepIndex(0);
    const stepDuration = Math.ceil(exercise.duration / exercise.instructions.length);
    setExerciseTime(stepDuration);
    setCurrentView('ejercicio_en_curso');
    setIsExerciseRunning(true);
  };

  const handleSkipStep = () => {
    if (settings.soundEnabled) audio.playClick();
    const totalSteps = activeExercise.instructions.length;
    if (exerciseStepIndex < totalSteps - 1) {
      setExerciseStepIndex(idx => idx + 1);
      const stepDuration = Math.ceil(activeExercise.duration / totalSteps);
      setExerciseTime(stepDuration);
    } else {
      // Completed early
      setIsExerciseRunning(false);
      handleExerciseCompleted();
    }
  };

  const handleStopExercise = () => {
    if (settings.soundEnabled) audio.playClick();
    setIsExerciseRunning(false);
    setActiveExercise(null);
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
                      onClick={() => {
                        if (settings.soundEnabled) audio.playClick();
                        setIsWorkTimerRunning(!isWorkTimerRunning);
                      }}
                      className={`w-14 h-14 rounded-full flex items-center justify-center border text-white transition-all ${
                        isWorkTimerRunning ? 'bg-white/5 border-white/20' : 'btn-primary-glow text-black border-transparent'
                      }`}
                    >
                      {isWorkTimerRunning ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                    </button>
                    
                    <button 
                      onClick={() => {
                        if (settings.soundEnabled) audio.playClick();
                        setIsWorkTimerRunning(false);
                        setWorkTimer(settings.workDuration * 60);
                      }}
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
              {['Todos', 'Cuello', 'Hombros', 'Espalda', 'Fatiga Visual', 'Muñecas', 'Respiración'].map((cat) => (
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
        {currentView === 'ejercicio_en_curso' && activeExercise && (
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
                      (2 * Math.PI * 45) * (1 - exerciseTime / Math.ceil(activeExercise.duration / activeExercise.instructions.length))
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

              {/* Steps indicator */}
              <span className="text-xs uppercase font-display font-bold tracking-widest text-secondary mb-3">
                Paso {exerciseStepIndex + 1} de {activeExercise.instructions.length}
              </span>

              {/* Step Instruction Card */}
              <div className="glass-card rounded-2xl p-6 w-full min-h-[120px] flex items-center justify-center border-secondary/10">
                <p className="text-base text-white leading-relaxed font-medium">
                  {activeExercise.instructions[exerciseStepIndex]}
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
                onClick={() => {
                  if (settings.soundEnabled) audio.playClick();
                  setIsExerciseRunning(!isExerciseRunning);
                }}
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
        )}

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
