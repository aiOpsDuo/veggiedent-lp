import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RichText } from "./RichText";

/**
 * O texto rico chegando à página pública.
 *
 * Este é o ponto onde HTML escrito por um operador entra no DOM do visitante —
 * a última barreira antes do navegador. Cada carga abaixo executaria script se
 * chegasse inteira; os testes montam a página de verdade e olham o DOM que
 * sobrou, não o texto que a função devolveu.
 */

afterEach(cleanup);

function renderizar(html: string, lineBreak?: ReactNode) {
  return render(
    <div data-testid="alvo">
      <RichText
        html={html}
        emphasisClassName="text-brand-primary-hover font-extrabold"
        lineBreak={lineBreak}
      />
    </div>,
  );
}

describe("o que o operador consegue exibir", () => {
  it("marca em destaque o trecho que ele pôs em negrito", () => {
    renderizar("A recomendação dos <br><strong>médicos-veterinários,</strong> em números");

    const destaque = screen.getByText("médicos-veterinários,");
    expect(destaque.tagName).toBe("STRONG");
    expect(destaque).toHaveClass("text-brand-primary-hover", "font-extrabold");
  });

  it("quebra a linha onde ele pediu", () => {
    renderizar("A recomendação dos<br>em números");

    expect(screen.getByTestId("alvo").querySelector("br")).not.toBeNull();
  });

  it("deixa a página decidir como a quebra é desenhada", () => {
    renderizar("A recomendação dos<br>em números", <br className="hidden lg:block" />);

    expect(screen.getByTestId("alvo").querySelector("br")).toHaveClass("hidden", "lg:block");
  });

  it("preserva o texto inteiro, com acentuação", () => {
    renderizar("A recomendação dos<br><strong>médicos-veterinários,</strong> em números");

    expect(screen.getByTestId("alvo")).toHaveTextContent(
      "A recomendação dosmédicos-veterinários, em números",
    );
  });
});

describe("tentativa real de injeção na página", () => {
  const cargas: readonly (readonly [string, string])[] = [
    ["script direto", '<script>window.__invadido = true</script>Título'],
    ["manipulador de evento em imagem", '<img src="x" onerror="window.__invadido = true">Título'],
    ["manipulador de evento em tag permitida", '<strong onclick="window.__invadido = true">Título</strong>'],
    ["javascript: em href", '<a href="javascript:window.__invadido = true">Título</a>'],
    ["iframe para outro site", '<iframe src="https://mal.invalid"></iframe>Título'],
    ["svg com manipulador", '<svg onload="window.__invadido = true"></svg>Título'],
    ["marcação mal formada", '<img src="x"/onerror=alert(1)//>Título'],
  ];

  it.each(cargas)("%s não chega ao DOM da página", (_nome, carga) => {
    renderizar(carga);

    const alvo = screen.getByTestId("alvo");
    expect(alvo.querySelectorAll("script, iframe, img, svg, a, style, form, input")).toHaveLength(0);
    expect(alvo.innerHTML.toLowerCase()).not.toContain("javascript:");
    expect(alvo.innerHTML).not.toMatch(/\son\w+\s*=/i);

    for (const elemento of Array.from(alvo.querySelectorAll("*"))) {
      expect(["STRONG", "EM", "BR"]).toContain(elemento.tagName);
      const atributos = Array.from(elemento.attributes).map((atributo) => atributo.name);
      expect(atributos.filter((nome) => nome !== "class")).toEqual([]);
    }
    expect((window as unknown as { __invadido?: boolean }).__invadido).toBeUndefined();
  });
});
