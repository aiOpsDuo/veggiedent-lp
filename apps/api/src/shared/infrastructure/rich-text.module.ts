import { Global, Module } from '@nestjs/common'
import { createRichTextSanitizer } from '@veggiedent/content-schema'
import { JSDOM } from 'jsdom'
import { RICH_TEXT_SANITIZER } from '../domain/rich-text-sanitizer.port'

/**
 * O sanitizador de texto rico do processo, com a janela DOM que ele precisa.
 *
 * A política de sanitização é a do `content-schema`, a mesma que a LP usa; o
 * que falta no servidor é um DOM, e é isso — e só isso — que o jsdom traz. A
 * janela é criada uma vez: montá-la a cada gravação seria trabalho repetido
 * sem ganho nenhum.
 *
 * Global pela mesma razão do cliente Supabase: conteúdo e metadados precisam do
 * mesmo sanitizador, e a política tem que ser uma só. O que é global é o
 * sanitizador, não a permissão de pular a sanitização.
 */
@Global()
@Module({
  providers: [
    {
      provide: RICH_TEXT_SANITIZER,
      useFactory: () => createRichTextSanitizer(new JSDOM('').window),
    },
  ],
  exports: [RICH_TEXT_SANITIZER],
})
export class RichTextModule {}
