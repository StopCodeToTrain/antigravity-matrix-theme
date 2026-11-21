import { App } from "@modelcontextprotocol/ext-apps/app-with-deps";
import {
  THEME_VARIANTS,
  applyTokenOverrides,
  auditVariantContrast,
  computeContrastRatio,
  getVariantById,
  isValidHexColor
} from "../themes/themes.mjs";
import { exportTheme } from "../themes/exporters.mjs";

const TAB_ORDER = ["preview", "tokens", "customizer", "export"];

const CORE_CUSTOMIZER_FIELDS = [
  { key: "bgPrimary", label: "主画布背景", hint: "页面与主终端底色" },
  { key: "bgSecondary", label: "次级面板背景", hint: "卡片与导航栏底色" },
  { key: "accentPrimary", label: "主荧光强调色", hint: "主按钮、激活态与高亮" },
  { key: "textPrimary", label: "主文本色", hint: "正文与标题文字颜色" },
  { key: "borderDefault", label: "默认边框色", hint: "面板描边与分割线" },
  { key: "syntaxKeyword", label: "语法关键字", hint: "代码关键字高亮色" }
];

const SWATCH_GROUPS = [
  {
    title: "表面层级 (Surfaces)",
    keys: [
      { key: "bgPrimary", label: "bgPrimary" },
      { key: "bgSecondary", label: "bgSecondary" },
      { key: "bgTertiary", label: "bgTertiary" },
      { key: "bgElevated", label: "bgElevated" },
      { key: "bgCode", label: "bgCode" },
      { key: "selectionBg", label: "selectionBg" }
    ]
  },
  {
    title: "文本层级 (Text)",
    keys: [
      { key: "textPrimary", label: "textPrimary" },
      { key: "textSecondary", label: "textSecondary" },
      { key: "textMuted", label: "textMuted" },
      { key: "textInverse", label: "textInverse" },
      { key: "textAccent", label: "textAccent" }
    ]
  },
  {
    title: "强调与焦点 (Accents & Ring)",
    keys: [
      { key: "accentPrimary", label: "accentPrimary" },
      { key: "accentHover", label: "accentHover" },
      { key: "accentActive", label: "accentActive" },
      { key: "accentSubtle", label: "accentSubtle" },
      { key: "ringFocus", label: "ringFocus" }
    ]
  },
  {
    title: "边框与滚动条 (Borders & Scrollbar)",
    keys: [
      { key: "borderSubtle", label: "borderSubtle" },
      { key: "borderDefault", label: "borderDefault" },
      { key: "borderStrong", label: "borderStrong" },
      { key: "scrollbarThumb", label: "scrollbarThumb" },
      { key: "scrollbarTrack", label: "scrollbarTrack" }
    ]
  },
  {
    title: "语义状态 (Status)",
    keys: [
      { key: "success", label: "success" },
      { key: "info", label: "info" },
      { key: "warning", label: "warning" },
      { key: "danger", label: "danger" }
    ]
  },
  {
    title: "语法高亮、Diff 与数字雨 (Syntax, Diff & Rain)",
    keys: [
      { key: "syntaxKeyword", label: "syntaxKeyword" },
      { key: "syntaxString", label: "syntaxString" },
      { key: "syntaxFunction", label: "syntaxFunction" },
      { key: "syntaxType", label: "syntaxType" },
      { key: "syntaxNumber", label: "syntaxNumber" },
      { key: "syntaxComment", label: "syntaxComment" },
      { key: "diffAddedBg", label: "diffAddedBg" },
      { key: "diffAddedText", label: "diffAddedText" },
      { key: "diffRemovedBg", label: "diffRemovedBg" },
      { key: "diffRemovedText", label: "diffRemovedText" },
      { key: "rainHead", label: "rainHead" },
      { key: "rainTail", label: "rainTail" }
    ]
  }
];

const INLINE_SWATCH_KEYS = [
  "bgPrimary",
  "bgSecondary",
  "accentPrimary",
  "textPrimary",
  "textSecondary",
  "borderDefault",
  "scrollbarThumb",
  "danger"
];

const uiState = {
  mode: "studio",
  activeTab: "preview",
  exportFormat: "css",
  connected: false,
  hostCaps: null,
  hostContext: null,
  variants: THEME_VARIANTS.map((v) => ({ ...v })),
  serverState: {
    activeVariant: "classic-phosphor",
    rainIntensity: "subtle",
    scanlines: true,
    overrides: {},
    customPresets: [],
    lastProjectDir: "",
    lastOutputDir: "styles/matrix-theme",
    lastTargets: ["css", "tailwind"]
  },
  applyFormDirty: {
    projectDir: false,
    outputDir: false,
    targets: false
  },
  applyPending: false,
  exportsPreview: null,
  exportRequestSeq: 0,
  overrideSyncTimer: null
};

const toggleAuxPaneResultSchema = {
  "~standard": {
    version: 1,
    vendor: "matrix-studio",
    validate(value) {
      if (value === undefined || value === null) {
        return { value: {} };
      }
      if (typeof value === "object" && !Array.isArray(value)) {
        return { value };
      }
      return {
        issues: [{ message: "Expected object result from toggle-aux-pane" }]
      };
    }
  }
};

const app = new App(
  { name: "Matrix Theme Studio", version: "1.0.0" },
  {}
);

// ---------------------------------------------------------------------------
// Color & Token Utilities
// ---------------------------------------------------------------------------

function toKebabCase(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function hexToRgb(hex) {
  if (!isValidHexColor(hex)) return [4, 8, 5];
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function getContrastingChipFg(hex) {
  if (!isValidHexColor(hex)) return "#F0FFF4";
  const ratioToDark = computeContrastRatio(hex, "#030A05");
  const ratioToLight = computeContrastRatio(hex, "#F0FFF4");
  return ratioToDark >= ratioToLight ? "#030A05" : "#F0FFF4";
}

function findBaseVariant(id) {
  const fromList = uiState.variants.find((v) => v.id === id);
  if (fromList) return fromList;

  const preset = (uiState.serverState.customPresets || []).find((p) => p.id === id);
  if (preset) {
    const parent =
      uiState.variants.find((v) => v.id === preset.baseVariant) ||
      getVariantById(preset.baseVariant);
    return applyTokenOverrides(
      {
        ...parent,
        id: preset.id,
        name: preset.name,
        nameZh: preset.name,
        tagline: `自定义预设 · 基于 ${parent.nameZh} (${parent.name})`,
        description: `基于 ${parent.nameZh} 的自定义黑绿主题预设。`,
        baseVariant: parent.id,
        isCustom: true
      },
      preset.tokens
    );
  }

  return getVariantById(id);
}

function getCurrentOverrides() {
  const activeId = uiState.serverState.activeVariant;
  const map = uiState.serverState.overrides;
  if (!map || typeof map !== "object") return {};
  return map[activeId] && typeof map[activeId] === "object" ? map[activeId] : {};
}

function getEffectiveTheme() {
  const base = findBaseVariant(uiState.serverState.activeVariant);
  return applyTokenOverrides(base, getCurrentOverrides());
}

function getEffectiveAudit(themed) {
  return auditVariantContrast(themed.tokens);
}

function applyThemeCssVariables(themed) {
  const surface = document.getElementById("matrix-surface");
  const rootStyle = document.documentElement.style;
  for (const [key, value] of Object.entries(themed.tokens)) {
    const cssVar = `--${toKebabCase(key)}`;
    rootStyle.setProperty(cssVar, value);
    if (surface) surface.style.setProperty(cssVar, value);
  }
  if (surface) {
    surface.setAttribute("data-mode", uiState.mode);
    surface.setAttribute("data-rain", uiState.serverState.rainIntensity);
    surface.setAttribute("data-scanlines", String(Boolean(uiState.serverState.scanlines)));
  }
}

// ---------------------------------------------------------------------------
// Accessible Persistent Popover Toast Notifications
// ---------------------------------------------------------------------------

const activeToasts = [];
let toastIdCounter = 0;

function announceNotification(message) {
  if (typeof navigator !== "undefined" && typeof navigator.ariaNotify === "function") {
    navigator.ariaNotify(message);
    return;
  }
  if (typeof document !== "undefined" && typeof document.ariaNotify === "function") {
    document.ariaNotify(message);
    return;
  }
  const srLive = document.getElementById("sr-live");
  if (srLive) {
    srLive.textContent = "";
    requestAnimationFrame(() => {
      srLive.textContent = message;
    });
  }
}

function repositionToasts() {
  activeToasts.forEach((entry, index) => {
    entry.el.style.setProperty("--toast-index", String(index));
  });
}

function removeToastEntry(entry) {
  if (entry.closed) return;
  entry.closed = true;
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
  const idx = activeToasts.indexOf(entry);
  if (idx !== -1) {
    activeToasts.splice(idx, 1);
    repositionToasts();
  }
  try {
    if (typeof entry.el.hidePopover === "function" && entry.el.matches(":popover-open")) {
      entry.el.hidePopover();
    } else {
      entry.el.removeAttribute("data-open");
    }
  } catch {
    entry.el.removeAttribute("data-open");
  }
  setTimeout(() => {
    entry.el.remove();
  }, 240);
}

function showToast(message, variant = "info", durationMs = 4200) {
  const region = document.getElementById("toast-region");
  if (!region) return;

  while (activeToasts.length >= 4) {
    removeToastEntry(activeToasts[0]);
  }

  toastIdCounter += 1;
  const toastId = `matrix-toast-${toastIdCounter}`;

  const toastEl = document.createElement("div");
  toastEl.id = toastId;
  toastEl.className = "toast";
  toastEl.setAttribute("popover", "manual");
  toastEl.setAttribute("tabindex", "-1");
  toastEl.dataset.variant = variant;

  const body = document.createElement("div");
  body.className = "toast-body";

  const iconSpan = document.createElement("span");
  iconSpan.className = "toast-icon";
  iconSpan.setAttribute("aria-hidden", "true");
  iconSpan.textContent = variant === "error" ? "✕" : variant === "warn" ? "⚠" : "✓";

  const msgSpan = document.createElement("span");
  msgSpan.className = "toast-message";
  msgSpan.textContent = message;

  body.append(iconSpan, msgSpan);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "toast-close";
  closeBtn.setAttribute("popovertarget", toastId);
  closeBtn.setAttribute("popovertargetaction", "hide");
  closeBtn.setAttribute("aria-label", "关闭通知");
  closeBtn.textContent = "✕";

  toastEl.append(body, closeBtn);
  region.appendChild(toastEl);

  const entry = {
    el: toastEl,
    timer: null,
    remaining: durationMs,
    startedAt: 0,
    paused: false,
    closed: false
  };

  function startTimer() {
    if (entry.closed || entry.paused || entry.remaining <= 0) return;
    clearTimeout(entry.timer);
    entry.startedAt = Date.now();
    entry.timer = setTimeout(() => removeToastEntry(entry), entry.remaining);
  }

  function pauseTimer() {
    if (entry.closed || entry.paused) return;
    entry.paused = true;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
      const elapsed = Date.now() - entry.startedAt;
      entry.remaining = Math.max(800, entry.remaining - elapsed);
    }
  }

  function resumeTimer() {
    if (entry.closed) return;
    if (toastEl.contains(document.activeElement) || toastEl.matches(":hover")) {
      return;
    }
    entry.paused = false;
    startTimer();
  }

  toastEl.addEventListener("focusin", pauseTimer);
  toastEl.addEventListener("focusout", () => {
    setTimeout(resumeTimer, 0);
  });
  toastEl.addEventListener("mouseenter", pauseTimer);
  toastEl.addEventListener("mouseleave", resumeTimer);

  toastEl.addEventListener("toggle", (ev) => {
    if (ev.newState === "closed") {
      removeToastEntry(entry);
    }
  });

  closeBtn.addEventListener("click", () => {
    if (typeof toastEl.hidePopover !== "function") {
      removeToastEntry(entry);
    }
  });

  activeToasts.push(entry);
  repositionToasts();

  try {
    if (typeof toastEl.showPopover === "function") {
      toastEl.showPopover();
    } else {
      toastEl.setAttribute("data-open", "true");
    }
  } catch {
    toastEl.setAttribute("data-open", "true");
  }

  startTimer();
  announceNotification(message);
}

// ---------------------------------------------------------------------------
// Clipboard Helper
// ---------------------------------------------------------------------------

async function copyTextToClipboard(text, label = "色值") {
  let copied = false;
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
  }

  if (!copied) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    } finally {
      document.body.removeChild(textarea);
    }
  }

  if (copied) {
    showToast(`已复制 ${label}`);
  } else {
    showToast(`复制 ${label} 失败，请手动复制`, "warn");
  }
  return copied;
}

