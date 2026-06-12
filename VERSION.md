# 阿拉灯神丁 — 版本说明

## v1.4.1 — 手动测试 13 项问题修复 + 闯关记录详情页

**发布日期：** 2026-06-12  
**平台：** 微信小程序

---

### 一、Bug 修复（13 项手动测试问题）

| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 1 | 答题页 title 显示"闯关结果" | 后端 `quiz.py` analyze 端点硬编码 `title="闯关结果"` | `QuizAnalyzeRequest` 新增 `title` 字段，前端传入 `session.title` |
| 2 | "上一题"和"跳过"按钮位置颠倒 | 前端 `quiz/index.tsx` action-row 中按钮顺序错误 | 交换两个按钮位置 |
| 3 | 题干文字被截断 | `.question-card` 无高度限制，flex 布局挤压 | 添加 `max-height: 180px; overflow-y: auto` |
| 4 | 解析文字被截断 | `.explanation-card` 同上 | 添加 `max-height: 140px; overflow-y: auto` |
| 5 | 答题完成后出现多余滚动条 | `.quiz-page` 仅 `overflow-x: hidden`，未限制纵向 | 改为 `overflow: hidden` |
| 6 | 结果页各区块间距过大 | margin/padding 过宽松 | 压缩 `result-score-ring`、`result-stats` 间距 |
| 7 | 结果页缺少灯灯气泡文案 | 仅渲染 Mascot 组件，无对话气泡 | 新增 `speech-bubble`，根据正确率展示对应鼓励文案 |
| 8 | 结果页奖励卡片对齐问题 | `.result-reward-val` 无最小宽度 | 添加 `min-width: 120px` |
| 9 | 个人中心页出现滚动条 | mine 页面内容溢出 | ScrollView 添加 `enhanced` + `showScrollbar={false}`，CSS 间距全面压缩 |
| 10 | 历史记录 title 显示"闯关结果" | 同 #1 | 同 #1 |
| 11 | 历史记录卡片点击无跳转 | `history/index.tsx` 的 `history-item` 无 onClick | 添加 `onClick` 跳转至 `/pages/sessiondetail/index` |
| 12 | 错题本 Tab 未两端对齐 | `.wrongbook-tabs` 按钮无 `flex: 1` | 按钮添加 `flex: 1`，首/末元素设置对应圆角 |
| 13 | 移除"全部重做"功能 | 需简化错题本 | 删除 `handleRetryAll`、按钮 JSX、相关 import 和 CSS |

### 二、新增页面

#### 2.1 闯关记录详情（`pages/sessiondetail`）
- 展示单次闯关完整信息：标题、领域、得分、正确率、用时、最高连击、金币
- 错题列表（含答案对比）
- 后端新增 `GET /api/user/sessions/{session_id}` 端点

#### 2.2 关于页面（`pages/about`）
- App 介绍信息

### 三、技术细节

- **ScrollView 高度链**：微信小程序中 `ScrollView` 是原生组件，正确参与 flex 高度级联；替换为 `View` 会导致高度塌缩。保留 `ScrollView` + `enhanced` + `showScrollbar={false}` 解决滚动条问题
- **按钮顺序语义**：左侧"上一题"（回退），右侧"跳过"（前进），符合操作直觉
- **全局 CSS 调优**：`app.scss` 同步微调，保证 Campus Comic 风格一致性

### 四、测试覆盖

后端 83 个测试全部通过（test_points.py 27 + test_auth.py 16 + test_user_api.py 30+ + test_analyze_with_user.py 10）。

### 五、文件变更统计

| 类别 | 新增 | 修改 | 合计 |
|------|------|------|------|
| 后端 | 0 | 6 | 6 |
| 前端 | 2 | 15 | 17 |
| **合计** | **2** | **21** | **23** |

