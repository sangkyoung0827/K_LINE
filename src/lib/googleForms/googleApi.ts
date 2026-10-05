import "server-only";
import { createHash } from "node:crypto";

import { normalizeEmail } from "@/lib/admin";
import { supabaseRequest } from "./store";
import { decryptGoogleToken, encryptGoogleToken } from "./crypto";
import type { GoogleFormDraft, GoogleFormQuestion, GoogleFormRegistryRow, GoogleFormStatus } from "./types";
import { actualResponderUrl, mapResponseAnswers, type FormStructure, type FormAnswer } from "./responses";
import { assertGoogleFormsTestEnvironment, assertGoogleFormsPublicationApproval } from "./safety";

type OAuthConnection = { account_email: string; encrypted_refresh_token: string; scopes: string[] };
type GoogleTokenResponse = { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string; token_type?: string; error?: string; error_description?: string };
type GoogleFormResource = FormStructure & { formId: string; info?: { title?: string; description?: string }; responderUri?: string; revisionId?: string };
type GoogleResponse = { responseId?: string; createTime?: string; respondentEmail?: string; answers?: Record<string, FormAnswer> };

const formsBase = "https://forms.googleapis.com/v1/forms";
const registryColumns = "id,club_key,activity_id,activity_type,google_form_id,title,description,responder_url,edit_url,status,application_deadline,response_count,last_response_sync_at,metadata,created_by,created_at,updated_at";

function oauthConfig() {
  assertGoogleFormsTestEnvironment();
  const clientId = (process.env.GOOGLE_FORMS_CLIENT_ID || process.env.AUTH_GOOGLE_ID)?.trim();
  const clientSecret = (process.env.GOOGLE_FORMS_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET)?.trim();
  const origin = process.env.GOOGLE_FORMS_TEST_ORIGIN?.replace(/\/$/, "");
  if (!origin) throw new Error("GOOGLE_FORMS_TEST_ORIGIN_REQUIRED");
  if (!clientId || !clientSecret) throw new Error("Google Forms OAuth client is not configured.");
  return { clientId, clientSecret, redirectUri: `${origin}/api/google-forms/oauth/callback` };
}

export const googleFormsScopes = [
  "openid", "email",
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/forms.responses.readonly",
  "https://www.googleapis.com/auth/drive.file"
];

export function googleAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = oauthConfig();
  const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", scope: googleFormsScopes.join(" "), state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
}

async function exchange(params: URLSearchParams) {
  const { clientId, clientSecret, redirectUri } = oauthConfig();
  params.set("client_id", clientId); params.set("client_secret", clientSecret); params.set("redirect_uri", redirectUri);
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", signal: AbortSignal.timeout(20_000), headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, cache: "no-store" });
  const data = await response.json() as GoogleTokenResponse;
  if (!response.ok || !data.access_token) throw new Error(`Google OAuth token exchange failed (${response.status}).`);
  return data;
}

export async function connectGoogleOperationsAccount(code: string, connectedBy: string) {
  const tokens = await exchange(new URLSearchParams({ code, grant_type: "authorization_code" }));
  if (!tokens.refresh_token) throw new Error("Google did not return an offline refresh token. Revoke the prior grant and reconnect.");
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" });
  const profile = await profileResponse.json() as { email?: string; email_verified?: boolean };
  const accountEmail = normalizeEmail(profile.email);
  if (!profileResponse.ok || !accountEmail || profile.email_verified !== true) throw new Error("The connected Google account email could not be verified.");
  const scopes = (tokens.scope || "").split(" ");
  if (googleFormsScopes.filter((scope) => scope.startsWith("https:")).some((scope) => !scopes.includes(scope))) throw new Error("GOOGLE_REQUIRED_SCOPES_NOT_GRANTED");
  await supabaseRequest("google_oauth_connections?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: "operations", account_email: accountEmail, encrypted_refresh_token: encryptGoogleToken(tokens.refresh_token), scopes: (tokens.scope || googleFormsScopes.join(" ")).split(" "), connected_by: normalizeEmail(connectedBy) }) });
  return accountEmail;
}

export async function getGoogleConnectionStatus() {
  const rows = await supabaseRequest<OAuthConnection[]>("google_oauth_connections?select=account_email,encrypted_refresh_token,scopes&id=eq.operations&limit=1", { cache: "no-store" });
  return rows[0] ? { connected: true, accountEmail: rows[0].account_email, scopes: rows[0].scopes } : { connected: false, accountEmail: "", scopes: [] };
}

async function accessToken() {
  const rows = await supabaseRequest<OAuthConnection[]>("google_oauth_connections?select=account_email,encrypted_refresh_token,scopes&id=eq.operations&limit=1", { cache: "no-store" });
  if (!rows[0]) throw new Error("Google Forms connection is not configured.");
  const tokens = await exchange(new URLSearchParams({ refresh_token: decryptGoogleToken(rows[0].encrypted_refresh_token), grant_type: "refresh_token" }));
  return tokens.access_token!;
}

async function googleFetch<T>(url: string, init: RequestInit = {}) {
  assertGoogleFormsTestEnvironment();
  const token = await accessToken();
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000), headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) }, cache: "no-store" });
  const text = await response.text();
  const data = text ? JSON.parse(text) as T & { error?: { message?: string } } : {} as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(`Google API request failed (${response.status}).`);
  return data as T;
}

