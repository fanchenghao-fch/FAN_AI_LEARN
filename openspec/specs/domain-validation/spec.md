## ADDED Requirements

### Requirement: 知识领域归属校验
系统 SHALL 在题目生成完成后，验证每道题目是否确实属于用户指定的知识领域，发现领域偏离的题目应标记问题。

#### Scenario: 领域匹配校验通过
- **WHEN** 生成的题目与用户指定的知识领域一致
- **THEN** 校验结果为 `valid: true`，`issues` 数组为空

#### Scenario: 领域偏离校验发现
- **WHEN** 某道生成的题目内容属于无关知识领域（如输入 "Harness Engineering" 但生成了传统土木工程题目）
- **THEN** 校验结果标记该题目 `valid: false`，并在 `issues` 中列出具体的领域偏离问题描述

#### Scenario: 校验不阻断出题
- **WHEN** 校验发现部分题目存在领域偏离
- **THEN** 系统仍返回全部题目和校验结果，由前端决定是否展示警告，不自动丢弃题目

### Requirement: 低成本模型执行校验
系统 SHALL 使用 DeepSeek V4 Flash（低成本模型）执行领域归属校验，以控制额外 API 调用成本。

#### Scenario: Flash 模型校验
- **WHEN** 执行领域归属校验
- **THEN** 系统使用 `deepseek-v4-flash` 模型，temperature 设为 0.1，max_tokens 设为 2048

#### Scenario: 校验失败降级
- **WHEN** 校验链因 API 错误失败
- **THEN** 系统记录错误，返回 `valid: false` 带 `issues: [{problem: "校验服务异常"}]`，不阻断题目返回

### Requirement: 校验输入包含完整上下文
系统 SHALL 在校验时提供用户原始输入和生成题目的完整信息，确保校验模型有足够上下文做出判断。

#### Scenario: 校验请求构建
- **WHEN** 构建校验请求
- **THEN** 系统传入：用户原始 `knowledge_input`、AI 识别的 `knowledge_domain`、所有题目的 `id` + `content` + `correct_answer` + `explanation`