```
后端修改:
  backend/app/api/quiz.py               (+title 去硬编码)
  backend/app/api/user.py               (+session detail 端点)
  backend/app/models/api.py             (+title 字段)
  backend/app/models/user_schemas.py    (+session detail schemas)
  backend/tests/test_analyze_with_user.py (+title 测试)
  backend/tests/test_user_api.py        (+session detail 测试)

前端新增:
  frontend/src/pages/about/index.tsx    (关于页面)
  frontend/src/pages/sessiondetail/     (闯关记录详情)

前端修改:
  frontend/src/app.config.ts            (+2 页面路由)
  frontend/src/app.scss                 (样式微调)
  frontend/src/pages/index/index.tsx     (优化)
  frontend/src/pages/index/index.scss    (优化)
  frontend/src/pages/quiz/index.tsx      (title + 按钮位置)
  frontend/src/pages/quiz/index.scss     (overflow + 高度限制)
  frontend/src/pages/result/index.tsx    (灯灯气泡 + 奖励对齐)
  frontend/src/pages/result/index.scss   (间距优化)
  frontend/src/pages/mine/index.tsx      (ScrollView enhanced + 关于跳转)
  frontend/src/pages/mine/index.scss     (滚动条 + 间距压缩)
  frontend/src/pages/history/index.tsx   (卡片点击跳转)
  frontend/src/pages/wrongbook/index.tsx (移除全部重做)
  frontend/src/pages/wrongbook/index.scss (Tab 对齐 + 清理)
  frontend/src/services/api.ts           (+session detail API)
  frontend/src/types/quiz.ts            (+title 字段)
  frontend/src/types/user.ts            (+session detail 类型)
```

---

## v1.4.0 — 用户系统 P2：错题重做 + 全部重做

**发布日期：** 2026-06-10  
**提交：** `8fc0fbc`  
**平台：** 微信小程序

---

### 一、重大新增

#### 1.1 错题重做（Re-answer）

- **新增 API**：`POST /api/user/wrong-questions/{id}/retry`
  - 接收用户重新选择的答案，判断对错
  - 答对 → 自动标记已掌握（resolved=true）+ 奖励 +2 金币
  - 答错 → 保持待复习状态，提示"继续加油"
- **WrongQuestion 表新增 `options` 字段**：存储 JSON 序列化的原始 A/B/C/D 选项
  - ORM 模型新增 `options` TEXT 列
  - `quiz.py` analyze 端点保存错题时附带原始选项
  - `init.sql` 建表脚本同步更新
  - `main.py` 启动时自动迁移：为已有表添加 options 列（幂等）
- **Schema 更新**：`WrongQuestionItem` / `WrongQuestionDetailResponse` 新增 `options` 字段
- **新增模型**：`RetryAnswerRequest` / `RetryAnswerResponse`

#### 1.2 错题详情页重做交互

- **重新作答区域**：展示原始 A/B/C/D 选项按钮（Campus Comic 风格）
  - 点击选项 → 调用 retry API → 四种视觉状态：
    - `selected`（蓝色高亮）→ 等待 API 响应
    - `correct`（绿色 + ✓图标）→ 答对
    - `wrong`（红色）→ 答错
    - `hint-correct`（绿色边框提示）→ 答错后高亮正确答案
  - 答对自动显示"已掌握"横幅 + toast 提示金币奖励
  - 答错 toast 鼓励，灯灯 mascot 情绪切换
- **向后兼容**：无 options 的旧错题仍可手动"标记为已掌握"

#### 1.3 全部重做

- **错题本页新增「全部重做」按钮**：将待复习错题拼接为新闯关
  - 自动筛选有 options 的未掌握错题
  - 构建 Question 对象 → initSession → 跳转答题页
  - 智能判断题型：≤2 个选项 → `truefalse`，>2 → `choice`

### 二、TDD 测试覆盖

| 测试文件 | 新增用例 | 覆盖内容 |
|----------|---------|----------|
| `test_user_api.py` | +6 | retry 端点：auth/404/答对/答错/已掌握重答/options 保存 |
| **合计** | **76** | **全部通过（+ 6 个 SSE 遗留失败，非本次变更）** |

### 三、文件变更统计

