import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const SERVER_PATH = path.join(REPO_ROOT, "matrix-theme", "scripts", "mcp-server.cjs");

class StdioJsonRpcClient {
  /**
   * @param {string} serverScriptPath
   * @param {string} dataDir
   */
  constructor(serverScriptPath, dataDir) {
    this.serverScriptPath = serverScriptPath;
    this.dataDir = dataDir;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";
    this.stderrChunks = [];
    this.child = null;
  }

  start() {
    this.child = spawn(
      process.execPath,
      [this.serverScriptPath, "--data-dir", this.dataDir],
      {
        cwd: REPO_ROOT,
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");

    this.child.stdout.on("data", (chunk) => {
      this.buffer += chunk;
      let newlineIndex = this.buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = this.buffer.slice(0, newlineIndex).replace(/\r$/, "").trim();
        this.buffer = this.buffer.slice(newlineIndex + 1);
        if (line.length > 0) {
          this.handleLine(line);
        }
        newlineIndex = this.buffer.indexOf("\n");
      }
    });

    this.child.stderr.on("data", (chunk) => {
      this.stderrChunks.push(chunk);
    });

    this.child.on("exit", (code, signal) => {
      for (const [id, entry] of this.pending.entries()) {
        clearTimeout(entry.timer);
        entry.reject(
          new Error(
            `MCP server exited prematurely (code=${code}, signal=${signal}) while awaiting request #${id}. stderr:\n${this.stderrChunks.join("")}`
          )
        );
      }
      this.pending.clear();
    });
  }

  handleLine(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (error) {
      console.error("[verify-mcp] Invalid JSON line from server:", line, error);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(msg, "id") && msg.id !== null) {
      const pendingEntry = this.pending.get(msg.id);
      if (pendingEntry) {
        clearTimeout(pendingEntry.timer);
        this.pending.delete(msg.id);
        if (msg.error) {
          pendingEntry.reject(
            new Error(
              `JSON-RPC error (${msg.error.code}): ${msg.error.message}${msg.error.data ? ` ${JSON.stringify(msg.error.data)}` : ""}`
            )
          );
        } else {
          pendingEntry.resolve(msg.result);
        }
      }
    }
  }

  request(method, params = {}, timeoutMs = 10000) {
    if (!this.child || this.child.killed) {
      return Promise.reject(new Error("MCP server process is not running."));
    }

    const id = this.nextId++;
    const payload = `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `Timed out waiting for ${method} (#${id}) after ${timeoutMs}ms. stderr:\n${this.stderrChunks.join("")}`
          )
        );
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(payload, "utf8");
    });
  }

  notify(method, params = {}) {
    if (!this.child || this.child.killed) {
      throw new Error("MCP server process is not running.");
    }
    const payload = `${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`;
    this.child.stdin.write(payload, "utf8");
  }

  async initialize() {
    const result = await this.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {
        extensions: {
          "io.modelcontextprotocol/ui": {},
          "com.google.antigravity/ui": {
            entrypoints: ["aux_pane", "global", "file"]
          }
        }
      },
      clientInfo: {
        name: "verify-mcp",
        version: "1.0.0"
      }
    });

    this.notify("notifications/initialized", {});
    return result;
  }

  async close() {
    if (!this.child) return;
    const child = this.child;
    this.child = null;

    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
    }
    this.pending.clear();

    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      child.once("exit", done);
      try {
        child.stdin.end();
      } catch {
        // Ignore stdin end failures.
      }

      setTimeout(() => {
        if (!settled) {
          try {
            child.kill("SIGTERM");
          } catch {
            // Ignore kill failures.
          }
        }
      }, 300);

      setTimeout(() => {
        if (!settled) {
          try {
            child.kill("SIGKILL");
          } catch {
            // Ignore kill failures.
          }
          done();
        }
      }, 1500);
    });
  }
}

