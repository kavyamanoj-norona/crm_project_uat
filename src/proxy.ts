import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/session-token";

const PUBLIC_PATHS = ["/login"];

// Optimistic auth gate. Real checks (user active, permissions) happen on the
// server in requireUser() / resolveRoute().
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic) return NextResponse.next(); // login page redirects signed-in users itself

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  return NextResponse.next();
}

export const config = {
  // Skip Next internals, API routes and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
