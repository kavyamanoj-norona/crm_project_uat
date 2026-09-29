import { jwtVerify, SignJWT } from "jose";

// Edge-safe token helpers, shared by proxy.ts and the server session module.

export const SESSION_COOKIE = "lc_session";

export type SessionPayload = {
  userId: string;
  roleId: string;
};

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, expiresAt: Date) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getKey());
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.userId !== "string" || typeof payload.roleId !== "string") {
      return null;
    }
    return { userId: payload.userId, roleId: payload.roleId };
  } catch {
    return null;
  }
}
