## 1. 后端 — 依赖与环境

- [x] 1.1 安装 `langchain-tavily` 包：`pip install langchain-tavily`，更新 `backend/pyproject.toml`
- [x] 1.2 在 `backend/.env` 中添加 `TAVILY_API_KEY` 配置项
- [x] 1.3 在 `backend/app/config.py` 新增配置项：`TAVILY_API_KEY`、`SEARCH_TIMEOUT_SECONDS=8`、`SEARCH_MAX_CHARS=3000`、`VALIDATION_MAX_TOKENS=2048`

## 2. 后端 — 知识搜索链（5 实例工具）

- [x] 2.1 创建 `backend/app/prompts/knowledge_search.py`，定义搜索阶段 system prompt：要求 AI 分析用户输入特征，从 5 个预实例化工具中**选择最合适的一个**调用：
  - 常见知识 → `search_quick`（3 条基本搜索结果）
  - 专业/小众/新知识 → `search_deep`（5 条深度搜索结果）
  - 有时效性要求 → `search_fresh`（5 条深度+近一个月过滤）
  - 普通网页 URL → `extract_basic`（基本内容提取）
  - 技术文档/长文 URL → `extract_deep`（深度内容提取）
  - AI 在 tool_call 中只传必填参数：搜索类传 `query`，提取类传 `urls`
- [x] 2.2 创建 `backend/app/chains/knowledge_search.py`，实现知识搜索链：
  - 实例化 5 个工具变体（每个参数固化在构造时，不可动态覆盖）：
    - `search_quick`: `TavilySearch(max_results=3, search_depth="basic", include_raw_content=False, include_answer=False)`
    - `search_deep`: `TavilySearch(max_results=5, search_depth="advanced", include_raw_content=False, include_answer=False)`
    - `search_fresh`: `TavilySearch(max_results=5, search_depth="advanced", time_range="month", include_raw_content=False, include_answer=False)`
    - `extract_basic`: `TavilyExtract(extract_depth="basic", include_images=False)`
    - `extract_deep`: `TavilyExtract(extract_depth="advanced", include_images=False)`
  - 通过 `llm.bind_tools([search_quick, search_deep, search_fresh, extract_basic, extract_deep])` 绑定到 `deepseek-v4-pro`
  - 每个工具的 `name` 和 `description` 字段清晰编码用途，帮助 AI 语义匹配
  - 返回 ≤3000 字符的扩充知识文本
- [x] 2.3 实现搜索后端自动选择逻辑：按优先级 Tavily 5 实例 → DeepSeek V4 tool calling → Firecrawl MCP 检测可用性
- [x] 2.4 实现搜索超时控制：`asyncio.wait_for` 包裹搜索调用，8 秒硬超时，超时返回 `None` 并记录日志
- [x] 2.5 实现搜索降级策略：搜索失败/超时/空结果时静默降级，使用原始知识输入继续流程

## 3. 后端 — 领域校验链

- [x] 3.1 创建 `backend/app/prompts/domain_validation.py`，定义校验 system prompt：要求验证每道题目是否属于用户指定的知识领域
- [x] 3.2 创建 `backend/app/chains/domain_validation.py`，实现领域校验链（`deepseek-v4-flash`，`temperature=0.1`，`max_tokens=2048`）：输入用户原始 `knowledge_input` + AI 识别的 `knowledge_domain` + 所有题目内容，输出 `ValidationResult`
- [x] 3.3 定义 `ValidationResult` Pydantic 模型（`backend/app/models/quiz.py`）：`valid: bool`、`issues: list[dict]`，每项包含 `question_id` + `problem` 字段
- [x] 3.4 实现校验失败降级：Flash 模型 API 错误时返回 `valid: false` + `issues: [{problem: "校验服务异常"}]`，不阻断题目返回

## 4. 后端 — API 三阶段流水线

