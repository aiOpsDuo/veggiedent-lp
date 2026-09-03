import { connectSection } from "../../../content/connect-section";
import type { SectionContent } from "../../../content/published-content";

// Footer/Legal — Design System v1.2, secao 9.13.
// Todo texto e o logo vem de GET /api/content (SDD, C-10).
export const Footer = connectSection("footer", FooterLegal);

function FooterLegal({ content }: { content: SectionContent<"footer"> }) {
  return (
    <footer className="border-t border-black/5 bg-surface-section-alt">
      <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-12 sm:px-8 sm:flex-row sm:items-start sm:justify-between">
        <img
          src={content.logo}
          alt={content.logoAlt}
          className="h-12 w-auto"
        />

        <nav
          aria-label="Links institucionais"
          className="flex flex-col gap-2 sm:flex-row sm:gap-6"
        >
          {content.links.map((link) => (
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
          {content.claimSource}
        </p>
        <p className="mt-3 text-xs font-medium text-ink-700">
          {content.speciesDisclaimer}
        </p>

        {content.legalData && (
          <p className="mt-1 text-xs text-ink-400">{content.legalData}</p>
        )}

        <p className="mt-4 text-xs text-ink-400">{content.copyright}</p>
      </div>
    </footer>
  );
}