| 类别 | 新增 | 修改 | 合计 |
|------|------|------|------|
| 后端 | 0 | 7 | 7 |
| 前端 | 0 | 6 | 6 |
| 文档 | 0 | 2 | 2 |
| **合计** | **0** | **15** | **15** |

```
修改:
  backend/app/api/quiz.py               (保存 options +2 lines)
  backend/app/api/user.py               (新增 retry 端点 +60 lines)
  backend/app/main.py                   (启动迁移 +20 lines)
  backend/app/models/user_orm.py        (options 列 +1 line)
  backend/app/models/user_schemas.py    (retry 模型 +20 lines)
  backend/tests/test_user_api.py        (retry 测试 +110 lines)
  backend/init.sql                      (options 列 +1 line)
  frontend/src/pages/wrongbook/index.tsx (全部重做按钮 +35 lines)
  frontend/src/pages/wrongbook/index.scss (+8 lines)
  frontend/src/pages/wrongdetail/index.tsx (重新作答 UI +120 lines)
  frontend/src/pages/wrongdetail/index.scss (+80 lines)
  frontend/src/services/api.ts          (retryWrongQuestion +35 lines)
  frontend/src/types/user.ts            (options + RetryAnswerResponse)
  VERSION.md                            (本文档)
```

---

## v1.3.0 — 用户系统 P1：个人中心 + 积分 + 错题本

**发布日期：** 2026-06-10  
**提交：** `82a427b`  
**平台：** 微信小程序

---

### 一、重大新增

#### 1.1 用户积分与成长系统
- **积分计算**（`backend/app/services/points.py`）：
  - 基础 +10 金币/次闯关
  - 正确 +2 金币/题
  - 连击加成：+5（combo≥5）、+15（combo≥10）
  - 每日首闯加成：+20
  - 单次上限：100 金币
- **经验值**：1 exp = 1 coin（1:1 映射）
- **5 级等级体系**：
  - Lv1 初学萌新 (0-99) → Lv2 知识学徒 (100-299) → Lv3 学习达人 (300-599) → Lv4 百科高手 (600-999) → Lv5 博学大师 (1000+)
- **每日打卡**：首次闯关自动签到，计算连续打卡天数
- **自动升级**：经验达标自动提升等级

#### 1.2 自动记录保存
- 改造 `POST /api/quiz/analyze`：
  - **登录用户**：自动创建 QuizSessionRecord、WrongQuestion、CheckIn，发放金币/经验
  - **匿名用户**：正常获取分析结果，不保存记录
  - 响应新增 `reward` 字段（coins_earned, experience_earned, level_up 信息）

#### 1.3 六个用户 API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/user/stats` | 学习统计（闯关数/正确率/打卡/等级进度） |
| `GET` | `/api/user/history?page=&page_size=` | 分页历史记录 |
| `GET` | `/api/user/wrong-questions?resolved=` | 错题列表（按领域分组） |
| `GET` | `/api/user/wrong-questions/{id}` | 错题详情（含 session 上下文） |
| `POST` | `/api/user/wrong-questions/{id}/resolve` | 标记已掌握 |
| `POST` | `/api/user/checkin` | 手动打卡 |

#### 1.4 前端四个完整页面

**个人中心**（`pages/mine`）：
- 用户卡片（CSS 圆形头像、昵称、等级徽章）
- 经验进度条（当前经验 / 升级所需）
- 金币展示（CSS 金币图标）
- 统计三连（累计闯关 / 正确率 / 连续打卡）
- 菜单导航（学习历史 / 错题本 / 关于）
- 退出登录（带确认弹窗）
- 未登录引导（Mascot + 去登录按钮）

**学习历史**（`pages/history`）：
- 分页列表，滚动到底自动加载更多
- 每项：标题、领域标签、得分、正确率、用时、日期
- 空状态引导

**错题本**（`pages/wrongbook`）：
- 全部/待复习/已掌握 Tab 筛选
- 按知识领域分组展示
- 每项：题目预览、已掌握/待复习 badge、日期
- 点击跳转错题详情

