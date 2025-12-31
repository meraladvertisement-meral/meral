
import React, { useState, useEffect, useRef } from 'react';
import { generateQuizFromImage, generateQuizFromText } from './geminiService';
import { Question, PlayerState, QuizConfig, Language, QuestionType, SavedGame, MultiplayerMessage } from './types';
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
  const [step, setStep] = useState<'auth' | 'home' | 'config' | 'loading' | 'quiz' | 'reward' | 'paste' | 'history' | 'lobby' | 'minigame_balloons' | 'join'>('auth');
  const [lang, setLang] = useState<Language>('ar');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [history, setHistory] = useState<SavedGame[]>([]);
  const [mode, setMode] = useState<'solo' | 'multi'>('solo');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success'>('idle');
  
  const [peer, setPeer] = useState<any>(null);
  const [conn, setConn] = useState<any>(null);
  const [roomId, setRoomId] = useState('');
  const [joinId, setJoinId] = useState('');
  const [opponent, setOpponent] = useState<PlayerState>({ 
    score: 0, currentQuestionIndex: 0, attempts: {}, isFinished: false, isWaiting: false, lastActionStatus: null 
  });

  const [config, setConfig] = useState<QuizConfig>({ count: 5, difficulty: 'medium', language: 'ar', allowedTypes: [QuestionType.MULTIPLE_CHOICE] });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [player, setPlayer] = useState<PlayerState>({ score: 0, currentQuestionIndex: 0, attempts: {}, isFinished: false, isWaiting: false, lastActionStatus: null });
  const [feedback, setFeedback] = useState<{ index: number, status: 'correct' | 'wrong' | null }>({ index: -1, status: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { playSound, stopBg, isMuted, toggleMute, unlockAudio } = useGameSounds();

  const translations = {
    ar: {
      welcome: "أهلاً بك في كويز سناب 👋",
      authSub: "ادخل عبر Google أو Apple – سريع وآمن للعائلات.",
      google: "الدخول عبر Google",
      apple: "الدخول عبر Apple",
      acceptTerms: "أوافق على سياسة الخصوصية وشروط الاستخدام",
      solo: 'تحدي الإتقان 🧠', soloSub: 'تعلم فردي ذكي', multi: 'المواجهة الثنائية 🆚', multiSub: 'أرسل رابطاً لصديقك',
      settings: 'إعدادات الاختبار', waitingFriend: 'بانتظار انضمام صديقك...', winner: 'أداء عبقري! 💎',
      scoreLabel: 'النتيجة', points: 'نقطة', score: 'مجموع النقاط:', home: 'الرئيسية',
      generate: 'تحليل وإنشاء ✨', snap: 'تصوير الدرس 📸', 
      paste: 'نص يدوي 📝', pastePlaceholder: 'ضع النص هنا ليقوم الذكاء الاصطناعي بتحليله...', back: 'تراجع', loadingMsg: 'جاري التحليل...',
      balloons: '🎈 فرقع البالونات!', qType: 'اختر أنواع الأسئلة المفضلة:', mcq: 'ABC', tf: 'T/F', fill: '___',
      qCount: 'عدد الأسئلة المطلوبة:', history: 'السجل 📜', historyTitle: 'آخر 10 ألعاب', noHistory: 'لا يوجد سجل حالياً',
      quizOf: 'اختبار بتاريخ', questions: 'سؤال', joinTitle: 'انضم للمواجهة', joinPlaceholder: 'كود الغرفة',
      connect: 'دخول المواجهة 🔗', hostCode: 'كود الغرفة (اختياري):', shareCode: 'أرسل هذا الرابط لصديقك ليدخل معك اللعبة فوراً',
      copy: 'نسخ رابط الدعوة المباشر 🔗', copied: 'تم نسخ الرابط! ✅', backBtn: 'رجوع',
      autoJoinMsg: 'جاري الاتصال بالغرفة...'
    },
    en: {
      welcome: "Welcome to QuizSnap 👋",
      authSub: "Sign in with Google or Apple – fast and safe.",
      google: "Continue with Google",
      apple: "Continue with Apple",
      acceptTerms: "I agree to the Privacy Policy and Terms of Use",
      solo: 'Mastery Mode 🧠', soloSub: 'Solo Smart Learning', multi: '2-Player Duel 🆚', multiSub: 'Send link to a friend',
      settings: 'Quiz Config', waitingFriend: 'Waiting for friend...', winner: 'Genius! 💎',
      scoreLabel: 'SCORE', points: 'Pts', score: 'Score:', home: 'Home',
      generate: 'Generate ✨', snap: 'Snap Lesson 📸', 
      paste: 'Paste 📝', pastePlaceholder: 'Paste text here...', back: 'Back', loadingMsg: 'Analyzing...',
      balloons: '🎈 Pop Balloons!', qType: 'Choose Question Types:', mcq: 'ABC', tf: 'T/F', fill: '___',
      qCount: 'Number of Questions:', history: 'History 📜', historyTitle: 'Last 10 Games', noHistory: 'No history',
      quizOf: 'Quiz of', questions: 'Questions', joinTitle: 'Join Duel', joinPlaceholder: 'Code',
      connect: 'Join Fight 🔗', hostCode: 'Room Code (Optional):', shareCode: 'Send this direct link to your friend',
      copy: 'Copy Direct Invite Link 🔗', copied: 'Link Copied! ✅', backBtn: 'Back',
      autoJoinMsg: 'Connecting to room...'
    }
  };
  const t = translations[lang === 'ar' ? 'ar' : 'en'];

  // تحليل الرابط التلقائي (Deep Link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setJoinId(roomFromUrl);
      // إذا كان المستخدم مسجلاً، نقوم بالربط تلقائياً
      if (user) {
        setTimeout(() => connectToRoom(roomFromUrl), 500);
      }
    }
  }, []);

  useEffect(() => {
    document.dir = (lang === 'ar') ? 'rtl' : 'ltr';
    setConfig(prev => ({ ...prev, language: lang }));
    const saved = localStorage.getItem('quiz_history');
    if (saved) setHistory(JSON.parse(saved));
  }, [lang]);

  // PeerJS Logic
  useEffect(() => {
    if (peer) {
      peer.on('connection', (c: any) => {
        setConn(c);
        c.on('open', () => {
          if (questions.length > 0) {
            c.send({ type: 'INIT_QUIZ', payload: { questions, config } });
            setStep('quiz');
            playSound('bg');
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
        setStep('quiz');
        playSound('bg');
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
      setStep('config'); // المضيف يجهز الأسئلة أولاً
    });
  };

  const connectToRoom = (id: string) => {
    const p = new Peer();
    p.on('open', () => {
      const c = p.connect(id);
      setConn(c);
      c.on('open', () => {
        setStep('loading'); // بانتظار استلام الأسئلة من المضيف
      });
      c.on('data', (data: MultiplayerMessage) => handleMultiplayerData(data));
      setPeer(p);
    });
  };

  const handleLogin = (provider: 'google' | 'apple') => {
    if (!legalAccepted) {
      alert(lang === 'ar' ? 'يرجى الموافقة على الشروط أولاً.' : 'Please accept terms first.');
      return;
    }
    unlockAudio(); 
    setUser({ name: "User", photo: "" });
    
    // التحقق إذا كان قادماً من رابط مباشر
    const params = new URLSearchParams(window.location.search);
    const r = params.get('room');
    if (r) {
      connectToRoom(r);
    } else {
      setStep('home');
    }
  };

  const saveToHistory = (qs: Question[], cfg: QuizConfig) => {
    const newGame: SavedGame = {
      id: Date.now().toString(),
      date: new Date().toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US'),
      title: qs[0]?.question.substring(0, 30) + "...",
      questions: qs,
      config: cfg
    };
    const updatedHistory = [newGame, ...history.slice(0, 9)];
    setHistory(updatedHistory);
    localStorage.setItem('quiz_history', JSON.stringify(updatedHistory));
  };

  const startQuiz = async (base64?: string) => {
    unlockAudio();
    setStep('loading');
    try {
      const q = base64 ? await generateQuizFromImage(base64, config) : await generateQuizFromText(pastedText, config);
      setQuestions(q);
      saveToHistory(q, config);
      setPlayer({ score: 0, currentQuestionIndex: 0, attempts: {}, isFinished: false, isWaiting: false, lastActionStatus: null });
      
      if (mode === 'multi') {
        // المضيف الآن جاهز، يفتح اللوبي لمشاركة الرابط والانتظار
        setStep('lobby');
      } else {
        playSound('bg');
        setStep('quiz');
      }
    } catch (e) { 
      alert(lang === 'ar' ? "فشل التحليل." : "Analysis failed."); 
      setStep('config'); 
    }
  };

  const handleAnswer = (opt: string, idx: number) => {
    if (player.isWaiting) return;
    const isCorrect = opt === questions[player.currentQuestionIndex].correctAnswer;
    
    let newScore = player.score;
    if (isCorrect) {
      setFeedback({ index: idx, status: 'correct' });
      playSound('correct');
      newScore += 1;
    } else {
      setFeedback({ index: idx, status: 'wrong' });
      playSound('wrong');
    }

    const nextIdx = player.currentQuestionIndex + 1;
    const isFinished = nextIdx >= questions.length;
    
    const newState: PlayerState = { 
      ...player, 
      score: newScore, 
      currentQuestionIndex: nextIdx,
      isFinished,
      isWaiting: true 
    };

    setPlayer(newState);

    if (mode === 'multi' && conn) {
      conn.send({ type: 'PROGRESS', payload: newState });
    }

    setTimeout(() => {
      if (!isFinished) {
        setPlayer({ ...newState, isWaiting: false });
        setFeedback({ index: -1, status: null });
      } else {
        stopBg();
        playSound('win');
        setStep('reward');
      }
    }, 800);
  };

  const getShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    return url.toString();
  };

  const copyInviteLink = () => {
    const link = getShareLink();
    navigator.clipboard.writeText(link);
    setCopyStatus('success');
    setTimeout(() => setCopyStatus('idle'), 2500);
  };

  const [user, setUser] = useState<{name: string, photo: string} | null>(null);

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-8 overflow-hidden relative selection:bg-blue-500/30">
      {/* Header */}
      <div className="w-full max-w-4xl flex justify-between items-center py-2 z-50 mb-4 sticky top-0">
        <div className="flex gap-3">
          {step !== 'auth' && step !== 'home' && (
            <button onClick={() => { stopBg(); setStep('home'); }} className="glass px-6 py-3 rounded-2xl font-black text-xs border border-white/10 shadow-lg active:scale-95 transition-transform">{t.home}</button>
          )}
          <button onClick={toggleMute} className={`glass p-3 rounded-2xl text-xl transition-all ${isMuted ? 'opacity-30 scale-90' : 'opacity-100 scale-100'}`}>
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
        <div className="flex gap-2">
          {['ar', 'en'].map(l => (
            <button key={l} onClick={() => setLang(l as Language)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${lang === l ? 'bg-blue-600 text-white shadow-lg scale-105' : 'glass opacity-40 hover:opacity-60'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {step === 'auth' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm text-center space-y-12 animate-in">
          <QuizSnapLogo size={240} />
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-white tracking-tight">{t.welcome}</h1>
            <p className="text-blue-200 opacity-60 font-bold leading-relaxed">{t.authSub}</p>
          </div>
          <div className="w-full flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 w-full group cursor-pointer" onClick={() => setLegalAccepted(!legalAccepted)}>
               <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${legalAccepted ? 'bg-blue-600 border-blue-400' : 'border-white/20 bg-white/5'}`}>
                 {legalAccepted && <span className="text-white text-xl font-black">✓</span>}
               </div>
               <p className="text-[12px] font-bold text-white/80 text-start leading-tight">{t.acceptTerms}</p>
            </div>
            <div className="w-full space-y-4">
              <button onClick={() => handleLogin('google')} className={`w-full bg-white text-slate-900 py-6 rounded-[2rem] font-black flex items-center justify-center gap-4 transition-all ${!legalAccepted ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:scale-[1.03]'}`}>
                <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-7 h-7" alt="google" /> {t.google}
              </button>
              <button onClick={() => handleLogin('apple')} className={`w-full bg-black text-white py-6 rounded-[2rem] font-black flex items-center justify-center gap-4 border border-white/10 transition-all ${!legalAccepted ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:scale-[1.03]'}`}>
                <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" className="w-7 h-7 invert" alt="apple" /> {t.apple}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'home' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl space-y-8 py-4 animate-in">
          <QuizSnapLogo />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
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
        <div className="w-full max-w-sm glass p-10 animate-in rounded-[3.5rem] space-y-8">
           <h2 className="text-2xl font-black text-center text-blue-200">{t.joinTitle}</h2>
           <input type="text" value={joinId} onChange={(e)=>setJoinId(e.target.value)} placeholder={t.joinPlaceholder} className="w-full bg-white/5 p-6 rounded-2xl text-center text-2xl font-black text-white outline-none border border-white/10 focus:border-blue-500" />
           <button onClick={() => connectToRoom(joinId)} className="w-full bg-emerald-600 py-5 rounded-2xl font-black text-xl shadow-lg">{t.connect}</button>
        </div>
      )}

      {step === 'lobby' && (
        <div className="w-full max-w-md glass p-10 animate-in rounded-[3.5rem] space-y-8">
           <h2 className="text-3xl font-black text-center text-blue-200">{t.multi}</h2>
           
           {!conn ? (
             <div className="space-y-6">
                <div className="p-8 bg-white/5 rounded-3xl border border-white/10 text-center">
                   <p className="text-sm font-bold text-blue-300 mb-2 uppercase opacity-60">{t.hostCode}</p>
                   <div className="text-5xl font-black text-white tracking-widest mb-6">{roomId}</div>
                   
                   <button 
                     onClick={copyInviteLink} 
                     className={`w-full py-6 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-3 ${copyStatus === 'success' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'}`}
                   >
                     {copyStatus === 'success' ? t.copied : t.copy}
                   </button>
                </div>
                
                <p className="text-center text-blue-100/60 font-bold text-sm leading-relaxed px-4">{t.shareCode}</p>
                
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xl font-black text-white animate-pulse">{t.waitingFriend}</p>
                </div>
             </div>
           ) : (
             <div className="text-center space-y-10 py-10">
                <div className="flex justify-center items-center gap-6">
                   <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-3xl border-2 border-white/20">👤</div>
                   <div className="text-4xl font-black text-indigo-400 animate-pulse">VS</div>
                   <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center text-3xl border-2 border-white/20">👤</div>
                </div>
                <p className="text-2xl font-black text-white animate-bounce">Starting Game...</p>
             </div>
           )}
        </div>
      )}

      {step === 'config' && (
        <div className="w-full max-w-sm glass p-10 animate-in rounded-[3.5rem]">
          <h2 className="text-2xl font-black text-center mb-10 text-blue-200 uppercase tracking-widest">{t.settings}</h2>
          <div className="mb-10 text-center">
            <p className="text-[15px] font-black text-emerald-400 mb-6 uppercase animate-pulse">{t.qType}</p>
            <div className="grid grid-cols-3 gap-3">
              {[QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE, QuestionType.FILL_BLANKS].map(type => (
                <button key={type} onClick={() => setConfig(p => ({ ...p, allowedTypes: [type] }))} className={`py-5 rounded-2xl text-xs font-black border-2 transition-all ${config.allowedTypes.includes(type) ? 'bg-blue-600 border-blue-400' : 'bg-white/5 border-white/5 opacity-50'}`}>
                  {type === QuestionType.MULTIPLE_CHOICE ? t.mcq : type === QuestionType.TRUE_FALSE ? t.tf : t.fill}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">{t.snap}</button>
            <button onClick={() => setStep('paste')} className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">{t.paste}</button>
            <input type="file" min-width="1" capture="environment" ref={fileInputRef} onChange={(e) => {
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

      {step === 'quiz' && (
        <div className="w-full max-w-2xl space-y-6 animate-in py-2 flex flex-col h-full overflow-hidden">
          {mode === 'multi' && (
             <div className="w-full grid grid-cols-2 gap-4 mb-2">
                <div className="glass p-4 rounded-2xl flex justify-between items-center border-l-4 border-blue-500">
                   <span className="font-black text-xs opacity-60 text-blue-200">YOU</span>
                   <span className="text-xl font-black text-white">{player.score}</span>
                </div>
                <div className="glass p-4 rounded-2xl flex justify-between items-center border-r-4 border-emerald-500">
                   <span className="text-xl font-black text-white">{opponent.score}</span>
                   <span className="font-black text-xs opacity-60 text-emerald-200">OPPONENT</span>
                </div>
             </div>
          )}
          <div className="quiz-card p-10 relative flex-1 flex flex-col border-t-[10px] border-blue-600">
            <div className="flex justify-between items-center mb-10">
               <div className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-2xl shadow-lg">
                <span className="text-yellow-400 text-[10px] block opacity-70 uppercase mb-1">{t.scoreLabel}</span> {player.score}
               </div>
               <div className="text-slate-500 font-black text-lg">{player.currentQuestionIndex + 1} / {questions.length}</div>
            </div>
            <div className="text-3xl font-black text-center mb-10 text-slate-800 flex-1 flex items-center justify-center bg-slate-50 p-10 rounded-[2.5rem] shadow-inner leading-tight italic">
              {questions[player.currentQuestionIndex]?.question}
            </div>
            <div className="grid grid-cols-1 gap-4">
              {questions[player.currentQuestionIndex]?.options.map((opt, i) => (
                <button key={i} disabled={player.isWaiting} onClick={() => handleAnswer(opt, i)} className={`p-6 rounded-3xl text-2xl font-black transition-all border-b-8 active:scale-95 ${feedback.index === i ? (feedback.status === 'correct' ? 'bg-emerald-500 text-white border-emerald-700' : 'bg-rose-500 text-white border-rose-700 animate-shake') : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'loading' && <div className="flex-1 flex items-center"><RocketLoading message={t.loadingMsg} /></div>}
      
      {step === 'reward' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg text-center space-y-10">
           <div className="glass p-16 rounded-[4rem] w-full border border-white/10 shadow-2xl relative">
             <div className="text-[100px] mb-8">🏆</div>
             <h2 className="text-5xl font-black text-white mb-8">{t.winner}</h2>
             <div className="text-3xl font-black bg-emerald-500/20 text-emerald-400 px-12 py-6 rounded-3xl border border-emerald-500/30 mb-10 inline-block">
               {t.score} {player.score}
             </div>
             <button onClick={() => { unlockAudio(); setStep('minigame_balloons'); }} className="w-full bg-indigo-600 border-b-8 border-indigo-800 text-white py-10 rounded-[2.5rem] font-black text-4xl shadow-xl active:scale-95 transition-all">
               {t.balloons} 🔥
             </button>
           </div>
        </div>
      )}

      {step === 'history' && (
        <div className="w-full max-w-md glass p-10 animate-in rounded-[3.5rem] flex flex-col h-[70vh]">
          <h2 className="text-2xl font-black text-center mb-8 text-blue-200 uppercase tracking-widest">{t.historyTitle}</h2>
          <div className="flex-1 overflow-y-auto space-y-4">
            {history.length === 0 ? <div className="text-center py-20 opacity-30 font-black">{t.noHistory}</div> : history.map(game => (
              <button key={game.id} onClick={() => { setMode('solo'); setQuestions(game.questions); setConfig(game.config); setPlayer({ score: 0, currentQuestionIndex: 0, attempts: {}, isFinished: false, isWaiting: false, lastActionStatus: null }); playSound('bg'); setStep('quiz'); }} className="w-full p-6 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 flex justify-between items-center transition-all">
                <div className="text-start">
                  <h3 className="font-black text-blue-100 truncate w-40">{game.title}</h3>
                  <p className="text-[10px] text-blue-300/40 mt-1">{game.date}</p>
                </div>
                <div className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black">{game.questions.length} {t.questions}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'paste' && (
        <div className="w-full max-w-sm glass p-10 animate-in rounded-[3.5rem] flex flex-col h-[60vh]">
          <textarea className="w-full flex-1 p-8 rounded-3xl bg-white/5 text-white mb-8 outline-none border border-white/5 text-xl font-bold" placeholder={t.pastePlaceholder} value={pastedText} onChange={(e) => setPastedText(e.target.value)} />
          <button onClick={() => startQuiz(undefined)} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-3xl shadow-xl">{t.generate}</button>
        </div>
      )}

      {step === 'minigame_balloons' && <BalloonPopGame lang={lang} score={player.score} onFinish={() => setStep('home')} />}
    </div>
  );
};

export default App;
