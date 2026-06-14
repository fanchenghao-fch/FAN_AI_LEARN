"""Knowledge enrichment chain — 5 Tavily tool instances + fallback chain.

Phase 1 of the 3-phase quiz generation pipeline.

Architecture:
    User input
      → AI analyses input features (keyword vs URL, simple vs complex, fresh vs stale)
      → AI selects ONE tool from 5 pre-configured variants
      → Tool executes with fixed parameters (no AI parameter override needed)
      → Result truncated to ≤3000 chars → enriched_knowledge

Fallback chain (priority order):
    1. Tavily 5 instances (langchain-tavily) — PRIMARY; requires TAVILY_API_KEY
    2. DeepSeek V4 Pro native search — FALLBACK #1; enable_search=True
    3. Firecrawl MCP / direct API — FALLBACK #2; last resort

Degradation:
    - Each fallback step has 8s timeout
    - Failure → try next fallback
    - All exhausted → silent fallback, returns None
    - Caller uses original knowledge_input when enriched_knowledge is None
"""

import asyncio
import logging
import json
import os
import ssl as _ssl

# ── SSL cert fix for macOS Python ──────────────────────────
# MUST run before importing langchain_tavily (which initializes aiohttp).
# On some macOS installations, Python's ssl module can't find the system
# root certificates.  certifi provides the standard Mozilla bundle.
try:
    import certifi
    _certs = certifi.where()
    os.environ.setdefault("SSL_CERT_FILE", _certs)
    os.environ.setdefault("REQUESTS_CA_BUNDLE", _certs)
except ImportError:
    pass

import httpx
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_tavily import TavilySearch, TavilyExtract

from app.config import settings
from app.prompts.knowledge_search import KNOWLEDGE_SEARCH_SYSTEM, KNOWLEDGE_SEARCH_USER

logger = logging.getLogger(__name__)


# ── Tool Instances (parameters FROZEN at construction) ────────

def _create_search_tools():
    """Create the 5 tool variants for AI selection.

    Each tool has a descriptive name and fixed parameters.
    AI selects by name — no parameter override needed.

    Returns empty list if TAVILY_API_KEY is not configured.
    """
    if not _is_tavily_available():
        return []

    search_quick = TavilySearch(
        name="search_quick",
        description=(
            "快速搜索常见/热门知识。适用于广泛认知的基础概念"
            "（如 'Python 变量'、'中国历史'）。返回最多 3 条基本搜索结果。"
        ),
        max_results=3,
        search_depth="basic",
        include_raw_content=False,
        include_answer=False,
    )

    search_deep = TavilySearch(
        name="search_deep",
        description=(
            "深度搜索专业/小众/新兴知识。适用于冷门专业术语、前沿技术、"
            "学术概念（如 'Harness Engineering'、'Quantum ML'）。"
            "返回最多 5 条深度搜索结果。"
        ),
        max_results=5,
        search_depth="advanced",
        include_raw_content=False,
        include_answer=False,
    )

    search_fresh = TavilySearch(
        name="search_fresh",
        description=(
            "搜索最新信息，重点关注近期动态。适用于对时效性有要求的"
            "知识点（如 '2026 年 AI 趋势'、'最新 xx 标准'）。"
            "返回最多 5 条深度搜索结果，过滤近一月信息。"
        ),
        max_results=5,
        search_depth="advanced",
        time_range="month",
        include_raw_content=False,
        include_answer=False,
    )

    extract_basic = TavilyExtract(
        name="extract_basic",
        description=(
            "提取网页基本内容。适用于新闻、博客、知乎等结构简单的页面。"
            "使用基本提取深度。"
        ),
        extract_depth="basic",
        include_images=False,
    )

    extract_deep = TavilyExtract(
        name="extract_deep",
        description=(
            "深度提取网页完整内容。适用于技术文档、学术论文(arxiv)、"
            "官方文档等需要完整上下文的页面。使用深度提取。"
        ),
        extract_depth="advanced",
        include_images=False,
    )

    return [search_quick, search_deep, search_fresh, extract_basic, extract_deep]


# ── Availability checks ───────────────────────────────────────

def _is_tavily_available() -> bool:
    """Check if Tavily API is configured and available."""
    return bool(settings.TAVILY_API_KEY)


def _is_firecrawl_available() -> bool:
    """Check if Firecrawl API key is configured."""
    return bool(os.getenv("FIRECRAWL_API_KEY", ""))


# ── Helper: truncate search results ───────────────────────────

