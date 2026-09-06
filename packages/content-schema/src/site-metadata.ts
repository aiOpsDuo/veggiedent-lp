import type { FieldSpec } from './contract'
import { optionalImage } from './fields'

/**
 * Metadados da página: título, descrição e imagem de compartilhamento usados
 * por buscadores e previews de link. Não é uma seção — não tem listas e não
 * entra no conjunto fechado das 9 chaves —, mas é declarado com o mesmo
 * contrato de campos, para que o painel gere seu formulário do mesmo jeito.
 *
 * O **endereço oficial** (`<link rel="canonical">`) não está aqui: é SEO
 * técnico, que um valor errado tira a página do índice sem nenhum sinal visível
 * a quem edita. Ele vive em `apps/lp/index.html`, junto com o resto do HTML
 * estático (T25).
 */
export const siteMetadataSchema = {
  key: 'site_metadata',
  label: 'Metadados da página',
  fields: [
    {
      name: 'title',
      type: 'texto-curto',
      label: 'Título da página',
      help: 'Aparece na aba do navegador, no resultado de busca e no preview do link.',
      required: true,
    },
    {
      name: 'description',
      type: 'texto-longo',
      label: 'Descrição da página',
      help: 'Resumo exibido abaixo do título no resultado de busca e no preview do link.',
      required: true,
    },
    ...optionalImage({
      name: 'ogImage',
      label: 'Imagem de compartilhamento',
      help: 'Imagem exibida quando o link da página é compartilhado. Deixe vazia enquanto a imagem oficial não for aprovada.',
      altLabel: 'Texto alternativo da imagem de compartilhamento',
      altHelp: 'Descrição da imagem de compartilhamento. Obrigatória quando há imagem.',
    }),
  ],
  lists: [],
} as const satisfies {
  readonly key: string
  readonly label: string
  readonly fields: readonly FieldSpec[]
  readonly lists: readonly []
}
