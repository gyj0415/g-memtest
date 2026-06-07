# 企业管理自测站

这是一个纯静态的企业管理与技术经济学自测网站。

## 网站内容

- `site/index.html`：正式发布页面
- `site/banks/`：内置题库目录和题库 JSON
- `site/converter.html`：题库格式转换器
- `site/template.json`：题库 JSON 模板

## 本地使用

用任意静态服务器打开 `site/`，例如 `npx serve site`。网站会从 `site/banks/manifest.json` 加载内置题库，并把题库和答题记录保存在当前浏览器的 `localStorage` 中。

## 发布说明

当前仓库只准备 Git 上传，不启用 GitHub Pages 自动发布。

网站发布继续使用 Netlify。上线 zip 从 `site/` 重新打包，并输出到父级工作区，方便直接上传。
