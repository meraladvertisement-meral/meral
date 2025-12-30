
import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../types';
import { useGameSounds } from './SoundManager';

export const BalloonPopGame: React.FC<{ lang: Language, score: number, onFinish: () => void }> = ({ lang, score, onFinish }) => {
  const [balloons, setBalloons] = useState<{ id: number, x: number, color: string, speed: number, offset: number, size: number }[]>([]);
  const [poppedCount, setPoppedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const { playSound, stopBg, unlockAudio } = useGameSounds();
  const hasStartedMusic = useRef(false);

  const t = {
    ar: { congrats: 'بطل القنص! 🎯', popped: 'فجرت', balloons: 'بالوناً حماسياً!', getGift: 'العودة للرئيسية 🏠' },
    en: { congrats: 'Pop Master! 🎯', popped: 'You popped', balloons: 'awesome balloons!', getGift: 'Back Home 🏠' },
    de: { congrats: 'Pop-Meister! 🎯', popped: 'Du hast', balloons: 'Ballons erwischt!', getGift: 'Zurück 🏠' }
  }[lang] || { congrats: '', popped: '', balloons: '', getGift: '' };

  const colors = ['#ff5f6d', '#2193b0', '#ee9ca7', '#11998e', '#8e2de2', '#f093fb'];

  useEffect(() => {
    // تشغيل الموسيقى فوراً
    playSound('balloon_bg');
    
    const spawnInterval = setInterval(() => {
      if (timeLeft > 0) {
        setBalloons(prev => [...prev, {
          id: Date.now() + Math.random(),
          x: 5 + Math.random() * 90,
          color: colors[Math.floor(Math.random() * colors.length)],
          speed: 3.2 + Math.random() * 5.5, // زيادة السرعة لتكون أكثر إثارة
          offset: -20,
          size: 0.8 + Math.random() * 0.7
        }]);
      }
    }, 280);

    const moveInterval = setInterval(() => {
      setBalloons(prev => prev.map(b => ({ ...b, offset: b.offset + b.speed })).filter(b => b.offset < 120));
    }, 30);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopBg();
          playSound('win');
          return 0;
        }
        if (prev <= 6) {
          playSound('tick');
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(spawnInterval);
      clearInterval(moveInterval);
      clearInterval(timer);
      stopBg();
    };
  }, []);

  const pop = (id: number) => {
    // ضمان فتح الصوت عند أول لمسة للبالون
    if (!hasStartedMusic.current) {
        unlockAudio();
        playSound('balloon_bg');
        hasStartedMusic.current = true;
    }
    playSound('pop'); 
    setBalloons(prev => prev.filter(b => b.id !== id));
    setPoppedCount(prev => prev + 1);
    
    if (navigator.vibrate) navigator.vibrate(50);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-indigo-950 via-indigo-900 to-black z-[1000] overflow-hidden flex flex-col items-center select-none">
      <div className="w-full p-6 flex justify-between items-center z-10 max-w-2xl">
        <div className="bg-white/10 backdrop-blur-xl px-8 py-3 rounded-full text-3xl font-black text-white border border-white/20 shadow-lg">
          🎈 {poppedCount}
        </div>
        <div className={`px-8 py-3 rounded-full text-3xl font-black text-white shadow-2xl transition-all duration-300 ${timeLeft <= 5 ? 'bg-rose-600 scale-110 animate-pulse' : 'bg-indigo-600'}`}>
          ⏱️ {timeLeft}s
        </div>
      </div>

      <div className="relative flex-1 w-full touch-none" onTouchStart={() => unlockAudio()} onMouseDown={() => unlockAudio()}>
        {balloons.map(b => (
          <div
            key={b.id}
            onMouseDown={() => pop(b.id)}
            onTouchStart={(e) => { e.preventDefault(); pop(b.id); }}
            className="absolute cursor-pointer transition-transform active:scale-50"
            style={{ 
              left: `${b.x}%`, 
              bottom: `${b.offset}%`,
              transform: `scale(${b.size})`,
            }}
          >
            <div 
              className="w-16 h-20 sm:w-20 sm:h-24 rounded-full shadow-2xl relative"
              style={{ backgroundColor: b.color, boxShadow: `0 0 40px ${b.color}88` }}
            >
              <div className="absolute top-2 left-4 w-5 h-7 bg-white/40 rounded-full blur-[2px]"></div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-14 bg-white/30"></div>
            </div>
          </div>
        ))}
      </div>

      {timeLeft === 0 && (
        <div className="absolute inset-0 bg-black/95 flex items-center justify-center p-6 backdrop-blur-2xl z-[1100] animate-in zoom-in duration-500">
          <div className="bg-white rounded-[4rem] p-12 text-center shadow-[0_0_150px_rgba(79,70,229,0.5)] max-w-sm w-full border-[12px] border-indigo-600 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-blue-500 via-indigo-600 to-rose-500"></div>
            <h2 className="text-4xl font-black text-indigo-700 mb-4 tracking-tighter">{t.congrats}</h2>
            <p className="text-xl text-gray-500 font-bold mb-10">{t.popped} <span className="text-rose-500 text-6xl font-black block mt-2">{poppedCount}</span> {t.balloons}</p>
            <button 
              onClick={onFinish}
              className="w-full bg-indigo-600 text-white text-3xl font-black py-7 rounded-3xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all"
            >
              {t.getGift}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
