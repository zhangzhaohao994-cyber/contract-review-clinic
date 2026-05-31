# 不被坑 bubeiken

主标语：怕被坑？写合同就来不被坑！

小字信息：契约实验室 · 日本博士后帮你免费审查合同

多级静态网站，包含首页、服务、工具、文章、案例、清单和提交页面，可直接部署到 Netlify。

## AI 合同审查

提交页会调用 Netlify Functions，并通过 OpenAI API 生成：

- `修改版-原文件名.docx`
- `修改说明-原文件名.docx`

Netlify 环境变量需要配置：

- `OPENAI_API_KEY`：必填
- `OPENAI_MODEL`：可选，默认 `gpt-4.1`
