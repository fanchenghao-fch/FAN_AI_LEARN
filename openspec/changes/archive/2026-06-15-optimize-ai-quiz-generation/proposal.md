## Why

AI 大模型的训练数据有时效限制，当用户输入的知识点超出模型训练数据范围（如最新的技术概念、近期事件、小众专业术语如 "Harness Engineering"），DeepSeek 模型会产出错误题目——将知识点映射到无关领域、或基于过时信息生成错误答案。需要在出题流程中引入**联网搜索扩充知识**和**知识领域归属校验**两个环节，确保生成的题目准确、及时、领域正确。

## What Changes

- **新增：知识联网搜索链（Knowledge Enrichment Chain）** — 出题前通过 `langchain-tavily` 的 `TavilySearch`（关键词搜索）+ `TavilyExtract`（网页内容提取）两个工具联网获取知识。两个工具绑定到 DeepSeek V4 Pro，AI 自主决策调用哪个工具及参数（根据用户输入是 URL 还是关键词、知识复杂程度、国内外地域等动态调整 `search_depth`/`max_results`/`time_range`）。若 Tavily 不可用，自动降级至 DeepSeek V4 Pro tool calling 原生搜索或 Firecrawl MCP
- **新增：知识领域归属校验链（Domain Validation Chain）** — 出题后由低成本 Flash 模型验证生成的题目是否确实属于用户指定的知识领域，发现偏离则标记问题
- **修改：出题 API 端点（`POST /api/quiz/generate-sync`）** — 在出题流程中串联搜索→生成→校验三个阶段，错误处理与超时保护
- **修改：前端 Loading 页** — 展示三段式进度（正在搜索最新知识... → 正在生成题目... → 正在校验准确性...），每阶段有独立的视觉状态
- **修改：前端 `QuizGenerateRequest` 类型** — `enable_search` 默认值从 `false` 改为 `true`

## Capabilities

### New Capabilities

- `knowledge-search`: 在 AI 出题前通过联网搜索获取最新知识内容，扩充用户输入
- `domain-validation`: 生成题目后验证题目是否属于目标知识领域，防止领域偏离
- `multi-stage-generation-ui`: Loading 页展示搜索→生成→校验的三段式进度，每阶段可独立展示完成/进行中/失败状态

### Modified Capabilities

<!-- 无现有 specs，均为新增能力 -->

## Impact

- **后端**：新增 `backend/app/chains/knowledge_search.py`、`backend/app/chains/domain_validation.py`；修改 `backend/app/api/quiz.py`（串联多阶段流程）；修改 `backend/app/config.py`（新增搜索超时等配置项）；新增 `backend/app/prompts/knowledge_search.py`、`backend/app/prompts/domain_validation.py`
- **前端**：修改 `frontend/src/pages/loading/index.tsx`（三段式进度 UI）；修改 `frontend/src/services/api.ts`（`generateQuizStream` 增加 search/validate 进度事件）；修改 `frontend/src/types/quiz.ts`（新增进度事件类型）；修改 `frontend/src/stores/quizStore.ts`（支持多阶段进度状态）
- **依赖**：新增 `langchain-tavily` 包（需 `pip install langchain-tavily`），提供 `TavilySearch` + `TavilyExtract` 两个 LangChain Tool。需配置 `TAVILY_API_KEY`。备选方案为 DeepSeek V4 tool calling 原生搜索或 Firecrawl MCP
- **API 兼容**：`POST /api/quiz/generate-sync` 响应结构不变，但生成耗时增加（搜索阶段约 3-8 秒）
