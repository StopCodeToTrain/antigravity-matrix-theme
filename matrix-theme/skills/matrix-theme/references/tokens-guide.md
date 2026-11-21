# Matrix Theme Studio 设计 Token 与外观配置参考指南

本文档汇总 **Matrix Theme Studio** 插件内置的 3 套黑客帝国风（Matrix）黑绿配色变体的完整设计 Token、WCAG 2.1 对比度审计标准，以及 Antigravity App `Settings > Appearance` 的分步配置与边界说明。

---

## 一、三套内置变体概览

| 变体 ID | 英文名 / 中文名 | 默认数字雨 / 扫描线 | 适用场景 |
| :--- | :--- | :--- | :--- |
| `classic-phosphor` | Classic Phosphor / 经典荧光绿 | `subtle` / `scanlines: true` | 经典黑客帝国 CRT 绿磷光视觉、高辨识度终端展示、演示面板 |
| `zion-dark` | Zion Dark / 护眼暗绿 | `subtle` / `scanlines: false` | 长时间编码、代码审阅、文档与复杂仪表盘（低视觉疲劳） |
| `crt-high-contrast` | High Contrast CRT / 高对比终端 | `full` / `scanlines: true` | 暗室/夜间高对比场景、无障碍高可读终端、关键监控告警屏 |

---

## 二、完整 Token 配色对照表

### 1. 表面、文字、强调色与边框（核心 25 项）

| Token 键名 | 用途说明 | `classic-phosphor` (经典荧光绿) | `zion-dark` (护眼暗绿) | `crt-high-contrast` (高对比终端) |
| :--- | :--- | :--- | :--- | :--- |
| `bgPrimary` | 主画布背景 | `#040805` | `#0A100D` | `#000000` |
| `bgSecondary` | 次级面板 / 卡片背景 | `#09120B` | `#101A15` | `#061108` |
| `bgTertiary` | 交互控件 / 悬浮底色 | `#0F1D12` | `#16241D` | `#0C1F10` |
| `bgElevated` | 浮层 / 弹出菜单背景 | `#132617` | `#1C2E25` | `#102B16` |
| `bgCode` | 代码块与终端区背景 | `#060D08` | `#0C1410` | `#000000` |
| `textPrimary` | 主正文文字 | `#D9FFE2` | `#E0F2E8` | `#F0FFF4` |
| `textSecondary` | 次要说明 / 标签文字 | `#8BE8A2` | `#98C9AF` | `#A8FFBC` |
| `textMuted` | 辅助 / 占位 / 注释文字 | `#5DA872` | `#6FA188` | `#73D98C` |
| `textInverse` | 实心强调按钮上反色文字 | `#030A05` | `#07120C` | `#000000` |
| `textAccent` | 强调链接 / 高亮文字 | `#00FF41` | `#34D38B` | `#39FF6A` |
| `accentPrimary` | 主品牌强调色 | `#00FF41` | `#34D38B` | `#39FF6A` |
| `accentHover` | 主强调色悬停态 | `#33FF66` | `#52E09E` | `#70FF94` |
| `accentActive` | 主强调色按下态 | `#00D636` | `#22B573` | `#1AE04C` |
| `accentSubtle` | 柔和强调标签底色 | `#0D2E16` | `#143023` | `#0C3315` |
| `ringFocus` | 键盘 `:focus-visible` 焦点环 | `#5CFF85` | `#6EE7B0` | `#99FFB2` |
| `selectionBg` | 文本选区高亮背景 | `#124D22` | `#1E4A36` | `#175C29` |
| `borderSubtle` | 弱分割线 | `#1D4A29` | `#244737` | `#2D8A46` |
| `borderDefault` | 默认卡片 / 输入框边框 | `#2D8A46` | `#3E8262` | `#39D660` |
| `borderStrong` | 强边界 / 激活边框 | `#00E03A` | `#34D38B` | `#66FF8C` |
| `scrollbarThumb` | 滚动条滑块 | `#2DA84E` | `#428F6B` | `#39E063` |
| `scrollbarTrack` | 滚动条轨道 | `#08120A` | `#0E1712` | `#061208` |
| `success` | 成功 / 达标状态色 | `#00FF41` | `#34D38B` | `#39FF6A` |
| `info` | 信息 / 遥测提示色 | `#38E8C6` | `#5FD4D4` | `#5CFFE8` |
| `warning` | 警告状态色 | `#F5C451` | `#E6B85C` | `#FFD84D` |
| `danger` | 错误 / 危险告警色 | `#FF5C77` | `#F07184` | `#FF6B81` |

### 2. 语法高亮、Git Diff 与数字雨 Token（16 项）

