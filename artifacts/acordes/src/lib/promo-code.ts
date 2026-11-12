/**
 * Guarda temporariamente o código promocional digitado no cadastro, para ser
 * resgatado automaticamente assim que a conta estiver criada e verificada.
 * Tudo em try/catch: o storage pode estar indisponível (modo privado etc.).
 */
const KEY = "kordi-promo-code";

export function getStoredPromoCode(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredPromoCode(code: string): void {
  try {
    const clean = code.trim();
    if (clean) localStorage.setItem(KEY, clean);
    else localStorage.removeItem(KEY);
  } catch {
    /* sem storage: o usuário digita o código na próxima tela */
  }
}

export function clearStoredPromoCode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
