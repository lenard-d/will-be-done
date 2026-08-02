import { syncDispatch, type DB } from "@will-be-done/hyperdb";
import { getMainHyperDB } from "../db/db";
import { validateToken } from "../slices/authSlice";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export function authenticateBearerToken(
  authHeader?: string,
  mainDB: DB = getMainHyperDB(),
): AuthenticatedUser | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length);
  if (!token) {
    return null;
  }

  try {
    const user = syncDispatch(mainDB, validateToken({ tokenId: token }));
    return user ? { id: user.id, email: user.email } : null;
  } catch (error) {
    console.error("Token validation error:", error);
    return null;
  }
}
