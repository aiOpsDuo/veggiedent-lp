import { useState, useRef } from "react";
import { PawPrint } from "lucide-react";
import type { SectionContent } from "../../../content/published-content";

// Mosaico/CapturaLead — preenche o espaco visual ao lado do formulario com
// fotografia oficial da campanha. E puramente decorativo: o bloco inteiro entra
// com aria-hidden e cada foto com alt vazio, e por isso o esquema do CMS
// cadastra essas imagens como decorativas, sem campo de descricao (CHANGELOG,
// 2026-09-03). Descreve-las anunciaria seis fotos de cachorro no meio de um
// formulario, onde hoje ha silencio proposital.
//
// Layout Responsivo:
// - Mobile (< 640px): Carrossel horizontal interativo (swipe) com dots de paginação,
//   exibindo uma foto de cada vez com a proporção de aspecto ideal (4:3) para evitar cortes ruins.
// - Tablet (640px a 1023px): Bento Grid de 3 colunas, com o bloco do produto estendido no rodapé.
// - Desktop (>= 1024px): Bento Grid assimétrico de 4 colunas re-organizado para maior harmonia:
//   - Linha 1 & 2: os dois primeiros blocos (2x2) lado a lado, dando estabilidade.
//   - Linha 3 & 4: o terceiro (1x2) na esquerda, o quarto (2x2) no centro, o quinto e o sexto (1x1) empilhados na direita.
//
// A **grade** e do codigo, as **fotos** sao do CMS: cada posicao da grade tem
// forma e enquadramento proprios, que sao decisao de design, nao de conteudo.
// O esquema documenta que o layout foi desenhado para seis fotos; com mais que
// isso, as excedentes entram no formato simples de uma celula.
const LAYOUT_DO_MOSAICO = [
  { className: "col-span-2 row-span-2", objectPosition: "center 30%" },
  { className: "col-span-2 row-span-2", objectPosition: "center" },
  { className: "col-span-1 row-span-2 h-full", objectPosition: "center" },
  {
    className:
      "col-span-2 row-span-2 sm:col-span-3 sm:row-span-2 lg:col-span-2 lg:row-span-2",
    objectPosition: "center",
  },
  { className: "col-span-1 row-span-1", objectPosition: "center" },
  { className: "col-span-1 row-span-1", objectPosition: "center" },
] as const;

const LAYOUT_EXCEDENTE = {
  className: "col-span-1 row-span-1",
  objectPosition: "center",
};

interface LeadFormMosaicProps {
  fotos: SectionContent<"captura_lead">["mosaico"];
}

export function LeadFormMosaic({ fotos }: LeadFormMosaicProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tiles = fotos.map((foto, index) => ({
    src: foto.image,
    ...(LAYOUT_DO_MOSAICO[index] ?? LAYOUT_EXCEDENTE),
  }));

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const newIndex = Math.round(scrollLeft / clientWidth);
    setActiveIndex(newIndex);
  };

  const scrollToSlide = (index: number) => {
    if (!scrollRef.current) return;
    const { clientWidth } = scrollRef.current;
    scrollRef.current.scrollTo({
      left: index * clientWidth,
      behavior: "smooth",
    });
    setActiveIndex(index);
  };

  return (
    <div aria-hidden="true" className="relative mt-8 block md:mt-0">
      {/* Mobile Carrossel (visível apenas em telas < sm) */}
      <div className="block sm:hidden mt-5">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-4 pb-4 select-none"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {tiles.map((tile, index) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="mosaic-tile-el w-full min-w-full shrink-0 snap-center overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5 aspect-[4/3]"
            >
              <img
                src={tile.src}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                style={{
                  objectPosition: tile.objectPosition,
                }}
              />
            </div>
          ))}
        </div>

        {/* Indicadores de Paginação (Dots) */}
        <div className="flex justify-center gap-2.5 mt-2">
          {tiles.map((_, index) => (
            <button
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              onClick={() => scrollToSlide(index)}
              className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                activeIndex === index
                  ? "bg-brand-primary scale-110"
                  : "bg-ink-400/35 hover:bg-ink-400/60"
              }`}
              aria-label={`Visualizar imagem ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Grid Bento (visível em telas >= sm) */}
      <div className="hidden sm:grid grid-cols-2 grid-flow-row-dense gap-3 mt-5 sm:grid-cols-3 sm:auto-rows-[90px] lg:grid-cols-4 lg:auto-rows-[115px] xl:auto-rows-[130px]">
        {tiles.map((tile, index) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className={`mosaic-tile-el overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5 ${tile.className}`}
          >
            <img
              src={tile.src}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-105"
              style={{
                objectPosition: tile.objectPosition,
              }}
            />
          </div>
        ))}
      </div>

      {/* Selo flutuante -- quebra a grade e reforca a leitura "rotina de cuidado",
          sobrepondo o canto entre dois blocos (efeito de colagem, nao de grid puro). */}
      <div className="floating-badge-el absolute -left-3 -top-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary shadow-md ring-4 ring-surface-canvas md:-left-4 md:-top-4 md:h-16 md:w-16">
        <PawPrint
          className="h-6 w-6 text-ink-900 md:h-7 md:w-7"
          strokeWidth={2.25}
        />
      </div>
    </div>
  );
}
