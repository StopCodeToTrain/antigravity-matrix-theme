/**
 * Matrix Theme Studio - Design Tokens, Variants, and WCAG 2.1 Contrast Auditing
 */

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Build structured Antigravity App Settings > Appearance guide for a theme variant.
 * @param {string} name
 * @param {string} nameZh
 * @param {Record<string, string>} tokens
 */
function buildAppearanceGuide(name, nameZh, tokens) {
  return {
    baseMode: "Dark",
    title: `Antigravity App Settings > Appearance 配置指南 (${name} / ${nameZh})`,
    summary:
      "在 Antigravity App 中打开 Settings > Appearance，将基础外观设为 Dark（深色），并按以下映射配置背景、面板、强调色、文字与边框色值。",
    steps: [
      "1. 打开 Antigravity App 的 Settings > Appearance。",
      "2. 将外观主题模式（Theme Mode）切换为 Dark（深色）。",
      "3. 根据下表复制十六进制 Hex 色值，填入对应界面颜色或自定义主题变量。",
      "4. 建议搭配等宽字体（Cascadia Code / JetBrains Mono / Fira Code）以获得最佳矩阵终端观感。"
    ],
    mappings: [
      {
        setting: "基础外观模式 (Theme Mode)",
        token: "colorScheme",
        value: "Dark",
        description: "锁定暗色外观与暗色系统滚动条 (color-scheme: only dark)"
      },
      {
        setting: "主画布背景 (Primary Background)",
        token: "bgPrimary",
        value: tokens.bgPrimary,
        description: "对话主区域与编辑器主底色"
      },
      {
        setting: "侧边栏/辅助面板 (Secondary Surface)",
        token: "bgSecondary",
        value: tokens.bgSecondary,
        description: "侧边栏、工具卡片与辅助窗格底色"
      },
      {
        setting: "悬浮层/菜单背景 (Elevated Surface)",
        token: "bgElevated",
        value: tokens.bgElevated,
        description: "下拉菜单、弹出面板与悬浮卡片底色"
      },
      {
        setting: "代码与终端背景 (Code Background)",
        token: "bgCode",
        value: tokens.bgCode,
        description: "代码块、Diff 区块与终端输出底色"
      },
      {
        setting: "主强调色 (Primary Accent)",
        token: "accentPrimary",
        value: tokens.accentPrimary,
        description: "主操作按钮、激活标签与高亮边框"
      },
      {
        setting: "键盘焦点环 (Focus Ring)",
        token: "ringFocus",
        value: tokens.ringFocus,
        description: "键盘导航焦点轮廓颜色"
      },
      {
        setting: "主文本色 (Primary Text)",
        token: "textPrimary",
        value: tokens.textPrimary,
        description: "正文、标题与代码默认文字色"
      },
      {
        setting: "次级文本色 (Secondary Text)",
        token: "textSecondary",
        value: tokens.textSecondary,
        description: "辅助说明、标签与次要信息文字色"
      },
      {
        setting: "弱化文本色 (Muted Text)",
        token: "textMuted",
        value: tokens.textMuted,
        description: "时间戳、注释与占位符文字色"
      },
      {
        setting: "默认边框色 (Default Border)",
        token: "borderDefault",
        value: tokens.borderDefault,
        description: "面板边框、分割线与输入框描边"
      },
      {
        setting: "文本选区背景 (Selection Background)",
        token: "selectionBg",
        value: tokens.selectionBg,
        description: "选中文本与高亮行背景色"
      },
      {
        setting: "滚动条滑块 (Scrollbar Thumb)",
        token: "scrollbarThumb",
        value: tokens.scrollbarThumb,
        description: "滚动条滑块颜色"
      },
      {
        setting: "滚动条轨道 (Scrollbar Track)",
        token: "scrollbarTrack",
        value: tokens.scrollbarTrack,
        description: "滚动条轨道底色"
      }
    ]
  };
}