**错题详情**（`pages/wrongdetail`）：
- 完整题目展示
- 答案对比（红色错误 vs 绿色正确）
- 解析卡片
- "标记为已掌握" 按钮 / 已掌握横幅
- 所属闯关、错题时间

#### 1.5 结果页改造
- 登录用户：显示奖励信息（金币/经验/每日首闯/升级）
- 匿名用户：提示"登录后可保存学习记录"
- "查看我的学习记录"快捷入口

---

### 二、TDD 测试覆盖

| 测试文件 | 用例数 | 覆盖内容 |
|----------|--------|----------|
| `test_points.py` | 27 | 金币计算（基础/正确/连击/首日/上限）、经验、打卡天数、等级升级 |
| `test_user_api.py` | 18 | stats/history/wrong-questions/detail/resolve/checkin 全部端点 |
| `test_analyze_with_user.py` | 9 | 登录用户 analyze → session/错题/打卡/金币/经验/等级；匿名用户无奖励 |
| `test_auth.py` | 16 | mock-login 适配、wechat-login、me、JWT、CORS |
| **合计** | **70** | **全部通过** |

---

### 三、技术决策

#### 3.1 双鉴权依赖模式
- `get_current_user`：返回 `User`，失败抛 401 → 用户 API
- `get_optional_user`：返回 `User | None` → quiz analyze（登录/匿名双通道）
- 保持了 P0 的 quiz 核心流程不变

#### 3.2 前端页面风格
- 全部遵循 Campus Comic 校园漫画风格
- 使用全局 CSS 变量（`var(--blue)`, `var(--shadow-comic)` 等）
- CSS 图形（头像、金币、等级徽章）替代图片，节省小程序包体积

---

### 四、文件变更统计

| 类别 | 新增 | 修改 | 合计 |
|------|------|------|------|
| 后端 | 5 | 4 | 9 |
| 前端 | 0 | 13 | 13 |
| **合计** | **5** | **17** | **22** |

```
新增:
  backend/app/api/user.py              (+285)
  backend/app/services/points.py       (+189)
  backend/tests/test_points.py         (+185)
  backend/tests/test_user_api.py       (+277)
  backend/tests/test_analyze_with_user.py (+237)

修改 (主要):
  backend/app/api/quiz.py              (重写 analyze 端点)
  backend/app/api/auth.py              (+mock-login 端点)
  backend/app/main.py                  (+user_router)
  backend/app/models/user_schemas.py   (+WrongQuestion/RewardInfo schemas)
  frontend/src/pages/mine/*            (完整重写: 个人中心)
  frontend/src/pages/history/*         (完整重写: 学习历史)
  frontend/src/pages/wrongbook/*       (完整重写: 错题本)
  frontend/src/pages/wrongdetail/*     (完整重写: 错题详情)
  frontend/src/pages/result/*          (+奖励/登录引导)
  frontend/src/services/api.ts         (+userApi)
  frontend/src/types/quiz.ts           (+RewardInfo)
```

---

## v1.2.0 — 平台纯净化：移除 H5/Web

**发布日期：** 2026-06-10  
**平台：** 微信小程序（已移除 H5 网页版）

---

### 一、重大变更

项目从 **双端（H5 + 微信小程序）** 重构为 **纯微信小程序** 项目。H5 网页版在生产发布中无明确作用，移除后可减少编译体积和维护复杂度。

### 二、删除内容

#### 2.1 前端删除
| 文件/目录 | 说明 |
|---|---|
| `frontend/src/index.html` | H5 入口 HTML |
| `frontend/src/app.h5.scss` | H5 专属样式（手机框、纸纹理、自定义滚动条） |
| `frontend/src/app.boot.ts` | H5 prebundle 兼容 workaround |
| `frontend-web/` | Phase 0 独立 Web 原型（Vite + React） |

#### 2.2 后端删除
| 端点/文件 | 说明 |
|---|---|
| `POST /api/quiz/generate`（SSE 流式） | 小程序无法消费 SSE |
| `POST /api/auth/mock-login` | H5 开发用，小程序不需要 |
| `backend/app/utils/sse.py` | SSE 工具函数文件 |
| `sse-starlette` 依赖 | SSE 框架依赖 |

