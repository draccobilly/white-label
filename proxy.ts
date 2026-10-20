import { NextResponse, NextRequest } from "next/server";
import { getAppRole } from "@/lib/app-role";
import {
  PUBLIC_PREFIX_HEADER,
  publicPrefixFromPathname,
  stripPublicPrefix,
} from "@/lib/public-site-url";
import { updateSession } from "@/lib/supabase/middleware";
import { stampAdClickCookie } from "@/lib/ad-click";

function isAdminPath(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/join") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/join")
  );
}

function applyAppRole(request: NextRequest, pathname: string) {
  const role = getAppRole();
  if (role === "all") return null;

  if (role === "admin") {
    if (pathname.startsWith("/api/webhooks")) {
      return new NextResponse("Not found", { status: 404 });
    }
    if (
      pathname.startsWith("/c") ||
      pathname.startsWith("/track-your-donation") ||
      pathname.startsWith("/refund") ||
      pathname.startsWith("/gerenating-receipt") ||
      pathname === "/"
    ) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return null;
  }

  if (isAdminPath(pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }

  return null;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

export async function proxy(request: NextRequest) {
  const prefix = publicPrefixFromPathname(request.nextUrl.pathname);
  const internalPath = prefix
    ? stripPublicPrefix(request.nextUrl.pathname, prefix)
    : request.nextUrl.pathname;

  const blocked = applyAppRole(request, internalPath);
  if (blocked) return blocked;

  const requestHeaders = new Headers(request.headers);
  if (prefix) requestHeaders.set(PUBLIC_PREFIX_HEADER, prefix);

  // Path strip for /mexico and /argentina lives in next.config rewrites. A
  // middleware rewrite behind nginx becomes https://localhost:3001 (EPROTO)
  // and a 502.
  const forwarded = NextResponse.next({
    request: { headers: requestHeaders },
  });
  try {
    const sessionResponse = await updateSession(request);
    if (sessionResponse.status >= 300 && sessionResponse.status < 400) {
      return stampAdClickCookie(request, sessionResponse);
    }
    return stampAdClickCookie(request, copyCookies(sessionResponse, forwarded));
  } catch (error) {
    console.error("[proxy] session check failed", error);
    return stampAdClickCookie(request, forwarded);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|__giving|_next/data|api/admin/media|api/portal/media|api/health|favicon.ico|sw\\.js|admin/sw\\.js|manifest\\.webmanifest|apple-touch-icon\\.png|admin-icon-.*\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
