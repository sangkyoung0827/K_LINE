import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
export const previewOrigin = "http://woo-local-db.invalid";
function identifier(value, allowed) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value) || !allowed.has(value)) throw new Error("UNSAFE_PREVIEW_QUERY");
  return `"${value}"`;
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });


export async function createPreviewStore() {
  const db = new PGlite();
  await db.waitReady;
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;");
  for (const filename of ["20261005092720_google_forms_shared_project_test.sql", "20261010172743_event_studio.sql"]) {
    await db.exec((await readFile(new URL("../supabase/migrations/" + filename, import.meta.url), "utf8")).replace("create extension if not exists pgcrypto;", ""));
  }
  const localTables = new Set(["event_studio_jobs", "event_ai_usage", "event_ai_limits", "google_oauth_connections", "google_forms", "google_form_creation_attempts", "google_form_responses", "google_form_workflows", "google_form_operation_audit", "site_members", "club_board_posts"].map(n => "kline_forms_test_" + n));
  const columns = new Map(), columnTypes = new Map();
  await db.exec("set role service_role;");
  for (const table of localTables) {
    const rows = (await db.query("select column_name,data_type from information_schema.columns where table_schema='public' and table_name=$1", [table])).rows;
    columns.set(table, new Set(rows.map(r => r.column_name)));
    columnTypes.set(table, new Map(rows.map(r => [r.column_name,r.data_type])));
  }
  async function rest(url, init) {
    const resource = url.pathname.slice("/rest/v1/".length), body = init.body ? JSON.parse(init.body) : {};
    if (resource.startsWith("rpc/")) {
      if (init.method !== "POST") throw new Error("UNSAFE_PREVIEW_QUERY");
      if (resource === "rpc/kline_forms_test_event_ai_reserve") return json((await db.query("select public.kline_forms_test_event_ai_reserve($1,$2,$3,$4,$5) as result", [body.p_actor, body.p_club, body.p_model, body.p_reason, body.p_attempt])).rows[0].result);
      throw new Error("UNSAFE_PREVIEW_QUERY");
    }
    const table = identifier(resource, localTables), allowed = columns.get(resource), args = [];
    const param = value => { args.push(value); return `$${args.length}`; };
    function predicate(field, value) {
      const col = identifier(field, allowed);
      const match = /^(eq|neq|gte|in)\.(.*)$/.exec(value);
      if (!match) throw new Error("UNSAFE_PREVIEW_QUERY");
      if (match[1] === "in") {
        if (!/^\([a-zA-Z0-9_:-]+(?:,[a-zA-Z0-9_:-]+)*\)$/.test(match[2])) throw new Error("UNSAFE_PREVIEW_QUERY");
        return `${col} in (${match[2].slice(1, -1).split(",").map(param).join(",")})`;
      }
      return `${col} ${{ eq: "=", neq: "<>", gte: ">=" }[match[1]]} ${param(match[2])}`;
    }
    const filters = [];
    for (const [key, value] of url.searchParams) {
      if (["select", "order", "limit", "offset", "on_conflict"].includes(key)) continue;
      if (key === "or") {
        if (!value.startsWith("(") || !value.endsWith(")")) throw new Error("UNSAFE_PREVIEW_QUERY");
        const parts = value.slice(1, -1).split(/,(?=[a-z_]+\.in\.)/);
        filters.push(`(${parts.map(p => { const i = p.indexOf("."); return predicate(p.slice(0, i), p.slice(i + 1)); }).join(" or ")})`);
      } else filters.push(predicate(key, value));
    }
    const where = filters.length ? ` where ${filters.join(" and ")}` : "";
    const method = init.method || "GET";
    if (method === "GET") {
      const projection = url.searchParams.get("select") || "*";
      const select = projection === "*" ? "*" : projection.split(",").map(c => identifier(c, allowed)).join(",");
      const order = url.searchParams.get("order");
      const ordering = order ? ` order by ${order.split(",").map(part => {
        const [field, direction] = part.split(".");
        if (!["asc", "desc"].includes(direction)) throw new Error("UNSAFE_PREVIEW_QUERY");
        return `${identifier(field, allowed)} ${direction}`;
      }).join(",")}` : "";
      const limit = Number(url.searchParams.get("limit") || 100);
      if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error("UNSAFE_PREVIEW_QUERY");
      const offset = Number(url.searchParams.get("offset") || 0);
      if (!Number.isInteger(offset) || offset < 0 || offset > 30000) throw new Error("UNSAFE_PREVIEW_QUERY");
      const rows = (await db.query(`select ${select} from public.${table}${where}${ordering} limit ${limit} offset ${offset}`, args)).rows;
      return json(rows);
    }
    const names = Object.keys(body), fields = names.map(n => identifier(n, allowed));
    const values = names.map(n => {
      const p = param(typeof body[n] === "object" && body[n] !== null ? JSON.stringify(body[n]) : body[n]);
      return columnTypes.get(resource).get(n) === "ARRAY" ? `ARRAY(select jsonb_array_elements_text(${p}::jsonb))` : p;
    });
    const headers = new Headers(init.headers), prefer = headers.get("prefer") || "";
    let result;
    if (method === "POST" && !filters.length && fields.length) {
      const conflict = url.searchParams.get("on_conflict"), merge = prefer.includes("resolution=merge-duplicates");
      const clause = conflict ? ` on conflict (${conflict.split(",").map(c=>identifier(c,allowed)).join(",")}) ${merge ? "do update set " + fields.map(f=>`${f}=excluded.${f}`).join(",") : "do nothing"}` : "";
      result = await db.query(`insert into public.${table}(${fields.join(",")}) values(${values.join(",")})${clause} returning *`, args);
    }
    else if (method === "PATCH" && filters.length && fields.length) result = await db.query(`update public.${table} set ${fields.map((f, i) => `${f}=${values[i]}`).join(",")}${where} returning *`, args);
    else if (method === "DELETE" && filters.length) await db.query(`delete from public.${table}${where}`, args);
    else throw new Error("UNSAFE_PREVIEW_QUERY");
    return prefer.includes("return=representation") ? json(result?.rows || []) : new Response(null, { status: 204 });
  }

  return { db, async fetch(url, init = {}) {
    try { return await rest(new URL(url), init); }
    catch (error) { return json({ message: error.message }, 400); }
  } };
}
