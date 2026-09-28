import "server-only";

import { normalizeEmail } from "@/lib/admin";
import { supabaseRequest } from "@/lib/supabaseServer";
import { decryptGoogleToken, encryptGoogleToken } from "./crypto";
import type { GoogleFormDraft, GoogleFormQuestion, GoogleFormRegistryRow, GoogleFormStatus } from "./types";

type OAuthConnection = { account_email: string; encrypted_refresh_token: string; scopes: string[] };
type GoogleTokenResponse = { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string; token_type?: string; error?: string; error_description?: string };
type GoogleFormResource = { formId: string; info?: { title?: string; description?: string }; responderUri?: string; revisionId?: string; items?: Array<{ itemId?: string; title?: string }> };
type GoogleResponse = { responseId?: string; createTime?: string; respondentEmail?: string; answers?: Record<string, { textAnswers?: { answers?: Array<{ value?: string }> } }> };

const formsBase = "https://forms.googleapis.com/v1/forms";
const registryColumns = "id,club_key,activity_id,activity_type,google_form_id,title,description,responder_url,edit_url,status,application_deadline,response_count,last_response_sync_at,metadata,created_by,created_at,updated_at";

function oauthConfig() {
  const clientId = (process.env.GOOGLE_FORMS_CLIENT_ID || process.env.AUTH_GOOGLE_ID)?.trim();
  const clientSecret = (process.env.GOOGLE_FORMS_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET)?.trim();
  const origin = (process.env.NEXTAUTH_URL || process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://kline-nine-wheat.vercel.app").replace(/\/$/, "");
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
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, cache: "no-store" });
  const data = await response.json() as GoogleTokenResponse;
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "Google OAuth token exchange failed.");
  return data;
}

export async function connectGoogleOperationsAccount(code: string, connectedBy: string) {
  const tokens = await exchange(new URLSearchParams({ code, grant_type: "authorization_code" }));
  if (!tokens.refresh_token) throw new Error("Google did not return an offline refresh token. Revoke the prior grant and reconnect.");
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" });
  const profile = await profileResponse.json() as { email?: string };
  const accountEmail = normalizeEmail(profile.email);
  if (!profileResponse.ok || !accountEmail) throw new Error("The connected Google account email could not be verified.");
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
  const token = await accessToken();
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) }, cache: "no-store" });
  const text = await response.text();
  const data = text ? JSON.parse(text) as T & { error?: { message?: string } } : {} as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || `Google API request failed (${response.status}).`);
  return data as T;
}

function questionItem(question: GoogleFormQuestion) {
  const base = { required: question.required } as Record<string, unknown>;
  if (question.type === "short_answer" || question.type === "paragraph") base.textQuestion = { paragraph: question.type === "paragraph" };
  else if (["multiple_choice", "checkbox", "dropdown"].includes(question.type)) base.choiceQuestion = { type: question.type === "multiple_choice" ? "RADIO" : question.type === "checkbox" ? "CHECKBOX" : "DROP_DOWN", options: question.options.filter(Boolean).map((value) => ({ value })) };
  else if (question.type === "date") base.dateQuestion = { includeTime: false, includeYear: true };
  else base.timeQuestion = { duration: false };
  return { title: question.title.trim(), questionItem: { question: base } };
}

