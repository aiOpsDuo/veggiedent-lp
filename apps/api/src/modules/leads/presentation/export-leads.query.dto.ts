import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

/**
 * Parâmetros de `GET /api/admin/leads/export`: os mesmos filtros de data da
 * listagem, sem paginação — quem exporta quer o período inteiro (SDD § C-12).
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
}
