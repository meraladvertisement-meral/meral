
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
  const [showLegal, setShowLegal] = useState<'none' | 'policy' | 'terms'>('none');
  const [history, setHistory] = useState<SavedGame[]>([]);
  const [mode, setMode] = useState<'solo' | 'multi'>('solo');
  
  const [peer, setPeer] = useState<any>(null);
  const [conn, setConn] = useState<any>(null);
  const [roomId, setRoomId] = useState('');
  const [joinId, setJoinId] = useState('');
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
      authSub: "سريع وآمن للعائلات.",
      google: "دخول سريع",
      acceptText: "أوافق على ",
      privacyLink: "سياسة الخصوصية",
      termsLink: "شروط الاستخدام",
      solo: 'تحدي الإتقان 🧠', soloSub: 'تعلم فردي ذكي', multi: 'المواجهة الثنائية 🆚', multiSub: 'تحدَّ صديقك الآن',
      settings: 'إعدادات الاختبار', winner: 'أداء عبقري! 💎',
      scoreLabel: 'النتيجة', points: 'نقطة', score: 'النقاط:', home: 'الرئيسية',
      generate: 'تحليل وإنشاء ✨', snap: 'تصوير الدرس 📸', 
      paste: 'نص يدوي 📝', pastePlaceholder: 'ضع النص هنا ليقوم الذكاء الاصطناعي بتحليله...', back: 'تراجع', loadingMsg: 'جاري التحليل...',
      balloons: '🎈 فرقع البالونات!', qType: 'نوع الأسئلة:', mcq: 'ABC', tf: 'T/F', fill: '___',
      qCount: 'عدد الأسئلة:', history: 'السجل 📜', historyTitle: 'آخر الألعاب', noHistory: 'No History',
      quizOf: 'اختبار بتاريخ', questions: 'سؤال', joinTitle: 'انضم للمواجهة', joinPlaceholder: 'ادخل الكود',
      copy: 'نسخ الرابط 🔗', copied: 'تم النسخ! ✅', backBtn: 'تراجع',
      quizReady: 'الاختبار جاهز! 🎉', startQuiz: 'ابدأ التحدي 🔊',
      enableMusic: '🔊 الصوت مفعل',
      diffLabel: 'الصعوبة:',
      easy: 'سهل 👶', medium: 'متوسط ⚡', hard: 'صعب 🔥',
      waitingFriend: 'بانتظار صديقك...', connect: 'دخول المواجهة 🔗', hostCode: 'كود الغرفة:', shareCode: 'أرسل الكود لصديقك',
      you: 'أنت', opponent: 'الخصم', win: 'الفائز!', draw: 'تعادل!', totalScore: 'النتيجة النهائية',
      close: "إغلاق"
    },
    en: {
      welcome: "Welcome to QuizSnap 👋",
      authSub: "Fast and safe for families.",
      google: "Quick Start",
      acceptText: "I agree to ",
      privacyLink: "Privacy Policy",
      termsLink: "Terms of Use",
      solo: 'Mastery Mode 🧠', soloSub: 'Solo Smart Learning', multi: '2-Player Duel 🆚', multiSub: 'Challenge a friend',
      settings: 'Quiz Config', winner: 'Genius! 💎',
      scoreLabel: 'SCORE', points: 'Pts', score: 'Score:', home: 'Home',
      generate: 'Generate ✨', snap: 'Snap Lesson 📸', 
      paste: 'Manual Text 📝', pastePlaceholder: 'Paste text here...', back: 'Back', loadingMsg: 'Analyzing...',
      balloons: '🎈 Pop Balloons!', qType: 'Type:', mcq: 'ABC', tf: 'T/F', fill: '___',
      qCount: 'Count:', history: 'History 📜', historyTitle: 'Recent Games', noHistory: 'No history',
      quizOf: 'Quiz of', questions: 'Questions', joinTitle: 'Join Duel', joinPlaceholder: 'Enter Code',
      copy: 'Copy Link 🔗', copied: 'Copied! ✅', backBtn: 'Back',
      quizReady: 'Quiz Ready! 🎉', startQuiz: 'Start Challenge 🔊',
      enableMusic: '🔊 Sound Enabled',
      diffLabel: 'Difficulty:',
      easy: 'Easy 👶', medium: 'Med ⚡', hard: 'Hard 🔥',
      waitingFriend: 'Waiting...', connect: 'Join Duel 🔗', hostCode: 'Room Code:', shareCode: 'Send to friend',
      you: 'YOU', opponent: 'OPPONENT', win: 'WINNER!', draw: 'DRAW!', totalScore: 'FINAL SCORE',
      close: "Close"
    },
    de: {
      welcome: "Willkommen 👋",
      authSub: "Sicher für Familien.",
      google: "Schnellstart",
      acceptText: "Ich stimme zu ",
      privacyLink: "Datenschutz",
      termsLink: "Nutzungsbedingungen",
      solo: 'Meisterschaft 🧠', soloSub: 'Einzelnes Lernen', multi: 'Duell 🆚', multiSub: 'Freunde fordern',
      settings: 'Einstellungen', winner: 'Genial! 💎',
      scoreLabel: 'PUNKTE', points: 'Pkt', score: 'Punkte:', home: 'Start',
      generate: 'Generieren ✨', snap: 'Knipsen 📸', 
      paste: 'Manueller Text 📝', pastePlaceholder: 'Text hier einfügen...', back: 'Zurück', loadingMsg: 'Analyse...',
      balloons: '🎈 Ballons!', qType: 'Fragetyp:', mcq: 'ABC', tf: 'W/F', fill: '___',
      qCount: 'Anzahl:', history: 'Verlauf 📜', historyTitle: 'Letzte Spiele', noHistory: 'Kein Verlauf',
      quizOf: 'Quiz vom', questions: 'Fragen', joinTitle: 'Beitreten', joinPlaceholder: 'Code',
      copy: 'Link kopieren 🔗', copied: 'Kopiert! ✅', backBtn: 'Zurück',
      quizReady: 'Bereit! 🎉', startQuiz: 'Starten 🔊',
      enableMusic: '🔊 Sound an',
      diffLabel: 'Stufe:',
      easy: 'Leicht 👶', medium: 'Mittel ⚡', hard: 'Schwer 🔥',
      waitingFriend: 'Warten...', connect: 'Beitreten 🔗', hostCode: 'Raumcode:', shareCode: 'Code senden',
      you: 'DU', opponent: 'GEGNER', win: 'GEWINNER!', draw: 'REMIS!', totalScore: 'ENDSTAND',
      close: "Schließen"
    }
  };

  const t = translations[lang] || translations.ar;

  useEffect(() => {
    document.dir = (lang === 'ar') ? 'rtl' : 'ltr';
    const saved = localStorage.getItem('quiz_history');
    if (saved) setHistory(JSON.parse(saved));
  }, [lang]);

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
    unlockAudio();
    const id = generateShortId();
    const p = new Peer(id);
    p.on('open', () => {
      setRoomId(id);
      setPeer(p);
      setMode('multi');
      setStep('config');
    });
    p.on('error', () => initMultiplayerHost());
  };

  const connectToRoom = (id: string) => {
    if (!id || id.length < 6) return;
    unlockAudio();
    setStep('loading');
    const p = new Peer();
    p.on('open', () => {
      const c = p.connect(id);
      setConn(c);
      c.on('data', (data: MultiplayerMessage) => handleMultiplayerData(data));
      c.on('error', () => {
        alert("Room not found.");
        setStep('home');
      });
      setPeer(p);
      setMode('multi');
    });
  };

  const handleLogin = () => {
    if (!legalAccepted) {
      alert(lang === 'ar' ? "يرجى الموافقة على الشروط أولاً." : "Please accept terms.");
      return;
    }
    unlockAudio(); 
    setUser({ name: "User", photo: "" });
    if (joinId) connectToRoom(joinId);
    else setStep('home');
  };

  const startQuiz = async (base64?: string) => {
    unlockAudio();
    setStep('loading');
    try {
      const q = base64 ? await generateQuizFromImage(base64, config) : await generateQuizFromText(pastedText, config);
      setQuestions(q);
      setPlayer({ score: 0, currentQuestionIndex: 0, attempts: {}, isFinished: false, isWaiting: false, lastActionStatus: null });
      if (mode === 'multi' && conn && conn.open) {
        conn.send({ type: 'INIT_QUIZ', payload: { questions: q, config } });
      }
      setStep('ready');
    } catch (e) { 
      alert("Analysis failed."); 
      setStep('config'); 
    }
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

      if (mode === 'multi' && conn) conn.send({ type: 'PROGRESS', payload: newState });

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

  const renderMultiplayerReward = () => {
    const userScore = player.score;
    const oppScore = opponent?.score || 0;
    const isUserWinner = userScore > oppScore;
    const isDraw = userScore === oppScore;
    const isOpponentWinner = oppScore > userScore;

    return (
      <div className="flex flex-col items-center w-full max-w-5xl space-y-10 animate-in p-2">
        <div className="flex flex-col md:flex-row w-full gap-4 bg-slate-900/60 rounded-[4rem] overflow-hidden border-4 border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.8)] relative min-h-[500px]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 hidden md:flex">
            <div className="w-24 h-24 bg-[#0f172a] rounded-full border-4 border-indigo-500 shadow-[0_0_50px_rgba(79,70,229,0.9)] flex items-center justify-center">
               <span className="text-4xl font-black text-white italic">VS</span>
            </div>
          </div>
          <div className={`flex-1 flex flex-col items-center justify-center p-12 relative ${isUserWinner ? 'bg-indigo-600/40 shadow-inner' : 'bg-slate-800/10 opacity-70'}`}>
            {isUserWinner && <div className="absolute top-10 text-8xl animate-bounce drop-shadow-[0_0_30px_rgba(255,215,0,0.8)]">👑</div>}
            <div className={`w-32 h-32 rounded-full mb-6 flex items-center justify-center text-6xl shadow-2xl border-4 ${isUserWinner ? 'bg-indigo-500 border-yellow-400' : 'bg-slate-700 border-slate-600'}`}>👤</div>
            <h3 className="text-3xl font-black text-white mb-2">{t.you}</h3>
            {isUserWinner && <span className="text-yellow-400 font-black text-xl mb-6 animate-pulse">{t.win}</span>}
            <div className="text-[12rem] font-black text-white leading-none">{userScore}</div>
            <div className="text-indigo-200/50 font-black text-sm mt-4 uppercase tracking-[0.4em]">{t.points}</div>
          </div>
          <div className={`flex-1 flex flex-col items-center justify-center p-12 relative ${isOpponentWinner ? 'bg-rose-600/40 shadow-inner' : 'bg-slate-800/10 opacity-70'}`}>
            {isOpponentWinner && <div className="absolute top-10 text-8xl animate-bounce drop-shadow-[0_0_30px_rgba(255,215,0,0.8)]">👑</div>}
            <div className={`w-32 h-32 rounded-full mb-6 flex items-center justify-center text-6xl shadow-2xl border-4 ${isOpponentWinner ? 'bg-rose-500 border-yellow-400' : 'bg-slate-700 border-slate-600'}`}>👤</div>
            <h3 className="text-3xl font-black text-white mb-2">{t.opponent}</h3>
            {isOpponentWinner && <span className="text-yellow-400 font-black text-xl mb-6 animate-pulse">{t.win}</span>}
            <div className="text-[12rem] font-black text-white leading-none">{oppScore}</div>
            <div className="text-rose-200/50 font-black text-sm mt-4 uppercase tracking-[0.4em]">{t.points}</div>
          </div>
        </div>
        {isDraw && <div className="bg-amber-500 px-12 py-6 rounded-full text-white font-black text-4xl animate-bounce">🤝 {t.draw}</div>}
        <button onClick={() => setStep('minigame_balloons')} className="w-full bg-emerald-600 border-b-[15px] border-emerald-950 text-white py-12 rounded-[4rem] font-black text-5xl active:translate-y-4 active:border-b-0 transition-all shadow-2xl">{t.balloons} 🎈</button>
      </div>
    );
  };

  const renderLegalModal = () => {
    if (showLegal === 'none') return null;
    const isArabic = lang === 'ar';
    const content = showLegal === 'policy' ? {
      title: t.privacyLink,
      body: isArabic ? [
        "نحن نحترم خصوصيتك وخصوصية طفلك.",
        "1. لا نطلب أي معلومات شخصية حساسة مثل العنوان أو أرقام الهواتف.",
        "2. نستخدم خدمات الذكاء الاصطناعي (Gemini API) لتحويل دروسك إلى أسئلة فقط.",
        "3. تاريخ ألعابك يُخزن محلياً على جهازك ولا يشارك مع خوادم خارجية.",
        "4. يتم حذف الصور المرفوعة فوراً بعد تحليلها من قِبل الذكاء الاصطناعي."
      ] : [
        "We respect your and your child's privacy.",
        "1. We do not ask for sensitive personal info like addresses or phone numbers.",
        "2. We use AI (Gemini API) solely to transform your lessons into quizzes.",
        "3. Your game history is stored locally on your device and not shared.",
        "4. Uploaded images are processed and immediately discarded by the AI."
      ]
    } : {
      title: t.termsLink,
      body: isArabic ? [
        "شروط استخدام تطبيق QuizSnap:",
        "1. التطبيق مخصص للأغراض التعليمية والترفيهية فقط.",
        "2. أنت مسؤول عن المحتوى الذي تقوم بتصويره أو لصقه في التطبيق.",
        "3. يُمنع استخدام التطبيق لرفع صور غير لائقة أو محمية بحقوق طبع ونشر.",
        "4. استخدامك للتطبيق يعني موافقتك على معالجة البيانات بواسطة الذكاء الاصطناعي."
      ] : [
        "QuizSnap Terms of Use:",
        "1. This app is for educational and entertainment purposes only.",
        "2. You are responsible for the content you snap or paste into the app.",
        "3. Prohibited use includes uploading inappropriate or copyrighted content.",
        "4. Using the app means you agree to data processing by the AI services."
      ]
    };

    return (
      <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-300">
        <div className="glass max-w-2xl w-full max-h-[80vh] rounded-[3rem] p-8 sm:p-12 flex flex-col border-2 border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden">
          <h2 className="text-3xl font-black text-emerald-400 mb-8 border-b border-white/10 pb-4">{content.title}</h2>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 text-blue-100/90 text-lg leading-relaxed">
            {content.body.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <button onClick={() => setShowLegal('none')} className="mt-10 bg-blue-600 text-white py-5 rounded-3xl font-black text-xl hover:bg-blue-500 transition-all shadow-xl">
            {t.close} ✓
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-8 overflow-hidden relative">
      {renderLegalModal()}
      <div className="w-full max-w-4xl flex justify-between items-center py-2 z-50 mb-4 sticky top-0">
        <button onClick={() => setStep('home')} className="glass p-3 rounded-2xl text-xl transition-all">🏠</button>
        <div className="flex gap-2">
          {['ar', 'en', 'de'].map(l => (
            <button key={l} onClick={() => setLang(l as Language)} className={`px-4 py-2 rounded-xl text-[10px] font-black ${lang === l ? 'bg-blue-600 text-white' : 'glass opacity-40'}`}>{l.toUpperCase()}</button>
          ))}
          <button onClick={toggleMute} className={`glass p-3 rounded-2xl ${isMuted ? 'bg-rose-500/20' : 'bg-emerald-500/20'}`}>{isMuted ? '🔇' : '🔊'}</button>
        </div>
      </div>

      {step === 'auth' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm text-center space-y-12 animate-in">
          <QuizSnapLogo size={240} />
          <div className="w-full space-y-6">
            <div className="flex items-center gap-4 bg-white/5 p-5 rounded-3xl border border-white/10 group">
               <div onClick={() => { setLegalAccepted(!legalAccepted); unlockAudio(); }} className={`w-10 h-10 min-w-[40px] rounded-xl border-2 cursor-pointer flex items-center justify-center transition-all ${legalAccepted ? 'bg-blue-600 border-blue-400 shadow-lg' : 'border-white/20'}`}>
                 {legalAccepted && <span className="text-white text-2xl">✓</span>}
               </div>
               <p className="text-[13px] font-bold text-white/80 text-start leading-snug">
                 {t.acceptText}
                 <span onClick={() => setShowLegal('policy')} className="text-blue-400 underline cursor-pointer hover:text-blue-300">{t.privacyLink}</span>
                 {lang === 'ar' ? " و " : " and "}
                 <span onClick={() => setShowLegal('terms')} className="text-blue-400 underline cursor-pointer hover:text-blue-300">{t.termsLink}</span>
               </p>
            </div>
            <button onClick={handleLogin} className={`w-full bg-white text-slate-900 py-6 rounded-[2rem] font-black text-2xl shadow-xl transition-all ${!legalAccepted ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}>
              {t.google}
            </button>
          </div>
        </div>
      )}

      {step === 'home' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl space-y-8 animate-in">
          <QuizSnapLogo />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg px-4">
            <button onClick={() => { setMode('solo'); setStep('config'); }} className="glass p-8 rounded-[3rem] text-center"><div className="text-6xl mb-4">🧠</div><h2 className="text-2xl font-black text-blue-100">{t.solo}</h2><p className="text-blue-300 text-xs mt-2 font-bold">{t.soloSub}</p></button>
            <button onClick={initMultiplayerHost} className="glass p-8 rounded-[3rem] text-center border-indigo-500/30"><div className="text-6xl mb-4">🆚</div><h2 className="text-2xl font-black text-indigo-300">{t.multi}</h2><p className="text-indigo-400 text-xs mt-2 font-bold">{t.multiSub}</p></button>
          </div>
          <button onClick={() => setStep('join')} className="glass w-full max-w-xs py-5 rounded-3xl font-black text-emerald-400">{t.joinTitle} 🔗</button>
        </div>
      )}

      {step === 'config' && (
        <div className="w-full max-w-md glass p-10 rounded-[3.5rem] space-y-8 shadow-2xl overflow-y-auto max-h-[85vh] custom-scrollbar">
          <h2 className="text-2xl font-black text-center text-blue-200 uppercase">{t.settings}</h2>
          
          <div className="space-y-4">
            <p className="text-xs font-black text-amber-400 uppercase text-center">{t.qType}</p>
            <div className="grid grid-cols-3 gap-2">
              {[QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE, QuestionType.FILL_BLANKS].map(type => (
                <button key={type} onClick={() => setConfig(p => ({ ...p, allowedTypes: [type] }))} className={`py-3 rounded-xl text-[10px] font-black border-2 transition-all ${config.allowedTypes.includes(type) ? 'bg-blue-600 border-blue-400' : 'bg-white/5 opacity-50'}`}>
                  {type === QuestionType.MULTIPLE_CHOICE ? t.mcq : type === QuestionType.TRUE_FALSE ? t.tf : t.fill}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-black text-rose-400 uppercase text-center">{t.diffLabel}</p>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setConfig(p => ({ ...p, difficulty: d }))} className={`py-3 rounded-xl text-[10px] font-black border-2 transition-all ${config.difficulty === d ? 'bg-blue-600 border-blue-400' : 'bg-white/5 opacity-50'}`}>
                  {d === 'easy' ? t.easy : d === 'medium' ? t.medium : t.hard}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <p className="text-xs font-black text-blue-300 uppercase">{t.qCount}</p>
              <span className="bg-blue-600 text-white px-4 py-1 rounded-full font-black text-sm">{config.count}</span>
            </div>
            <input type="range" min="3" max="15" value={config.count} onChange={(e) => setConfig(p => ({ ...p, count: parseInt(e.target.value) }))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500" />
          </div>

          <div className="space-y-4 pt-6 border-t border-white/10">
            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">{t.snap}</button>
            <button onClick={() => setStep('paste')} className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">{t.paste}</button>
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

      {step === 'paste' && (
        <div className="w-full max-w-2xl glass p-10 rounded-[3.5rem] flex flex-col h-[70vh] shadow-2xl animate-in">
          <h2 className="text-3xl font-black text-center text-emerald-400 mb-8 uppercase">{t.paste}</h2>
          <textarea className="w-full flex-1 p-8 rounded-[3rem] bg-slate-900/50 text-white mb-10 outline-none border-2 border-white/10 text-xl font-bold placeholder:opacity-20 focus:border-indigo-500 transition-all custom-scrollbar resize-none shadow-inner" placeholder={t.pastePlaceholder} value={pastedText} onChange={(e) => setPastedText(e.target.value)} />
          <button onClick={() => startQuiz()} className="w-full bg-blue-600 text-white py-8 rounded-[3rem] font-black text-4xl shadow-2xl hover:bg-blue-500 active:scale-95 transition-all">{t.generate} 🚀</button>
        </div>
      )}

      {step === 'reward' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full text-center">
           {mode === 'multi' ? renderMultiplayerReward() : (
             <div className="glass p-16 rounded-[4rem] w-full max-w-lg shadow-2xl relative animate-in">
               <div className="text-[120px] mb-8 animate-bounce">🏆</div>
               <h2 className="text-5xl font-black text-white mb-8 tracking-tighter italic">{t.winner}</h2>
               <div className="bg-slate-900/40 p-10 rounded-[3rem] mb-10">
                 <p className="text-blue-300 font-black mb-1 text-sm">{t.totalScore}</p>
                 <div className="text-[10rem] font-black text-white leading-none">{player.score}</div>
               </div>
               <button onClick={() => setStep('minigame_balloons')} className="w-full bg-indigo-600 border-b-[12px] border-indigo-950 text-white py-10 rounded-[3rem] font-black text-4xl shadow-2xl">{t.balloons} 🎈</button>
             </div>
           )}
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

      {step === 'quiz' && (
        <div className="w-full max-w-2xl space-y-6 animate-in py-2 flex flex-col h-full">
          <div className="quiz-card p-10 relative flex-1 flex flex-col border-t-[12px] border-blue-600">
            <div className="flex justify-between items-center mb-8">
               <div className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-2xl shadow-lg border border-white/10"><span className="text-yellow-400 text-[10px] block opacity-70 uppercase mb-1">{t.scoreLabel}</span> {player.score}</div>
               <div className="text-slate-400 font-black text-lg bg-slate-100 px-6 py-2 rounded-full">{player.currentQuestionIndex + 1} / {questions.length}</div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-center mb-10 text-slate-800 flex-1 flex items-center justify-center bg-slate-50 p-8 rounded-[2.5rem] shadow-inner px-4">{questions[player.currentQuestionIndex]?.question}</div>
            <div className="grid grid-cols-1 gap-4">
              {questions[player.currentQuestionIndex]?.options.map((opt, i) => (
                <button key={i} disabled={player.isWaiting} onClick={() => handleAnswer(opt, i)} className={`p-5 rounded-3xl text-xl font-black transition-all border-b-8 active:scale-95 ${correctAnswerIdx === i ? 'bg-emerald-500 text-white border-emerald-700' : wrongAnswers.includes(i) ? 'bg-rose-500 text-white border-rose-700 animate-[shake_0.4s]' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'}`}>{opt}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'join' && (
        <div className="w-full max-w-sm glass p-10 rounded-[3.5rem] space-y-8 text-center shadow-2xl animate-in">
          <h2 className="text-2xl font-black text-emerald-400 uppercase tracking-widest">{t.joinTitle}</h2>
          <input type="number" placeholder={t.joinPlaceholder} className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl text-center text-3xl font-black text-white outline-none" value={joinId} onChange={(e) => setJoinId(e.target.value.slice(0, 6))} />
          <button disabled={joinId.length < 6} onClick={() => connectToRoom(joinId)} className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-xl disabled:opacity-30">{t.connect}</button>
        </div>
      )}

      {step === 'minigame_balloons' && <BalloonPopGame lang={lang} score={player.score} onFinish={() => setStep('home')} />}
    </div>
  );
};

export default App;
