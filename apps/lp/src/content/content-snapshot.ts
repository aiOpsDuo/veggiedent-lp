import snapshot from './content-snapshot.json'
import type { PublishedContent } from './published-content'

/**
 * O conteúdo publicado no momento em que este arquivo foi gerado (SDD § D-08).
 *
 * É gerado por `npm run instantaneo` a partir de `GET /api/content`, versionado
 * e embutido no build. A LP renderiza a partir dele imediatamente e o substitui
 * assim que a busca em tempo de execução responde — se ela não responder, a
 * página continua exibindo isto em vez de tela vazia.
 *
 * A conversão de tipo é o único ponto do módulo que confia no arquivo gerado:
 * um `.json` chega ao TypeScript com o tipo literal do que está escrito nele,
 * que é mais estreito que o contrato, não mais largo. O script que o gera é
 * quem garante a forma, recusando gravar resposta sem seções.
 */
export const contentSnapshot = snapshot as unknown as PublishedContent
