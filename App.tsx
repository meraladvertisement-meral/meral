
import React, { useState, useEffect, useRef } from 'react';
import { generateQuizFromImage, generateQuizFromText } from './geminiService';
import { Question, PlayerState, QuizConfig, Language, QuestionType, SavedGame, MultiplayerMessage, Difficulty } from './types';
import { useGameSounds } from './components/SoundManager';
import { BalloonPopGame } from './components/BalloonPopGame';

declare var Peer: any;

const generateShortId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const SnapQuizGameLogo: React.FC<{ size?: number }> = ({ size = 180 }) => (
  <div className="flex flex-col items-center logo-glow">
    <div className="mb-4">
      <p className="text-emerald-400 font-black text-sm tracking-[0.2em] uppercase bg-emerald-500/10 px-4 py-1 rounded-full border border-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.2)] animate-pulse" dir="ltr">
        Turn any page into a fun game
      </p>
    </div>
    <div className="relative" style={{ width: size, height: size * 0.9 }}>
      <div className="snap-flash"></div>
      <div className="absolute top-1/4 left-0 w-full h-3/4 bg-gradient-to-br from-[#1e40af] to-[#1e1b4b] rounded-[1.5rem] border-2 border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-white/5 skew-x-[20deg] translate-x-10"></div>
        <div className="absolute bottom-3 left-3 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
      </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/3 z-20">
         <div className="w-full h-1/2 bg-[#312e81] rounded-[2px] transform border border-white/10 relative shadow-lg">
            <div className="absolute top-1/2 right-3 w-[1.5px] h-full bg-amber-400">
              <div className="absolute -bottom-0.5 -left-[2px] w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
            </div>
         </div>
         <div className="w-4/5 mx-auto h-1/2 bg-[#1e1b4b] rounded-b-lg border-x border-b border-white/10"></div>
      </div>
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[65%] h-[60%] z-30">
        <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-400 rounded-full p-0.5 shadow-inner flex items-center justify-center border-2 border-[#1e1b4b]">
          <div className="w-full h-full bg-[#0f172a] rounded-full relative overflow-hidden flex items-center justify-center">
             <div className="absolute inset-0 border-[2px] border-dashed border-blue-400/30 rounded-full animate-[spin_20s_linear_infinite]"></div>
             <div className="w-1/2 h-1/2 bg-gradient-to-tr from-blue-600 via-indigo-500 to-emerald-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)] flex items-center justify-center">
                <div className="w-1/3 h-1/3 bg-white/80 rounded-full blur-[0.5px]"></div>
             </div>
          </div>
        </div>
      </div>
    </div>
    <div className="mt-6 flex flex-col items-center">
      <div className="flex font-black text-5xl tracking-tighter italic" dir="ltr">
        <span className="text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.9)]">Snap</span>
        <span className="text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.9)]">QuizGame</span>
      </div>
      <p className="text-blue-300 text-[11px] font-bold tracking-[0.4em] uppercase mt-2" dir="ltr">Smart Learning AI</p>
    </div>
  </div>
);

const RocketLoading: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center scale-90">
    <div className="rocket-container">
      <div className="text-[100px] drop-shadow-2xl">🚀</div>
      <div className="exhaust-flame"></div>
    </div>
    <div className="mt-12 flex flex-col items-center space-y-4 px-4 text-center">
      <div className="w-64 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10 relative">
        <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 animate-[loading_2s_ease-in-out_infinite] absolute top-0 left-0"></div>
      </div>
      <p className="text-xl font-black tracking-widest text-white uppercase animate-pulse">{message || 'Processing...'}</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [step, setStep] = useState<'auth' | 'home' | 'config' | 'loading' | 'ready' | 'quiz' | 'reward' | 'paste' | 'history' | 'lobby' | 'minigame_balloons' | 'join'>('auth');
  const [lang, setLang] = useState<Language>('ar');
  const [user, setUser] = useState<{name: string, photo: string} | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [history, setHistory] = useState<SavedGame[]>([]);
  const [mode, setMode] = useState<'solo' | 'multi'>('solo');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [peer, setPeer] = useState<any>(null);
  const [conn, setConn] = useState<any>(null);
  const [roomId, setRoomId] = useState('');
  const [joinId, setJoinId] = useState('');
  const [opponent, setOpponent] = useState<PlayerState | null>(null);
  const [isFriendConnected, setIsFriendConnected] = useState(false);

  const [config, setConfig] = useState<QuizConfig>({ count: 5, difficulty: 'medium', language: 'ar', allowedTypes: [QuestionType.MULTIPLE_CHOICE] });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [player, setPlayer] = useState<PlayerState>({ score: 0, currentQuestionIndex: 0, attempts: {}, isFinished: false, isWaiting: false, lastActionStatus: null });
  const [wrongAnswers, setWrongAnswers] = useState<number[]>([]);
  const [correctAnswerIdx, setCorrectAnswerIdx] = useState<number>(-1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { playSound, stopBg, isMuted, toggleMute, unlockAudio } = useGameSounds();

  const translations = {
    ar: {
      welcome: "أهلاً بك 👋",
      google: "دخول سريع عبر Google",
      loggingIn: "جاري التحقق...",
      acceptText: "أوافق على الشروط والخصوصية",
      solo: 'تحدي الإتقان 🧠', soloSub: 'تعلم فردي ذكي', multi: 'المواجهة الثنائية 🆚', multiSub: 'أنشئ التحدي وأرسله',
      settings: 'إعدادات الاختبار', winner: 'أداء عبقري! 💎',
      scoreLabel: 'النتيجة', points: 'نقطة', score: 'النقاط:', home: 'الرئيسية',
      generate: 'تحليل وإنشاء ✨', snap: 'تصوير الدرس 📸', 
      paste: 'نص يدوي 📝', pastePlaceholder: 'ضع النص هنا ليقوم الذكاء الاصطناعي بتحليله...', back: 'رجوع', loadingMsg: 'جاري التحليل...',
      balloons: '🎈 فرقع البالونات!', history: 'السجل 📜', historyTitle: 'سجل آخر 10 اختبارات', noHistory: 'لا توجد سجلات بعد',
      quizOf: 'اختبار بتاريخ', questionsCount: 'سؤال', joinTitle: 'انضم للمواجهة',
      quizReady: 'الاختبار جاهز! 🎉', startQuiz: 'ابدأ التحدي 🔊',
      backBtn: 'رجوع', clearAll: "مسح الكل 🗑️", totalScore: 'النتيجة النهائية',
      bestScoreLabel: "أفضل نتيجة:", dateLabel: "التاريخ:",
      exitConfirm: "هل تريد الخروج من الاختبار الحالي؟",
      createRoom: "إنشاء رمز التحدي", joinRoom: "الانضمام لصديق", roomID: "رمز الغرفة:",
      waitingFriend: "الاختبار جاهز! شارك الرمز مع صديقك وانتظره هنا...", friendJoined: "دخل الصديق! جاري البدء... ✅",
      enterRoomID: "أدخل رمز الغرفة المكون من 6 أحرف", connect: "اتصال", connecting: "جاري الربط...",
      vsOpponent: "ضد خصمك", opponentFinished: "الخصم انتهى!",
      copyCode: "نسخ الرمز", codeCopied: "تم النسخ!"
    },
    en: {
      welcome: "Welcome 👋",
      google: "Quick Start with Google",
      loggingIn: "Authenticating...",
      acceptText: "I agree to Terms & Privacy",
      solo: 'Mastery Mode 🧠', soloSub: 'Solo Smart Learning', multi: '2-Player Duel 🆚', multiSub: 'Create & Share Duel',
      settings: 'Quiz Config', winner: 'Genius! 💎',
      scoreLabel: 'SCORE', points: 'Pts', score: 'Score:', home: 'Home',
      generate: 'Generate ✨', snap: 'Snap Lesson 📸', 
      paste: 'Manual Text 📝', pastePlaceholder: 'Paste text here...', back: 'Back', loadingMsg: 'Analyzing...',
      balloons: '🎈 Pop Balloons!', history: 'History 📜', historyTitle: 'Last 10 Quizzes', noHistory: 'No history yet',
      quizOf: 'Quiz of', questionsCount: 'questions', joinTitle: 'Join Duel',
      quizReady: 'Quiz Ready! 🎉', startQuiz: 'Start Challenge 🔊',
      backBtn: 'Back', clearAll: "Clear All 🗑️", totalScore: 'FINAL SCORE',
      bestScoreLabel: "Best Score:", dateLabel: "Date:",
      exitConfirm: "Exit the current quiz?",
      createRoom: "Generate Code", joinRoom: "Join a Friend", roomID: "Room ID:",
      waitingFriend: "Quiz ready! Share code and wait for friend...", friendJoined: "Friend Joined! Starting... ✅",
      enterRoomID: "Enter 6-character room ID", connect: "Connect", connecting: "Connecting...",
      vsOpponent: "vs Opponent", opponentFinished: "Opponent Finished!",
      copyCode: "Copy Code", codeCopied: "Copied!"
    },
    de: {
      welcome: "Willkommen 👋",
      google: "Schnellstart mit Google",
      loggingIn: "Authentifizierung...",
      acceptText: "Nutzungsbedingungen akzeptieren",
      solo: 'Meistermodus 🧠', soloSub: 'Smartes Einzellernen', multi: 'Duell-Modus 🆚', multiSub: 'Erstellen & Teilen',
      settings: 'Quiz-Konfig', winner: 'Genial! 💎',
      scoreLabel: 'PUNKTE', points: 'Pkt', score: 'Punkte:', home: 'Home',
      generate: 'Generieren ✨', snap: 'Lektion knipsen 📸', 
      paste: 'Manueller Text 📝', pastePlaceholder: 'Text hier einfügen...', back: 'Zurück', loadingMsg: 'Analysieren...',
      balloons: '🎈 Ballons zerplatzen!', history: 'Verlauf 📜', historyTitle: 'Letzte 10 Quizzes', noHistory: 'Noch kein Verlauf',
      quizOf: 'Quiz vom', questionsCount: 'Fragen', joinTitle: 'Duell beitreten',
      quizReady: 'Quiz bereit! 🎉', startQuiz: 'Herausforderung starten 🔊',
      backBtn: 'Zurück', clearAll: "Alle löschen 🗑️", totalScore: 'GESAMTPUNKTZAHL',
      bestScoreLabel: "Beste Punktzahl:", dateLabel: "Datum:",
      exitConfirm: "Aktuelles Quiz beenden?",
      createRoom: "Code generieren", joinRoom: "Freund beitreten", roomID: "Raum-ID:",
      waitingFriend: "Quiz bereit! Code teilen und warten...", friendJoined: "Freund beigetreten! Startet... ✅",
      enterRoomID: "6-stellige Raum-ID eingeben", connect: "Verbinden", connecting: "Verbindung...",
      vsOpponent: "vs Gegner", opponentFinished: "Gegner fertig!",
      copyCode: "Code kopieren", codeCopied: "Kopiert!"
    }
  };

  const t = translations[lang] || translations.ar;

  useEffect(() => {
    document.dir = (lang === 'ar') ? 'rtl' : 'ltr';
    const saved = localStorage.getItem('quiz_history');
    if (saved) setHistory(JSON.parse(saved));
  }, [lang]);

  useEffect(() => {
    if (step === 'home') playSound('bg');
  }, [step, playSound]);

  // PeerJS Logic
  const initHost = () => {
    const id = generateShortId();
    const p = new Peer(id);
    p.on('open', (id: string) => { 
      setRoomId(id); 
      setStep('lobby'); 
    });
    p.on('connection', (c: any) => {
      setConn(c);
      setIsFriendConnected(true);
      c.on('open', () => {
        c.send({ type: 'INIT_QUIZ', payload: { questions: questions, config: config } });
        setTimeout(() => setStep('quiz'), 1500);
      });
      setupConn(c);
    });
    setPeer(p);
  };

  const initGuest = () => {
    setStep('join');
  };

  const connectToHost = () => {
    if (!joinId) return;
    const p = new Peer(generateShortId());
    p.on('open', () => {
      const c = p.connect(joinId);
      setConn(c);
      setupConn(c);
    });
    setPeer(p);
  };

  const setupConn = (c: any) => {
    c.on('data', (data: MultiplayerMessage) => {
      if (data.type === 'INIT_QUIZ') {
        setQuestions(data.payload.questions);
        setConfig(data.payload.config);
        setStep('ready');
      } else if (data.type === 'PROGRESS') {
        setOpponent(data.payload);
      }
    });
    c.on('open', () => {
      setIsFriendConnected(true);
      if (step === 'join') setStep('loading');
    });
  };

  const syncProgress = (state: PlayerState) => {
    if (conn) {
      conn.send({ type: 'PROGRESS', payload: state });
    }
  };

  const saveToHistory = (newScore: number) => {
    const newEntry: SavedGame = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      title: questions[0]?.question.slice(0, 40) + "...",
      questions: questions,
      config: config,
      bestScore: newScore
    };
    const updatedHistory = [newEntry, ...history].slice(0, 10);
    setHistory(updatedHistory);
    localStorage.setItem('quiz_history', JSON.stringify(updatedHistory));
  };

  const handleBack = () => {
    if (peer) { peer.destroy(); setPeer(null); setConn(null); setIsFriendConnected(false); setOpponent(null); }
    switch (step) {
      case 'config': setStep('home'); break;
      case 'history': setStep('home'); break;
      case 'lobby': setStep('home'); break;
      case 'join': setStep('home'); break;
      case 'paste': setStep('config'); break;
      case 'ready': setStep('home'); break;
      case 'quiz': if (window.confirm(t.exitConfirm)) setStep('home'); break;
      case 'reward': setStep('home'); break;
      case 'minigame_balloons': setStep('home'); break;
      default: setStep('home');
    }
  };

  const startQuiz = async (base64?: string) => {
    unlockAudio();
    setStep('loading');
    try {
      const q = base64 ? await generateQuizFromImage(base64, config) : await generateQuizFromText(pastedText, config);
      setQuestions(q);
      setPlayer({ score: 0, currentQuestionIndex: 0, attempts: {}, isFinished: false, isWaiting: false, lastActionStatus: null });
      
      if (mode === 'multi') {
        initHost();
      } else {
        setStep('ready');
      }
    } catch (e: any) { alert(e.message); setStep('config'); }
  };

  const handleAnswer = (opt: string, idx: number) => {
    if (player.isWaiting) return;
    const currentQ = questions[player.currentQuestionIndex];
    const isCorrect = opt === currentQ.correctAnswer;
    const qAttempts = (player.attempts[currentQ.id] || 0) + 1;
    const updatedAttempts = { ...player.attempts, [currentQ.id]: qAttempts };

    if (isCorrect) {
      setCorrectAnswerIdx(idx);
      playSound('correct');
      let newScore = player.score + (qAttempts === 1 ? 1 : 0);
      const nextIdx = player.currentQuestionIndex + 1;
      const isFinished = nextIdx >= questions.length;
      const newState = { ...player, score: newScore, currentQuestionIndex: nextIdx, isFinished, isWaiting: true, attempts: updatedAttempts };
      setPlayer(newState);
      if (mode === 'multi') syncProgress(newState);

      setTimeout(() => {
        if (!isFinished) {
          setPlayer(prev => ({ ...prev, isWaiting: false }));
          setWrongAnswers([]);
          setCorrectAnswerIdx(-1);
        } else {
          playSound('win');
          saveToHistory(newScore);
          setStep('reward');
        }
      }, 800);
    } else {
      if (!wrongAnswers.includes(idx)) {
        setWrongAnswers(prev => [...prev, idx]);
        playSound('wrong');
        const newState = { ...player, attempts: updatedAttempts };
        setPlayer(newState);
        if (mode === 'multi') syncProgress(newState);
      }
    }
  };

  const handleLogin = () => {
    if (!legalAccepted) return;
    setIsLoggingIn(true);
    unlockAudio();
    setTimeout(() => { setIsLoggingIn(false); setUser({ name: "User", photo: "" }); setStep('home'); }, 1000);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-8 overflow-hidden relative">
      <div className="w-full max-w-4xl flex justify-between items-center py-2 z-50 mb-4 sticky top-0">
        <div className="flex gap-2">
          <button onClick={() => { handleBack(); setStep('home'); }} className="glass p-3 rounded-2xl text-xl shadow-lg transition-all hover:scale-110 active:scale-95 bg-white/10">🏠</button>
          {step !== 'auth' && step !== 'home' && (
            <button onClick={handleBack} className="glass px-6 py-2 rounded-2xl font-black text-sm shadow-lg border border-white/20 transition-all hover:bg-white/10 flex items-center gap-2">
              <span className={lang === 'ar' ? '' : 'rotate-180'}>⬅️</span> {t.backBtn}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {['ar', 'en', 'de'].map(l => (
            <button key={l} onClick={() => setLang(l as Language)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${lang === l ? 'bg-blue-600 shadow-lg text-white' : 'glass text-white/50'}`}>
              {l.toUpperCase()}
            </button>
          ))}
          <button onClick={toggleMute} className={`glass p-3 rounded-2xl transition-all shadow-xl ${isMuted ? 'text-rose-400 bg-rose-500/10' : 'text-emerald-400 bg-emerald-500/10 animate-pulse'}`}>{isMuted ? '🔇' : '🔊'}</button>
        </div>
      </div>

      {step === 'auth' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full text-center space-y-12 animate-in">
          <SnapQuizGameLogo size={240} />
          <div className="w-full space-y-6 max-w-sm">
            <div onClick={() => setLegalAccepted(!legalAccepted)} className="flex items-center gap-4 bg-white/5 p-5 rounded-3xl border border-white/10 cursor-pointer group transition-all">
               <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${legalAccepted ? 'bg-blue-600 border-blue-400 shadow-lg' : 'border-white/20 group-hover:border-white/40'}`}>
                 {legalAccepted && <span className="text-white text-lg font-black">✓</span>}
               </div>
               <p className="text-xs font-bold text-white/80">{t.acceptText}</p>
            </div>
            <button onClick={handleLogin} disabled={isLoggingIn || !legalAccepted} className={`w-full bg-white text-slate-900 py-6 rounded-[2rem] font-black text-xl shadow-2xl transition-all ${(!legalAccepted || isLoggingIn) ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}>{isLoggingIn ? t.loggingIn : t.google}</button>
          </div>
        </div>
      )}

      {step === 'home' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl space-y-8 animate-in">
          <SnapQuizGameLogo />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg px-4">
            <button onClick={() => { setMode('solo'); setStep('config'); }} className="glass p-8 rounded-[3rem] text-center hover:bg-white/5 transition-all group">
              <div className="text-6xl mb-4 group-hover:scale-110">🧠</div>
              <h2 className="text-2xl font-black text-blue-100">{t.solo}</h2>
              <p className="text-blue-300 text-xs mt-2 font-bold">{t.soloSub}</p>
            </button>
            <button onClick={() => { setMode('multi'); setStep('config'); }} className="glass p-8 rounded-[3rem] text-center border-indigo-500/30 hover:bg-white/5 transition-all group relative overflow-hidden">
               <div className="absolute top-2 right-4 bg-indigo-500 text-white text-[10px] px-2 py-1 rounded-full font-black animate-pulse">HOST</div>
              <div className="text-6xl mb-4 group-hover:scale-110">🆚</div>
              <h2 className="text-2xl font-black text-indigo-300">{t.multi}</h2>
              <p className="text-indigo-400 text-xs mt-2 font-bold">{t.multiSub}</p>
            </button>
          </div>
          <div className="flex gap-4 w-full max-w-lg px-4">
             <button onClick={() => setStep('history')} className="glass flex-1 py-5 rounded-3xl font-black text-blue-300 text-xl shadow-xl hover:bg-white/5">{t.history}</button>
             <button onClick={() => { setMode('multi'); initGuest(); }} className="glass bg-white/5 flex-1 py-5 rounded-3xl font-black text-emerald-400 text-xl shadow-xl hover:bg-white/10">{t.joinTitle}</button>
          </div>
        </div>
      )}

      {step === 'lobby' && (
        <div className="w-full max-w-md glass p-10 rounded-[3.5rem] space-y-8 shadow-2xl animate-in text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          <h2 className="text-3xl font-black text-blue-200 uppercase">{t.roomID}</h2>
          {roomId && (
            <div className="relative group">
              <div className="bg-slate-900/50 p-8 rounded-[2rem] border-2 border-dashed border-blue-500/50 cursor-pointer transition-all hover:bg-slate-900/80 active:scale-95"
                onClick={() => { navigator.clipboard.writeText(roomId); alert(t.codeCopied); }}>
                <span className="text-6xl font-black text-white tracking-widest block">{roomId}</span>
                <span className="text-[10px] text-blue-400 font-black mt-2 uppercase">{t.copyCode} 📋</span>
              </div>
            </div>
          )}
          <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10">
             <div className="text-4xl mb-4">📋</div>
             <p className="text-white font-black text-lg mb-2">{questions.length} {t.questionsCount}</p>
             <p className="text-white/40 text-xs font-bold leading-relaxed">{t.waitingFriend}</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 flex items-center justify-center gap-4">
            <div className={`w-4 h-4 rounded-full ${isFriendConnected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-rose-500 animate-pulse'}`}></div>
            <p className="font-black text-white">{isFriendConnected ? t.friendJoined : t.connecting}</p>
          </div>
        </div>
      )}

      {step === 'join' && (
        <div className="w-full max-w-md glass p-10 rounded-[3.5rem] space-y-8 shadow-2xl animate-in text-center">
          <h2 className="text-3xl font-black text-emerald-400 uppercase">{t.joinRoom}</h2>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm font-bold">{t.enterRoomID}</p>
            <input 
              type="text" 
              maxLength={6} 
              className="w-full bg-slate-900/50 border-2 border-white/10 rounded-3xl p-6 text-center text-5xl font-black text-white outline-none focus:border-emerald-500 transition-all uppercase"
              placeholder="ABCDEF"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
            />
          </div>
          <button onClick={connectToHost} className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-2xl shadow-xl hover:scale-105 active:translate-y-2 transition-all">
            {t.connect} 🔗
          </button>
        </div>
      )}

      {step === 'history' && (
        <div className="w-full max-w-2xl glass p-8 rounded-[3.5rem] flex flex-col h-[75vh] shadow-2xl animate-in">
          <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
            <h2 className="text-3xl font-black text-blue-200 uppercase">{t.historyTitle}</h2>
            {history.length > 0 && <button onClick={() => { setHistory([]); localStorage.removeItem('quiz_history'); }} className="bg-rose-600/20 text-rose-400 px-4 py-2 rounded-xl text-xs font-black">{t.clearAll}</button>}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
            {history.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 opacity-40"><div className="text-8xl">📜</div><p className="font-black text-xl">{t.noHistory}</p></div> : 
              history.map((item) => (
                <div key={item.id} className="glass bg-white/5 p-6 rounded-3xl border border-white/10 relative group hover:border-blue-500/30 transition-all">
                   <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center text-2xl shadow-inner">📝</div>
                      <div className="flex-1">
                        <h4 className="font-black text-white text-lg leading-tight mb-2 pr-6">{item.title}</h4>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-bold text-blue-300/60 uppercase"><span>📅 {item.date}</span><span className="text-emerald-400">🏆 {t.bestScoreLabel} {item.bestScore} / {item.questions.length}</span></div>
                      </div>
                   </div>
                   <button onClick={() => { setQuestions(item.questions); setConfig(item.config); setStep('ready'); }} className="mt-4 w-full bg-blue-600/20 hover:bg-blue-600 text-blue-100 py-2 rounded-xl font-black text-xs transition-all opacity-0 group-hover:opacity-100">{lang === 'ar' ? 'إعادة الاختبار' : 'RETRY QUIZ'} 🔄</button>
                </div>
              ))}
          </div>
        </div>
      )}

      {step === 'config' && (
        <div className="w-full max-w-md glass p-10 rounded-[3.5rem] space-y-8 shadow-2xl animate-in">
          <h2 className="text-2xl font-black text-center text-blue-200 uppercase tracking-widest">{t.settings}</h2>
          <div className="space-y-4 pt-6">
            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black text-2xl shadow-xl hover:scale-105 transition-all border-b-[8px] border-blue-900 active:border-b-0 active:translate-y-2">{t.snap}</button>
            <button onClick={() => setStep('paste')} className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-2xl shadow-xl hover:scale-105 transition-all border-b-[8px] border-emerald-900 active:border-b-0 active:translate-y-2">{t.paste}</button>
            <input type="file" capture="environment" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => startQuiz(r.result?.toString().split(',')[1]); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
          </div>
        </div>
      )}

      {step === 'paste' && (
        <div className="w-full max-w-2xl glass p-10 rounded-[3.5rem] flex flex-col h-[70vh] shadow-2xl animate-in">
          <h2 className="text-3xl font-black text-center text-emerald-400 mb-8 uppercase tracking-widest">{t.paste}</h2>
          <textarea className="w-full flex-1 p-8 rounded-[3rem] bg-slate-900/50 text-white mb-10 outline-none border-2 border-white/10 text-xl font-bold placeholder:opacity-20 resize-none shadow-inner" placeholder={t.pastePlaceholder} value={pastedText} onChange={(e) => setPastedText(e.target.value)} />
          <button onClick={() => startQuiz()} className="w-full bg-blue-600 text-white py-8 rounded-[3rem] font-black text-4xl shadow-2xl hover:bg-blue-500 transition-all border-b-[12px] border-blue-900 active:border-b-0 active:translate-y-2">{t.generate} 🚀</button>
        </div>
      )}

      {step === 'loading' && <div className="flex-1 flex items-center"><RocketLoading message={t.loadingMsg} /></div>}
      
      {step === 'ready' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full text-center space-y-12 animate-in">
           <div className="text-9xl animate-bounce drop-shadow-2xl">📋</div>
           <h2 className="text-5xl font-black text-white tracking-tighter drop-shadow-lg">{t.quizReady}</h2>
           <button onClick={() => { setStep('quiz'); }} className="bg-blue-600 text-white text-4xl font-black px-12 py-10 rounded-[3rem] shadow-2xl border-b-[12px] border-blue-900 active:translate-y-2 active:border-b-0 transition-all">{t.startQuiz}</button>
        </div>
      )}

      {step === 'quiz' && (
        <div className="w-full max-w-2xl space-y-6 animate-in py-2 flex flex-col h-full">
          {mode === 'multi' && opponent && (
            <div className="glass p-4 rounded-3xl flex justify-between items-center border border-indigo-500/30 animate-pulse">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-xl font-black">👤</div>
                 <div>
                    <p className="text-[10px] font-black text-indigo-300 uppercase leading-none">{t.vsOpponent}</p>
                    <p className="text-xl font-black text-white">{opponent.score} <span className="text-[10px] text-white/50">{t.points}</span></p>
                 </div>
               </div>
               <div className="flex-1 px-8">
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(opponent.currentQuestionIndex / questions.length) * 100}%` }}></div>
                  </div>
               </div>
               <div className="text-white font-black text-lg">{opponent.isFinished ? "🏁" : `${opponent.currentQuestionIndex + 1}/${questions.length}`}</div>
            </div>
          )}
          <div className="quiz-card p-10 relative flex-1 flex flex-col border-t-[12px] border-blue-600 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
               <div className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-2xl shadow-lg border border-white/10">{t.scoreLabel} {player.score}</div>
               <div className="text-slate-400 font-black text-lg bg-slate-100 px-6 py-2 rounded-full shadow-inner">{player.currentQuestionIndex + 1} / {questions.length}</div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-center mb-10 text-slate-800 flex-1 flex items-center justify-center bg-slate-50 p-8 rounded-[2.5rem] shadow-inner border border-slate-200">{questions[player.currentQuestionIndex]?.question}</div>
            <div className="grid grid-cols-1 gap-4">
              {questions[player.currentQuestionIndex]?.options.map((opt, i) => (
                <button key={i} disabled={player.isWaiting} onClick={() => handleAnswer(opt, i)} className={`p-5 rounded-3xl text-xl font-black transition-all border-b-8 active:scale-95 shadow-lg ${correctAnswerIdx === i ? 'bg-emerald-500 text-white border-emerald-700' : wrongAnswers.includes(i) ? 'bg-rose-500 text-white border-rose-700 animate-[shake_0.4s]' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'reward' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full text-center">
             <div className="glass p-12 rounded-[4rem] w-full max-w-lg shadow-2xl animate-in border border-white/10">
               <div className="text-[100px] mb-6 animate-bounce">🏆</div>
               <h2 className="text-4xl font-black text-white mb-6 italic drop-shadow-lg">{t.winner}</h2>
               {mode === 'multi' && opponent && (
                 <div className="flex gap-4 mb-8">
                    <div className="flex-1 bg-white/5 p-6 rounded-3xl border-2 border-emerald-500/50">
                      <p className="text-[10px] font-black text-emerald-400 mb-2">YOU</p>
                      <p className="text-5xl font-black text-white">{player.score}</p>
                    </div>
                    <div className="flex-1 bg-white/5 p-6 rounded-3xl border-2 border-indigo-500/50">
                      <p className="text-[10px] font-black text-indigo-400 mb-2">FRIEND</p>
                      <p className="text-5xl font-black text-white">{opponent.score}</p>
                    </div>
                 </div>
               )}
               <div className="bg-slate-900/40 p-8 rounded-[3rem] mb-10 shadow-inner">
                 <p className="text-blue-300 font-black mb-1 text-sm uppercase tracking-widest">{t.totalScore}</p>
                 <div className="text-8xl font-black text-white leading-none">{player.score}</div>
               </div>
               <button onClick={() => setStep('minigame_balloons')} className="w-full bg-indigo-600 border-b-[12px] border-indigo-950 text-white py-10 rounded-[3rem] font-black text-4xl shadow-2xl transition-all hover:scale-105 active:border-b-0 active:translate-y-2">{t.balloons} 🎈</button>
             </div>
        </div>
      )}

      {step === 'minigame_balloons' && <BalloonPopGame lang={lang} score={player.score} onFinish={() => setStep('home')} />}
    </div>
  );
};

export default App;
