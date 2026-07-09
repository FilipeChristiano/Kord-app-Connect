/**
 * Detecção do wrapper nativo iOS (Capacitor, App Store).
 *
 * Sinais (qualquer um basta):
 * 1. marcador "KordiApp-iOS" no user agent, adicionado pelo wrapper
 *    (capacitor.config.ts → ios.appendUserAgent);
 * 2. bridge nativa do Capacitor injetada na página reportando plataforma
 *    "ios" — cobre o caso de o marcador de UA se perder em alguma
 *    atualização futura do WebView.
 *
 * Usado para o "modo App Store": dentro do app iOS o site não pode mostrar
 * preço, botão/link de compra nem orientar o usuário a assinar fora do app
 * (regra 3.1.1 da Apple, mais rígida que a do Google Play).
 */
export function isIosApp(): boolean {
  if (navigator.userAgent.includes("KordiApp-iOS")) {
    return true;
  }
  try {
    const cap = (window as { Capacitor?: { getPlatform?: () => string } })
      .Capacitor;
    return cap?.getPlatform?.() === "ios";
  } catch {
    return false;
  }
}