// ---------------------------------------------------------------------------
// Matrix Digital Rain Canvas Renderer
// ---------------------------------------------------------------------------

const rainController = (() => {
  const GLYPHS =
    "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEF";
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let canvas = null;
  let ctx = null;
  let rafId = null;
  let lastFrameTime = 0;
  let drops = [];
  let fontSize = 14;
  let columns = 0;
  let cssWidth = 0;
  let cssHeight = 0;
  let palette = {
    bgRgb: [4, 8, 5],
    rainHead: "#E2FFEA",
    rainTail: "#00FF41"
  };

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    cssWidth = Math.max(1, Math.floor(rect.width || window.innerWidth));
    cssHeight = Math.max(1, Math.floor(rect.height || window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    fontSize = cssWidth < 520 ? 12 : 14;
    columns = Math.max(1, Math.floor(cssWidth / fontSize));
    drops = Array.from({ length: columns }, () => Math.floor(Math.random() * (cssHeight / fontSize)));
  }

  function drawStaticBackdrop(intensity) {
    if (!ctx || !canvas) return;
    const [r, g, b] = palette.bgRgb;
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    if (intensity === "off") return;

    ctx.font = `${fontSize}px "Cascadia Code", Consolas, ui-monospace, monospace`;
    const stepCols = intensity === "subtle" ? 3 : 2;
    const alpha = intensity === "subtle" ? 0.14 : 0.24;
    ctx.globalAlpha = alpha;
    for (let c = 0; c < columns; c += stepCols) {
      const yRows = (c * 7) % Math.max(4, Math.floor(cssHeight / fontSize));
      for (let row = 0; row <= yRows; row += 2) {
        const ch = GLYPHS[(c + row * 3) % GLYPHS.length];
        ctx.fillStyle = row === yRows ? palette.rainHead : palette.rainTail;
        ctx.fillText(ch, c * fontSize, row * fontSize);
      }
    }
    ctx.globalAlpha = 1;
  }

  function stepAnimation(timestamp) {
    rafId = null;
    const intensity = uiState.serverState.rainIntensity;
    if (
      intensity === "off" ||
      reducedMotionQuery.matches ||
      document.visibilityState === "hidden"
    ) {
      return;
    }

    const intervalMs = intensity === "full" ? 42 : 70;
    if (timestamp - lastFrameTime >= intervalMs) {
      lastFrameTime = timestamp;
      const [r, g, b] = palette.bgRgb;
      const fadeAlpha = intensity === "full" ? 0.08 : 0.14;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fadeAlpha})`;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      ctx.font = `${fontSize}px "Cascadia Code", Consolas, ui-monospace, monospace`;
      const colStride = intensity === "subtle" ? 2 : 1;
      const glyphAlpha = intensity === "subtle" ? 0.34 : 0.65;

      for (let i = 0; i < drops.length; i += colStride) {
        const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.globalAlpha = glyphAlpha;
        ctx.fillStyle = Math.random() > 0.86 ? palette.rainHead : palette.rainTail;
        ctx.fillText(ch, x, y);

        if (y > cssHeight && Math.random() > 0.965) {
          drops[i] = 0;
        } else {
          drops[i] += 1;
        }
      }
      ctx.globalAlpha = 1;
    }

    rafId = requestAnimationFrame(stepAnimation);
  }

  function sync(tokens, intensity) {
    palette = {
      bgRgb: hexToRgb(tokens.bgPrimary),
      rainHead: tokens.rainHead || "#E2FFEA",
      rainTail: tokens.rainTail || tokens.accentPrimary || "#00FF41"
    };

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (!canvas || !ctx) return;

    if (intensity === "off") {
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      return;
    }

    if (reducedMotionQuery.matches || document.visibilityState === "hidden") {
      drawStaticBackdrop(intensity);
      return;
    }

    rafId = requestAnimationFrame(stepAnimation);
  }

  function init() {
    canvas = document.getElementById("matrix-rain");
    if (!canvas) return;
    resizeCanvas();

    const surface = document.getElementById("matrix-surface");
    if (surface && typeof ResizeObserver === "function") {
      const ro = new ResizeObserver(() => {
        resizeCanvas();
        sync(getEffectiveTheme().tokens, uiState.serverState.rainIntensity);
      });
      ro.observe(surface);
    }

    document.addEventListener("visibilitychange", () => {
      sync(getEffectiveTheme().tokens, uiState.serverState.rainIntensity);
    });

    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", () => {
        sync(getEffectiveTheme().tokens, uiState.serverState.rainIntensity);
      });
    }
  }

  return { init, sync };
})();

// ---------------------------------------------------------------------------
// DOM Helpers & Renderers
// ---------------------------------------------------------------------------

function createSwatchChip(hex, compact = false) {
  const chip = document.createElement("span");
  chip.className = compact ? "swatch-chip swatch-chip-sm" : "swatch-chip";
  chip.style.setProperty("--chip-bg", hex);
  chip.style.setProperty("--chip-fg", getContrastingChipFg(hex));
  chip.setAttribute("aria-hidden", "true");
  chip.textContent = compact ? "" : "■";
  return chip;
}

function summarizeAudit(audit) {
  const passedCount = audit.filter((item) => item.passed).length;
  const minRatio = audit.reduce(
    (min, item) => (item.ratio < min ? item.ratio : min),
    Infinity
  );
  const hasFail = passedCount < audit.length;
  const allAaa = !hasFail && audit.every((item) => item.level === "AAA");
  return {
    passedCount,
    total: audit.length,
    minRatio: Number.isFinite(minRatio) ? minRatio : 0,
    hasFail,
    allAaa
  };
}

function applyWcagBadge(badgeEl, textEl, audit, verbose = false) {
  if (!badgeEl || !textEl) return;
  const summary = summarizeAudit(audit);
  badgeEl.classList.remove("wcag-pass", "wcag-warn", "wcag-fail");
  const iconEl = badgeEl.querySelector("span[aria-hidden='true']");

  if (summary.hasFail) {
    badgeEl.classList.add("wcag-fail");
    if (iconEl) iconEl.textContent = "✕";
    textEl.textContent = verbose
      ? `${summary.passedCount}/${summary.total} 达标 · 最低 ${summary.minRatio}:1 (FAIL)`
      : `${summary.passedCount}/${summary.total} FAIL`;
  } else {
    badgeEl.classList.add("wcag-pass");
    if (iconEl) iconEl.textContent = "✓";
    textEl.textContent = verbose
      ? `${summary.passedCount}/${summary.total} WCAG PASS · 最低 ${summary.minRatio}:1`
      : `${summary.passedCount}/${summary.total} PASS (${summary.minRatio}:1)`;
  }
}

function renderSyntaxCodeBlock(preEl, themed, compact = false) {
  if (!preEl) return;
  preEl.textContent = "";
  const code = document.createElement("code");

  const lines = compact
    ? [
        [{ cls: "tok-cmt", text: `// ${themed.name} (${themed.nameZh})` }],
        [
          { cls: "tok-kw", text: "const" },
          { cls: "", text: " " },
          { cls: "tok-var", text: "shell" },
          { cls: "", text: " " },
          { cls: "tok-op", text: "=" },
          { cls: "", text: " " },
          { cls: "tok-fn", text: "activateMatrix" },
          { cls: "tok-punc", text: "({" }
        ],
        [
          { cls: "", text: "  " },
          { cls: "tok-prop", text: "variant" },
          { cls: "tok-punc", text: ": " },
          { cls: "tok-str", text: `"${themed.id}"` },
          { cls: "tok-punc", text: "," }
        ],
        [
          { cls: "", text: "  " },
          { cls: "tok-prop", text: "accent" },
          { cls: "tok-punc", text: ": " },
          { cls: "tok-str", text: `"${themed.tokens.accentPrimary}"` },
          { cls: "tok-punc", text: "," }
        ],
        [
          { cls: "", text: "  " },
          { cls: "tok-prop", text: "ratioMin" },
          { cls: "tok-punc", text: ": " },
          { cls: "tok-num", text: "4.5" }
        ],
        [{ cls: "tok-punc", text: "});" }]
      ]
    : [
        [{ cls: "tok-cmt", text: `// Matrix Theme Runtime · ${themed.name} (${themed.nameZh})` }],
        [
          { cls: "tok-kw", text: "export interface" },
          { cls: "", text: " " },
          { cls: "tok-type", text: "MatrixSurfaceConfig" },
          { cls: "", text: " " },
          { cls: "tok-punc", text: "{" }
        ],
        [
          { cls: "", text: "  " },
          { cls: "tok-prop", text: "colorScheme" },
          { cls: "tok-punc", text: ": " },
          { cls: "tok-str", text: '"only dark"' },
          { cls: "tok-punc", text: ";" }
        ],
        [
          { cls: "", text: "  " },
          { cls: "tok-prop", text: "accent" },
          { cls: "tok-punc", text: ": " },
          { cls: "tok-type", text: "HexColor" },
          { cls: "tok-punc", text: ";" }
        ],
        [{ cls: "tok-punc", text: "}" }],
        [
          { cls: "tok-kw", text: "const" },
          { cls: "", text: " " },
          { cls: "tok-var", text: "activeShell" },
          { cls: "tok-punc", text: ": " },
          { cls: "tok-type", text: "MatrixSurfaceConfig" },
          { cls: "", text: " " },
          { cls: "tok-op", text: "=" },
          { cls: "", text: " " },
          { cls: "tok-fn", text: "createMatrixTheme" },
          { cls: "tok-punc", text: "({" }
        ],
        [
          { cls: "", text: "  " },
          { cls: "tok-prop", text: "id" },
          { cls: "tok-punc", text: ": " },
          { cls: "tok-str", text: `"${themed.id}"` },
          { cls: "tok-punc", text: "," }
        ],
        [
          { cls: "", text: "  " },
          { cls: "tok-prop", text: "bgPrimary" },
          { cls: "tok-punc", text: ": " },
          { cls: "tok-str", text: `"${themed.tokens.bgPrimary}"` },
          { cls: "tok-punc", text: "," }
        ],
        [
          { cls: "", text: "  " },
          { cls: "tok-prop", text: "accent" },
          { cls: "tok-punc", text: ": " },
          { cls: "tok-str", text: `"${themed.tokens.accentPrimary}"` },
          { cls: "tok-punc", text: "," }
        ],
        [
          { cls: "", text: "  " },
          { cls: "tok-prop", text: "minContrast" },
          { cls: "tok-punc", text: ": " },
          { cls: "tok-num", text: "4.5" }
        ],
        [{ cls: "tok-punc", text: "});" }]
      ];

  lines.forEach((tokens, idx) => {
    for (const seg of tokens) {
      if (!seg.cls) {
        code.appendChild(document.createTextNode(seg.text));
      } else {
        const span = document.createElement("span");
        span.className = seg.cls;
        span.textContent = seg.text;
        code.appendChild(span);
      }
    }
    if (idx < lines.length - 1) {
      code.appendChild(document.createTextNode("\n"));
    }
  });

  preEl.appendChild(code);
}

function renderDiffBlock(containerEl, themed, compact = false) {
  if (!containerEl) return;
  containerEl.textContent = "";

  const lines = compact
    ? [
        { type: "rem", tag: "DEL", text: "- color-scheme: light; background: #FFFFFF;" },
        { type: "add", tag: "ADD", text: `+ color-scheme: only dark; background: ${themed.tokens.bgPrimary};` },
        { type: "add", tag: "ADD", text: `+ accent-primary: ${themed.tokens.accentPrimary};` }
      ]
    : [
        { type: "ctx", tag: "CTX", text: "  :root {" },
        { type: "rem", tag: "DEL", text: "-   color-scheme: light;" },
        { type: "rem", tag: "DEL", text: "-   background: #FFFFFF;" },
        { type: "add", tag: "ADD", text: "+   color-scheme: only dark;" },
        { type: "add", tag: "ADD", text: `+   background: ${themed.tokens.bgPrimary};` },
        { type: "add", tag: "ADD", text: `+   border-color: ${themed.tokens.borderDefault};` },
        { type: "ctx", tag: "CTX", text: "  }" }
      ];

  for (const item of lines) {
    const row = document.createElement("div");
    row.className = `diff-line diff-${item.type}`;
    const tag = document.createElement("span");
    tag.className = "diff-tag";
    tag.textContent = item.tag;
    const text = document.createElement("span");
    text.textContent = item.text;
    row.append(tag, text);
    containerEl.appendChild(row);
  }
}

function renderHeader(themed) {
  const variantLabelEl = document.getElementById("header-variant-label");
  const modeBadgeEl = document.getElementById("header-mode-badge");
  const activePreset = (uiState.serverState.customPresets || []).find(
    (p) => p.id === uiState.serverState.activeVariant
  );

  if (variantLabelEl) {
    variantLabelEl.textContent = activePreset
      ? `★ ${activePreset.name} (${themed.id})`
      : `${themed.nameZh} (${themed.id})`;
  }
  if (modeBadgeEl) {
    modeBadgeEl.textContent = uiState.mode === "inline" ? "INLINE CARD" : "STUDIO";
  }

  // Variant Pills + Custom Presets
  const pillsHost = document.getElementById("variant-pills");
  if (pillsHost) {
    pillsHost.textContent = "";
    for (const v of uiState.variants) {
      const isSelected = uiState.serverState.activeVariant === v.id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "variant-pill";
      btn.setAttribute("aria-pressed", String(isSelected));
      btn.dataset.variantId = v.id;

      const dot = document.createElement("span");
      dot.className = "variant-pill-dot";
      dot.style.backgroundColor = v.tokens.accentPrimary;
      dot.setAttribute("aria-hidden", "true");

      const txt = document.createElement("span");
      txt.textContent = `${v.nameZh}`;

      btn.append(dot, txt);
      btn.addEventListener("click", () => selectBuiltInVariant(v.id));
      pillsHost.appendChild(btn);
    }

    for (const preset of uiState.serverState.customPresets || []) {
      const isSelected = uiState.serverState.activeVariant === preset.id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "variant-pill";
      btn.setAttribute("aria-pressed", String(isSelected));
      btn.dataset.presetId = preset.id;

      const dot = document.createElement("span");
      dot.className = "variant-pill-dot";
      dot.style.backgroundColor = preset.tokens?.accentPrimary || themed.tokens.accentPrimary;
      dot.setAttribute("aria-hidden", "true");

      const txt = document.createElement("span");
      txt.textContent = `★ ${preset.name}`;

      btn.append(dot, txt);
      btn.addEventListener("click", () => applyCustomPreset(preset));
      pillsHost.appendChild(btn);
    }
  }

  // Rain segmented controls
  const rainBtns = document.querySelectorAll("#rain-controls .seg-btn");
  for (const btn of rainBtns) {
    const active = btn.dataset.rain === uiState.serverState.rainIntensity;
    btn.setAttribute("aria-pressed", String(active));
  }

  // Scanlines toggle
  const scanBtn = document.getElementById("scanlines-toggle");
  const scanText = document.getElementById("scanlines-state-text");
  if (scanBtn && scanText) {
    const on = Boolean(uiState.serverState.scanlines);
    scanBtn.setAttribute("aria-pressed", String(on));
    scanText.textContent = on ? "开启" : "关闭";
  }

  // Bridge status
  const bridgeEl = document.getElementById("bridge-status-text");
  if (bridgeEl) {
    if (uiState.connected) {
      const hostName = app.getHostVersion()?.name || "MCP Host";
      bridgeEl.textContent = `已连接 ${hostName}`;
    } else {
      bridgeEl.textContent = "独立预览模式";
    }
  }
}

function renderInlineView(themed, audit) {
  const titleEl = document.getElementById("inline-title");
  const taglineEl = document.getElementById("inline-tagline");
  if (titleEl) titleEl.textContent = `${themed.nameZh} (${themed.name})`;
  if (taglineEl) taglineEl.textContent = themed.tagline;

  applyWcagBadge(
    document.getElementById("inline-wcag-badge"),
    document.getElementById("inline-wcag-text"),
    audit,
    true
  );

  renderSyntaxCodeBlock(document.getElementById("inline-code-block"), themed, true);
  renderDiffBlock(document.getElementById("inline-diff-block"), themed, true);

  const swatchesEl = document.getElementById("inline-swatches");
  if (swatchesEl) {
    swatchesEl.textContent = "";
    for (const key of INLINE_SWATCH_KEYS) {
      const hex = themed.tokens[key];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch-card swatch-card-compact";
      btn.setAttribute("aria-label", `复制 ${key} 色值 ${hex}`);

      const top = document.createElement("div");
      top.className = "swatch-card-compact-top";
      top.appendChild(createSwatchChip(hex, true));

      const lbl = document.createElement("span");
      lbl.className = "swatch-label";
      lbl.textContent = key;
      top.appendChild(lbl);

      const hexSpan = document.createElement("span");
      hexSpan.className = "swatch-hex";
      hexSpan.textContent = hex;

      btn.append(top, hexSpan);
      btn.addEventListener("click", () => copyTextToClipboard(hex, `${key} (${hex})`));
      swatchesEl.appendChild(btn);
    }
  }
}

function renderPreviewTab(themed, audit) {
  const nameEl = document.getElementById("preview-variant-name");
  const descEl = document.getElementById("preview-variant-desc");
  if (nameEl) nameEl.textContent = `${themed.nameZh} · ${themed.name}`;
  if (descEl) descEl.textContent = themed.description;

  applyWcagBadge(
    document.getElementById("preview-wcag-badge"),
    document.getElementById("preview-wcag-summary"),
    audit,
    true
  );

  const overrideCount = Object.keys(getCurrentOverrides()).length;
  const ovBadge = document.getElementById("preview-override-badge");
  const ovCountEl = document.getElementById("preview-override-count");
  if (ovBadge && ovCountEl) {
    ovBadge.hidden = overrideCount === 0;
    ovCountEl.textContent = String(overrideCount);
  }

  const simVariant = document.getElementById("sim-variant-inline");
  const simBg = document.getElementById("sim-bg-code");
  if (simVariant) simVariant.textContent = themed.nameZh;
  if (simBg) simBg.textContent = themed.tokens.bgPrimary;

  renderSyntaxCodeBlock(document.getElementById("preview-code-block"), themed, false);
  renderDiffBlock(document.getElementById("preview-diff-block"), themed, false);

  const wcagStrip = document.getElementById("preview-wcag-strip");
  if (wcagStrip) {
    wcagStrip.textContent = "";
    for (const item of audit) {
      const card = document.createElement("div");
      card.className = "wcag-mini-item";

      const pair = document.createElement("span");
      pair.className = "wcag-mini-pair";
      pair.textContent = item.pair;
      pair.title = item.pair;

      const badge = document.createElement("span");
      badge.className = `wcag-badge ${item.passed ? "wcag-pass" : "wcag-fail"}`;
      badge.textContent = `${item.passed ? "✓" : "✕"} ${item.level} ${item.ratio}:1`;

      card.append(pair, badge);
      wcagStrip.appendChild(card);
    }
  }
}

function renderTokensTab(themed, audit) {
  // Antigravity Appearance Card
  const appGrid = document.getElementById("appearance-mappings-grid");
  if (appGrid) {
    appGrid.textContent = "";
    const mappings = themed.appearanceGuide?.mappings || [];
    for (const item of mappings) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "appearance-item";
      btn.setAttribute("aria-label", `复制 ${item.setting}: ${item.value}`);

      const meta = document.createElement("div");
      meta.className = "appearance-meta";
      const name = document.createElement("span");
      name.className = "appearance-name";
      name.textContent = item.setting;
      const tok = document.createElement("span");
      tok.className = "appearance-token";
      tok.textContent = `${item.token} · ${item.description}`;
      meta.append(name, tok);

      const right = document.createElement("div");
      right.className = "appearance-right";
      if (isValidHexColor(item.value)) {
        right.appendChild(createSwatchChip(item.value, true));
      }
      const hexTag = document.createElement("span");
      hexTag.className = "mono-tag";
      hexTag.textContent = item.value;
      right.appendChild(hexTag);

      btn.append(meta, right);
      btn.addEventListener("click", () =>
        copyTextToClipboard(item.value, `${item.setting} (${item.value})`)
      );
      appGrid.appendChild(btn);
    }
  }

  // Grouped Swatches
  const groupsHost = document.getElementById("swatch-groups");
  if (groupsHost) {
    groupsHost.textContent = "";
    for (const group of SWATCH_GROUPS) {
      const section = document.createElement("section");
      section.className = "swatch-group";

      const heading = document.createElement("h3");
      heading.className = "swatch-group-title";
      heading.textContent = group.title;

      const grid = document.createElement("div");
      grid.className = "swatch-grid";

      for (const entry of group.keys) {
        const hex = themed.tokens[entry.key];
        if (!hex) continue;
        const card = document.createElement("button");
        card.type = "button";
        card.className = "swatch-card";
        card.setAttribute("aria-label", `复制 ${entry.label} 色值 ${hex}`);

        const chip = createSwatchChip(hex, false);
        const info = document.createElement("div");
        info.className = "swatch-info";
        const lbl = document.createElement("span");
        lbl.className = "swatch-label";
        lbl.textContent = `--${toKebabCase(entry.key)}`;
        const hx = document.createElement("span");
        hx.className = "swatch-hex";
        hx.textContent = `${entry.key} · ${hex}`;
        info.append(lbl, hx);

        card.append(chip, info);
        card.addEventListener("click", () =>
          copyTextToClipboard(hex, `${entry.key} (${hex})`)
        );
        grid.appendChild(card);
      }

      section.append(heading, grid);
      groupsHost.appendChild(section);
    }
  }

  // WCAG Contrast Table
  applyWcagBadge(
    document.getElementById("tokens-wcag-badge"),
    document.getElementById("tokens-wcag-text"),
    audit,
    false
  );

  const tbody = document.getElementById("wcag-audit-tbody");
  if (tbody) {
    tbody.textContent = "";
    for (const row of audit) {
      const tr = document.createElement("tr");

      const tdPair = document.createElement("td");
      tdPair.className = "hex-code";
      tdPair.textContent = row.pair;

      const tdFg = document.createElement("td");
      const fgCell = document.createElement("span");
      fgCell.className = "color-cell";
      fgCell.append(createSwatchChip(row.fg, true), document.createTextNode(row.fg));
      tdFg.appendChild(fgCell);

      const tdBg = document.createElement("td");
      const bgCell = document.createElement("span");
      bgCell.className = "color-cell";
      bgCell.append(createSwatchChip(row.bg, true), document.createTextNode(row.bg));
      tdBg.appendChild(bgCell);

      const tdRatio = document.createElement("td");
      tdRatio.className = "hex-code";
      tdRatio.textContent = `${row.ratio}:1`;

      const tdReq = document.createElement("td");
      tdReq.className = "hex-code";
      tdReq.textContent = `>= ${row.required.toFixed(1)}:1`;

      const tdStatus = document.createElement("td");
      const statusBadge = document.createElement("span");
      statusBadge.className = `wcag-badge ${row.passed ? "wcag-pass" : "wcag-fail"}`;
      statusBadge.textContent = `${row.passed ? "✓" : "✕"} ${row.level} · ${row.passed ? "PASS" : "FAIL"}`;
      tdStatus.appendChild(statusBadge);

      tr.append(tdPair, tdFg, tdBg, tdRatio, tdReq, tdStatus);
      tbody.appendChild(tr);
    }
  }
}

