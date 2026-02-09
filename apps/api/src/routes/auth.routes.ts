import { Router } from "express";
import { z } from "zod";
import { loginSchema, registerSchema } from "@reward/shared-validation";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { issueTokenPair, verifyRefreshToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { parseOrThrow } from "../lib/zod.js";
import { HttpError } from "../lib/http-error.js";
import { RefreshTokenModel } from "../models/refresh-token.model.js";
import { UserModel } from "../models/user.model.js";

const refreshInputSchema = z.object({
  refreshToken: z.string().min(1)
});

const logoutInputSchema = z.object({
  refreshToken: z.string().min(1)
});

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(registerSchema, req.body);
    const existing = await UserModel.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw new HttpError(409, "Email is already registered");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await UserModel.create({
      email: input.email.toLowerCase(),
      passwordHash,
      timezone: input.timezone,
      reminderPreferences: {
        emailEnabled: true,
        reminderLeadHours: 24
      }
    });

    const tokens = await issueTokenPair(user.id, user.email);
    await RefreshTokenModel.create({
      userId: user.id,
      tokenId: tokens.refreshTokenId,
      expiresAt: new Date(Date.now() + tokens.refreshTokenExpiresInSec * 1000)
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        timezone: user.timezone,
        reminderPreferences: user.reminderPreferences
      },
      tokens
    });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(loginSchema, req.body);
    const user = await UserModel.findOne({ email: input.email.toLowerCase() });
    if (!user) {
      throw new HttpError(401, "Invalid credentials");
    }

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      throw new HttpError(401, "Invalid credentials");
    }

    const tokens = await issueTokenPair(user.id, user.email);
    await RefreshTokenModel.create({
      userId: user.id,
      tokenId: tokens.refreshTokenId,
      expiresAt: new Date(Date.now() + tokens.refreshTokenExpiresInSec * 1000)
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        timezone: user.timezone,
        reminderPreferences: user.reminderPreferences
      },
      tokens
    });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(refreshInputSchema, req.body);
    const payload = await verifyRefreshToken(input.refreshToken);

    const refreshDoc = await RefreshTokenModel.findOne({
      userId: payload.sub,
      tokenId: payload.tokenId,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() }
    });

    if (!refreshDoc) {
      throw new HttpError(401, "Refresh token not active");
    }

    refreshDoc.revokedAt = new Date();
    await refreshDoc.save();

    const user = await UserModel.findById(payload.sub);
    if (!user) {
      throw new HttpError(401, "User no longer exists");
    }

    const tokens = await issueTokenPair(user.id, user.email);
    await RefreshTokenModel.create({
      userId: user.id,
      tokenId: tokens.refreshTokenId,
      expiresAt: new Date(Date.now() + tokens.refreshTokenExpiresInSec * 1000)
    });

    res.json({ tokens });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(logoutInputSchema, req.body);
    const payload = await verifyRefreshToken(input.refreshToken);

    await RefreshTokenModel.updateOne(
      {
        userId: payload.sub,
        tokenId: payload.tokenId,
        revokedAt: { $exists: false }
      },
      { $set: { revokedAt: new Date() } }
    );

    res.status(204).send();
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
      throw new HttpError(401, "Unauthorized");
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        timezone: user.timezone,
        reminderPreferences: user.reminderPreferences
      }
    });
  })
);
