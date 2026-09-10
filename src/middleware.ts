import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isReadOnlyDeveloperEmail, isReadOnlyMethod, readOnlyDeveloperHeader } from "@/lib/readOnlyDeveloper";

const publicFilePattern =
  /\.(?:avif|gif|html|ico|jpeg|jpg|json|png|svg|txt|webmanifest|webp|xml)$/i;

const publicSeoPages = new Set([
  "/",
  "/archery-class",
  "/contact",
  "/ecc-alumni",
  "/ecc-alumni/notices",
  "/han-hwal",
  "/k-culture-project",
  "/our-activities",
  "/our-activities/ecc",
  "/our-activities/hanhwal"
]);

const protectedPagePrefixes = [
  "/admin",
  "/cart",
  "/checkout",
  "/developer",
  "/donate",
  "/ecc-join",
  "/ecc-official",
  "/goods",
  "/international-student-club",
  "/k-culture-project/submit",
  "/member",
  "/products",
  "/register",
  "/request-admin",
  "/our-activities/write",
  "/our-activities/ecc/activity",
  "/our-activities/ecc/free-board",
  "/our-activities/ecc/fund",
  "/our-activities/ecc/members",
  "/our-activities/ecc/register"
];

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/ecc-alumni") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/images/") ||
    publicFilePattern.test(pathname)
  );
}

function isProtectedPage(pathname: string) {
  return protectedPagePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isPublicSeoPage(pathname: string) {
  if (publicSeoPages.has(pathname)) {
    return true;
  }

  if (pathname.startsWith("/k-culture-project/")) {
    return !isProtectedPage(pathname);
  }

  if (pathname.startsWith("/our-activities/")) {
    return !isProtectedPage(pathname);
  }

  return false;
}

function getSafeCallback(pathname: string, search: string) {
  const callbackUrl = `${pathname}${search}`;

  if (!callbackUrl || callbackUrl.startsWith("/login")) {
    return "/ecc-join";
  }

  return callbackUrl;
}

function hasAuthSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => {
    const name = cookie.name;

    return (
      name === "authjs.session-token" ||
      name === "__Secure-authjs.session-token" ||
      name.startsWith("authjs.session-token.") ||
      name.startsWith("__Secure-authjs.session-token.")
    );
  });
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Never trust a client-supplied read-only marker. Only a verified session sets it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(readOnlyDeveloperHeader);
  if (hasAuthSessionCookie(request) || request.headers.has("authorization")) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
      secureCookie: request.nextUrl.protocol === "https:"
    });
    if (isReadOnlyDeveloperEmail(token?.email)) {
      if (!isReadOnlyMethod(request.method)) {
        return NextResponse.json({
          error: "This developer account is read-only. Changes are not allowed.",
          code: "READ_ONLY_DEVELOPER"
        }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
      }
      requestHeaders.set(readOnlyDeveloperHeader, "1");
    }
  }
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  if (isPublicPath(pathname)) {
    return next();
  }

  if (isPublicSeoPage(pathname)) {
    return next();
  }

  if (hasAuthSessionCookie(request)) {
    return next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", getSafeCallback(pathname, search));

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/auth).*)"]
};