export async function createGoogleForm(draft: GoogleFormDraft, createdBy: string, idempotencyKey: string) {
  const existing = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?select=${registryColumns}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`, { cache: "no-store" });
  if (existing[0]) return existing[0];
  const created = await googleFetch<GoogleFormResource>(formsBase, { method: "POST", body: JSON.stringify({ info: { title: draft.title, documentTitle: draft.title } }) });
  const formId = created.formId;
  try {
    const requests: Record<string, unknown>[] = [];
    if (draft.description.trim()) requests.push({ updateFormInfo: { info: { description: draft.description.trim() }, updateMask: "description" } });
    draft.questions.forEach((question, index) => requests.push({ createItem: { item: questionItem(question), location: { index } } }));
    if (requests.length) await googleFetch(`${formsBase}/${encodeURIComponent(formId)}:batchUpdate`, { method: "POST", body: JSON.stringify({ includeFormInResponse: true, requests }) });
    await googleFetch(`${formsBase}/${encodeURIComponent(formId)}:setPublishSettings`, { method: "POST", body: JSON.stringify({ publishSettings: { publishState: { isPublished: true, isAcceptingResponses: true } }, updateMask: "publishState" }) });
    if (draft.editorEmail) await googleFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(formId)}/permissions?sendNotificationEmail=true`, { method: "POST", body: JSON.stringify({ type: "user", role: "writer", emailAddress: normalizeEmail(draft.editorEmail) }) });
    const form = await googleFetch<GoogleFormResource>(`${formsBase}/${encodeURIComponent(formId)}`);
    const responderUrl = form.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`;
    const rows = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?select=${registryColumns}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ club_key: draft.clubKey, activity_id: draft.activityId || null, activity_type: draft.templateId || null, google_form_id: formId, title: draft.title, description: draft.description, responder_url: responderUrl, edit_url: `https://docs.google.com/forms/d/${formId}/edit`, status: "open", application_deadline: draft.applicationDeadline || null, idempotency_key: idempotencyKey, created_by: normalizeEmail(createdBy), metadata: { activityDate: draft.activityDate || null, activityTitle: draft.activityTitle || null, location: draft.location || null, templateId: draft.templateId, questions: draft.questions } }) });
    return rows[0];
  } catch (error) {
    try {
      await googleFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(formId)}`, { method: "DELETE" });
    } catch (cleanupError) {
      throw new Error(`Google Form ${formId} was created, but K_LINE setup and cleanup both failed. Open https://docs.google.com/forms/d/${formId}/edit and remove it manually. ${error instanceof Error ? error.message : ""} ${cleanupError instanceof Error ? cleanupError.message : ""}`);
    }
    throw new Error(`Google Form setup failed and the incomplete form was removed. ${error instanceof Error ? error.message : ""}`);
  }
}

export async function setGoogleFormStatus(row: GoogleFormRegistryRow, status: GoogleFormStatus) {
  if (status === "open" || status === "closed") await googleFetch(`${formsBase}/${encodeURIComponent(row.google_form_id)}:setPublishSettings`, { method: "POST", body: JSON.stringify({ publishSettings: { publishState: { isPublished: true, isAcceptingResponses: status === "open" } }, updateMask: "publishState" }) });
  const rows = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?id=eq.${encodeURIComponent(row.id)}&select=${registryColumns}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status }) });
  return rows[0];
}

export async function syncGoogleFormResponses(row: GoogleFormRegistryRow) {
  const form = await googleFetch<GoogleFormResource>(`${formsBase}/${encodeURIComponent(row.google_form_id)}`);
  const titles = new Map((form.items || []).map((item) => [item.itemId || "", item.title || item.itemId || "Question"]));
  const responses: GoogleResponse[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "5000" }); if (pageToken) query.set("pageToken", pageToken);
    const page = await googleFetch<{ responses?: GoogleResponse[]; nextPageToken?: string }>(`${formsBase}/${encodeURIComponent(row.google_form_id)}/responses?${query}`);
    responses.push(...(page.responses || [])); pageToken = page.nextPageToken || "";
  } while (pageToken);

  for (const response of responses) {
    if (!response.responseId || !response.createTime) continue;
    const answers = Object.fromEntries(Object.entries(response.answers || {}).map(([questionId, answer]) => [titles.get(questionId) || questionId, (answer.textAnswers?.answers || []).map((item) => item.value || "") ]));
    const emailFromAnswer = Object.entries(answers).find(([title]) => /(^|\b)(email|이메일)(\b|$)/i.test(title))?.[1]?.[0];
    const respondentEmail = normalizeEmail(response.respondentEmail || emailFromAnswer);
    let matchedUserEmail: string | null = null;
    if (respondentEmail) {
      const members = await supabaseRequest<Array<{ email: string }>>(`site_members?select=email&email=eq.${encodeURIComponent(respondentEmail)}&limit=1`, { cache: "no-store" }).catch(() => []);
      matchedUserEmail = members[0] ? respondentEmail : null;
    }
    await supabaseRequest("google_form_responses?on_conflict=google_form_registry_id,google_response_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ google_form_registry_id: row.id, google_response_id: response.responseId, submitted_at: response.createTime, respondent_email: respondentEmail || null, matched_user_email: matchedUserEmail, answers_json: answers, synced_at: new Date().toISOString() }) });
  }
  const now = new Date().toISOString();
  await supabaseRequest(`google_forms?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ response_count: responses.length, last_response_sync_at: now }) });
  return responses.length;
}

export { registryColumns };