const customizerInputRefs = new Map();

function ensureCustomizerControlsBuilt() {
  const host = document.getElementById("customizer-controls");
  if (!host || customizerInputRefs.size > 0) return;

  for (const field of CORE_CUSTOMIZER_FIELDS) {
    const row = document.createElement("div");
    row.className = "token-editor-row";

    const labelRow = document.createElement("div");
    labelRow.className = "token-editor-label-row";

    const title = document.createElement("label");
    title.className = "token-editor-title";
    title.setAttribute("for", `hex-input-${field.key}`);
    title.textContent = field.label;

    const keyTag = document.createElement("span");
    keyTag.className = "token-editor-key";
    keyTag.textContent = field.key;

    labelRow.append(title, keyTag);

    const inputsRow = document.createElement("div");
    inputsRow.className = "token-editor-inputs";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.id = `color-input-${field.key}`;
    colorInput.setAttribute("aria-label", `${field.label} 颜色选择器`);

    const hexInput = document.createElement("input");
    hexInput.type = "text";
    hexInput.id = `hex-input-${field.key}`;
    hexInput.className = "text-input";
    hexInput.maxLength = 7;
    hexInput.spellcheck = false;
    hexInput.setAttribute("autocomplete", "off");
    hexInput.setAttribute("aria-describedby", `hint-${field.key}`);

    const hintEl = document.createElement("p");
    hintEl.id = `hint-${field.key}`;
    hintEl.className = "muted-copy";
    hintEl.textContent = field.hint;

    const errEl = document.createElement("p");
    errEl.className = "token-editor-error";
    errEl.hidden = true;
    errEl.textContent = "请输入有效 6 位十六进制颜色，如 #00FF41";

    colorInput.addEventListener("input", () => {
      const hex = colorInput.value.toUpperCase();
      hexInput.value = hex;
      hexInput.classList.remove("input-invalid");
      errEl.hidden = true;
      handleLiveTokenChange(field.key, hex, false);
    });

    colorInput.addEventListener("change", () => {
      const hex = colorInput.value.toUpperCase();
      handleLiveTokenChange(field.key, hex, true);
    });

    hexInput.addEventListener("input", () => {
      const raw = hexInput.value.trim();
      const normalized = raw.startsWith("#") ? raw : `#${raw}`;
      if (isValidHexColor(normalized)) {
        const upper = normalized.toUpperCase();
        colorInput.value = upper;
        hexInput.classList.remove("input-invalid");
        errEl.hidden = true;
        handleLiveTokenChange(field.key, upper, false);
      } else {
        hexInput.classList.add("input-invalid");
        errEl.hidden = false;
      }
    });

    hexInput.addEventListener("blur", () => {
      const raw = hexInput.value.trim();
      const normalized = raw.startsWith("#") ? raw : `#${raw}`;
      if (isValidHexColor(normalized)) {
        const upper = normalized.toUpperCase();
        hexInput.value = upper;
        colorInput.value = upper;
        hexInput.classList.remove("input-invalid");
        errEl.hidden = true;
        handleLiveTokenChange(field.key, upper, true);
      }
    });

    inputsRow.append(colorInput, hexInput);
    row.append(labelRow, inputsRow, hintEl, errEl);
    host.appendChild(row);

    customizerInputRefs.set(field.key, { colorInput, hexInput, errEl });
  }
}

