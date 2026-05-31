# 契约体检室

Slogan: 日本博士后帮你免费审查合同

这是一个 Netlify 友好的静态网站，包含：

- 合同文本本地风险自检
- 甲方/乙方等身份视角切换
- 常见合同风险提示和改写建议
- Netlify Forms 免费初审提交表单

## 本地预览

```bash
python3 -m http.server 4173
```

然后打开 `http://localhost:4173`。

## Netlify

仓库根目录就是发布目录，`netlify.toml` 已设置 `publish = "."`。
