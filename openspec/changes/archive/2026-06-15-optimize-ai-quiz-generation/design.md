## Context

当前出题流程（`POST /api/quiz/generate-sync`）为单阶段流水线：用户输入 → 出题链（DeepSeek Pro）→ 校验链（DeepSeek Flash）→ 返回 JSON。当用户输入的知识点超出 DeepSeek 训练数据时限（截止 2025 年 5 月），模型会基于过时信息或错误联想生成不准确题目。此外，现有校验链只检查题目格式和答案正确性，不验证题目是否属于用户指定的知识领域。

本项目使用 `langchain-openai`（OpenAI 兼容协议）调用 DeepSeek API。方案使用 LangChain 官方包 `langchain-tavily` 提供的 **TavilySearch** + **TavilyExtract** 两个工具进行联网搜索，并提供给 AI 自主决策调用时机和参数；出题后增加领域校验步骤。

## Goals / Non-Goals

**Goals:**
- 在出题前通过 TavilySearch + TavilyExtract 多实例化工具联网获取最新知识，AI 自主选择调用哪个实例
- 在出题后用 Flash 模型验证题目与目标知识领域的匹配度
- 前端 Loading 页展示搜索→生成→校验三段式进度
- 搜索失败/超时时不影响核心出题流程（优雅降级）
- 新增 `langchain-tavily` 依赖（`TavilySearch` + `TavilyExtract`），需 `TAVILY_API_KEY`

**Non-Goals:**
- 不实现全自动 RAG 向量知识库（属于 Phase 2 范围）
- 不修改题目校验链（`quiz_validation.py`）的现有逻辑
- 不修改答题流程、结果分析、用户系统
- 不新增数据库表

## Decisions

### Decision 1: 多实例化工具，AI 通过选择工具来"调参"

**核心思路**：不给 AI 暴露可变参数，而是**预实例化多个参数固化的工具变体**，AI 只需从工具列表中**选择调用哪个**——把"调参"问题转化为"选工具"问题。

**为什么不用动态参数覆盖**：
LangChain Tool 理论支持 AI 在 tool_call 的 `args` 中覆盖实例化参数，但这要求 AI 在每个调用中正确推断并填写参数值：
- 参数填写错误（如专业话题误填 `search_depth="basic"`）→ 搜索结果质量下降
- 参数遗漏（如忘记设 `time_range`）→ 不会报错，但结果含过时信息
- DeepSeek V4 的 tool calling 在"参数决策"场景下的可靠性未经验证

多实例化方案让 AI 只做它擅长的**语义匹配**（"这个知识是专业的还是简单的？"→ 选对应的工具名），不要求它生成精确的参数值。

**实例化策略**：

```python
from langchain_tavily import TavilySearch, TavilyExtract
from langchain_openai import ChatOpenAI

# ── TavilySearch 变体 ──
search_quick = TavilySearch(
    name="search_quick",           # 工具名编码了用途
    description="快速搜索常见/热门知识。适用于广泛认知的基础概念（如 'Python 变量'、'中国历史'）。",
    max_results=3,
    search_depth="basic",
    include_raw_content=False,
    include_answer=False,
)

search_deep = TavilySearch(
    name="search_deep",
    description="深度搜索专业/小众/新兴知识。适用于冷门专业术语、前沿技术、学术概念（如 'Harness Engineering'、'Quantum ML'）。",
    max_results=5,
    search_depth="advanced",
    include_raw_content=False,
    include_answer=False,
)

search_fresh = TavilySearch(
    name="search_fresh",
    description="搜索最新信息，重点关注近期动态。适用于对时效性有要求的知识点（如 '2026 年 AI 趋势'、'最新 xx 标准'）。",
    max_results=5,
    search_depth="advanced",
    time_range="month",            # 实例化时固定时间范围
    include_raw_content=False,
    include_answer=False,
)

# ── TavilyExtract 变体 ──
extract_basic = TavilyExtract(
    name="extract_basic",
    description="提取网页基本内容。适用于新闻、博客等结构简单的页面。",
    extract_depth="basic",
    include_images=False,
)

extract_deep = TavilyExtract(
    name="extract_deep",
    description="深度提取网页完整内容。适用于技术文档、学术论文、长文本等需要完整上下文的页面。",
    extract_depth="advanced",
    include_images=False,
)

# ── 全部绑定，AI 根据语义选择 ──
llm = ChatOpenAI(model="deepseek-v4-pro", temperature=0.7)
llm_with_tools = llm.bind_tools([
    search_quick,
    search_deep,
    search_fresh,
    extract_basic,
    extract_deep,
])
```

**AI 决策规则（写入 system prompt）**：

| 输入特征 | 应选择的工具 | 选择依据 |
|---------|------------|---------|
| 常见/基础知识点（如 "Python 入门"） | `search_quick` | 知识广为人知，快速搜索即可获取准确信息 |
| 小众/专业/新兴知识（如 "Harness Engineering"） | `search_deep` | 需要深度搜索才能获取足够的上下文 |
| 有时效性要求（如 "2026 最新 xxx"） | `search_fresh` | 需要过滤旧信息，只获取近期内容 |
| 输入是普通网页 URL（新闻、博客） | `extract_basic` | 页面结构简单，基本提取即可 |
| 输入是长文/技术文档 URL | `extract_deep` | 需要完整上下文，深度提取 |

**AI 实际调用示例**：
```python
# "Python 列表推导式" → AI 调用: search_quick({query: "Python 列表推导式"})
# "Harness Engineering CI/CD" → AI 调用: search_deep({query: "Harness Engineering CI/CD"})
# "2026 年 AI 最新进展" → AI 调用: search_fresh({query: "2026 年 AI 最新进展"})
# "https://zhuanlan.zhihu.com/p/xxx" → AI 调用: extract_basic({urls: ["https://zhuanlan.zhihu.com/p/xxx"]})
# "https://arxiv.org/abs/xxx" → AI 调用: extract_deep({urls: ["https://arxiv.org/abs/xxx"]})
```