def _extract_text_from_tool_result(result) -> str:
    """Extract readable text from a Tavily tool result.

    TavilySearch returns: dict with 'results' list, each with 'title', 'content', 'url'
    TavilyExtract returns: dict with 'results' list, each with 'url', 'raw_content'

    Returns empty string on error responses (SSL errors, API failures).
    """
    if isinstance(result, str):
        return result

    text_parts = []

    if isinstance(result, dict):
        # Detect error responses (SSL failures, API errors)
        if "error" in result and "results" not in result:
            logger.warning("Tavily tool returned error: %.200s", str(result["error"]))
            return ""

        results = result.get("results", [])
        for r in results:
            title = r.get("title", "")
            content = r.get("content", "") or r.get("raw_content", "")
            url = r.get("url", "")
            if title:
                text_parts.append(f"## {title}")
            if content:
                text_parts.append(content)
            if url and not title:
                text_parts.append(f"来源: {url}")

        failed = result.get("failed_results", [])
        if failed:
            logger.warning("Tavily extract had failed URLs: %s", failed)

    if not text_parts:
        return str(result)

    return "\n\n".join(text_parts)


def _truncate_text(text: str, max_chars: int | None = None) -> str:
    """Truncate text to max_chars, preserving whole words at boundary."""
    if max_chars is None:
        max_chars = settings.SEARCH_MAX_CHARS
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_space = truncated.rfind(" ")
    if last_space > max_chars // 2:
        truncated = truncated[:last_space]
    return truncated + "..."


# ── Fallback #1: DeepSeek V4 Pro native search ─────────────────

async def _deepseek_native_search(knowledge_input: str, timeout: float) -> str | None:
    """Use DeepSeek V4 Pro's built-in web search (enable_search=True).

    This is the primary fallback when Tavily is unavailable.

    Returns:
        Search results as text, or None on failure.
    """
    try:
        model = ChatOpenAI(
            model=settings.DEEPSEEK_PRO_MODEL,
            temperature=0.3,
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_API_BASE,
        )

        # DeepSeek's native search is enabled via extra_body
        model_with_search = model.bind(
            extra_body={"enable_search": True}
        )

        messages = [
            SystemMessage(content=(
                "你是一位知识搜索专家。用户提供了一段知识输入，请搜索互联网获取"
                "最新、最准确的相关信息。返回搜索到的关键知识内容（3000 字以内），"
                "不要返回与知识无关的内容。如果搜索无结果，请返回空。"
            )),
            HumanMessage(content=f"请搜索以下知识的相关信息：\n\n{knowledge_input}"),
        ]

        response = await asyncio.wait_for(
            model_with_search.ainvoke(messages),
            timeout=timeout,
        )

        content = response.content if hasattr(response, "content") else str(response)
        if content and len(content.strip()) > 10:
            logger.info("DeepSeek native search returned %d chars", len(content))
            return _truncate_text(content.strip())
        return None

    except asyncio.TimeoutError:
        logger.warning("DeepSeek native search timed out after %.0fs", timeout)
        return None
    except Exception as exc:
        logger.warning("DeepSeek native search failed: %s", exc)
        return None


# ── Fallback #2: Firecrawl direct API ─────────────────────────

async def _firecrawl_search(knowledge_input: str, timeout: float) -> str | None:
    """Use Firecrawl REST API as last-resort search.

    Calls Firecrawl /v1/search endpoint directly.

    Returns:
        Search results as text, or None on failure.
    """
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY", "")
    if not firecrawl_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
            response = await client.post(
                "https://api.firecrawl.dev/v1/search",
                headers={
                    "Authorization": f"Bearer {firecrawl_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "query": knowledge_input,
                    "pageOptions": {"fetchPageContent": True},
                },
            )

            if response.status_code != 200:
                logger.warning("Firecrawl API returned %d", response.status_code)
                return None

            data = response.json()
            if not data.get("success"):
                return None

            results = data.get("data", [])
            if not results:
                return None

            text_parts = []
            for r in results[:5]:  # Max 5 results
                title = r.get("title", "")
                content = r.get("markdown", "") or r.get("content", "")
                if title:
                    text_parts.append(f"## {title}")
                if content:
                    text_parts.append(content[:1500])  # Per-result cap

            text = "\n\n".join(text_parts)
            if text.strip():
                logger.info("Firecrawl search returned %d chars", len(text))
                return _truncate_text(text)
            return None

    except asyncio.TimeoutError:
        logger.warning("Firecrawl search timed out after %.0fs", timeout)
        return None
    except Exception as exc:
        logger.warning("Firecrawl search failed: %s", exc)
        return None