function questionItem(question: GoogleFormQuestion) {
  // Keep retry-stable IDs within Google's positive 31-bit hexadecimal range.
  const googleId = (namespace: string) => (createHash("sha256").update(`${namespace}:${question.id}`).digest().readUInt32BE(0) & 0x7fffffff).toString(16).padStart(8, "0");
  const itemId = googleId("item");
  const questionId = googleId("question");
  const base = { questionId, required: question.required } as Record<string, unknown>;
  if (question.type === "short_answer" || question.type === "paragraph") base.textQuestion = { paragraph: question.type === "paragraph" };
  else if (["multiple_choice", "checkbox", "dropdown"].includes(question.type)) base.choiceQuestion = { type: question.type === "multiple_choice" ? "RADIO" : question.type === "checkbox" ? "CHECKBOX" : "DROP_DOWN", options: question.options.filter(Boolean).map((value) => ({ value })) };
  else if (question.type === "date") base.dateQuestion = { includeTime: false, includeYear: true };
  else base.timeQuestion = { duration: false };
  return { itemId, title: question.title.trim(), questionItem: { question: base } };
}

async function setPublication(formId: string, isPublished: boolean, isAcceptingResponses: boolean) {
  const result = await googleFetch<{ formId?: string; publishSettings?: { publishState?: { isPublished?: boolean; isAcceptingResponses?: boolean } } }>(`${formsBase}/${encodeURIComponent(formId)}:setPublishSettings`, {
    method: "POST", body: JSON.stringify({ publishSettings: { publishState: { isPublished, isAcceptingResponses } }, updateMask: "publishState" })
  });
  const state = result.publishSettings?.publishState;
  if (result.formId !== formId || !state || Boolean(state.isPublished) !== isPublished || Boolean(state.isAcceptingResponses) !== isAcceptingResponses) throw new Error("GOOGLE_PUBLICATION_STATE_NOT_CONFIRMED");
}

