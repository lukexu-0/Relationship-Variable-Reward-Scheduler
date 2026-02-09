import type { NextFunction, Request, Response } from "express";

import { UserModel } from "../models/user.model.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { HttpError } from "../lib/http-error.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new HttpError(401, "Missing bearer token"));
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = await verifyAccessToken(token);
    const user = await UserModel.findById(payload.sub);
    if (!user) {
      return next(new HttpError(401, "User no longer exists"));
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}