const RAW_VARIANTS = [
  {
    id: "classic-phosphor",
    name: "Classic Phosphor",
    nameZh: "经典荧光绿",
    tagline: "P31 荧光 CRT 与经典黑客帝国数字雨终端",
    description:
      "忠实还原 1999 年 P31 荧光绿阴极射线管终端视觉风格，深邃墨绿底色搭配高纯度 #00FF41 荧光绿强调色与柔和数字雨。",
    rainDefaults: { intensity: "subtle", scanlines: true },
    tokens: {
      bgPrimary: "#040805",
      bgSecondary: "#09120B",
      bgTertiary: "#0F1D12",
      bgElevated: "#132617",
      bgCode: "#060D08",
      textPrimary: "#D9FFE2",
      textSecondary: "#8BE8A2",
      textMuted: "#5DA872",
      textInverse: "#030A05",
      textAccent: "#00FF41",
      accentPrimary: "#00FF41",
      accentHover: "#33FF66",
      accentActive: "#00D636",
      accentSubtle: "#0D2E16",
      ringFocus: "#5CFF85",
      selectionBg: "#124D22",
      borderSubtle: "#1D4A29",
      borderDefault: "#2D8A46",
      borderStrong: "#00E03A",
      scrollbarThumb: "#2DA84E",
      scrollbarTrack: "#08120A",
      success: "#00FF41",
      info: "#38E8C6",
      warning: "#F5C451",
      danger: "#FF5C77",
      syntaxKeyword: "#00FF41",
      syntaxString: "#9BFF7A",
      syntaxFunction: "#4CE8C2",
      syntaxType: "#72F29D",
      syntaxNumber: "#F5C451",
      syntaxVariable: "#D9FFE2",
      syntaxComment: "#5DA872",
      syntaxOperator: "#38E89A",
      syntaxProperty: "#98E8B5",
      syntaxPunctuation: "#78B88A",
      diffAddedBg: "#0A2B14",
      diffAddedText: "#6BFF91",
      diffRemovedBg: "#2E0F18",
      diffRemovedText: "#FF8599",
      rainHead: "#E2FFEA",
      rainTail: "#00FF41"
    }
  },
  {
    id: "zion-dark",
    name: "Zion Dark",
    nameZh: "护眼暗绿",
    tagline: "低眩光锡安主机暗绿，专为长时间编码打造",
    description:
      "降低荧光饱和度并柔化深绿对比层次，默认关闭扫描线以减少视觉疲劳，适合全天候高强度开发与阅读。",
    rainDefaults: { intensity: "subtle", scanlines: false },
    tokens: {
      bgPrimary: "#0A100D",
      bgSecondary: "#101A15",
      bgTertiary: "#16241D",
      bgElevated: "#1C2E25",
      bgCode: "#0C1410",
      textPrimary: "#E0F2E8",
      textSecondary: "#98C9AF",
      textMuted: "#6FA188",
      textInverse: "#07120C",
      textAccent: "#34D38B",
      accentPrimary: "#34D38B",
      accentHover: "#52E09E",
      accentActive: "#22B573",
      accentSubtle: "#143023",
      ringFocus: "#6EE7B0",
      selectionBg: "#1E4A36",
      borderSubtle: "#244737",
      borderDefault: "#3E8262",
      borderStrong: "#34D38B",
      scrollbarThumb: "#428F6B",
      scrollbarTrack: "#0E1712",
      success: "#34D38B",
      info: "#5FD4D4",
      warning: "#E6B85C",
      danger: "#F07184",
      syntaxKeyword: "#34D38B",
      syntaxString: "#A6E3A1",
      syntaxFunction: "#64D9C8",
      syntaxType: "#82DFB0",
      syntaxNumber: "#E6B85C",
      syntaxVariable: "#E0F2E8",
      syntaxComment: "#6FA188",
      syntaxOperator: "#54C796",
      syntaxProperty: "#A3D4BA",
      syntaxPunctuation: "#7EB098",
      diffAddedBg: "#112C1F",
      diffAddedText: "#7CE8B4",
      diffRemovedBg: "#2E151B",
      diffRemovedText: "#F598A6",
      rainHead: "#D8F5E5",
      rainTail: "#34D38B"
    }
  },
  {
    id: "crt-high-contrast",
    name: "High Contrast CRT",
    nameZh: "高对比终端",
    tagline: "纯黑 OLED 底色与锐利高对比荧光显示",
    description:
      "纯黑 #000000 底座配合超高明度荧光字符与强边框边界，默认开启全强度数字雨与 CRT 扫描线，满足极客与无障碍高对比需求。",
    rainDefaults: { intensity: "full", scanlines: true },
    tokens: {
      bgPrimary: "#000000",
      bgSecondary: "#061108",
      bgTertiary: "#0C1F10",
      bgElevated: "#102B16",
      bgCode: "#000000",
      textPrimary: "#F0FFF4",
      textSecondary: "#A8FFBC",
      textMuted: "#73D98C",
      textInverse: "#000000",
      textAccent: "#39FF6A",
      accentPrimary: "#39FF6A",
      accentHover: "#70FF94",
      accentActive: "#1AE04C",
      accentSubtle: "#0C3315",
      ringFocus: "#99FFB2",
      selectionBg: "#175C29",
      borderSubtle: "#2D8A46",
      borderDefault: "#39D660",
      borderStrong: "#66FF8C",
      scrollbarThumb: "#39E063",
      scrollbarTrack: "#061208",
      success: "#39FF6A",
      info: "#5CFFE8",
      warning: "#FFD84D",
      danger: "#FF6B81",
      syntaxKeyword: "#39FF6A",
      syntaxString: "#C2FF80",
      syntaxFunction: "#5CFFE8",
      syntaxType: "#8AFFA3",
      syntaxNumber: "#FFD84D",
      syntaxVariable: "#F0FFF4",
      syntaxComment: "#73D98C",
      syntaxOperator: "#5CFF88",
      syntaxProperty: "#B3FFC4",
      syntaxPunctuation: "#8CE0A0",
      diffAddedBg: "#083013",
      diffAddedText: "#80FF9E",
      diffRemovedBg: "#380D16",
      diffRemovedText: "#FF94A4",
      rainHead: "#FFFFFF",
      rainTail: "#39FF6A"
    }
  }
];

