import { SetMetadata, type CustomDecorator } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'auth:publico'

/**
 * Libera um endpoint da guarda global.
 *
 * A marcação é sempre explícita e só existe neste sentido: não há decorador que
 * proteja. Um endpoint sem marcação nasce protegido, e o esquecimento leva a
 * "bloqueado", nunca a "exposto" (SDD § D-03 e § C-01).
 */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true)
