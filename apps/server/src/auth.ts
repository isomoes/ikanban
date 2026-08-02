import { randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "pi_web_session";

export function createSessionValue(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenMatches(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  const sameLength = actualBuffer.length === expectedBuffer.length;
  const comparable = sameLength ? actualBuffer : expectedBuffer;
  return timingSafeEqual(comparable, expectedBuffer) && sameLength;
}

export function isLoopback(address: string | undefined): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

export function originIsLocal(origin: string | undefined): boolean {
  if (origin === undefined) return true;
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}
