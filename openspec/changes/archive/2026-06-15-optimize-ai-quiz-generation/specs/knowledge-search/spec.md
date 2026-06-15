## ADDED Requirements

### Requirement: 多实例工具联网搜索
系统 SHALL 在生成题目之前，使用 `langchain-tavily` 包的 5 个预实例化工具执行联网搜索，AI 通过**选择工具实例**来间接选择搜索策略（而非动态修改参数），获取最新、最准确的相关知识内容，扩充原始知识输入。

**5 个预实例化工具**：

| 工具名 | 类型 | 参数（实例化时固化） | 适用场景 |
|--------|------|-------------------|---------|
| `search_quick` | TavilySearch | `max_results=3`, `search_depth="basic"` | 常见/热门知识 |
| `search_deep` | TavilySearch | `max_results=5`, `search_depth="advanced"` | 专业/小众/新知识 |
| `search_fresh` | TavilySearch | `max_results=5`, `search_depth="advanced"`, `time_range="month"` | 时效性要求高的知识 |
| `extract_basic` | TavilyExtract | `extract_depth="basic"` | 简单网页（新闻、博客） |
| `extract_deep` | TavilyExtract | `extract_depth="advanced"` | 长文/技术文档/学术论文 |

#### Scenario: 常见知识点触发快速搜索
- **WHEN** 用户提交常见/热门知识文本输入（如 "Python 基础语法"、"中国历史"），且 `enable_search` 为 `true`
- **THEN** AI 识别知识为常见类型，选择调用 `search_quick` 工具，传入 `query` 参数，返回 3 条基本搜索结果，然后继续进入题目生成阶段

#### Scenario: 专业知识触发深度搜索
- **WHEN** 用户提交小众/专业/新兴知识文本输入（如 "Harness Engineering"），且 `enable_search` 为 `true`
- **THEN** AI 识别知识罕见或需要深度上下文，选择调用 `search_deep` 工具，传入 `query` 参数，返回 5 条深度搜索结果，然后继续进入题目生成阶段

#### Scenario: 时效性知识触发新鲜搜索
- **WHEN** 用户提交包含时间限定词的知识输入（如 "2026 年最新 AI 趋势"、"近期 xx 标准"），且 `enable_search` 为 `true`
- **THEN** AI 识别知识对时效性有要求，选择调用 `search_fresh` 工具，传入 `query` 参数，返回过滤了近一个月信息的搜索结果

#### Scenario: URL 输入触发基本网页提取
- **WHEN** 用户提交普通网页 URL（如新闻、博客链接），且 `enable_search` 为 `true`
- **THEN** AI 识别输入为网页链接且页面结构简单，选择调用 `extract_basic` 工具，传入 `urls=[URL]` 参数，返回页面基本内容

#### Scenario: 技术文档 URL 触发深度提取
- **WHEN** 用户提交长文/技术文档/学术论文 URL（如 arxiv 链接），且 `enable_search` 为 `true`
- **THEN** AI 识别内容复杂度高，选择调用 `extract_deep` 工具，传入 `urls=[URL]` 参数，返回页面完整内容

#### Scenario: 关键词+URL 混合输入
- **WHEN** 用户同时提交知识描述和参考链接（如 "请根据 https://example.com/article 的内容出题"），且 `enable_search` 为 `true`
- **THEN** AI 自主判断调用顺序：先选择 `extract_basic` 或 `extract_deep` 提取 URL 内容，若信息不足再选择 `search_deep` 搜索补充知识

#### Scenario: AI 按工具描述语义匹配
- **WHEN** AI 分析用户输入后需要选择工具
- **THEN** AI 根据每个工具的 `name` 和 `description` 字段进行语义匹配，选择最合适的工具实例。AI 在 tool_call 中只需传入必填参数（搜索工具传 `query`，提取工具传 `urls`），无需设置任何可选参数

#### Scenario: 搜索超时降级
- **WHEN** 联网搜索耗时超过 8 秒
- **THEN** 系统终止搜索，使用原始知识输入继续出题流程，并在响应中标记搜索状态为 `timeout`

#### Scenario: 搜索失败降级
- **WHEN** 联网搜索因网络或 API 错误失败
- **THEN** 系统记录错误日志，使用原始知识输入继续出题流程，不在响应中向用户暴露错误详情。搜索后端降级链：Tavily 多实例工具（首选）→ DeepSeek V4 Pro tool calling 原生搜索（备选第一方案）→ Firecrawl MCP（备选第二方案），系统在初始化时按此顺序检测可用性并自动选择。

#### Scenario: 搜索后端自动选择
- **WHEN** 系统初始化知识搜索链
- **THEN** 按优先级检测可用的搜索后端：首选 5 个 Tavily 工具实例（需 `TAVILY_API_KEY` 已配置且 `langchain-tavily` 已安装），备选第一方案 DeepSeek V4 Pro tool calling 原生搜索，备选第二方案 Firecrawl MCP。选择第一个可用的后端。

#### Scenario: 用户关闭搜索
- **WHEN** `enable_search` 为 `false`
- **THEN** 系统跳过搜索阶段，直接进入题目生成流程

### Requirement: 搜索进度通知
系统 SHALL 在 API 响应中返回搜索阶段的进度信息，使前端能展示阶段性状态。

#### Scenario: 搜索进度事件
- **WHEN** 搜索阶段开始（AI 选择了 `search_quick`/`search_deep`/`search_fresh` 中任一个）
- **THEN** 系统返回进度事件 `{"stage": "searching", "message": "正在搜索最新知识..."}`

#### Scenario: 网页提取进度事件
- **WHEN** AI 选择了 `extract_basic` 或 `extract_deep` 提取网页内容
- **THEN** 系统返回进度事件 `{"stage": "searching", "message": "正在提取网页内容..."}`

#### Scenario: 搜索完成事件
- **WHEN** 任何工具实例调用成功完成
- **THEN** 系统返回进度事件 `{"stage": "searching", "message": "知识获取完成"}` 并进入生成阶段

### Requirement: 搜索内容长度限制
系统 SHALL 限制搜索扩充后的知识内容长度，确保不超出 LLM 上下文窗口。

#### Scenario: 搜索结果截断
- **WHEN** 搜索结果或网页提取文本超过 3000 字符
- **THEN** 系统截断至 3000 字符，优先保留搜索结果中的 `content` 摘要（TavilySearch 系列）或 `raw_content` 正文前部（TavilyExtract 系列）

### Requirement: 国内外用户兼顾
系统 SHALL 兼容国内外用户的知识搜索需求，Tavily API 自动根据查询语言优化搜索源。

#### Scenario: 中文知识点搜索
- **WHEN** 用户输入中文知识点
- **THEN** AI 选择对应的搜索工具时仅传 `query`参数，不设定 `include_domains` 限制，Tavily API 自动优化中文搜索源

#### Scenario: 国外/英文知识点搜索
- **WHEN** 用户输入英文或国外相关知识点
- **THEN** AI 选择对应的搜索工具时仅传 `query`参数，不设定 `exclude_domains` 限制，Tavily API 自动覆盖国际搜索源
