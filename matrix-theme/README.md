# Matrix Theme Studio (`matrix-theme`)

> 黑客帝国风黑绿主题工作台与设计系统 Antigravity 插件：内置 3 套经过 WCAG 2.1 对比度门禁审计的黑绿配色方案、实时数字雨 MCP App 交互工作台、**⚡ 一键应用到当前项目**落盘工具、多格式 Token 导出器，以及赛博终端 UI 构建技能与架构师 Agent。
>
> GitHub 仓库：[https://github.com/StopCodeToTrain/antigravity-matrix-theme](https://github.com/StopCodeToTrain/antigravity-matrix-theme)

---

## 一、三套黑绿主题变体与设计理念

本插件针对不同使用时长与视觉环境，提供 3 套互为补充的黑绿配色方案，全部 9 组核心文字/控件对比度（正文 `>= 4.5:1`、边框与滚动条 `>= 3.0:1`）均通过自动化 WCAG 2.1 审计：

| 变体 ID | 名称 | 核心基底 & 强调色 | 数字雨 / 扫描线默认 | 设计理念与适用场景 |
| :--- | :--- | :--- | :--- | :--- |
| `classic-phosphor` | **Classic Phosphor · 经典荧光绿** | 背景 `#040805` / 正文 `#D9FFE2` / 强调 `#00FF41` | `subtle` / 开启扫描线 | 致敬经典 CRT 绿色荧光管质感，高辨识度磷光点缀，适合实时监控大屏、终端演示与主题预览。 |
| `zion-dark` | **Zion Dark · 护眼暗绿** | 背景 `#0A100D` / 正文 `#E0F2E8` / 强调 `#34D38B` | `subtle` / 关闭扫描线 | 降低纯黑与高饱和荧光绿带来的刺眼眩光，以深灰绿与翡翠绿平衡对比，适合长时间编码与阅读（日常默认推荐）。 |
| `crt-high-contrast` | **High Contrast CRT · 高对比终端** | 背景 `#000000` / 正文 `#F0FFF4` / 强调 `#39FF6A` | `full` / 开启扫描线 | 纯黑底色叠加高亮度磷光前景色，最大化信噪比，适合夜间暗室环境、高可见度终端与无障碍优先场景。 |

---

## 二、MCP App 交互工作台入口

插件通过内置的 `matrix-studio` MCP 服务器提供符合 Antigravity MCP Apps 规范的交互式界面（自包含单文件 HTML，严格兼容 `default-src 'none'` CSP 与 `color-scheme: only dark`）：

1. **左侧栏全局入口（Global View）**：
   - 在 Antigravity 左侧导航栏中可直接打开 **Matrix Theme Studio**（`global` 入口），以全屏工作台视图浏览 3 套变体、实时对比 41 项设计 Token、在线调色并持久化自定义预设。
2. **侧边栏 `+` 辅助面板（Auxiliary Pane）**：
   - 点击右侧辅助面板的 `+` 菜单选择 **Matrix Theme Studio**（`aux_pane` 入口），或让 Agent 调用 `open_matrix_studio` 工具，即可在编码/对话旁常驻打开黑绿主题工作台。
3. **对话内联预览卡（Inline Preview Card）**：
   - 让 Agent 调用 `preview_matrix_card` 工具时，将在对话消息流内渲染紧凑型内联卡片（`mode: "inline"`），支持一键切换变体、查看终端与 Git Diff 样例、复制关键色值及查看 WCAG 审计摘要。

### 工作台四大功能页签
- **预览 (Preview)**：实时渲染模拟聊天卡片、语法高亮代码块、Git Diff 对比视图与 WCAG 对比度通过概览，搭配可开关的 HTML5 `<canvas>` 数字雨（自动响应 `prefers-reduced-motion`）与 CRT 扫描线，并提供 **「⚡ 应用到项目」** 快捷按钮一键直达项目落盘表单。
- **色板与外观 (Palette)**：按表面、文字、强调色、边框、语法、Diff 分组展示可点击复制的色块，附带完整 9 项 WCAG 对比度实时计算表与 **Antigravity App `Settings > Appearance` 快速配置卡**。
- **微调 (Customizer)**：支持用原生取色器或 `#RRGGBB` 输入框实时调整 6 项核心 Token（`bgPrimary`、`bgSecondary`、`accentPrimary`、`textPrimary`、`borderDefault`、`syntaxKeyword`），并可将微调结果保存为具名自定义预设（持久化于 `${PLUGIN_DATA}/state.json`）或一键重置。
- **应用与导出 (Apply & Export)**：
  - **⚡ 一键应用到当前项目**：输入目标项目绝对路径（`projectDir`）、输出子目录（`outputDir`，默认 `styles/matrix-theme`）、目标文件（`css` / `tailwind` / `json`）以及可选入口 CSS（`autoImportCss`，如 `src/index.css`），点击 **「⚡ 一键写入项目主题文件」** 即可原子化生成 `matrix-theme.css`、`matrix-tailwind.css` 与 `matrix-tokens.json`，并自动幂等前置 `@import`；生成后可点击 **「在侧边栏打开」** 直接预览写入的文件（同时在 `${PLUGIN_DATA}/state.json` 记住最近的项目路径偏好）。
  - **多格式导出与对话联动**：一键生成并复制 `CSS Variables`、`Tailwind v4 (@theme)`、`JSON Tokens`、`Appearance 指南` 与零外链单文件 `HTML Artifact 模板`；在支持会话能力的视图中，还可通过 **附加主题到对话** / **发送到对话生成界面** 直接联动当前对话。

---

## 三、Antigravity App `Settings > Appearance` 边界说明与配色方法

> **透明说明**：Antigravity 桌面端（Electron 宿主）目前不提供允许第三方插件注入或覆写宿主窗口原生 CSS 变量的皮肤 API，因此本插件**不会**（也无法）强行修改 Antigravity 宿主客户端自身的顶栏、侧栏或聊天框样式。但对于**你自己的前端/Web 项目代码库**与 **AI 生成的 UI / HTML Artifact**，已支持通过 **「⚡ 一键应用到当前项目」**（`apply_matrix_theme_to_project`）一站式注入主题。

建议按以下方式搭配使用，获得最佳黑绿主题体验：

1. 在 Antigravity 左侧栏进入 **Settings > Appearance**，将客户端外观模式切换为 **Dark（深色）**，使宿主框架与黑绿面板自然衔接。
2. 通过侧边栏 `+` 面板或左侧栏入口开启 **Matrix Theme Studio**，使用内部 `color-scheme: only dark` 隔离工作台进行调色与预览。
3. 在工作台 **「应用与导出」** 页签使用 **「⚡ 一键应用到当前项目」**（或让 Agent 调用 `apply_matrix_theme_to_project` / `export_matrix_theme`），将经 WCAG 审计达标的黑绿主题一键写入你的前端工程、终端配置或 HTML Artifact 中。

---

## 四、内置技能、斜杠命令与自定义组件

安装并启用 `matrix-theme` 插件后，将自动装配以下能力：

| 组件类型 | 名称 | 用途说明 |
| :--- | :--- | :--- |
| **技能 / 斜杠命令** | `/matrix-theme` | 引导 Agent 调用 `open_matrix_studio`、`preview_matrix_card`、`export_matrix_theme`、`apply_matrix_theme_to_project` 与 `list_matrix_presets`，完成主题对比、一键项目写入与外观指导。 |
| **技能 / 斜杠命令** | `/matrix-ui-craft` | 黑绿赛博终端界面精雕技能，约束等宽排版、克制磷光辉光、`prefers-reduced-motion` 数字雨礼仪、WCAG 对比度及零外链自包含 HTML Artifact 规范。 |
| **自定义 Agent** | `matrix-architect` | 黑客帝国主题与界面架构专家（同时支持作为主 Agent 与子 Agent 调用，自动继承 MCP 工具与插件定制）。 |
| **按需规则** | `matrix-design-system` | `model_decision` 自动触发规则：当用户请求编写黑绿赛博风网页、仪表盘或 Artifact 时自动注入核心配色与无障碍红线。 |
| **MCP 服务器** | `matrix-studio` | 提供 7 个工具：`open_matrix_studio`、`preview_matrix_card`、`export_matrix_theme`、`apply_matrix_theme_to_project`、`list_matrix_presets`，以及 App 内部持久化工具 `save_theme_state` / `reset_theme_state`。 |

### 常用对话示例
- `打开 Matrix Theme Studio 预览并对比 3 套黑客帝国黑绿主题`
- `导出护眼暗绿 (Zion Dark) 的 CSS 变量与 Tailwind v4 主题配置`
- `使用黑客帝国黑绿设计系统生成一个实时系统监控 HTML Artifact 仪表盘`

---

## 五、插件结构、严格验证与本地安装

### 目录结构
```text
matrix-theme/
├── plugin.json                              # Antigravity 插件清单
├── mcp_config.json                          # matrix-studio MCP 服务器配置
├── README.md                                # 插件说明文档
├── assets/
│   ├── logo.svg                             # 256x256 矢量图标
│   ├── matrix-studio.html                   # 构建生成的自包含 MCP App HTML
│   └── themes.json                          # 构建生成的 3 变体 Token 与 WCAG 审计数据
├── scripts/
│   └── mcp-server.cjs                       # 构建生成的 MCP 服务器 CJS 单文件产物
├── skills/
│   ├── matrix-theme/
│   │   ├── SKILL.md
│   │   └── references/tokens-guide.md
│   └── matrix-ui-craft/
│       └── SKILL.md
├── agents/
│   └── matrix-architect.md
└── rules/
    └── matrix-design-system.md
```

### 校验与本地安装命令（Windows PowerShell）

在开发仓库根目录完成构建（`npm.cmd run build`）后，可执行以下命令进行严格校验与安装：

```powershell
# 1. 严格模式校验（零错误、零警告即通过）
agy.exe plugin validate --strict --json e:\computerCtrl\matrix-theme

# 2. 本地安装插件
agy.exe plugin install e:\computerCtrl\matrix-theme

# 3. 查看已安装插件与启用状态
agy.exe plugin list --json
```
