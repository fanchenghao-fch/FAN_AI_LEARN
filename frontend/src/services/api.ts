/**
 * API service layer for communicating with the FastAPI backend.
 *
 * Handles SSE streaming for quiz generation and standard JSON for analysis.
 *
 * NOTE: WeChat Mini Program runtime does not provide fetch, AbortController,
 * ReadableStream, or TextDecoder. Polyfills are included below — active only
 * when the native API is missing (mini-program), transparent in H5/browsers.
 *
 * SSE streaming in mini-program uses wx.request + enableChunked + onChunkReceived
 * which is fundamentally different from the browser ReadableStream model.
 */

import type {
  QuizGenerateRequest,
  QuizAnalyzeRequest,
  APIResponse,
  QuizResult,
  SSEProgressEvent,
  SSEGenerateResult,
  SSEDoneEvent,
} from "../types/quiz";

// ── Platform Detection ──────────────────────────────────

const IS_MINI_PROGRAM = typeof fetch === "undefined";

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
// TextDecoder polyfill (mini-program only)
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
// fetch polyfill (mini-program, for non-streaming requests)
// ═══════════════════════════════════════════════════════════

if (IS_MINI_PROGRAM) {
  // WeChat Mini Program RequestTask (returned by wx.request)
  interface WxRequestTask {
    abort(): void;
    onChunkReceived?(cb: (res: { data: ArrayBuffer }) => void): void;
  }

  // Extend wx global types
  declare const wx: {
    request(opts: {
      url: string;
      method?: "GET" | "POST" | "PUT" | "DELETE" | "OPTIONS" | "HEAD" | "TRACE" | "CONNECT";
      header?: Record<string, string>;
      data?: unknown;
      enableChunked?: boolean;
      responseType?: "text" | "arraybuffer";
      success?: (res: { statusCode: number; data: unknown; header: Record<string, string> }) => void;
      fail?: (err: { errMsg: string }) => void;
    }): WxRequestTask;
  };

  // Minimal fetch-like response for non-streaming requests (e.g. analyzeQuiz)
  const miniFetch = (
    input: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ): Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    json(): Promise<unknown>;
    body: null;
    headers: { get(name: string): string | null };
  }> => {
    return new Promise((resolve, reject) => {
      // wx.request auto-serializes objects; for fetch compat we parse string body back
      let data: unknown = undefined;
      if (init?.body) {
        try {
          data = JSON.parse(init.body);
        } catch {
          data = init.body;
        }
      }

      const requestTask = wx.request({
        url: input,
        method: (init?.method || "GET") as "POST",
        header: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
        data,
        responseType: "text",
        success: (res) => {
          const headersMap = res.header || {};
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: "",
            json: async () => {
              if (typeof res.data === "string") {
                try { return JSON.parse(res.data); } catch { return res.data; }
              }
              return res.data;
            },
            body: null,
            headers: {
              get(name: string): string | null {
                const key = name.toLowerCase();
                for (const [k, v] of Object.entries(headersMap)) {
                  if (k.toLowerCase() === key) return v as string;
                }
                return null;
              },
            },
          });
        },
        fail: (err) => {
          reject(new Error(err.errMsg || "Network request failed"));
        },
      });

      // Minimal signal support (our polyfilled AbortController uses onabort)
      if (init?.headers?.["x-abort-task"]) {
        // Signal wiring happens externally via the returned MiniAbortController
      }
      // Store on the promise so callers can wire abort
      (requestTask as WxRequestTask & { __task?: WxRequestTask }).__task = requestTask;
    });
  };

  (globalThis as Record<string, unknown>).fetch = miniFetch;
}

// ── SSE Buffer Parser (shared) ─────────────────────────

interface SSECallbacks {
  onProgress?: (event: SSEProgressEvent) => void;
  onResult?: (result: SSEGenerateResult) => void;
  onDone?: (event: SSEDoneEvent) => void;
  onError?: (message: string, detail?: string) => void;
}

interface SSEParseState {
  currentEvent: string;
}

/**
 * Parse accumulated SSE text buffer, calling callbacks for complete events.
 * Returns the state with updated `currentEvent` so subsequent calls continue
 * dispatching to the correct event type.
 */
function parseSSEBuffer(
  text: string,
  callbacks: SSECallbacks,
  state: SSEParseState,
): string {
  const lines = text.split("\n");
  // The last line may be incomplete — keep it for the next chunk
  const remainder = lines.pop() || "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      state.currentEvent = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      const raw = line.slice(6);
      try {
        const parsed = JSON.parse(raw);
        switch (state.currentEvent) {
          case "progress":
            callbacks.onProgress?.(parsed as SSEProgressEvent);
            break;
          case "result":
            callbacks.onResult?.(parsed as SSEGenerateResult);
            break;
          case "done":
            callbacks.onDone?.(parsed as SSEDoneEvent);
            break;
          case "error":
            callbacks.onError?.(parsed.message, parsed.detail);
            break;
        }
      } catch {
        // Unparseable JSON — skip silently (could be a partial chunk artifact)
      }
    }
  }

  return remainder;
}

