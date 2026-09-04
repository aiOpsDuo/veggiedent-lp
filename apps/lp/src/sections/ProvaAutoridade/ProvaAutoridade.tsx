import { useRef } from "react";
import { ClaimIpsosBR } from "./components/ClaimIpsosBR";
import { ClaimsInfographic } from "./components/ClaimsInfographic";
import { RichText } from "../../components/ui/RichText";
import { SectionShell } from "../../components/ui/SectionShell";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { gsap, useGSAP } from "../../lib/gsap";
import { connectSection } from "../../content/connect-section";
import type { SectionContent } from "../../content/published-content";

export const ProvaAutoridade = connectSection("prova_autoridade", ProvaAutoridadeSecao);

/**
 * A quebra do título vale só a partir de `lg`, como antes de o título vir do
 * CMS: em tela estreita ele flui em uma linha só. O espaço ao lado existe
 * porque, com a quebra escondida, as duas palavras encostariam uma na outra.
 */
const QUEBRA_SO_NO_DESKTOP = (
  <>
    <span className="lg:hidden">{" "}</span>
    <br className="hidden lg:block" />
  </>
);

function ProvaAutoridadeSecao({ content }: { content: SectionContent<"prova_autoridade"> }) {
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reducedMotion) return;

      // Create responsive motion limits via gsap.matchMedia
      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: "(min-width: 1024px)",
          isMobile: "(max-width: 1023px)",
        },
        (context) => {
          const { isDesktop } = context.conditions as { isDesktop: boolean };
          const yOffset = isDesktop ? 30 : 15;

          gsap.from([".badge-el", ".title-el", ".claim-el", ".kit-image-el"], {
            opacity: 0,
            y: yOffset,
            duration: 0.6,
            stagger: 0.08,
            ease: "power2.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%",
              once: true,
            },
          });
        },
      );
    },
    { scope: sectionRef },
  );

  return (
    <div
      ref={sectionRef}
      className="relative overflow-hidden bg-surface-canvas border-t border-black/5"
    >
      {/* Soft background glow spots for visual depth */}
      <div className="absolute right-0 top-1/3 -translate-y-1/2 w-[40%] h-[500px] bg-brand-primary/[0.02] rounded-full blur-3xl pointer-events-none select-none" />
      <div className="absolute left-[10%] bottom-1/4 translate-y-1/2 w-[35%] h-[400px] bg-claim-gold/[0.015] rounded-full blur-3xl pointer-events-none select-none" />

      <SectionShell
        id="prova-autoridade"
        aria-labelledby="prova-autoridade-heading"
        className="!py-16 lg:!py-24"
      >
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 lg:items-stretch">
          {/* Left Column (approximately 64% width on desktop) */}
          <div className="lg:w-[64%] flex flex-col justify-center">
            <div>
              {/* Badge */}
              <span className="badge-el text-[11px] font-bold tracking-widest text-brand-primary-hover uppercase">
                A CONFIANÇA DE QUEM ENTENDE
              </span>

              {/* Título */}
              <h2
                id="prova-autoridade-heading"
                className="title-el text-2xl sm:text-3xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-bold leading-tight text-ink-900 mt-2 tracking-tight"
              >
                <RichText
                  html={content.heading}
                  emphasisClassName="text-brand-primary-hover font-extrabold"
                  lineBreak={QUEBRA_SO_NO_DESKTOP}
                />
              </h2>

              {/* Claim Text */}
              <div className="claim-el mt-3">
                <ClaimIpsosBR />
              </div>
            </div>

            {/* Kit de Imagens (Loaded once, scaled to 85% width, aligned to bottom) */}
            <div className="kit-image-el relative mt-4 w-full">
              <img
                src={content.kit}
                alt={content.kitAlt}
                className="block h-auto w-[85%] mx-auto lg:mx-0 max-w-none object-contain object-left-bottom"
              />
            </div>
          </div>

          {/* Right Column (approximately 36% width on desktop) */}
          <div className="lg:w-[36%] lg:mt-16 w-full">
            <ClaimsInfographic stats={content.stats} />
          </div>
        </div>

        {/* Unified Source Reference at the bottom */}
        <div className="mt-6 border-t border-black/5 pt-3 w-full">
          <p className="text-xs leading-relaxed text-ink-400 max-w-[85ch]">
            {content.source}
          </p>
        </div>
      </SectionShell>
    </div>
  );
}
