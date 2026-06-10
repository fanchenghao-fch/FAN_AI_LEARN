# 阿拉灯神丁 — 版本说明

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
