import type { ComponentType } from 'react'
import type { SectionKey } from '@veggiedent/content-schema'
import { useSection } from './PublishedContentProvider'
import type { SectionContent } from './published-content'

/**
 * Liga um componente de seção ao conteúdo publicado (SDD § C-10).
 *
 * Existe para que a regra "seção despublicada não aparece na página" seja
 * escrita uma vez, e não repetida nas doze seções. O componente recebido fica
 * puramente apresentacional: recebe o documento pronto e nunca precisa tratar
 * ausência — o que também é o que o torna exercitável sem rede e sem contexto.
 */
export function connectSection<K extends SectionKey>(
  key: K,
  Section: ComponentType<{ content: SectionContent<K> }>,
) {
  function ConnectedSection() {
    const content = useSection(key)
    return content === undefined ? null : <Section content={content} />
  }

  ConnectedSection.displayName = `connectSection(${key})`
  return ConnectedSection
}
