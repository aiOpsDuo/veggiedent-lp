/**
 * Mensagens de validação exibidas ao operador no painel. Ficam em um só lugar
 * para que o vocabulário seja o mesmo em toda a API (SDD, § "Linguagem ubíqua").
 */
export const MESSAGES = {
  required: 'Campo obrigatório.',
  expectedText: 'Informe um texto.',
  expectedBoolean: 'Informe sim ou não.',
  expectedTextList: 'Informe uma lista de textos.',
  expectedList: 'Informe uma lista de itens.',
  expectedObject: 'Informe o conteúdo da seção.',
  emptyList: 'Inclua ao menos um item.',
  mediaReference: 'Selecione um arquivo enviado pelo painel.',
  invalidLink: 'Informe um endereço válido (ex.: #secao, /pagina ou https://exemplo.com).',
  altRequiredWithImage: 'O texto alternativo é obrigatório quando há imagem.',
  unknownField: 'Campo desconhecido nesta seção.',
  unknownSection: 'Seção desconhecida.',
  itemVisibility: 'Informe se o item aparece na página.',
  itemOrder: 'Informe a posição do item na lista.',
  duplicateOrder: 'As posições de ordenação dos itens devem ser distintas.',
  invalidValue: 'Valor inválido.',
} as const

export function minimumItemsMessage(minItems: number): string {
  return minItems === 1 ? MESSAGES.emptyList : `Inclua ao menos ${minItems} itens.`
}
