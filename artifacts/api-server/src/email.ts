// Envio de e-mails transacionais via Resend (integração Replit "resend").
// A chave de API fica no cofre de conectores — o SDK cuida da autenticação.
import { ReplitConnectors } from "@replit/connectors-sdk";
import { pool } from "./db";

const FROM_ADDRESS = "Kordi <contato@kordi.app.br>";

const BRAND_PURPLE = "#9673FF";
const BRAND_DARK = "#070A12";

export function welcomeHtml(firstName: string | null, email: string): string {
  const greeting = firstName ? `Olá, ${firstName}!` : "Olá!";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:${BRAND_DARK};padding:28px 32px;">
            <img src="https://kordi.app.br/email-logo.png" alt="Kordi" width="160" style="display:block;width:160px;height:auto;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:22px;color:#111827;">${greeting} Bem-vindo ao Kordi 🎹</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
              Sua assinatura está ativa! Siga os passos abaixo para acessar sua conta:
            </p>
            <h2 style="margin:0 0 12px;font-size:16px;color:#111827;">Como acessar sua conta</h2>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f9fafb;border-radius:12px;">
              <tr><td style="padding:18px 20px;">
                <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#374151;">
                  <strong>1.</strong> Toque no botão abaixo (ou acesse <a href="https://kordi.app.br/sign-in" style="color:${BRAND_PURPLE};">kordi.app.br/sign-in</a>)
                </p>
                <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#374151;">
                  <strong>2.</strong> Toque em <strong>"Criar conta"</strong> se for seu primeiro acesso — ou faça login se já tiver conta
                </p>
                <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#374151;">
                  <strong>3.</strong> Use <u>este mesmo e-mail</u> (<strong>${email}</strong>) — é ele que libera o seu acesso
                </p>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#374151;">
                  <strong>4.</strong> Pronto! Todas as ferramentas estarão liberadas
                </p>
              </td></tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr><td style="border-radius:10px;background:${BRAND_PURPLE};">
                <a href="https://kordi.app.br/sign-in" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Acessar o Kordi</a>
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
              Dica: no celular, você pode adicionar o Kordi à tela inicial e usar como aplicativo.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Você recebeu este e-mail porque assinou o Kordi. Dúvidas? É só responder esta mensagem.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function ensureWelcomeTable(): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS welcome_emails (
       email TEXT PRIMARY KEY,
       sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );
}

/**
 * Envia o e-mail de boas-vindas UMA única vez por endereço (webhooks da
 * Stripe podem ser reenviados; a tabela welcome_emails serve de trava).
 * Falha de envio nunca derruba o processamento do webhook — só loga.
 */
export async function sendWelcomeEmail(params: {
  email: string;
  name?: string | null;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();

  try {
    await ensureWelcomeTable();
    const { rowCount } = await pool.query(
      "INSERT INTO welcome_emails (email) VALUES ($1) ON CONFLICT (email) DO NOTHING",
      [email],
    );
    if (rowCount === 0) {
      console.log(`[email] welcome já enviado para ${email} — pulando`);
      return;
    }

    const firstName = params.name?.trim().split(/\s+/)[0] || null;
    const connectors = new ReplitConnectors();
    const resp = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [email],
        subject: "Bem-vindo ao Kordi — seu acesso está liberado 🎹",
        html: welcomeHtml(firstName, email),
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      // Libera a trava para tentar de novo num próximo evento
      await pool.query("DELETE FROM welcome_emails WHERE email = $1", [email]);
      console.error(`[email] falha ao enviar boas-vindas para ${email}: ${resp.status} ${detail}`);
      return;
    }

    console.log(`[email] boas-vindas enviado para ${email}`);
  } catch (err) {
    console.error("[email] erro ao enviar boas-vindas:", err);
    // Melhor esforço: remove a trava para permitir nova tentativa
    try {
      await pool.query("DELETE FROM welcome_emails WHERE email = $1", [email]);
    } catch {
      /* ignore */
    }
  }
}
