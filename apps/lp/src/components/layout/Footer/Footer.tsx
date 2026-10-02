import { PRIVACY_POLICY_URL } from "@veggiedent/content-schema";
import logo from "../../../assets/logos/veggiedent-fresh-edc-logo.svg";

// Footer/Legal — Design System v1.2, secao 9.13.
//
// O rodape saiu do CMS (decisao do usuario, 2026-09-04, mesmo tratamento do
// Header na T28): links institucionais, fonte da pesquisa, aviso de especie
// e copyright agora sao fixos em codigo, com exatamente os valores que
// estavam publicados no painel no momento da remocao — nada foi reescrito.
// `legalData` (CNPJ e demais dados legais da Virbac Brasil) nunca foi
// preenchido no CMS — segue pendente, sem nada renderizado em seu lugar,
// igual ao estado de hoje (ver README, "Pendencias herdadas").
//
// O logo saiu do CMS por completo (decisao do usuario, 2026-09-08): e ativo
// de marca que nunca muda, mesmo tratamento das bandeiras do Hero e dos 3
// SVGs da Prova de Autoridade (ver agent_context/CHANGELOG.md). Ate aqui ele
// ficava fixo como uma URL do Supabase (o valor publicado no momento da
// remocao do rodape) — agora e arquivo local, importado pelo bundler.
const LOGO_ALT = "Veggiedent®, por Virbac";
const SPECIES_DISCLAIMER = "Produto indicado exclusivamente para cães.";
const COPYRIGHT = "© 2026 Virbac. Todos os direitos reservados.";

// Links institucionais: paginas do site da Virbac Brasil, abertas em nova aba
// (2026-10-02). Ate aqui apontavam para /politica-de-privacidade,
// /termos-de-uso e /fale-conosco, rotas que esta LP nunca teve — o clique caia
// de volta na propria pagina. "Termos de uso" leva ao mesmo aviso legal da
// politica de privacidade porque o site da Virbac nao tem pagina de termos
// separada; a politica vem de PRIVACY_POLICY_URL, a mesma constante do aceite
// do formulario e do registro do consentimento na API.
const TERMS_OF_USE_URL = "https://br.virbac.com/home/legal-notice.html";
const CONTACT_URL = "https://br.virbac.com/contato";

const LEGAL_LINKS = [
  { href: PRIVACY_POLICY_URL, label: "Política de privacidade" },
  { href: TERMS_OF_USE_URL, label: "Termos de uso" },
  { href: CONTACT_URL, label: "Fale conosco" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-surface-section-alt">
      <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-12 sm:px-8 sm:flex-row sm:items-start sm:justify-between">
        <img src={logo} alt={LOGO_ALT} className="h-12 w-auto" />

        <nav
          aria-label="Links institucionais"
          className="flex flex-col gap-2 sm:flex-row sm:gap-6"
        >
          {LEGAL_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-ink-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
            >
              {link.label}
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-content px-4 pb-8 sm:px-8">
        <p className="mt-3 text-xs font-medium text-ink-700">{SPECIES_DISCLAIMER}</p>
        <p className="mt-4 text-xs text-ink-400">{COPYRIGHT}</p>

        <div className="mt-6 max-w-[80ch] border-t border-black/5 pt-4">
          <p className="break-words text-[11px] leading-[1.4] text-ink-400">
            Fonte: <em>Pesquisa Ipsos 2026.</em> Realizada com 1,116
            veterinários, base de dados Virbac. Acesse:{" "}
            <a
              href="https://br.virbac.com/home/veggie.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-ink-700"
            >
              https://br.virbac.com/home/veggie.html
            </a>
          </p>

          <p className="mt-2 text-[11px] leading-[1.4] text-ink-400">
            1. EUA: Marca no 1 escolhida por veterinários de acordo com o
            levantamento de principais produtos veterinários da DVM360 (Dados em
            arquivo).
          </p>

          <p className="mt-2 text-[11px] leading-[1.4] text-ink-400">
            2. Europa: Marca mais recomendada por veterinários nos 5 maiores
            mercados europeus (Estudo Omnibus Biosat sobre produtos dentais,
            Maio de 2025).
          </p>
        </div>
      </div>
    </footer>
  );
}