function renderCustomizerTab(themed, audit) {
  ensureCustomizerControlsBuilt();

  for (const field of CORE_CUSTOMIZER_FIELDS) {
    const refs = customizerInputRefs.get(field.key);
    const hex = themed.tokens[field.key];
    if (!refs || !hex) continue;
    if (document.activeElement !== refs.colorInput) {
      refs.colorInput.value = hex;
    }
    if (document.activeElement !== refs.hexInput) {
      refs.hexInput.value = hex;
      refs.hexInput.classList.remove("input-invalid");
      refs.errEl.hidden = true;
    }
  }

  applyWcagBadge(
    document.getElementById("customizer-wcag-badge"),
    document.getElementById("customizer-wcag-text"),
    audit,
    false
  );

  const pairChecksEl = document.getElementById("customizer-pair-checks");
  if (pairChecksEl) {
    pairChecksEl.textContent = "";
    for (const item of audit.slice(0, 6)) {
      const row = document.createElement("div");
      row.className = "wcag-mini-item";
      const lbl = document.createElement("span");
      lbl.className = "wcag-mini-pair";
      lbl.textContent = item.pair;
      const badge = document.createElement("span");
      badge.className = `wcag-badge ${item.passed ? "wcag-pass" : "wcag-fail"}`;
      badge.textContent = `${item.passed ? "✓" : "✕"} ${item.ratio}:1 (${item.level})`;
      row.append(lbl, badge);
      pairChecksEl.appendChild(row);
    }
  }

  const presetsHost = document.getElementById("custom-presets-list");
  if (presetsHost) {
    presetsHost.textContent = "";
    const presets = uiState.serverState.customPresets || [];
    if (presets.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted-copy";
      empty.textContent = "尚无自定义预设。调整颜色后输入名称即可保存为可复用预设。";
      presetsHost.appendChild(empty);
    } else {
      for (const preset of presets) {
        const row = document.createElement("div");
        row.className = "custom-preset-item";

        const info = document.createElement("div");
        info.className = "custom-preset-info";
        const name = document.createElement("span");
        name.className = "custom-preset-name";
        name.textContent = preset.name;
        const meta = document.createElement("span");
        meta.className = "custom-preset-meta";
        meta.textContent = `基于 ${preset.baseVariant} · ${preset.tokens?.accentPrimary || ""}`;
        info.append(name, meta);

        const btns = document.createElement("div");
        btns.className = "custom-preset-btns";

        const applyBtn = document.createElement("button");
        applyBtn.type = "button";
        applyBtn.className = "btn btn-secondary btn-sm";
        applyBtn.textContent = "应用";
        applyBtn.addEventListener("click", () => applyCustomPreset(preset));

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn btn-danger btn-sm";
        delBtn.textContent = "删除";
        delBtn.setAttribute("aria-label", `删除预设 ${preset.name}`);
        delBtn.addEventListener("click", () => deleteCustomPreset(preset.id, preset.name));

        btns.append(applyBtn, delBtn);
        row.append(info, btns);
        presetsHost.appendChild(row);
      }
    }
  }
}

