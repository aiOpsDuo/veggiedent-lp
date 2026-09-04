import type { RichTextSanitizer } from '@veggiedent/content-schema'

/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const RICH_TEXT_SANITIZER = Symbol('RichTextSanitizer')

/**
 * Porta de sanitização de texto rico.
 *
 * O domínio precisa reduzir o HTML de um campo `texto-rico` à política do
 * `content-schema` sem saber que, do outro lado, existe um DOM montado com
 * jsdom. A política é a mesma que a LP aplica ao renderizar; o que muda entre
 * os dois é só a janela.
 */
export type { RichTextSanitizer }
