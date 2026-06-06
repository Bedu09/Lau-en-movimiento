let audioCtx = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const playTone = (frequency, type, duration, startTimeOffset = 0, gainValue = 0.1) => {
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime + startTimeOffset);

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime + startTimeOffset);
    gainNode.gain.linearRampToValueAtTime(gainValue, audioCtx.currentTime + startTimeOffset + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + startTimeOffset + duration);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start(audioCtx.currentTime + startTimeOffset);
    osc.stop(audioCtx.currentTime + startTimeOffset + duration);
  } catch (e) {
    console.error('Audio synthesis failed:', e);
  }
};

export const audio = {
  init: () => {
    try {
      initAudio();
    } catch (e) {
      console.error('AudioContext initialization failed:', e);
    }
  },

  playWorkEnded: () => {
    playTone(659.25, 'sine', 0.4, 0, 0.15);
    playTone(880.00, 'sine', 0.6, 0.2, 0.15);
  },

  playExerciseStep: () => {
    playTone(1200, 'triangle', 0.05, 0, 0.1);
  },

  playExerciseEnded: () => {
    playTone(523.25, 'sine', 0.25, 0, 0.12);
    playTone(659.25, 'sine', 0.25, 0.12, 0.12);
    playTone(783.99, 'sine', 0.25, 0.24, 0.12);
    playTone(1046.50, 'sine', 0.5, 0.36, 0.15);
  },

  playClick: () => {
    playTone(800, 'sine', 0.03, 0, 0.05);
  }
};
