import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function PrivacidadePage() {
  return (
    <div className="min-h-[100dvh] bg-background px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Kordi
        </Link>

        <h1 className="font-display text-3xl font-bold text-white mb-2">
          Política de Privacidade
        </h1>
        <p className="text-white/50 text-sm mb-8">
          Última atualização: 8 de julho de 2026
        </p>

        <div className="space-y-8 text-white/75 leading-relaxed text-[15px]">
          <section>
            <h2 className="text-white font-semibold text-lg mb-2">1. Quem somos</h2>
            <p>
              O Kordi (kordi.app.br) é um aplicativo de ferramentas musicais
              para tecladistas e pianistas: dicionário de acordes, cifras
              inteligentes, análise de áudio, metrônomo, pads e modo de estudo.
              Esta política explica quais dados tratamos e por quê.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">2. Dados que coletamos</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white">Conta e login:</strong> nome e
                e-mail, gerenciados pelo nosso provedor de autenticação
                (Clerk). Usamos esses dados apenas para identificar sua conta e
                liberar o acesso.
              </li>
              <li>
                <strong className="text-white">Pagamentos:</strong> processados
                pela Stripe (assinaturas) ou pela Hotmart (compras antigas).
                Não armazenamos números de cartão — recebemos apenas a
                confirmação do pagamento e o e-mail associado.
              </li>
              <li>
                <strong className="text-white">Áudio:</strong> quando você usa
                recursos de análise de música ou gravação, o áudio é enviado
                aos nossos servidores somente para processamento (por exemplo,
                detecção de acordes ou separação de instrumentos) e é
                descartado após gerar o resultado. Não usamos seu áudio para
                nenhuma outra finalidade.
              </li>
              <li>
                <strong className="text-white">Preferências de uso:</strong>{" "}
                favoritos e configurações ficam salvos no seu próprio
                dispositivo (armazenamento local do navegador/app).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">3. O que NÃO fazemos</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Não vendemos nem compartilhamos seus dados com terceiros para publicidade.</li>
              <li>Não exibimos anúncios.</li>
              <li>Não coletamos localização, contatos ou arquivos do seu dispositivo.</li>
              <li>Não guardamos gravações de áudio depois do processamento.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">4. Serviços de terceiros</h2>
            <p>
              Usamos provedores que tratam dados em nosso nome, cada um com sua
              própria política de privacidade: Clerk (autenticação), Stripe
              (pagamentos), Hotmart (compras antigas) e serviços de
              processamento de áudio e inteligência artificial usados apenas
              para gerar os resultados que você solicita dentro do app.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">5. Seus direitos (LGPD)</h2>
            <p>
              Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você
              pode solicitar acesso, correção ou exclusão dos seus dados a
              qualquer momento. Para excluir sua conta e os dados associados,
              entre em contato pelo e-mail abaixo.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">6. Contato</h2>
            <p>
              Dúvidas ou solicitações sobre privacidade:{" "}
              <a
                href="mailto:contato@kordi.app.br"
                className="text-primary hover:underline"
              >
                contato@kordi.app.br
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">7. Alterações</h2>
            <p>
              Podemos atualizar esta política para refletir melhorias do app.
              A data da última atualização aparece no topo desta página.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
