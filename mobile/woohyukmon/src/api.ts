import { Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();
const origin = String(Constants.expoConfig?.extra?.apiOrigin || "");
const base = `${origin}/api/woohyukmon-app/v1`;
const key = "woohyukmon-session-v1";
let token: string | null = null;
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
export async function restoreSession() {
  token = Platform.OS === "web" ? null : await SecureStore.getItemAsync(key);
}
export async function forgetSession() {
  token = null;
  if (Platform.OS !== "web") await SecureStore.deleteItemAsync(key);
}
export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${base}/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "omit",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: signal || AbortSignal.timeout(path === "ai" ? 65000 : 25000),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) await forgetSession();
    throw new ApiError(value.error || "SERVICE_UNAVAILABLE", response.status);
  }
  return value;
}
export async function upload(memoryId: string, uri: string, consent: boolean) {
  const data = new FormData();
  data.append("memoryId", memoryId);
  data.append("consent", String(consent));
  if (Platform.OS === "web")
    data.append("file", await (await fetch(uri)).blob(), "photo.jpg");
  else
    data.append("file", {
      uri,
      type: "image/jpeg",
      name: "photo.jpg",
    } as unknown as Blob);
  const response = await fetch(`${base}/media`, {
    method: "POST",
    body: data,
    credentials: "omit",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const value = await response.json().catch(() => ({}));
    throw new ApiError(value.error || "PHOTO_UPLOAD_FAILED", response.status);
  }
}
export async function login() {
  if (Platform.OS === "web") throw new ApiError("NATIVE_LOGIN_REQUIRED", 400);
  const bytes = await Crypto.getRandomBytesAsync(32);
  const verifier = Array.from(bytes, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const state = Array.from(await Crypto.getRandomBytesAsync(24), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const challenge = (
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      { encoding: Crypto.CryptoEncoding.BASE64 },
    )
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const redirect = "woohyukmon://auth";
  const result = await WebBrowser.openAuthSessionAsync(
    `${base}/auth/authorize?challenge=${challenge}&state=${state}&redirectUri=${encodeURIComponent(redirect)}`,
    redirect,
  );
  if (result.type !== "success") return false;
  const returned = new URL(result.url);
  if (
    returned.protocol !== "woohyukmon:" ||
    returned.hostname !== "auth" ||
    returned.searchParams.get("state") !== state
  )
    throw new ApiError("INVALID_LOGIN_CALLBACK", 400);
  const payload = await api<{ token: string }>("auth/exchange", {
    code: returned.searchParams.get("code"),
    verifier,
  });
  if (!/^[A-Za-z0-9_-]{43}$/.test(payload.token))
    throw new ApiError("INVALID_LOGIN_RESPONSE", 502);
  await SecureStore.setItemAsync(key, payload.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  token = payload.token;
  return true;
}
