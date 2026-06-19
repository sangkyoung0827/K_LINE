import { NextResponse, type NextRequest } from "next/server";

const publicFilePattern =
  /\.(?:avif|gif|html|ico|jpeg|jpg|json|png|svg|txt|webmanifest|webp|xml)$/i;

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/images/") ||
    publicFilePattern.test(pathname)
  );
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
