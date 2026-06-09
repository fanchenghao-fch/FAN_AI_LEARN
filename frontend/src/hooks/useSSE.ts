/**
 * React Hook for SSE (Server-Sent Events) stream management.
 *
 * Wraps the generateQuizStream API with React lifecycle management,
 * automatically cleaning up the stream on unmount.
 */

import { useRef, useCallback } from "react";
import { generateQuizStream } from "../services/api";
import type { QuizGenerateRequest, SSECallbacks } from "../services/api";

export function useSSE() {
  const controllerRef = useRef<AbortController | null>(null);

  /**
   * Start a quiz generation SSE stream.
   * Automatically aborts any existing stream before starting a new one.
   */
  const startStream = useCallback(
    (request: QuizGenerateRequest, callbacks: SSECallbacks) => {
      // Abort existing stream
      if (controllerRef.current) {
        controllerRef.current.abort();
      }

      controllerRef.current = generateQuizStream(request, callbacks);
    },
    [],
  );

  /**
   * Cancel the active SSE stream.
   */
  const cancelStream = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  return {
    startStream,
    cancelStream,
    isStreaming: controllerRef.current !== null,
  };
}
