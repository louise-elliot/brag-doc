import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/sign-in", "/auth/callback"];

export async function proxy(request: NextRequest) {
  // API routes are excluded from redirect-based auth — they return JSON 401s
  // from their own handlers. The middleware should still refresh the session
  // cookie if needed, but never redirect /api/* to /sign-in.
  const isApi = request.nextUrl.pathname.startsWith("/api/");

  try {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (isApi) {
      return response;
    }

    const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
    if (!user && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      return NextResponse.redirect(url);
    }
    if (user && request.nextUrl.pathname === "/sign-in") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isApi) {
      return NextResponse.json({ proxyError: message }, { status: 500 });
    }
    // For page navigations, let the request proceed; auth failures will be
    // re-detected on the client side.
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