export const THEME_VARIANTS = RAW_VARIANTS.map((variant) => ({
  ...variant,
  rainDefaults: { ...variant.rainDefaults },
  tokens: { ...variant.tokens },
  appearanceGuide: buildAppearanceGuide(variant.name, variant.nameZh, variant.tokens)
}));

/**
 * Validate a strict 6-digit hex color string (#RRGGBB).
 * @param {unknown} hex
 * @returns {boolean}
 */
export function isValidHexColor(hex) {
  return typeof hex === "string" && HEX_COLOR_REGEX.test(hex);
}

/**
 * Return the matching theme variant or default to "classic-phosphor".
 * @param {string} [id]
 */
export function getVariantById(id) {
  if (typeof id === "string") {
    const found = THEME_VARIANTS.find((variant) => variant.id === id);
    if (found) return found;
  }
  return THEME_VARIANTS[0];
}

/**
 * Clone a theme variant and merge valid #RRGGBB token overrides without mutating the source.
 * @param {typeof THEME_VARIANTS[number]} variant
 * @param {Record<string, string>} [overrides]
 */
export function applyTokenOverrides(variant, overrides) {
  const source = variant && typeof variant === "object" && variant.tokens
    ? variant
    : getVariantById(typeof variant === "string" ? variant : undefined);

  const mergedTokens = { ...source.tokens };

  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    for (const [key, value] of Object.entries(overrides)) {
      if (Object.prototype.hasOwnProperty.call(mergedTokens, key) && isValidHexColor(value)) {
        mergedTokens[key] = value;
      }
    }
  }

  return {
    ...source,
    rainDefaults: source.rainDefaults ? { ...source.rainDefaults } : { intensity: "subtle", scanlines: true },
    tokens: mergedTokens,
    appearanceGuide: buildAppearanceGuide(source.name, source.nameZh || source.name, mergedTokens)
  };
}

