# 阿拉灯神丁 — 版本说明

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
├── frontend/                  # Taro 4.2 前端
│   └── src/
│       ├── app.config.ts      # 全局配置（页面路由、窗口样式）
│       ├── app.scss           # 全局样式（色板、组件、动画）
│       ├── index.html         # H5 入口 HTML
│       ├── components/
│       │   └── Mascot.tsx     # 吉祥物组件（灯灯）
│       ├── hooks/
│       │   ├── useQuizEngine.ts
│       │   └── useTimer.ts
│       ├── pages/
│       │   ├── index/         # 首页
│       │   ├── loading/       # AI 出题加载页
│       │   ├── quiz/          # 答题页
│       │   └── result/        # 通关结果 + 分析报告
│       ├── services/
│       │   └── api.ts         # 网络层（双路径 + polyfill）
│       ├── stores/
│       │   ├── quizStore.ts   # 答题状态管理
│       │   └── uiStore.ts    # UI 状态管理
│       └── types/
│           └── quiz.ts        # 类型定义
├── backend/                   # FastAPI 后端
│   └── app/
│       ├── api/
│       │   └── quiz.py        # 题目生成 + 分析 API
│       ├── chains/
│       │   ├── quiz_generation.py  # LangChain 出题链
│       │   └── quiz_validation.py  # LangChain 校验链
│       ├── models/
│       │   └── api.py         # Pydantic 模型
│       └── utils/
│           └── sse.py         # SSE 事件工具
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
