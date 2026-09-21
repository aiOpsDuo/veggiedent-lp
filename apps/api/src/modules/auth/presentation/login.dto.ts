import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

/**
 * Corpo de `POST /api/auth/login` (SDD § "Endpoint de login"). Verifica só
 * **forma** aqui — e-mail com formato de e-mail, senha presente — nunca se as
 * credenciais existem ou conferem: essa regra é do caso de uso
 * (`LoginOperatorUseCase`), não do DTO.
 */
export class LoginDto {
  @ApiProperty({ description: 'E-mail do operador.', example: 'operadora@veggiedent.com.br' })
  @IsString({ message: 'Informe o e-mail.' })
  @IsNotEmpty({ message: 'Informe o e-mail.' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string

  @ApiProperty({ description: 'Senha do operador.', example: 'senha-do-operador' })
  @IsString({ message: 'Informe a senha.' })
  @IsNotEmpty({ message: 'Informe a senha.' })
  password!: string
}
