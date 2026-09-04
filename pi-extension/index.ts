// docparse pi extension — parse/convert documents from inside pi.
//
// Lives in sunholo-data/docparse-skill (the public distribution repo for the
// AILANG Parse Claude plugin) as the pi-native equivalent of that plugin:
// pi does not load MCP servers, so instead of the hosted MCP endpoint
// (https://docparse.ailang.sunholo.com/mcp/) this extension registers native
// pi tools that call:
//
// Two transports:
//   CLI   — shells out to the local `docparse` binary (AILANG Parse CLI).
//           Full format coverage (Office/ODF/EPUB/EML/TeX/images/audio/video),
//           deterministic PDF via pdftotext, AI backends with local keys.
//   API   — the hosted docparse API (https://docparse.ailang.sunholo.com),
//           REST at /api/v1/* — the same backend the hosted MCP wraps.
//           Auth: dp_-prefixed API key via device flow (/docparse-login).
//
// Install globally with:
//   ln -s ~/dev/sunholo/docparse-skill/pi-extension ~/.pi/agent/extensions/docparse
// See README.md in this directory.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { basename, join } from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_API_BASE = "https://docparse.ailang.sunholo.com";
const SDK_CREDENTIALS_PATH = join(homedir(), ".config", "ailang-parse", "credentials.json");
const PER_FILE_MD_CAP = 12_000; // chars of markdown included per file in tool result
const PER_FILE_JSON_CAP = 6_000; // chars of JSON included per file
const CLI_TIMEOUT_MS = 600_000; // AI backends on big PDFs are slow

interface Credentials {
  apiKey: string;
  baseUrl: string;
  source: string; // where the key came from (for status/debug)
  tier?: string;
}

let cachedCliPath: string | null | undefined; // undefined = not probed yet

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------

async function resolveCredentials(ctx: ExtensionContext): Promise<Credentials | null> {
  // 1. Environment variable
  const envKey = process.env.DOCPARSE_API_KEY;
  if (envKey && envKey.startsWith("dp_")) {
    return {
      apiKey: envKey,
      baseUrl: process.env.DOCPARSE_API_BASE ?? DEFAULT_API_BASE,
      source: "$DOCPARSE_API_KEY",
    };
  }

  // 2. SDK credentials file (~/.config/ailang-parse/credentials.json) — the
  //    location the API's own device-flow response recommends, written by
  //    SDK device_auth() and by our /docparse-login.
  for (const path of [SDK_CREDENTIALS_PATH, join(homedir(), ".pi", "agent", "docparse-auth.json")]) {
    try {
      const raw = await readFile(path, "utf8");
      const cred = JSON.parse(raw) as { api_key?: string; apiKey?: string; base_url?: string; tier?: string };
      const key = cred.api_key ?? cred.apiKey;
      if (key && key.startsWith("dp_")) {
        return {
          apiKey: key,
          baseUrl: process.env.DOCPARSE_API_BASE ?? cred.base_url ?? DEFAULT_API_BASE,
          source: path,
          tier: cred.tier,
        };
      }
    } catch {
      // missing/unreadable — try next
    }
  }
  void ctx;
  return null;
}

// ---------------------------------------------------------------------------
// CLI transport
// ---------------------------------------------------------------------------

async function resolveCliPath(pi: ExtensionAPI): Promise<string | null> {
  if (cachedCliPath !== undefined) return cachedCliPath;
  const override = process.env.DOCPARSE_BIN;
  if (override) {
    cachedCliPath = override;
    return cachedCliPath;
  }
  try {
    const which = await pi.exec("bash", ["-c", "command -v docparse || true"], { timeout: 10_000 });
    cachedCliPath = which.stdout.trim() || null;
  } catch {
    cachedCliPath = null;
  }
  return cachedCliPath;
}

interface CliParseResult {
  files: { source: string; mdPath?: string; jsonPath?: string; md?: string; json?: string }[];
  stderr: string;
  code: number;
}

