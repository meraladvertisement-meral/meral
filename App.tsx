
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
  const [showLegal, setShowLegal] = useState<'none' | 'policy' | 'terms'>('none');
  const [history, setHistory] = useState<SavedGame[]>([]);
  const [mode, setMode] = useState<'solo' | 'multi'>('solo');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [peer, setPeer] = useState<any>(null);
  const [conn, setConn] = useState<any>(null);
  const [roomId, setRoomId] = useState('');
  const [joinId, setJoinId] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success'>('idle');
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
      welcome: "أهلاً بك في كويز سناب 👋",
      authSub: "سريع وآمن للعائلات.",
      google: "دخول سريع عبر Google",
      loggingIn: "جاري التحقق...",
      acceptText: "أوافق على ",
      privacyLink: "سياسة الخصوصية",
      termsLink: "شروط الاستخدام",
      solo: 'تحدي الإتقان 🧠', soloSub: 'تعلم فردي ذكي', multi: 'المواجهة الثنائية 🆚', multiSub: 'أنشئ التحدي وأرسله',
      settings: 'إعدادات الاختبار', winner: 'أداء عبقري! 💎',
      scoreLabel: 'النتيجة', points: 'نقطة', score: 'النقاط:', home: 'الرئيسية',
      generate: 'تحليل وإنشاء ✨', snap: 'تصوير الدرس 📸', 
      paste: 'نص يدوي 📝', pastePlaceholder: 'ضع النص هنا ليقوم الذكاء الاصطناعي بتحليله...', back: 'رجوع', loadingMsg: 'جاري التحليل...',
      balloons: '🎈 فرقع البالونات!', qType: 'نوع الأسئلة:', mcq: 'ABC', tf: 'T/F', fill: '___',
      qCount: 'عدد الأسئلة:', history: 'السجل 📜', historyTitle: 'سجل الاختبارات', noHistory: 'لا توجد سجلات بعد',
      quizOf: 'اختبار بتاريخ', questionsCount: 'سؤال', joinTitle: 'انضم للمواجهة', joinPlaceholder: 'ادخل الكود المختلط',
      copy: 'نسخ الرابط 🔗', copied: 'تم النسخ! ✅', backBtn: 'رجوع',
      quizReady: 'الاختبار جاهز! 🎉', startQuiz: 'ابدأ التحدي 🔊',
      enableMusic: '🔊 الصوت مفعل',
      diffLabel: 'الصعوبة:',
      easy: 'سهل 👶', medium: 'متوسط ⚡', hard: 'صعب 🔥',
      waitingFriend: 'بانتظار صديقك...', connect: 'دخول المواجهة 🔗', hostCode: 'كود الغرفة:', shareCode: 'أرسل الكود لصديقك لبدء التحدي',
      you: 'أنت', opponent: 'الخصم', win: 'الفائز!', draw: 'تعادل!', totalScore: 'النتيجة النهائية',
      close: "إغلاق",
      quitConfirm: "هل تريد حقاً الخروج من الاختبار؟ ستفقد تقدمك.",
      inviteFriend: "رابط الدعوة:",
      friendJoined: "صديقك متصل الآن! 🟢",
      proceed: "استمرار للتحدي ➡️",
      clearAll: "مسح الكل 🗑️",
      dateLabel: "التاريخ:",
      bestScoreLabel: "أفضل نتيجة:",
      opponentProgress: "تقدم الخصم",
      hostWaitTitle: "غرفة الانتظار ⏳",
      errorTitle: "خطأ في التحليل"
    },
    en: {
      welcome: "Welcome to QuizSnap 👋",
      authSub: "Fast and safe for families.",
      google: "Quick Start with Google",
      loggingIn: "Authenticating...",
      acceptText: "I agree to ",
      privacyLink: "Privacy Policy",
      termsLink: "Terms of Use",
      solo: 'Mastery Mode 🧠', soloSub: 'Solo Smart Learning', multi: '2-Player Duel 🆚', multiSub: 'Create & Share Duel',
      settings: 'Quiz Config', winner: 'Genius! 💎',
      scoreLabel: 'SCORE', points: 'Pts', score: 'Score:', home: 'Home',
      generate: 'Generate ✨', snap: 'Snap Lesson 📸', 
      paste: 'Manual Text 📝', pastePlaceholder: 'Paste text here...', back: 'Back', loadingMsg: 'Analyzing...',
      balloons: '🎈 Pop Balloons!', qType: 'Type:', mcq: 'ABC', tf: 'T/F', fill: '___',
      qCount: 'Count:', history: 'History 📜', historyTitle: 'Quiz History', noHistory: 'No history yet',
      quizOf: 'Quiz of', questionsCount: 'questions', joinTitle: 'Join Duel', joinPlaceholder: 'Enter Alphanumeric Code',
      copy: 'Copy Link 🔗', copied: 'Copied! ✅', backBtn: 'Back',
      quizReady: 'Quiz Ready! 🎉', startQuiz: 'Start Challenge 🔊',
      enableMusic: '🔊 Sound Enabled',
      diffLabel: 'Difficulty:',
      easy: 'Easy 👶', medium: 'Med ⚡', hard: 'Hard 🔥',
      waitingFriend: 'Waiting...', connect: 'Join Duel 🔗', hostCode: 'Room Code:', shareCode: 'Send to friend to start',
      you: 'YOU', opponent: 'OPPONENT', win: 'WINNER!', draw: 'DRAW!', totalScore: 'FINAL SCORE',
      close: "Close",
      quitConfirm: "Quit quiz? You will lose progress.",
      inviteFriend: "Invite Link:",
      friendJoined: "Friend connected! 🟢",
      proceed: "Proceed to Duel ➡️",
      clearAll: "Clear All 🗑️",
      dateLabel: "Date:",
      bestScoreLabel: "Best Score:",
      opponentProgress: "Opponent Progress",
      hostWaitTitle: "Waiting Room ⏳",
      errorTitle: "Analysis Error"
    }
  };

  const t = translations[lang] || translations.ar;

  useEffect(() => {
    document.dir = (lang === 'ar') ? 'rtl' : 'ltr';
    const saved = localStorage.getItem('quiz_history');
    if (saved) setHistory(JSON.parse(saved));

    const params = new URLSearchParams(window.location.search);
    const jId = params.get('join');
    if (jId) setJoinId(jId.toUpperCase());
  }, [lang]);

  const handleBack = () => {
    if (step === 'config') setStep('home');
    else if (step === 'join') setStep('home');
    else if (step === 'lobby') {
      if (peer) peer.destroy();
      setStep('config');
    }
    else if (step === 'history') setStep('home');
    else if (step === 'paste') setStep('config');
    else if (step === 'ready') setStep('config');
    else if (step === 'quiz') {
      if (window.confirm(t.quitConfirm)) {
        stopBg();
        setStep('home');
      }
    }
    else if (step === 'reward') setStep('home');
    else if (step === 'minigame_balloons') setStep('home');
    else setStep('home');
  };

  const startQuiz = async (base64?: string) => {
    unlockAudio();
    setStep('loading');
    try {
      const q = base64 ? await generateQuizFromImage(base64, config) : await generateQuizFromText(pastedText, config);
      setQuestions(q);
      setPlayer({ score: 0, currentQuestionIndex: 0, attempts: {}, isFinished: false, isWaiting: false, lastActionStatus: null });
      
      if (mode === 'multi') {
        initMultiplayerRoomAfterQuiz(q);
      } else {
        setStep('ready');
      }
    } catch (e: any) { 
      console.error("Quiz Generation Error Details:", e);
      let errorMsg = e.message;
      
      if (e.message === "API_KEY_MISSING") {
        errorMsg = lang === 'ar' ? "مفتاح الـ API مفقود! يرجى إعداده في Netlify وفتح الموقع مجدداً." : "API Key is missing! Set it in Netlify and redeploy.";
      } else if (e.message.includes("quota")) {
        errorMsg = lang === 'ar' ? "تم تجاوز حد الاستخدام المجاني للذكاء الاصطناعي. جرب مجدداً لاحقاً." : "AI Quota exceeded. Try again later.";
      } else {
        errorMsg = `${t.errorTitle}: ${e.message.slice(0, 100)}`;
      }
      
      alert(errorMsg); 
      setStep('config'); 
    }
  };

  // ... باقي الكود يبقى كما هو (handleAnswer, handleLogin, etc.)
  // (قمت باختصار الكود هنا للحفاظ على مساحة الرد مع التركيز على حل المشكلة)
  
  // دالة initMultiplayerRoomAfterQuiz مفقودة في السياق المختصر أعلاه، تأكد من بقائها في التطبيق الفعلي
  const initMultiplayerRoomAfterQuiz = (quizData: Question[]) => {
    unlockAudio();
    const id = generateShortId();
    const p = new Peer(id);
    p.on('open', () => {
      setRoomId(id);
      setPeer(p);
      setStep('lobby');
    });
    p.on('connection', (c: any) => {
      setConn(c);
      setIsFriendConnected(true);
      playSound('correct');
      setTimeout(() => {
        c.send({ type: 'INIT_QUIZ', payload: { questions: quizData, config } });
      }, 500);
      c.on('data', (data: MultiplayerMessage) => handleMultiplayerData(data));
    });
    p.on('error', () => initMultiplayerRoomAfterQuiz(quizData));
  };

  const handleMultiplayerData = (data: MultiplayerMessage) => {
    switch (data.type) {
      case 'INIT_QUIZ':
        setQuestions(data.payload.questions);
        setConfig(data.payload.config);
        setStep('ready');
        break;
      case 'PROGRESS':
        setOpponent(data.payload);
        if (data.payload.isFinished && player.isFinished) {
           stopBg();
           playSound('win');
           setStep('reward');
        }
        break;
    }
  };

  const handleLogin = () => {
    if (!legalAccepted) {
      alert(lang === 'ar' ? "يرجى الموافقة على الشروط أولاً." : "Please accept terms.");
      return;
    }
    unlockAudio();
    setIsLoggingIn(true);
    setTimeout(() => {
      setIsLoggingIn(false);
      setUser({ name: "User", photo: "" });
      setStep('home');
    }, 1200);
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

  const toggleMuteAndSave = () => {
    toggleMute();
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-8 overflow-hidden relative">
      <div className="w-full max-w-4xl flex justify-between items-center py-2 z-50 mb-4 sticky top-0">
        <div className="flex gap-2">
          <button onClick={() => { stopBg(); setStep('home'); }} className="glass p-3 rounded-2xl text-xl transition-all hover:scale-110 shadow-lg">🏠</button>
          {step !== 'auth' && step !== 'home' && (
            <button onClick={handleBack} className="glass px-5 py-2 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg">⬅️ {t.backBtn}</button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={toggleMuteAndSave} className={`glass p-3 rounded-2xl transition-all ${isMuted ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{isMuted ? '🔇' : '🔊'}</button>
        </div>
      </div>

      {step === 'auth' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full text-center space-y-12 animate-in">
          <QuizSnapLogo size={240} />
          <div className="w-full space-y-6 max-w-sm">
            <div className="flex items-center gap-4 bg-white/5 p-5 rounded-3xl border border-white/10 group">
               <div onClick={() => { setLegalAccepted(!legalAccepted); unlockAudio(); }} className={`w-10 h-10 min-w-[40px] rounded-xl border-2 cursor-pointer flex items-center justify-center transition-all ${legalAccepted ? 'bg-blue-600 border-blue-400 shadow-lg' : 'border-white/20'}`}>
                 {legalAccepted && <span className="text-white text-2xl">✓</span>}
               </div>
               <p className="text-[13px] font-bold text-white/80 text-start leading-snug">
                 {t.acceptText} {t.privacyLink} و {t.termsLink}
               </p>
            </div>
            <button onClick={handleLogin} disabled={isLoggingIn} className={`w-full bg-white text-slate-900 py-6 rounded-[2rem] font-black text-xl shadow-2xl transition-all ${!legalAccepted || isLoggingIn ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}>{isLoggingIn ? t.loggingIn : t.google}</button>
          </div>
        </div>
      )}

      {step === 'home' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl space-y-8 animate-in">
          <QuizSnapLogo />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg px-4">
            <button onClick={() => { setMode('solo'); setStep('config'); }} className="glass p-8 rounded-[3rem] text-center hover:bg-white/5 transition-all"><div className="text-6xl mb-4">🧠</div><h2 className="text-2xl font-black text-blue-100">{t.solo}</h2><p className="text-blue-300 text-xs mt-2 font-bold">{t.soloSub}</p></button>
            <button onClick={() => { setMode('multi'); setStep('config'); }} className="glass p-8 rounded-[3rem] text-center border-indigo-500/30 hover:bg-white/5 transition-all"><div className="text-6xl mb-4">🆚</div><h2 className="text-2xl font-black text-indigo-300">{t.multi}</h2><p className="text-indigo-400 text-xs mt-2 font-bold">{t.multiSub}</p></button>
          </div>
        </div>
      )}

      {step === 'config' && (
        <div className="w-full max-w-md glass p-10 rounded-[3.5rem] space-y-8 shadow-2xl">
          <h2 className="text-2xl font-black text-center text-blue-200 uppercase">{t.settings}</h2>
          <div className="space-y-4 pt-6">
            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black text-2xl shadow-xl hover:scale-105 transition-all">{t.snap}</button>
            <button onClick={() => setStep('paste')} className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-2xl shadow-xl hover:scale-105 transition-all">{t.paste}</button>
            <input type="file" capture="environment" ref={fileInputRef} onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                const r = new FileReader();
                r.onload = () => startQuiz(r.result?.toString());
                r.readAsDataURL(f);
              }
            }} accept="image/*" className="hidden" />
          </div>
        </div>
      )}

      {step === 'paste' && (
        <div className="w-full max-w-2xl glass p-10 rounded-[3.5rem] flex flex-col h-[70vh] shadow-2xl animate-in">
          <h2 className="text-3xl font-black text-center text-emerald-400 mb-8 uppercase">{t.paste}</h2>
          <textarea className="w-full flex-1 p-8 rounded-[3rem] bg-slate-900/50 text-white mb-10 outline-none border-2 border-white/10 text-xl font-bold placeholder:opacity-20 resize-none shadow-inner" placeholder={t.pastePlaceholder} value={pastedText} onChange={(e) => setPastedText(e.target.value)} />
          <button onClick={() => startQuiz()} className="w-full bg-blue-600 text-white py-8 rounded-[3rem] font-black text-4xl shadow-2xl hover:bg-blue-500 transition-all">{t.generate} 🚀</button>
        </div>
      )}

      {step === 'loading' && <div className="flex-1 flex items-center"><RocketLoading message={t.loadingMsg} /></div>}
      {step === 'ready' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full text-center space-y-12 animate-in">
           <div className="text-9xl animate-bounce">📋</div>
           <h2 className="text-5xl font-black text-white tracking-tighter">{t.quizReady}</h2>
           <button onClick={() => { setStep('quiz'); playSound('bg'); }} className="bg-blue-600 text-white text-4xl font-black px-12 py-10 rounded-[3rem] shadow-2xl border-b-[12px] border-blue-900 active:translate-y-2 active:border-b-0 transition-all">{t.startQuiz}</button>
        </div>
      )}

      {step === 'quiz' && questions.length > 0 && (
        <div className="w-full max-w-2xl space-y-6 animate-in py-2 flex flex-col h-full">
          <div className="quiz-card p-10 relative flex-1 flex flex-col border-t-[12px] border-blue-600">
            <div className="flex justify-between items-center mb-8">
               <div className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-2xl shadow-lg border border-white/10">{t.scoreLabel} {player.score}</div>
               <div className="text-slate-400 font-black text-lg bg-slate-100 px-6 py-2 rounded-full">{player.currentQuestionIndex + 1} / {questions.length}</div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-center mb-10 text-slate-800 flex-1 flex items-center justify-center bg-slate-50 p-8 rounded-[2.5rem] shadow-inner">{questions[player.currentQuestionIndex]?.question}</div>
            <div className="grid grid-cols-1 gap-4">
              {questions[player.currentQuestionIndex]?.options.map((opt, i) => (
                <button key={i} disabled={player.isWaiting} onClick={() => handleAnswer(opt, i)} className={`p-5 rounded-3xl text-xl font-black transition-all border-b-8 active:scale-95 ${correctAnswerIdx === i ? 'bg-emerald-500 text-white border-emerald-700' : wrongAnswers.includes(i) ? 'bg-rose-500 text-white border-rose-700 animate-[shake_0.4s]' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'}`}>{opt}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'reward' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full text-center">
             <div className="glass p-16 rounded-[4rem] w-full max-w-lg shadow-2xl relative animate-in">
               <div className="text-[120px] mb-8 animate-bounce">🏆</div>
               <h2 className="text-5xl font-black text-white mb-8 tracking-tighter italic">{t.winner}</h2>
               <div className="bg-slate-900/40 p-10 rounded-[3rem] mb-10">
                 <p className="text-blue-300 font-black mb-1 text-sm">{t.totalScore}</p>
                 <div className="text-[10rem] font-black text-white leading-none">{player.score}</div>
               </div>
               <button onClick={() => setStep('minigame_balloons')} className="w-full bg-indigo-600 border-b-[12px] border-indigo-950 text-white py-10 rounded-[3rem] font-black text-4xl shadow-2xl">{t.balloons} 🎈</button>
             </div>
        </div>
      )}

      {step === 'minigame_balloons' && <BalloonPopGame lang={lang} score={player.score} onFinish={() => setStep('home')} />}
    </div>
  );
};

export default App;
