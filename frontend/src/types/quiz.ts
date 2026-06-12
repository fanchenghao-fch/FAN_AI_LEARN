/**
 * TypeScript type definitions — kept in sync with backend Pydantic models.
 *
 * @see backend/app/models/quiz.py
 * @see backend/app/models/api.py
 */

// ── Enums ─────────────────────────────────────────────────

export type QuestionType = "choice" | "truefalse" | "fill";

export type Difficulty = "easy" | "medium" | "hard";

// ── Core Quiz Types ──────────────────────────────────────

export interface Option {
  key: string;
  text: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  content: string;
  options?: Option[];
  correct_answer: string;
  explanation: string;
  source?: string;
  difficulty: Difficulty;
  image_url?: string;
}

export interface QuizOutput {
  title: string;
  knowledge_domain: string;
  questions: Question[];
}

// ── Quiz Session Types ────────────────────────────────────

export interface UserAnswer {
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  time_spent: number;
}

export interface QuizSession {
  quiz_id: string;
  title: string;
  knowledge_domain: string;
  questions: Question[];
  current_index: number;
  answers: UserAnswer[];
  combo: number;
  max_combo: number;
  status: "idle" | "loading" | "in_progress" | "completed";
}

// ── Result Types ──────────────────────────────────────────

export interface WrongQuestionDetail {
  question_id: string;
  content: string;
  user_answer: string;
  correct_answer: string;
  explanation: string;
}

export interface RewardInfo {
  coins_earned: number;
  experience_earned: number;
  new_level: number | null;
  new_level_title: string | null;
  is_first_today: boolean;
}

export interface QuizResult {
  quiz_id: string;
  title: string;
  score: number;
  total_questions: number;
  accuracy: number;
  total_time: number;
  knowledge_summary: string[];
  wrong_questions: WrongQuestionDetail[];
  mastery_radar: Record<string, number>;
  study_suggestion: string;
  reward?: RewardInfo;
}

// ── Validation Types ──────────────────────────────────────

export interface ValidationIssue {
  question_id: string;
  problem: string;
  suggestion: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// ── API Types ─────────────────────────────────────────────

export interface QuizGenerateRequest {
  knowledge_input: string;
  input_type?: "text" | "document" | "url";
  question_count?: number;
  difficulty?: "easy" | "medium" | "hard" | "auto";
  question_types?: string[];
  enable_search?: boolean;
}

export interface QuizAnalyzeRequest {
  quiz_id: string;
  title?: string;
  knowledge_domain?: string;
  questions: Record<string, unknown>[];
  answers: Record<string, unknown>[];
  total_time: number;
}

export interface APIResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

// ── SSE Event Types ───────────────────────────────────────

export interface SSEProgressEvent {
  stage: string;
  message: string;
}

export interface SSEGenerateResult {
  quiz_id: string;
  title: string;
  knowledge_domain: string;
  questions: Question[];
  validation: ValidationResult;
}

export interface SSEDoneEvent {
  status: string;
  total_tokens?: number;
  model?: string;
}
