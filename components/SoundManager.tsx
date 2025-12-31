
import React, { useRef, useState, useCallback, useEffect } from 'react';

const SOUNDS = {
  // الموسيقى الهادئة الأصلية للواجهة والأسئلة
  bg: 'https://assets.mixkit.co/music/preview/mixkit-dreaming-big-31.mp3',
  // الموسيقى الحماسية الأصلية للعبة البالونات
  balloon_bg: 'https://assets.mixkit.co/music/preview/mixkit-arcade-retro-changing-worlds-274.mp3', 
  // المؤثرات الصوتية
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
    const saved = localStorage.getItem('quiz_muted');
    // القيمة الافتراضية هي "كتم الصوت" (true) لحل مشاكل المتصفحات
    return saved === null ? true : saved === 'true';
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
      if (globalBgAudio) {
        globalBgAudio.muted = newVal;
        if (!newVal && globalBgAudio.paused) {
          globalBgAudio.play().catch(() => {});
        }
      }
      return newVal;
    });
  }, []);

  const playSound = useCallback((type: keyof typeof SOUNDS) => {
    if (type === 'bg' || type === 'balloon_bg') {
      if (globalBgAudio && lastType === type) {
        globalBgAudio.muted = isMuted;
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
      audio.volume = type === 'balloon_bg' ? 0.25 : 0.15;
      audio.muted = isMuted;
      globalBgAudio = audio;
      lastType = type;
      
      audio.play().catch(() => {
        console.warn("Autoplay blocked. User interaction required.");
      });
      return;
    }

    if (!isMuted) {
      const sfx = new Audio(SOUNDS[type]);
      sfx.volume = type === 'pop' ? 0.9 : type === 'tick' ? 0.6 : 0.8;
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
    if (globalBgAudio) {
      globalBgAudio.muted = isMuted;
      if (globalBgAudio.paused) {
        globalBgAudio.play().catch(() => {});
      }
    }
    const silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    silent.play().catch(() => {});
  }, [isMuted]);

  return { playSound, stopBg, isMuted, toggleMute, unlockAudio };
};