/**
 * Parse #RRGGBB into [r, g, b] channels in 0..255.
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function parseHexChannels(hex) {
  if (!isValidHexColor(hex)) {
    throw new Error(`Invalid #RRGGBB hex color: ${String(hex)}`);
  }
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * Compute WCAG 2.1 relative luminance for a #RRGGBB hex color.
 * @param {string} hex
 * @returns {number}
 */
function relativeLuminance(hex) {
  const [r, g, b] = parseHexChannels(hex).map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Compute WCAG 2.1 contrast ratio between two #RRGGBB colors.
 * @param {string} hexA
 * @param {string} hexB
 * @returns {number}
 */
export function computeContrastRatio(hexA, hexB) {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

const CONTRAST_CHECKS = [
  { pair: "textPrimary on bgPrimary", fgKey: "textPrimary", bgKey: "bgPrimary", required: 4.5 },
  { pair: "textPrimary on bgSecondary", fgKey: "textPrimary", bgKey: "bgSecondary", required: 4.5 },
  { pair: "textSecondary on bgPrimary", fgKey: "textSecondary", bgKey: "bgPrimary", required: 4.5 },
  { pair: "textMuted on bgPrimary", fgKey: "textMuted", bgKey: "bgPrimary", required: 4.5 },
  { pair: "textInverse on accentPrimary", fgKey: "textInverse", bgKey: "accentPrimary", required: 4.5 },
  { pair: "accentPrimary on bgPrimary", fgKey: "accentPrimary", bgKey: "bgPrimary", required: 4.5 },
  { pair: "borderDefault on bgPrimary", fgKey: "borderDefault", bgKey: "bgPrimary", required: 3.0 },
  { pair: "scrollbarThumb on scrollbarTrack", fgKey: "scrollbarThumb", bgKey: "scrollbarTrack", required: 3.0 },
  { pair: "scrollbarThumb on bgPrimary", fgKey: "scrollbarThumb", bgKey: "bgPrimary", required: 3.0 }
];

/**
 * Classify a contrast ratio into WCAG conformance level.
 * @param {number} ratio
 * @returns {"AAA" | "AA" | "AA-Large" | "FAIL"}
 */
function classifyContrastLevel(ratio) {
  if (ratio >= 7.0) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3.0) return "AA-Large";
  return "FAIL";
}

/**
 * Audit the 9 critical foreground/background token pairs against WCAG 2.1 thresholds.
 * @param {Record<string, string> | { tokens: Record<string, string> }} tokens
 */
export function auditVariantContrast(tokens) {
  const resolvedTokens = tokens && typeof tokens === "object" && tokens.tokens ? tokens.tokens : tokens;

  return CONTRAST_CHECKS.map(({ pair, fgKey, bgKey, required }) => {
    const fg = resolvedTokens?.[fgKey];
    const bg = resolvedTokens?.[bgKey];

    if (!isValidHexColor(fg) || !isValidHexColor(bg)) {
      return {
        pair,
        fg: fg ?? "",
        bg: bg ?? "",
        ratio: 0,
        level: "FAIL",
        required,
        passed: false
      };
    }

    const rawRatio = computeContrastRatio(fg, bg);
    const ratio = Math.round(rawRatio * 100) / 100;
    return {
      pair,
      fg,
      bg,
      ratio,
      level: classifyContrastLevel(rawRatio),
      required,
      passed: rawRatio >= required
    };
  });
}
