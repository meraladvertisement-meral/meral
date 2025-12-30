
import React, { useRef, useState, useCallback, useEffect } from 'react';

const SOUNDS = {
  bg: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3',
  balloon_bg: 'https://cdn.pixabay.com/audio/2024/05/04/audio_33486334f5.mp3', // موسيقى حماسية جديدة ومستقرة
  correct: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
  wrong: 'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3',
  pop: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  tick: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
};

let globalBgAudio: HTMLAudioElement | null = null;
let lastType: string | null = null;

export const useGameSounds = () => {
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('quiz_muted') === 'true';
  });

  useEffect(() => {
    if (globalBgAudio) {
      globalBgAudio.muted = isMuted;
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newVal = !prev;
      localStorage.setItem('quiz_muted', String(newVal));
      return newVal;
    });
  }, []);

  const playSound = useCallback((type: keyof typeof SOUNDS) => {
    if (type === 'bg' || type === 'balloon_bg') {
      if (globalBgAudio && lastType === type) {
        if (globalBgAudio.paused) {
          globalBgAudio.play().catch(() => {});
        }
        return;
      }

      if (globalBgAudio) {
        globalBgAudio.pause();
        globalBgAudio.src = "";
        globalBgAudio = null;
      }

      const audio = new Audio(SOUNDS[type]);
      audio.loop = true;
      audio.volume = type === 'balloon_bg' ? 0.4 : 0.15;
      audio.muted = isMuted;
      globalBgAudio = audio;
      lastType = type;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          console.warn("Autoplay blocked. Audio will start on next interaction.");
          // محاولة التشغيل عند أول نقرة في المستند
          const startOnInteraction = () => {
            audio.play().catch(() => {});
            document.removeEventListener('click', startOnInteraction);
            document.removeEventListener('touchstart', startOnInteraction);
          };
          document.addEventListener('click', startOnInteraction);
          document.addEventListener('touchstart', startOnInteraction);
        });
      }
      return;
    }

    if (!isMuted) {
      const sfx = new Audio(SOUNDS[type]);
      sfx.volume = type === 'pop' ? 1.0 : type === 'tick' ? 0.6 : 0.8;
      sfx.play().catch(() => {});
    }
  }, [isMuted]);

  const stopBg = useCallback(() => {
    if (globalBgAudio) {
      globalBgAudio.pause();
      globalBgAudio.currentTime = 0;
      lastType = null;
    }
  }, []);

  const unlockAudio = useCallback(() => {
    if (globalBgAudio && globalBgAudio.paused) {
      globalBgAudio.play().catch(() => {});
    }
    const silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    silent.play().catch(() => {});
  }, []);

  return { playSound, stopBg, isMuted, toggleMute, unlockAudio };
};
