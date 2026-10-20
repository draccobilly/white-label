import "@/lib/supabase/polyfill-websocket";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { supabaseAuthCookieOptions } from "@/lib/supabase/cookie-options";

export async function createClient() {
  const cookieStore = await cookies();
  const proto = (await headers()).get("x-forwarded-proto");
  const cookieOptions = supabaseAuthCookieOptions(proto);
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions,
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...cookieOptions, ...options }),
            );
          } catch {
            // Server Components cannot always mutate cookies; the proxy refreshes them.
          }
        },
      },
    },
  );
}
