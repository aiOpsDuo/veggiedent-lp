import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { useTracking } from "../../../hooks/useTracking";
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
  const { track } = useTracking();
  const hasCta = Boolean(data.ctaLabel && data.ctaHref);

  return (
    <Card
      as="li"
      className="flex h-full flex-1 flex-col gap-2 overflow-hidden !p-0 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg"
    >
      <img
        src={data.image}
        alt={data.imageAlt}
        loading="lazy"
        className="aspect-[4/5] w-full object-cover"
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
        {hasCta && (
          <Button
            href={data.ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            variant="cta"
            className="self-start"
            onClick={() =>
              track("cta_click", {
                cta_label: data.ctaLabel,
                cta_location: "rotina_step",
                destination_url: data.ctaHref,
              })
            }
          >
            {data.ctaLabel}
            <span aria-hidden="true" className="ml-1.5">
              →
            </span>
          </Button>
        )}
      </div>
    </Card>
  );
}
