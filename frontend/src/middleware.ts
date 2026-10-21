import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas exentas de autenticación
  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') || // APIs van directamente a FastAPI
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt';

  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  // Redirigir a /login si no hay ningún token de sesión en rutas protegidas
  if (!isPublicRoute && !accessToken && !refreshToken) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', pathname);
    }
    const response = NextResponse.redirect(loginUrl);
    _applySecurityHeaders(response);
    return response;
  }

  // Si ya está autenticado e intenta ir a /login, redirigir al terminal raíz
  if (pathname === '/login' && (accessToken || refreshToken)) {
    const homeUrl = new URL('/', request.url);
    const response = NextResponse.redirect(homeUrl);
    _applySecurityHeaders(response);
    return response;
  }

  const response = NextResponse.next();
  _applySecurityHeaders(response);
  return response;
}

function _applySecurityHeaders(response: NextResponse) {
  response.headers.set(
    'X-Robots-Tag',
    'noindex, nofollow, noarchive, nosnippet, noimageindex, nocache'
  );
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto archivos estáticos explícitos
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