export async function createGoogleForm(draft: GoogleFormDraft, createdBy: string, idempotencyKey: string) {
  assertGoogleFormsTestEnvironment();
  if (!/^[a-zA-Z0-9_-]{16,120}$/.test(idempotencyKey)) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  const items = draft.questions.map(questionItem);
  if (new Set(items.map(item => item.itemId)).size !== items.length ||
      new Set(items.map(item => item.questionItem.question.questionId)).size !== items.length) {
    throw new Error("GOOGLE_QUESTION_ID_COLLISION");
  }
  const draftHash = createHash("sha256").update(JSON.stringify(draft)).digest("hex");
  type Attempt = { idempotency_key: string; draft_hash: string; remote_form_id: string | null; status: string };
  const attemptQuery = `google_form_creation_attempts?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`;
  let attempts = await supabaseRequest<Attempt[]>(`${attemptQuery}&select=*`, { cache: "no-store" });
  if (attempts[0]?.draft_hash !== undefined && attempts[0].draft_hash !== draftHash) throw new Error("IDEMPOTENCY_DRAFT_MISMATCH");
  const existing = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?select=${registryColumns}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`, { cache: "no-store" });
  if (existing[0]) return existing[0];
  if (attempts[0]?.status === "creating" || attempts[0]?.status === "uncertain") throw new Error("FORM_CREATION_UNCERTAIN_RECONCILIATION_REQUIRED");
  if (!attempts[0]) {
    attempts = await supabaseRequest<Attempt[]>("google_form_creation_attempts?select=*", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ idempotency_key: idempotencyKey, draft_hash: draftHash, created_by: normalizeEmail(createdBy), status: "creating" })
    });
  }
  let formId = attempts[0].remote_form_id;
  try {
    if (!formId) {
      const created = await googleFetch<GoogleFormResource>(`${formsBase}?unpublished=true`, { method: "POST", body: JSON.stringify({ info: { title: draft.title, documentTitle: draft.title } }) });
      if (!created.formId) throw new Error("GOOGLE_FORM_ID_MISSING");
      formId = created.formId;
      await supabaseRequest(attemptQuery, { method: "PATCH", body: JSON.stringify({ remote_form_id: formId, status: "configuring" }) });
    }
    const initial = await googleFetch<GoogleFormResource>(`${formsBase}/${encodeURIComponent(formId)}`);
    const existingIds = new Set((initial.items || []).map((item) => item.itemId));
    const requests: Record<string, unknown>[] = [];
    if (draft.description.trim()) requests.push({ updateFormInfo: { info: { description: draft.description.trim() }, updateMask: "description" } });
    items.forEach((item, index) => {
      if (!existingIds.has(item.itemId)) requests.push({ createItem: { item, location: { index } } });
    });
    if (requests.length) await googleFetch(`${formsBase}/${encodeURIComponent(formId)}:batchUpdate`, { method: "POST", body: JSON.stringify({ includeFormInResponse: true, requests }) });
    // Keep the form private until a separate, explicit publication approval.
    await setPublication(formId, false, false);
    const form = await googleFetch<GoogleFormResource>(`${formsBase}/${encodeURIComponent(formId)}`);
    const responderUrl = actualResponderUrl(form.responderUri);
    const rows = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?on_conflict=idempotency_key&select=${registryColumns}`, { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ club_key: draft.clubKey, activity_id: draft.activityId || null, activity_instance_id: idempotencyKey, activity_type: draft.templateId || null, google_form_id: formId, title: draft.title, description: draft.description, responder_url: responderUrl, edit_url: `https://docs.google.com/forms/d/${formId}/edit`, status: "draft", application_deadline: draft.applicationDeadline || null, idempotency_key: idempotencyKey, created_by: normalizeEmail(createdBy), metadata: { activityDate: draft.activityDate || null, activityTitle: draft.activityTitle || null, location: draft.location || null, templateId: draft.templateId, questions: draft.questions } }) });
    await supabaseRequest(attemptQuery, { method: "PATCH", body: JSON.stringify({ status: "ready" }) });
    if (!rows[0]) return (await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?select=${registryColumns}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`))[0];
    return rows[0];
  } catch (error) {
    await supabaseRequest(attemptQuery, { method: "PATCH", body: JSON.stringify({ remote_form_id: formId, status: formId ? "configuring" : "uncertain" }) }).catch(() => undefined);
    throw new Error(formId ? `FORM_SETUP_RETRYABLE: ${formId}` : "FORM_CREATION_UNCERTAIN_RECONCILIATION_REQUIRED", { cause: error });
  }
}

export async function setGoogleFormStatus(row: GoogleFormRegistryRow, status: GoogleFormStatus) {
  assertGoogleFormsTestEnvironment();
  if (status === "open" || status === "closed") assertGoogleFormsPublicationApproval();
  if (status === "open" && row.application_deadline && Date.parse(row.application_deadline) <= Date.now()) throw new Error("APPLICATION_DEADLINE_HAS_PASSED");
  await setPublication(row.google_form_id, status === "open" || status === "closed", status === "open");
  const rows = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?id=eq.${encodeURIComponent(row.id)}&select=${registryColumns}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status }) });
  return rows[0];
}

export async function syncGoogleFormResponses(row: GoogleFormRegistryRow) {
  const form = await googleFetch<GoogleFormResource>(`${formsBase}/${encodeURIComponent(row.google_form_id)}`);
  const responses = new Map<string, GoogleResponse>();
  const seenTokens = new Set<string>();
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "5000" }); if (pageToken) query.set("pageToken", pageToken);
    const page = await googleFetch<{ responses?: GoogleResponse[]; nextPageToken?: string }>(`${formsBase}/${encodeURIComponent(row.google_form_id)}/responses?${query}`);
    for (const response of page.responses || []) {
      if (!response.responseId || !response.createTime) throw new Error("INVALID_GOOGLE_RESPONSE");
      responses.set(response.responseId, response);
    }
    pageToken = page.nextPageToken || "";
    if (pageToken && seenTokens.has(pageToken)) throw new Error("REPEATED_GOOGLE_PAGE_TOKEN");
    if (pageToken) seenTokens.add(pageToken);
    if (seenTokens.size > 1000) throw new Error("GOOGLE_RESPONSE_PAGE_LIMIT");
  } while (pageToken);

  for (const response of responses.values()) {
    if (!response.responseId || !response.createTime) continue;
    const mapped = mapResponseAnswers(form, response.answers);
    const answers = Object.fromEntries(Object.entries(mapped).map(([id, answer]) => [`${answer.title} [${id}]`, answer.values]));
    const emailFromAnswer = Object.values(mapped).find((answer) => /email|이메일/i.test(answer.title))?.values[0];
    const respondentEmail = normalizeEmail(response.respondentEmail || emailFromAnswer);
    let matchedUserEmail: string | null = null;
    if (respondentEmail) {
      const members = await supabaseRequest<Array<{ email: string }>>(`site_members?select=email&email=eq.${encodeURIComponent(respondentEmail)}&limit=1`, { cache: "no-store" }).catch(() => []);
      matchedUserEmail = members[0] ? respondentEmail : null;
    }
    await supabaseRequest("google_form_responses?on_conflict=google_form_registry_id,google_response_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ google_form_registry_id: row.id, google_response_id: response.responseId, submitted_at: response.createTime, respondent_email: respondentEmail || null, matched_user_email: matchedUserEmail, answers_json: answers, raw_answers_json: mapped, synced_at: new Date().toISOString() }) });
  }
  const now = new Date().toISOString();
  await supabaseRequest(`google_forms?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ response_count: responses.size, last_response_sync_at: now }) });
  return responses.size;
}

export { registryColumns };
