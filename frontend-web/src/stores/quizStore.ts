/**
 * Zustand store for quiz session state.
 * Shared with Taro frontend — business logic is identical.
 */

import { create } from "zustand";
import type {
  Question,
  UserAnswer,
  QuizSession,
  QuizResult,
  SSEProgressEvent,
} from "../types/quiz";

// ── Store State ───────────────────────────────────────────

interface QuizState {
  session: QuizSession;
  generationProgress: SSEProgressEvent | null;
  generationError: string | null;
  lastAnswerCorrect: boolean | null;
  showExplanation: boolean;
  result: QuizResult | null;
  startTime: number | null;
  elapsedTime: number;
}

// ── Store Actions ─────────────────────────────────────────

interface QuizActions {
  initSession: (quizId: string, title: string, domain: string, questions: Question[]) => void;
  resetSession: () => void;
  submitAnswer: (questionId: string, userAnswer: string, timeSpent: number) => void;
  goToNextQuestion: () => void;
  goToPrevQuestion: () => void;
  dismissFeedback: () => void;
  setGenerationProgress: (progress: SSEProgressEvent | null) => void;
  setGenerationError: (error: string | null) => void;
  setResult: (result: QuizResult) => void;
  startTimer: () => void;
  tickTimer: () => void;
  stopTimer: () => void;
  getCurrentQuestion: () => Question | null;
  getProgress: () => { current: number; total: number; percent: number };
  getScore: () => { correct: number; total: number };
}

// ── Initial State ─────────────────────────────────────────

const initialSession: QuizSession = {
  quiz_id: "",
  title: "",
  knowledge_domain: "",
  questions: [],
  current_index: 0,
  answers: [],
  combo: 0,
  max_combo: 0,
  status: "idle",
};

// ── Store ─────────────────────────────────────────────────

export const useQuizStore = create<QuizState & QuizActions>((set, get) => ({
  session: { ...initialSession },
  generationProgress: null,
  generationError: null,
  lastAnswerCorrect: null,
  showExplanation: false,
  result: null,
  startTime: null,
  elapsedTime: 0,

  initSession: (quizId, title, domain, questions) => {
    set({
      session: {
        quiz_id: quizId,
        title,
        knowledge_domain: domain,
        questions,
        current_index: 0,
        answers: [],
        combo: 0,
        max_combo: 0,
        status: "in_progress",
      },
      lastAnswerCorrect: null,
      showExplanation: false,
      result: null,
      startTime: Date.now(),
      elapsedTime: 0,
    });
  },

  resetSession: () => {
    set({
      session: { ...initialSession },
      generationProgress: null,
      generationError: null,
      lastAnswerCorrect: null,
      showExplanation: false,
      result: null,
      startTime: null,
      elapsedTime: 0,
    });
  },

  submitAnswer: (questionId, userAnswer, timeSpent) => {
    const { session } = get();
    const question = session.questions[session.current_index];
    if (!question) return;

    const isCorrect = userAnswer === question.correct_answer;
    const newCombo = isCorrect ? session.combo + 1 : 0;
    const newMaxCombo = Math.max(session.max_combo, newCombo);

    const answer: UserAnswer = {
      question_id: questionId,
      user_answer: userAnswer,
      is_correct: isCorrect,
      time_spent: timeSpent,
    };

    const newAnswers = [...session.answers, answer];

    set({
      session: {
        ...session,
        answers: newAnswers,
        combo: newCombo,
        max_combo: newMaxCombo,
      },
      lastAnswerCorrect: isCorrect,
      showExplanation: true,
    });

    if (newAnswers.length >= session.questions.length) {
      set({ session: { ...get().session, status: "completed" } });
    }
  },

  goToNextQuestion: () => {
    const { session } = get();
    if (session.current_index < session.questions.length - 1) {
      set({
        session: { ...session, current_index: session.current_index + 1 },
        lastAnswerCorrect: null,
        showExplanation: false,
      });
    }
  },

  goToPrevQuestion: () => {
    const { session } = get();
    if (session.current_index > 0) {
      set({
        session: { ...session, current_index: session.current_index - 1 },
        lastAnswerCorrect: null,
        showExplanation: false,
      });
    }
  },

  dismissFeedback: () => set({ lastAnswerCorrect: null, showExplanation: false }),

  setGenerationProgress: (progress) => set({ generationProgress: progress }),
  setGenerationError: (error) => set({ generationError: error }),
  setResult: (result) => set({ result }),

  startTimer: () => set({ startTime: Date.now(), elapsedTime: 0 }),
  tickTimer: () => {
    const { startTime } = get();
    if (startTime) set({ elapsedTime: Math.floor((Date.now() - startTime) / 1000) });
  },
  stopTimer: () => {
    const { startTime } = get();
    if (startTime) set({ elapsedTime: Math.floor((Date.now() - startTime) / 1000) });
  },

  getCurrentQuestion: () => {
    const { session } = get();
    return session.questions[session.current_index] || null;
  },

  getProgress: () => {
    const { session } = get();
    return {
      current: session.current_index + 1,
      total: session.questions.length,
      percent: session.questions.length > 0
        ? Math.round(((session.current_index + 1) / session.questions.length) * 100)
        : 0,
    };
  },

  getScore: () => {
    const { session } = get();
    const correct = session.answers.filter((a) => a.is_correct).length;
    return { correct, total: session.answers.length };
  },
}));
