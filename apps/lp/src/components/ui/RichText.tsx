import { Fragment, useMemo, type ReactNode } from "react";
import { createRichTextSanitizer } from "@veggiedent/content-schema";

/**
 * Renderiza um campo de **texto rico** vindo do CMS.
 *
 * O HTML deste campo é escrito por um operador no painel e guardado no banco.
 * Entre o banco e a página existem duas barreiras, nesta ordem:
 *
 * 1. **Sanitização** pela política única de `@veggiedent/content-schema`, que
 *    só deixa passar negrito, itálico e quebra de linha, sem atributo nenhum;
 * 2. **Reconstrução em elementos React**, percorrendo o DOM já limpo. Não há
 *    `dangerouslySetInnerHTML` em lugar nenhum: mesmo que a primeira barreira
 *    falhasse, este componente só sabe emitir `<strong>`, `<em>`, `<br>` e
 *    texto — não existe caminho para um `<script>` ou um atributo virar nó.
 *
 * O **negrito é o destaque**: o operador marca o trecho em negrito no painel e
 * a página aplica o estilo de destaque que a seção escolher. Não há marcação
 * própria de "destaque" para o operador aprender.
 */

const sanitizeRichText = createRichTextSanitizer(window);

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

export interface RichTextProps {
  /** HTML do campo de texto rico, como veio do CMS ou do instantâneo. */
  readonly html: string;
  /** Classe aplicada ao trecho que o operador marcou em negrito. */
  readonly emphasisClassName?: string;
  /**
   * O que a página desenha no lugar de uma quebra de linha. O padrão é um `<br>`
   * simples; uma seção que só quebra em certa largura de tela troca isto pelo
   * que a largura dela exige.
   */
  readonly lineBreak?: ReactNode;
}

interface RenderOptions {
  readonly emphasisClassName: string | undefined;
  readonly lineBreak: ReactNode;
}

function renderChildren(node: Node, options: RenderOptions): ReactNode[] {
  return Array.from(node.childNodes).map((child, index) => {
    const key = `${index}`;

    if (child.nodeType === TEXT_NODE) {
      return <Fragment key={key}>{child.textContent}</Fragment>;
    }
    if (child.nodeType !== ELEMENT_NODE) {
      return null;
    }

    const tag = (child as Element).tagName.toLowerCase();
    if (tag === "br") {
      return <Fragment key={key}>{options.lineBreak}</Fragment>;
    }
    if (tag === "strong") {
      return (
        <strong key={key} className={options.emphasisClassName}>
          {renderChildren(child, options)}
        </strong>
      );
    }
    if (tag === "em") {
      return <em key={key}>{renderChildren(child, options)}</em>;
    }
    // Tag que a sanitização deixaria passar mas a página não conhece: o texto
    // fica, a marcação some. Errar para o lado de não renderizar é o certo.
    return <Fragment key={key}>{renderChildren(child, options)}</Fragment>;
  });
}

export function RichText({
  html,
  emphasisClassName,
  lineBreak = <br />,
}: RichTextProps) {
  const children = useMemo(() => {
    const limpo = sanitizeRichText(html);
    const documento = new DOMParser().parseFromString(limpo, "text/html");
    return renderChildren(documento.body, { emphasisClassName, lineBreak });
  }, [html, emphasisClassName, lineBreak]);

  return <>{children}</>;
}