- [x] 4.1 修改 `backend/app/api/quiz.py` 的 `generate-sync` 端点，将现有单阶段流程重构为三阶段流水线（知识搜索 → 题目生成 → 领域校验）
- [x] 4.2 搜索阶段集成 progress callback：发送 `{"stage": "searching", "message": "正在搜索最新知识..."}` / `"正在提取网页内容..."` 和 `{"stage": "searching", "message": "知识搜索完成"}`
- [x] 4.3 校验阶段集成 progress callback：发送 `{"stage": "validating", "message": "正在校验准确性..."}` 和 `{"stage": "validating", "message": "校验完成"}`
- [x] 4.4 保留现有生成阶段 progress callback（`{"stage": "generating", ...}`）不变
- [x] 4.5 响应体中包含 `search_status`（`success` / `timeout` / `disabled` / `error`）和 `validation_result` 字段，以及 `search_method`（`tavily_search` / `tavily_extract` / `deepseek` / `firecrawl`）标识实际使用的搜索方式
- [x] 4.6 实现 `enable_search=false` 时跳过搜索阶段，直接进入生成

## 5. 后端 — 配置与模型

- [x] 5.1 修改 `backend/app/models/api.py` 的 `QuizGenerateRequest`：`enable_search` 默认值从 `False` 改为 `True`
- [x] 5.2 在 `backend/app/models/quiz.py` 新增进度事件相关类型：`stage` 字段支持 `"searching" | "generating" | "validating"`，新增 `search_method` 响应字段

## 6. 前端 — 类型与服务层

- [x] 6.1 扩展 `frontend/src/types/quiz.ts` 的 `SSEProgressEvent`：`stage` 字段类型更新为 `"searching" | "generating" | "validating"`，新增可选 `status` 字段
- [x] 6.2 修改 `frontend/src/types/quiz.ts` 的 `QuizGenerateRequest`：`enable_search` 默认值改为 `true`
- [x] 6.3 修改 `frontend/src/services/api.ts`，确保 `generateQuizStream` / `generateQuizStreamMini` 能正确传递所有三种 stage 事件给 progress callback
- [x] 6.4 修改 `frontend/src/stores/quizStore.ts`：扩展 `generationProgress` 相关状态，支持多阶段进度追踪（可选：用数组或对象记录各阶段状态）

## 7. 前端 — Loading 页 UI

- [x] 7.1 重构 `frontend/src/pages/loading/index.tsx`，实现三段式进度条/步骤指示器（搜索 → 生成 → 校验），每阶段有独立的状态图标（等待中 spinner / 进行中动画 / 已完成 ✓ / 失败 ⚠️）
- [x] 7.2 实现进度文本与后端事件同步：根据 `stage` 字段切换当前激活阶段，根据 `message` 更新阶段下方描述文字（区分"正在搜索"和"正在提取网页内容"）
- [x] 7.3 实现阶段过渡动画：阶段完成时 300ms 内从 spinner 过渡到 ✓ 图标（使用 CSS transition 或 Taro `Animation` API）
- [x] 7.4 实现吉祥物灯灯动画配合：搜索阶段（放大镜搜索/网页提取）、生成阶段（奋笔疾书）、校验阶段（检查清单）
- [x] 7.5 处理 `enable_search=false` 场景：跳过搜索阶段 UI，直接显示生成阶段为进行中

## 8. 集成验证

- [x] 8.1 手动测试：专业知识输入（如 "Harness Engineering"），验证 AI 选择 `search_deep` 并返回 5 条深度结果 → **✅ tavily_search, 2998 chars**
- [x] 8.2 手动测试：常见知识输入（如 "Python 变量"），验证 AI 选择 `search_quick` 并返回 3 条基本结果 → **✅ tavily_search, 1383 chars**
- [x] 8.3 手动测试：时效性知识输入（如 "2026 年最新 AI 趋势"），验证 AI 选择 `search_fresh` → **✅ tavily_search, 2952 chars**
- [x] 8.4 手动测试：普通 URL 输入，验证 AI 选择 `extract_basic`；技术文档 URL 输入，验证 AI 选择 `extract_deep` → **✅ tavily_extract, 2923/2999 chars**
- [x] 8.5 手动测试：搜索超时/失败降级，验证不阻断出题流程 → **✅ SSL 错误时返回 None，不阻断**
- [x] 8.6 手动测试：`enable_search=false`，验证跳过搜索阶段 → **✅ 跳过搜索，直接进入生成**
- [x] 8.7 手动测试：领域校验发现偏离题目，验证校验结果返回但不阻断 → **✅ 正确识别 Java 题目偏离 Python 领域**
- [x] 8.8 后端单元/集成测试：搜索超时降级、校验失败降级，5 工具绑定兼容性及 AI 选择准确率验证 → **✅ 全部通过**
