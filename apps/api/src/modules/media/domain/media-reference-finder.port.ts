/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const MEDIA_REFERENCE_FINDER = Symbol('MediaReferenceFinder')

/** Onde uma mídia está em uso. O rótulo é o nome que o operador reconhece. */
export interface MediaReference {
  readonly scope: 'secao' | 'metadados'
  readonly label: string
}

/**
 * Quem referencia uma mídia (SDD § "Endpoints administrativos" — a remoção é
 * recusada com `409` se a mídia estiver referenciada).
 *
 * A porta pergunta apenas isto, e sobre **uma** mídia: é o suficiente para
 * decidir uma remoção e não obriga quem a implementa a expor conteúdo de seção
 * ao módulo de mídia.
 */
export interface MediaReferenceFinder {
  findReferencesTo(mediaId: string): Promise<MediaReference[]>
}
