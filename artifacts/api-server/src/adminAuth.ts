import {
  randomBytes,
  scrypt,
  createHash,
  timingSafeEqual,
  type BinaryLike,
} from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { pool } from "./db";

/**
 * Autenticação do painel /admin — independente do Clerk (que é a conta dos
 * usuários do app). Senhas guardadas só como hash scrypt (com salt); sessões
 * guardadas como hash SHA-256 do token, em cookie httpOnly + SameSite=Strict.
 */

export const ADMIN_COOKIE = "kordi_admin";
const SESSION_HOURS = 12;

export type AdminRole = "owner" | "admin";

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  role: AdminRole;
  active: boolean;
}

let tablesReady: Promise<void> | null = null;

export function ensureAdminTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS admin_users (
           id SERIAL PRIMARY KEY,
           email TEXT NOT NULL UNIQUE,
           name TEXT,
           password_hash TEXT NOT NULL,
           role TEXT NOT NULL DEFAULT 'admin',
           active BOOLEAN NOT NULL DEFAULT TRUE,
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           last_login_at TIMESTAMPTZ
         );
         CREATE TABLE IF NOT EXISTS admin_sessions (
           token_hash TEXT PRIMARY KEY,
           admin_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
           expires_at TIMESTAMPTZ NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         );`,
      )
      .then(() => undefined)
      .catch((err) => {
        tablesReady = null;
        throw err;
      });
  }
  return tablesReady;
}

// ---------- senhas ----------

function scryptAsync(password: string, salt: BinaryLike): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "Senha inválida.";
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (password.length > 200) return "Senha muito longa.";
  return null;
}

// ---------- bootstrap do primeiro admin ----------

/**
 * Se ainda não existe nenhum admin e as variáveis ADMIN_BOOTSTRAP_EMAIL /
 * ADMIN_BOOTSTRAP_PASSWORD estiverem definidas (Secrets do servidor), cria o
 * primeiro usuário como "owner". A senha nunca fica no código.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  await ensureAdminTables();
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;

  const { rows } = await pool.query("SELECT 1 FROM admin_users LIMIT 1");
  if (rows.length > 0) return;

  const hash = await hashPassword(password);
  await pool.query(
    `INSERT INTO admin_users (email, name, password_hash, role)
     VALUES ($1, $2, $3, 'owner')
     ON CONFLICT (email) DO NOTHING`,
    [email, "Administrador", hash],
  );
  console.log(`[admin] primeiro administrador criado: ${email}`);
}

// ---------- sessões ----------

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function createSession(adminId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await pool.query(
    `INSERT INTO admin_sessions (token_hash, admin_id, expires_at)
     VALUES ($1, $2, NOW() + make_interval(hours => $3))`,
    [sha256(token), adminId, SESSION_HOURS],
  );
  // limpeza oportunista de sessões vencidas
  await pool.query("DELETE FROM admin_sessions WHERE expires_at < NOW()");
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await pool.query("DELETE FROM admin_sessions WHERE token_hash = $1", [
    sha256(token),
  ]);
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function getSessionToken(req: Request): string | null {
  return readCookie(req, ADMIN_COOKIE);
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure:
      req.secure || req.headers["x-forwarded-proto"] === "https",
    maxAge: SESSION_HOURS * 3600_000,
    path: "/api/admin",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(ADMIN_COOKIE, { path: "/api/admin" });
}

async function loadAdminFromRequest(req: Request): Promise<AdminUser | null> {
  const token = getSessionToken(req);
  if (!token) return null;
  await ensureAdminTables();
  const { rows } = await pool.query<AdminUser>(
    `SELECT u.id, u.email, u.name, u.role, u.active
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.admin_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.active = TRUE`,
    [sha256(token)],
  );
  return rows[0] ?? null;
}

/** Exige sessão de admin válida; coloca o usuário em res.locals.admin. */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const admin = await loadAdminFromRequest(req);
    if (!admin) return res.status(401).json({ error: "unauthorized" });
    res.locals.admin = admin;
    return next();
  } catch (err) {
    console.error("[admin] auth error:", err);
    res.status(500).json({ error: "auth_failed" });
  }
}

/** Só "owner" — usado no gerenciamento de usuários admin. */
export function requireOwner(_req: Request, res: Response, next: NextFunction) {
  const admin = res.locals.admin as AdminUser | undefined;
  if (admin?.role !== "owner") {
    return res.status(403).json({ error: "forbidden" });
  }
  return next();
}

// ---------- freio de tentativas de login ----------

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;

export function loginBlocked(key: string): boolean {
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < Date.now()) return false;
  return entry.count >= MAX_LOGIN_ATTEMPTS;
}

export function registerLoginFailure(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearLoginFailures(key: string) {
  loginAttempts.delete(key);
}