function renderExportTab(themed) {
  const format = uiState.exportFormat;
  const formatBtns = document.querySelectorAll("#export-format-tabs .format-btn");
  for (const btn of formatBtns) {
    btn.setAttribute("aria-pressed", String(btn.dataset.format === format));
  }

  const overrides = getCurrentOverrides();
  const baseVariant = findBaseVariant(uiState.serverState.activeVariant);
  const hasOverrides = Object.keys(overrides).length > 0;

  let exportData =
    !hasOverrides &&
    uiState.exportsPreview &&
    uiState.exportsPreview[format]
      ? uiState.exportsPreview[format]
      : null;

  if (!exportData) {
    exportData = exportTheme(baseVariant, format, overrides);
  }

  const filenameEl = document.getElementById("export-filename");
  const langEl = document.getElementById("export-language");
  const codeEl = document.getElementById("export-code-content");

  if (filenameEl) filenameEl.textContent = exportData.filename;
  if (langEl) langEl.textContent = exportData.language;
  if (codeEl) codeEl.textContent = exportData.content;

  if (uiState.connected && uiState.activeTab === "export") {
    syncExportFromServer(baseVariant.id, format, overrides);
  }
}

async function syncExportFromServer(variantId, format, overrides) {
  const seq = ++uiState.exportRequestSeq;
  try {
    const result = await app.callServerTool({
      name: "export_matrix_theme",
      arguments: { variant: variantId, format, overrides }
    });
    if (seq !== uiState.exportRequestSeq) return;
    const exported = result?.structuredContent?.export;
    if (exported && exported.format === uiState.exportFormat) {
      const filenameEl = document.getElementById("export-filename");
      const langEl = document.getElementById("export-language");
      const codeEl = document.getElementById("export-code-content");
      if (filenameEl) filenameEl.textContent = exported.filename;
      if (langEl) langEl.textContent = exported.language;
      if (codeEl) codeEl.textContent = exported.content;
    }
  } catch {
    // Local exportTheme fallback already rendered cleanly
  }
}

function updateCapabilityButtons() {
  const canUpdateContext = Boolean(uiState.hostCaps?.updateModelContext);
  const canSendMessage = Boolean(uiState.hostCaps?.message);

  const btnCtx = document.getElementById("btn-update-context");
  const btnMsg = document.getElementById("btn-send-message");
  const inlineCtx = document.getElementById("inline-btn-context");
  const inlineMsg = document.getElementById("inline-btn-message");
  const capNote = document.getElementById("host-capabilities-note");

  if (btnCtx) btnCtx.hidden = !canUpdateContext;
  if (inlineCtx) inlineCtx.hidden = !canUpdateContext;
  if (btnMsg) btnMsg.hidden = !canSendMessage;
  if (inlineMsg) inlineMsg.hidden = !canSendMessage;

  if (capNote) {
    capNote.hidden = canUpdateContext || canSendMessage;
  }
}

function updateTabsDom() {
  const inlineView = document.getElementById("inline-view");
  const studioView = document.getElementById("studio-view");
  if (inlineView) inlineView.hidden = uiState.mode !== "inline";
  if (studioView) studioView.hidden = uiState.mode === "inline";

  for (const tabId of TAB_ORDER) {
    const btn = document.getElementById(`tab-btn-${tabId}`);
    const panel = document.getElementById(`panel-${tabId}`);
    const selected = uiState.activeTab === tabId;
    if (btn) {
      btn.setAttribute("aria-selected", String(selected));
      btn.setAttribute("tabindex", selected ? "0" : "-1");
    }
    if (panel) {
      panel.hidden = !selected;
    }
  }
}

function renderAll() {
  const themed = getEffectiveTheme();
  const audit = getEffectiveAudit(themed);

  applyThemeCssVariables(themed);
  rainController.sync(themed.tokens, uiState.serverState.rainIntensity);
  updateTabsDom();
  updateCapabilityButtons();
  renderHeader(themed);

  if (uiState.mode === "inline") {
    renderInlineView(themed, audit);
  } else {
    renderPreviewTab(themed, audit);
    renderTokensTab(themed, audit);
    renderCustomizerTab(themed, audit);
    renderExportTab(themed);
  }
}

// ---------------------------------------------------------------------------
// State Hydration & User Actions
// ---------------------------------------------------------------------------

