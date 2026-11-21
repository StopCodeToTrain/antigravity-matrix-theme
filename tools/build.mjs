import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { THEME_VARIANTS, auditVariantContrast } from "../src/themes/themes.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function writeUtf8NoBom(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, stripBom(content), { encoding: "utf8" });
}

function assertNoForbiddenExternalReferences(html) {
  const checks = [
    {
      name: "external <script> URL",
      regex: /<script\b[^>]*https?:\/\//i
    },
    {
      name: "external <link> URL",
      regex: /<link\b[^>]*https?:\/\//i
    },
    {
      name: "external CSS @import URL",
      regex: /@import\b[^;\n]*https?:\/\//i
    },
    {
      name: "runtime fetch() call",
      regex: /\bfetch\s*\(/
    }
  ];

  for (const { name, regex } of checks) {
    const match = html.match(regex);
    if (match) {
      throw new Error(
        `CSP build check failed: generated matrix-studio.html contains forbidden ${name}: ${match[0]}`
      );
    }
  }
}

async function buildThemesJson() {
  const outPath = path.join(ROOT_DIR, "matrix-theme", "assets", "themes.json");
  const payload = {
    generatedAt: new Date().toISOString(),
    colorScheme: "only dark",
    variants: THEME_VARIANTS.map((variant) => ({
      ...variant,
      contrastAudit: auditVariantContrast(variant.tokens)
    }))
  };

  writeUtf8NoBom(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  return outPath;
}

async function buildMcpServer() {
  const entryPath = path.join(ROOT_DIR, "src", "mcp-server", "server.mjs");
  const outPath = path.join(ROOT_DIR, "matrix-theme", "scripts", "mcp-server.cjs");

  if (!fs.existsSync(entryPath)) {
    throw new Error(`Missing MCP server entrypoint: ${entryPath}`);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  await esbuild.build({
    entryPoints: [entryPath],
    outfile: outPath,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    charset: "utf8",
    logLevel: "warning"
  });

  const bundled = fs.readFileSync(outPath, "utf8");
  writeUtf8NoBom(outPath, bundled);
  return outPath;
}

async function buildStudioHtml() {
  const htmlPath = path.join(ROOT_DIR, "src", "ui", "index.html");
  const cssPath = path.join(ROOT_DIR, "src", "ui", "styles.css");
  const jsEntryPath = path.join(ROOT_DIR, "src", "ui", "app.mjs");
  const outPath = path.join(ROOT_DIR, "matrix-theme", "assets", "matrix-studio.html");

  for (const required of [htmlPath, cssPath, jsEntryPath]) {
    if (!fs.existsSync(required)) {
      throw new Error(`Missing Studio UI source file: ${required}`);
    }
  }

  const rawHtml = stripBom(fs.readFileSync(htmlPath, "utf8"));
  const rawCss = stripBom(fs.readFileSync(cssPath, "utf8"));

  if (/<\/style/i.test(rawCss)) {
    throw new Error("styles.css must not contain literal </style> closing tag.");
  }

  const uiResult = await esbuild.build({
    entryPoints: [jsEntryPath],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    target: ["es2022"],
    charset: "utf8",
    minify: true,
    logLevel: "warning"
  });

  if (!uiResult.outputFiles || uiResult.outputFiles.length === 0) {
    throw new Error("esbuild produced no output for src/ui/app.mjs");
  }

  const bundledJs = stripBom(uiResult.outputFiles[0].text);
  if (/<\/script/i.test(bundledJs)) {
    throw new Error("Bundled UI JavaScript contains literal </script> which breaks inline HTML.");
  }

  const linkRegex = /<link\b[^>]*href=["']\.\/styles\.css["'][^>]*\/?>/i;
  const scriptRegex = /<script\b[^>]*src=["']\.\/app\.mjs["'][^>]*>\s*<\/script>/i;

  if (!linkRegex.test(rawHtml)) {
    throw new Error(
      'src/ui/index.html must include <link rel="stylesheet" href="./styles.css" /> for build inlining.'
    );
  }
  if (!scriptRegex.test(rawHtml)) {
    throw new Error(
      'src/ui/index.html must include <script type="module" src="./app.mjs"></script> for build inlining.'
    );
  }

  const finalHtml = rawHtml
    .replace(linkRegex, () => `<style>\n${rawCss}\n</style>`)
    .replace(scriptRegex, () => `<script>\n${bundledJs}\n</script>`);

  assertNoForbiddenExternalReferences(finalHtml);
  writeUtf8NoBom(outPath, finalHtml);
  return outPath;
}

async function main() {
  const themesJsonPath = await buildThemesJson();
  const mcpServerPath = await buildMcpServer();
  const studioHtmlPath = await buildStudioHtml();

  const outputs = [themesJsonPath, mcpServerPath, studioHtmlPath].map((filePath) => {
    const size = fs.statSync(filePath).size;
    return `  - ${path.relative(ROOT_DIR, filePath)} (${size} bytes)`;
  });

  console.log("Matrix Theme Studio build succeeded:\n" + outputs.join("\n"));
}

main().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
