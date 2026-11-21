import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  THEME_VARIANTS,
  applyTokenOverrides,
  auditVariantContrast,
  getVariantById,
  isValidHexColor
} from "../themes/themes.mjs";
import { exportTheme } from "../themes/exporters.mjs";

const STUDIO_RESOURCE_URI = "ui://matrix-theme/studio.html";
const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";
const VALID_RAIN_INTENSITIES = new Set(["off", "subtle", "full"]);
const VALID_TABS = ["preview", "tokens", "customizer", "export"];
const VALID_EXPORT_FORMATS = [
  "css",
  "tailwind",
  "json",
  "antigravity-guide",
  "html-template"
];
const VALID_APPLY_TARGETS = new Set(["css", "tailwind", "json"]);
const DEFAULT_APPLY_OUTPUT_DIR = "styles/matrix-theme";
const DEFAULT_APPLY_TARGETS = ["css", "tailwind"];
const APPLY_TARGET_FILENAMES = {
  css: "matrix-theme.css",
  tailwind: "matrix-tailwind.css",
  json: "matrix-tokens.json"
};
const KEY_TOKEN_NAMES = [
  "bgPrimary",
  "bgSecondary",
  "textPrimary",
  "textSecondary",
  "accentPrimary",
  "borderDefault",
  "syntaxKeyword"
];
const VALID_TOKEN_KEYS = new Set(Object.keys(THEME_VARIANTS[0].tokens));

/**
 * Strip an optional UTF-8 BOM from text read from disk.
 * @param {string} text
 * @returns {string}
 */
function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Resolve the directory containing the running script in both ESM and bundled CJS.
 * @returns {string}
 */
function getCurrentDir() {
  return typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));
}

/**
 * Resolve the persistent data directory from CLI flags, PLUGIN_DATA env, or OS temp fallback.
 * @param {string[]} argv
 * @returns {string}
 */
function resolveDataDir(argv) {
  let cliDir = "";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--data-dir" && i + 1 < argv.length) {
      cliDir = argv[i + 1].trim();
      i += 1;
    } else if (arg.startsWith("--data-dir=")) {
      cliDir = arg.slice("--data-dir=".length).trim();
    }
  }

  const candidate =
    cliDir ||
    (process.env.PLUGIN_DATA ? process.env.PLUGIN_DATA.trim() : "") ||
    path.join(os.tmpdir(), "matrix-theme-data");

  return path.resolve(candidate);
}

/**
 * Resolve the bundled Matrix Theme Studio HTML file path cleanly in CJS and ESM modes.
 * @returns {string}
 */
function resolveStudioHtmlPath() {
  const baseDir = getCurrentDir();
  const candidates = [
    path.resolve(baseDir, "../assets/matrix-studio.html"),
    path.resolve(baseDir, "../../matrix-theme/assets/matrix-studio.html")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Matrix Studio HTML resource not found. Checked: ${candidates.join(", ")}. Run "npm run build" first.`
  );
}

/**
 * Create a fresh default state object.
 * @returns {{
 *   activeVariant: string,
 *   rainIntensity: "off" | "subtle" | "full",
 *   scanlines: boolean,
 *   overrides: Record<string, Record<string, string>>,
 *   customPresets: Array<{
 *     id: string,
 *     name: string,
 *     baseVariant: string,
 *     tokens: Record<string, string>,
 *     createdAt: string
 *   }>
 * }}
 */
function createDefaultState() {
  return {
    activeVariant: "classic-phosphor",
    rainIntensity: "subtle",
    scanlines: true,
    overrides: {},
    customPresets: [],
    lastProjectDir: "",
    lastOutputDir: DEFAULT_APPLY_OUTPUT_DIR,
    lastTargets: [...DEFAULT_APPLY_TARGETS]
  };
}

/**
 * Validate and sanitize a token overrides map against known token keys and #RRGGBB format.
 * @param {Record<string, unknown> | undefined} rawOverrides
 * @param {{ strict?: boolean }} [options]
 * @returns {Record<string, string>}
 */
function validateOverrides(rawOverrides, { strict = true } = {}) {
  if (!rawOverrides || typeof rawOverrides !== "object" || Array.isArray(rawOverrides)) {
    return {};
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(rawOverrides)) {
    if (!VALID_TOKEN_KEYS.has(key)) {
      if (strict) {
        throw new Error(`Unknown theme token key "${key}".`);
      }
      continue;
    }
    if (!isValidHexColor(value)) {
      if (strict) {
        throw new Error(
          `Invalid hex color for token "${key}": expected #RRGGBB, got ${JSON.stringify(value)}.`
        );
      }
      continue;
    }
    cleaned[key] = value;
  }

  return cleaned;
}

/**
 * Sanitize raw persisted state read from state.json.
 * @param {unknown} raw
 */
