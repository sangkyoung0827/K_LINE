export function labActionSchema(origin: string) {
  return {
    openapi: "3.1.0",
    info: { title: "K_LINE Developer Studio", version: "2.0.0", description: "Develop your own isolated interactive projects. No production, repository, approval or deployment access." },
    servers: [{ url: origin }],
    paths: {
      "/api/co-development/actions": {
        post: {
          operationId: "coDevelopment", summary: "List, read or save a private prototype", "x-openai-isConsequential": true,
          description: "Use list first. Use get with id before modifying. Save requires the current expectedRevision, or 0 for a new project. Preserve the returned project id for retries. Inline all HTML, CSS and JavaScript. No external network, imports, production APIs or credentials. window.KLINE_LAB.read() returns {data,version}; save(data,version) persists shared synthetic test data. To redesign the private home card or workspace, use settings_get, then settings_save with the full appearance and current expectedVersion. cardHtml is self-contained visual HTML/CSS/JS in a sandbox, not interactive navigation; it must fit a 216px mobile / 292px desktop card. Set landingProjectId to a saved prototype to make its latest revision the lab's opening screen. Only this account sees workspace changes, except for the preserved original owner/Yuki shared workspace. bundle_save stores the built HTML and source files; source_get retrieves a revision archive. records_list and record_save access project-scoped collections. Public release requires a submitted immutable revision, owner session review and a separate owner publication action unavailable through this API. Keep this GPT private: all calls use its configured key identity. Repository, production data and public deployment are never accessible and require separate owner approval outside this API.",
          security: [{ labKey: [] }],
          requestBody: { required: true, content: { "application/json": { schema: {
            type: "object", additionalProperties: false, required: ["action"],
            properties: {
              action: { type: "string", enum: ["list", "get", "save", "bundle_save", "source_get", "records_list", "record_save", "settings_get", "settings_save"] },
              revisionId: { type: "string", format: "uuid" }, projectId: { type: "string", format: "uuid" },
              files: { type: "object", additionalProperties: { type: "string" }, description: "Text source files. Build self-contained HTML on your device; no server execution." },
              collection: { type: "string", pattern: "^[a-z][a-z0-9_-]{0,39}$" },
              data: { type: "object", additionalProperties: true },
              limit: { type: "integer", minimum: 1, maximum: 100 }, after: { type: "string", format: "uuid" },
              archived: { type: "boolean" }, includeArchived: { type: "boolean" },
              id: { type: "string", format: "uuid", description: "Project id. Required for get and existing-project saves." },
              expectedRevision: { type: "integer", minimum: 0 },
              title: { type: "string", maxLength: 120 }, description: { type: "string", maxLength: 2000 },
              html: { type: "string", maxLength: 262144, description: "Self-contained HTML prototype. Inline scripts and styles only." },
              fixture: { type: "object", additionalProperties: true, description: "Synthetic test data only; maximum 64 KiB." },
              expectedVersion: { type: "integer", minimum: 0, description: "Current settings version from settings_get; required for settings_save." },
              appearance: { type: "object", additionalProperties: false, required: ["title", "description", "cardHtml", "background", "foreground", "accent", "landingProjectId"], properties: {
                title: { type: "string", minLength: 1, maxLength: 120 }, description: { type: "string", maxLength: 500 },
                cardHtml: { type: "string", maxLength: 65536, description: "Optional visual card HTML; empty string restores the standard card." },
                background: { type: "string", pattern: "^#[a-fA-F0-9]{6}$" }, foreground: { type: "string", pattern: "^#[a-fA-F0-9]{6}$" }, accent: { type: "string", pattern: "^#[a-fA-F0-9]{6}$" },
                landingProjectId: { type: ["string", "null"], format: "uuid", description: "Saved prototype to open first, or null for the latest project." }
              } }
            }
          } } } },
          responses: {
            "200": { description: "Project list, project with revision history, or saved project", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
            "403": { description: "Missing, expired or revoked private workspace key" },
            "409": { description: "Revision changed. Get the current project and reconcile before saving." }
          }
        }
      }
    },
    components: { securitySchemes: { labKey: { type: "http", scheme: "bearer" } } }
  };
}
