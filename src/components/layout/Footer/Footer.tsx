import { footerContent } from "./Footer.content";
import veggiedentLogo from "../../../assets/logos/veggiedent-fresh-edc-logo.svg";

// Footer/Legal — Design System v1.2, secao 9.13.
// Todo texto vem de Footer.content.ts (Especificacao Funcional, secao 6.12).
// Logo importado como modulo ES, igual ao Header.
export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-surface-section-alt">
      <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-12 sm:px-8 sm:flex-row sm:items-start sm:justify-between">
        <img
          src={veggiedentLogo}
          alt={footerContent.logoAlt}
          className="h-12 w-auto"
        />

        <nav
          aria-label="Links institucionais"
          className="flex flex-col gap-2 sm:flex-row sm:gap-6"
        >
          {footerContent.links.map((link) => (
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
        <p className="max-w-[70ch] text-xs leading-relaxed text-ink-400">
          {footerContent.claimSource}
        </p>
        <p className="mt-3 text-xs font-medium text-ink-700">
          {footerContent.speciesDisclaimer}
        </p>

        {footerContent.legalDataPlaceholder && (
          <p className="mt-1 text-xs text-ink-400">
            {footerContent.legalDataPlaceholder}
          </p>
        )}

        <p className="mt-4 text-xs text-ink-400">{footerContent.copyright}</p>
      </div>
    </footer>
  );
}
