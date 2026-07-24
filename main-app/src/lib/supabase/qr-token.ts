import "server-only";
import { randomBytes } from "node:crypto";

/** 128 bits of entropy, base64url so it round-trips cleanly through a URL query param. */
export function generateQrToken() {
  return randomBytes(16).toString("base64url");
}
