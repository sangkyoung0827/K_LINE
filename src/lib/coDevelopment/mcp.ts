import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import * as z from "zod/v4";
import { LabError } from "./model";
import { labCommand, type LabActor } from "./server";
import { labStarter } from "./starter";

const instructions = "Private K_LINE development lab for the owner and Yuki only. Develop source files in your own Codex workspace; build self-contained HTML locally and upload it with lab_save_bundle. Use lab_records for synthetic project data, never production members or credentials. Both accounts can use the saved result. No shell, arbitrary SQL, production tables, repository writes or deployment access is provided. Read current versions before saving; reconcile conflicts instead of overwriting. Keep lab credentials in environment variables, not source or model messages.";

export async function labMcp(request: Request, actor: LabActor) {
  const server = new McpServer({ name: "kline-private-development", version: "1.0.0" }, { instructions });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 2097152 });
  function tool(name: string, description: string, schema: z.ZodRawShape, action: string, readOnly = false) {
    server.registerTool(name, { description, inputSchema: schema, annotations: { readOnlyHint: readOnly, destructiveHint: false, openWorldHint: false } }, async args => {
      try {
        const result = await labCommand(actor, { ...args, action });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: { result } };
      } catch (error) {
        return { isError: true, content: [{ type: "text" as const, text: error instanceof LabError ? error.code : "LAB_UNAVAILABLE" }] };
      }
    });
  }
  const id = z.uuid();
  server.registerTool("lab_starter", { description: "Read an empty editable project with local build/sync scripts and Codex MCP configuration. No example clubs, member records or keys are included.", inputSchema: {}, annotations: { readOnlyHint: true, openWorldHint: false } }, async () => {
    const result = { files: labStarter(new URL(request.url).origin) };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: { result } };
  });
  tool("lab_list", "List shared private development projects.", {}, "list", true);
  tool("lab_get", "Read a project's current HTML, metadata and revision ids before editing.", { id }, "get", true);
  tool("lab_save_bundle", "Save compiled inline HTML and up to 100 text source files (1 MiB total), atomically versioned. Build locally. No credentials, external imports or real member data. expectedRevision is 0 for new projects. Preserve id on retry. Backend source can be archived but is NOT executed on K_LINE; use lab_records for the shared test backend.", {
    id, expectedRevision: z.number().int().min(0), title: z.string().min(1).max(120), description: z.string().max(2000), html: z.string().min(1).max(262144),
    fixture: z.record(z.string(), z.unknown()), files: z.record(z.string(), z.string())
  }, "bundle_save");
  tool("lab_source", "Read exact archived source files and SHA-256 for a revision. null means this older revision has no source archive.", { revisionId: id }, "source_get", true);
  tool("lab_settings", "Read shared card, colors and opening-project configuration.", {}, "settings_get", true);
  tool("lab_customize", "Customize the private card and opening screen without owner intervention. Use the whole appearance and current version from lab_settings. This cannot alter any other K_LINE card, production data, login, repository or public deployment.", {
    expectedVersion: z.number().int().min(0), appearance: z.object({ title: z.string().min(1).max(120), description: z.string().max(500), cardHtml: z.string().max(65536), background: z.string().regex(/^#[a-f0-9]{6}$/i), foreground: z.string().regex(/^#[a-f0-9]{6}$/i), accent: z.string().regex(/^#[a-f0-9]{6}$/i), landingProjectId: id.nullable() }).strict()
  }, "settings_save");
  tool("lab_records", "Read synthetic project-scoped records such as members, events, attendance or dues. Paginated UUID cursor. These are NEVER production club records. Records survive UI revisions. includeArchived includes reversible removals.", {
    projectId: id, collection: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), limit: z.number().int().min(1).max(100).optional(), after: id.optional(), includeArchived: z.boolean().optional()
  }, "records_list", true);
  tool("lab_save_record", "Create/update a synthetic test record, or archive/restore it. Current expectedVersion required, 0 for new. 16 KiB per record, 500 per project. Write immutable audit history; no permanent delete. Do not put personal information here.", {
    projectId: id, collection: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), id, expectedVersion: z.number().int().min(0), data: z.record(z.string(), z.unknown()), archived: z.boolean().optional()
  }, "record_save");
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    const body = await response.arrayBuffer();
    return new Response(response.status === 202 || response.status === 204 ? null : body, { status: response.status, headers: response.headers });
  } finally { await server.close(); }
}
