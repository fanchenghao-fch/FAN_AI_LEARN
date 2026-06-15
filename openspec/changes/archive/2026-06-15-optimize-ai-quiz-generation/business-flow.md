# 优化 AI 出题 — 业务流程图

## 总体流程

```mermaid
flowchart TD
    A["👤 用户输入<br/>关键词 / URL / 混合"] --> B{"enable_search<br/>是否开启？"}

    B -->|"✅ 开启（默认）"| C["🔍 Phase 1: 知识搜索"]
    B -->|"❌ 关闭"| J["✍️ Phase 2: 题目生成"]

    subgraph SEARCH["🔍 Phase 1: 知识搜索（≤8s 超时）"]
        C --> C0{"搜索后端<br/>可用性检测"}
        C0 -->|"首选"| C1["5 个 Tavily 工具实例<br/>langchain-tavily"]
        C0 -->|"备选 1"| C2["DeepSeek V4 Pro<br/>tool calling 原生搜索"]
        C0 -->|"备选 2"| C3["Firecrawl MCP"]

        C1 --> D["AI 分析用户输入"]

        D --> D1{"输入特征？"}

        D1 -->|"常见知识"| E1["🤖 选 search_quick<br/>max_results=3, basic"]
        D1 -->|"专业知识"| E2["🤖 选 search_deep<br/>max_results=5, advanced"]
        D1 -->|"时效知识"| E3["🤖 选 search_fresh<br/>5 results + time_range=month"]
        D1 -->|"普通 URL"| E4["🤖 选 extract_basic<br/>extract_depth=basic"]
        D1 -->|"技术文档 URL"| E5["🤖 选 extract_deep<br/>extract_depth=advanced"]

        E1 --> H{"搜索是否<br/>成功？"}
        E2 --> H
        E3 --> H
        E4 --> H
        E5 --> H
        C2 --> H
        C3 --> H

        H -->|"✅ 成功"| I1["截断至 ≤3000 字符<br/>→ enriched_knowledge"]
        H -->|"⏱️ 超时"| I2["记录日志 → 静默降级"]
        H -->|"❌ 失败"| I2

        I1 --> K["📡 SSE: searching → 完成"]
        I2 --> K
    end

    K --> J

    subgraph GEN["✍️ Phase 2: 题目生成"]
        J --> J1["DeepSeek V4 Pro<br/>输入：enriched_knowledge<br/>（或原始输入，若搜索降级）"]
        J1 --> J2["生成 title + domain + questions"]
        J2 --> L["📡 SSE: generating → 完成"]
    end

    L --> M["✅ Phase 3: 领域校验"]

    subgraph VAL["✅ Phase 3: 领域校验"]
        M --> M1["DeepSeek V4 Flash<br/>temperature=0.1"]
        M1 --> M2{"可用？"}
        M2 -->|"✅"| M3["校验题目领域归属"]
        M2 -->|"❌"| M4["valid: false<br/>issues: 校验服务异常"]
        M3 --> M5{"领域匹配？"}
        M5 -->|"✅"| M6["valid: true"]
        M5 -->|"⚠️"| M7["valid: false + issues"]
    end

    M6 --> N["📡 SSE: validating → 完成"]
    M7 --> N
    M4 --> N

    N --> O["📦 返回响应"]

    subgraph RESPONSE["📦 API 响应"]
        O --> O1["quiz_data"]
        O --> O2["search_status"]
        O --> O3["search_tool: search_quick/deep/fresh/extract_basic/deep"]
        O --> O4["validation_result"]
    end

    O1 --> P["🎨 前端 Loading 页"]
    O2 --> P
    O3 --> P
    O4 --> P

    P --> Q["📋 答题页"]

    style A fill:#e1f5fe
    style Q fill:#c8e6c9
    style SEARCH fill:#fff3e0,stroke:#ff9800
    style GEN fill:#e8f5e9,stroke:#4caf50
    style VAL fill:#fce4ec,stroke:#e91e63
    style RESPONSE fill:#f3e5f5,stroke:#9c27b0
```

## 多实例工具 — AI 选择逻辑

```mermaid
flowchart LR
    INPUT["用户输入"] --> ANALYZE["AI 分析输入特征"]

    ANALYZE --> IS_URL{"是 URL？"}

    IS_URL -->|"是"| URL_SIMPLE{"页面类型？"}
    URL_SIMPLE -->|"新闻/博客"| EB["extract_basic<br/>extract_depth=basic"]
    URL_SIMPLE -->|"技术文档/论文"| ED["extract_deep<br/>extract_depth=advanced"]

    IS_URL -->|"否（关键词）"| COMPLEXITY{"知识复杂度？"}
    COMPLEXITY -->|"常见/基础"| SQ["search_quick<br/>3 results, basic"]
    COMPLEXITY -->|"专业/小众/新"| IS_FRESH{"有时效要求？"}
    IS_FRESH -->|"是"| SF["search_fresh<br/>5 results, advanced, month"]
    IS_FRESH -->|"否"| SD["search_deep<br/>5 results, advanced"]
```

## 5 个工具实例速查

| 工具名 | 类型 | 固化参数 | AI 调用示例 |
|--------|------|---------|-----------|
| `search_quick` | TavilySearch | `max_results=3`, `search_depth="basic"` | `search_quick({query: "Python 变量"})` |
| `search_deep` | TavilySearch | `max_results=5`, `search_depth="advanced"` | `search_deep({query: "Harness Engineering CI/CD"})` |
| `search_fresh` | TavilySearch | `max_results=5`, `search_depth="advanced"`, `time_range="month"` | `search_fresh({query: "2026 AI 趋势"})` |
| `extract_basic` | TavilyExtract | `extract_depth="basic"` | `extract_basic({urls: ["https://news.example.com"]})` |
| `extract_deep` | TavilyExtract | `extract_depth="advanced"` | `extract_deep({urls: ["https://arxiv.org/..."]})` |

## 前端 Loading 页状态机

```mermaid
stateDiagram-v2
    [*] --> searching: enable_search=true
    [*] --> generating: enable_search=false

    state searching {
        [*] --> search_start: 正在搜索最新知识...
        [*] --> extract_start: 正在提取网页内容...
        search_start --> done: 知识获取完成 ✓
        extract_start --> done: 提取完成 ✓
        search_start --> skip: 超时/失败 ⚠️
        extract_start --> skip: 超时/失败 ⚠️
    }

    searching --> generating: 进入生成
    searching --> generating: 静默降级进入生成

    generating --> generating_done: 生成完成 ✓

    generating_done --> validating: 进入校验

    validating --> validating_done: 校验完成 ✓
    validating --> validating_error: 校验异常 ⚠️

    validating_done --> [*]: 进入答题页
    validating_error --> [*]: 返回题目+异常标记
```
