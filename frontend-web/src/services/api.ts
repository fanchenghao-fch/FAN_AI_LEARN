/**
 * API service layer for communicating with the FastAPI backend.
 *
 * Handles SSE streaming for quiz generation and standard JSON for analysis.
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

const API_BASE = "http://localhost:8000";

// ── SSE Quiz Generation ─────────────────────────────────

export interface SSECallbacks {
  onProgress?: (event: SSEProgressEvent) => void;
  onResult?: (result: SSEGenerateResult) => void;
  onDone?: (event: SSEDoneEvent) => void;
  onError?: (message: string, detail?: string) => void;
}

/**
 * Generate quiz questions via SSE streaming.
 *
 * @param request - Quiz generation parameters.
 * @param callbacks - Event callbacks for progress, result, done, and error.
 * @returns An AbortController to cancel the request.
 */
export function generateQuizStream(
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
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        callbacks.onError?.(
          `HTTP ${response.status}: ${response.statusText}`,
          errorData.detail,
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              switch (currentEvent) {
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
              // Skip unparseable lines
            }
          }
        }
      }
    })
    .catch((error: Error) => {
      if (error.name !== "AbortError") {
        callbacks.onError?.("网络请求失败", error.message);
      }
    });

  return controller;
}

// ── Quiz Analysis ────────────────────────────────────────

/**
 * Analyze quiz results and get learning report.
 *
 * @param request - Quiz analysis parameters.
 * @returns APIResponse with QuizResult data.
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
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}
