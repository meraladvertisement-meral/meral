
import React, { useState, useEffect, useRef } from 'react';
import { generateQuizFromImage, generateQuizFromText } from './geminiService';
import { Question, PlayerState, QuizConfig, Language, QuestionType, SavedGame, MultiplayerMessage, Difficulty } from './types';
import { useGameSounds } from './components/SoundManager';
import { BalloonPopGame } from './components/BalloonPopGame';

declare var Peer: any;

const generateShortId = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const QuizSnapLogo: React.FC<{ size?: number }> = ({ size = 180 }) => (
  <div className="flex flex-col items-center logo-glow">
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
      <div className="flex font-black text-6xl tracking-tighter italic" dir="ltr">
        <span className="text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.9)]">Quiz</span>
        <span className="text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.9)]">Snap</span>
      </div>
      <p className="text-blue-300 text-[11px] font-bold tracking-[0.4em] uppercase opacity-70 mt-2" dir="ltr">Smart Learning AI</p>
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
  
  // PeerJS States
  const [peer, setPeer] = useState<any>(null);
  const [conn, setConn] = useState<any>(null);
  const [roomId, setRoomId] = useState('');
  const [joinId, setJoinId] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success'>('idle');
  const [opponent, setOpponent] = useState<PlayerState | null>(null);

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
      welcome: "أهلاً بك في كويز سناب 👋",
      authSub: "ادخل عبر Google أو Apple – سريع وآمن للعائلات.",
      google: "الدخول عبر Google",
      apple: "الدخول عبر Apple",
      acceptTerms: "أوافق على سياسة الخصوصية وشروط الاستخدام",
      solo: 'تحدي الإتقان 🧠', soloSub: 'تعلم فردي ذكي', multi: 'المواجهة الثنائية 🆚', multiSub: 'أرسل رابطاً أو كود لصديقك',
      settings: 'إعدادات الاختبار', winner: 'أداء عبقري! 💎',
      scoreLabel: 'النتيجة', points: 'نقطة', score: 'مجموع النقاط:', home: 'الرئيسية',
      generate: 'تحليل وإنشاء ✨', snap: 'تصوير الدرس 📸', 
      paste: 'نص يدوي 📝', pastePlaceholder: 'ضع النص هنا ليقوم الذكاء الاصطناعي بتحليله...', back: 'تراجع', loadingMsg: 'جاري التحليل...',
      balloons: '🎈 فرقع البالونات!', qType: 'اختر نوع الأسئلة:', mcq: 'ABC', tf: 'T/F', fill: '___',
      qCount: 'عدد الأسئلة:', history: 'السجل 📜', historyTitle: 'آخر 10 ألعاب', noHistory: 'لا يوجد سجل حالياً',
      quizOf: 'اختبار بتاريخ', questions: 'سؤال', joinTitle: 'انضم للمواجهة', joinPlaceholder: 'ادخل كود الغرفة (6 أرقام)',
      copy: 'نسخ رابط الدعوة 🔗', copied: 'تم النسخ! ✅', backBtn: 'تراجع',
      quizReady: 'الاختبار جاهز! 🎉', startQuiz: 'ابدأ التحدي 🔊',
      enableMusic: 'فعل الموسيقى بالضغط',
      diffLabel: 'مستوى الصعوبة:',
      easy: 'سهل 👶', medium: 'متوسط ⚡', hard: 'صعب 🔥',
      waitingFriend: 'بانتظار صديقك...', connect: 'دخول المواجهة 🔗', hostCode: 'كود الغرفة:', shareCode: 'أرسل هذا الكود لصديقك',
      you: 'أنت', opponent: 'الخصم', win: 'الفائز!', draw: 'تعادل!', totalScore: 'النتيجة النهائية'
    },
    en: {
      welcome: "Welcome to QuizSnap 👋",
      authSub: "Sign in with Google or Apple – fast and safe.",
      google: "Continue with Google",
      apple: "Continue with Apple",
      acceptTerms: "I agree to the Privacy Policy and Terms of Use",
      solo: 'Mastery Mode 🧠', soloSub: 'Solo Smart Learning', multi: '2-Player Duel 🆚', multiSub: 'Send link or code to a friend',
      settings: 'Quiz Config', winner: 'Genius! 💎',
      scoreLabel: 'SCORE', points: 'Pts', score: 'Score:', home: 'Home',
      generate: 'Generate ✨', snap: 'Snap Lesson 📸', 
      paste: 'Paste 📝', pastePlaceholder: 'Paste text here...', back: 'Back', loadingMsg: 'Analyzing...',
      balloons: '🎈 Pop Balloons!', qType: 'Question Type:', mcq: 'ABC', tf: 'T/F', fill: '___',
      qCount: 'Questions:', history: 'History 📜', historyTitle: 'Last 10 Games', noHistory: 'No history',
      quizOf: 'Quiz of', questions: 'Questions', joinTitle: 'Join Duel', joinPlaceholder: 'Enter Room Code (6 digits)',
      copy: 'Copy Invite Link 🔗', copied: 'Copied! ✅', backBtn: 'Back',
      quizReady: 'Quiz is Ready! 🎉', startQuiz: 'Start Challenge 🔊',
      enableMusic: 'Click to enable music',
      diffLabel: 'Difficulty Level:',
      easy: 'Easy 👶', medium: 'Med ⚡', hard: 'Hard 🔥',
      waitingFriend: 'Waiting for friend...', connect: 'Join Duel 🔗', hostCode: 'Room Code:', shareCode: 'Send this code to your friend',
      you: 'YOU', opponent: 'OPPONENT', win: 'WINNER!', draw: 'DRAW!', totalScore: 'FINAL SCORE'
    },
    de: {
      welcome: "Willkommen bei QuizSnap 👋",
      authSub: "Anmelden with Google or Apple – schnell und sicher.",
      google: "Mit Google anmelden",
      apple: "Mit Apple anmelden",
      acceptTerms: "Nutzungsbedingungen akzeptieren",
      solo: 'Meisterschaft 🧠', soloSub: 'Lerne alleine', multi: 'Duell 🆚', multiSub: 'Freund einladen',
      settings: 'Einstellungen', winner: 'Genial! 💎',
      scoreLabel: 'Punkte', points: 'Pkt', score: 'Punktzahl:', home: 'Start',
      generate: 'Generieren ✨', snap: 'Knipsen 📸', 
      paste: 'Einfügen 📝', pastePlaceholder: 'Text hier einfügen...', back: 'Zurück', loadingMsg: 'Analyse...',
      balloons: '🎈 Ballons!', qType: 'Fragetyp:', mcq: 'ABC', tf: 'R/F', fill: '___',
      qCount: 'Anzahl:', history: 'Verlauf 📜', historyTitle: 'Letzte Spiele', noHistory: 'Kein Verlauf',
      quizOf: 'Quiz vom', questions: 'Fragen', joinTitle: 'Duell beitreten', joinPlaceholder: 'Raumcode',
      copy: 'Link kopieren 🔗', copied: 'Kopiert! ✅', backBtn: 'Zurück',
      quizReady: 'Bereit! 🎉', startQuiz: 'Starten 🔊',
      enableMusic: 'Musik aktivieren',
      diffLabel: 'Schwierigkeit:',
      easy: 'Leicht 👶', medium: 'Mittel ⚡', hard: 'Schwer 🔥',
      waitingFriend: 'Warten...', connect: 'Beitreten 🔗', hostCode: 'Code:', shareCode: 'Code senden',
      you: 'DU', opponent: 'GEGNER', win: 'GEWINNER!', draw: 'REMIS!', totalScore: 'ENDSTAND'
    }
  };

  const t = translations[lang] || translations.ar;

  useEffect(() => {
    document.dir = (lang === 'ar') ? 'rtl' : 'ltr';
    setConfig(prev => ({ ...prev, language: lang }));
    const saved = localStorage.getItem('quiz_history');
    if (saved) setHistory(JSON.parse(saved));
    if (step === 'home') playSound('bg');

    // Deep linking support
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl && step === 'auth') {
      setJoinId(roomFromUrl);
    }
  }, [lang, step]);

  useEffect(() => {
    if (peer) {
      peer.on('connection', (c: any) => {
        setConn(c);
        c.on('open', () => {
          if (questions.length > 0) {
            c.send({ type: 'INIT_QUIZ', payload: { questions, config } });
            setStep('ready');
          }
        });
        c.on('data', (data: MultiplayerMessage) => handleMultiplayerData(data));
      });
    }
  }, [peer, questions, config]);

  const handleMultiplayerData = (data: MultiplayerMessage) => {
    switch (data.type) {
      case 'INIT_QUIZ':
        setQuestions(data.payload.questions);
        setConfig(data.payload.config);
        setStep('ready');
        break;
      case 'PROGRESS':
        setOpponent(data.payload);
        break;
    }
  };

  const initMultiplayerHost = () => {
    const id = generateShortId();
    const p = new Peer(id);
    p.on('open', () => {
      setRoomId(id);
      setPeer(p);
      setMode('multi');
      setStep('config');
    });
    p.on('error', (err: any) => {
      console.error(err);
      alert('Network error. Retrying...');
      initMultiplayerHost();
    });
  };

  const connectToRoom = (id: string) => {
    if (!id || id.length < 6) return;
    setStep('loading');
    const p = new Peer();
    p.on('open', () => {
      const c = p.connect(id);
      setConn(c);
      c.on('data', (data: MultiplayerMessage) => handleMultiplayerData(data));
      c.on('error', () => {
        alert(lang === 'ar' ? 'لم نتمكن من العثور على الغرفة.' : 'Room not found.');
        setStep('home');
      });
      setPeer(p);
      setMode('multi');
    });
  };

  const saveToHistory = (finalScore: number) => {
    const newEntry: SavedGame = {
      id: Date.now().toString(),
      date: new Date().toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US'),
      title: questions[0]?.question.substring(0, 40) + "...",
      questions,
      config,
      bestScore: finalScore
    };
    setHistory(prev => {
      const updated = [newEntry, ...prev].slice(0, 10);
      localStorage.setItem('quiz_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleLogin = (provider: 'google' | 'apple') => {
    if (!legalAccepted) {
      alert(lang === 'ar' ? 'يرجى الموافقة على الشروط أولاً.' : 'Please accept terms first.');
      return;
    }
    unlockAudio(); 
    setUser({ name: "User", photo: "" });
    if (joinId) {
      connectToRoom(joinId);
    } else {
      setStep('home');
    }
  };

  const startQuiz = async (base64?: string) => {
    unlockAudio();
    setStep('loading');
    try {
      const q = base64 ? await generateQuizFromImage(base64, config) : await generateQuizFromText(pastedText, config);
      setQuestions(q);
      setPlayer({ score: 0, currentQuestionIndex: 0, attempts: {}, isFinished: false, isWaiting: false, lastActionStatus: null });
      setWrongAnswers([]);
      setCorrectAnswerIdx(-1);
      
      if (mode === 'multi') {
        if (conn && conn.open) {
          conn.send({ type: 'INIT_QUIZ', payload: { questions: q, config } });
          setStep('ready');
        } else {
          setStep('lobby');
        }
      } else {
        setStep('ready');
      }
    } catch (e) { 
      alert(lang === 'ar' ? "فشل التحليل. تأكد من جودة النص/الصورة." : "Analysis failed."); 
      setStep('config'); 
    }
  };

  const startActualQuiz = () => {
    if (isMuted) toggleMute(); 
    unlockAudio();
    playSound('bg');
    setStep('quiz');
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

      if (mode === 'multi' && conn) {
        conn.send({ type: 'PROGRESS', payload: newState });
      }

      setTimeout(() => {
        if (!isFinished) {
          setPlayer(prev => ({ ...prev, isWaiting: false }));
          setWrongAnswers([]);
          setCorrectAnswerIdx(-1);
        } else {
          saveToHistory(newScore);
          stopBg();
          playSound('win');
          setStep('reward');
        }
      }, 800);
    } else {
      if (!wrongAnswers.includes(idx)) {
        setWrongAnswers(prev => [...prev, idx]);
        playSound('wrong');
        setPlayer(prev => ({ ...prev, attempts: updatedAttempts }));
      }
    }
  };

  const copyInviteLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    navigator.clipboard.writeText(url.toString());
    setCopyStatus('success');
    setTimeout(() => setCopyStatus('idle'), 3000);
  };

  const goBack = () => {
    unlockAudio();
    stopBg();
    if (step === 'paste') setStep('config');
    else if (step === 'lobby') setStep('config');
    else if (step === 'join') setStep('home');
    else if (step === 'config') setStep('home');
    else setStep('home');
  };

  const renderMultiplayerReward = () => {
    const userScore = player.score;
    const oppScore = opponent?.score || 0;
    const isUserWinner = userScore > oppScore;
    const isDraw = userScore === oppScore;
    const isOpponentWinner = oppScore > userScore;

    return (
      <div className="flex flex-col items-center w-full max-w-4xl space-y-8 animate-in">
        <div className="flex flex-col md:flex-row w-full gap-4 md:gap-0 bg-slate-900/40 rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl relative">
          
          {/* الوسط - VS */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 hidden md:flex items-center justify-center w-20 h-20 bg-slate-900 rounded-full border-4 border-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.5)]">
            <span className="text-3xl font-black text-indigo-400">VS</span>
          </div>

          {/* الطرف الأيسر - اللاعب الحالي */}
          <div className={`flex-1 flex flex-col items-center p-12 transition-all duration-700 relative ${isUserWinner ? 'bg-indigo-600/30 shadow-[inset_0_0_50px_rgba(79,70,229,0.3)]' : 'bg-slate-800/20 opacity-70'}`}>
            {isUserWinner && <div className="absolute top-4 text-5xl drop-shadow-lg">👑</div>}
            <div className={`w-24 h-24 rounded-full mb-6 flex items-center justify-center text-5xl shadow-xl border-4 ${isUserWinner ? 'bg-indigo-500 border-indigo-400 animate-bounce' : 'bg-slate-700 border-slate-600'}`}>
              👤
            </div>
            <h3 className="text-2xl font-black text-white mb-2">{t.you}</h3>
            {isUserWinner && <span className="text-emerald-400 font-black text-sm tracking-widest animate-pulse mb-4">{t.win}</span>}
            <div className="text-7xl font-black text-white drop-shadow-2xl">{userScore}</div>
            <div className="text-indigo-300/60 font-black text-xs mt-2 uppercase">{t.points}</div>
          </div>

          {/* الطرف الأيمن - الخصم */}
          <div className={`flex-1 flex flex-col items-center p-12 transition-all duration-700 relative ${isOpponentWinner ? 'bg-rose-600/30 shadow-[inset_0_0_50px_rgba(225,29,72,0.3)]' : 'bg-slate-800/20 opacity-70'}`}>
            {isOpponentWinner && <div className="absolute top-4 text-5xl drop-shadow-lg">👑</div>}
            <div className={`w-24 h-24 rounded-full mb-6 flex items-center justify-center text-5xl shadow-xl border-4 ${isOpponentWinner ? 'bg-rose-500 border-rose-400 animate-bounce' : 'bg-slate-700 border-slate-600'}`}>
              👤
            </div>
            <h3 className="text-2xl font-black text-white mb-2">{t.opponent}</h3>
            {isOpponentWinner && <span className="text-rose-400 font-black text-sm tracking-widest animate-pulse mb-4">{t.win}</span>}
            <div className="text-7xl font-black text-white drop-shadow-2xl">{oppScore}</div>
            <div className="text-rose-300/60 font-black text-xs mt-2 uppercase">{t.points}</div>
          </div>
        </div>

        {isDraw && (
          <div className="bg-amber-500/20 border border-amber-500/40 px-10 py-4 rounded-full text-amber-400 font-black text-2xl animate-bounce">
            🤝 {t.draw}
          </div>
        )}

        <div className="w-full flex flex-col gap-4">
          <button onClick={() => { unlockAudio(); setStep('minigame_balloons'); }} className="w-full bg-indigo-600 border-b-[10px] border-indigo-950 text-white py-10 rounded-[2.5rem] font-black text-4xl shadow-2xl active:scale-95 transition-all hover:bg-indigo-500">
            {t.balloons} 🔥
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-8 overflow-hidden relative selection:bg-blue-500/30">
      <div className="w-full max-w-4xl flex justify-between items-center py-2 z-50 mb-4 sticky top-0">
        <div className="flex gap-3">
          {step !== 'auth' && (
            <button onClick={goBack} className="glass px-5 py-3 rounded-2xl font-black text-xs border border-white/10 shadow-lg active:scale-95 transition-transform">
              <span className={lang === 'ar' ? 'rotate-180' : ''}>←</span> {t.backBtn}
            </button>
          )}
          <div className="flex flex-col items-center gap-1">
            <button onClick={toggleMute} className={`glass p-3 rounded-2xl text-xl transition-all ${isMuted ? 'bg-rose-500/20 border-rose-500/50 grayscale' : 'bg-emerald-500/20 border-emerald-500/50 scale-110 shadow-lg'}`}>
              {isMuted ? '🔇' : '🔊'}
            </button>
            <span className="text-[9px] font-bold text-white/50 animate-pulse">{t.enableMusic}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {['ar', 'en', 'de'].map(l => (
            <button key={l} onClick={() => setLang(l as Language)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${lang === l ? 'bg-blue-600 text-white shadow-lg scale-105' : 'glass opacity-40 hover:opacity-60'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {step === 'auth' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm text-center space-y-12 animate-in">
          <QuizSnapLogo size={240} />
          <div className="w-full space-y-6">
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 group cursor-pointer" onClick={() => setLegalAccepted(!legalAccepted)}>
               <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${legalAccepted ? 'bg-blue-600 border-blue-400' : 'border-white/20'}`}>
                 {legalAccepted && <span className="text-white text-xl">✓</span>}
               </div>
               <p className="text-[12px] font-bold text-white/80 text-start leading-tight">{t.acceptTerms}</p>
            </div>
            <button onClick={() => handleLogin('google')} className={`w-full bg-white text-slate-900 py-6 rounded-[2rem] font-black flex items-center justify-center gap-4 transition-all ${!legalAccepted ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:scale-105'}`}>
              <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-7 h-7" alt="google" /> {t.google}
            </button>
          </div>
        </div>
      )}

      {step === 'home' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl space-y-8 animate-in">
          <QuizSnapLogo />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg px-4">
            <button onClick={() => { setMode('solo'); setStep('config'); }} className="group glass p-8 rounded-[3rem] transition-all hover:bg-white/10 flex flex-col items-center text-center">
              <div className="text-6xl mb-4">🧠</div>
              <h2 className="text-2xl font-black text-blue-100">{t.solo}</h2>
              <p className="text-blue-300 text-xs mt-2 opacity-60 font-bold">{t.soloSub}</p>
            </button>
            <div className="flex flex-col gap-4">
               <button onClick={initMultiplayerHost} className="group glass p-8 rounded-[3rem] transition-all hover:bg-indigo-600/20 border-indigo-500/30 flex flex-col items-center text-center w-full">
                <div className="text-6xl mb-4">🆚</div>
                <h2 className="text-2xl font-black text-indigo-300">{t.multi}</h2>
                <p className="text-indigo-400 text-xs mt-2 opacity-60 font-bold">{t.multiSub}</p>
              </button>
              <button onClick={() => setStep('join')} className="glass py-4 rounded-3xl font-black text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-all">
                {t.joinTitle} 🔗
              </button>
            </div>
          </div>
          <button onClick={() => setStep('history')} className="glass w-full max-w-xs py-5 rounded-3xl font-black text-blue-100 text-lg hover:bg-white/5 transition-all">{t.history}</button>
        </div>
      )}

      {step === 'join' && (
        <div className="w-full max-w-sm glass p-10 animate-in rounded-[3.5rem] space-y-8 text-center shadow-2xl">
          <h2 className="text-2xl font-black text-emerald-400 uppercase tracking-widest">{t.joinTitle}</h2>
          <input 
            type="number" 
            placeholder={t.joinPlaceholder} 
            className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl text-center text-3xl font-black text-white outline-none focus:border-emerald-500/50"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value.slice(0, 6))}
          />
          <button 
            disabled={joinId.length < 6}
            onClick={() => connectToRoom(joinId)} 
            className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-xl shadow-xl hover:bg-emerald-500 disabled:opacity-30 disabled:grayscale transition-all"
          >
            {t.connect}
          </button>
        </div>
      )}

      {step === 'config' && (
        <div className="w-full max-w-md glass p-10 animate-in rounded-[3.5rem] space-y-8 shadow-2xl overflow-y-auto max-h-[85vh] custom-scrollbar">
          <h2 className="text-2xl font-black text-center text-blue-200 uppercase tracking-widest">{t.settings}</h2>
          
          <div className="text-center">
            <p className="text-[14px] font-black text-emerald-400 mb-4 uppercase">{t.qType}</p>
            <div className="grid grid-cols-3 gap-2">
              {[QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE, QuestionType.FILL_BLANKS].map(type => (
                <button key={type} onClick={() => setConfig(p => ({ ...p, allowedTypes: [type] }))} className={`py-4 rounded-xl text-[10px] font-black border-2 transition-all ${config.allowedTypes.includes(type) ? 'bg-blue-600 border-blue-400 shadow-lg scale-105' : 'bg-white/5 border-white/5 opacity-50'}`}>
                  {type === QuestionType.MULTIPLE_CHOICE ? t.mcq : type === QuestionType.TRUE_FALSE ? t.tf : t.fill}
                </button>
              ))}
            </div>
          </div>

          <div className="text-center">
            <p className="text-[14px] font-black text-rose-400 mb-4 uppercase">{t.diffLabel}</p>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setConfig(p => ({ ...p, difficulty: d }))} className={`py-4 rounded-xl text-[10px] font-black border-2 transition-all ${config.difficulty === d ? 'bg-blue-600 border-blue-400 shadow-lg scale-105' : 'bg-white/5 border-white/5 opacity-50'}`}>
                  {d === 'easy' ? t.easy : d === 'medium' ? t.medium : t.hard}
                </button>
              ))}
            </div>
          </div>

          <div className="text-center space-y-4">
            <div className="flex justify-between items-center px-2">
              <p className="text-[14px] font-black text-amber-400 uppercase">{t.qCount}</p>
              <span className="bg-amber-500 text-white px-4 py-1 rounded-full font-black text-lg">{config.count}</span>
            </div>
            <input type="range" min="3" max="15" value={config.count} onChange={(e) => setConfig(p => ({ ...p, count: parseInt(e.target.value) }))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" />
          </div>

          <div className="space-y-4 pt-4">
            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black text-2xl shadow-xl hover:scale-105 transition-all">{t.snap}</button>
            <button onClick={() => setStep('paste')} className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-2xl shadow-xl hover:scale-105 transition-all">{t.paste}</button>
            <input type="file" capture="environment" ref={fileInputRef} onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                const r = new FileReader();
                r.onload = () => startQuiz(r.result?.toString().split(',')[1]);
                r.readAsDataURL(f);
              }
            }} accept="image/*" className="hidden" />
          </div>
        </div>
      )}

      {step === 'lobby' && (
        <div className="w-full max-w-md glass p-10 animate-in rounded-[3.5rem] space-y-10 text-center shadow-2xl">
          <div className="text-6xl animate-pulse">📡</div>
          <div>
            <p className="text-blue-300 font-black mb-2 uppercase text-xs">{t.hostCode}</p>
            <h2 className="text-6xl font-black text-white tracking-widest">{roomId}</h2>
          </div>
          <p className="text-white/60 font-bold px-4 leading-relaxed">{t.shareCode}</p>
          <div className="space-y-4">
            <button 
              onClick={copyInviteLink} 
              className={`w-full py-6 rounded-[2rem] font-black text-xl transition-all shadow-xl ${copyStatus === 'success' ? 'bg-emerald-600 text-white' : 'glass border-white/10 text-blue-200'}`}
            >
              {copyStatus === 'success' ? t.copied : t.copy}
            </button>
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping"></div>
              <p className="text-blue-300 font-black animate-pulse">{t.waitingFriend}</p>
            </div>
          </div>
        </div>
      )}

      {step === 'paste' && (
        <div className="w-full max-w-md glass p-10 animate-in rounded-[3.5rem] flex flex-col h-[70vh] shadow-2xl">
          <h2 className="text-2xl font-black text-center text-emerald-400 mb-6 uppercase">{t.paste}</h2>
          <textarea 
            className="w-full flex-1 p-8 rounded-[2rem] bg-white/5 text-white mb-8 outline-none border border-white/10 text-xl font-bold placeholder:opacity-30 focus:border-blue-500/50 transition-all custom-scrollbar resize-none" 
            placeholder={t.pastePlaceholder} 
            value={pastedText} 
            onChange={(e) => setPastedText(e.target.value)} 
          />
          <button 
            onClick={() => startQuiz(undefined)} 
            className="w-full bg-blue-600 text-white py-8 rounded-[2rem] font-black text-3xl shadow-xl hover:bg-blue-500 active:scale-95 transition-all"
          >
            {t.generate}
          </button>
        </div>
      )}

      {step === 'loading' && <div className="flex-1 flex items-center"><RocketLoading message={t.loadingMsg} /></div>}
      
      {step === 'ready' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full text-center space-y-12 animate-in">
           <div className="text-9xl animate-bounce">📋</div>
           <h2 className="text-5xl font-black text-white tracking-tighter">{t.quizReady}</h2>
           <button onClick={startActualQuiz} className="bg-blue-600 text-white text-4xl font-black px-12 py-10 rounded-[3rem] shadow-2xl border-b-[12px] border-blue-900 active:translate-y-2 active:border-b-0 transition-all">
              {t.startQuiz}
           </button>
        </div>
      )}

      {step === 'quiz' && (
        <div className="w-full max-w-2xl space-y-6 animate-in py-2 flex flex-col h-full">
          {mode === 'multi' && opponent && (
            <div className="glass px-6 py-3 rounded-full flex justify-between items-center text-xs font-black">
              <span className="text-blue-300">👤 {t.you}: {player.score}</span>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < opponent.currentQuestionIndex ? 'bg-emerald-500' : 'bg-white/10'}`}></div>
                ))}
              </div>
              <span className="text-rose-400">👤 {t.opponent}: {opponent.score}</span>
            </div>
          )}
          <div className="quiz-card p-10 relative flex-1 flex flex-col border-t-[12px] border-blue-600 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center mb-8">
               <div className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-2xl shadow-lg border border-white/10">
                <span className="text-yellow-400 text-[10px] block opacity-70 uppercase mb-1">{t.scoreLabel}</span> {player.score}
               </div>
               <div className="text-slate-400 font-black text-lg bg-slate-100 px-6 py-2 rounded-full">{player.currentQuestionIndex + 1} / {questions.length}</div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-center mb-10 text-slate-800 flex-1 flex items-center justify-center bg-slate-50 p-8 rounded-[2.5rem] shadow-inner leading-relaxed">
              {questions[player.currentQuestionIndex]?.question}
            </div>
            <div className="grid grid-cols-1 gap-4">
              {questions[player.currentQuestionIndex]?.options.map((opt, i) => (
                <button 
                  key={i} 
                  disabled={player.isWaiting} 
                  onClick={() => handleAnswer(opt, i)} 
                  className={`p-5 rounded-3xl text-xl font-black transition-all border-b-8 active:scale-95 
                    ${correctAnswerIdx === i ? 'bg-emerald-500 text-white border-emerald-700' : 
                      wrongAnswers.includes(i) ? 'bg-rose-500 text-white border-rose-700 animate-[shake_0.4s]' : 
                      'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'reward' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg text-center">
           {mode === 'multi' ? renderMultiplayerReward() : (
             <div className="glass p-16 rounded-[4rem] w-full border border-white/10 shadow-2xl relative animate-in">
               <div className="text-[100px] mb-8 drop-shadow-2xl">🏆</div>
               <h2 className="text-5xl font-black text-white mb-8 tracking-tighter">{t.winner}</h2>
               <div className="bg-slate-900/40 p-6 rounded-3xl mb-8 border border-white/10">
                 <p className="text-blue-300 font-black mb-1 uppercase text-xs">{t.totalScore}</p>
                 <div className="text-6xl font-black text-white">{player.score}</div>
               </div>
               <button onClick={() => { unlockAudio(); setStep('minigame_balloons'); }} className="w-full bg-indigo-600 border-b-[10px] border-indigo-950 text-white py-10 rounded-[2.5rem] font-black text-4xl shadow-2xl active:scale-95 transition-all hover:bg-indigo-500">
                 {t.balloons} 🔥
               </button>
             </div>
           )}
        </div>
      )}

      {step === 'history' && (
        <div className="w-full max-w-md glass p-10 animate-in rounded-[3.5rem] flex flex-col h-[75vh] shadow-2xl">
          <h2 className="text-2xl font-black text-center mb-8 text-blue-200 uppercase tracking-widest">{t.historyTitle}</h2>
          <div className="flex-1 overflow-y-auto space-y-4 px-2 custom-scrollbar">
            {history.length === 0 ? <div className="text-center py-20 opacity-30 font-black">{t.noHistory}</div> : history.map(game => (
              <button key={game.id} onClick={() => { setQuestions(game.questions); setConfig(game.config); setPlayer({ score: 0, currentQuestionIndex: 0, attempts: {}, isFinished: false, isWaiting: false, lastActionStatus: null }); setWrongAnswers([]); setCorrectAnswerIdx(-1); setStep('ready'); }} className="w-full p-6 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 flex justify-between items-center transition-all">
                <div className="text-start">
                  <h3 className="font-black text-blue-100 truncate w-40">{game.title}</h3>
                  <p className="text-[10px] text-blue-300/40 mt-1">{game.date}</p>
                </div>
                <div className="bg-blue-600/40 text-blue-100 px-3 py-1 rounded-lg text-xs font-black">{game.questions.length} {t.questions}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'minigame_balloons' && <BalloonPopGame lang={lang} score={player.score} onFinish={() => setStep('home')} />}
    </div>
  );
};

export default App;
