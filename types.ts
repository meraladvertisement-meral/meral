
export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  FILL_BLANKS = 'fill_blanks'
}

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Language = 'ar' | 'en' | 'de';

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface QuizConfig {
  count: number;
  difficulty: Difficulty;
  language: Language;
  allowedTypes: QuestionType[];
}

export interface PlayerState {
  score: number;
  currentQuestionIndex: number;
  attempts: Record<string, number>;
  isFinished: boolean;
  isWaiting: boolean;
  lastActionStatus: 'correct' | 'wrong' | 'thinking' | null;
}

export interface SavedGame {
  id: string;
  date: string;
  title: string;
  questions: Question[];
  config: QuizConfig;
  bestScore?: number;
}

export interface MultiplayerMessage {
  type: 'INIT_QUIZ' | 'PROGRESS' | 'NEXT_READY';
  payload: any;
}
