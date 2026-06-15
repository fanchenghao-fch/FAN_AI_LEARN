# 阿拉灯神丁 — 功能说明文档

> **版本：** v1.4.3  
> **更新日期：** 2026-06-14  
> **平台：** 微信小程序  
> **代号释义：** "阿拉灯神丁" = AI（阿拉）+ 灯灯（灯神/吉祥物）+ 学习（神丁/园丁）

---

## 目录

1. [产品概述](#一产品概述)
2. [核心学习流程](#二核心学习流程)
3. [AI 智能出题引擎](#三ai-智能出题引擎)
4. [答题闯关系统](#四答题闯关系统)
5. [学习结果分析](#五学习结果分析)
6. [用户成长系统](#六用户成长系统)
7. [个人中心与历史](#七个人中心与历史)
8. [错题管理系统](#八错题管理系统)
9. [视觉设计系统](#九视觉设计系统)
10. [技术架构](#十技术架构)
11. [API 接口清单](#十一api-接口清单)
12. [微信小程序适配](#十二微信小程序适配)

---

## 一、产品概述

「阿拉灯神丁」是一款 **AI 驱动的情景闯关学习小程序**。用户输入任意知识点主题（如"牛顿力学"、"Python 装饰器"），AI 自动生成个性化选择题/判断题，用户实时答题闯关，完成后获得 AI 学习分析报告。

### 1.1 核心价值

| 价值点 | 说明 |
|--------|------|
| **输入即学** | 无需预制题库，输入任何知识点即可生成专属题目 |
| **联网增强** | 联网搜索最新知识，弥补 AI 训练数据时效缺口 |
| **即时反馈** | 每道题答完即刻显示对错判断 + AI 知识讲解 |
| **游戏化激励** | 连击系统 + 生命值 + 金币/经验 + 等级成长 |
| **智能诊断** | AI 分析掌握度雷达图 + 知识要点总结 + 学习建议 |
| **错题复习** | 自动收录错题，支持重新作答和标记已掌握 |

### 1.2 产品页面地图

```
首页（知识点输入）
  │
  └─→ Loading 页（AI 出题进度：搜索→生成→校验）
        │
        └─→ 答题页（闯关）
              │
              └─→ 结果页（分析报告）
                    │
                    ├─→ 个人中心 → 学习历史 → 闯关详情
                    │            → 错题本   → 错题重做
                    │            → 关于页面
                    │
                    └─→ 再来一局（返回首页）
```

---

## 二、核心学习流程

### 2.1 首页（知识点输入）

**页面路径：** `pages/index/index`

| 功能 | 说明 |
|------|------|
| 知识点输入 | 支持文本输入 / 粘贴，`<Textarea>` 组件 |
| 题目数量选择 | 5 / 10 / 15 / 20 题 |
| 题目类型选择 | 选择题 / 判断题 / 混合 |
| 难度选择 | 简单 / 中等 / 困难 / 自动 |
| 联网搜索开关 | 默认开启，可手动关闭 |
| 吉祥物展示 | 「灯灯」mascot 组件，支持多种情绪（happy / thinking / encouraging） |
| 近期闯关卡片 | 登录用户展示最近闯关记录，点击可跳转详情 |

### 2.2 Loading 页（AI 出题进度）

**页面路径：** `pages/loading/index`

三段式进度展示，与后端流水线实时同步：

| 阶段 | 图标 | 说明 |
|------|------|------|
| ① 搜索 | spinner → ✓ | 联网搜索最新知识（Tavily 5 实例策略） |
| ② 生成 | spinner → ✓ | AI 生成定制题目（DeepSeek V4 Pro） |
| ③ 校验 | spinner → ✓/⚠️ | 校验题目领域相关性（DeepSeek V4 Flash） |

**增强特性：**
- 搜索阶段 6 秒后自动推进至生成阶段（避免 UI 卡顿）
- 生成阶段每 4 秒轮换提示消息（"正在分析知识点结构..." → "正在构思有趣的题目..." → ...）
- 底部轮播"灯灯冷知识"趣味提示
- 支持取消生成，返回首页

### 2.3 答题闯关

详见 [四、答题闯关系统](#四答题闯关系统)

### 2.4 通关结果

详见 [五、学习结果分析](#五学习结果分析)

---

## 三、AI 智能出题引擎

### 3.1 三段式出题流水线

```
用户输入: "量子纠缠"
  │
  ├─ [Phase 1: 知识搜索]  ← 🆕 v1.4.3
  │   联网获取最新相关知识
  │   ⏱ 超时 8s，失败静默降级
  │   ↓ enriched_knowledge
  │
  ├─ [Phase 2: 题目生成]
  │   AI 生成 10 道选择题/判断题
  │   含题干、4 选项、正确答案、详细解析
  │   ↓ questions
  │
  ├─ [Phase 3: 领域校验]  ← 🆕 v1.4.3
  │   验证每道题是否属于用户指定领域
  │   校验失败不阻断，仅标记 issues
  │   ↓ validation_result
  │
  └─ Response: { quiz_id, title, questions, search_status, search_method, validation_result }
```

### 3.2 知识联网搜索链

**设计理念：** 5 实例多工具策略 — 预实例化参数固化的工具变体，AI 仅需语义选择最合适的工具，将"调参"问题转化为"选工具"问题。

| 工具名 | 类型 | 固化参数 | 适用场景 |
|--------|------|---------|----------|
| `search_quick` | TavilySearch | `max_results=3`, `depth="basic"` | 常见/基础知识 |
| `search_deep` | TavilySearch | `max_results=5`, `depth="advanced"` | 专业/小众/新兴知识 |
| `search_fresh` | TavilySearch | `max_results=5`, `time_range="month"` | 有时效性要求的知识 |
| `extract_basic` | TavilyExtract | `depth="basic"` | 普通网页 URL 内容提取 |
| `extract_deep` | TavilyExtract | `depth="advanced"` | 技术文档/论文 URL 提取 |

**降级链（自动容错）：**

```
首选: Tavily 5 实例（需 TAVILY_API_KEY）
  ↓ 失败/超时/无结果
备选 1: DeepSeek V4 Pro tool calling 原生搜索
  ↓ 失败
备选 2: Firecrawl MCP
  ↓ 失败
静默降级: 使用原始输入继续出题（不影响 API 响应）
```

### 3.3 领域校验链

- **模型：** DeepSeek V4 Flash（`temperature=0.1`，低成本快速校验）
- **校验内容：** 每道题目是否属于用户指定的知识领域
- **输出：** `valid: bool` + `issues: [{question_id, problem}]`
- **容错：** 校验失败不阻断题目返回，仅标记问题

### 3.4 AI 模型使用

| 环节 | 模型 | 用途 |
|------|------|------|
| 题目生成 | DeepSeek V4 Pro | 主生成模型，高质量出题 |
| 领域校验 | DeepSeek V4 Flash | 低成本快速校验 |
| 结果分析 | DeepSeek V4 Pro | AI 学习分析报告 |
| 知识搜索工具选择 | DeepSeek V4 Pro | 语义匹配最合适的搜索工具 |

### 3.5 防幻觉机制

- 提示词硬约束：**禁止引用外部材料**、**禁止编造知识点**
- 所有题目必须基于 `enriched_knowledge`（搜索到的真实知识）或用户原始输入
- 无搜索结果时明确标记 `search_status: "disabled"` 或 `"timeout"`

---

## 四、答题闯关系统

### 4.1 题目类型

| 类型 | 说明 | UI 形态 |
|------|------|---------|
| 选择题（choice） | 4 个选项（A/B/C/D），单选 | 纵向选项按钮列表 |
| 判断题（truefalse） | 正确/错误，二选一 | 横向双按钮（绿色✓ / 红色✗） |

### 4.2 游戏机制

| 机制 | 说明 |
|------|------|
| **生命值** | 初始 3 条命（💚 药水图标），答错扣 1 条，归零游戏结束 |
| **连击系统** | 连续答对累计 combo 计数，`combo ≥ 3` 时显示红色 combo badge |
| **最高连击** | 记录本次闯关最高连击数，结果页展示 |
| **计时器** | 每题独立计时，记录总用时 |
| **答题反馈** | 答对→绿色高亮 + ✓ 图标 + 知识讲解；答错→红色高亮 + 正确答案 + 解析 |
| **生命耗尽** | 展示闯关完成横幅，当前得分即最终得分 |

### 4.3 答题交互

```
选择答案
  │
  ├─ 答对:
  │   combo++
  │   选项绿色高亮 + ✓
  │   吉祥物欢呼 🎉
  │   展示知识讲解卡片（绿色）
  │
  ├─ 答错:
  │   lives--
  │   combo 归零
  │   选项红色高亮
  │   正确答案绿色高亮
  │   展示解析卡片（红色）
  │   吉祥物鼓励 💪
  │
  └─ "下一题"按钮出现 → 点击前进
```

### 4.4 导航功能

| 按钮 | 位置 | 功能 |
|------|------|------|
| 退出 | 左上角 ✕ | 返回首页（确认弹窗） |
| 上一题 | 左下角 | 返回上一题重新作答 |
| 跳过 | 右下角 | 跳过当前题目 |
| 下一题 | 底部 | 答完当前题后前进 |

---

## 五、学习结果分析

### 5.1 成绩展示

| 元素 | 说明 |
|------|------|
| **等级徽章** | S/A/B/C/D 六级，圆形彩色徽章 |
| **分数圆环** | CSS 纯实现，正确数/总题数，彩色边框 |
| **正确率** | 百分比显示 |
| **用时统计** | 总答题用时（秒） |
| **最高连击** | 本局最高连续答对数 |

### 5.2 AI 分析报告

| 模块 | 内容 |
|------|------|
| **掌握度雷达图** | 横向进度条，按知识点维度分析掌握程度（0-100%） |
| **知识要点总结** | 编号列表，AI 提炼的核心知识点 |
| **学习建议** | AI 个性化学习建议（靶心图标卡片） |

### 5.3 错题回顾

| 元素 | 说明 |
|------|------|
| 题目原文 | 带序号展示 |
| 答案对比 | 红色（你的答案）vs 绿色（正确答案） |
| 详细解析 | AI 生成的解题思路和知识点说明 |
| 全部答对 | 展示庆祝空状态（★ 图标） |

### 5.4 奖励展示（登录用户）

| 奖励类型 | 说明 |
|----------|------|
| 金币 | coins_earned，CSS 金币图标 |
| 经验值 | experience_earned，紫色 EXP 图标 |
| 每日首闯加成 | 🔥 火焰标记 |
| 升级提示 | 🎉 新等级 + 称号 |

### 5.5 行动按钮

| 按钮 | 功能 |
|------|------|
| 再来一局 | 返回首页开始新闯关 |
| 分享成绩 | 分享功能（即将上线） |
| 查看我的学习记录 | 跳转个人中心（登录用户） |
| 立即登录 | 引导匿名用户登录（未登录状态） |

---

## 六、用户成长系统

### 6.1 积分体系

| 积分项 | 金币 | 条件 |
|--------|------|------|
| 基础奖励 | +10 | 每次闯关 |
| 正确奖励 | +2 | 每道答对的题目 |
| 连击加成 | +5 | combo ≥ 5 |
| 超级连击 | +15 | combo ≥ 10 |
| 每日首闯 | +20 | 当天首次闯关 |
| 单次上限 | 100 | 单次闯关最多获得 |
| 错题重做 | +2 | 重做错题答对时 |

### 6.2 等级体系

| 等级 | 称号 | 所需经验 |
|------|------|----------|
| Lv1 | 初学萌新 | 0 – 99 |
| Lv2 | 知识学徒 | 100 – 299 |
| Lv3 | 学习达人 | 300 – 599 |
| Lv4 | 百科高手 | 600 – 999 |
| Lv5 | 博学大师 | 1000+ |

经验值 = 金币 1:1 映射，自动累积升级。

### 6.3 每日打卡

- **自动签到：** 登录用户首次闯关自动打卡
- **连续打卡：** 统计连续打卡天数
- **手动打卡：** `POST /api/user/checkin` 端点支持

---

## 七、个人中心与历史

### 7.1 个人中心（pages/mine）

| 模块 | 内容 |
|------|------|
| 用户卡片 | CSS 圆形头像 + 昵称 + 等级徽章 |
| 经验进度条 | 当前经验 / 升级所需经验 + 百分比 |
| 金币展示 | CSS 金币图标 + 当前金币数 |
| 统计三连 | 累计闯关 / 正确率 / 连续打卡天数 |
| 菜单导航 | 学习历史 → / 错题本 → / 关于 → |
| 退出登录 | 带确认弹窗（防止误触） |
| 未登录状态 | Mascot 鼓励 + "去登录"按钮 |

### 7.2 学习历史（pages/history）

| 功能 | 说明 |
|------|------|
| 分页列表 | `GET /api/user/history?page=&page_size=` 分页加载 |
| 无限滚动 | 滚动到底部自动加载下一页 |
| 卡片信息 | 标题（优先显示原始输入）、领域标签、得分、正确率、用时、日期 |
| 点击跳转 | 点击卡片进入闯关详情页 |
| 空状态 | 无记录时展示引导 |

### 7.3 闯关记录详情（pages/sessiondetail）

| 信息 | 来源 |
|------|------|
| 标题 / 原始输入 | `knowledge_input` 字段 |
| 知识领域 | `domain` 字段 |
| 得分 / 正确率 | `score` / `total_questions` |
| 用时 / 最高连击 | `total_time` / `max_combo` |
| 金币奖励 | `coins_earned` |
| 错题列表 | 答案对比（红色 vs 绿色） |

### 7.4 关于页面（pages/about）

App 产品介绍信息。

---

## 八、错题管理系统

### 8.1 错题本（pages/wrongbook）

| 功能 | 说明 |
|------|------|
| Tab 筛选 | 全部 / 待复习 / 已掌握 三个 Tab |
| 分组展示 | 按知识领域（domain）分组 |
| 错题预览 | 题目内容摘要 + 状态 badge（待复习/已掌握） + 日期 |
| 点击跳转 | 进入错题详情页 |

### 8.2 错题详情（pages/wrongdetail）

| 模块 | 说明 |
|------|------|
| 题目展示 | 完整题目内容 |
| 答案对比 | 红色（错误答案）vs 绿色（正确答案） |
| 解析卡片 | AI 生成的详细解析 |
| 标记已掌握 | `POST /api/user/wrong-questions/{id}/resolve` |
| 重新作答 | 展示原始 A/B/C/D 选项按钮 |

### 8.3 错题重做交互

点击选项后的四种视觉状态：

| 状态 | 样式 | 触发条件 |
|------|------|----------|
| `selected` | 蓝色高亮边框 | 点击选项，等待 API 响应 |
| `correct` | 绿色 + ✓ 图标 | API 返回答对 |
| `wrong` | 红色背景 | API 返回答错 |
| `hint-correct` | 绿色边框提示 | 答错后高亮显示正确答案 |

答对自动展示"已掌握"横幅 + toast 提示 "+2 金币"。答错展示鼓励 toast。

### 8.4 向后兼容

无 `options` 字段的旧错题（v1.3.0 之前录入）仍可通过"标记为已掌握"按钮手动处理。

---

## 九、视觉设计系统

### 9.1 Campus Comic 校园漫画风格

全局统一的漫画风格设计语言，通过 CSS 变量系统实现。

**核心元素：**

| 元素 | 说明 |
|------|------|
| 粗黑边框 | 所有卡片、按钮使用 `border: 2-3px solid var(--black)` |
| 漫画阴影 | `box-shadow: 4px 4px 0 var(--black)` 偏移实色阴影 |
| 圆角 | 统一 `border-radius` 体系（sm / md / lg） |
| 彩色条带 | 分区标题左侧彩色竖条（section-bar） |
| 圆点分隔线 | 虚线 + 三个点装饰 |
| 药水生命值 | CSS 药水瓶图标（绿色液体） |
| 金币图标 | CSS 纯实现金色圆形图标 |
| 分数圆环 | CSS 圆环替代 SVG |
| 灯泡提示 | CSS 灯泡形状 Tips 图标 |

**色彩体系：**

| 变量 | 色值 | 用途 |
|------|------|------|
| `--black` | #2D2D2D | 边框、文字 |
| `--blue` | #4A90D9 | 主色调、进度条 |
| `--green` | #7EC882 | 正确、生命值 |
| `--green-light` | #E8F5E9 | 正确卡片背景 |
| `--red` | #E06C6C | 错误、combo |
| `--red-light` | #FFEBEE | 错误卡片背景 |
| `--yellow` | #F5C842 | 金币、等级 |
| `--yellow-light` | #FFF8E1 | 提示卡片背景 |
| `--orange` | #F09B4A | 每日首闯标记 |
| `--purple` | #9B7EC4 | 经验值 |
| `--gray` | #9E9E9E | 次要文字 |
| `--gray-light` | #E0E0E0 | 背景、未激活 |
| `--font-display` | 标题字体 | 粗体展示文字 |
| `--font-comic` | 漫画字体 | 分数、等级 |

### 9.2 全局布局架构

```
.app-phone-frame              ← 手机框容器（campus comic 风格）
  └─ .app-phone-content       ← 内容区（padding: 32px 22px 20px）
       │                         右侧 22px 为漫画阴影预留空间
       └─ .{page-name}-page   ← 页面专属类（仅在需要时添加）
```

**关键规则：**
- 页面类**不覆盖** `padding-right`（统一由 `.app-phone-content` 提供）
- 卡片/按钮**不使用** `margin-right` hack（避免 flex stretch 溢出）
- 所有全宽元素显式声明 `box-sizing: border-box; max-width: 100%`

### 9.3 吉祥物「灯灯」

**组件：** `components/Mascot.tsx`

| 属性 | 类型 | 说明 |
|------|------|------|
| `mood` | `"happy" \| "thinking" \| "encouraging"` | 情绪状态，控制表情和动画 |
| `size` | `number` | 尺寸（px），默认 80 |

**情绪映射：**

| 场景 | 情绪 | 触发 |
|------|------|------|
| 首页等待 | thinking | 用户输入知识点的思考状态 |
| 答对题目 | happy | 正确率 ≥ 60% |
| 答错题目 | encouraging | 正确率 < 60% |
| Loading 等待 | thinking | 出题各阶段 |

---

## 十、技术架构

### 10.1 技术栈

```
┌─────────────────────────────────────────────────┐
│                    前端 (Frontend)                │
│  Taro 4.2 + React 18 + TypeScript + SCSS        │
│  Zustand (状态管理)                               │
│  Taro.request / wx.request (网络层)               │
└────────────────────┬────────────────────────────┘
                     │ HTTP JSON
┌────────────────────▼────────────────────────────┐
│                   后端 (Backend)                  │
│  FastAPI + Uvicorn                               │
│  LangChain + LangChain-OpenAI                    │
│  LangChain-Tavily (联网搜索)                      │
│  SQLAlchemy 2.0 async + asyncmy (MySQL)          │
│  PyJWT (认证)                                     │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│                  AI 服务                          │
│  DeepSeek V4 Pro (题目生成 + 分析)                │
│  DeepSeek V4 Flash (领域校验)                     │
│  Tavily Search API (联网搜索)                     │
│  Firecrawl MCP (备选搜索)                         │
└─────────────────────────────────────────────────┘
```

### 10.2 前端架构

```
frontend/src/
├── app.config.ts          # 全局配置（页面路由 10 个、窗口样式）
├── app.scss               # 全局样式（色板变量、组件样式、动画）
├── app.tsx                # 应用入口（启动连通性检测）
├── components/
│   └── Mascot.tsx         # 吉祥物「灯灯」组件
├── services/
│   └── api.ts             # 网络层（Taro.request + wx.request）
├── stores/
│   ├── quizStore.ts       # 答题状态管理（Zustand）
│   ├── uiStore.ts         # UI 状态管理（生成中、loading 等）
│   └── userStore.ts       # 用户认证状态管理（token、user、login）
├── types/
│   ├── quiz.ts            # 答题类型定义
│   └── user.ts            # 用户类型定义
└── pages/
    ├── index/             # 首页（知识点输入）
    ├── loading/           # AI 出题加载页
    ├── quiz/              # 答题闯关页
    ├── result/            # 通关结果 + 分析报告
    ├── login/             # 微信一键登录
    ├── mine/              # 个人中心
    ├── history/           # 学习历史
    ├── sessiondetail/     # 闯关记录详情
    ├── wrongbook/         # 错题本
    ├── wrongdetail/       # 错题详情
    └── about/             # 关于页面
```

### 10.3 后端架构

```
backend/app/
├── main.py                    # 应用入口（FastAPI + CORS + 自动迁移）
├── config.py                  # 配置管理（环境变量）
├── database.py                # 数据库连接（async SQLAlchemy）
├── api/
│   ├── quiz.py                # 题目 API
│   │   ├── POST /generate-sync   # 出题（同步 JSON）
│   │   └── POST /analyze         # 答题结果分析
│   ├── auth.py                # 认证 API
│   │   ├── POST /wechat-login    # 微信登录
│   │   ├── POST /mock-login      # 开发环境 Mock 登录
│   │   └── GET  /me              # 当前用户信息
│   └── user.py                # 用户 API
│       ├── GET  /stats                     # 学习统计
│       ├── GET  /history                   # 分页历史
│       ├── GET  /wrong-questions           # 错题列表
│       ├── GET  /wrong-questions/{id}      # 错题详情
│       ├── POST /wrong-questions/{id}/resolve  # 标记已掌握
│       ├── POST /wrong-questions/{id}/retry    # 错题重做
│       ├── GET  /sessions/{id}             # 闯关详情
│       └── POST /checkin                   # 打卡
├── chains/
│   ├── knowledge_search.py    # 🆕 知识联网搜索链（5 实例 Tavily）
│   ├── domain_validation.py   # 🆕 领域校验链
│   ├── quiz_generation.py     # 题目生成链
│   ├── quiz_validation.py     # 题目校验链
│   └── result_analysis.py     # 结果分析链
├── prompts/
│   ├── knowledge_search.py    # 🆕 搜索工具选择提示词
│   ├── domain_validation.py   # 🆕 领域校验提示词
│   └── quiz_generation.py     # 出题提示词
├── models/
│   ├── api.py                 # 请求/响应 Pydantic 模型
│   ├── quiz.py                # 题目 Pydantic 模型
│   ├── user_orm.py            # SQLAlchemy ORM 模型（5 张表）
│   └── user_schemas.py        # 用户 Pydantic 模型
└── services/
    ├── auth.py                # JWT 签发/验证 + 微信 code2session
    └── points.py              # 积分/经验/等级计算
```

### 10.4 数据库表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户表 | id, openid, nickname, avatar_url, created_at |
| `quiz_session_records` | 闯关记录 | id, user_id, quiz_id, title, knowledge_input, domain, score, total_questions, accuracy, total_time, max_combo, coins_earned |
| `wrong_questions` | 错题表 | id, user_id, session_id, question_id, content, user_answer, correct_answer, explanation, options(JSON), resolved, domain |
| `check_ins` | 打卡记录 | id, user_id, check_in_date, consecutive_days |
| `level_configs` | 等级配置 | id, name, title, min_exp, max_exp |

---

## 十一、API 接口清单

### 11.1 Quiz 核心 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `POST` | `/api/quiz/generate-sync` | 同步出题（三段式流水线） | 否 |
| `POST` | `/api/quiz/analyze` | 提交答案 → AI 分析报告 | 可选 |

**generate-sync 请求：**
```json
{
  "knowledge_input": "量子纠缠",
  "question_count": 10,
  "difficulty": "auto",
  "question_types": ["choice"],
  "enable_search": true
}
```

**generate-sync 响应新增字段（v1.4.3）：**
```json
{
  "code": 0,
  "quiz_id": "xxx",
  "title": "量子纠缠 - AI 闯关",
  "questions": [...],
  "search_status": "success",
  "search_method": "tavily_search",
  "validation_result": { "valid": true, "issues": [] }
}
```

### 11.2 认证 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `POST` | `/api/auth/wechat-login` | 微信小程序登录 | 否 |
| `POST` | `/api/auth/mock-login` | 开发环境 Mock 登录 | 否 |
| `GET` | `/api/auth/me` | 获取当前用户信息 | Bearer Token |

### 11.3 用户 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `GET` | `/api/user/stats` | 学习统计数据 | Bearer Token |
| `GET` | `/api/user/history` | 分页历史记录 | Bearer Token |
| `GET` | `/api/user/wrong-questions` | 错题列表（支持筛选） | Bearer Token |
| `GET` | `/api/user/wrong-questions/{id}` | 错题详情 | Bearer Token |
| `POST` | `/api/user/wrong-questions/{id}/resolve` | 标记错题已掌握 | Bearer Token |
| `POST` | `/api/user/wrong-questions/{id}/retry` | 重新作答错题 | Bearer Token |
| `GET` | `/api/user/sessions/{id}` | 闯关记录详情 | Bearer Token |
| `POST` | `/api/user/checkin` | 手动打卡 | Bearer Token |

### 11.4 双鉴权模式

| 依赖函数 | 返回类型 | 行为 |
|----------|----------|------|
| `get_current_user` | `User` | 强制认证，无 token → 401 |
| `get_optional_user` | `User \| None` | 可选认证，无 token → None（匿名继续） |

`POST /api/quiz/analyze` 使用 `get_optional_user`，实现登录/匿名双通道：
- **登录用户：** 自动创建 session 记录 + 错题 + 打卡 + 发放奖励
- **匿名用户：** 正常返回分析结果，不持久化

---

## 十二、微信小程序适配

### 12.1 网络层适配

| 问题 | 解决方案 |
|------|----------|
| 小程序无 `fetch` | 统一使用 `Taro.request()` |
| 小程序无 `AbortController` | 自建 polyfill |
| SSE 流不可用 | 后端新增 `/generate-sync` 同步 JSON 端点 |
| `wx.request` 默认 60s 超时 | `timeout: 180000`（3 分钟） |
| DevTools 代理截断 JSON | `responseType: "arraybuffer"` 避免文本截断 |
| UTF-8 多字节解码 | 自建 `arrayBufferToUtf8()` 解码器（支持 4-byte） |

### 12.2 WXSS 兼容

| 问题 | 解决方案 |
|------|----------|
| `calc()` 导致白屏 | 编译产物中零 `calc()`，使用固定值 |
| `overflow-x: visible` 不支持 | 使用 `overflow-x: hidden` |
| `word-break: break-word` 不生效 | 全部改为 `word-break: break-all` |
| `inline-flex + width:100%` 溢出 | 全宽按钮覆写 `display: flex` |
| `* { box-sizing }` 不可靠 | 卡片显式添加 `box-sizing: border-box` |
| Flex `min-height: auto` 阻止收缩 | 页面容器显式 `min-height: 0` |
| U+2026（`…`）渲染异常 | 替换为 ASCII `...` |

### 12.3 原生组件替换

| 替换项 | 原因 |
|--------|------|
| `<Button>` → `<View> + onClick` | Taro Button 渲染为微信原生 button，强制样式无法覆盖 |
| SVG → CSS 图形 | 微信小程序 SVG 支持受限 |
| Emoji → CSS 图标 | 部分 emoji 在小程序中渲染不一致 |

### 12.4 启动检测

应用启动时（`app.tsx` 的 `useLaunch`），自动 `GET /api/auth/me` 检测后端连通性：
- **成功：** 正常进入应用
- **失败：** 弹窗提示"后端服务不可用"，用户可选择继续等待或退出

---

## 附录 A：配置项参考

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `DEEPSEEK_API_KEY` | (必填) | DeepSeek API 密钥 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek API 地址 |
| `TAVILY_API_KEY` | (可选) | Tavily 搜索 API 密钥 |
| `SEARCH_TIMEOUT_SECONDS` | `8` | 搜索超时时间 |
| `SEARCH_MAX_CHARS` | `3000` | 搜索结果最大字符数 |
| `VALIDATION_MAX_TOKENS` | `2048` | 领域校验最大 token |
| `MYSQL_HOST` / `MYSQL_PORT` | (必填) | MySQL 连接信息 |
| `JWT_SECRET` | (必填) | JWT 签名密钥 |
| `WECHAT_APPID` / `WECHAT_SECRET` | (可选) | 微信小程序凭证 |

## 附录 B：启动方式

**后端：**
```bash
cd backend
./start.sh          # 自动检测 poetry/pip 环境
# 或手动：
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8001
```

**前端：**
```bash
cd frontend
npm run dev:weapp   # 微信小程序开发模式
```

## 附录 C：测试覆盖

| 测试文件 | 用例数 | 覆盖内容 |
|----------|--------|----------|
| `test_points.py` | 27 | 金币计算、经验、打卡天数、等级升级 |
| `test_auth.py` | 16 | mock-login、wechat-login、me、JWT、CORS |
| `test_user_api.py` | 36+ | stats、history、wrong-questions CRUD、retry、checkin |
| `test_analyze_with_user.py` | 12+ | 登录/匿名用户 analyze 全链路 |
| **合计** | **91+** | 全部通过 |

---

> 📝 本文档基于 v1.4.3 代码现状编写，完整记录了 MVP v1.0.0 至 v1.4.3 所有已实现功能。  
> 版本演进详情见 [VERSION.md](VERSION.md)。  
> 联网搜索功能设计细节见 [openspec/specs/optimize-ai-quiz-generation/](openspec/specs/optimize-ai-quiz-generation/)。
