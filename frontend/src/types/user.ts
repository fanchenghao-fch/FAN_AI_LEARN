/**
 * TypeScript type definitions for the User System.
 *
 * Mirrors backend Pydantic schemas in app/models/user_schemas.py.
 */

// ── Auth ────────────────────────────────────────────────────

export interface WechatLoginRequest {
  code: string;
  nickname?: string;
  avatar_url?: string;
}

export interface UserBrief {
  id: string;
  nickname: string;
  avatar_url: string | null;
  coins: number;
  experience: number;
  level: number;
  level_title: string;
  created_at: string;
}

export interface LoginResponse {
  token: string;
  user: UserBrief;
}

// ── User Profile ────────────────────────────────────────────

export interface UserProfileResponse {
  user: UserBrief;
}

// ── User Stats ──────────────────────────────────────────────

export interface UserStats {
  total_sessions: number;
  accuracy: number;
  streak_days: number;
  coins: number;
  experience: number;
  level: number;
  level_title: string;
  exp_to_next: number;
  exp_percent: number;
}

// ── History ─────────────────────────────────────────────────

export interface HistoryItem {
  session_id: string;
  quiz_id: string;
  title: string;
  domain: string;
  score: number;
  total: number;
  accuracy: number;
  time_spent: number;
  created_at: string;
}

export interface HistoryPage {
  items: HistoryItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// ── Wrong Questions ─────────────────────────────────────────

export interface WrongQuestionItem {
  id: string;
  question_id: string;
  content: string;
  user_answer: string;
  correct_answer: string;
  explanation: string;
  domain: string;
  resolved: boolean;
  created_at: string;
  options?: { key: string; text: string }[] | null;
}

export interface WrongQuestionsByDomain {
  domain: string;
  count: number;
  questions: WrongQuestionItem[];
}

// ── API Response ────────────────────────────────────────────

export interface RetryAnswerResponse {
  is_correct: boolean;
  correct_answer: string;
  resolved: boolean;
  coins_earned: number;
}

export interface UserAPIResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}
