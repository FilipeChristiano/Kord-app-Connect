import { clerkClient } from "@clerk/express";

/**
 * Retorna o e-mail VERIFICADO do usuário logado (Clerk), normalizado.
 *
 * Regra de segurança: o acesso ao app é liberado casando o e-mail da conta
 * com o e-mail da compra na Stripe. Por isso, só aceitamos endereços cuja
 * posse foi comprovada (verification.status === "verified") — login com
 * Google já vem verificado; e-mail/senha exige o código de confirmação.
 * Um endereço apenas cadastrado (não verificado) NUNCA conta.
 */
export async function getVerifiedEmail(userId: string): Promise<string | null> {
  const user = await clerkClient.users.getUser(userId);

  // Regra estrita: só o e-mail PRINCIPAL da conta, e só se verificado.
  // Nada de cair para "algum outro e-mail verificado" — falha fechado.
  const primary = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  );
  if (!primary || primary.verification?.status !== "verified") return null;

  return primary.emailAddress.trim().toLowerCase();
}