function hydrateFromStructuredContent(sc) {
  if (!sc || typeof sc !== "object") return;

  if (sc.mode === "inline" || sc.mode === "studio") {
    uiState.mode = sc.mode;
  }
  if (typeof sc.initialTab === "string" && TAB_ORDER.includes(sc.initialTab)) {
    uiState.activeTab = sc.initialTab;
  }
  if (Array.isArray(sc.variants) && sc.variants.length > 0) {
    uiState.variants = sc.variants;
  }
  if (sc.state && typeof sc.state === "object") {
    const validTargets = Array.isArray(sc.state.lastTargets)
      ? sc.state.lastTargets.filter((t) => ["css", "tailwind", "json"].includes(t))
      : [];
    uiState.serverState = {
      activeVariant:
        sc.activeTheme?.id || sc.state.activeVariant || uiState.serverState.activeVariant,
      rainIntensity: sc.state.rainIntensity || uiState.serverState.rainIntensity,
      scanlines:
        typeof sc.state.scanlines === "boolean"
          ? sc.state.scanlines
          : uiState.serverState.scanlines,
      overrides:
        sc.state.overrides && typeof sc.state.overrides === "object"
          ? sc.state.overrides
          : {},
      customPresets: Array.isArray(sc.state.customPresets)
        ? sc.state.customPresets
        : [],
      lastProjectDir:
        typeof sc.state.lastProjectDir === "string"
          ? sc.state.lastProjectDir
          : uiState.serverState.lastProjectDir,
      lastOutputDir:
        typeof sc.state.lastOutputDir === "string" && sc.state.lastOutputDir.trim()
          ? sc.state.lastOutputDir
          : uiState.serverState.lastOutputDir,
      lastTargets:
        validTargets.length > 0 ? validTargets : uiState.serverState.lastTargets
    };
  } else if (sc.activeTheme?.id) {
    uiState.serverState.activeVariant = sc.activeTheme.id;
  }
  if (sc.exportsPreview && typeof sc.exportsPreview === "object") {
    uiState.exportsPreview = sc.exportsPreview;
  }

  syncApplyFormFromState();
  renderAll();
}

function syncApplyFormFromState() {
  const projectInput = document.getElementById("apply-project-dir");
  if (
    projectInput &&
    !uiState.applyFormDirty.projectDir &&
    document.activeElement !== projectInput
  ) {
    projectInput.value = uiState.serverState.lastProjectDir || "";
  }

  const outputInput = document.getElementById("apply-output-dir");
  if (
    outputInput &&
    !uiState.applyFormDirty.outputDir &&
    document.activeElement !== outputInput
  ) {
    outputInput.value = uiState.serverState.lastOutputDir || "styles/matrix-theme";
  }

  if (!uiState.applyFormDirty.targets) {
    const activeTargets = new Set(
      Array.isArray(uiState.serverState.lastTargets) &&
      uiState.serverState.lastTargets.length > 0
        ? uiState.serverState.lastTargets
        : ["css", "tailwind"]
    );
    document.querySelectorAll('input[name="apply-target"]').forEach((cb) => {
      cb.checked = activeTargets.has(cb.value);
    });
  }
}

function renderApplyResultError(message) {
  const box = document.getElementById("apply-result-box");
  if (!box) return;
  box.hidden = false;
  box.className = "apply-result-box apply-result-error";
  box.setAttribute("role", "alert");
  box.textContent = "";

  const header = document.createElement("div");
  header.className = "apply-result-header";

  const title = document.createElement("h3");
  title.className = "apply-result-title apply-result-title-err";
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✕";
  const lbl = document.createElement("span");
  lbl.textContent = "未能写入项目主题文件";
  title.append(icon, lbl);

  header.appendChild(title);

  const detail = document.createElement("p");
  detail.className = "muted-copy";
  detail.textContent = message;

  box.append(header, detail);
}

async function handleOpenInAuxPane(file) {
  if (!uiState.connected) {
    showToast("独立预览模式无法打开宿主侧边栏，请在 Antigravity 中操作", "warn");
    return;
  }
  if (!file?.fileUri) {
    showToast("未返回文件 URI，请在项目目录中打开该文件", "warn");
    return;
  }

  try {
    const res = await app.request(
      {
        method: "com.google.antigravity/toggle-aux-pane",
        params: { tabType: "fileView", uri: file.fileUri }
      },
      toggleAuxPaneResultSchema
    );
    if (res?.isError) {
      showToast("宿主未能在侧边栏打开该文件，请在项目中手动打开", "warn");
    } else {
      showToast(`已在侧边栏打开 ${file.relativePath || "文件"}`);
    }
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (msg.includes("-32601") || msg.toLowerCase().includes("method not found")) {
      showToast("当前宿主暂不支持侧边栏打开文件，请在项目中查看生成文件", "warn");
    } else {
      showToast(`打开侧边栏失败，请在项目目录查看 ${file.relativePath || ""}`, "warn");
    }
  }
}

function renderApplyResultSuccess(sc) {
  const box = document.getElementById("apply-result-box");
  if (!box) return;
  box.hidden = false;
  box.className = "apply-result-box";
  box.setAttribute("role", "status");
  box.textContent = "";

  const files = Array.isArray(sc.writtenFiles) ? sc.writtenFiles : [];

  const header = document.createElement("div");
  header.className = "apply-result-header";

  const title = document.createElement("h3");
  title.className = "apply-result-title apply-result-title-ok";
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✓";
  const lbl = document.createElement("span");
  lbl.textContent = `已写入 ${files.length} 个主题文件`;
  title.append(icon, lbl);

  const variantTag = document.createElement("span");
  variantTag.className = "mono-tag";
  variantTag.textContent = sc.variantName || sc.variantId || uiState.serverState.activeVariant;

  header.append(title, variantTag);
  box.appendChild(header);

  if (files.length > 0 || sc.autoImportedFile) {
    const list = document.createElement("div");
    list.className = "apply-files-list";

    for (const file of files) {
      const row = document.createElement("div");
      row.className = "apply-file-row";

      const meta = document.createElement("div");
      meta.className = "apply-file-meta";

      const targetBadge = document.createElement("span");
      targetBadge.className = "status-pill";
      targetBadge.textContent = String(file.target || "file").toUpperCase();

      const relPath = document.createElement("span");
      relPath.className = "apply-file-path";
      relPath.textContent = file.relativePath || file.absolutePath;

      const sizeBadge = document.createElement("span");
      sizeBadge.className = "mono-tag";
      sizeBadge.textContent = `${file.bytes ?? 0} B`;

      meta.append(targetBadge, relPath, sizeBadge);

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "btn btn-secondary btn-sm";
      openBtn.textContent = "在侧边栏打开";
      openBtn.addEventListener("click", () => handleOpenInAuxPane(file));

      row.append(meta, openBtn);
      list.appendChild(row);
    }

    if (sc.autoImportedFile) {
      const imp = sc.autoImportedFile;
      const row = document.createElement("div");
      row.className = "apply-file-row";

      const meta = document.createElement("div");
      meta.className = "apply-file-meta";

      const tag = document.createElement("span");
      tag.className = "wcag-badge wcag-pass";
      tag.textContent = imp.alreadyImported ? "✓ 已引入 (幂等)" : "✓ 已注入 @import";

      const relPath = document.createElement("span");
      relPath.className = "apply-file-path";
      relPath.textContent = `${imp.relativePath} · ${imp.importLine || ""}`;

      meta.append(tag, relPath);
      row.appendChild(meta);

      if (imp.fileUri) {
        const openImpBtn = document.createElement("button");
        openImpBtn.type = "button";
        openImpBtn.className = "btn btn-secondary btn-sm";
        openImpBtn.textContent = "在侧边栏打开";
        openImpBtn.addEventListener("click", () => handleOpenInAuxPane(imp));
        row.appendChild(openImpBtn);
      }

      list.appendChild(row);
    }

    box.appendChild(list);
  }

  if (sc.usageSnippet) {
    const wrap = document.createElement("div");
    wrap.className = "apply-snippet-wrap";

    const head = document.createElement("div");
    head.className = "apply-snippet-head";

    const snLbl = document.createElement("span");
    snLbl.className = "form-label";
    snLbl.textContent = "引入示例 (Usage Snippet)";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn btn-secondary btn-sm";
    copyBtn.textContent = "复制引入片段";
    copyBtn.addEventListener("click", () =>
      copyTextToClipboard(sc.usageSnippet, "引入代码片段")
    );

    head.append(snLbl, copyBtn);

    const pre = document.createElement("pre");
    pre.className = "code-box code-scroll";
    const code = document.createElement("code");
    code.textContent = sc.usageSnippet;
    pre.appendChild(code);

    wrap.append(head, pre);
    box.appendChild(wrap);
  }
}

