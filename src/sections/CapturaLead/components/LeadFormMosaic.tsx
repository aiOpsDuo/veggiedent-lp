import { useState, useRef } from "react";
import { PawPrint } from "lucide-react";
import mosaicoDescanso from "../../../assets/images/formulario/mosaico-descanso.jpg";
import mosaicoJardim from "../../../assets/images/formulario/mosaico-jardim.jpg";
import mosaicoRetriever from "../../../assets/images/formulario/mosaico-retriever.jpg";
import mosaicoRotina from "../../../assets/images/formulario/mosaico-rotina.jpg";
import mosaicoMastigando from "../../../assets/images/formulario/mosaico-mastigando.jpg";
import mosaicoProduto from "../../../assets/images/formulario/mosaico-produto.jpg";

// Mosaico/CapturaLead — preenche o espaco visual ao lado do formulario com
// fotografia oficial da campanha. E puramente decorativo.
//
// Layout Responsivo:
// - Mobile (< 640px): Carrossel horizontal interativo (swipe) com dots de paginação,
//   exibindo uma foto de cada vez com a proporção de aspecto ideal (4:3) para evitar cortes ruins.
// - Tablet (640px a 1023px): Bento Grid de 3 colunas, com o bloco do produto estendido no rodapé.
// - Desktop (>= 1024px): Bento Grid assimétrico de 4 colunas re-organizado para maior harmonia:
//   - Linha 1 & 2: Descanso (2x2) e Mastigando (2x2) posicionados lado a lado, dando estabilidade.
//   - Linha 3 & 4: Jardim (1x2) na esquerda, Produto (2x2) no centro, Retriever (1x1) e Rotina (1x1) empilhados na direita.
const tiles = [
  {
    id: "mosaico-descanso",
    src: mosaicoDescanso,
    className: "col-span-2 row-span-2",
    objectPosition: "center 30%",
  },
  {
    id: "mosaico-mastigando",
    src: mosaicoMastigando,
    className: "col-span-2 row-span-2",
    objectPosition: "center",
  },
  {
    id: "mosaico-jardim",
    src: mosaicoJardim,
    className: "col-span-1 row-span-2 h-full",
    objectPosition: "center",
  },
  {
    id: "mosaico-produto",
    src: mosaicoProduto,
    className: "col-span-2 row-span-2 sm:col-span-3 sm:row-span-2 lg:col-span-2 lg:row-span-2",
    objectPosition: "center",
  },
  {
    id: "mosaico-retriever",
    src: mosaicoRetriever,
    className: "col-span-1 row-span-1",
    objectPosition: "center",
  },
  {
    id: "mosaico-rotina",
    src: mosaicoRotina,
    className: "col-span-1 row-span-1",
    objectPosition: "center",
  },
] as const;

export function LeadFormMosaic() {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

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
          {tiles.map((tile) => (
            <div
              key={tile.id}
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
          {tiles.map((tile, index) => (
            <button
              key={tile.id}
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
        {tiles.map((tile) => (
          <div
            key={tile.id}
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
