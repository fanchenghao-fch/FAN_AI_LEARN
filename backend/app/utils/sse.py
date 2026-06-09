"""SSE (Server-Sent Events) streaming utilities."""

import json
from typing import AsyncGenerator, Any


async def sse_event(
    event: str,
    data: Any,
) -> str:
    """Format a single SSE event string.

    Args:
        event: Event type name (e.g., 'progress', 'result', 'done').
        data: JSON-serializable data payload.

    Returns:
        Formatted SSE event string.
    """
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def progress_event(stage: str, message: str) -> str:
    """Create a progress SSE event.

    Args:
        stage: Progress stage (e.g., 'searching', 'generating', 'validating').
        message: Human-readable progress message.

    Returns:
        SSE 'progress' event string.
    """
    return await sse_event("progress", {"stage": stage, "message": message})


async def result_event(data: Any) -> str:
    """Create a result SSE event.

    Args:
        data: The result data to send.

    Returns:
        SSE 'result' event string.
    """
    return await sse_event("result", data)


async def done_event(metadata: dict | None = None) -> str:
    """Create a done SSE event.

    Args:
        metadata: Optional metadata (e.g., token counts).

    Returns:
        SSE 'done' event string.
    """
    return await sse_event("done", metadata or {"status": "completed"})


async def error_event(message: str, detail: str | None = None) -> str:
    """Create an error SSE event.

    Args:
        message: Error message.
        detail: Optional detailed error info.

    Returns:
        SSE 'error' event string.
    """
    payload = {"message": message}
    if detail:
        payload["detail"] = detail
    return await sse_event("error", payload)