async function handleApplyProjectSubmit(event) {
  event.preventDefault();
  if (uiState.applyPending) return;

  const projectInput = document.getElementById("apply-project-dir");
  const outputInput = document.getElementById("apply-output-dir");
  const autoImportInput = document.getElementById("apply-auto-import");
  const submitBtn = document.getElementById("apply-project-btn");

  const projectDir = projectInput?.value?.trim() || "";
  const outputDir = outputInput?.value?.trim() || "";
  const autoImportCss = autoImportInput?.value?.trim() || "";
  const targets = Array.from(
    document.querySelectorAll('input[name="apply-target"]:checked')
  ).map((el) => el.value);

  if (!projectDir) {
    renderApplyResultError("请填写目标项目目录的绝对路径（例如 E:\\my-web-app）。");
    showToast("请先输入目标项目目录", "warn");
    projectInput?.focus();
    return;
  }

  if (!outputDir) {
    renderApplyResultError("请填写相对于项目目录的输出子目录（例如 styles/matrix-theme）。");
    showToast("请先输入输出子目录", "warn");
    outputInput?.focus();
    return;
  }

  if (targets.length === 0) {
    renderApplyResultError("请至少勾选一种目标主题文件格式（CSS 变量 / Tailwind v4 / JSON Tokens）。");
    showToast("请至少选择一个输出格式", "warn");
    return;
  }

  if (!uiState.connected) {
    const standaloneMsg =
      "当前处于独立浏览器预览模式（未连接 MCP 服务器），无法直接向本地项目目录写入文件。请在 Antigravity 中打开 Matrix Theme Studio 后重试，或使用下方“复制导出代码”。";
    renderApplyResultError(standaloneMsg);
    showToast("独立预览模式不可写本地文件，请复制导出代码", "warn");
    return;
  }

  const args = {
    projectDir,
    variant: uiState.serverState.activeVariant,
    targets,
    outputDir
  };
  const currentOverrides = getCurrentOverrides();
  if (Object.keys(currentOverrides).length > 0) {
    args.overrides = currentOverrides;
  }
  if (autoImportCss) {
    args.autoImportCss = autoImportCss;
  }

  uiState.applyPending = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.setAttribute("aria-busy", "true");
    submitBtn.textContent = "⏳ 正在写入项目主题文件...";
  }

  try {
    const result = await app.callServerTool({
      name: "apply_matrix_theme_to_project",
      arguments: args
    });

    if (result?.isError) {
      const errText = extractResultText(result);
      renderApplyResultError(errText);
      showToast(`写入项目失败：${errText}`, "error");
      return;
    }

    const sc = result?.structuredContent;
    if (sc?.applied) {
      if (sc.state && typeof sc.state === "object") {
        uiState.serverState = {
          ...uiState.serverState,
          ...sc.state
        };
        uiState.applyFormDirty = {
          projectDir: false,
          outputDir: false,
          targets: false
        };
        syncApplyFormFromState();
      }
      renderApplyResultSuccess(sc);
      const count = Array.isArray(sc.writtenFiles) ? sc.writtenFiles.length : targets.length;
      showToast(`✓ 已写入 ${count} 个主题文件到项目`);
    } else {
      const fallbackText = extractResultText(result) || "未能确认项目主题写入结果";
      renderApplyResultError(fallbackText);
      showToast(fallbackText, "warn");
    }
  } catch (err) {
    const msg = `调用 apply_matrix_theme_to_project 失败：${err?.message || String(err)}`;
    renderApplyResultError(msg);
    showToast("写入项目失败", "error");
  } finally {
    uiState.applyPending = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.removeAttribute("aria-busy");
      submitBtn.textContent = "⚡ 一键写入项目主题文件";
    }
  }
}

function extractResultText(result) {
  if (!result?.content || !Array.isArray(result.content)) return "未知错误";
  return result.content
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join(" ");
}

async function persistStatePatch(patch, successToast = "") {
  if (!uiState.connected) {
    if (successToast) showToast(successToast);
    return;
  }
  try {
    const result = await app.callServerTool({
      name: "save_theme_state",
      arguments: patch
    });
    if (result?.isError) {
      showToast(`保存失败：${extractResultText(result)}`, "error");
      return;
    }
    if (result?.structuredContent) {
      hydrateFromStructuredContent(result.structuredContent);
    }
    if (successToast) showToast(successToast);
  } catch {
    showToast("与 MCP 服务器同步失败，已保留本地更改", "warn");
  }
}

function selectBuiltInVariant(variantId) {
  const variant = findBaseVariant(variantId);
  uiState.serverState.activeVariant = variant.id;
  uiState.serverState.rainIntensity = variant.rainDefaults?.intensity || "subtle";
  uiState.serverState.scanlines = Boolean(variant.rainDefaults?.scanlines);
  uiState.exportsPreview = null;
  renderAll();

  persistStatePatch(
    {
      activeVariant: variant.id,
      rainIntensity: uiState.serverState.rainIntensity,
      scanlines: uiState.serverState.scanlines
    },
    `已切换至「${variant.nameZh}」`
  );
}

function applyCustomPreset(preset) {
  if (!preset || typeof preset !== "object") return;
  uiState.serverState.activeVariant = preset.id;
  uiState.exportsPreview = null;
  renderAll();

  persistStatePatch(
    {
      activeVariant: preset.id
    },
    `已应用预设「${preset.name}」`
  );
}

async function deleteCustomPreset(presetId, presetName) {
  if (uiState.serverState.activeVariant === presetId) {
    uiState.serverState.activeVariant = "classic-phosphor";
  }
  if (uiState.serverState.overrides) {
    delete uiState.serverState.overrides[presetId];
  }
  uiState.serverState.customPresets = (uiState.serverState.customPresets || []).filter(
    (p) => p.id !== presetId
  );
  renderAll();
  await persistStatePatch({ deleteCustomPresetId: presetId }, `已删除预设「${presetName}」`);
}

function setRainIntensity(intensity) {
  if (!["off", "subtle", "full"].includes(intensity)) return;
  uiState.serverState.rainIntensity = intensity;
  renderAll();
  const label = intensity === "off" ? "关闭" : intensity === "full" ? "全开" : "柔和";
  persistStatePatch({ rainIntensity: intensity }, `数字雨已设为：${label}`);
}

function toggleScanlines() {
  const next = !uiState.serverState.scanlines;
  uiState.serverState.scanlines = next;
  renderAll();
  persistStatePatch({ scanlines: next }, `CRT 扫描线已${next ? "开启" : "关闭"}`);
}

function handleLiveTokenChange(tokenKey, hex, commitToServer) {
  const variantId = uiState.serverState.activeVariant;
  const prev = getCurrentOverrides();
  uiState.serverState.overrides = {
    ...uiState.serverState.overrides,
    [variantId]: {
      ...prev,
      [tokenKey]: hex
    }
  };
  uiState.exportsPreview = null;
  renderAll();

  if (commitToServer) {
    clearTimeout(uiState.overrideSyncTimer);
    uiState.overrideSyncTimer = setTimeout(() => {
      persistStatePatch({
        activeVariant: variantId,
        variant: variantId,
        overrides: { [tokenKey]: hex }
      });
    }, 120);
  }
}

async function handleSaveOverrides() {
  const variantId = uiState.serverState.activeVariant;
  const overrides = getCurrentOverrides();
  await persistStatePatch(
    {
      activeVariant: variantId,
      variant: variantId,
      overrides,
      replaceOverrides: true
    },
    "已保存当前主题微调"
  );
}

async function handleResetOverrides() {
  const variantId = uiState.serverState.activeVariant;
  const nextOverrides = { ...uiState.serverState.overrides };
  delete nextOverrides[variantId];
  uiState.serverState.overrides = nextOverrides;
  uiState.exportsPreview = null;
  renderAll();

  if (!uiState.connected) {
    showToast("已重置当前变体为默认色值");
    return;
  }

  try {
    const result = await app.callServerTool({
      name: "reset_theme_state",
      arguments: { variant: variantId }
    });
    if (result?.isError) {
      showToast(`重置失败：${extractResultText(result)}`, "error");
      return;
    }
    if (result?.structuredContent) {
      hydrateFromStructuredContent(result.structuredContent);
    }
    showToast("已重置当前变体为默认色值");
  } catch {
    showToast("本地已重置，服务器同步失败", "warn");
  }
}

async function handleSavePresetSubmit(event) {
  event.preventDefault();
  const input = document.getElementById("preset-name-input");
  const name = input?.value?.trim();
  if (!name) {
    showToast("请输入预设名称", "warn");
    return;
  }

  const variantId = uiState.serverState.activeVariant;
  const overrides = getCurrentOverrides();

  if (!uiState.connected) {
    const themed = getEffectiveTheme();
    const baseVariantId = themed.baseVariant || themed.id;
    const localPreset = {
      id: `custom-local-${Date.now()}`,
      name,
      baseVariant: baseVariantId,
      tokens: { ...themed.tokens },
      createdAt: new Date().toISOString()
    };
    uiState.serverState.customPresets = [
      ...uiState.serverState.customPresets,
      localPreset
    ];
    uiState.serverState.activeVariant = localPreset.id;
    if (input) input.value = "";
    renderAll();
    showToast(`已保存预设「${name}」`);
    return;
  }

  if (input) input.value = "";
  await persistStatePatch(
    {
      activeVariant: variantId,
      variant: variantId,
      overrides,
      replaceOverrides: true,
      saveCustomPreset: { name }
    },
    `已保存自定义预设「${name}」`
  );
}

function switchTab(tabId, focusTab = false) {
  if (!TAB_ORDER.includes(tabId)) return;
  uiState.activeTab = tabId;
  updateTabsDom();
  if (tabId === "export") {
    renderExportTab(getEffectiveTheme());
  }
  if (focusTab) {
    const btn = document.getElementById(`tab-btn-${tabId}`);
    btn?.focus();
  }
}