**各工具调用时 AI 只需传两个必填参数**：`query`（搜索工具）或 `urls`（提取工具），无需设置任何可选参数。

**替代方案考虑**：
- ❌ **单实例+动态参数覆盖**：上一版方案，依赖 AI 正确生成参数值，可靠性风险高
- ❌ **单一 TavilySearch 工具**：无法处理 URL 输入
- ✅ **DeepSeek 原生 tool calling（备选第一方案）**：若 Tavily 不可用，降级为 DeepSeek 原生搜索（仅关键词搜索）
- ❌ **Firecrawl MCP（备选第二方案）**：项目已有 Firecrawl MCP，作为最后兜底

### Decision 2: 三段式流水线架构

**选择**：在 `generate-sync` 端点内顺序执行三个阶段，每阶段通过 progress callback 通知前端。

```
用户输入
  │
  ├─ [Phase 1: Knowledge Enrichment]  ← 🆕 联网搜索扩充知识
  │   Engine: 5 个预实例化工具（search_quick/search_deep/search_fresh/extract_basic/extract_deep）
  │   AI 决策: 根据输入特征选择调用哪个工具（选工具 = 选参数）
  │   Fallback: DeepSeek V4 tool calling → Firecrawl MCP
  │   Timeout: 8s
  │   Output: enriched_knowledge (string, ≤3000 chars)
  │
  ├─ [Phase 2: Quiz Generation]   ← 现有逻辑
  │   Model: deepseek-v4-pro
  │   Input: enriched_knowledge (or raw input if search failed)
  │   Output: QuizOutput (title + domain + questions)
  │
  ├─ [Phase 3: Domain Validation] ← 🆕 领域归属校验
  │   Model: deepseek-v4-flash
  │   Temperature: 0.1
  │   Output: ValidationResult
  │
  └─ Response: quiz data + validation result
```

**替代方案考虑**：
- ❌ **并行搜索+生成**：搜索和生成并行执行看似节省时间，但生成需要搜索结果作为输入，无法并行。即使并行，搜索结果到达时生成可能已经基于错误信息开始了。
- ❌ **搜索作为可选增强**：单阶段架构（搜索直接嵌入 generation prompt）更简单，但无法独立跟踪搜索进度，前端无法展示阶段性 UI。

### Decision 3: 搜索降级策略

**选择**：搜索作为"尽力而为"增强，失败时静默降级，不向用户暴露错误。

- 超时：8 秒硬超时，`asyncio.wait_for` 包裹搜索调用
- 异常：捕获所有异常，记录日志后使用原始输入继续
- 空结果：搜索结果为空字符串时，使用原始输入继续
- 错误不影响 API 响应 code（始终返回 code=0）

### Decision 4: 前端进度状态模型

**选择**：扩展 `SSEProgressEvent` 类型，使用 `stage` 字段区分三个阶段。

```typescript
// types/quiz.ts 扩展
interface SSEProgressEvent {
  stage: "searching" | "generating" | "validating";
  message: string;
  status?: "pending" | "active" | "done" | "error";
}
```

现有 `loading/index.tsx` 已支持从 `quizStore.generationProgress` 读取进度事件，只需扩展 UI 渲染逻辑。

### Decision 5: `enable_search` 默认值修改

**选择**：`enable_search` 默认值从 `false` 改为 `true`。

- `QuizGenerateRequest.enable_search` 后端默认值 → `True`
- 前端首页默认开启搜索开关
- 用户可手动关闭（如对搜索质量不满意）

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| **出题耗时增加**：搜索阶段增加 3-8 秒 | 前端三段式进度让用户感知等待价值；搜索超时 8s 硬限制 |
| **Tavily API 额外成本**：Tavily 有独立计费（每月 1000 次免费搜索/提取，超出后按量计费） | 用户可手动关闭搜索；出题是低频操作，免费额度通常足够；AI 对简单知识选择 `search_quick` 可降低深度搜索消耗 |
| **Tavily API 不可用**：API Key 未配置或服务异常 | 降级为 DeepSeek V4 Pro tool calling 原生搜索（备选第一方案），再降级为 Firecrawl MCP（备选第二方案） |
| **AI 工具选择不精确**：AI 可能对专业知识误选 `search_quick`（但不会导致严重错误） | 后果仅限于搜索结果偏浅而非错误；system prompt 中明确指示选择依据；每个工具的 `description` 字段帮助 AI 正确匹配 |
| **前端改动范围**：Loading 页现有逻辑已有一定复杂度 | 保持现有 SSE 进度事件架构不变，仅扩展 stage 类型和 UI 渲染 |
| **Flash 模型校验准确性**：低成本模型可能在领域判断上不够精准 | 校验仅作"标记"不做"阻断"；校验结果随题目返回，由前端决定是否警告用户 |

## Open Questions

1. `langchain-tavily` 包是否需要额外安装（`pip install langchain-tavily`），还是项目中已有？需确认 `TAVILY_API_KEY` 已在 `backend/.env` 中配置。
2. DeepSeek V4 Pro 绑定 5 个工具后，能否根据 `name` 和 `description` 正确区分并选择合适的工具？`bind_tools` 传递多个工具后 DeepSeek 的 tool selection 准确率需要在开发阶段验证。
3. 降级优先级：首选 **TavilySearch + TavilyExtract（langchain-tavily）** → 备选第一方案 **DeepSeek V4 Pro tool calling 原生搜索** → 备选第二方案 **Firecrawl MCP**。
