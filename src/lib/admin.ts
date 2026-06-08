export function getSuperAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return getSuperAdminEmails().includes(email.toLowerCase());
}
