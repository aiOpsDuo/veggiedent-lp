// Footer/Legal — Design System v1.2, secao 9.13.
//
// O rodape saiu do CMS (decisao do usuario, 2026-09-04, mesmo tratamento do
// Header na T28): logo, links institucionais, fonte da pesquisa, aviso de
// especie e copyright agora sao fixos em codigo, com exatamente os valores
// que estavam publicados no painel no momento da remocao — nada foi
// reescrito. `legalData` (CNPJ e demais dados legais da Virbac Brasil) nunca
// foi preenchido no CMS — segue pendente, sem nada renderizado em seu lugar,
// igual ao estado de hoje (ver README, "Pendencias herdadas").
const LOGO_SRC =
  "https://wkcioegorxdvqtrzapem.supabase.co/storage/v1/object/public/veggiedent-images/9f38e6e3-765f-453f-bf8f-dfa9435b42d2/veggiedent-fresh-edc-logo.svg";
const LOGO_ALT = "Veggiedent, por Virbac";
const CLAIM_SOURCE =
  "*Pesquisa IPSOS 2026. Fonte: Pesquisa Ipsos 2026. Realizada com 1.116 veterinários, base de dados Virbac. Acesse: https://br.virbac.com/home/veggie.html";
const SPECIES_DISCLAIMER = "Produto indicado exclusivamente para cães.";
const COPYRIGHT = "© 2026 Virbac. Todos os direitos reservados.";

const LEGAL_LINKS = [
  { href: "/politica-de-privacidade", label: "Política de privacidade" },
  { href: "/termos-de-uso", label: "Termos de uso" },
  { href: "/fale-conosco", label: "Fale conosco" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-surface-section-alt">
      <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-12 sm:px-8 sm:flex-row sm:items-start sm:justify-between">
        <img src={LOGO_SRC} alt={LOGO_ALT} className="h-12 w-auto" />

        <nav
          aria-label="Links institucionais"
          className="flex flex-col gap-2 sm:flex-row sm:gap-6"
        >
          {LEGAL_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-ink-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-content px-4 pb-8 sm:px-8">
        <p className="max-w-[70ch] text-xs leading-relaxed text-ink-400">{CLAIM_SOURCE}</p>
        <p className="mt-3 text-xs font-medium text-ink-700">{SPECIES_DISCLAIMER}</p>
        <p className="mt-4 text-xs text-ink-400">{COPYRIGHT}</p>
      </div>
    </footer>
  );
}
