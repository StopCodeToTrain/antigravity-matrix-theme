---
name: matrix-theme
description: 黑客帝国风（Matrix）黑绿主题工作台与配色方案管理技能。当用户需要打开 Matrix Theme Studio 交互界面、对比或切换 3 套黑绿主题变体（经典荧光绿 / 护眼暗绿 / 高对比终端）、微调设计 Token、导出 CSS / Tailwind v4 / JSON / HTML 模板、一键将黑绿主题写入当前项目，或询问如何在 Antigravity App Settings > Appearance 中搭配使用黑绿主题时激活。
---

# Matrix Theme 主题工作台与配色指南

本技能用于指导你调用 `matrix-studio` MCP 服务器提供的工具，为用户提供黑客帝国风（Matrix）黑绿主题的实时预览、对比度审计、Token 导出、一键写入项目文件及 Antigravity 外观配置指导。

## 一、可用 MCP 工具与职责边界

`matrix-studio` MCP 服务器提供以下模型可调用工具（以及仅供 MCP App 前端自身调用的持久化工具）：

| 工具名称 | 调用方 | 用途与常用参数 |
| :--- | :--- | :--- |
| `open_matrix_studio` | 模型 / 界面入口 | 打开 **Matrix Theme Studio** 全功能交互工作台（支持 `aux_pane` 侧边栏与 `global` 左侧栏全屏）。可选参数：`variant`（`"classic-phosphor"` \| `"zion-dark"` \| `"crt-high-contrast"`）、`tab`（`"preview"` \| `"tokens"` \| `"customizer"` \| `"export"`）。 |
| `preview_matrix_card` | 模型 | 在当前对话内渲染紧凑型内联预览卡（`mode: "inline"`），适合快速展示单一变体的终端预览、色板和 WCAG 状态。可选参数：`variant`。 |
| `export_matrix_theme` | 模型 / App | 导出指定变体（可选传入 `overrides` 覆盖色值）的代码或配置指南。可选参数：`variant`、`format`（`"css"` \| `"tailwind"` \| `"json"` \| `"antigravity-guide"` \| `"html-template"`）、`overrides`。 |
| `apply_matrix_theme_to_project` | 模型 / App | **一键应用到当前项目**：将所选变体（及可选 `overrides`）原子化写入目标项目目录的 `matrix-theme.css`、`matrix-tailwind.css` 与 `matrix-tokens.json`，并可选向指定入口 CSS 幂等插入 `@import`。参数：`projectDir`（必填绝对路径）、`variant`、`overrides`、`targets`（`"css"` \| `"tailwind"` \| `"json"` 数组，默认 `["css", "tailwind"]`）、`outputDir`（相对路径，默认 `"styles/matrix-theme"`）、`autoImportCss`（可选相对 `.css` 路径，如 `"src/index.css"`）。 |
| `list_matrix_presets` | 模型 | 列出 3 套内置黑绿变体及用户已保存的自定义预设（含关键色值与 WCAG 对比度通过情况）。参数：`{}`。 |
| `save_theme_state` / `reset_theme_state` | 仅 MCP App（`visibility: ["app"]`） | 由工作台 UI 内部调用以持久化或重置微调状态，**不对模型开放，切勿尝试直接调用**。 |

## 二、标准执行流程

1. **查看或挑选预设**：
   - 当用户询问“有哪些黑绿配色”“哪个护眼”时，可先调用 `list_matrix_presets({})` 获取当前已保存预设与内置 3 套变体的实时概况；若需要详细对照 41 项 Token 数值，阅读 [tokens-guide.md](./references/tokens-guide.md)。
   - 选型建议：
     - **Classic Phosphor (`classic-phosphor` / 经典荧光绿)**：`#040805` 深黑基底 + `#00FF41` 磷光绿，适合还原电影质感、演示、监控大屏。
     - **Zion Dark (`zion-dark` / 护眼暗绿)**：`#0A100D` 柔和暗灰绿基底 + `#34D38B` 翡翠绿，适合长时间编码与日常开发（默认推荐）。
     - **High Contrast CRT (`crt-high-contrast` / 高对比终端)**：`#000000` 纯黑基底 + `#39FF6A` 高亮绿，适合夜间低照度或最高对比度可读性需求。

2. **交互式预览、微调与一键写入项目**：
   - 用户希望“打开工作台 / 对比 3 套主题 / 自己调色 / 看数字雨”时，调用 `open_matrix_studio({ variant, tab })`；若用户明确想在对话流中看一张轻量预览卡，调用 `preview_matrix_card({ variant })`。
   - 工作台 **预览 (Preview)** 页签提供 **「⚡ 应用到项目」** 快捷按钮，可直接跳转到 **「应用与导出」** 页签顶部的 **「⚡ 一键应用到当前项目」** 卡片；用户在工作台填入目标项目目录、输出子目录（默认 `styles/matrix-theme`）、目标格式与可选入口 CSS 后，可直接触发写入并在结果列表点击 **「在侧边栏打开」** 查看生成文件。
   - 若用户在对话中直接要求“把黑绿主题应用/写入到我的项目目录 `<path>`”，可直接调用 `apply_matrix_theme_to_project({ projectDir, variant, overrides, targets, outputDir, autoImportCss })`，一次性写入 `matrix-theme.css`、`matrix-tailwind.css`、`matrix-tokens.json`，并在指定 `autoImportCss` 时安全幂等地向入口 CSS 前置 `@import`（同时记住用户最近的项目目录与输出偏好）。
   - 注意：工作台内部的数字雨强度、CRT 扫描线开关、自定义色值与自定义预设由用户直接在 Studio UI 中交互保存。

3. **导出纯文本配置**：
   - 用户只需在对话中查看或复制 CSS 变量、Tailwind v4 `@theme`、JSON 设计 Token、单文件 HTML 模板或 Antigravity 外观设置指南时，调用 `export_matrix_theme({ variant, format })`，并将导出的代码块与文件建议清晰呈现给用户。

## 三、Antigravity App `Settings > Appearance` 诚实边界说明

当用户要求“把整个 Antigravity 客户端变成黑客帝国绿主题”时，**必须如实说明平台边界**，不要虚构不存在的皮肤注入能力：

- **客观限制**：Antigravity 桌面端（Antigravity App / Electron 宿主）目前不对外暴露宿主客户端 CSS 变量覆写或自定义主题包 API，因此插件无法直接更改宿主窗口原生菜单栏、标题栏或全局聊天框的背景/文字颜色。
- **可行方案**：
  1. 引导用户在 Antigravity **Settings > Appearance** 中将外观设为 **Dark（深色）**，作为与黑绿主题最协调的宿主基底（详见 [tokens-guide.md](./references/tokens-guide.md) 第四节）。
  2. 在左侧栏、侧边栏 `+` 菜单或对话中打开 **Matrix Theme Studio**（独立隔离的 `color-scheme: only dark` 黑绿交互工作台）进行实时预览与调色。
  3. 通过工作台 **「应用与导出」** 页签的 **「⚡ 一键应用到当前项目」** 或调用 `apply_matrix_theme_to_project` / `export_matrix_theme`，将经 WCAG 审计达标的黑绿主题一键写入用户自己的项目代码库与 HTML Artifact 中。
