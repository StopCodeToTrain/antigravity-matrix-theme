---
name: matrix-ui-craft
description: 黑客帝国风（Matrix）黑绿赛博终端 UI 与 HTML Artifact 精雕技能。当用户要求构建黑绿风格的 HTML Artifact、实时监控仪表盘、终端风格数据看板、代码/Diff 展示面板或设计系统组件时使用。
---

# Matrix UI Craft 黑绿赛博界面构建规范

本技能用于在生成黑客帝国风（Matrix）HTML Artifact、Web 仪表盘、终端微件和设计系统组件时，确保界面兼具电影级 CRT 科技质感、严苛的无障碍可读性与 Antigravity 沙盒 CSP 安全性。

## 一、变体选型与 Token 获取

在编写界面代码前，优先按场景选择内置变体之一（详见 [tokens-guide.md](../matrix-theme/references/tokens-guide.md)），切勿凭空拼凑高饱和刺眼荧光绿（如 `#00FF00` 配纯白或低对比度暗绿字）：

- **`classic-phosphor`（经典荧光绿）**：`#040805` 主背景、`#09120B` 卡片底、`#D9FFE2` 正文、`#00FF41` 主强调、`#2D8A46` 边框。适合高辨识度赛博仪表盘与终端展示。
- **`zion-dark`（护眼暗绿）**：`#0A100D` 主背景、`#101A15` 卡片底、`#E0F2E8` 正文、`#34D38B` 主强调、`#3E8262` 边框。适合信息密度高、需要长时间阅读的数据看板与开发工具。
- **`crt-high-contrast`（高对比终端）**：`#000000` 纯黑背景、`#061108` 卡片底、`#F0FFF4` 正文、`#39FF6A` 主强调、`#39D660` 边框。适合极暗环境与最高无障碍对比度需求。

需要快速起步代码时，可调用 `matrix-studio` MCP 工具 `export_matrix_theme({ variant, format: "html-template" })` 或 `export_matrix_theme({ variant, format: "css" })` 获取经过 WCAG 审计的开箱即用变量与骨架。

## 二、视觉与排版纪律

### 1. 强制暗色声明与字体栈
- 在 `:root` 与主容器同时声明 `color-scheme: only dark;` 并显式设置 `background: var(--bg-primary); color: var(--text-primary);`，防止宿主的浅色主题导致原生滚动条、`<input>` 或 `<select>` 出现刺眼白底。
- 等宽数据与终端区使用系统零依赖字体栈：
  ```css
  font-family: "Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, ui-monospace, monospace;
  ```
- 所有指标数字、时间戳、延迟与对比度比值统一开启 `font-variant-numeric: tabular-nums;`，避免实时刷新时数值左右抖动；正文最小字号保持在 `12px` 以上（主体建议 `13px–14px`）。

### 2. 克制的磷光辉光（Phosphor Glow Discipline）
- **允许发光的位置**：卡片激活边框、状态指示灯、按钮 `:hover` 与 `:focus-visible` 轮廓（使用柔和的 `box-shadow: 0 0 12px rgba(0, 255, 65, 0.18)`）。
- **禁止过度发光的位置**：正文段落、表格单元格、代码块文本**禁止**添加大半径 `text-shadow`，以免绿色光晕糊化字形边缘、损伤阅读清晰度。

### 3. 数字雨与扫描线礼仪（`prefers-reduced-motion`）
- `<canvas>` 数字雨作为背景层时，必须控制透明度与密度（`pointer-events: none`，置于内容卡片下方，建议整体视觉透明度 `<= 0.16`），保证前景文字无干扰。
- **必须监听并响应减少动态效果偏好**：
  - CSS 层：在 `@media (prefers-reduced-motion: reduce)` 中关闭动画、扫描线闪烁与长耗时过渡。
  - JS 层：当 `window.matchMedia('(prefers-reduced-motion: reduce)').matches` 为真或 `document.visibilityState === 'hidden'` 时，停止 `requestAnimationFrame` 循环（可仅绘制一帧静态微弱字符或保持静止），切勿空转消耗 CPU/GPU。

## 三、WCAG 对比度与非单一色彩编码

- **文字对比度**：正文与辅助说明（`textPrimary`、`textSecondary`、`textMuted`）以及反色按钮文字（`textInverse` on `accentPrimary`）均须满足 `>= 4.5:1`。
- **控件与边框对比度**：输入框边框、卡片描边、滚动条滑块与轨道间对比度均须满足 `>= 3.0:1`。
- **禁止仅靠颜色表达状态**：所有监控告警、WCAG 等级与连接状态必须同时包含文本标签或符号图标（例如 `[OK]`、`[WARN]`、`[FAIL]`、`AAA`、`AA`），并在 `@media (forced-colors: active)` 下兼容系统高对比色关键字。

## 四、Antigravity HTML Artifact 与 CSP 合规清单

1. **零外链自包含（Zero External CDN）**：生成的黑绿主题独立 HTML Artifact 与 MCP App 必须将全部 CSS 与 JS 内联在单个 `.html` 文件中，**严禁**引用任何外部 `http://` / `https://` `<script>`、`<link>`、`@import` 或远程字体/图片，也不要发起外部 `fetch()`，确保在 `default-src 'none'` CSP 下完美渲染。
2. **布局尺寸自觉**：
   - 若作为对话内联 `<agent-embed>` 展示，必须保持紧凑（目标高度 `<= 450px`，上限 `800px`），**禁止**在顶层容器使用 `100vh`、`h-screen` 或 `height: 100%`。
   - 若为多面板仪表盘、宽表格或全屏数据看板（高度 `> 450px`），应作为独立侧边栏 Artifact 交付，提供响应式网格（推荐结合 `container-type: inline-size` 与 `@container` 查询适配不同栏宽）。
