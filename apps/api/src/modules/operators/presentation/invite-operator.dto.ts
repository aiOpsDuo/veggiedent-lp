import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

/**
 * Corpo de `POST /api/admin/operators` — só o e-mail de quem está sendo
 * convidado (SDD § D-09). Nenhuma senha aqui: quem convida nunca define a
 * senha de outro operador, o convidado define a própria ao abrir o link.
 *
 * Toda restrição declara sua mensagem em português; `test/mensagens-em-portugues.spec.ts`
 * varre os DTOs e falha se alguma voltar a depender do texto padrão da biblioteca.
 */
export class InviteOperatorDto {
  @ApiProperty({
    description: 'E-mail do operador convidado.',
    example: 'nova.operadora@veggiedent.com.br',
  })
  @IsString({ message: 'Informe o e-mail do operador.' })
  @IsNotEmpty({ message: 'Informe o e-mail do operador.' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string
}
