import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: req,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            req.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: req,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/projects'];
  const isProtectedRoute = protectedRoutes.some(route =>
    req.nextUrl.pathname.startsWith(route)
  );

  // Auth routes that should redirect to dashboard if already logged in
  const authRoutes = ['/auth/login', '/auth/signup'];
  const isAuthRoute = authRoutes.some(route =>
    req.nextUrl.pathname.startsWith(route)
  );

  // TEMPORARY: Disable redirect for testing
  // TODO: Fix session cookie handling
  // if (isProtectedRoute && !session) {
  //   // Redirect to login if trying to access protected route without session
  //   const redirectUrl = req.nextUrl.clone();
  //   redirectUrl.pathname = '/auth/login';
  //   redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname);
  //   return NextResponse.redirect(redirectUrl);
  // }

  if (isAuthRoute && session) {
    // Redirect to dashboard if trying to access auth pages with active session
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