function sanitizeState(raw) {
  const defaults = createDefaultState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaults;
  }

  const customPresets = [];
  if (Array.isArray(raw.customPresets)) {
    for (const preset of raw.customPresets) {
      if (!preset || typeof preset !== "object") continue;
      if (typeof preset.id !== "string" || !preset.id.trim()) continue;
      if (typeof preset.name !== "string" || !preset.name.trim()) continue;
      const base = getVariantById(
        typeof preset.baseVariant === "string" ? preset.baseVariant : undefined
      );
      const cleanTokens = validateOverrides(preset.tokens, { strict: false });
      customPresets.push({
        id: preset.id.trim(),
        name: preset.name.trim(),
        baseVariant: base.id,
        tokens: { ...base.tokens, ...cleanTokens },
        createdAt:
          typeof preset.createdAt === "string" && preset.createdAt
            ? preset.createdAt
            : new Date().toISOString()
      });
    }
  }

  const overrides = {};
  if (raw.overrides && typeof raw.overrides === "object" && !Array.isArray(raw.overrides)) {
    for (const [variantId, map] of Object.entries(raw.overrides)) {
      const cleanMap = validateOverrides(map, { strict: false });
      if (Object.keys(cleanMap).length > 0) {
        overrides[variantId] = cleanMap;
      }
    }
  }

  const knownPresetIds = new Set([
    ...THEME_VARIANTS.map((v) => v.id),
    ...customPresets.map((p) => p.id)
  ]);

  const activeVariant =
    typeof raw.activeVariant === "string" && knownPresetIds.has(raw.activeVariant)
      ? raw.activeVariant
      : defaults.activeVariant;

  const rainIntensity =
    typeof raw.rainIntensity === "string" && VALID_RAIN_INTENSITIES.has(raw.rainIntensity)
      ? raw.rainIntensity
      : defaults.rainIntensity;

  const scanlines =
    typeof raw.scanlines === "boolean" ? raw.scanlines : defaults.scanlines;

  const lastProjectDir =
    typeof raw.lastProjectDir === "string" ? raw.lastProjectDir : defaults.lastProjectDir;

  const lastOutputDir =
    typeof raw.lastOutputDir === "string" && raw.lastOutputDir.trim()
      ? raw.lastOutputDir.trim()
      : defaults.lastOutputDir;

  const filteredTargets = Array.isArray(raw.lastTargets)
    ? Array.from(
        new Set(
          raw.lastTargets.filter(
            (item) => typeof item === "string" && VALID_APPLY_TARGETS.has(item)
          )
        )
      )
    : [];
  const lastTargets =
    filteredTargets.length > 0 ? filteredTargets : [...defaults.lastTargets];

  return {
    activeVariant,
    rainIntensity,
    scanlines,
    overrides,
    customPresets,
    lastProjectDir,
    lastOutputDir,
    lastTargets
  };
}

/**
 * Load persisted state from <dataDir>/state.json, returning defaults if absent.
 * @param {string} stateFilePath
 */
function loadState(stateFilePath) {
  if (!fs.existsSync(stateFilePath)) {
    return createDefaultState();
  }

  try {
    const rawText = stripBom(fs.readFileSync(stateFilePath, "utf8"));
    return sanitizeState(JSON.parse(rawText));
  } catch (error) {
    console.error(`[matrix-studio] Failed to parse state file, using defaults:`, error);
    return createDefaultState();
  }
}

/**
 * Atomically write UTF-8 (without BOM) text content to disk via temp file + renameSync.
 * @param {string} targetPath
 * @param {string} content
 */
function writeTextAtomically(targetPath, content) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });

  const tempPath = path.join(
    dir,
    `.matrix-tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
  );

  try {
    fs.writeFileSync(tempPath, stripBom(content), {
      encoding: "utf8"
    });
    fs.renameSync(tempPath, targetPath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup failure for temporary write file.
    }
    throw error;
  }
}

/**
 * Atomically persist state to <dataDir>/state.json via recursive mkdir, temp file write, and renameSync.
 * @param {string} stateFilePath
 * @param {ReturnType<typeof createDefaultState>} state
 */
function saveStateAtomically(stateFilePath, state) {
  writeTextAtomically(stateFilePath, `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * Check whether targetPath stays inside baseDir without escaping via ".." or another root.
 * @param {string} baseDir
 * @param {string} targetPath
 * @returns {boolean}
 */
function isInsideBaseDir(baseDir, targetPath) {
  const rel = path.relative(baseDir, targetPath);
  if (path.isAbsolute(rel)) return false;
  if (rel === "..") return false;
  if (
    rel.startsWith(`..${path.sep}`) ||
    rel.startsWith("../") ||
    rel.startsWith("..\\")
  ) {
    return false;
  }
  return true;
}

/**
 * Verify that an existing ancestor of targetPath stays within realBaseDir via realpathSync.
 * @param {string} realBaseDir
 * @param {string} targetPath
 * @returns {boolean}
 */
function isRealPathContainmentValid(realBaseDir, targetPath) {
  let probe = targetPath;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) {
      return false;
    }
    probe = parent;
  }
  const realProbe = fs.realpathSync(probe);
  return isInsideBaseDir(realBaseDir, realProbe);
}

/**
 * Compute a POSIX-normalized relative path from baseDir to targetPath.
 * @param {string} baseDir
 * @param {string} targetPath
 * @returns {string}
 */
function toPosixRelative(baseDir, targetPath) {
  const rel = path.relative(baseDir, targetPath);
  return rel.split(path.sep).join("/");
}

/**
 * Escape special regex characters in a literal string.
 * @param {string} value
 * @returns {string}
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Idempotently inject a CSS @import line while keeping any leading @charset rule on line 1.
 * @param {string} existingCss
 * @param {string} importLine
 * @param {string} targetFilename
 * @returns {{ updated: string, alreadyImported: boolean }}
 */
