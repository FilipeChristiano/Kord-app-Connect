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

/**
 * Detecta se o app está rodando como app Android instalado da Play Store
 * (Trusted Web Activity). Nesse caso, a política da loja proíbe botão ou
 * link de compra dentro do app — mostramos apenas orientação em texto.
 *
 * Sinal usado: referrer "android-app://..." (presente na 1ª navegação vinda
 * do TWA) — persistido em sessionStorage (escopo da SESSÃO/aba atual, para
 * sobreviver a recarregamentos dentro do app sem "contaminar" visitas
 * futuras pelo navegador comum, que têm sessionStorage próprio).
 *
 * IMPORTANTE: não usar "modo standalone + Android" como fallback — isso
 * pegava por engano o PWA instalado pelo navegador (fora da loja), que PODE
 * e DEVE mostrar o botão de assinatura. A política da Play Store só vale
 * para o app distribuído pela loja, que sempre chega com o referrer
 * android-app:// na primeira navegação.
 */
export function isAndroidTwa(): boolean {
  try {
    if (document.referrer.startsWith("android-app://")) {
      sessionStorage.setItem("kordi-twa", "1");
      return true;
    }
    return sessionStorage.getItem("kordi-twa") === "1";
  } catch {
    // sessionStorage indisponível — trata como navegador comum
    return false;
  }
}
