# 不被坑 bubeiken

主标语：怕被坑？写合同就来不被坑！

小字信息：契约实验室 · 日本博士后帮你免费审查合同

多级静态网站，包含首页、服务、工具、文章、案例、清单和提交页面，可直接部署到 Netlify。

## AI 合同审查

提交页会调用 Netlify Functions，并通过 AI API 生成：

- `修改版-原文件名.docx`
- `修改说明-原文件名.docx`

Netlify 环境变量需要配置：

- `AI_PROVIDER`：可选，默认 `deepseek`
- `DEEPSEEK_API_KEY`：使用 DeepSeek 时必填
- `DEEPSEEK_MODEL`：可选，默认 `deepseek-chat`
- `GEMINI_API_KEY`：使用 Gemini 时必填
- `GEMINI_MODEL`：可选，默认 `gemini-2.5-flash`
- `OPENAI_API_KEY` / `OPENAI_MODEL`：仅当 `AI_PROVIDER=openai` 时使用
