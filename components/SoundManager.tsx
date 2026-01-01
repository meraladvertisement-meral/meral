
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
    // القيمة الافتراضية هي دائماً "مكتوم" (true) للامتثال لطلب المستخدم وسياسات المتصفح
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    if (globalBgAudio) {
      globalBgAudio.muted = isMuted;
    }
  }, [isMuted]);

  const playSound = useCallback((type: keyof typeof SOUNDS) => {
    if (type === 'bg' || type === 'balloon_bg') {
      if (globalBgAudio && lastType === type) {
        globalBgAudio.muted = isMuted;
        if (!isMuted && globalBgAudio.paused) {
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
      
      // لا يبدأ التشغيل إلا إذا كان المستخدم قد ألغى الكتم
      if (!isMuted) {
        audio.play().catch(() => {
          console.warn("Autoplay blocked or muted.");
        });
      } else {
        // في حالة الكتم، نقوم بتحميل الصوت فقط ليكون جاهزاً
        audio.load();
      }
      return;
    }

    if (!isMuted) {
      const sfx = new Audio(SOUNDS[type]);
      sfx.volume = type === 'pop' ? 0.9 : type === 'tick' ? 0.6 : 0.8;
      sfx.play().catch(() => {});
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newVal = !prev;
      localStorage.setItem('quiz_muted', String(newVal));
      
      if (globalBgAudio) {
        globalBgAudio.muted = newVal;
        if (!newVal) {
          // محاولة تشغيل الموسيقى فور إلغاء الكتم
          globalBgAudio.play().catch(() => {
            console.error("Playback failed. Interaction required.");
          });
        } else {
          globalBgAudio.pause();
        }
      } else if (!newVal) {
        // إذا لم يكن هناك موسيقى تعمل، نشغل موسيقى الخلفية الافتراضية
        playSound('bg');
      }
      
      return newVal;
    });
  }, [playSound]);

  const stopBg = useCallback(() => {
    if (globalBgAudio) {
      globalBgAudio.pause();
      globalBgAudio.currentTime = 0;
      lastType = null;
    }
  }, []);

  const unlockAudio = useCallback(() => {
    const silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    silent.play().then(() => {
        if (globalBgAudio && !isMuted && globalBgAudio.paused) {
          globalBgAudio.play().catch(() => {});
        }
    }).catch(() => {});
  }, [isMuted]);

  return { playSound, stopBg, isMuted, toggleMute, unlockAudio };
};
