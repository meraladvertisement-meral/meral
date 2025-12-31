
import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../types';
import { useGameSounds } from './SoundManager';

export const BalloonPopGame: React.FC<{ lang: Language, score: number, onFinish: () => void }> = ({ lang, score, onFinish }) => {
  const [balloons, setBalloons] = useState<{ id: number, x: number, color: string, speed: number, offset: number, size: number, isPopping?: boolean }[]>([]);
  const [poppedCount, setPoppedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [gameStarted, setGameStarted] = useState(false);
  const { playSound, stopBg, unlockAudio } = useGameSounds();

  const t = {
    ar: { congrats: 'بطل القنص! 🎯', popped: 'فجرت', balloons: 'بالوناً حماسياً!', getGift: 'العودة للرئيسية 🏠', start: '🔊 Tap to start sound' },
    en: { congrats: 'Pop Master! 🎯', popped: 'You popped', balloons: 'awesome balloons!', getGift: 'Back Home 🏠', start: '🔊 Tap to start sound' },
    de: { congrats: 'Pop-Meister! 🎯', popped: 'Du hast', balloons: 'Ballons erwischt!', getGift: 'Zurück 🏠', start: '🔊 Tap to start sound' }
  }[lang] || { congrats: '', popped: '', balloons: '', getGift: '', start: '🔊 Tap to start sound' };

  const colors = ['#ff5f6d', '#2193b0', '#ee9ca7', '#11998e', '#8e2de2', '#f093fb'];

  const startGame = () => {
    unlockAudio();
    playSound('balloon_bg');
    setGameStarted(true);
  };

  useEffect(() => {
    if (!gameStarted) return;

    const spawnInterval = setInterval(() => {
      if (timeLeft > 0) {
        setBalloons(prev => [...prev, {
          id: Date.now() + Math.random(),
          x: 5 + Math.random() * 90,
          color: colors[Math.floor(Math.random() * colors.length)],
          speed: 1.8 + Math.random() * 2.2, 
          offset: -20,
          size: 0.9 + Math.random() * 0.6
        }]);
      }
    }, 450);

    const moveInterval = setInterval(() => {
      setBalloons(prev => 
        prev
          .map(b => b.isPopping ? b : { ...b, offset: b.offset + b.speed })
          .filter(b => b.offset < 120)
      );
    }, 30);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopBg();
          playSound('win');
          return 0;
        }
        if (prev <= 5) {
          playSound('tick'); 
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(spawnInterval);
      clearInterval(moveInterval);
      clearInterval(timer);
    };
  }, [gameStarted]);

  const pop = (id: number) => {
    playSound('pop'); 
    setBalloons(prev => prev.map(b => b.id === id ? { ...b, isPopping: true } : b));
    
    // إزالة البالون تماماً بعد انتهاء أنيميشن الفرقعة
    setTimeout(() => {
      setBalloons(prev => prev.filter(b => b.id !== id));
    }, 150);

    setPoppedCount(prev => prev + 1);
    if (navigator.vibrate) navigator.vibrate(40);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-indigo-950 via-indigo-900 to-black z-[1000] overflow-hidden flex flex-col items-center select-none">
      {!gameStarted && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-xl z-[2000] flex flex-col items-center justify-center p-6 text-center">
          <div className="mb-12 animate-bounce">
             <div className="text-9xl">🎈</div>
          </div>
          <button 
            onClick={startGame}
            className="bg-indigo-600 text-white text-3xl sm:text-4xl font-black px-10 py-8 rounded-[3rem] shadow-[0_0_50px_rgba(79,70,229,0.6)] border-b-[10px] border-indigo-950 active:translate-y-2 active:border-b-0 transition-all flex items-center gap-4"
          >
            {t.start}
          </button>
          <p className="mt-8 text-indigo-300/60 font-bold text-lg animate-pulse">Required to play music & SFX</p>
        </div>
      )}

      <div className="w-full p-6 flex justify-between items-center z-10 max-w-2xl">
        <div className="bg-white/10 backdrop-blur-xl px-8 py-3 rounded-full text-3xl font-black text-white border border-white/20 shadow-lg">
          🎈 {poppedCount}
        </div>
        <div className={`px-8 py-3 rounded-full text-3xl font-black text-white shadow-2xl transition-all duration-300 ${timeLeft <= 5 ? 'bg-rose-600 scale-110 animate-pulse' : 'bg-indigo-600'}`}>
          ⏱️ {timeLeft}s
        </div>
      </div>

      <div className="relative flex-1 w-full touch-none">
        {balloons.map(b => (
          <div
            key={b.id}
            onMouseDown={() => !b.isPopping && pop(b.id)}
            onTouchStart={(e) => { e.preventDefault(); if(!b.isPopping) pop(b.id); }}
            className={`absolute cursor-pointer transition-all duration-150 ${b.isPopping ? 'scale-[1.5] opacity-0' : 'scale-100 opacity-100'}`}
            style={{ 
              left: `${b.x}%`, 
              bottom: `${b.offset}%`,
              transform: `scale(${b.isPopping ? b.size * 1.5 : b.size})`,
            }}
          >
            <div 
              className="w-16 h-20 sm:w-24 sm:h-30 rounded-full shadow-2xl relative"
              style={{ 
                backgroundColor: b.color, 
                boxShadow: `0 0 50px ${b.color}aa, inset 0 10px 20px rgba(255,255,255,0.3)` 
              }}
            >
              <div className="absolute top-3 left-6 w-6 h-9 bg-white/40 rounded-full blur-[2px]"></div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-16 bg-white/30"></div>
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
              onClick={() => { stopBg(); onFinish(); }}
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