async function runVerification() {
  assert.ok(
    fs.existsSync(SERVER_PATH),
    `Bundled MCP server not found at ${SERVER_PATH}. Run "npm run build" first.`
  );

  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "matrix-mcp-verify-"));
  const tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), "matrix-project-verify-"));
  let client = null;

  try {
    console.log(`[1/8] Spawning bundled MCP server with --data-dir ${tempDataDir}`);
    client = new StdioJsonRpcClient(SERVER_PATH, tempDataDir);
    client.start();

    const initResult = await client.initialize();
    assert.equal(initResult.serverInfo?.name, "matrix-studio");
    assert.ok(initResult.capabilities?.tools, "Expected tools capability");
    assert.ok(initResult.capabilities?.resources, "Expected resources capability");
    console.log("  PASS initialize handshake succeeded");

    console.log("[2/8] Checking tools/list and wire _meta properties");
    const toolsResult = await client.request("tools/list", {});
    assert.ok(Array.isArray(toolsResult.tools), "Expected tools array");
    const toolsByName = new Map(toolsResult.tools.map((t) => [t.name, t]));

    const expectedTools = [
      "open_matrix_studio",
      "preview_matrix_card",
      "export_matrix_theme",
      "list_matrix_presets",
      "save_theme_state",
      "reset_theme_state",
      "apply_matrix_theme_to_project"
    ];
    assert.equal(toolsResult.tools.length, expectedTools.length, "Expected exactly 7 tools");
    for (const toolName of expectedTools) {
      assert.ok(toolsByName.has(toolName), `Missing tool: ${toolName}`);
    }

    const openTool = toolsByName.get("open_matrix_studio");
    assert.equal(openTool._meta?.ui?.resourceUri, "ui://matrix-theme/studio.html");
    const entrypoints = openTool._meta?.["com.google.antigravity/ui"]?.entrypoints;
    assert.ok(Array.isArray(entrypoints), "open_matrix_studio missing entrypoints");
    assert.ok(
      entrypoints.some((ep) => ep.type === "aux_pane"),
      "open_matrix_studio missing aux_pane entrypoint"
    );
    assert.ok(
      entrypoints.some((ep) => ep.type === "global"),
      "open_matrix_studio missing global entrypoint"
    );

    const previewTool = toolsByName.get("preview_matrix_card");
    assert.equal(previewTool._meta?.ui?.resourceUri, "ui://matrix-theme/studio.html");
    assert.equal(
      previewTool._meta?.["com.google.antigravity/ui"]?.entrypoints,
      undefined,
      "preview_matrix_card must NOT declare entrypoints so it renders inline"
    );

    const saveTool = toolsByName.get("save_theme_state");
    assert.ok(
      Array.isArray(saveTool._meta?.ui?.visibility) &&
        saveTool._meta.ui.visibility.includes("app"),
      "save_theme_state must declare _meta.ui.visibility including 'app'"
    );

    const resetTool = toolsByName.get("reset_theme_state");
    assert.ok(
      Array.isArray(resetTool._meta?.ui?.visibility) &&
        resetTool._meta.ui.visibility.includes("app"),
      "reset_theme_state must declare _meta.ui.visibility including 'app'"
    );

    const applyTool = toolsByName.get("apply_matrix_theme_to_project");
    assert.equal(
      applyTool._meta?.ui?.resourceUri,
      undefined,
      "apply_matrix_theme_to_project must NOT declare ui.resourceUri"
    );
    assert.equal(
      applyTool._meta?.ui?.visibility,
      undefined,
      "apply_matrix_theme_to_project must be callable by both model and app"
    );
    console.log("  PASS all 7 tools and exact _meta metadata verified");

    console.log("[3/8] Checking resources/list & resources/read for studio HTML");
    const resourcesResult = await client.request("resources/list", {});
    const studioResource = resourcesResult.resources?.find(
      (r) => r.uri === "ui://matrix-theme/studio.html"
    );
    assert.ok(studioResource, "ui://matrix-theme/studio.html not listed in resources/list");
    assert.equal(studioResource.mimeType, "text/html;profile=mcp-app");
    assert.equal(studioResource._meta?.ui?.prefersBorder, false);

    const readResult = await client.request("resources/read", {
      uri: "ui://matrix-theme/studio.html"
    });
    assert.ok(Array.isArray(readResult.contents) && readResult.contents.length >= 1);
    const htmlContent = readResult.contents[0];
    assert.equal(htmlContent.uri, "ui://matrix-theme/studio.html");
    assert.equal(htmlContent.mimeType, "text/html;profile=mcp-app");
    assert.equal(typeof htmlContent.text, "string");
    const htmlByteLength = Buffer.byteLength(htmlContent.text, "utf8");
    assert.ok(
      htmlByteLength > 200 && htmlByteLength < 10 * 1024 * 1024,
      `Unexpected HTML size: ${htmlByteLength} bytes`
    );
    assert.match(htmlContent.text, /<!DOCTYPE html/i);
    assert.match(htmlContent.text, /<\/html>/i);
    assert.doesNotMatch(
      htmlContent.text,
      /<script\b[^>]*https?:\/\//i,
      "Studio HTML must not contain external http(s) <script> tags"
    );
    assert.doesNotMatch(
      htmlContent.text,
      /<link\b[^>]*https?:\/\//i,
      "Studio HTML must not contain external http(s) <link> tags"
    );
    console.log(`  PASS studio resource verified (${htmlByteLength} bytes, self-contained HTML)`);

    console.log("[4/8] Calling open_matrix_studio, preview_matrix_card, export_matrix_theme, list_matrix_presets");
    const openRes = await client.request("tools/call", {
      name: "open_matrix_studio",
      arguments: {}
    });
    assert.ok(!openRes.isError, "open_matrix_studio failed");
    assert.equal(openRes.content?.[0]?.type, "text");
    assert.ok(openRes.content[0].text.length > 0);
    assert.equal(openRes.structuredContent?.mode, "studio");
    assert.equal(openRes.structuredContent?.initialTab, "preview");
    assert.equal(openRes.structuredContent?.activeTheme?.id, "classic-phosphor");
    assert.equal(openRes.structuredContent?.variants?.length, 3);
    assert.ok(
      openRes.structuredContent?.contrastAudit?.every((entry) => entry.passed),
      "Default classic-phosphor must pass all WCAG checks"
    );
    assert.ok(openRes.structuredContent?.exportsPreview?.css?.content);
    assert.ok(openRes.structuredContent?.exportsPreview?.tailwind?.content);
    assert.ok(openRes.structuredContent?.exportsPreview?.json?.content);
    assert.ok(openRes.structuredContent?.exportsPreview?.["antigravity-guide"]?.content);
    assert.ok(openRes.structuredContent?.exportsPreview?.["html-template"]?.content);

    const previewRes = await client.request("tools/call", {
      name: "preview_matrix_card",
      arguments: { variant: "crt-high-contrast" }
    });
    assert.ok(!previewRes.isError, "preview_matrix_card failed");
    assert.equal(previewRes.structuredContent?.mode, "inline");
    assert.equal(previewRes.structuredContent?.activeTheme?.id, "crt-high-contrast");
    assert.equal(previewRes.structuredContent?.activeTheme?.tokens?.bgPrimary, "#000000");

    const exportRes = await client.request("tools/call", {
      name: "export_matrix_theme",
      arguments: { variant: "zion-dark", format: "css" }
    });
    assert.ok(!exportRes.isError, "export_matrix_theme failed");
    assert.equal(exportRes.structuredContent?.variantId, "zion-dark");
    assert.equal(exportRes.structuredContent?.export?.format, "css");
    assert.equal(exportRes.structuredContent?.export?.filename, "matrix-zion-dark.css");
    assert.match(exportRes.structuredContent?.export?.content, /color-scheme:\s*only dark;/);
    assert.match(exportRes.structuredContent?.export?.content, /#34D38B/i);

    const listRes = await client.request("tools/call", {
      name: "list_matrix_presets",
      arguments: {}
    });
    assert.ok(!listRes.isError, "list_matrix_presets failed");
    assert.equal(listRes.structuredContent?.variants?.length, 3);
    assert.ok(
      listRes.structuredContent.variants.every((v) => v.contrastSummary?.allPassed === true),
      "All 3 variants must pass WCAG contrast summary"
    );
    console.log("  PASS studio, preview, export, and list tools verified");

    console.log("[5/8] Testing strict hex validation and save_theme_state persistence");
    const invalidSaveRes = await client.request("tools/call", {
      name: "save_theme_state",
      arguments: {
        overrides: { accentPrimary: "invalid-hex" }
      }
    });
    assert.equal(invalidSaveRes.isError, true, "Invalid hex color must be rejected");

    const saveRes = await client.request("tools/call", {
      name: "save_theme_state",
      arguments: {
        activeVariant: "classic-phosphor",
        rainIntensity: "full",
        scanlines: false,
        variant: "classic-phosphor",
        overrides: {
          accentPrimary: "#22FF66",
          borderDefault: "#33AA55"
        },
        saveCustomPreset: {
          name: "Neo Custom Green"
        }
      }
    });
    assert.ok(!saveRes.isError, `save_theme_state failed: ${JSON.stringify(saveRes)}`);
    assert.equal(saveRes.structuredContent?.state?.rainIntensity, "full");
    assert.equal(saveRes.structuredContent?.state?.scanlines, false);
    assert.equal(saveRes.structuredContent?.activeTheme?.tokens?.accentPrimary, "#22FF66");
    assert.equal(saveRes.structuredContent?.state?.customPresets?.length, 1);
    assert.equal(saveRes.structuredContent?.state?.customPresets?.[0]?.name, "Neo Custom Green");
    assert.ok(
      fs.existsSync(path.join(tempDataDir, "state.json")),
      "state.json must be written to --data-dir"
    );
    console.log("  PASS hex validation, save_theme_state, and state.json creation verified");

    console.log("[6/8] Restarting MCP server on same --data-dir to verify disk persistence");
    await client.close();
    client = new StdioJsonRpcClient(SERVER_PATH, tempDataDir);
    client.start();
    await client.initialize();

    const listAfterRestart = await client.request("tools/call", {
      name: "list_matrix_presets",
      arguments: {}
    });
    assert.ok(!listAfterRestart.isError);
    assert.equal(listAfterRestart.structuredContent?.rainIntensity, "full");
    assert.equal(listAfterRestart.structuredContent?.scanlines, false);
    assert.equal(listAfterRestart.structuredContent?.customPresets?.length, 1);
    assert.equal(
      listAfterRestart.structuredContent?.customPresets?.[0]?.name,
      "Neo Custom Green"
    );

    const openAfterRestart = await client.request("tools/call", {
      name: "open_matrix_studio",
      arguments: {}
    });
    assert.ok(!openAfterRestart.isError);
    assert.equal(
      openAfterRestart.structuredContent?.activeTheme?.tokens?.accentPrimary,
      "#22FF66"
    );
    assert.equal(
      openAfterRestart.structuredContent?.state?.overrides?.["classic-phosphor"]?.borderDefault,
      "#33AA55"
    );
    console.log("  PASS state persisted across server restart");

    console.log("[7/8] Testing reset_theme_state restores default overrides");
    const resetRes = await client.request("tools/call", {
      name: "reset_theme_state",
      arguments: {}
    });
    assert.ok(!resetRes.isError, "reset_theme_state failed");
    assert.equal(
      resetRes.structuredContent?.state?.overrides?.["classic-phosphor"],
      undefined,
      "Overrides for classic-phosphor must be cleared after reset"
    );
    assert.equal(
      resetRes.structuredContent?.activeTheme?.tokens?.accentPrimary,
      "#00FF41",
      "Default classic-phosphor accentPrimary must be restored"
    );

    const openAfterReset = await client.request("tools/call", {
      name: "open_matrix_studio",
      arguments: {}
    });
    assert.equal(openAfterReset.structuredContent?.activeTheme?.tokens?.accentPrimary, "#00FF41");
    console.log("  PASS reset_theme_state restored default overrides cleanly");

    console.log("[8/8] Testing apply_matrix_theme_to_project writes, idempotent @import, guardrails, and persistence");
    const entryCssPath = path.join(tempProjectDir, "src", "index.css");
    fs.mkdirSync(path.dirname(entryCssPath), { recursive: true });
    fs.writeFileSync(entryCssPath, "body { margin: 0; }\n", { encoding: "utf8" });

    const applyRes = await client.request("tools/call", {
      name: "apply_matrix_theme_to_project",
      arguments: {
        projectDir: tempProjectDir,
        variant: "zion-dark",
        targets: ["css", "tailwind", "json"],
        outputDir: "styles/matrix-theme",
        autoImportCss: "src/index.css"
      }
    });
    assert.ok(!applyRes.isError, `apply_matrix_theme_to_project failed: ${JSON.stringify(applyRes)}`);
    assert.equal(applyRes.structuredContent?.applied, true);
    assert.equal(applyRes.structuredContent?.variantId, "zion-dark");
    assert.equal(applyRes.structuredContent?.writtenFiles?.length, 3);
    assert.equal(applyRes.structuredContent?.autoImportedFile?.alreadyImported, false);
    assert.equal(
      applyRes.structuredContent?.autoImportedFile?.importLine,
      '@import "../styles/matrix-theme/matrix-theme.css";'
    );

    const expectedGenerated = [
      { target: "css", rel: "styles/matrix-theme/matrix-theme.css" },
      { target: "tailwind", rel: "styles/matrix-theme/matrix-tailwind.css" },
      { target: "json", rel: "styles/matrix-theme/matrix-tokens.json" }
    ];
    for (const item of expectedGenerated) {
      const entry = applyRes.structuredContent.writtenFiles.find((f) => f.target === item.target);
      assert.ok(entry, `Missing written file record for ${item.target}`);
      assert.equal(entry.relativePath, item.rel);
      assert.match(entry.fileUri, /^file:\/\//);
      assert.ok(fs.existsSync(entry.absolutePath), `Expected file on disk: ${entry.absolutePath}`);
      const rawBytes = fs.readFileSync(entry.absolutePath);
      assert.ok(rawBytes.length > 0, `Generated file is empty: ${entry.absolutePath}`);
      assert.ok(
        !(rawBytes[0] === 0xef && rawBytes[1] === 0xbb && rawBytes[2] === 0xbf),
        `Generated file must not have UTF-8 BOM: ${entry.absolutePath}`
      );
      const text = rawBytes.toString("utf8");
      if (item.target === "css") {
        assert.match(text, /color-scheme:\s*only dark;/);
      } else if (item.target === "tailwind") {
        assert.match(text, /@theme\s*\{/);
      } else if (item.target === "json") {
        const parsedJson = JSON.parse(text);
        assert.equal(parsedJson.id, "zion-dark");
      }
    }

    const cssAfterFirstApply = fs.readFileSync(entryCssPath, "utf8");
    assert.ok(
      cssAfterFirstApply.includes('@import "../styles/matrix-theme/matrix-theme.css";'),
      "Entry CSS must contain @import after first apply"
    );

    const applySecondRes = await client.request("tools/call", {
      name: "apply_matrix_theme_to_project",
      arguments: {
        projectDir: tempProjectDir,
        variant: "zion-dark",
        targets: ["css", "tailwind", "json"],
        outputDir: "styles/matrix-theme",
        autoImportCss: "src/index.css"
      }
    });
    assert.ok(!applySecondRes.isError, "Second idempotent apply failed");
    assert.equal(applySecondRes.structuredContent?.autoImportedFile?.alreadyImported, true);
    const cssAfterSecondApply = fs.readFileSync(entryCssPath, "utf8");
    const importMatches = cssAfterSecondApply.match(
      /@import\s+"[^"]*matrix-theme\.css"\s*;/g
    );
    assert.equal(
      importMatches?.length,
      1,
      "@import line must appear exactly once after repeated apply"
    );

    const traversalOutputRes = await client.request("tools/call", {
      name: "apply_matrix_theme_to_project",
      arguments: {
        projectDir: tempProjectDir,
        targets: ["css"],
        outputDir: "../../outside"
      }
    });
    assert.equal(
      traversalOutputRes.isError,
      true,
      "Path traversal in outputDir must be rejected with isError: true"
    );

    const missingDirRes = await client.request("tools/call", {
      name: "apply_matrix_theme_to_project",
      arguments: {
        projectDir: path.join(tempProjectDir, "does-not-exist"),
        targets: ["css"],
        outputDir: "styles/matrix-theme"
      }
    });
    assert.equal(
      missingDirRes.isError,
      true,
      "Non-existent projectDir must be rejected with isError: true"
    );

    const traversalImportRes = await client.request("tools/call", {
      name: "apply_matrix_theme_to_project",
      arguments: {
        projectDir: tempProjectDir,
        targets: ["css"],
        outputDir: "styles/matrix-theme",
        autoImportCss: "../../outside.css"
      }
    });
    assert.equal(
      traversalImportRes.isError,
      true,
      "Path traversal in autoImportCss must be rejected with isError: true"
    );

    // Restart server to verify lastProjectDir, lastOutputDir, and lastTargets persisted
    await client.close();
    client = new StdioJsonRpcClient(SERVER_PATH, tempDataDir);
    client.start();
    await client.initialize();

    const openAfterApplyRestart = await client.request("tools/call", {
      name: "open_matrix_studio",
      arguments: {}
    });
    assert.ok(!openAfterApplyRestart.isError);
    assert.equal(
      openAfterApplyRestart.structuredContent?.state?.lastProjectDir,
      tempProjectDir
    );
    assert.equal(
      openAfterApplyRestart.structuredContent?.state?.lastOutputDir,
      "styles/matrix-theme"
    );
    assert.deepEqual(openAfterApplyRestart.structuredContent?.state?.lastTargets, [
      "css",
      "tailwind",
      "json"
    ]);
    console.log("  PASS apply_matrix_theme_to_project, idempotency, guardrails, and state persistence verified");

    console.log("\nALL MCP SERVER VERIFICATION CHECKS PASSED.");
  } finally {
    if (client) {
      await client.close();
    }
    fs.rmSync(tempDataDir, { recursive: true, force: true });
    fs.rmSync(tempProjectDir, { recursive: true, force: true });
  }
}

runVerification().catch((error) => {
  console.error("\nMCP VERIFICATION FAILED:", error);
  process.exit(1);
});