async function handleUpdateModelContext() {
  if (!uiState.connected || !uiState.hostCaps?.updateModelContext) return;
  const themed = getEffectiveTheme();
  const audit = getEffectiveAudit(themed);
  const cssExport = exportTheme(
    findBaseVariant(uiState.serverState.activeVariant),
    "css",
    getCurrentOverrides()
  );
  const summary = summarizeAudit(audit);

  const contextMarkdown = [
    `# Matrix Theme Studio 当前激活主题`,
    `- 变体：${themed.nameZh} (${themed.name} / \`${themed.id}\`)`,
    `- 数字雨强度：\`${uiState.serverState.rainIntensity}\` · CRT 扫描线：\`${uiState.serverState.scanlines ? "开启" : "关闭"}\``,
    `- WCAG 2.1 审计：${summary.passedCount}/${summary.total} 通过（最低对比度 ${summary.minRatio}:1）`,
    ``,
    `## CSS Variables`,
    "```css",
    cssExport.content.trim(),
    "```"
  ].join("\n");

  try {
    await app.updateModelContext({
      content: [{ type: "text", text: contextMarkdown }],
      structuredContent: {
        variantId: themed.id,
        name: themed.name,
        nameZh: themed.nameZh,
        rainIntensity: uiState.serverState.rainIntensity,
        scanlines: uiState.serverState.scanlines,
        tokens: themed.tokens,
        contrastSummary: summary
      }
    });
    showToast(`已将「${themed.nameZh}」附加到对话上下文`);
  } catch {
    showToast("附加主题到对话失败", "error");
  }
}

async function handleSendMessageToChat() {
  if (!uiState.connected || !uiState.hostCaps?.message) return;
  const themed = getEffectiveTheme();
  const promptText = [
    `请使用 Matrix Theme Studio 的「${themed.nameZh} (${themed.id})」主题配置，生成一个自包含的黑客帝国黑绿风格 HTML Artifact 界面：`,
    `- color-scheme: only dark; bgPrimary: ${themed.tokens.bgPrimary}; bgSecondary: ${themed.tokens.bgSecondary}`,
    `- accentPrimary: ${themed.tokens.accentPrimary}; textPrimary: ${themed.tokens.textPrimary}; borderDefault: ${themed.tokens.borderDefault}`,
    `- 字体使用等宽栈，支持 prefers-reduced-motion 与 forced-colors，且零外部 CDN 链接。`
  ].join("\n");

  try {
    const result = await app.sendMessage({
      role: "user",
      content: [{ type: "text", text: promptText }]
    });
    if (result?.isError) {
      showToast("宿主拒绝发送对话消息", "warn");
    } else {
      showToast("已发送到对话生成界面");
    }
  } catch {
    showToast("发送到对话失败", "error");
  }
}

function getCurrentExportText(formatOverride) {
  const format = formatOverride || uiState.exportFormat;
  const baseVariant = findBaseVariant(uiState.serverState.activeVariant);
  return exportTheme(baseVariant, format, getCurrentOverrides());
}

// ---------------------------------------------------------------------------
// Event Wiring & Bootstrap
// ---------------------------------------------------------------------------

function bindStaticListeners() {
  document.querySelectorAll("#rain-controls .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.rain) setRainIntensity(btn.dataset.rain);
    });
  });

  document.getElementById("scanlines-toggle")?.addEventListener("click", toggleScanlines);

  const tablist = document.getElementById("studio-tablist");
  if (tablist) {
    tablist.addEventListener("click", (ev) => {
      const btn = ev.target.closest('[role="tab"]');
      if (btn?.dataset.tab) switchTab(btn.dataset.tab, false);
    });

    tablist.addEventListener("keydown", (ev) => {
      const currentBtn = ev.target.closest('[role="tab"]');
      if (!currentBtn) return;
      const idx = TAB_ORDER.indexOf(currentBtn.dataset.tab);
      if (idx === -1) return;

      let nextIdx = null;
      if (ev.key === "ArrowRight") nextIdx = (idx + 1) % TAB_ORDER.length;
      else if (ev.key === "ArrowLeft") nextIdx = (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
      else if (ev.key === "Home") nextIdx = 0;
      else if (ev.key === "End") nextIdx = TAB_ORDER.length - 1;

      if (nextIdx !== null) {
        ev.preventDefault();
        switchTab(TAB_ORDER[nextIdx], true);
      }
    });
  }

  document.getElementById("sim-apply-btn")?.addEventListener("click", () => {
    const exported = getCurrentExportText("css");
    copyTextToClipboard(exported.content, "CSS 变量");
  });

  document.getElementById("sim-jump-export-btn")?.addEventListener("click", () => {
    switchTab("export", true);
  });

  document.getElementById("preview-apply-project-btn")?.addEventListener("click", () => {
    switchTab("export", false);
    requestAnimationFrame(() => {
      document.getElementById("apply-project-dir")?.focus();
    });
  });

  document.getElementById("apply-project-dir")?.addEventListener("input", () => {
    uiState.applyFormDirty.projectDir = true;
  });

  document.getElementById("apply-output-dir")?.addEventListener("input", () => {
    uiState.applyFormDirty.outputDir = true;
  });

  document.querySelectorAll('input[name="apply-target"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      uiState.applyFormDirty.targets = true;
    });
  });

  document.getElementById("apply-project-form")?.addEventListener("submit", handleApplyProjectSubmit);

  document.getElementById("copy-appearance-guide-btn")?.addEventListener("click", () => {
    const exported = getCurrentExportText("antigravity-guide");
    copyTextToClipboard(exported.content, "Antigravity Appearance 指南");
  });

  document.getElementById("save-overrides-btn")?.addEventListener("click", handleSaveOverrides);
  document.getElementById("reset-overrides-btn")?.addEventListener("click", handleResetOverrides);
  document.getElementById("save-preset-form")?.addEventListener("submit", handleSavePresetSubmit);

  document.querySelectorAll("#export-format-tabs .format-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!btn.dataset.format) return;
      uiState.exportFormat = btn.dataset.format;
      renderExportTab(getEffectiveTheme());
    });
  });

  document.getElementById("copy-export-btn")?.addEventListener("click", () => {
    const exported = getCurrentExportText();
    copyTextToClipboard(exported.content, exported.filename);
  });

  document.getElementById("inline-copy-css")?.addEventListener("click", () => {
    const exported = getCurrentExportText("css");
    copyTextToClipboard(exported.content, exported.filename);
  });

  document.getElementById("inline-copy-guide")?.addEventListener("click", () => {
    const exported = getCurrentExportText("antigravity-guide");
    copyTextToClipboard(exported.content, "Appearance 配置指南");
  });

  document.getElementById("btn-update-context")?.addEventListener("click", handleUpdateModelContext);
  document.getElementById("inline-btn-context")?.addEventListener("click", handleUpdateModelContext);
  document.getElementById("btn-send-message")?.addEventListener("click", handleSendMessageToChat);
  document.getElementById("inline-btn-message")?.addEventListener("click", handleSendMessageToChat);
}

async function bootstrap() {
  rainController.init();
  bindStaticListeners();

  // Register MCP Apps event handlers BEFORE calling connect()
  app.ontoolinput = (params) => {
    const args = params?.arguments;
    if (!args || typeof args !== "object") return;
    if (typeof args.variant === "string") {
      const matched = findBaseVariant(args.variant);
      uiState.serverState.activeVariant = matched.id;
      uiState.serverState.rainIntensity = matched.rainDefaults?.intensity || "subtle";
      uiState.serverState.scanlines = Boolean(matched.rainDefaults?.scanlines);
    }
    if (typeof args.tab === "string" && TAB_ORDER.includes(args.tab)) {
      uiState.activeTab = args.tab;
    }
    renderAll();
  };

  app.ontoolresult = (params) => {
    if (params?.isError) {
      showToast(`工具执行异常：${extractResultText(params)}`, "error");
      return;
    }
    if (params?.structuredContent) {
      hydrateFromStructuredContent(params.structuredContent);
    }
  };

  app.onhostcontextchanged = (ctx) => {
    uiState.hostContext = { ...(uiState.hostContext || {}), ...(ctx || {}) };
    if (ctx?.toolInfo?.tool?.name === "preview_matrix_card") {
      uiState.mode = "inline";
    }
    renderAll();
  };

  const isEmbedded = typeof window !== "undefined" && window.parent && window.parent !== window;

  if (isEmbedded) {
    try {
      await app.connect();
      uiState.connected = true;
      uiState.hostCaps = app.getHostCapabilities() ?? {};
      uiState.hostContext = app.getHostContext() ?? {};
      if (uiState.hostContext?.toolInfo?.tool?.name === "preview_matrix_card") {
        uiState.mode = "inline";
      }
    } catch {
      uiState.connected = false;
      uiState.hostCaps = null;
    }
  } else {
    const query = new URLSearchParams(window.location.search);
    const qMode = query.get("mode");
    if (qMode === "inline" || qMode === "studio") {
      uiState.mode = qMode;
    }
    const qVariant = query.get("variant");
    if (qVariant) {
      const v = findBaseVariant(qVariant);
      uiState.serverState.activeVariant = v.id;
      uiState.serverState.rainIntensity = v.rainDefaults?.intensity || "subtle";
      uiState.serverState.scanlines = Boolean(v.rainDefaults?.scanlines);
    }
    const qTab = query.get("tab");
    if (qTab && TAB_ORDER.includes(qTab)) {
      uiState.activeTab = qTab;
    }
  }

  syncApplyFormFromState();
  renderAll();
}

bootstrap();
