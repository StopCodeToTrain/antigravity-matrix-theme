import { applyTokenOverrides, auditVariantContrast, getVariantById } from "./themes.mjs";

const SUPPORTED_FORMATS = new Set([
  "css",
  "tailwind",
  "json",
  "antigravity-guide",
  "html-template"
]);

/**
 * Convert a camelCase token key into kebab-case.
 * @param {string} key
 * @returns {string}
 */
function toKebabCase(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Escape HTML special characters for safe embedding inside HTML templates.
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render CSS custom properties lines for a token dictionary.
 * @param {Record<string, string>} tokens
 * @param {string} prefix
 * @returns {string}
 */
function formatTokenLines(tokens, prefix) {
  return Object.entries(tokens)
    .map(([key, value]) => `  ${prefix}${toKebabCase(key)}: ${value};`)
    .join("\n");
}

function renderCssExport(themed) {
  const tokenLines = formatTokenLines(themed.tokens, "--");
  const content = `/* Matrix Theme Studio — ${themed.name} (${themed.nameZh}) */
/* ${themed.tagline} */

:root,
[data-matrix-theme="${themed.id}"] {
  color-scheme: only dark;

${tokenLines}

  --font-matrix-mono: "Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, ui-monospace, monospace;
  --font-matrix-sans: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

[data-matrix-theme="${themed.id}"] {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-matrix-sans);
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  scrollbar-width: thin;
}

@supports not (scrollbar-color: auto) {
  [data-matrix-theme="${themed.id}"] {
    scrollbar-width: auto;
  }

  [data-matrix-theme="${themed.id}"]::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  [data-matrix-theme="${themed.id}"]::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  [data-matrix-theme="${themed.id}"]::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }
}

[data-matrix-theme="${themed.id}"] ::selection {
  background: var(--selection-bg);
  color: var(--text-primary);
}
`;

  return {
    format: "css",
    filename: `matrix-${themed.id}.css`,
    language: "css",
    content
  };
}

function renderTailwindExport(themed) {
  const tokenLines = formatTokenLines(themed.tokens, "--color-matrix-");
  const content = `/* Tailwind CSS v4 @theme tokens — ${themed.name} (${themed.nameZh}) */

@theme {
${tokenLines}

  --font-matrix-mono: "Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, ui-monospace, monospace;
  --font-matrix-sans: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

:root,
[data-matrix-theme="${themed.id}"] {
  color-scheme: only dark;
}
`;

  return {
    format: "tailwind",
    filename: `matrix-${themed.id}.tailwind.css`,
    language: "css",
    content
  };
}

function renderJsonExport(themed, contrastAudit) {
  const payload = {
    id: themed.id,
    name: themed.name,
    nameZh: themed.nameZh,
    tagline: themed.tagline,
    description: themed.description,
    colorScheme: "only dark",
    rainDefaults: themed.rainDefaults,
    tokens: themed.tokens,
    contrastAudit,
    appearanceGuide: themed.appearanceGuide
  };

  return {
    format: "json",
    filename: `matrix-${themed.id}.tokens.json`,
    language: "json",
    content: `${JSON.stringify(payload, null, 2)}\n`
  };
}

function renderAntigravityGuideExport(themed, contrastAudit) {
  const guide = themed.appearanceGuide;
  const mappingRows = guide.mappings
    .map(
      (item) =>
        `| ${item.setting} | \`${item.token}\` | \`${item.value}\` | ${item.description} |`
    )
    .join("\n");

  const auditRows = contrastAudit
    .map(
      (item) =>
        `| ${item.pair} | \`${item.fg}\` | \`${item.bg}\` | ${item.ratio}:1 | ${item.level} | ${item.passed ? "PASS (>= " + item.required + ":1)" : "FAIL (< " + item.required + ":1)"} |`
    )
    .join("\n");

  const rainDesc =
    themed.rainDefaults?.intensity === "full"
      ? "全开 (full)"
      : themed.rainDefaults?.intensity === "off"
        ? "关闭 (off)"
        : "柔和 (subtle)";
  const scanlinesDesc = themed.rainDefaults?.scanlines ? "开启" : "关闭";

  const content = `# Antigravity App 外观配置指南：${themed.nameZh} (${themed.name})

> ${themed.tagline}  
> ${themed.description}

## 一、快速设置步骤 (\`Settings > Appearance\`)

${guide.steps.join("\n")}

- **推荐数字雨强度**：${rainDesc}
- **推荐 CRT 扫描线**：${scanlinesDesc}

## 二、核心颜色映射表（可直接复制 Hex 色值）

| 配置项 (Settings > Appearance) | Token 键名 | 十六进制色值 (Hex) | 用途说明 |
| --- | --- | --- | --- |
${mappingRows}

## 三、语法高亮与 Diff 推荐色值

| 语义用途 | Token 键名 | Hex 色值 |
| --- | --- | --- |
| 关键字 (Keyword) | \`syntaxKeyword\` | \`${themed.tokens.syntaxKeyword}\` |
| 字符串 (String) | \`syntaxString\` | \`${themed.tokens.syntaxString}\` |
| 函数名 (Function) | \`syntaxFunction\` | \`${themed.tokens.syntaxFunction}\` |
| 类型名 (Type) | \`syntaxType\` | \`${themed.tokens.syntaxType}\` |
| 数字常量 (Number) | \`syntaxNumber\` | \`${themed.tokens.syntaxNumber}\` |
| 注释 (Comment) | \`syntaxComment\` | \`${themed.tokens.syntaxComment}\` |
| Diff 新增背景 / 文字 | \`diffAddedBg\` / \`diffAddedText\` | \`${themed.tokens.diffAddedBg}\` / \`${themed.tokens.diffAddedText}\` |
| Diff 删除背景 / 文字 | \`diffRemovedBg\` / \`diffRemovedText\` | \`${themed.tokens.diffRemovedBg}\` / \`${themed.tokens.diffRemovedText}\` |

## 四、WCAG 2.1 对比度审计报告

| 对比组合 | 前景色 | 背景色 | 实测对比度 | WCAG 等级 | 校验状态 |
| --- | --- | --- | --- | --- | --- |
${auditRows}
`;

  return {
    format: "antigravity-guide",
    filename: `antigravity-appearance-${themed.id}.md`,
    language: "markdown",
    content
  };
}

function renderHtmlTemplateExport(themed) {
  const tokenLines = formatTokenLines(themed.tokens, "--");
  const safeTitle = escapeHtml(`${themed.nameZh} (${themed.name}) — Matrix Starter`);
  const safeTagline = escapeHtml(themed.tagline || "");
  const safeDesc = escapeHtml(themed.description || "");
  const safeId = escapeHtml(themed.id);

  const content = `<!DOCTYPE html>
<html lang="zh-CN" data-matrix-theme="${safeId}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    :root,
    .matrix-surface {
      color-scheme: only dark;
${tokenLines}
      --font-mono: "Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, ui-monospace, monospace;
      --font-sans: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      min-height: 100%;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-sans);
      scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
      scrollbar-width: thin;
    }

    @supports not (scrollbar-color: auto) {
      html,
      body {
        scrollbar-width: auto;
      }

      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      ::-webkit-scrollbar-track {
        background: var(--scrollbar-track);
      }

      ::-webkit-scrollbar-thumb {
        background: var(--scrollbar-thumb);
        border-radius: 4px;
      }
    }

    ::selection {
      background: var(--selection-bg);
      color: var(--text-primary);
    }

    .matrix-surface {
      position: relative;
      max-width: 900px;
      margin: 32px auto;
      padding: 24px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: 12px;
      box-shadow: 0 0 24px color-mix(in srgb, var(--accent-primary) 16%, transparent);
    }

    .matrix-surface::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      background: repeating-linear-gradient(
        to bottom,
        transparent 0px,
        transparent 2px,
        rgba(0, 0, 0, 0.22) 3px,
        transparent 4px
      );
      opacity: ${themed.rainDefaults?.scanlines ? "0.45" : "0"};
    }

    .header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      background: var(--accent-subtle);
      color: var(--accent-primary);
      border: 1px solid var(--border-default);
    }

    h1 {
      margin: 0;
      font-size: 20px;
      color: var(--text-primary);
    }

    .lead {
      margin: 12px 0 20px;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    .code-panel {
      background: var(--bg-code);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 13px;
      line-height: 1.6;
    }

    .kw { color: var(--syntax-keyword); }
    .fn { color: var(--syntax-function); }
    .str { color: var(--syntax-string); }
    .cmt { color: var(--syntax-comment); }

    .diff {
      margin-top: 16px;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      overflow: hidden;
      font-family: var(--font-mono);
      font-size: 13px;
    }

    .diff-line {
      padding: 6px 12px;
    }

    .diff-add {
      background: var(--diff-added-bg);
      color: var(--diff-added-text);
    }

    .diff-rem {
      background: var(--diff-removed-bg);
      color: var(--diff-removed-text);
    }

    .btn {
      margin-top: 18px;
      display: inline-block;
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid var(--border-strong);
      background: var(--accent-primary);
      color: var(--text-inverse);
      font-family: var(--font-mono);
      font-weight: 700;
      cursor: pointer;
    }

    .btn:focus-visible {
      outline: 2px solid var(--ring-focus);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
      }

      .matrix-surface::after {
        opacity: 0;
      }
    }

    @media (forced-colors: active) {
      html,
      body,
      .matrix-surface,
      .code-panel {
        background: Canvas;
        color: CanvasText;
        border-color: ButtonText;
      }

      .btn {
        background: Highlight;
        color: HighlightText;
        border-color: ButtonText;
      }
    }
  </style>
</head>
<body>
  <main class="matrix-surface">
    <div class="header">
      <h1>${safeTitle}</h1>
      <span class="badge">[MATRIX // ${safeId}]</span>
    </div>
    <p class="lead">${safeTagline} — ${safeDesc}</p>
    <pre class="code-panel"><code><span class="cmt">// Zero external dependencies · Self-contained Matrix UI starter</span>
<span class="kw">const</span> theme = <span class="fn">activateMatrixShell</span>({
  variant: <span class="str">"${safeId}"</span>,
  accent: <span class="str">"${escapeHtml(themed.tokens.accentPrimary)}"</span>,
  colorScheme: <span class="str">"only dark"</span>
});</code></pre>
    <div class="diff" aria-label="Diff 预览">
      <div class="diff-line diff-rem">- background: #FFFFFF; /* light host default */</div>
      <div class="diff-line diff-add">+ background: ${escapeHtml(themed.tokens.bgPrimary)}; /* ${safeId} */</div>
    </div>
    <button type="button" class="btn">WAKE UP, NEO</button>
  </main>
</body>
</html>
`;

  return {
    format: "html-template",
    filename: `matrix-${themed.id}-starter.html`,
    language: "html",
    content
  };
}

/**
 * Export a theme variant (with optional hex overrides) into the requested output format.
 * @param {object | string} variant
 * @param {"css" | "tailwind" | "json" | "antigravity-guide" | "html-template"} [format="css"]
 * @param {Record<string, string>} [overrides]
 */
export function exportTheme(variant, format = "css", overrides) {
  const normalizedFormat = format ?? "css";
  if (!SUPPORTED_FORMATS.has(normalizedFormat)) {
    throw new Error(
      `Unsupported export format "${String(normalizedFormat)}". Supported formats: ${Array.from(SUPPORTED_FORMATS).join(", ")}.`
    );
  }

  const baseVariant =
    typeof variant === "string"
      ? getVariantById(variant)
      : variant && typeof variant === "object" && variant.tokens
        ? variant
        : getVariantById(undefined);

  const themed = applyTokenOverrides(baseVariant, overrides);
  const contrastAudit = auditVariantContrast(themed.tokens);

  switch (normalizedFormat) {
    case "css":
      return renderCssExport(themed);
    case "tailwind":
      return renderTailwindExport(themed);
    case "json":
      return renderJsonExport(themed, contrastAudit);
    case "antigravity-guide":
      return renderAntigravityGuideExport(themed, contrastAudit);
    case "html-template":
      return renderHtmlTemplateExport(themed);
    default:
      throw new Error(`Unsupported export format: ${String(normalizedFormat)}`);
  }
}
