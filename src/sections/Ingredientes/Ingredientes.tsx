import { ingredientesContent } from './Ingredientes.content'
import { SectionShell } from '../../components/ui/SectionShell'
import { SectionHeading } from '../../components/ui/SectionHeading'

// [BLOQUEADO] — Especificacao Funcional, secao 6.7: a secao existe no wireframe
// mas nao vai para produção sem conteúdo real. Enquanto isContentReady for false,
// o componente nao renderiza nada (nem o H2) — evita título sem corpo em produção
// e mantém a seção fora do menu de navegação do Header.
export function Ingredientes() {
  if (!ingredientesContent.isContentReady) {
    return null
  }

  return (
    <SectionShell id="ingredientes" aria-labelledby="ingredientes-heading">
      <SectionHeading id="ingredientes-heading">{ingredientesContent.heading}</SectionHeading>
      {/* Conteudo real entra aqui assim que o material tecnico da Virbac chegar. */}
    </SectionShell>
  )
}