// ═══════════════════════════════════════════════════════════
// Quiz Generation (SSE streaming)
// ═══════════════════════════════════════════════════════════

const API_BASE = "http://localhost:8000";

// ── Web Implementation (native fetch + ReadableStream) ──

export interface SSECallbacksExport extends SSECallbacks {}

function generateQuizStreamWeb(
  request: QuizGenerateRequest,
  callbacks: SSECallbacks,
): AbortController {
  const controller = new AbortController();

  fetch(`${API_BASE}/api/quiz/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(request),
    signal: controller.signal as unknown as AbortSignal,
  })
    .then(async (response) => {
      if (controller.signal.aborted) return;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        callbacks.onError?.(
          `HTTP ${response.status}: ${response.statusText}`,
          (errorData as { detail?: string }).detail,
        );
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError?.("无法读取响应流");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      const state: SSEParseState = { currentEvent: "" };

      while (true) {
        if (controller.signal.aborted) {
          reader.cancel().catch(() => {});
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        buffer = parseSSEBuffer(buffer, callbacks, state);
      }
    })
    .catch((error: Error) => {
      if (error.name !== "AbortError") {
        callbacks.onError?.("网络请求失败", error.message);
      }
    });

  return controller;
}

// ── Mini-Program Implementation (wx.request + enableChunked) ──

function generateQuizStreamMini(
  request: QuizGenerateRequest,
  callbacks: SSECallbacks,
): AbortController {
  const controller = new AbortController();

  let buffer = "";
  const state: SSEParseState = { currentEvent: "" };
  let settled = false; // prevent double-calling onError/onDone

  const doneSettled = () => {
    if (settled) return true;
    settled = true;
    return false;
  };

  const requestTask = wx.request({
    url: `${API_BASE}/api/quiz/generate`,
    method: "POST",
    header: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    data: request,
    enableChunked: true,
    responseType: "arraybuffer",

    onChunkReceived: (res: { data: ArrayBuffer }) => {
      if (controller.signal.aborted) {
        requestTask.abort();
        return;
      }

      // Decode the ArrayBuffer chunk to a UTF-8 string
      const text = arrayBufferToUtf8(res.data);
      buffer += text;

      // Parse any complete SSE events out of the buffer
      buffer = parseSSEBuffer(buffer, callbacks, state);
    },

    success: (res) => {
      if (controller.signal.aborted || doneSettled()) return;

      // Check HTTP status
      if (res.statusCode < 200 || res.statusCode >= 300) {
        callbacks.onError?.(
          `HTTP ${res.statusCode}`,
          "服务端返回错误状态码",
        );
        return;
      }

      // Flush any remaining data in the buffer (chunked case)
      if (buffer.trim()) {
        buffer = parseSSEBuffer(buffer + "\n", callbacks, state);
      }

      // Fallback: if no chunks arrived (enableChunked unsupported by old
      // base library), process the full response body from res.data
      if (!buffer && res.data) {
        const fullText =
          typeof res.data === "string"
            ? res.data
            : arrayBufferToUtf8(res.data as ArrayBuffer);
        parseSSEBuffer(fullText + "\n", callbacks, state);
      }
    },

    fail: (err) => {
      if (controller.signal.aborted || doneSettled()) return;
      callbacks.onError?.("网络请求失败", err.errMsg);
    },
  });

  // Wire the polyfilled AbortController to wx.RequestTask.abort()
  controller.signal.onabort = () => {
    requestTask.abort();
  };

  return controller;
}

// ── Public API: platform-dispatching ────────────────────

/**
 * Generate quiz questions via SSE streaming.
 *
 * @returns An AbortController whose `.abort()` cancels the request.
 */
export function generateQuizStream(
  request: QuizGenerateRequest,
  callbacks: SSECallbacks,
): AbortController {
  if (IS_MINI_PROGRAM) {
    return generateQuizStreamMini(request, callbacks);
  }
  return generateQuizStreamWeb(request, callbacks);
}

// ═══════════════════════════════════════════════════════════
// Quiz Analysis (standard JSON, non-streaming)
// ═══════════════════════════════════════════════════════════

/**
 * Analyze quiz results and get learning report.
 */
export async function analyzeQuiz(
  request: QuizAnalyzeRequest,
): Promise<APIResponse<QuizResult>> {
  const response = await fetch(`${API_BASE}/api/quiz/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { message?: string }).message ||
        `HTTP ${response.status}`,
    );
  }

  return response.json() as Promise<APIResponse<QuizResult>>;
}
