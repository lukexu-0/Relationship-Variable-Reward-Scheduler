import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

import { config } from "../config.js";
import { HttpError } from "./http-error.js";

const accessSecret = new TextEncoder().encode(config.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(config.JWT_REFRESH_SECRET);

const ACCESS_TOKEN_SECONDS = 60 * 15;
const REFRESH_TOKEN_SECONDS = 60 * 60 * 24 * 30;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
  accessTokenExpiresInSec: number;
  refreshTokenExpiresInSec: number;
}

export async function issueTokenPair(userId: string, email: string): Promise<TokenPair> {
  const refreshTokenId = crypto.randomUUID();
  const accessToken = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
    .sign(accessSecret);

  const refreshToken = await new SignJWT({ email, tokenId: refreshTokenId, kind: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_SECONDS}s`)
    .sign(refreshSecret);

  return {
    accessToken,
    refreshToken,
    refreshTokenId,
    accessTokenExpiresInSec: ACCESS_TOKEN_SECONDS,
    refreshTokenExpiresInSec: REFRESH_TOKEN_SECONDS
  };
}

export async function verifyAccessToken(token: string): Promise<{ sub: string; email: string }> {
  try {
    const { payload } = await jwtVerify(token, accessSecret);
    if (!payload.sub || typeof payload.email !== "string") {
      throw new HttpError(401, "Invalid access token payload");
    }

    return { sub: payload.sub, email: payload.email };
  } catch {
    throw new HttpError(401, "Invalid or expired access token");
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<{ sub: string; email: string; tokenId: string }> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret);
    if (
      !payload.sub ||
      typeof payload.email !== "string" ||
      typeof payload.tokenId !== "string" ||
      payload.kind !== "refresh"
    ) {
      throw new HttpError(401, "Invalid refresh token payload");
    }

    return { sub: payload.sub, email: payload.email, tokenId: payload.tokenId };
  } catch {
    throw new HttpError(401, "Invalid or expired refresh token");
  }
}
