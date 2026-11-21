# Matrix Theme Studio — Antigravity 黑客帝国风黑绿主题工作台与插件

> 专为 Google Antigravity 打造的黑客帝国风黑绿主题开发工作台与即装插件（`matrix-theme`）：内置 3 套通过 WCAG 2.1 全项对比度门禁的黑绿配色、自包含零外链 MCP App 数字雨交互工作台、**⚡ 一键应用到当前项目（`apply_matrix_theme_to_project`）** 工程化落盘工具、5 格式导出器，以及赛博终端 UI 构建技能与自定义 Agent。
>
> GitHub 仓库：[https://github.com/StopCodeToTrain/antigravity-matrix-theme](https://github.com/StopCodeToTrain/antigravity-matrix-theme)

---

## 一、仓库目录结构

```text
.
├── package.json                          # 工作区依赖 (@modelcontextprotocol/sdk, ext-apps, zod, esbuild)
├── package-lock.json
├── src/
│   ├── themes/
│   │   ├── themes.mjs                    # 3 套主题变体定义、Hex 校验、Override 合并与 WCAG 2.1 审计
│   │   └── exporters.mjs                 # 5 格式导出器 (css / tailwind / json / antigravity-guide / html-template)
│   ├── mcp-server/
│   │   └── server.mjs                    # matrix-studio MCP 服务器源码（7 个工具 + ui:// 资源 + 原子持久化）
│   └── ui/
│       ├── index.html                    # MCP App Studio HTML 骨架
│       ├── styles.css                    # 现代 Web 规范样式（only dark / container queries / forced-colors / popover）
│       └── app.mjs                       # 数字雨 Canvas、预览/色板/微调/应用与导出 4 页签交互逻辑
├── tools/
│   └── build.mjs                         # esbuild 打包器：生成 mcp-server.cjs、单文件 matrix-studio.html 与 themes.json
├── tests/
│   └── verify-mcp.mjs                    # Stdio JSON-RPC 集成测试套件（[1/8]..[8/8]）
└── matrix-theme/                         # 可直接安装分发的 Antigravity 插件成品目录
    ├── plugin.json                       # 插件清单（含 homepage / repository / suggestedPrompts）
    ├── mcp_config.json                   # matrix-studio MCP 启动配置 (${PLUGIN_ROOT} / ${PLUGIN_DATA})
    ├── README.md                         # 插件包内说明文档
    ├── assets/
    │   ├── logo.svg                      # 256x256 黑底荧光绿矢量图标
    │   ├── matrix-studio.html            # 构建产物：自包含零外链单文件 MCP App
    │   └── themes.json                   # 构建产物：3 变体 Token 与 WCAG 审计数据
    ├── scripts/
    │   └── mcp-server.cjs                # 构建产物：Node 20 CJS 单文件 MCP 服务器
    ├── skills/
    │   ├── matrix-theme/
    │   │   ├── SKILL.md                  # /matrix-theme 技能
    │   │   └── references/tokens-guide.md
    │   └── matrix-ui-craft/
    │       └── SKILL.md                  # /matrix-ui-craft 赛博 UI 构建技能
    ├── agents/
    │   └── matrix-architect.md           # matrix-architect 自定义架构师 Agent
    └── rules/
        └── matrix-design-system.md       # 按需注入的黑绿设计系统规范
```

---

## 二、3 套黑绿主题变体与 WCAG 2.1 对比度审计

每套变体包含 **41 项**语义化设计 Token（表面、文字、强调色、边框、滚动条、状态、语法高亮、Git Diff 与数字雨），并经 `auditVariantContrast()` 对 **9 组**核心前景/背景组合（文字/强调色 `>= 4.5:1`，边框/滚动条 `>= 3.0:1`）进行严格审计：

| 变体 ID | 名称 | 核心底色 / 正文 / 强调色 | 数字雨与扫描线默认 | WCAG 2.1 实测 (9/9 全通过) |
| :--- | :--- | :--- | :--- | :--- |
| `classic-phosphor` | **Classic Phosphor · 经典荧光绿** | `#040805` / `#D9FFE2` / `#00FF41` | `subtle` / 开启扫描线 | 最低 `4.64:1`（`borderDefault` on `bgPrimary`），正文 `18.57:1` |
| `zion-dark` | **Zion Dark · 护眼暗绿** | `#0A100D` / `#E0F2E8` / `#34D38B` | `subtle` / 关闭扫描线 | 最低 `4.19:1`（`borderDefault` on `bgPrimary`），正文 `16.50:1` |
| `crt-high-contrast` | **High Contrast CRT · 高对比终端** | `#000000` / `#F0FFF4` / `#39FF6A` | `full` / 开启扫描线 | 最低 `10.95:1`（`scrollbarThumb` on `scrollbarTrack`），正文 `20.32:1` |

---

## 三、⚡ 一键应用到当前项目（`apply_matrix_theme_to_project`）

除了在线预览、调色微调（保存具名自定义预设）与 5 种格式导出外，工作台的 **「应用与导出」** 页签（及 Preview 页签 **「⚡ 应用到项目」** 快捷按钮）与 MCP 工具 `apply_matrix_theme_to_project` 支持将选定主题（含实时 Hex 微调）直接写入目标代码库：

- **支持写入目标（`targets`）**：
  - `css` -> `<outputDir>/matrix-theme.css`（`:root` + `[data-matrix-theme]` CSS 变量与 `color-scheme: only dark`）
  - `tailwind` -> `<outputDir>/matrix-tailwind.css`（Tailwind CSS v4 `@theme { --color-matrix-... }`）
  - `json` -> `<outputDir>/matrix-tokens.json`（完整设计 Token 与 WCAG 审计 JSON）
- **可选幂等自动引入（`autoImportCss`）**：指定项目现有 CSS 入口文件（如 `src/index.css`），自动在文件顶部（保留 `@charset`）幂等注入相对路径 `@import "..."；`，重复执行不会重复写入。
- **路径安全校验与持久化**：强制要求 `projectDir` 为已存在的绝对目录、`outputDir` 与 `autoImportCss` 严格受限于 `projectDir` 内部防止路径穿越，并原子化保存最近使用的 `lastProjectDir`、`lastOutputDir`、`lastTargets` 至 `${PLUGIN_DATA}/state.json`；UI 内提供 **「在侧边栏打开」** 快捷预览写入文件。

---

## 四、构建与测试命令

在仓库根目录执行（Windows PowerShell 下建议使用 `npm.cmd`）：

```powershell
# 1. 安装依赖
npm install

# 2. 打包生成 matrix-theme/scripts/mcp-server.cjs、matrix-studio.html 与 themes.json
npm run build

# 3. 运行 MCP 服务器 stdio JSON-RPC 全量集成测试（[1/8]..[8/8]）
node tests/verify-mcp.mjs

# 4. 运行 Antigravity 官方插件严格模式校验
agy plugin validate --strict ./matrix-theme
```

---

## 五、安装方式

### 方式 A：通过 Antigravity CLI 安装或从 GitHub 子目录获取

- 插件成品目录位于本仓库的 `matrix-theme/` 子目录：  
  [https://github.com/StopCodeToTrain/antigravity-matrix-theme/tree/main/matrix-theme](https://github.com/StopCodeToTrain/antigravity-matrix-theme/tree/main/matrix-theme)

克隆本仓库并安装 `matrix-theme` 插件：

```powershell
git clone https://github.com/StopCodeToTrain/antigravity-matrix-theme.git
cd antigravity-matrix-theme
agy plugin validate --strict ./matrix-theme
agy plugin install ./matrix-theme
```

> 若在 Windows 环境下遇到 `agy plugin install` 目录重命名文件锁（`Access is denied`），可直接将 `matrix-theme/` 目录复制到 `%USERPROFILE%\.gemini\config\plugins\matrix-theme`（无需修改 `config.json`），再通过 `agy plugin list --json` 确认加载状态。

### 方式 B：本地开发构建后同步

```powershell
npm install
npm run build
agy plugin validate --strict ./matrix-theme
```

启用后即可在 Antigravity 左侧栏全局入口、右侧辅助面板 `+` 菜单打开 **Matrix Theme Studio**，或在对话中使用 `/matrix-theme`、`/matrix-ui-craft` 与 `matrix-architect`。
