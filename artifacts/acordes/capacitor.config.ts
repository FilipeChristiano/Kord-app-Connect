import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuração do wrapper nativo iOS (Capacitor).
 *
 * O app iOS carrega o site publicado (kordi.app.br) dentro de um WebView
 * nativo — o mesmo modelo do app Android (TWA). O "webDir" aponta para o
 * build local só porque o Capacitor exige um diretório; em execução, o
 * conteúdo vem de server.url.
 *
 * appendUserAgent: o site usa esse marcador para detectar que está rodando
 * dentro do app da App Store e esconder qualquer menção a preço/compra
 * (regra 3.1.1 da Apple).
 */
const config: CapacitorConfig = {
  appId: "br.app.kordi",
  appName: "Kordi",
  webDir: "dist/public",
  server: {
    url: "https://kordi.app.br",
    allowNavigation: ["kordi.app.br", "*.kordi.app.br"],
  },
  ios: {
    appendUserAgent: "KordiApp-iOS",
    backgroundColor: "#080B12",
    contentInset: "automatic",
  },
};

export default config;
