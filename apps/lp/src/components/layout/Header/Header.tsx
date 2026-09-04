import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { MobileMenu } from "./components/MobileMenu";
import { Button } from "../../ui/Button";
import { useTracking } from "../../../hooks/useTracking";

// Header/Sticky — Design System v1.2, secao 9.1.
//
// O cabecalho saiu do CMS (decisao do usuario, 2026-09-04): logo, links de
// navegacao, rotulos de botao e textos de acessibilidade agora sao fixos em
// codigo, com exatamente os valores que estavam publicados no painel no
// momento da remocao — nada foi reescrito.
const LOGO_SRC =
  "https://wkcioegorxdvqtrzapem.supabase.co/storage/v1/object/public/veggiedent-images/9f38e6e3-765f-453f-bf8f-dfa9435b42d2/veggiedent-fresh-edc-logo.svg";
const LOGO_ALT = "Veggiedent, por Virbac";
const CTA_DESKTOP_LABEL = "Baixar o guia de cuidados diários";
const CTA_MOBILE_LABEL = "Baixar o guia de cuidados diários";
const MAIN_NAV_ARIA_LABEL = "Menu principal";
const MENU_BUTTON_ARIA_LABEL = "Abrir menu";

const NAV_LINKS = [
  { href: "#educacao", label: "Saúde oral" },
  { href: "#rotina", label: "Rotina de cuidado" },
  { href: "#produto", label: "Produto" },
  { href: "#onde-comprar", label: "Onde comprar" },
  { href: "#faq", label: "Perguntas frequentes" },
] as const;

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { track } = useTracking();

  // Scroll listener throttlado por requestAnimationFrame — evita rodar o
  // handler em toda pixel de scroll (auditoria v1.0, item 13/15).
  useEffect(() => {
    let rafId: number | null = null;

    function updateScrolled() {
      setIsScrolled(window.scrollY > 0);
      rafId = null;
    }

    function handleScroll() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(updateScrolled);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  function handleCtaClick(location: string) {
    track("cta_click", {
      cta_label: CTA_DESKTOP_LABEL,
      cta_location: location,
    });
  }

  return (
    <header
      className={`sticky top-0 z-40 bg-surface-canvas transition-shadow duration-150 ${
        isScrolled ? "shadow-sm" : ""
      }`}
    >
      <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <a href="#main-content" className="flex items-center gap-2">
          <img src={LOGO_SRC} alt={LOGO_ALT} className="h-10 w-auto" />
        </a>

        <nav
          aria-label={MAIN_NAV_ARIA_LABEL}
          className="hidden items-center gap-6 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-700 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button
            href="#formulario"
            variant="primary"
            onClick={() => handleCtaClick("header")}
          >
            {CTA_DESKTOP_LABEL}
          </Button>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <a
            href="#formulario"
            onClick={() => handleCtaClick("header_mobile")}
            className="inline-flex h-11 items-center justify-center rounded-md bg-brand-primary px-3 text-sm font-semibold text-ink-900"
          >
            {CTA_MOBILE_LABEL}
          </a>
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={MENU_BUTTON_ARIA_LABEL}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <div className="relative md:hidden">
        <MobileMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          navLinks={NAV_LINKS}
          ctaLabel={CTA_MOBILE_LABEL}
          triggerRef={menuButtonRef}
        />
      </div>
    </header>
  );
}
