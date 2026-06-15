## ADDED Requirements

### Requirement: 三段式出题进度展示
前端 Loading 页 SHALL 展示搜索→生成→校验的三段式进度，每阶段有独立的状态指示（等待中 / 进行中 / 已完成 / 失败）。

#### Scenario: 进度阶段按顺序展示
- **WHEN** 用户提交出题请求后进入 Loading 页
- **THEN** 页面按顺序展示三个阶段："搜索最新知识"（进行中） → "生成题目"（进行中） → "校验准确性"（进行中），每阶段完成后显示完成状态

#### Scenario: 搜索阶段跳过时直接进入生成
- **WHEN** 用户请求中 `enable_search` 为 `false`
- **THEN** Loading 页跳过"搜索最新知识"阶段，直接展示"生成题目"为进行中状态

#### Scenario: 某阶段失败不影响后续
- **WHEN** 搜索阶段超时或失败
- **THEN** Loading 页展示搜索阶段为"已完成（未启用搜索）"状态，继续展示生成阶段进行中

### Requirement: 阶段进度动画过渡
系统 SHALL 在各阶段状态切换时呈现平滑的视觉过渡效果。

#### Scenario: 阶段完成动画
- **WHEN** 第一阶段"搜索最新知识"完成
- **THEN** 阶段指示器从旋转加载图标变为绿色 ✓ 图标，并在 300ms 内完成过渡动画

### Requirement: 进度文本与后端事件同步
前端 SHALL 根据后端返回的进度事件动态更新各阶段的状态文本。

#### Scenario: 搜索进度文本更新
- **WHEN** 后端返回 `{"stage": "searching", "message": "正在搜索最新知识..."}`
- **THEN** Loading 页第一阶段下方显示 "正在搜索最新知识..."

#### Scenario: 生成进度文本更新
- **WHEN** 后端返回 `{"stage": "generating", "message": "正在生成题目..."}`
- **THEN** Loading 页第二阶段下方显示 "正在生成题目..."

#### Scenario: 校验进度文本更新
- **WHEN** 后端返回 `{"stage": "validating", "message": "正在校验准确性..."}`
- **THEN** Loading 页第三阶段下方显示 "正在校验准确性..."

### Requirement: 吉祥物灯灯动画配合
Loading 页的吉祥物灯灯 SHALL 根据当前进度阶段展示不同的表情和动画。

#### Scenario: 搜索阶段灯灯状态
- **WHEN** 当前阶段为"搜索最新知识"
- **THEN** 灯灯展示 "thinking" 表情（放大镜搜索动画）

#### Scenario: 生成阶段灯灯状态
- **WHEN** 当前阶段为"生成题目"
- **THEN** 灯灯展示 "thinking" 表情（奋笔疾书动画）

#### Scenario: 校验阶段灯灯状态
- **WHEN** 当前阶段为"校验准确性"
- **THEN** 灯灯展示 "thinking" 表情（检查清单动画）
