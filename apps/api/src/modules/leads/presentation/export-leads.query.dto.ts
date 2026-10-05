import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'
import { EMAIL_FILTER_MAX_LENGTH } from '../domain/lead-filter'

/**
 * Parâmetros de `GET /api/admin/leads/export`: os mesmos filtros da listagem
 * (período e trecho do e-mail), sem paginação — quem exporta quer o recorte
 * inteiro (SDD § C-12).
 */
export class ExportLeadsQueryDto {
  @ApiPropertyOptional({ description: 'Data inicial, inclusiva (AAAA-MM-DD).', example: '2026-09-01' })
  @IsOptional()
  @IsString({ message: 'Informe a data inicial no formato AAAA-MM-DD.' })
  from?: string

  @ApiPropertyOptional({ description: 'Data final, inclusiva (AAAA-MM-DD).', example: '2026-09-30' })
  @IsOptional()
  @IsString({ message: 'Informe a data final no formato AAAA-MM-DD.' })
  to?: string

  @ApiPropertyOptional({
    description: `Trecho do e-mail, sem diferenciar maiúsculas de minúsculas; %, _ e \\ valem como texto. Até ${EMAIL_FILTER_MAX_LENGTH} caracteres; vazio não filtra.`,
    example: 'maria@',
  })
  @IsOptional()
  // Abaixo do teto de propósito: o decorador de baixo é checado primeiro, e
  // `email` repetido na URL (uma lista) precisa ouvir "texto", não "tamanho".
  @MaxLength(EMAIL_FILTER_MAX_LENGTH, {
    message: `A busca por e-mail aceita até ${EMAIL_FILTER_MAX_LENGTH} caracteres.`,
  })
  @IsString({ message: 'Informe o e-mail da busca como texto.' })
  email?: string
}
