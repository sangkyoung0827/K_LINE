import { AppError } from "./model";

export function requireWebAuthEnabled() {
  if (process.env.WOOHYUKMON_APP_ENABLED !== "true" &&
      process.env.WOOHYUKMON_APP_WEB_AUTH_ENABLED !== "true")
    throw new AppError("APP_NOT_ENABLED", 503);
}

export function webReturnPath() {
  const path = process.env.WOOHYUKMON_APP_WEB_RETURN_PATH || "/woohyukmon/Main/My";
  // Only an explicit local path can receive the existing HttpOnly session.
  if (!/^\/[A-Za-z0-9/_-]+$/.test(path) || path.startsWith("//"))
    throw new AppError("INVALID_LOGIN_CALLBACK", 503);
  return path;
}