async function runCliParse(
  pi: ExtensionAPI,
  paths: string[],
  opts: { pdfBackend?: string; summarize?: boolean; describe?: boolean; outputDir: string },
): Promise<CliParseResult> {
  const cli = await resolveCliPath(pi);
  if (!cli) throw new Error("docparse CLI not found on PATH. Install it or set DOCPARSE_BIN.");

  const args = [...paths, "--output-dir", opts.outputDir];
  if (opts.pdfBackend) args.push("--pdf-backend", opts.pdfBackend);
  if (opts.summarize) args.push("--summarize");
  if (opts.describe) args.push("--describe");

  const result = await pi.exec(cli, args, { timeout: CLI_TIMEOUT_MS });
  const files: CliParseResult["files"] = [];

  for (const source of paths) {
    const name = basename(source);
    const mdPath = join(opts.outputDir, `${name}.md`);
    const jsonPath = join(opts.outputDir, `${name}.json`);
    const entry: CliParseResult["files"][number] = { source };
    try {
      entry.md = await readFile(mdPath, "utf8");
      entry.mdPath = mdPath;
    } catch {
      /* no md output */
    }
    try {
      entry.json = await readFile(jsonPath, "utf8");
      entry.jsonPath = jsonPath;
    } catch {
      /* no json output */
    }
    files.push(entry);
  }
  return { files, stderr: result.stderr, code: result.code };
}

// ---------------------------------------------------------------------------
// Hosted API transport
// ---------------------------------------------------------------------------

async function apiFetch(
  ctx: ExtensionContext,
  cred: Credentials,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const signal = ctx.signal;
  return fetch(`${cred.baseUrl}${path}`, { ...init, signal });
}

interface ApiParseOutcome {
  ok: boolean;
  text: string; // markdown result or JSON blocks string or error message
  requestId?: string;
  quota?: unknown;
}

async function apiParse(
  ctx: ExtensionContext,
  cred: Credentials,
  input: { localPath?: string; url?: string },
  outputFormat: string,
): Promise<ApiParseOutcome> {
  const form = new FormData();
  if (input.localPath) {
    const bytes = await readFile(input.localPath);
    const blob = new Blob([new Uint8Array(bytes)]);
    form.append("filepath", blob, basename(input.localPath));
  } else if (input.url) {
    form.append("sourceUrl", input.url);
  } else {
    throw new Error("apiParse needs localPath or url");
  }
  form.append("apiKey", cred.apiKey);
  form.append("outputFormat", outputFormat);

  const res = await apiFetch(ctx, cred, "/api/v1/parse", { method: "POST", body: form });
  const requestId = res.headers.get("x-request-id") ?? undefined;
  const bodyText = await res.text();

  if (!res.ok) {
    // Error bodies are JSON: {error, message, details?, request_id?}
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(bodyText) as Record<string, unknown>;
      msg = `${j.error ?? "ERROR"}: ${j.message ?? bodyText.slice(0, 300)}`;
    } catch {
      msg = `HTTP ${res.status}: ${bodyText.slice(0, 300)}`;
    }
    return { ok: false, text: msg, requestId };
  }

  try {
    const j = JSON.parse(bodyText) as Record<string, unknown>;
    const markdown =
      typeof j.result === "string" ? j.result : typeof j.markdown === "string" ? j.markdown : undefined;
    const text = markdown ?? JSON.stringify(j, null, 2);
    return { ok: true, text, requestId };
  } catch {
    return { ok: true, text: bodyText, requestId };
  }
}

// ---------------------------------------------------------------------------
// Tool result assembly
// ---------------------------------------------------------------------------

function cap(s: string, capChars: number, path: string): string {
  if (s.length <= capChars) return s;
  return `${s.slice(0, capChars)}\n\n…(truncated — full output at ${path})`;
}

