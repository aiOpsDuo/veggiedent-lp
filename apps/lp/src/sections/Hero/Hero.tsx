import { useRef } from "react";
import { Button } from "../../components/ui/Button";
import { useTracking } from "../../hooks/useTracking";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { gsap, useGSAP } from "../../lib/gsap";
import { connectSection } from "../../content/connect-section";
import type { SectionContent } from "../../content/published-content";
import grupoBandeiras from "../../assets/images/hero/grupo-bandeiras.png";

// Hero/Primary — Design System v1.2, secao 9.2.
// Imagem de fundo e o maior contribuinte de LCP: sem lazy loading, fetchpriority alto
// (Especificacao Funcional, secao 12.2).
// A imagem de fundo (KV veterinaria + cachorro, selo N.1 e logo Virbac ja
// embutidos na peca) vem do CMS e e usada como background full-bleed da secao,
// conforme diretriz de marca: nao usar bloco de cor solido.
//
// A faixa de bandeiras continua importada do codigo, por decisao registrada do
// usuario (PLAN, "Decisoes registradas de escopo — o que NAO entra no CMS").
export const Hero = connectSection("hero", HeroBanner);

function HeroBanner({ content }: { content: SectionContent<"hero"> }) {
  const { track } = useTracking();
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (reducedMotion) return;

      const tl = gsap.timeline();

      // Background image fade and scale
      tl.from(".bg-image-el", {
        opacity: 0.6,
        scale: 0.96,
        x: 12,
        duration: 0.8,
        ease: "power2.out",
      });

      // Content stagger animation
      tl.from(
        [".overline-el", ".title-el", ".subtitle-el", ".cta-el"],
        {
          opacity: 0,
          y: 24,
          duration: 0.6,
          stagger: 0.08,
          ease: "power3.out",
        },
        "-=0.6",
      );
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      id="hero"
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[560px] items-end overflow-hidden sm:min-h-[640px] md:min-h-[720px]"
    >
      <img
        src={content.image}
        alt={content.imageAlt}
        fetchPriority="high"
        className="bg-image-el absolute inset-0 -z-10 h-full w-full object-cover object-[65%_center] 3xl:object-[65%_center]"
      />
      {/* Overlay em gradiente — garante contraste AA do texto sobre a foto oficial */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/65 via-black/20 to-transparent"
      />

      <div className="mx-auto w-full max-w-content px-4 pb-10 pt-24 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] sm:px-8 sm:pb-14 md:pb-20">
        <p className="overline-el text-sm font-semibold uppercase tracking-wide text-white/90">
          {content.overline}
        </p>
        <h1
          id="hero-heading"
          className="title-el mt-3 max-w-[27ch] text-[32px] font-bold leading-[1.15] text-white sm:text-[48px] md:text-[56px]"
        >
          {content.headline}
        </h1>
        {/* Destaque da pesquisa */}
        <div className="research-el max-w-[60ch] text-white">
          <p className="text-base font-bold sm:text-lg">Pesquisa Ipsos 2026</p>

          <p className="mt-1 text-base font-semibold sm:text-lg">
            A marca N.1 no Brasil, EUA e Europa
          </p>
          {/* Bandeiras */}
          <img
            src={grupoBandeiras}
            alt="Brasil, Estados Unidos e Europa"
            className="flags-el mt-1 h-auto w-full max-w-[100px] object-contain"
          />
        </div>

        <p className="subtitle-el mt-4 max-w-[60ch] text-lg text-white/90">
          {content.subheadline}
        </p>

        <div className="cta-el mt-6 flex flex-wrap items-center gap-4">
          <Button
            href="#formulario"
            variant="primary"
            onClick={() =>
              track("cta_click", {
                cta_label: content.ctaPrimaryLabel,
                cta_location: "hero_primary",
              })
            }
          >
            {content.ctaPrimaryLabel}
          </Button>
          <Button
            href="#rotina"
            variant="link"
            onClick={() =>
              track("cta_click", {
                cta_label: content.ctaSecondaryLabel,
                cta_location: "hero_secondary",
              })
            }
          >
            {content.ctaSecondaryLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
