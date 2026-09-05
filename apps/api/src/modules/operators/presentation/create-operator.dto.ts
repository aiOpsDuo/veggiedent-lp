import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator'

/** O Supabase Auth exige este mínimo por padrão — validar aqui evita um round-trip só para descobrir isso. */
export const MIN_OPERATOR_PASSWORD_LENGTH = 6

/**
 * Corpo de `POST /api/admin/operators` (SDD § D-09, revista na T34): e-mail,
 * senha e nome do operador novo. A conta nasce pronta para logar — sem link,
 * sem e-mail transacional — então quem cria define a senha inicial de outra
 * pessoa, o trade-off aceito e registrado em D-09.
 *
 * Toda restrição declara sua mensagem em português; `test/mensagens-em-portugues.spec.ts`
 * varre os DTOs e falha se alguma voltar a depender do texto padrão da biblioteca.
 */
export class CreateOperatorDto {
  @ApiProperty({
    description: 'E-mail do novo operador.',
    example: 'nova.operadora@veggiedent.com.br',
  })
  @IsString({ message: 'Informe o e-mail do operador.' })
  @IsNotEmpty({ message: 'Informe o e-mail do operador.' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string

  @ApiProperty({
    description: `Senha inicial do operador. Mínimo de ${MIN_OPERATOR_PASSWORD_LENGTH} caracteres.`,
    example: 'senha-inicial-forte',
  })
  @IsString({ message: 'Informe a senha do operador.' })
  @MinLength(MIN_OPERATOR_PASSWORD_LENGTH, {
    message: `A senha precisa ter pelo menos ${MIN_OPERATOR_PASSWORD_LENGTH} caracteres.`,
  })
  password!: string

  @ApiProperty({ description: 'Nome do novo operador.', example: 'Nova Operadora' })
  @IsString({ message: 'Informe o nome do operador.' })
  @IsNotEmpty({ message: 'Informe o nome do operador.' })
  name!: string
}
