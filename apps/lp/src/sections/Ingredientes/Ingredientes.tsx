import { SectionShell } from '../../components/ui/SectionShell'
import { SectionHeading } from '../../components/ui/SectionHeading'
import { connectSection } from '../../content/connect-section'
import type { SectionContent } from '../../content/published-content'

/**
 * A secao existe no wireframe mas nao tem conteudo aprovado: o material tecnico
 * da Virbac ainda nao chegou. Ela vive **despublicada** no CMS, e por isso nao
 * chega em `GET /api/content` e nada e renderizado — nem o titulo, o que evita
 * um H2 sem corpo na pagina e a mantem fora do menu do cabecalho.
 *
 * Publicar a secao no painel e o que a coloca na pagina; nao ha mais nenhuma
 * chave no codigo para virar (antes era `isContentReady`).
 */
export const Ingredientes = connectSection('ingredientes', IngredientesSecao)

function IngredientesSecao({ content }: { content: SectionContent<'ingredientes'> }) {
  return (
    <SectionShell id="ingredientes" aria-labelledby="ingredientes-heading">
      <SectionHeading id="ingredientes-heading">{content.heading}</SectionHeading>
    </SectionShell>
  )
}
