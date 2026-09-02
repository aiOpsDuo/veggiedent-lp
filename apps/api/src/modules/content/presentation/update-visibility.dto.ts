import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

/**
 * Corpo de `PATCH /api/admin/sections/:key/visibility`.
 *
 * Toda restrição declara sua mensagem em português. O class-validator responde
 * em inglês por padrão, e o operador é quem lê essa mensagem — a pendência que
 * a T4 deixou registrada. `test/mensagens-em-portugues.spec.ts` varre os DTOs e
 * falha se alguma restrição voltar a depender do texto padrão da biblioteca.
 */
export class UpdateVisibilityDto {
  @ApiProperty({
    description: 'Liga (true) ou desliga (false) a seção na landing page.',
    example: true,
  })
  @IsBoolean({ message: 'Informe sim ou não.' })
  isPublished!: boolean
}
