import { pool } from "./db";

/**
 * Configurações do app editáveis pelo painel /admin (sem rebuild/redeploy).
 * Guardadas na tabela app_settings; os valores padrão vêm das variáveis de
 * ambiente (STEMS_*) ou dos defaults abaixo. Lidas de forma SÍNCRONA a partir de
 * um cache em memória (atualizado ao salvar e a cada 60 s).
 */

export interface AppSettings {
  // Limites da separação de máxima qualidade (Demucs em CPU)
  stemsMaxConcurrent: number; // separações ao mesmo tempo
  stemsMaxQueue: number; // quantas podem esperar na fila
  stemsThreads: number; // threads de CPU por separação
  stemsMaxSeconds: number; // duração máxima da música (0 = sem limite)
  stemsDailyLimit: number; // separações novas por usuário / 24 h (0 = sem limite)
  stemsAvgMinutes: number; // duração média estimada de 1 separação (até haver dados reais)
  // Mensagens mostradas ao usuário. Marcadores: {espera} (minutos até tentar de
  // novo), {limite} (cota diária), {horas} (até a cota zerar), {minutos} (duração máx.).
  msgBusy: string;
  msgLimit: string;
  msgTooLong: string;
}

function envNum(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : fallback;
}

export const DEFAULT_SETTINGS: AppSettings = {
  stemsMaxConcurrent: envNum("STEMS_MAX_CONCURRENT", 1),
  stemsMaxQueue: envNum("STEMS_MAX_QUEUE", 3),
  stemsThreads: envNum("STEMS_THREADS", 1),
  stemsMaxSeconds: envNum("STEMS_MAX_SECONDS", 360),
  stemsDailyLimit: envNum("STEMS_DAILY_LIMIT", 5),
  stemsAvgMinutes: envNum("STEMS_AVG_MINUTES", 8),
  msgBusy:
    "O servidor está ocupado separando outras músicas. Aguarde e tente novamente em cerca de {espera} minutos — ou use a mesa de mistura rápida agora.",
  msgLimit:
    "Você atingiu o limite de {limite} separações de máxima qualidade por dia. Tente novamente em cerca de {horas} h ou use a mesa de mistura rápida.",
  msgTooLong:
    "Música longa demais para a máxima qualidade (máx. {minutos} min). Use a mesa de mistura rápida.",
};

// Faixas aceitas (validação do painel). `int` = inteiro; texto limitado a 300.
const NUMERIC_RULES: Record<
  Exclude<keyof AppSettings, "msgBusy" | "msgLimit" | "msgTooLong">,
  { min: number; max: number }
> = {
  stemsMaxConcurrent: { min: 1, max: 4 },
  stemsMaxQueue: { min: 0, max: 20 },
  stemsThreads: { min: 1, max: 4 },
  stemsMaxSeconds: { min: 0, max: 1800 },
  stemsDailyLimit: { min: 0, max: 1000 },
  stemsAvgMinutes: { min: 1, max: 60 },
};
const TEXT_KEYS = ["msgBusy", "msgLimit", "msgTooLong"] as const;

let current: AppSettings = { ...DEFAULT_SETTINGS };
let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS app_settings (
           key TEXT PRIMARY KEY,
           value JSONB NOT NULL,
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           updated_by TEXT
         )`,
      )
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

/** Valores válidos de `input` (ignora o que não existe); lança se for inválido. */
export function sanitizeSettings(input: Record<string, unknown>): Partial<AppSettings> {
  const out: Partial<AppSettings> = {};
  for (const key of Object.keys(NUMERIC_RULES) as Array<keyof typeof NUMERIC_RULES>) {
    if (input[key] === undefined) continue;
    const n = Number(input[key]);
    const { min, max } = NUMERIC_RULES[key];
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new Error(`invalid_${key}`);
    }
    out[key] = n;
  }
  for (const key of TEXT_KEYS) {
    if (input[key] === undefined) continue;
    const v = typeof input[key] === "string" ? (input[key] as string).trim() : "";
    if (v.length === 0 || v.length > 300) throw new Error(`invalid_${key}`);
    out[key] = v;
  }
  return out;
}

export async function loadSettings(): Promise<void> {
  try {
    await ensureTable();
    const { rows } = await pool.query<{ key: string; value: unknown }>(
      "SELECT key, value FROM app_settings",
    );
    const stored: Record<string, unknown> = {};
    for (const r of rows) stored[r.key] = r.value;
    let valid: Partial<AppSettings> = {};
    try {
      valid = sanitizeSettings(stored);
    } catch {
      // Valor corrompido no banco: aplica campo a campo o que for válido.
      for (const [k, v] of Object.entries(stored)) {
        try {
          valid = { ...valid, ...sanitizeSettings({ [k]: v }) };
        } catch {
          /* ignora o campo inválido */
        }
      }
    }
    current = { ...DEFAULT_SETTINGS, ...valid };
  } catch (err) {
    console.error("[settings] falha ao carregar (usando padrões/atuais):", err);
  }
}

/** Configurações vigentes (síncrono, vindo do cache em memória). */
export function getSettings(): AppSettings {
  return current;
}

export async function saveSettings(
  input: Record<string, unknown>,
  updatedBy: string,
): Promise<AppSettings> {
  const valid = sanitizeSettings(input);
  await ensureTable();
  for (const [key, value] of Object.entries(valid)) {
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [key, JSON.stringify(value), updatedBy],
    );
  }
  current = { ...current, ...valid };
  return current;
}

/** Apaga as personalizações e volta aos padrões. */
export async function resetSettings(): Promise<AppSettings> {
  await ensureTable();
  await pool.query("DELETE FROM app_settings");
  current = { ...DEFAULT_SETTINGS };
  return current;
}

/** Substitui {limite} / {minutos} numa mensagem. */
export function fillMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );
}

// Carrega ao subir e atualiza a cada 60 s (caso outro processo altere).
void loadSettings();
setInterval(() => void loadSettings(), 60_000).unref();
