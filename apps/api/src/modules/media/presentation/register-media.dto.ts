import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator'
import { MEDIA_KINDS, type MediaKind } from '../domain/media-kind'

const MAX_FILENAME_LENGTH = 255

/**
 * Corpo de `POST /api/admin/media` — a confirmação de que o arquivo terminou de
 * subir (SDD § D-05, passo 3 de 3).
 *
 * `kind` e `path` são devolvidos pela emissão da credencial e repetidos aqui.
 * Tamanho e tipo **não** vêm no corpo de propósito: quem os informa é o
 * armazenamento, ao ser consultado sobre o arquivo que de fato chegou.
 *
 * As dimensões e a duração vêm do painel porque só o navegador as conhece — a
 * API não abre o arquivo. São opcionais e apenas descritivas.
 *
 * O `IsIn` lê a lista de naturezas do domínio em vez de repeti-la aqui: uma
 * natureza nova passaria a ser aceita sem que ninguém precise lembrar deste
 * arquivo. É a mesma exceção de camada que a T4 e a T6 já declararam — a
 * apresentação conhece um valor do domínio para não duplicá-lo.
 */
export class RegisterMediaDto {
  @ApiProperty({
    description: 'Natureza da mídia, como devolvida pela emissão da credencial.',
    enum: MEDIA_KINDS,
    example: 'video',
  })
  @IsIn(MEDIA_KINDS, {
    message: 'Natureza de mídia desconhecida. Use image, video ou caption.',
  })
  kind!: MediaKind

  @ApiProperty({
    description: 'Caminho de destino devolvido pela emissão da credencial.',
    example: '0f2f5b1e-1f7a-4a1b-9a5c-8f0e2d3c4b5a/demonstracao-escovacao.mp4',
  })
  @IsString({ message: 'Informe o caminho do arquivo enviado.' })
  @IsNotEmpty({ message: 'Informe o caminho do arquivo enviado.' })
  path!: string

  @ApiProperty({
    description: 'Nome original do arquivo, exibido no painel.',
    example: 'demonstração escovação.mp4',
  })
  @IsString({ message: 'Informe o nome do arquivo.' })
  @IsNotEmpty({ message: 'Informe o nome do arquivo.' })
  @MaxLength(MAX_FILENAME_LENGTH, { message: 'Nome de arquivo longo demais.' })
  originalFilename!: string

  @ApiPropertyOptional({ description: 'Largura em pixels, para imagem e vídeo.' })
  @IsOptional()
  @IsInt({ message: 'A largura precisa ser um número inteiro de pixels.' })
  @IsPositive({ message: 'A largura precisa ser maior que zero.' })
  width?: number

  @ApiPropertyOptional({ description: 'Altura em pixels, para imagem e vídeo.' })
  @IsOptional()
  @IsInt({ message: 'A altura precisa ser um número inteiro de pixels.' })
  @IsPositive({ message: 'A altura precisa ser maior que zero.' })
  height?: number

  @ApiPropertyOptional({ description: 'Duração em segundos, para vídeo.' })
  @IsOptional()
  @IsNumber({}, { message: 'A duração precisa ser um número de segundos.' })
  @IsPositive({ message: 'A duração precisa ser maior que zero.' })
  durationSeconds?: number
}
