import OpenAI from "openai";

// Cliente OpenAI apontando para o proxy gerenciado pelo Replit (AI Integrations).
// As variáveis de ambiente são provisionadas automaticamente — não precisamos de
// chave própria. Quando não estiverem configuradas, `getOpenAI()` retorna null e
// o chamador trata a indisponibilidade (status honesto na UI).

let cached: OpenAI | null | undefined;

export function isOpenAIConfigured(): boolean {
  return Boolean(
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  );
}

export function getOpenAI(): OpenAI | null {
  if (cached !== undefined) return cached;
  if (!isOpenAIConfigured()) {
    cached = null;
    return cached;
  }
  cached = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  return cached;
}
