import { Card } from "../../../components/ui/Card";
import type { SectionContent } from "../../../content/published-content";

interface RoutineStepProps {
  data: SectionContent<"rotina">["steps"][number];
  index: number;
}

// Block/Routine — Design System v1.2, secao 9.5.
// Card renderizado como <li> (prop `as`) para preservar a semantica de
// lista ordenada do <ol> pai — a numeracao e parte do conteudo, nao
// decorativa (Especificacao Funcional, secao 6.4).
export function RoutineStep({ data, index }: RoutineStepProps) {
  return (
    <Card
      as="li"
      className="flex h-full flex-1 flex-col gap-2 overflow-hidden !p-0 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg"
    >
      <img
        src={data.image}
        alt={data.imageAlt}
        loading="lazy"
        className="aspect-[6/6] w-full object-fill"
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-primary font-[Arial] text-sm font-bold leading-none text-ink-900">
          {index + 1}
        </div>
        <h3 className="mt-4 text-lg font-semibold text-ink-900">
          {data.title}
        </h3>
        <p className="whitespace-pre-line text-base text-ink-700">
          {data.body}
        </p>
      </div>
    </Card>
  );
}