function assembleParseContent(parsed: CliParseResult["files"], wantJson: boolean): string[] {
  const parts: string[] = [];
  for (const f of parsed) {
    const header = `## ${f.source}`;
    const body: string[] = [];
    if (f.md) body.push(cap(f.md, PER_FILE_MD_CAP, f.mdPath ?? "(md path unknown)"));
    if (wantJson && f.json) body.push(`Structured JSON:\n${cap(f.json, PER_FILE_JSON_CAP, f.jsonPath ?? "(json path unknown)")}`);
    const written = [f.mdPath, f.jsonPath].filter(Boolean).join(", ");
    if (body.length === 0) {
      body.push(`(no output produced${f.source.startsWith("/") ? "" : " — path may not exist"})`);
    } else if (written) {
      body.push(`\n[outputs: ${written}]`);
    }
    parts.push(`${header}\n\n${body.join("\n\n")}`);
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  // ------------------------------------------------------------------
  // Tool: docparse_parse
  // ------------------------------------------------------------------
  pi.registerTool({
    name: "docparse_parse",
    label: "docparse: Parse",
    description:
      "Parse documents into LLM-ready markdown and structured JSON. " +
      "Handles PDF (incl. scanned, via --pdf_backend ai), DOCX/PPTX/XLSX, ODF, EPUB, HTML, TeX, CSV, EML/MBOX, images, audio and video. " +
      "Local paths use the docparse CLI; an https:// URL uses the hosted docparse API (needs an API key — suggest /docparse-login if missing).",
    promptSnippet: "Parse documents (PDF, Office, EPUB, email, images, audio) into markdown/JSON",
    promptGuidelines: [
      "Use docparse_parse when the user asks to parse/extract/convert a document (PDF, DOCX, PPTX, XLSX, EPUB, EML, HTML, image, audio) into text, markdown or JSON. Prefer it over ad-hoc pdftotext/python because it handles scanned PDFs, tables and batch folders.",
    ],
    parameters: Type.Object({
      paths: Type.Optional(
        Type.Array(Type.String(), { description: "Local file or folder paths to parse (CLI transport). Folders parse every supported file inside." }),
      ),
      url: Type.Optional(Type.String({ description: "Public https:// URL of a document to parse via the hosted API (mutually exclusive with paths)" })),
      mode: Type.Optional(
        StringEnum(["auto", "cli", "api"] as const, {
          description: "auto (default): URLs go to the hosted API, local paths to the CLI. Force with cli/api.",
        }),
      ),
      output: Type.Optional(
        StringEnum(["markdown", "json", "both"] as const, {
          description: "What to return in the tool result. Default markdown. 'both' adds the structured JSON blocks.",
        }),
      ),
      pdf_backend: Type.Optional(
        StringEnum(["pdftotext", "docling", "liteparse", "ai"] as const, {
          description:
            "PDF backend (CLI). pdftotext = deterministic poppler text layer (default); " +
            "docling = IBM Docling layout-aware + local OCR for no-text-layer PDFs; " +
            "liteparse = font-size heading inference (not OCR); " +
            "ai = multimodal, required for image-only scans (uses local AI keys). " +
            "All four are installed locally via the uv-managed adapter env.",
        }),
      ),
      summarize: Type.Optional(Type.Boolean({ description: "CLI: add an AI summary (uses local AI keys)" })),
      describe: Type.Optional(Type.Boolean({ description: "CLI: AI image descriptions (uses local AI keys)" })),
      output_dir: Type.Optional(
        Type.String({ description: "CLI: keep outputs in this directory instead of a throwaway temp dir" }),
      ),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled" }] };
      const mode = params.mode ?? "auto";
      const wantJson = params.output === "json" || params.output === "both";

      // ----- hosted API via URL -----
      if (params.url) {
        if (mode === "cli") throw new Error("mode=cli cannot parse a URL — use paths or mode=api.");
        const cred = await resolveCredentials(ctx);
        if (!cred) {
          throw new Error(
            "No docparse API key. Run /docparse-login (device flow) or set DOCPARSE_API_KEY to a dp_... key.",
          );
        }
        onUpdate?.({ content: [{ type: "text", text: `Parsing ${params.url} via hosted docparse API…` }] });
        const outcome = await apiParse(ctx, cred, { url: params.url }, params.output === "json" ? "blocks" : "markdown");
        if (!outcome.ok) throw new Error(`docparse API: ${outcome.text}`);
        return {
          content: [
            {
              type: "text",
              text: `## ${params.url}\n\n${outcome.text}${outcome.text.length > PER_FILE_MD_CAP ? `\n\n…(truncated — ${outcome.text.length} chars total)` : ""}`,
            },
          ],
          details: { transport: "api", baseUrl: cred.baseUrl, requestId: outcome.requestId },
        };
      }

      // ----- local paths -----
      if (!params.paths || params.paths.length === 0) {
        throw new Error("docparse_parse needs either paths (local files/folders) or url.");
      }

      const resolved = params.paths.map((p) => (p.startsWith("@") ? p.slice(1) : p)); // strip model-added @

      if (mode === "api") {
        const cred = await resolveCredentials(ctx);
        if (!cred) throw new Error("No docparse API key. Run /docparse-login or set DOCPARSE_API_KEY.");
        const parts: string[] = [];
        for (const p of resolved) {
          onUpdate?.({ content: [{ type: "text", text: `Uploading ${p} to docparse API…` }] });
          const outcome = await apiParse(ctx, cred, { localPath: p }, params.output === "json" ? "blocks" : "markdown");
          parts.push(`## ${p}\n\n${outcome.ok ? cap(outcome.text, PER_FILE_MD_CAP, "(API response)") : `ERROR: ${outcome.text}`}`);
        }
        return {
          content: [{ type: "text", text: parts.join("\n\n---\n\n") }],
          details: { transport: "api", baseUrl: cred.baseUrl },
        };
      }

      // ----- CLI (auto or cli) -----
      const outDir = params.output_dir ? resolveOutputDir(params.output_dir, ctx) : await mkdtemp(join(tmpdir(), "docparse-pi-"));
      onUpdate?.({
        content: [{ type: "text", text: `Running docparse CLI on ${resolved.length} path(s)…` }],
      });
      const result = await runCliParse(pi, resolved, {
        pdfBackend: params.pdf_backend,
        summarize: params.summarize,
        describe: params.describe,
        outputDir: outDir,
      });

      const failed = result.code !== 0;
      const parts = assembleParseContent(result.files, wantJson);
      if (failed && result.stderr) {
        parts.push(`CLI stderr (exit ${result.code}):\n${result.stderr.slice(0, 2000)}`);
      }
      return {
        content: [{ type: "text", text: parts.join("\n\n---\n\n") || "(no output produced)" }],
        details: { transport: "cli", outputDir: outDir, exitCode: result.code, files: result.files.map((f) => ({ source: f.source, mdPath: f.mdPath, jsonPath: f.jsonPath })) },
      };
    },
  });

  // ------------------------------------------------------------------
  // Tool: docparse_convert
  // ------------------------------------------------------------------
  pi.registerTool({
    name: "docparse_convert",
    label: "docparse: Convert",
    description:
      "Convert a document between formats using the local docparse CLI: " +
      "targets html, docx, pptx, xlsx, odt, odp, ods, md, qmd. " +
      "Optionally style a generated .docx after a reference document.",
    promptSnippet: "Convert documents between html/docx/pptx/xlsx/odt/md/qmd via docparse",
    promptGuidelines: [
      "Use docparse_convert when the user asks to convert a document into another format (e.g. md to pptx, docx to html). Write the target path with the desired extension.",
    ],
    parameters: Type.Object({
      input: Type.String({ description: "Path of the document to convert" }),
      target: Type.String({ description: "Output path; format comes from its extension (html docx pptx xlsx odt odp ods md qmd)" }),
      reference_doc: Type.Optional(
        Type.String({ description: "DOCX only: style the output after this reference document (styles, theme, fonts, page setup)" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled" }] };
      const cli = await resolveCliPath(pi);
      if (!cli) throw new Error("docparse CLI not found on PATH. Install it or set DOCPARSE_BIN.");

      const input = params.input.startsWith("@") ? params.input.slice(1) : params.input;
      const target = params.target.startsWith("@") ? params.target.slice(1) : params.target;
      const args = [input, "--convert", target];
      if (params.reference_doc) args.push("--reference-doc", params.reference_doc);

      const result = await pi.exec(cli, args, { timeout: CLI_TIMEOUT_MS });
      if (result.code !== 0) {
        throw new Error(`docparse convert failed (exit ${result.code}):\n${result.stderr.slice(0, 2000)}`);
      }
      void ctx;
      return {
        content: [{ type: "text", text: `Converted ${input} → ${target}` }],
        details: { input, target, outputDir: undefined },
      };
    },
  });

  // ------------------------------------------------------------------
  // Tool: docparse_status
  // ------------------------------------------------------------------
  pi.registerTool({
    name: "docparse_status",
    label: "docparse: Status",
    description:
      "Check docparse availability: local CLI presence, hosted API health/formats, and whether an API key is configured. Run this before parsing via the hosted API if unsure.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled" }] };
      const lines: string[] = [];

      const cli = await resolveCliPath(pi);
      lines.push(`CLI: ${cli ? `found at ${cli}` : "NOT FOUND (set DOCPARSE_BIN or install the docparse CLI)"}`);

      const cred = await resolveCredentials(ctx);
      lines.push(`API key: ${cred ? `configured (${cred.source}${cred.tier ? `, tier ${cred.tier}` : ""})` : "none — hosted parsing unavailable until /docparse-login or DOCPARSE_API_KEY"}`);
      lines.push(`API base: ${cred?.baseUrl ?? process.env.DOCPARSE_API_BASE ?? DEFAULT_API_BASE}`);

      try {
        const res = await fetch(`${cred?.baseUrl ?? process.env.DOCPARSE_API_BASE ?? DEFAULT_API_BASE}/api/v1/health`, {
          signal: signal ?? AbortSignal.timeout(10_000),
        });
        const j = (await res.json()) as Record<string, unknown>;
        lines.push(`Hosted API: ${j.status} v${j.version} (parse formats: ${j.formats_parse}, generate formats: ${j.formats_generate})`);
      } catch (e) {
        lines.push(`Hosted API: UNREACHABLE (${(e as Error).message})`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }], details: {} };
    },
  });

  // ------------------------------------------------------------------
  // Command: /docparse-login — device authorization flow (RFC 8628 style)
  // ------------------------------------------------------------------
  pi.registerCommand("docparse-login", {
    description: "Authorize pi to use the hosted docparse API (device flow → dp_ API key)",
    handler: async (_args, ctx) => {
      const base = process.env.DOCPARSE_API_BASE ?? DEFAULT_API_BASE;

      // 1. Request device code
      const reqRes = await fetch(`${base}/api/v1/auth/device`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "pi-extension", scope: "parse" }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!reqRes.ok) {
        ctx.ui.notify(`docparse: device auth request failed (HTTP ${reqRes.status})`, "error");
        return;
      }
      const req = (await reqRes.json()) as {
        device_code: string;
        user_code: string;
        verification_url: string;
        interval: number;
        expires_in: number;
      };

      ctx.ui.notify(
        `docparse: open ${req.verification_url} and approve code ${req.user_code} (expires in ${Math.round(req.expires_in / 60)} min)`,
        "info",
      );
      if (ctx.hasUI) {
        const open = await pi.exec(
          process.platform === "darwin" ? "open" : "xdg-open",
          [req.verification_url],
          { timeout: 10_000 },
        );
        if (open.code !== 0) ctx.ui.notify(`Could not open browser automatically — visit: ${req.verification_url}`, "warning");
      }

      // 2. Poll for approval
      const intervalMs = Math.max((req.interval ?? 5) * 1000, 3000);
      const deadline = Date.now() + (req.expires_in ?? 900) * 1000;
      while (Date.now() < deadline) {
        if (ctx.signal?.aborted) return;
        await new Promise((r) => setTimeout(r, intervalMs));
        const pollRes = await fetch(`${base}/api/v1/auth/device/poll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode: req.device_code }),
          signal: AbortSignal.timeout(15_000),
        });
        const poll = (await pollRes.json()) as Record<string, unknown>;
        const errCode = typeof poll.error === "string" ? poll.error : undefined;
        if (poll.status === "approved") {
          const apiKey = poll.api_key as string;
          const cred = {
            api_key: apiKey,
            base_url: base,
            key_id: poll.key_id ?? "",
            tier: poll.tier ?? "free",
            label: poll.label ?? "pi-extension",
          };
          await mkdir(join(SDK_CREDENTIALS_PATH, ".."), { recursive: true });
          await writeFile(SDK_CREDENTIALS_PATH, JSON.stringify(cred, null, 2) + "\n", { mode: 0o600 });
          await chmod(SDK_CREDENTIALS_PATH, 0o600);
          ctx.ui.notify(
            `docparse: authorized — key saved to ${SDK_CREDENTIALS_PATH} (tier: ${cred.tier})`,
            "info",
          );
          return;
        }
        if (errCode === "DEVICE_CODE_EXPIRED") {
          ctx.ui.notify("docparse: device code expired — run /docparse-login again", "error");
          return;
        }
        if (errCode && errCode !== "AUTHORIZATION_PENDING") {
          ctx.ui.notify(`docparse: poll error ${errCode}`, "error");
          return;
        }
      }
      ctx.ui.notify("docparse: approval window elapsed — run /docparse-login again", "error");
    },
  });

  // ------------------------------------------------------------------
  // Command: /docparse-status
  // ------------------------------------------------------------------
  pi.registerCommand("docparse-status", {
    description: "Show docparse CLI + hosted API + auth status",
    handler: async (_args, ctx) => {
      const cli = await resolveCliPath(pi);
      const cred = await resolveCredentials(ctx);
      const lines = [
        `CLI: ${cli ?? "not found"}`,
        `API key: ${cred ? cred.source : "none (/docparse-login to fix)"}`,
        `API base: ${cred?.baseUrl ?? DEFAULT_API_BASE}`,
      ];
      try {
        const res = await fetch(`${cred?.baseUrl ?? DEFAULT_API_BASE}/api/v1/health`, {
          signal: AbortSignal.timeout(10_000),
        });
        const j = (await res.json()) as Record<string, unknown>;
        lines.push(`Hosted API: ${j.status} v${j.version}`);
      } catch (e) {
        lines.push(`Hosted API: unreachable (${(e as Error).message})`);
      }
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}

function resolveOutputDir(dir: string, ctx: ExtensionContext): string {
  if (dir.startsWith("~")) return join(homedir(), dir.slice(1));
  if (dir.startsWith("/")) return dir;
  return join(ctx.cwd, dir);
}