#### 2.3 代码精简
| 函数/类型 | 说明 |
|---|---|
| `authApi.mockLogin()` | Mock 登录方法 |
| `generateQuizStreamWeb()` | H5 SSE 流式生成（~60 行） |
| `parseSSEBuffer()` | SSE 缓冲区解析器（~60 行） |
| `miniFetch` / fetch polyfill | 小程序 fetch 兼容层（~90 行） |
| `IS_MINI_PROGRAM` 平台判断 | 已无分支场景 |
| `MockLoginRequest`（前后端） | 类型定义 |
| `SSECallbacksExport` | 仅 H5 使用 |
| `@tarojs/plugin-platform-h5` | H5 编译插件 |
| `dev:h5` / `build:h5` | NPM 脚本 |
| `config/index.ts` 中 `h5:` 段 | H5 编译配置 |

### 三、保留的关键路径（不受影响）

| 保留内容 | 说明 |
|---|---|
| `POST /api/quiz/generate-sync` | 小程序出题核心端点 |
| `POST /api/quiz/analyze` | 答题结果分析 |
| `POST /api/auth/wechat-login` | 微信登录 |
| `GET /api/auth/me` | 用户信息查询 |
| `authApi.wechatLogin / getProfile` | 前端 auth API |
| `generateQuizStream → generateQuizStreamMini` | 前端出题（简化调用链） |
| `AbortController / TextDecoder polyfills` | 小程序运行时兼容 |
| `arrayBufferToUtf8()` | UTF-8 解码 |
| 所有页面组件 | 首页、答题、结果、登录、个人中心等 |

### 四、编译体积对比

| 指标 | 清理前 | 清理后 |
|---|---|---|
| `api.ts` 行数 | 647 | 285 |
| `config/index.ts` 行数 | 82 | 56 |
| NPM 脚本 | 12 | 10 |
| 前端依赖 | 13 | 12 |
| 后端依赖 | 13 | 12 |

---

## v1.1.0 — 用户系统

**发布日期：** 2026-06-10  
**平台：** 微信小程序 + H5 网页双端

---

### 一、新增功能

#### 1.1 用户认证系统
- **H5 Mock 登录**：输入昵称即可登录，支持可选头像
- **微信一键登录**：小程序端调用 `wx.login` 获取 code，后端换取 openid 并签发 JWT
- **JWT Token 管理**：自动持久化到 Storage（H5: localStorage / 小程序: Taro.setStorageSync）
- **登录态检测**：401 自动清除过期 token
- **个人主页**：展示用户头像、昵称、学习统计占位

#### 1.2 后端 Auth API
- `POST /api/auth/mock-login` — 开发环境 Mock 登录
- `POST /api/auth/wechat-login` — 微信小程序登录
- `GET /api/auth/me` — 获取当前用户信息（需 Bearer Token）
- SQLAlchemy 2.0 async + asyncmy（MySQL）数据持久化
- 用户表 `users`（id, openid, nickname, avatar_url, created_at）

#### 1.3 页面路由扩展
- `pages/login/index` → 登录页
- `pages/mine/index` → 个人中心（我的）
- `pages/history/index` → 学习历史（骨架）
- `pages/wrongbook/index` → 错题本（骨架）
- `pages/wrongdetail/index` → 错题详情（骨架）

---

### 二、关键修复

| 问题 | 根因 | 解决方案 |
|---|---|---|
| `module 'langchain' has no attribute 'verbose'` | `langchain` 1.3.4 移除了 `__getattr__`，`langchain-core` 通过 `get_verbose()` 回访 `langchain.verbose` | 移除未直接使用的 `langchain` 依赖，仅保留 `langchain-core` + `langchain-openai` |
| 小程序 `fetch is not a function`（微信登录） | Web 的 `fetch` 请求封装被直接复用，`globalThis.fetch = polyfill` 在小程序沙箱中不传播至裸 `fetch` 标识符 | `authApi` + `analyzeQuiz` 全部改为 `Taro.request()`，该 API 在两端均可工作 |

