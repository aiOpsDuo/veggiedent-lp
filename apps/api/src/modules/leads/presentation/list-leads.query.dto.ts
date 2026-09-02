import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString } from 'class-validator'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../domain/lead-query'

/**
 * Parâmetros de `GET /api/admin/leads` (SDD § "Endpoints administrativos").
 *
 * Como no DTO de envio, aqui só se verifica forma. O calendário (`2026-02-31`
 * não existe), a ordem entre as duas datas e os limites da paginação são regra,
 * e ficam em `domain/lead-query.ts` — o mesmo lugar que a exportação consulta,
 * para que os dois endpoints não divirjam sobre o que é um período válido.
 *
 * `@Type(() => Number)` é necessário porque todo parâmetro de query chega como
 * texto; sem ele, `page=2` seria a string `'2'` e nunca um inteiro.
 */
export class ListLeadsQueryDto {
  @ApiPropertyOptional({ description: 'Data inicial, inclusiva (AAAA-MM-DD).', example: '2026-09-01' })
  @IsOptional()
  @IsString({ message: 'Informe a data inicial no formato AAAA-MM-DD.' })
  from?: string

  @ApiPropertyOptional({ description: 'Data final, inclusiva (AAAA-MM-DD).', example: '2026-09-30' })
  @IsOptional()
  @IsString({ message: 'Informe a data final no formato AAAA-MM-DD.' })
  to?: string

  @ApiPropertyOptional({ description: 'Página, a partir de 1.', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A página precisa ser um número inteiro a partir de 1.' })
  page?: number

  @ApiPropertyOptional({
    description: `Tamanho da página, de 1 a ${MAX_PAGE_SIZE}.`,
    example: DEFAULT_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: `O tamanho da página precisa estar entre 1 e ${MAX_PAGE_SIZE}.` })
  pageSize?: number
}
