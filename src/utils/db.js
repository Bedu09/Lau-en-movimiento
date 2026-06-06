const STORAGE_PREFIX = 'lau_en_movimiento_';

const DEFAULT_SETTINGS = {
  workDuration: 45, // in minutes
  restDuration: 5,  // in minutes
  soundEnabled: true,
  vibrationEnabled: true,
  workStart: '09:00',
  workEnd: '18:00',
};

const DEFAULT_ACHIEVEMENTS = [
  { id: 'first_break', title: '¡Primer Paso!', desc: 'Completaste tu primer descanso activo.', unlocked: false, unlockedAt: null, icon: 'Award' },
  { id: 'three_streak', title: 'Consistencia', desc: 'Mantén una racha de 3 días activos.', unlocked: false, unlockedAt: null, icon: 'Flame' },
  { id: 'five_breaks_day', title: 'Super Producción', desc: 'Completa 5 descansos activos en un solo día.', unlocked: false, unlockedAt: null, icon: 'Zap' },
  { id: 'zen_master', title: 'Mente Serena', desc: 'Realiza 3 ejercicios de respiración.', unlocked: false, unlockedAt: null, icon: 'Compass' },
];

export const db = {
  getSettings: () => {
    try {
      const data = localStorage.getItem(STORAGE_PREFIX + 'settings');
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings: (settings) => {
    localStorage.setItem(STORAGE_PREFIX + 'settings', JSON.stringify(settings));
  },

  getLogs: () => {
    try {
      const data = localStorage.getItem(STORAGE_PREFIX + 'logs');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveLog: (exerciseId, durationSeconds) => {
    try {
      const logs = db.getLogs();
      const newLog = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        exerciseId,
        durationSeconds,
        timestamp: new Date().toISOString(),
      };
      logs.push(newLog);
      localStorage.setItem(STORAGE_PREFIX + 'logs', JSON.stringify(logs));
      return newLog;
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  getStreak: () => {
    try {
      const data = localStorage.getItem(STORAGE_PREFIX + 'streak');
      const streakObj = data ? JSON.parse(data) : { current: 0, lastActiveDate: null };
      
      if (streakObj.lastActiveDate) {
        const today = new Date().toDateString();
        const lastDate = new Date(streakObj.lastActiveDate).toDateString();
        
        if (today !== lastDate) {
          const todayDate = new Date();
          const lastDateObj = new Date(streakObj.lastActiveDate);
          const diffTime = Math.abs(todayDate.getTime() - lastDateObj.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays > 1) {
            streakObj.current = 0;
            db.saveStreak(streakObj);
          }
        }
      }
      return streakObj;
    } catch {
      return { current: 0, lastActiveDate: null };
    }
  },

  saveStreak: (streakObj) => {
    localStorage.setItem(STORAGE_PREFIX + 'streak', JSON.stringify(streakObj));
  },

  updateStreakAfterExercise: () => {
    try {
      const streak = db.getStreak();
      const today = new Date().toDateString();
      const lastActive = streak.lastActiveDate ? new Date(streak.lastActiveDate).toDateString() : null;

      if (today !== lastActive) {
        if (lastActive) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toDateString();
          
          if (lastActive === yesterdayStr) {
            streak.current += 1;
          } else {
            streak.current = 1;
          }
        } else {
          streak.current = 1;
        }
        streak.lastActiveDate = new Date().toISOString();
        db.saveStreak(streak);
      }
      return streak;
    } catch (e) {
      console.error(e);
      return { current: 0, lastActiveDate: null };
    }
  },

  getAchievements: () => {
    try {
      const data = localStorage.getItem(STORAGE_PREFIX + 'achievements');
      if (data) {
        const stored = JSON.parse(data);
        return DEFAULT_ACHIEVEMENTS.map(ach => {
          const found = stored.find(s => s.id === ach.id);
          return found ? { ...ach, unlocked: found.unlocked, unlockedAt: found.unlockedAt } : ach;
        });
      }
      return DEFAULT_ACHIEVEMENTS;
    } catch {
      return DEFAULT_ACHIEVEMENTS;
    }
  },

  unlockAchievement: (id) => {
    try {
      const achievements = db.getAchievements();
      const ach = achievements.find(a => a.id === id);
      if (ach && !ach.unlocked) {
        ach.unlocked = true;
        ach.unlockedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_PREFIX + 'achievements', JSON.stringify(achievements));
        return ach;
      }
      return null;
    } catch {
      return null;
    }
  },

  checkAndUnlockAchievements: () => {
    const unlockedNow = [];
    const logs = db.getLogs();
    const streak = db.getStreak();
    
    // 1. First break
    if (logs.length > 0) {
      const u = db.unlockAchievement('first_break');
      if (u) unlockedNow.push(u);
    }
    
    // 2. Three streak
    if (streak.current >= 3) {
      const u = db.unlockAchievement('three_streak');
      if (u) unlockedNow.push(u);
    }
    
    // 3. Five breaks in a day
    const todayStr = new Date().toDateString();
    const todayLogs = logs.filter(log => new Date(log.timestamp).toDateString() === todayStr);
    if (todayLogs.length >= 5) {
      const u = db.unlockAchievement('five_breaks_day');
      if (u) unlockedNow.push(u);
    }
    
    // 4. Zen master (3 breathing exercises)
    const breathingLogs = logs.filter(log => log.exerciseId === 'box-breathing');
    if (breathingLogs.length >= 3) {
      const u = db.unlockAchievement('zen_master');
      if (u) unlockedNow.push(u);
    }
    
    return unlockedNow;
  }
};