---

### 三、技术决策

#### 3.1 HTTP 请求统一为 Taro.request
- `authApi.mockLogin / wechatLogin / getProfile` → `Taro.request()`
- `analyzeQuiz` → `Taro.request()`
- SSE 流式出题保持双路径不变（H5 fetch + 小程序 wx.request）
- `Taro.request()` 自动序列化 data 为 JSON，自动解析 response data

#### 3.2 用户状态管理
- Zustand store（`userStore`）管理 token + user + login 状态
- 动态 `import("../services/api")` 避免循环依赖
- `setAuth(token, user)` 统一写入点，同步持久化到 Storage

---

## MVP v1.0.0

**发布日期：** 2026-06-09  
**代号：** 阿拉灯神丁 MVP  
**平台：** 微信小程序 + H5 网页双端

---

## 一、项目概述

「阿拉灯神丁」是一款 AI 驱动的闯关学习小程序。用户输入知识点主题，AI 自动生成选择题/判断题，实时答题闯关，完成后获得 AI 分析报告，涵盖掌握度雷达图、知识要点总结和错题回顾。

**技术栈：**
- 前端：Taro 4.2（React + TypeScript）
- 后端：FastAPI + LangChain + DeepSeek
- 样式：SCSS（校园漫画风格）

---

## 二、核心功能

### 2.1 首页（Page ①-②）
- 知识点输入（文本 / 粘贴）
- 题目数量选择（5 / 10 / 15 / 20 题）
- 题目类型选择（单选 / 判断 / 混合）
- 难度选择（简单 / 中等 / 困难）
- 吉祥物「灯灯」互动展示

### 2.2 AI 出题（Page ③）
- 显示实时出题进度（分析知识点 → 生成题目 → 校验准确性）
- 动画过渡效果
- 超时保护（3 分钟）

### 2.3 答题闯关（Page ④-⑦）
- 选择题 + 判断题混合支持
- 实时计时器
- 连击系统（Combo × N）
- 3 条生命值（答错扣血）
- 答对/答错反馈 + 知识讲解卡片
- 吉祥物情绪同步（开心 / 鼓励）
- 跳过 / 上一题导航
- 闯关完成横幅

### 2.4 通关结果 + 分析报告（Page ⑦-⑧）
- 分数圆环（CSS 纯实现）
- 正确率 / 用时 / 最高连击 统计
- AI 掌握度雷达图（横向进度条）
- AI 知识要点总结
- AI 学习建议
- 错题回顾（正确答案对比 + 解析）
- 分享成绩 / 再来一局

---

## 三、技术亮点与关键决策

### 3.1 微信小程序网络层
- **问题**：小程序无 `fetch`、`AbortController`、`ReadableStream`、`TextDecoder`
- **方案**：自建 polyfill 层，双路径架构：
  - H5：原生 `fetch` + SSE 流式生成
  - 小程序：`wx.request` + `/generate-sync` 同步 JSON 端点
- **细节**：
  - `responseType: "arraybuffer"` 避免 DevTools 代理截断
  - `timeout: 180000` 适应 LLM 长耗时
  - UTF-8 多字节解码器（支持 4-byte 序列 → 代理对）

### 3.2 原生组件适配
- **问题**：Taro `<Button>` 渲染为微信原生 `<button>`，强制样式
- **方案**：全部交互按钮替换为 `<View>` + `onClick`

### 3.3 WXSS 布局兼容
- **问题**：`display: inline-flex` + `width: 100%` 在小程序 WXSS 中导致宽度溢出
- **方案**：全宽按钮显式覆写 `display: flex` + `box-sizing: border-box`
- **问题**：`word-break: break-word` 在小程序中不生效
- **方案**：全部改为 `word-break: break-all`
- **问题**：`* { box-sizing: border-box }` 全局重置对小程序组件不保证可靠
- **方案**：卡片元素显式添加 `box-sizing: border-box; max-width: 100%`
- **问题**：Flex 子元素 `min-height: auto` 阻止收缩
- **方案**：页面容器显式添加 `min-height: 0`

