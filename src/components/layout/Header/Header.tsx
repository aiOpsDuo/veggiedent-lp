import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { headerContent } from "./Header.content";
import { MobileMenu } from "./components/MobileMenu";
import { Button } from "../../ui/Button";
import { useTracking } from "../../../hooks/useTracking";
import veggiedentLogo from "../../../assets/logos/veggiedent-fresh-edc-logo.svg";

// Header/Sticky — Design System v1.2, secao 9.1.
// Todo texto vem de Header.content.ts (Especificacao Funcional, secao 6.1).
// Logo importado como modulo ES (Vite processa e copia para dist/assets com
// hash) — nao referenciado por string de caminho solto.
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
      cta_label: headerContent.ctaDesktopLabel,
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
          <img
            src={veggiedentLogo}
            alt={headerContent.logoAlt}
            className="h-10 w-auto"
          />
        </a>

        <nav
          aria-label={headerContent.mainNavAriaLabel}
          className="hidden items-center gap-6 md:flex"
        >
          {headerContent.navLinks.map((link) => (
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
            {headerContent.ctaDesktopLabel}
          </Button>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <a
            href="#formulario"
            onClick={() => handleCtaClick("header_mobile")}
            className="inline-flex h-11 items-center justify-center rounded-md bg-brand-primary px-3 text-sm font-semibold text-ink-900"
          >
            {headerContent.ctaMobileLabel}
          </a>
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={headerContent.menuButtonAriaLabel}
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
          navLinks={headerContent.navLinks}
          ctaLabel={headerContent.ctaMobileLabel}
          triggerRef={menuButtonRef}
        />
      </div>
    </header>
  );
}
