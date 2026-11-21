---
trigger: model_decision
description: 当用户要求设计、编写或美化黑客帝国风（Matrix）、黑绿赛博终端风格的网页、仪表盘、Artifact 或 CSS 主题 Token 时启用。
---

# Matrix Black-Green Design System Rule

当生成或修改黑客帝国风（Matrix）黑绿赛博终端网页、仪表盘、HTML Artifact 或 CSS 主题 Token 时，必须遵守以下规范：

1. **采用三套规范调色板之一**（避免自行拼凑低对比暗绿或刺眼 `#00FF00`）：
   - **经典荧光绿 (`classic-phosphor`)**：主背景 `#040805`、次背景 `#09120B`、主文字 `#D9FFE2`、次文字 `#8BE8A2`、辅助文字 `#5DA872`、主强调 `#00FF41`、默认边框 `#2D8A46`。
   - **护眼暗绿 (`zion-dark`)**（长时间阅读优先）：主背景 `#0A100D`、次背景 `#101A15`、主文字 `#E0F2E8`、次文字 `#98C9AF`、辅助文字 `#6FA188`、主强调 `#34D38B`、默认边框 `#3E8262`。
   - **高对比终端 (`crt-high-contrast`)**：主背景 `#000000`、次背景 `#061108`、主文字 `#F0FFF4`、次文字 `#A8FFBC`、辅助文字 `#73D98C`、主强调 `#39FF6A`、默认边框 `#39D660`。

2. **强制暗色与原生控件隔离**：
   - 在 `:root` 与主表面容器同时声明 `color-scheme: only dark;`，并显式指定暗色 `background` 与亮色 `color`，确保原生滚动条和表单控件不会在浅色宿主环境中退化为白底。

3. **WCAG 对比度与状态非单色编码**：
   - 正文、次要文字、辅助文字及实心按钮反色文字均须达到 `>= 4.5:1` 对比度；边框、分隔线与滚动条滑块均须达到 `>= 3.0:1`。
   - 成功/警告/错误/离线等状态必须同时配备文字或符号图标，不得仅依靠颜色传达，并兼容 `@media (forced-colors: active)`。

4. **节制辉光与 `prefers-reduced-motion` 支持**：
   - 磷光 `box-shadow` 仅用于边框、状态徽章与 `:focus-visible` 焦点环，禁止向正文代码或段落添加影响字形辨识的 `text-shadow`。
   - 若包含 `<canvas>` 数字雨或 CRT 扫描线动画，必须响应 `@media (prefers-reduced-motion: reduce)`（停止动画循环与闪烁效果）并在页面不可见时暂停渲染。

5. **Antigravity Artifact 自包含零外链**：
   - 生成的 HTML Artifact 必须将全部 CSS 与 JS 内联在单个文件中，**严禁**引入任何外部 `http://` 或 `https://` `<script>`、`<link>`、`@import` 或外部 `fetch()`，以兼容严格 CSP（`default-src 'none'`）。
