import "@/lib/supabase/polyfill-websocket";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuthCookieOptions } from "@/lib/supabase/cookie-options";
import { mustChangePassword } from "@/lib/must-change-password";

function needsAdminSession(pathname: string) {
  return pathname.startsWith("/admin");
}

async function getUserOrTimeout(
  getUser: () => Promise<{ data: { user: unknown } }>,
  ms = 12_000,
) {
  return Promise.race([
    getUser(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("SUPABASE_AUTH_TIMEOUT")), ms);
    }),
  ]);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!needsAdminSession(request.nextUrl.pathname)) {
    return response;
  }
  if (
    process.env.LOCAL_ADMIN_BYPASS === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    return response;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const proto =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "");
  const cookieOptions = supabaseAuthCookieOptions(proto);

  try {
    const supabase = createServerClient(url, key, {
      cookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...cookieOptions, ...options }),
          );
        },
      },
    });

    const {
      data: { user },
    } = await getUserOrTimeout(() => supabase.auth.getUser());

    if (!user) {
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      login.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(login);
    }
    if (mustChangePassword(user as { app_metadata?: Record<string, unknown> })) {
      const reset = request.nextUrl.clone();
      reset.pathname = "/login/senha";
      reset.search = "";
      const redirect = NextResponse.redirect(reset);
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  } catch (error) {
    // Timeout or network: keep the existing session cookie and let RSC retry.
    console.warn("[auth] getUser failed in middleware", error);
    return response;
  }

  return response;
}