### 3.4 分数圆环
- SVG 替换为 CSS 纯实现，保证小程序兼容性
- `flex-shrink: 0` 防止 flex 父容器挤压圆形

---

## 四、项目结构

```
FAN_AI_LEARN/
├── frontend/                  # Taro 4.2 前端（微信小程序）
│   └── src/
│       ├── app.config.ts      # 全局配置（页面路由、窗口样式）
│       ├── app.scss           # 全局样式（色板、组件、动画）
│       ├── components/
│       │   └── Mascot.tsx     # 吉祥物组件（灯灯）
│       ├── hooks/
│       │   ├── useQuizEngine.ts
│       │   ├── useTimer.ts
│       │   └── useSSE.ts
│       ├── pages/
│       │   ├── index/         # 首页
│       │   ├── loading/       # AI 出题加载页
│       │   ├── quiz/          # 答题页
│       │   ├── result/        # 通关结果 + 分析报告
│       │   ├── login/         # 微信一键登录
│       │   ├── mine/          # 个人中心
│       │   ├── history/       # 学习历史
│       │   ├── wrongbook/     # 错题本
│       │   └── wrongdetail/   # 错题详情
│       ├── services/
│       │   └── api.ts         # 网络层（Taro.request + wx.request）
│       ├── stores/
│       │   ├── quizStore.ts   # 答题状态管理
│       │   ├── uiStore.ts    # UI 状态管理
│       │   └── userStore.ts  # 用户认证状态管理
│       └── types/
│           ├── quiz.ts        # 答题类型定义
│           └── user.ts        # 用户类型定义
├── backend/                   # FastAPI 后端
│   └── app/
│       ├── api/
│       │   ├── quiz.py        # 题目生成（/generate-sync）+ 分析 API
│       │   └── auth.py        # 微信登录 + 用户信息 API
│       ├── chains/
│       │   ├── quiz_generation.py  # LangChain 出题链
│       │   ├── quiz_validation.py  # LangChain 校验链
│       │   └── result_analysis.py  # LangChain 分析链
│       ├── models/
│       │   ├── api.py         # 请求/响应 Pydantic 模型
│       │   ├── quiz.py        # 题目 Pydantic 模型
│       │   ├── user_orm.py    # SQLAlchemy ORM 模型
│       │   └── user_schemas.py # 用户 Pydantic 模型
│       ├── services/
│       │   └── auth.py        # JWT + 微信 code2session
│       ├── config.py          # 配置管理
│       └── database.py        # 数据库连接
└── VERSION.md                 # 本文件
```

---

## 五、已解决问题记录

| 问题 | 根因 | 解决方案 |
|---|---|---|
| `fetch is not a function` | 小程序无 fetch | wx.request polyfill |
| `AbortController is not defined` | 小程序无 AbortController | polyfill |
| SSE 流数据为空 | wx.request 无法读 SSE | 新增 sync JSON 端点 |
| request:fail timeout | 默认 60s 不够 LLM 生成 | timeout: 180000 |
| JSON parse 截断 | DevTools 代理截断文本响应 | responseType: arraybuffer |
| 按钮无响应 | Taro Button 原生限制 | View + onClick 替代 |
| 卡片超出屏幕 | inline-flex + width:100% 溢出 | display: flex 覆写 |
| 圆环变椭圆 | flex 父容器挤压 | flex-shrink: 0 |
| 文本溢出卡片 | break-word 不兼容小程序 | break-all |
| 卡片宽度溢出 | box-sizing 不保证继承 | 显式声明 |

---

## 六、后续迭代方向

- [ ] 更多题型（填空、编程）
- [ ] 学习历史记录
- [ ] 每日挑战 + 排行榜
- [ ] 分享成绩海报
- [ ] 错题本 + 收藏
- [ ] AI 自适应难度
- [ ] 语音输入知识点