function injectCssImport(existingCss, importLine, targetFilename) {
  const normalized = stripBom(existingCss);
  const filenameImportRegex = new RegExp(
    `@import\\s+(?:url\\(\\s*)?["']?[^"'\\n;)]*${escapeRegex(targetFilename)}["']?\\s*\\)?\\s*;`,
    "i"
  );

  if (normalized.includes(importLine) || filenameImportRegex.test(normalized)) {
    return {
      updated: normalized,
      alreadyImported: true
    };
  }

  const charsetMatch = normalized.match(/^(@charset\s+[^;\r\n]+;)(\s*\r?\n)?/i);
  if (charsetMatch) {
    const charsetStmt = charsetMatch[1];
    const afterCharset = normalized.slice(charsetMatch[0].length);
    const updated = `${charsetStmt}\n${importLine}\n${afterCharset}`;
    return { updated, alreadyImported: false };
  }

  return {
    updated: `${importLine}\n${normalized}`,
    alreadyImported: false
  };
}

/**
 * Check whether a variant ID matches a built-in variant or a saved custom preset.
 * @param {ReturnType<typeof createDefaultState>} state
 * @param {string} variantId
 * @returns {boolean}
 */
function isKnownVariantOrPreset(state, variantId) {
  return (
    THEME_VARIANTS.some((v) => v.id === variantId) ||
    state.customPresets.some((p) => p.id === variantId)
  );
}

/**
 * Resolve a variant or custom preset with persisted overrides applied.
 * @param {ReturnType<typeof createDefaultState>} state
 * @param {string} [requestedId]
 */
function resolveThemeWithState(state, requestedId) {
  const targetId = requestedId || state.activeVariant || "classic-phosphor";
  const customPreset = state.customPresets.find((preset) => preset.id === targetId);

  let baseTheme;
  if (customPreset) {
    const parentVariant = getVariantById(customPreset.baseVariant);
    baseTheme = applyTokenOverrides(
      {
        ...parentVariant,
        id: customPreset.id,
        name: customPreset.name,
        nameZh: customPreset.name,
        tagline: `自定义预设 · 基于 ${parentVariant.nameZh} (${parentVariant.name})`,
        description: `创建于 ${customPreset.createdAt} 的自定义黑绿主题预设。`,
        baseVariant: parentVariant.id,
        isCustom: true
      },
      customPreset.tokens
    );
  } else {
    baseTheme = getVariantById(targetId);
  }

  const activeTheme = applyTokenOverrides(baseTheme, state.overrides[baseTheme.id]);
  const contrastAudit = auditVariantContrast(activeTheme.tokens);

  return {
    activeTheme,
    contrastAudit
  };
}

/**
 * Summarize WCAG 2.1 contrast audit results.
 * @param {ReturnType<typeof auditVariantContrast>} audit
 */
function summarizeContrast(audit) {
  const passedCount = audit.filter((item) => item.passed).length;
  const totalCount = audit.length;
  const minRatio = audit.reduce(
    (min, item) => (item.ratio < min ? item.ratio : min),
    Number.POSITIVE_INFINITY
  );

  return {
    passedCount,
    totalCount,
    allPassed: passedCount === totalCount,
    minRatio: Number.isFinite(minRatio) ? minRatio : 0
  };
}

/**
 * Pick key display token hexes from a theme token object.
 * @param {Record<string, string>} tokens
 * @returns {Record<string, string>}
 */
function pickKeyTokens(tokens) {
  const result = {};
  for (const key of KEY_TOKEN_NAMES) {
    if (tokens[key]) {
      result[key] = tokens[key];
    }
  }
  return result;
}

/**
 * Build exports preview map for all 5 supported export formats.
 * @param {object} activeTheme
 */
function buildExportsPreview(activeTheme) {
  const preview = {};
  for (const format of VALID_EXPORT_FORMATS) {
    preview[format] = exportTheme(activeTheme, format);
  }
  return preview;
}

/**
 * Format a concise Simplified Chinese + technical summary for tool text output.
 * @param {string} heading
 * @param {ReturnType<typeof createDefaultState>} state
 * @param {object} activeTheme
 * @param {ReturnType<typeof auditVariantContrast>} contrastAudit
 */
function formatThemeSummaryText(heading, state, activeTheme, contrastAudit) {
  const summary = summarizeContrast(contrastAudit);
  const overrideCount = Object.keys(state.overrides[activeTheme.id] || {}).length;
  const rainLabel =
    state.rainIntensity === "full"
      ? "全开 (full)"
      : state.rainIntensity === "off"
        ? "关闭 (off)"
        : "柔和 (subtle)";

  return [
    heading,
    `- 当前主题 (Active Theme): ${activeTheme.nameZh} (${activeTheme.name}) [${activeTheme.id}]`,
    `- 数字雨与扫描线 (Rain / Scanlines): ${rainLabel} / ${state.scanlines ? "开启" : "关闭"}`,
    `- 核心色值 (Key Tokens): bgPrimary=${activeTheme.tokens.bgPrimary}, bgSecondary=${activeTheme.tokens.bgSecondary}, textPrimary=${activeTheme.tokens.textPrimary}, accentPrimary=${activeTheme.tokens.accentPrimary}, borderDefault=${activeTheme.tokens.borderDefault}`,
    `- WCAG 2.1 对比度检查: ${summary.passedCount}/${summary.totalCount} 项达标 (最低对比度 ${summary.minRatio}:1)`,
    `- 已保存微调项: ${overrideCount} 项覆盖 | 自定义预设: ${state.customPresets.length} 个`
  ].join("\n");
}

/**
 * Clone current state deeply enough for safe mutation.
 * @param {ReturnType<typeof createDefaultState>} state
 */