# ── Primary: Tavily 5-instance search ─────────────────────────

async def _tavily_search(
    knowledge_input: str,
    timeout: float,
) -> tuple[str | None, str]:
    """Run the 5-instance Tavily tool selection + execution.

    Returns:
        (enriched_text, method): enriched_text is None on failure,
        method is one of "tavily_search" / "tavily_extract" / "tavily_none".
    """
    if not _is_tavily_available():
        logger.info("Tavily API key not configured — skipping")
        return None, "tavily_unavailable"

    tools = _create_search_tools()

    if not tools:
        logger.info("Tavily tools unavailable (no API key) — skipping")
        return None, "tavily_unavailable"

    model = ChatOpenAI(
        model=settings.DEEPSEEK_PRO_MODEL,
        temperature=0.3,
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_API_BASE,
    )

    model_with_tools = model.bind_tools(tools)

    messages = [
        SystemMessage(content=KNOWLEDGE_SEARCH_SYSTEM),
        HumanMessage(
            content=KNOWLEDGE_SEARCH_USER.format(knowledge_input=knowledge_input)
        ),
    ]

    try:
        # Step 1: AI selects a tool
        ai_response = await asyncio.wait_for(
            model_with_tools.ainvoke(messages),
            timeout=timeout,
        )

        tool_calls = getattr(ai_response, "tool_calls", None)
        if not tool_calls:
            logger.info("AI chose not to call any Tavily tool")
            return None, "tavily_no_selection"

        tool_call = tool_calls[0]
        tool_name = tool_call.get("name", "unknown")
        tool_args = tool_call.get("args", {})

        logger.info("Tavily: AI selected tool '%s' with args: %s", tool_name, tool_args)

        # Step 2: Execute the selected tool
        selected_tool = next((t for t in tools if t.name == tool_name), None)
        if selected_tool is None:
            logger.warning("Tavily: unknown tool '%s' selected", tool_name)
            return None, "tavily_unknown_tool"

        tool_result = await asyncio.wait_for(
            selected_tool.ainvoke(tool_args),
            timeout=timeout,
        )

        # Step 3: Extract & truncate
        raw_text = _extract_text_from_tool_result(tool_result)
        enriched = _truncate_text(raw_text)

        if not enriched.strip():
            logger.info("Tavily search returned empty result")
            return None, "tavily_empty"

        method = "tavily_extract" if tool_name.startswith("extract_") else "tavily_search"
        logger.info("Tavily enriched: tool=%s, chars=%d, method=%s", tool_name, len(enriched), method)
        return enriched, method

    except asyncio.TimeoutError:
        logger.warning("Tavily search timed out after %.0fs", timeout)
        return None, "tavily_timeout"
    except Exception as exc:
        logger.warning("Tavily search failed: %s", exc)
        return None, "tavily_error"


# ── Main search orchestrator ──────────────────────────────────

async def enrich_knowledge(
    knowledge_input: str,
    timeout: float | None = None,
) -> tuple[str | None, str]:
    """Enrich user knowledge input via the fallback chain.

    Priority: Tavily → DeepSeek native → Firecrawl → degrade (return None).

    Args:
        knowledge_input: Raw user input (keyword or URL).
        timeout: Max seconds per search attempt (defaults to settings.SEARCH_TIMEOUT_SECONDS).

    Returns:
        (enriched_text, search_method):
          - enriched_text: enriched knowledge (≤3000 chars), or None if all failed.
          - search_method: one of "tavily_search", "tavily_extract",
            "deepseek_native", "firecrawl", "none".
          Caller should fall back to raw knowledge_input when enriched_text is None.
    """
    if timeout is None:
        timeout = settings.SEARCH_TIMEOUT_SECONDS

    if not knowledge_input or not knowledge_input.strip():
        return None, "empty_input"

    # ── Tier 1: Tavily (primary) ──
    enriched, method = await _tavily_search(knowledge_input, timeout)
    if enriched:
        return enriched, method

    # ── Tier 2: DeepSeek V4 Pro native search ──
    logger.info("Falling back to DeepSeek native search...")
    enriched = await _deepseek_native_search(knowledge_input, timeout)
    if enriched:
        return enriched, "deepseek_native"

    # ── Tier 3: Firecrawl (last resort) ──
    logger.info("Falling back to Firecrawl search...")
    enriched = await _firecrawl_search(knowledge_input, timeout)
    if enriched:
        return enriched, "firecrawl"

    # All methods exhausted
    logger.warning("All search methods exhausted for input: %.100s...", knowledge_input)
    return None, "none"
