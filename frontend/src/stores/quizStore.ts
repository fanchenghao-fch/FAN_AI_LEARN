/**
 * Zustand store for quiz session state.
 *
 * Manages the entire quiz lifecycle: generation → answering → results.
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
  // Quiz session
  session: QuizSession;

  // Generation state
  /** Latest progress event (backward-compatible). */
  generationProgress: SSEProgressEvent | null;
  /** Multi-stage progress tracking — maps stage → latest event. */
  stageProgress: Partial<Record<SSEProgressEvent["stage"], SSEProgressEvent>>;
  generationError: string | null;

  // Current question feedback
  lastAnswerCorrect: boolean | null;
  showExplanation: boolean;

  // Results
  result: QuizResult | null;

  // Timer
  startTime: number | null;
  elapsedTime: number;
}

// ── Store Actions ─────────────────────────────────────────

interface QuizActions {
  // Session management
  initSession: (quizId: string, title: string, domain: string, knowledgeInput: string, questions: Question[]) => void;
  resetSession: () => void;

  // Answer handling
  submitAnswer: (questionId: string, userAnswer: string, timeSpent: number) => void;
  goToNextQuestion: () => void;
  goToPrevQuestion: () => void;
  dismissFeedback: () => void;

  // Generation state
  setGenerationProgress: (progress: SSEProgressEvent | null) => void;
  setGenerationError: (error: string | null) => void;

  // Result
  setResult: (result: QuizResult) => void;

  // Timer
  startTimer: () => void;
  tickTimer: () => void;
  stopTimer: () => void;

  // Computed getters (as functions)
  getCurrentQuestion: () => Question | null;
  getProgress: () => { current: number; total: number; percent: number };
  getScore: () => { correct: number; total: number };
}

// ── Initial State ─────────────────────────────────────────

const initialSession: QuizSession = {
  quiz_id: "",
  title: "",
  knowledge_domain: "",
  knowledge_input: "",
  questions: [],
  current_index: 0,
  answers: [],
  combo: 0,
  max_combo: 0,
  status: "idle",
};

// ── Store ─────────────────────────────────────────────────

export const useQuizStore = create<QuizState & QuizActions>((set, get) => ({
  // Initial state
  session: { ...initialSession },
  generationProgress: null,
  stageProgress: {},
  generationError: null,
  lastAnswerCorrect: null,
  showExplanation: false,
  result: null,
  startTime: null,
  elapsedTime: 0,

  // ── Session ─────────────────────────────────────────

  initSession: (quizId, title, domain, knowledgeInput, questions) => {
    set({
      session: {
        quiz_id: quizId,
        title,
        knowledge_domain: domain,
        knowledge_input: knowledgeInput,
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
      stageProgress: {},
      generationError: null,
      lastAnswerCorrect: null,
      showExplanation: false,
      result: null,
      startTime: null,
      elapsedTime: 0,
    });
  },

  // ── Answer ──────────────────────────────────────────

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

    // Check if quiz is completed
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

  dismissFeedback: () => {
    set({ lastAnswerCorrect: null, showExplanation: false });
  },

  // ── Generation ───────────────────────────────────────

  setGenerationProgress: (progress) => {
    if (progress) {
      set((state) => ({
        generationProgress: progress,
        stageProgress: {
          ...state.stageProgress,
          [progress.stage]: progress,
        },
      }));
    } else {
      set({ generationProgress: null });
    }
  },
  setGenerationError: (error) => set({ generationError: error }),

  // ── Result ───────────────────────────────────────────

  setResult: (result) => set({ result }),

  // ── Timer ────────────────────────────────────────────

  startTimer: () => set({ startTime: Date.now(), elapsedTime: 0 }),

  tickTimer: () => {
    const { startTime } = get();
    if (startTime) {
      set({ elapsedTime: Math.floor((Date.now() - startTime) / 1000) });
    }
  },

  stopTimer: () => {
    const { startTime } = get();
    if (startTime) {
      set({ elapsedTime: Math.floor((Date.now() - startTime) / 1000) });
    }
  },

  // ── Computed ─────────────────────────────────────────

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
