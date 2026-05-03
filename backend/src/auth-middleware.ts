import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.js";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

const JWT_SECRET = () => process.env.JWT_SECRET || "change-me-in-production";

export function signToken(payload: { sub: string; email: string; username: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET(), {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as any,
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const decoded = jwt.verify(token, JWT_SECRET()) as any;
    const row = db.prepare(
      `SELECT id, email, username, role, is_active FROM users WHERE id = ?`
    ).get(decoded.sub) as any;

    if (!row || !row.is_active) return res.status(401).json({ error: "User not found or inactive" });

    req.user = { id: row.id, email: row.email, username: row.username, role: row.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
