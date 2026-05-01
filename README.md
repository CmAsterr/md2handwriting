# md2handwriting

把 Markdown / LaTeX 作业内容渲染成接近真实纸面手写效果的静态网页工具。

## 功能

- Markdown 输入，A4 手写纸预览。
- 内置多种中文手写字体和公式字体，支持继续导入本地字体。
- 支持常见 LaTeX：`\vec{a}`、`\overline{a}`、`\hat{x}`、`\tilde{x}`、`|a|`、希腊字母、矩阵、cases、aligned 等。
- `~~...~~` 渲染为涂改痕迹，`[ink]` 渲染为漏墨。
- `\textcolor{red}{...}` 可做红笔修正。
- 导出 PDF、逐页图片 ZIP、按 `---` 分段的长图 ZIP。
- 可选本地导出服务，适合大作业或浏览器后台标签页导出。

## 本地运行

双击 `一键启动.bat`，或在本目录运行：

```powershell
python -m http.server 8000
```

然后打开：

```text
http://localhost:8000/
```

如果要使用“本地加速导出”，另开一个终端运行：

```powershell
node local-export-server.js
```

本地服务会调用已安装的 Chrome 或 Edge 进行后台渲染，不需要额外 npm 依赖。

## 输入约定

- 普通文本直接输入。
- 行内公式使用 `$...$`。
- 独立公式使用 `$$...$$`、`\[...\]` 或 LaTeX 环境。
- 单独一行 `---` 表示主动分页；导出“分段长图 ZIP”时，它也是长图分段边界。
- 涂改写法：`$x = $~~$5$~~$3$`。
- 漏墨写法：`因此结论成立。[ink]`
- 红笔写法：`\textcolor{red}{这里应改为 $x=2$}`。

## 导出说明

- `PDF 文档`：每张 A4 纸导出为一页 PDF。
- `ZIP 图片压缩包`：每张 A4 纸导出为一张 JPG。
- `按 --- 分段长图 ZIP`：把每两个 `---` 之间产生的页面纵向拼为一张长图。
- 勾选“本地加速导出”时，网页会请求 `http://127.0.0.1:8765/export`。如果服务不可用，会自动回退到浏览器内导出。

## Skill 和提示词

- 可迁移 skill 在 `skills/md2handwriting-homework/`。
- 通用提示词模板在 `prompts/homework-md2handwriting.md`。
- skill 内也保存了一份可供其他 AI 读取的提示词：`skills/md2handwriting-homework/references/homework-md2handwriting-prompt.md`。
- 本机 Codex 已安装同名 skill：`md2handwriting-homework`。

## 项目结构

```text
index.html              页面结构
style.css               样式、纸张、MathJax 字体策略、涂改/漏墨视觉
js/config.js            全局配置和内置字体列表
js/parser.js            Markdown / LaTeX / 特殊标记解析
js/renderer.js          排版、MathJax 渲染、分页
js/exporter.js          PDF / ZIP / 长图导出
js/fonts.js             内置字体和导入字体
js/effects.js           涂改与漏墨生成
js/app.js               初始化、状态保存、UI 事件
local-export-server.js  可选本地后台导出服务
```
