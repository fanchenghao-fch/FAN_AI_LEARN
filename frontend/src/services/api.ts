/**
 * API service layer for communicating with the FastAPI backend.
 *
 * All HTTP requests use Taro.request (cross-platform: WeChat Mini Program).
 *
 * Quiz generation uses wx.request + /generate-sync (JSON endpoint) because
 * WeChat Mini Program cannot consume SSE streams via wx.request.
 */

import type {
  QuizGenerateRequest,
  QuizAnalyzeRequest,
  APIResponse,
  QuizResult,
} from "../types/quiz";
import type {
  UserAPIResponse,
  LoginResponse,
  UserProfileResponse,
} from "../types/user";
import Taro from "@tarojs/taro";

const API_BASE = "http://localhost:8000";

// ═══════════════════════════════════════════════════════════
// Token Management
// ═══════════════════════════════════════════════════════════

const TOKEN_KEY = "aladeng_token";

function getToken(): string | null {
  try {
    return Taro.getStorageSync(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

function clearToken(): void {
  try {
    Taro.removeStorageSync(TOKEN_KEY);
  } catch {
    // Ignore errors in environments without Taro APIs
  }
}

/**
 * Build auth headers if a token is available.
 */
function authHeaders(): Record<string, string> {
  const token = getToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

// ═══════════════════════════════════════════════════════════
// Auth API
// ═══════════════════════════════════════════════════════════

export const authApi = {
  /**
   * WeChat Mini Program Login — send wx.login code, get JWT.
   */
  async wechatLogin(code: string): Promise<UserAPIResponse<LoginResponse>> {
    try {
      const res = await Taro.request({
        url: `${API_BASE}/api/auth/wechat-login`,
        method: "POST",
        header: { "Content-Type": "application/json" },
        data: { code },
      });

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return {
          code: res.statusCode,
          message: (res.data as { detail?: string })?.detail || `HTTP ${res.statusCode}`,
        };
      }

      return res.data as UserAPIResponse<LoginResponse>;
    } catch (err) {
      return { code: -1, message: (err as Error).message || "网络请求失败" };
    }
  },

  /**
   * Get current user profile (requires valid JWT).
   */
  async getProfile(): Promise<UserAPIResponse<UserProfileResponse>> {
    try {
      const res = await Taro.request({
        url: `${API_BASE}/api/auth/me`,
        method: "GET",
        header: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
      });

      if (res.statusCode === 401) {
        clearToken();
        return { code: 401, message: "登录已过期，请重新登录" };
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return {
          code: res.statusCode,
          message: (res.data as { detail?: string })?.detail || `HTTP ${res.statusCode}`,
        };
      }

      return res.data as UserAPIResponse<UserProfileResponse>;
    } catch (err) {
      return { code: -1, message: (err as Error).message || "网络请求失败" };
    }
  },
};

// ═══════════════════════════════════════════════════════════
// User API
// ═══════════════════════════════════════════════════════════

export const userApi = {
  /**
   * Get current user's learning statistics.
   */
  async getStats(): Promise<UserAPIResponse<import("../types/user").UserStats>> {
    try {
      const res = await Taro.request({
        url: `${API_BASE}/api/user/stats`,
        method: "GET",
        header: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
      });

      if (res.statusCode === 401) {
        clearToken();
        return { code: 401, message: "登录已过期，请重新登录" };
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return {
          code: res.statusCode,
          message: (res.data as { detail?: string })?.detail || `HTTP ${res.statusCode}`,
        };
      }

      return res.data as UserAPIResponse<import("../types/user").UserStats>;
    } catch (err) {
      return { code: -1, message: (err as Error).message || "网络请求失败" };
    }
  },

  /**
   * Get paginated quiz history.
   */
  async getHistory(
    page = 1,
    pageSize = 20,
  ): Promise<UserAPIResponse<import("../types/user").HistoryPage>> {
    try {
      const res = await Taro.request({
        url: `${API_BASE}/api/user/history`,
        method: "GET",
        header: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        data: { page, page_size: pageSize },
      });

      if (res.statusCode === 401) {
        clearToken();
        return { code: 401, message: "登录已过期，请重新登录" };
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return {
          code: res.statusCode,
          message: (res.data as { detail?: string })?.detail || `HTTP ${res.statusCode}`,
        };
      }

      return res.data as UserAPIResponse<import("../types/user").HistoryPage>;
    } catch (err) {
      return { code: -1, message: (err as Error).message || "网络请求失败" };
    }
  },

  /**
   * Get wrong questions, optionally filtered by resolved status.
   */
  async getWrongQuestions(
    resolved?: number,
  ): Promise<UserAPIResponse<import("../types/user").WrongQuestionsByDomain[]>> {
    try {
      const data: Record<string, unknown> = {};
      if (resolved !== undefined) {
        data.resolved = resolved;
      }

      const res = await Taro.request({
        url: `${API_BASE}/api/user/wrong-questions`,
        method: "GET",
        header: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        data,
      });

      if (res.statusCode === 401) {
        clearToken();
        return { code: 401, message: "登录已过期，请重新登录" };
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return {
          code: res.statusCode,
          message: (res.data as { detail?: string })?.detail || `HTTP ${res.statusCode}`,
        };
      }

      return res.data as UserAPIResponse<import("../types/user").WrongQuestionsByDomain[]>;
    } catch (err) {
      return { code: -1, message: (err as Error).message || "网络请求失败" };
    }
  },

  /**
   * Get a single wrong question detail.
   */
  async getWrongQuestionDetail(
    id: string,
  ): Promise<UserAPIResponse<Record<string, unknown>>> {
    try {
      const res = await Taro.request({
        url: `${API_BASE}/api/user/wrong-questions/${id}`,
        method: "GET",
        header: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
      });

      if (res.statusCode === 401) {
        clearToken();
        return { code: 401, message: "登录已过期，请重新登录" };
      }

      if (res.statusCode === 404) {
        return { code: 404, message: "错题不存在" };
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return {
          code: res.statusCode,
          message: (res.data as { detail?: string })?.detail || `HTTP ${res.statusCode}`,
        };
      }

      return res.data as UserAPIResponse<Record<string, unknown>>;
    } catch (err) {
      return { code: -1, message: (err as Error).message || "网络请求失败" };
    }
  },

  /**
   * Mark a wrong question as resolved (已掌握).
   */
  async resolveWrongQuestion(
    id: string,
  ): Promise<UserAPIResponse<{ resolved: boolean; resolved_at?: string }>> {
    try {
      const res = await Taro.request({
        url: `${API_BASE}/api/user/wrong-questions/${id}/resolve`,
        method: "POST",
        header: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
      });

      if (res.statusCode === 401) {
        clearToken();
        return { code: 401, message: "登录已过期，请重新登录" };
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return {
          code: res.statusCode,
          message: (res.data as { detail?: string })?.detail || `HTTP ${res.statusCode}`,
        };
      }

      return res.data as UserAPIResponse<{ resolved: boolean; resolved_at?: string }>;
    } catch (err) {
      return { code: -1, message: (err as Error).message || "网络请求失败" };
    }
  },

  /**
   * Retry a wrong question (re-answer with A/B/C/D options).
   * Correct answer → auto-resolved + coins; wrong answer → stays unresolved.
   */
  async retryWrongQuestion(
    id: string,
    userAnswer: string,
  ): Promise<UserAPIResponse<import("../types/user").RetryAnswerResponse>> {
    try {
      const res = await Taro.request({
        url: `${API_BASE}/api/user/wrong-questions/${id}/retry`,
        method: "POST",
        header: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        data: { user_answer: userAnswer },
      });

      if (res.statusCode === 401) {
        clearToken();
        return { code: 401, message: "登录已过期，请重新登录" };
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return {
          code: res.statusCode,
          message: (res.data as { detail?: string })?.detail || `HTTP ${res.statusCode}`,
        };
      }

      return res.data as UserAPIResponse<import("../types/user").RetryAnswerResponse>;
    } catch (err) {
      return { code: -1, message: (err as Error).message || "网络请求失败" };
    }
  },

  /**
   * Get a single quiz session detail with wrong questions.
   */
  async getSessionDetail(
    sessionId: string,
  ): Promise<UserAPIResponse<import("../types/user").SessionDetail>> {
    try {
      const res = await Taro.request({
        url: `${API_BASE}/api/user/sessions/${sessionId}`,
        method: "GET",
        header: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
      });

      if (res.statusCode === 401) {
        clearToken();
        return { code: 401, message: "登录已过期，请重新登录" };
      }

      if (res.statusCode === 404) {
        return { code: 404, message: "闯关记录不存在" };
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return {
          code: res.statusCode,
          message: (res.data as { detail?: string })?.detail || `HTTP ${res.statusCode}`,
        };
      }

      return res.data as UserAPIResponse<import("../types/user").SessionDetail>;
    } catch (err) {
      return { code: -1, message: (err as Error).message || "网络请求失败" };
    }
  },
};

// ═══════════════════════════════════════════════════════════
// AbortController polyfill
// ═══════════════════════════════════════════════════════════

interface MiniAbortSignal {
  aborted: boolean;
  onabort: (() => void) | null;
}

interface MiniAbortController {
  signal: MiniAbortSignal;
  abort(): void;
}

declare let AbortController: {
  new(): MiniAbortController;
  prototype: MiniAbortController;
} | undefined;

if (typeof AbortController === "undefined") {
  class MiniAbortSignal {
    aborted = false;
    onabort: (() => void) | null = null;
  }

  class MiniAbortController {
    signal: MiniAbortSignal;
    constructor() {
      this.signal = new MiniAbortSignal();
    }
    abort() {
      this.signal.aborted = true;
      if (this.signal.onabort) {
        this.signal.onabort();
      }
    }
  }

  (globalThis as Record<string, unknown>).AbortController = MiniAbortController;
}

// ═══════════════════════════════════════════════════════════
// TextDecoder polyfill
// ═══════════════════════════════════════════════════════════

if (typeof TextDecoder === "undefined") {
  class MiniTextDecoder {
    readonly encoding = "utf-8";
    readonly fatal = false;
    readonly ignoreBOM = false;

    decode(buffer?: ArrayBuffer | Uint8Array, _options?: { stream?: boolean }): string {
      if (!buffer) return "";
      return arrayBufferToUtf8(buffer);
    }
  }
  (globalThis as Record<string, unknown>).TextDecoder = MiniTextDecoder;
}

// ── UTF-8 ArrayBuffer → String ─────────────────────────

/**
 * Decode an ArrayBuffer into a UTF-8 string.
 *
 * Handles multi-byte sequences (2-, 3-, and 4-byte).  Falls back
 * to Latin-1 for lone continuation bytes / surrogate halves so we
 * never produce garbled output that could break JSON.parse.
 */
function arrayBufferToUtf8(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const len = bytes.length;
  const chunks: string[] = [];
  let i = 0;

  while (i < len) {
    const b0 = bytes[i];

    if (b0 < 0x80) {
      // 1-byte sequence (ASCII)
      chunks.push(String.fromCharCode(b0));
      i += 1;
    } else if (b0 >= 0xc0 && b0 < 0xe0 && i + 1 < len) {
      // 2-byte sequence
      chunks.push(String.fromCharCode(((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f)));
      i += 2;
    } else if (b0 >= 0xe0 && b0 < 0xf0 && i + 2 < len) {
      // 3-byte sequence
      chunks.push(
        String.fromCharCode(
          ((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f),
        ),
      );
      i += 3;
    } else if (b0 >= 0xf0 && b0 < 0xf8 && i + 3 < len) {
      // 4-byte sequence → surrogate pair for characters outside BMP
      const cp =
        ((b0 & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      if (cp <= 0x10ffff) {
        // Surrogate pair for JS strings (UTF-16)
        const high = ((cp - 0x10000) >> 10) + 0xd800;
        const low = ((cp - 0x10000) & 0x3ff) + 0xdc00;
        chunks.push(String.fromCharCode(high, low));
      } else {
        chunks.push(String.fromCharCode(b0)); // fallback
      }
      i += 4;
    } else {
      // Lone continuation byte or invalid lead → pass through as-is
      chunks.push(String.fromCharCode(b0));
      i += 1;
    }
  }

  return chunks.join("");
}

// ═══════════════════════════════════════════════════════════
// Quiz Generation (sync JSON endpoint for Mini Program)
// ═══════════════════════════════════════════════════════════
//
// WeChat Mini Program's wx.request cannot consume SSE streams
// (ReadableStream / chunked transfer doesn't work reliably through
// the DevTools proxy).  Instead we call a dedicated synchronous
// endpoint that runs the full generation + validation chain and
// returns a single JSON response with quiz data.

interface SSECallbacks {
  onProgress?: (event: { stage: string; message: string }) => void;
  onResult?: (result: Record<string, unknown>) => void;
  onDone?: (event: { status: string }) => void;
  onError?: (message: string, detail?: string) => void;
}

// Extend wx global types
declare const wx: {
  request(opts: {
    url: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "OPTIONS" | "HEAD" | "TRACE" | "CONNECT";
    header?: Record<string, string>;
    data?: unknown;
    timeout?: number;
    responseType?: "text" | "arraybuffer";
    success?: (res: { statusCode: number; data: unknown; header: Record<string, string> }) => void;
    fail?: (err: { errMsg: string }) => void;
  }): { abort(): void };
};

function generateQuizStreamMini(
  request: QuizGenerateRequest,
  callbacks: SSECallbacks,
): AbortController {
  const controller = new AbortController();
  let settled = false;

  const doneSettled = () => {
    if (settled) return true;
    settled = true;
    return false;
  };

  // Synthetic progress events to drive the loading page UI steps
  console.log("[Quiz] starting sync generate request");
  callbacks.onProgress?.({ stage: "generating", message: "正在分析知识点..." });

  const requestTask = wx.request({
    url: `${API_BASE}/api/quiz/generate-sync`,
    method: "POST",
    header: {
      "Content-Type": "application/json",
    },
    data: request,
    timeout: 180000,  // 3 min — LLM generation can take 60-120 s
    responseType: "arraybuffer",  // binary avoids text-truncation in DevTools proxy

    success: (res) => {
      if (controller.signal.aborted || doneSettled()) return;

      if (res.statusCode < 200 || res.statusCode >= 300) {
        console.error("[Quiz] HTTP error:", res.statusCode);
        callbacks.onError?.(
          `HTTP ${res.statusCode}`,
          "服务端返回错误状态码",
        );
        return;
      }

      // Decode response data
      const rawText =
        typeof res.data === "string" ? res.data : arrayBufferToUtf8(res.data as ArrayBuffer);

      let payload: { code: number; message: string; data?: Record<string, unknown> };
      try {
        payload = JSON.parse(rawText);
      } catch (e) {
        console.error("[Quiz] JSON parse error:", e);
        callbacks.onError?.("数据解析失败", String(e));
        return;
      }

      // Check API-level error
      if (payload.code !== 0 || !payload.data) {
        console.error("[Quiz] API error:", payload.message);
        callbacks.onError?.(payload.message || "未知错误");
        return;
      }

      // Signal validating progress, then deliver result
      callbacks.onProgress?.({ stage: "validating", message: "正在校验题目准确性..." });

      console.log("[Quiz] quiz generated:", payload.data.quiz_id);
      callbacks.onResult?.(payload.data);
    },

    fail: (err) => {
      if (controller.signal.aborted || doneSettled()) return;
      console.error("[Quiz] request failed:", err.errMsg);
      callbacks.onError?.("网络请求失败", err.errMsg);
    },
  });

  // Wire the polyfilled AbortController to wx.RequestTask.abort()
  controller.signal.onabort = () => {
    requestTask.abort();
  };

  return controller;
}

/**
 * Generate quiz questions (WeChat Mini Program — sync JSON endpoint).
 *
 * @returns An AbortController whose `.abort()` cancels the request.
 */
export function generateQuizStream(
  request: QuizGenerateRequest,
  callbacks: SSECallbacks,
): AbortController {
  return generateQuizStreamMini(request, callbacks);
}

// ═══════════════════════════════════════════════════════════
// Quiz Analysis (standard JSON)
// ═══════════════════════════════════════════════════════════

/**
 * Analyze quiz results and get learning report.
 */
export async function analyzeQuiz(
  request: QuizAnalyzeRequest,
): Promise<APIResponse<QuizResult>> {
  const res = await Taro.request({
    url: `${API_BASE}/api/quiz/analyze`,
    method: "POST",
    header: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    data: request,
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    const errorData = res.data as { message?: string } | undefined;
    throw new Error(
      errorData?.message || `HTTP ${res.statusCode}`,
    );
  }

  return res.data as APIResponse<QuizResult>;
}
