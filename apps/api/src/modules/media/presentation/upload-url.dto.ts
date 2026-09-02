import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsPositive, IsString, MaxLength } from 'class-validator'

const MAX_FILENAME_LENGTH = 255

/**
 * Corpo de `POST /api/admin/media/upload-url` — nome, tipo e tamanho do arquivo
 * que o painel quer enviar (SDD § D-05). **Nenhum byte trafega nesta rota.**
 *
 * O que este DTO verifica é a forma do pedido. Se o tipo é suportado e se o
 * tamanho cabe no bucket é decisão do domínio, em `domain/upload-plan.ts`, que
 * é onde a política de cada natureza de mídia vive.
 *
 * Toda restrição declara sua mensagem em português; `test/mensagens-em-portugues.spec.ts`
 * varre os DTOs e falha se alguma voltar a depender do texto padrão da biblioteca.
 */
export class UploadUrlDto {
  @ApiProperty({
    description: 'Nome do arquivo escolhido pelo operador.',
    example: 'demonstracao-escovacao.mp4',
  })
  @IsString({ message: 'Informe o nome do arquivo.' })
  @IsNotEmpty({ message: 'Informe o nome do arquivo.' })
  @MaxLength(MAX_FILENAME_LENGTH, { message: 'Nome de arquivo longo demais.' })
  originalFilename!: string

  @ApiProperty({
    description: 'Tipo do arquivo, como o navegador o informa.',
    example: 'video/mp4',
  })
  @IsString({ message: 'Informe o tipo do arquivo.' })
  @IsNotEmpty({ message: 'Informe o tipo do arquivo.' })
  contentType!: string

  @ApiProperty({ description: 'Tamanho do arquivo em bytes.', example: 128000000 })
  @IsInt({ message: 'Informe o tamanho do arquivo em bytes.' })
  @IsPositive({ message: 'O tamanho do arquivo precisa ser maior que zero.' })
  sizeBytes!: number
}
