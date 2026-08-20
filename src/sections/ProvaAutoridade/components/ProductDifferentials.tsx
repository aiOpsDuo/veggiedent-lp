import formatoEmZSvg from "../../../assets/images/prova-autoridade/01_formato_em_z.svg";
import halitoCausasSvg from "../../../assets/images/prova-autoridade/02_halito_causas_digestivas.svg";
import origemVegetalSvg from "../../../assets/images/prova-autoridade/03_origem_100_vegetal.svg";

// Card unico de diferenciais do produto — hierarquia visual secundaria em relacao
// aos cards 1.116 e N.º 1 acima. Fundo brand-primary/10 fornece contraste para os
// SVGs (circulos verdes com icone branco) sem competir com os stat cards principais.
// Border-l verde segue o mesmo padrao visual dos dois cards de autoridade.
// (Copy Deck v2.0, secao 8.3; Design System v1.2, secao 9.12)

interface Differential {
  src: string;
  alt: string;
  /** Parte inicial do texto (bold) e restante (normal) separados por ':' */
  bold: string;
  rest: string;
}

const differentials: Differential[] = [
  {
    src: formatoEmZSvg,
    alt: "Picto formato em Z",
    bold: "Formato em Z:",
    rest: " limpeza mecânica eficaz.",
  },
  {
    src: halitoCausasSvg,
    alt: "Picto hálito e causas digestivas",
    bold: "Atua no hálito",
    rest: " e nas suas causas digestivas.",
  },
  {
    src: origemVegetalSvg,
    alt: "Picto origem 100% vegetal",
    bold: "Origem 100% vegetal:",
    rest: " tiras mastigáveis.",
  },
];

export function ProductDifferentials() {
  return (
    <div className="mt-4">
      {/* Título de seção — mesma linguagem do badge de autoridade */}
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-ink-400">
        Diferenciais
      </p>

      {/*
        Card único com fundo brand-primary/10 (turquesa muito leve).
        Os SVGs têm círculo verde + ícone branco, ficam legíveis sobre
        qualquer fundo claro/neutro. Border-l verde segue padrão dos stat cards.
      */}
      <div
        className="
          group rounded-[12px] sm:rounded-[16px]
          border-l-[6px] border-brand-primary
          border-y border-r border-black/5
          bg-brand-primary/[0.20]
          px-4 py-3.5 sm:px-5 sm:py-4
          shadow-sm ring-1 ring-brand-primary/10
          transition-all duration-300 ease-out
          hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-primary/20
        "
      >
        <div className="flex flex-col">
          {differentials.map((item, index) => (
            <div key={item.alt}>
              {/* Item: SVG à esquerda, texto à direita */}
              <div className="flex items-center gap-3.5">
                <img
                  src={item.src}
                  alt={item.alt}
                  className="h-[44px] w-[44px] shrink-0 object-contain sm:h-[48px] sm:w-[48px]"
                />
                <p className="text-[13px] sm:text-sm leading-snug text-ink-700">
                  <span className="font-bold text-ink-900">{item.bold}</span>
                  {item.rest}
                </p>
              </div>

              {/* Separador entre itens */}
              {index < differentials.length - 1 && (
                <div className="my-3 border-t border-brand-primary/15" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
