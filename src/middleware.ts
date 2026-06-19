import { NextResponse, type NextRequest } from "next/server";

const publicFilePattern =
  /\.(?:avif|gif|html|ico|jpeg|jpg|json|png|svg|txt|webmanifest|webp|xml)$/i;

const publicSeoPages = new Set([
  "/",
  "/archery-class",
  "/contact",
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

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (isPublicSeoPage(pathname)) {
    return NextResponse.next();
  }

  if (hasAuthSessionCookie(request)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", getSafeCallback(pathname, search));

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/auth).*)"]
};