function cloneState(state) {
  return {
    activeVariant: state.activeVariant,
    rainIntensity: state.rainIntensity,
    scanlines: state.scanlines,
    overrides: Object.fromEntries(
      Object.entries(state.overrides).map(([k, v]) => [k, { ...v }])
    ),
    customPresets: state.customPresets.map((p) => ({
      ...p,
      tokens: { ...p.tokens }
    })),
    lastProjectDir: state.lastProjectDir || "",
    lastOutputDir: state.lastOutputDir || DEFAULT_APPLY_OUTPUT_DIR,
    lastTargets: Array.isArray(state.lastTargets) && state.lastTargets.length > 0
      ? [...state.lastTargets]
      : [...DEFAULT_APPLY_TARGETS]
  };
}

/**
 * Create and configure the Matrix Theme Studio MCP server.
 * @param {string} dataDir
 */
function createMatrixStudioServer(dataDir) {
  const stateFilePath = path.join(dataDir, "state.json");
  let state = loadState(stateFilePath);

  const server = new McpServer({
    name: "matrix-studio",
    version: "1.0.0"
  });

  server.registerResource(
    "matrix-studio-ui",
    STUDIO_RESOURCE_URI,
    {
      title: "Matrix Theme Studio",
      description:
        "黑客帝国风黑绿主题交互工作台与实时数字雨预览界面 (MCP App HTML Resource)",
      mimeType: MCP_APP_MIME_TYPE,
      _meta: {
        ui: {
          prefersBorder: false
        }
      }
    },
    async () => {
      const htmlPath = resolveStudioHtmlPath();
      const html = stripBom(fs.readFileSync(htmlPath, "utf8"));
      return {
        contents: [
          {
            uri: STUDIO_RESOURCE_URI,
            mimeType: MCP_APP_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                prefersBorder: false
              }
            }
          }
        ]
      };
    }
  );

  // 1. open_matrix_studio
  server.registerTool(
    "open_matrix_studio",
    {
      title: "打开 Matrix Theme Studio",
      description:
        "打开完整的黑客帝国黑绿主题工作台（辅助面板或全局页面），支持实时数字雨预览、色板与 WCAG 对比度审计、Token 微调以及多格式导出。",
      inputSchema: z.object({
        variant: z
          .string()
          .optional()
          .describe(
            "可选的主题变体 ID（classic-phosphor、zion-dark、crt-high-contrast 或自定义预设 ID）"
          ),
        tab: z
          .enum(VALID_TABS)
          .optional()
          .describe("初始打开的标签页：preview | tokens | customizer | export")
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true
      },
      _meta: {
        ui: {
          resourceUri: STUDIO_RESOURCE_URI
        },
        "com.google.antigravity/ui": {
          entrypoints: [
            { type: "aux_pane", title: "Matrix Theme Studio" },
            { type: "global", title: "Matrix Theme Studio" }
          ]
        }
      }
    },
    async (args) => {
      state = loadState(stateFilePath);
      const initialTab = args?.tab ?? "preview";
      const { activeTheme, contrastAudit } = resolveThemeWithState(state, args?.variant);
      const exportsPreview = buildExportsPreview(activeTheme);

      return {
        content: [
          {
            type: "text",
            text: formatThemeSummaryText(
              `已启动 Matrix Theme Studio（初始标签页: ${initialTab}）`,
              state,
              activeTheme,
              contrastAudit
            )
          }
        ],
        structuredContent: {
          mode: "studio",
          initialTab,
          state,
          variants: THEME_VARIANTS,
          activeTheme,
          contrastAudit,
          exportsPreview
        }
      };
    }
  );

  // 2. preview_matrix_card
  server.registerTool(
    "preview_matrix_card",
    {
      title: "内联预览黑绿主题卡片",
      description:
        "在对话中内联渲染紧凑型黑客帝国黑绿主题预览卡片，展示实时终端样式、关键 Hex 色值与 WCAG 对比度摘要。",
      inputSchema: z.object({
        variant: z
          .string()
          .optional()
          .describe("要预览的主题变体 ID 或自定义预设 ID，默认使用当前激活主题")
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true
      },
      _meta: {
        ui: {
          resourceUri: STUDIO_RESOURCE_URI
        }
      }
    },
    async (args) => {
      state = loadState(stateFilePath);
      const { activeTheme, contrastAudit } = resolveThemeWithState(state, args?.variant);

      return {
        content: [
          {
            type: "text",
            text: formatThemeSummaryText(
              "黑客帝国黑绿主题内联预览已生成：",
              state,
              activeTheme,
              contrastAudit
            )
          }
        ],
        structuredContent: {
          mode: "inline",
          initialTab: "preview",
          state,
          variants: THEME_VARIANTS,
          activeTheme,
          contrastAudit
        }
      };
    }
  );

  // 3. export_matrix_theme
  server.registerTool(
    "export_matrix_theme",
    {
      title: "导出黑绿主题配置",
      description:
        "将指定黑绿主题变体导出为 CSS 变量、Tailwind CSS v4 @theme、JSON Tokens、Antigravity Appearance 中文配置指南或自包含 HTML 模板。",
      inputSchema: z.object({
        variant: z
          .string()
          .optional()
          .describe("主题变体 ID 或自定义预设 ID，默认使用当前激活主题"),
        format: z
          .enum(VALID_EXPORT_FORMATS)
          .optional()
          .describe(
            "导出格式：css | tailwind | json | antigravity-guide | html-template（默认 css）"
          ),
        overrides: z
          .record(z.string(), z.string())
          .optional()
          .describe("可选的临时 #RRGGBB Token 覆盖键值对")
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true
      }
    },
    async (args) => {
      state = loadState(stateFilePath);
      const cleanAdHocOverrides = validateOverrides(args?.overrides, { strict: true });
      const { activeTheme } = resolveThemeWithState(state, args?.variant);
      const format = args?.format ?? "css";
      const exported = exportTheme(activeTheme, format, cleanAdHocOverrides);

      const text = [
        `已导出主题 ${activeTheme.nameZh} (${activeTheme.name}) [${activeTheme.id}] 的 ${exported.format} 配置（文件名: ${exported.filename}）：`,
        "",
        exported.content
      ].join("\n");

      return {
        content: [
          {
            type: "text",
            text
          }
        ],
        structuredContent: {
          variantId: activeTheme.id,
          export: exported
        }
      };
    }
  );

  // 4. list_matrix_presets
  server.registerTool(
    "list_matrix_presets",
    {
      title: "列出所有黑绿主题预设",
      description:
        "列出 3 套内置黑客帝国黑绿主题及已保存的自定义预设，包含关键 Hex 色值与 WCAG 2.1 对比度达标摘要。",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true
      }
    },
    async () => {
      state = loadState(stateFilePath);

      const variants = THEME_VARIANTS.map((variant) => {
        const resolved = applyTokenOverrides(variant, state.overrides[variant.id]);
        const contrastAudit = auditVariantContrast(resolved.tokens);
        const contrastSummary = summarizeContrast(contrastAudit);
        return {
          ...resolved,
          isActive: state.activeVariant === variant.id,
          overrideCount: Object.keys(state.overrides[variant.id] || {}).length,
          keyTokens: pickKeyTokens(resolved.tokens),
          contrastSummary,
          contrastAudit
        };
      });

      const customPresets = state.customPresets.map((preset) => {
        const resolved = resolveThemeWithState(state, preset.id);
        const contrastSummary = summarizeContrast(resolved.contrastAudit);
        return {
          ...preset,
          tokens: resolved.activeTheme.tokens,
          isActive: state.activeVariant === preset.id,
          overrideCount: Object.keys(state.overrides[preset.id] || {}).length,
          keyTokens: pickKeyTokens(resolved.activeTheme.tokens),
          contrastSummary,
          contrastAudit: resolved.contrastAudit
        };
      });

      const lines = [
        `当前激活主题: ${state.activeVariant} | 数字雨: ${state.rainIntensity} | 扫描线: ${state.scanlines ? "开启" : "关闭"}`,
        "",
        "内置主题变体 (Built-in Variants):"
      ];

      for (const item of variants) {
        const marker = item.isActive ? "[当前激活]" : "[可用]";
        lines.push(
          `- ${marker} ${item.nameZh} (${item.name}) [${item.id}]: ` +
            `bgPrimary=${item.keyTokens.bgPrimary}, bgSecondary=${item.keyTokens.bgSecondary}, ` +
            `textPrimary=${item.keyTokens.textPrimary}, accentPrimary=${item.keyTokens.accentPrimary}, ` +
            `borderDefault=${item.keyTokens.borderDefault} | ` +
            `WCAG ${item.contrastSummary.passedCount}/${item.contrastSummary.totalCount} PASS (min ${item.contrastSummary.minRatio}:1)`
        );
      }

      lines.push("", "自定义预设 (Custom Presets):");
      if (customPresets.length === 0) {
        lines.push("- 暂无自定义预设");
      } else {
        for (const preset of customPresets) {
          const marker = preset.isActive ? "[当前激活]" : "[可用]";
          lines.push(
            `- ${marker} ${preset.name} [${preset.id}] (基于 ${preset.baseVariant}): ` +
              `bgPrimary=${preset.keyTokens.bgPrimary}, textPrimary=${preset.keyTokens.textPrimary}, ` +
              `accentPrimary=${preset.keyTokens.accentPrimary} | ` +
              `WCAG ${preset.contrastSummary.passedCount}/${preset.contrastSummary.totalCount} PASS (min ${preset.contrastSummary.minRatio}:1)`
          );
        }
      }

      return {
        content: [
          {
            type: "text",
            text: lines.join("\n")
          }
        ],
        structuredContent: {
          activeVariant: state.activeVariant,
          rainIntensity: state.rainIntensity,
          scanlines: state.scanlines,
          variants,
          customPresets
        }
      };
    }
  );

  // 5. save_theme_state
  server.registerTool(
    "save_theme_state",
    {
      title: "保存主题状态与自定义预设",
      description:
        "保存当前激活主题、数字雨强度、扫描线开关、#RRGGBB Token 微调覆盖以及自定义预设到本地 state.json（仅限 UI App 调用）。",
      inputSchema: z.object({
        activeVariant: z.string().optional().describe("要设为当前激活的主题或预设 ID"),
        rainIntensity: z
          .enum(["off", "subtle", "full"])
          .optional()
          .describe("数字雨强度：off | subtle | full"),
        scanlines: z.boolean().optional().describe("是否开启 CRT 扫描线效果"),
        variant: z.string().optional().describe("应用 Token 覆盖的目标主题 ID"),
        overrides: z
          .record(z.string(), z.string())
          .optional()
          .describe("需要覆盖的 #RRGGBB 色值键值对"),
        replaceOverrides: z
          .boolean()
          .optional()
          .describe("为 true 时完全替换目标主题的现有覆盖，否则执行合并"),
        saveCustomPreset: z
          .object({
            name: z.string().min(1)
          })
          .optional()
          .describe("将当前效果保存为命名自定义预设"),
        deleteCustomPresetId: z
          .string()
          .optional()
          .describe("按 ID 删除指定的自定义预设")
      }),
      annotations: {
        readOnlyHint: false,
        idempotentHint: false
      },
      _meta: {
        ui: {
          visibility: ["app"]
        }
      }
    },
    async (args) => {
      const nextState = cloneState(loadState(stateFilePath));
      const cleanOverrides = validateOverrides(args?.overrides, { strict: true });

      if (args?.activeVariant !== undefined) {
        if (!isKnownVariantOrPreset(nextState, args.activeVariant)) {
          throw new Error(`Unknown theme variant or preset ID: "${args.activeVariant}".`);
        }
        nextState.activeVariant = args.activeVariant;
      }

      if (args?.rainIntensity !== undefined) {
        nextState.rainIntensity = args.rainIntensity;
      }

      if (args?.scanlines !== undefined) {
        nextState.scanlines = args.scanlines;
      }

      const targetVariantId =
        args?.variant || args?.activeVariant || nextState.activeVariant || "classic-phosphor";

      if (args?.variant !== undefined && !isKnownVariantOrPreset(nextState, targetVariantId)) {
        throw new Error(`Unknown target theme variant or preset ID: "${targetVariantId}".`);
      }

      if (args?.replaceOverrides) {
        if (Object.keys(cleanOverrides).length > 0) {
          nextState.overrides[targetVariantId] = { ...cleanOverrides };
        } else {
          delete nextState.overrides[targetVariantId];
        }
      } else if (Object.keys(cleanOverrides).length > 0) {
        nextState.overrides[targetVariantId] = {
          ...(nextState.overrides[targetVariantId] || {}),
          ...cleanOverrides
        };
      }

      if (args?.saveCustomPreset) {
        const presetName = args.saveCustomPreset.name.trim();
        if (!presetName) {
          throw new Error("Custom preset name cannot be empty.");
        }

        const existingCustom = nextState.customPresets.find(
          (preset) => preset.id === targetVariantId
        );
        const baseVariant = existingCustom
          ? existingCustom.baseVariant
          : getVariantById(targetVariantId).id;
        const { activeTheme: resolvedForPreset } = resolveThemeWithState(
          nextState,
          targetVariantId
        );

        const slug = presetName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 24);
        const uniqueSuffix = `${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        const presetId = `custom-${slug || "matrix"}-${uniqueSuffix}`;

        nextState.customPresets.push({
          id: presetId,
          name: presetName,
          baseVariant,
          tokens: { ...resolvedForPreset.tokens },
          createdAt: new Date().toISOString()
        });
      }

      if (args?.deleteCustomPresetId) {
        nextState.customPresets = nextState.customPresets.filter(
          (preset) => preset.id !== args.deleteCustomPresetId
        );
        delete nextState.overrides[args.deleteCustomPresetId];
        if (nextState.activeVariant === args.deleteCustomPresetId) {
          nextState.activeVariant = "classic-phosphor";
        }
      }

      saveStateAtomically(stateFilePath, nextState);
      state = nextState;

      const returnVariantId =
        args?.variant && isKnownVariantOrPreset(state, args.variant)
          ? args.variant
          : state.activeVariant;
      const { activeTheme, contrastAudit } = resolveThemeWithState(state, returnVariantId);

      return {
        content: [
          {
            type: "text",
            text: formatThemeSummaryText(
              "已保存 Matrix 主题配置到持久化存储：",
              state,
              activeTheme,
              contrastAudit
            )
          }
        ],
        structuredContent: {
          state,
          activeTheme,
          contrastAudit,
          variants: THEME_VARIANTS
        }
      };
    }
  );

  // 6. reset_theme_state
  server.registerTool(
    "reset_theme_state",
    {
      title: "重置主题 Token 微调",
      description:
        "清除指定主题变体的自定义 Token 覆盖并持久化到 state.json，恢复默认配色（仅限 UI App 调用）。",
      inputSchema: z.object({
        variant: z
          .string()
          .optional()
          .describe("要重置的主题变体 ID，默认重置当前激活主题")
      }),
      annotations: {
        readOnlyHint: false,
        idempotentHint: true
      },
      _meta: {
        ui: {
          visibility: ["app"]
        }
      }
    },
    async (args) => {
      const nextState = cloneState(loadState(stateFilePath));
      const targetVariant = args?.variant || nextState.activeVariant || "classic-phosphor";

      delete nextState.overrides[targetVariant];
      saveStateAtomically(stateFilePath, nextState);
      state = nextState;

      const { activeTheme, contrastAudit } = resolveThemeWithState(state, targetVariant);

      return {
        content: [
          {
            type: "text",
            text: formatThemeSummaryText(
              `已重置主题 [${targetVariant}] 的所有 Token 微调覆盖：`,
              state,
              activeTheme,
              contrastAudit
            )
          }
        ],
        structuredContent: {
          state,
          activeTheme,
          contrastAudit,
          variants: THEME_VARIANTS
        }
      };
    }
  );

  // 7. apply_matrix_theme_to_project
  server.registerTool(
    "apply_matrix_theme_to_project",
    {
      title: "一键应用黑绿主题到项目",
      description:
        "将当前选中的黑客帝国黑绿主题（含微调 Token）直接写入目标项目的 CSS 变量文件、Tailwind v4 @theme 文件和/或 JSON Tokens 文件，可选自动向项目入口 CSS 追加 @import。",
      inputSchema: z.object({
        projectDir: z.string().min(1).describe("目标项目根目录的绝对路径"),
        variant: z
          .string()
          .optional()
          .describe("要应用的主题变体 ID 或自定义预设 ID，默认使用当前激活主题"),
        overrides: z
          .record(z.string(), z.string())
          .optional()
          .describe("可选的临时 #RRGGBB Token 覆盖键值对"),
        targets: z
          .array(z.enum(["css", "tailwind", "json"]))
          .min(1)
          .default(DEFAULT_APPLY_TARGETS)
          .describe("要生成并写入的目标格式：css | tailwind | json"),
        outputDir: z
          .string()
          .min(1)
          .default(DEFAULT_APPLY_OUTPUT_DIR)
          .describe("相对于 projectDir 的输出子目录（默认 styles/matrix-theme）"),
        autoImportCss: z
          .string()
          .optional()
          .describe("可选：相对于 projectDir 的已有入口 CSS 文件路径（如 src/index.css），自动追加 @import")
      }),
      annotations: {
        readOnlyHint: false,
        idempotentHint: true
      }
    },
    async (args) => {
      const failTool = (message) => ({
        isError: true,
        content: [
          {
            type: "text",
            text: `应用 Matrix 主题到项目失败：${message}`
          }
        ]
      });

      try {
        const currentState = loadState(stateFilePath);
        const rawProjectDir = typeof args?.projectDir === "string" ? args.projectDir.trim() : "";

        if (!rawProjectDir || !path.isAbsolute(rawProjectDir)) {
          return failTool(`projectDir 必须是有效的绝对路径（收到：${JSON.stringify(args?.projectDir)}）。`);
        }

        const resolvedProjectDir = path.resolve(rawProjectDir);
        const projectStat = fs.statSync(resolvedProjectDir, { throwIfNoEntry: false });
        if (!projectStat || !projectStat.isDirectory()) {
          return failTool(`目标项目目录不存在或不是文件夹：${resolvedProjectDir}`);
        }
        const realProjectDir = fs.realpathSync(resolvedProjectDir);

        const rawOutputDir =
          typeof args?.outputDir === "string" ? args.outputDir.trim() : DEFAULT_APPLY_OUTPUT_DIR;
        if (!rawOutputDir) {
          return failTool("outputDir 不能为空。");
        }
        if (path.isAbsolute(rawOutputDir)) {
          return failTool(`outputDir 必须是相对于 projectDir 的路径，不能使用绝对路径：${rawOutputDir}`);
        }

        const resolvedOutputDir = path.resolve(resolvedProjectDir, rawOutputDir);
        if (!isInsideBaseDir(resolvedProjectDir, resolvedOutputDir)) {
          return failTool(`outputDir 不得越界到项目目录之外：${rawOutputDir}`);
        }
        if (!isRealPathContainmentValid(realProjectDir, resolvedOutputDir)) {
          return failTool(`outputDir 解析后的真实路径位于项目目录之外：${rawOutputDir}`);
        }

        const existingOutputStat = fs.statSync(resolvedOutputDir, { throwIfNoEntry: false });
        if (existingOutputStat && !existingOutputStat.isDirectory()) {
          return failTool(`outputDir 指向已存在的文件而非目录：${resolvedOutputDir}`);
        }

        const rawAutoImport =
          typeof args?.autoImportCss === "string" ? args.autoImportCss.trim() : "";
        let resolvedImportFile = "";
        if (rawAutoImport) {
          if (path.isAbsolute(rawAutoImport)) {
            return failTool(`autoImportCss 必须是相对于 projectDir 的路径：${rawAutoImport}`);
          }
          if (!/\.css$/i.test(rawAutoImport)) {
            return failTool(`autoImportCss 必须指向 .css 文件：${rawAutoImport}`);
          }
          resolvedImportFile = path.resolve(resolvedProjectDir, rawAutoImport);
          if (!isInsideBaseDir(resolvedProjectDir, resolvedImportFile)) {
            return failTool(`autoImportCss 不得越界到项目目录之外：${rawAutoImport}`);
          }
          const importStat = fs.statSync(resolvedImportFile, { throwIfNoEntry: false });
          if (!importStat || !importStat.isFile()) {
            return failTool(`autoImportCss 指定的文件不存在或不是普通文件：${rawAutoImport}`);
          }
          if (!isInsideBaseDir(realProjectDir, fs.realpathSync(resolvedImportFile))) {
            return failTool(`autoImportCss 的真实路径位于项目目录之外：${rawAutoImport}`);
          }
        }

        const requestedVariant =
          typeof args?.variant === "string" && args.variant.trim()
            ? args.variant.trim()
            : undefined;
        if (requestedVariant && !isKnownVariantOrPreset(currentState, requestedVariant)) {
          return failTool(`未知的主题变体或自定义预设 ID："${requestedVariant}"。`);
        }

        const cleanAdHocOverrides = validateOverrides(args?.overrides, { strict: true });
        const { activeTheme: stateResolvedTheme } = resolveThemeWithState(
          currentState,
          requestedVariant
        );
        const effectiveTheme =
          Object.keys(cleanAdHocOverrides).length > 0
            ? applyTokenOverrides(stateResolvedTheme, cleanAdHocOverrides)
            : stateResolvedTheme;

        const rawTargets =
          Array.isArray(args?.targets) && args.targets.length > 0
            ? args.targets
            : DEFAULT_APPLY_TARGETS;
        const uniqueTargets = Array.from(
          new Set(rawTargets.filter((item) => VALID_APPLY_TARGETS.has(item)))
        );
        if (uniqueTargets.length === 0) {
          return failTool("targets 至少需要包含 css、tailwind 或 json 中的一项。");
        }

        const writtenFiles = [];
        for (const target of uniqueTargets) {
          const filename = APPLY_TARGET_FILENAMES[target];
          const exported = exportTheme(effectiveTheme, target);
          const absPath = path.join(resolvedOutputDir, filename);
          writeTextAtomically(absPath, exported.content);

          writtenFiles.push({
            target,
            relativePath: toPosixRelative(resolvedProjectDir, absPath),
            absolutePath: absPath,
            fileUri: pathToFileURL(absPath).href,
            bytes: Buffer.byteLength(stripBom(exported.content), "utf8")
          });
        }

        let autoImportedFile = null;
        if (resolvedImportFile && (uniqueTargets.includes("css") || uniqueTargets.includes("tailwind"))) {
          const preferredTarget = uniqueTargets.includes("css") ? "css" : "tailwind";
          const targetEntry = writtenFiles.find((file) => file.target === preferredTarget);
          const importDir = path.dirname(resolvedImportFile);
          let relImport = toPosixRelative(importDir, targetEntry.absolutePath);
          if (!relImport.startsWith("./") && !relImport.startsWith("../")) {
            relImport = `./${relImport}`;
          }
          const importLine = `@import "${relImport}";`;
          const existingCss = fs.readFileSync(resolvedImportFile, "utf8");
          const { updated, alreadyImported } = injectCssImport(
            existingCss,
            importLine,
            path.basename(targetEntry.absolutePath)
          );

          if (!alreadyImported) {
            writeTextAtomically(resolvedImportFile, updated);
          }

          autoImportedFile = {
            relativePath: toPosixRelative(resolvedProjectDir, resolvedImportFile),
            absolutePath: resolvedImportFile,
            fileUri: pathToFileURL(resolvedImportFile).href,
            alreadyImported,
            importLine
          };
        }

        const normalizedOutputDir = toPosixRelative(resolvedProjectDir, resolvedOutputDir) || ".";
        const nextState = cloneState(currentState);
        nextState.lastProjectDir = resolvedProjectDir;
        nextState.lastOutputDir = normalizedOutputDir;
        nextState.lastTargets = [...uniqueTargets];
        saveStateAtomically(stateFilePath, nextState);
        state = nextState;

        const cssTarget = writtenFiles.find((f) => f.target === "css");
        const tailwindTarget = writtenFiles.find((f) => f.target === "tailwind");
        const jsonTarget = writtenFiles.find((f) => f.target === "json");
        const snippetLines = [];
        if (autoImportedFile) {
          snippetLines.push(
            `/* ${autoImportedFile.alreadyImported ? "已存在引入" : "已自动写入"} -> ${autoImportedFile.relativePath} */`,
            autoImportedFile.importLine
          );
        } else {
          if (cssTarget) {
            snippetLines.push(`@import "./${cssTarget.relativePath}";`);
          }
          if (tailwindTarget) {
            snippetLines.push(`@import "./${tailwindTarget.relativePath}";`);
          }
          if (!cssTarget && !tailwindTarget && jsonTarget) {
            snippetLines.push(
              `import matrixTokens from "./${jsonTarget.relativePath}" with { type: "json" };`
            );
          }
        }
        const usageSnippet = snippetLines.join("\n");

        const summaryLines = [
          `已成功将黑绿主题 ${effectiveTheme.nameZh} (${effectiveTheme.name}) [${effectiveTheme.id}] 写入目标项目：`,
          `- 项目目录 (projectDir): ${resolvedProjectDir}`,
          `- 输出目录 (outputDir): ${normalizedOutputDir}`,
          ...writtenFiles.map(
            (file) => `- [${file.target}] ${file.relativePath} (${file.bytes} bytes)`
          )
        ];
        if (autoImportedFile) {
          summaryLines.push(
            `- 入口 CSS 自动引入: ${autoImportedFile.relativePath} (${autoImportedFile.alreadyImported ? "已存在 @import，跳过重复写入" : "已追加 " + autoImportedFile.importLine})`
          );
        }

        return {
          content: [
            {
              type: "text",
              text: summaryLines.join("\n")
            }
          ],
          structuredContent: {
            applied: true,
            projectDir: resolvedProjectDir,
            outputDir: normalizedOutputDir,
            variantId: effectiveTheme.id,
            variantName: `${effectiveTheme.nameZh} (${effectiveTheme.name})`,
            writtenFiles,
            autoImportedFile,
            usageSnippet,
            state
          }
        };
      } catch (error) {
        return failTool(error instanceof Error ? error.message : String(error));
      }
    }
  );

  return server;
}

async function main() {
  const dataDir = resolveDataDir(process.argv.slice(2));
  const server = createMatrixStudioServer(dataDir);
  const transport = new StdioServerTransport();

  const shutdown = async () => {
    try {
      await server.close();
    } catch {
      // Ignore close errors during shutdown.
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await server.connect(transport);
}

main().catch((error) => {
  console.error("[matrix-studio] Fatal server error:", error);
  process.exit(1);
});
