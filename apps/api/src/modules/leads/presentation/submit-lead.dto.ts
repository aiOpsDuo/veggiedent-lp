import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

/**
 * Corpo de `POST /api/leads` — o formulário da LP, nos mesmos nomes de campo
 * que o relay serverless recebia (SDD § D-07: o comportamento externo é
 * preservado; muda apenas onde o código roda).
 *
 * Este DTO verifica **forma**, não regra: cada campo é opcional aqui e nenhum
 * formato é exigido. Quem decide que nome é obrigatório, que e-mail precisa ter
 * forma de e-mail, que o consentimento LGPD é obrigatório e que o porte tem
 * lista fechada é `domain/lead-submission.ts`, que é onde as invariantes do
 * lead moram (SDD § "Visão de layers dentro da API"; risco R-06).
 *
 * A separação não é cerimônia: o honeypot precisa ser decidido **antes** da
 * validação, como era no relay antigo. Se as regras estivessem aqui, o pipe
 * global responderia `422` a um robô que preencheu o campo invisível e errou o
 * e-mail — e um `422` ensina ao robô que o campo existe, que é exatamente o que
 * o honeypot evita.
 *
 * `aceite_lgpd` continua declarado aqui mesmo não sendo gravado em lugar nenhum:
 * ele é **entrada** da requisição, não campo do registro. O pipe global roda com
 * `forbidNonWhitelisted`, então um campo ausente deste DTO é recusado antes de
 * chegar ao domínio — tirá-lo daqui faria o envio **com** consentimento ser
 * rejeitado, exatamente o contrário da regra que a T18 preserva.
 */
export class SubmitLeadDto {
  @ApiPropertyOptional({ description: 'Nome do visitante.', example: 'Ana Souza' })
  @IsOptional()
  @IsString({ message: 'Informe o nome.' })
  nome?: string

  @ApiPropertyOptional({ description: 'E-mail do visitante.', example: 'ana@exemplo.com' })
  @IsOptional()
  @IsString({ message: 'Informe o e-mail.' })
  email?: string

  @ApiPropertyOptional({ description: 'Telefone com DDD.', example: '11999999999' })
  @IsOptional()
  @IsString({ message: 'Informe o telefone como texto.' })
  telefone?: string

  @ApiPropertyOptional({ description: 'Nome do cachorro.', example: 'Bidu' })
  @IsOptional()
  @IsString({ message: 'Informe o nome do cachorro como texto.' })
  nome_cachorro?: string

  @ApiPropertyOptional({
    description: 'Porte do cachorro: pequeno, medio ou grande.',
    example: 'medio',
  })
  @IsOptional()
  @IsString({ message: 'Informe o porte do cachorro como texto.' })
  porte_cachorro?: string

  @ApiPropertyOptional({ description: 'Cidade e estado.', example: 'São Paulo/SP' })
  @IsOptional()
  @IsString({ message: 'Informe a cidade e o estado como texto.' })
  cidade_estado?: string

  @ApiPropertyOptional({
    description: 'Se o visitante já conhece a Virbac. Coletado hoje e descartado (SDD, R-01).',
    example: 'sim',
  })
  @IsOptional()
  @IsString({ message: 'Informe se conhece a Virbac como texto.' })
  conhece_virbac?: string

  @ApiPropertyOptional({
    description: 'Se o visitante usa algum produto Virbac. Coletado hoje e descartado (SDD, R-01).',
    example: 'sim',
  })
  @IsOptional()
  @IsString({ message: 'Informe se usa produto Virbac como texto.' })
  usa_produto_virbac?: string

  @ApiPropertyOptional({
    description: 'Qual produto Virbac o visitante usa. Coletado hoje e descartado (SDD, R-01).',
    example: 'Veggiedent',
  })
  @IsOptional()
  @IsString({ message: 'Informe qual produto Virbac como texto.' })
  qual_produto_virbac?: string

  @ApiProperty({
    description:
      'Consentimento com a Política de Privacidade. Obrigatório: sem ele o envio é recusado com 422. Não é gravado — é condição de envio, não dado do lead.',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Informe o consentimento LGPD como sim ou não.' })
  aceite_lgpd?: boolean

  @ApiPropertyOptional({ description: 'Aceite de comunicações de marketing.', example: true })
  @IsOptional()
  @IsBoolean({ message: 'Informe o aceite de comunicações como sim ou não.' })
  aceite_comunicacoes?: boolean

  @ApiPropertyOptional({ description: 'Origem declarada do envio.', example: 'lp-veggiedent' })
  @IsOptional()
  @IsString({ message: 'Informe a origem como texto.' })
  origem?: string

  @ApiPropertyOptional({
    description:
      'Campo honeypot: invisível no formulário e sempre vazio para uma pessoa. Preenchido, o envio é descartado em silêncio, com resposta de sucesso.',
  })
  @IsOptional()
  @IsString({ message: 'Campo inválido.' })
  website?: string
}
