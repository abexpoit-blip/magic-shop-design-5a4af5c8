import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { pool } from "./db.js";

export type AuthUser = { id: string; email: string; username: string; roles: string[] };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

export function signToken(payload: { sub: string; email: string; username: string }) {
  const secret: jwt.Secret = process.env.JWT_SECRET!;
  const options: jwt.SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, secret, options);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.username,
              COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles r ON r.user_id = u.id
        WHERE u.id = $1
        GROUP BY u.id`,
      [decoded.sub]
    );
    if (!rows[0]) return res.status(401).json({ error: "User not found" });
    req.user = { id: rows[0].id, email: rows[0].email, username: rows[0].username, roles: rows[0].roles };
    next();
  } catch (e: any) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(role: "admin" | "seller" | "buyer") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!req.user.roles.includes(role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
