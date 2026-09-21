import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { LoginOperatorUseCase } from '../application/login-operator.use-case'
import { InvalidCredentialsError } from '../domain/invalid-credentials.error'
import type { IssuedToken } from '../domain/token-issuer.port'
import { LoginDto } from './login.dto'
import { Public } from './public.decorator'

/**
 * `POST /api/auth/login` (SDD § D-03, § C-02). Público de propósito — a
 * guarda global nega por padrão, e é aqui que o painel troca e-mail/senha por
 * um token.
 */
@ApiTags('Autenticação')
@Public()
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(private readonly loginOperator: LoginOperatorUseCase) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login de operador por e-mail e senha.',
    description:
      'Verifica a senha com argon2id contra `operators` (MySQL) e, se válida, devolve um JWT ' +
      'assinado pela própria API. E-mail inexistente e senha incorreta respondem o mesmo 401 ' +
      'genérico — nunca revelam qual dos dois falhou (SDD § C-02).',
  })
  @ApiUnauthorizedResponse({ description: 'Credenciais inválidas.' })
  async login(@Body() body: LoginDto): Promise<IssuedToken> {
    try {
      return await this.loginOperator.execute(body)
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        this.logger.warn(`Login recusado: ${error.reason}.`)
        throw new UnauthorizedException()
      }
      throw error
    }
  }
}