| Token 键名 | 用途说明 | `classic-phosphor` | `zion-dark` | `crt-high-contrast` |
| :--- | :--- | :--- | :--- | :--- |
| `syntaxKeyword` | 关键字 | `#00FF41` | `#34D38B` | `#39FF6A` |
| `syntaxString` | 字符串字面量 | `#9BFF7A` | `#A6E3A1` | `#C2FF80` |
| `syntaxFunction` | 函数名 / 方法调用 | `#4CE8C2` | `#64D9C8` | `#5CFFE8` |
| `syntaxType` | 类型 / 类名 | `#72F29D` | `#82DFB0` | `#8AFFA3` |
| `syntaxNumber` | 数值 / 常量 | `#F5C451` | `#E6B85C` | `#FFD84D` |
| `syntaxVariable` | 变量 / 标识符 | `#D9FFE2` | `#E0F2E8` | `#F0FFF4` |
| `syntaxComment` | 注释 | `#5DA872` | `#6FA188` | `#73D98C` |
| `syntaxOperator` | 运算符 | `#38E89A` | `#54C796` | `#5CFF88` |
| `syntaxProperty` | 属性 / 字段名 | `#98E8B5` | `#A3D4BA` | `#B3FFC4` |
| `syntaxPunctuation` | 标点与定界符 | `#78B88A` | `#7EB098` | `#8CE0A0` |
| `diffAddedBg` | Diff 新增行背景 | `#0A2B14` | `#112C1F` | `#083013` |
| `diffAddedText` | Diff 新增行前景色 | `#6BFF91` | `#7CE8B4` | `#80FF9E` |
| `diffRemovedBg` | Diff 删除行背景 | `#2E0F18` | `#2E151B` | `#380D16` |
| `diffRemovedText` | Diff 删除行前景色 | `#FF8599` | `#F598A6` | `#FF94A4` |
| `rainHead` | 数字雨首字符亮斑 | `#E2FFEA` | `#D8F5E5` | `#FFFFFF` |
| `rainTail` | 数字雨拖尾主色 | `#00FF41` | `#34D38B` | `#39FF6A` |

---

## 三、WCAG 2.1 对比度审计基线（9 项强制检查）

所有内置变体与自定义覆盖均需通过以下 9 组对比度门禁：

| 序号 | 检查组合（前景色 on 背景色） | 最低对比度要求 | 规范级别 |
| :--- | :--- | :--- | :--- |
| 1 | `textPrimary` on `bgPrimary` | `>= 4.5:1` | WCAG AA / AAA 正文 |
| 2 | `textPrimary` on `bgSecondary` | `>= 4.5:1` | WCAG AA / AAA 正文 |
| 3 | `textSecondary` on `bgPrimary` | `>= 4.5:1` | WCAG AA 正文 |
| 4 | `textMuted` on `bgPrimary` | `>= 4.5:1` | WCAG AA 辅助文字 |
| 5 | `textInverse` on `accentPrimary` | `>= 4.5:1` | WCAG AA 实心按钮反色文字 |
| 6 | `accentPrimary` on `bgPrimary` | `>= 4.5:1` | WCAG AA 强调文字/图标 |
| 7 | `borderDefault` on `bgPrimary` | `>= 3.0:1` | WCAG AA 非文本 UI 边框 |
| 8 | `scrollbarThumb` on `scrollbarTrack` | `>= 3.0:1` | WCAG AA 滚动条可辨识度 |
| 9 | `scrollbarThumb` on `bgPrimary` | `>= 3.0:1` | WCAG AA 控件对比度 |

---

## 四、Antigravity App `Settings > Appearance` 分步配置指南

### 边界说明（必读）

Antigravity 桌面端目前在 `Settings > Appearance` 中主要提供**主题模式（Dark / Light）**与**对话栏宽度**等原生外观选项，**不对外提供覆盖宿主桌面客户端自身 CSS 变量的第三方皮肤 API**。

因此，请勿误导用户“插件可一键接管 Antigravity 宿主窗口全部像素”；正确的使用方式如下：

1. **开启宿主暗色基底**：
   - 打开 Antigravity 左侧栏底部的 **Settings（设置）** 图标。
   - 进入 **Appearance（外观）** 分区，将主题模式切换为 **Dark（深色）**（如使用宽屏终端对比，可按需调整 Conversation Width）。
2. **使用 Matrix Theme Studio 隔离工作台**：
   - 在左侧栏、侧边栏 `+` 菜单打开 **Matrix Theme Studio**，或在对话中调用 `open_matrix_studio` / `preview_matrix_card`。
   - 工作台通过 `color-scheme: only dark` 在沙盒内呈现纯正黑绿数字雨界面，并支持 3 套变体切换、6 项核心色实时微调与状态持久化。
3. **导出并同步至周边开发环境**：
   - 需要将同一套黑绿配色应用到你的终端、IDE 主题、个人网页或 HTML Artifact 时，在工作台 **导出（Export）** 页签或通过 `export_matrix_theme` 获取 `css` / `tailwind` / `json` / `antigravity-guide` / `html-template` 配置。
   - 推荐默认使用 **Zion Dark（护眼暗绿）** 作为全天候编码配色，以 `#0A100D` 基底配合 `#34D38B` 强调色减少长时间注视荧光绿带来的视觉残影。
