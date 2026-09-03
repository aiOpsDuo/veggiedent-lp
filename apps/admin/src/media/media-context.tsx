import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAuth } from '../auth/auth-context'
import type { MediaGateway } from './media-gateway'
import { ApiMediaService, type MediaService } from './media-service'

/**
 * O serviço de mídia visto pelos campos do formulário.
 *
 * Ele chega por contexto, e não por propriedade, porque o caminho até um campo
 * de mídia passa por três componentes que não têm nada a ver com envio de
 * arquivo — a tela da seção, o formulário e a lista. Arrastar o serviço por
 * todos eles só para entregá-lo ao último acoplaria os três a algo que não é
 * assunto deles.
 *
 * `null` significa "ainda não há sessão": o campo continua desenhando a prévia
 * do que está guardado e apenas não envia.
 */
const MediaServiceContext = createContext<MediaService | null>(null)

export function useMediaService(): MediaService | null {
  return useContext(MediaServiceContext)
}

interface MediaServiceProviderProps {
  readonly service: MediaService | null
  readonly children: ReactNode
}

/** Entrega um serviço pronto. É por aqui que o teste põe um dublê no lugar. */
export function MediaServiceProvider({
  service,
  children,
}: MediaServiceProviderProps): JSX.Element {
  return (
    <MediaServiceContext.Provider value={service}>{children}</MediaServiceContext.Provider>
  )
}

interface ApiMediaProviderProps {
  readonly gateway: MediaGateway
  readonly children: ReactNode
}

/**
 * O serviço de verdade, ligado à sessão do operador. Um token novo — depois de
 * uma renovação de sessão — produz um serviço novo, para que nenhum envio saia
 * com credencial vencida em mãos.
 */
export function ApiMediaProvider({ gateway, children }: ApiMediaProviderProps): JSX.Element {
  const { state } = useAuth()
  const accessToken = state.status === 'ativa' ? state.session.accessToken : null

  const service = useMemo(
    () => (accessToken === null ? null : new ApiMediaService(gateway, accessToken)),
    [gateway, accessToken],
  )

  return <MediaServiceProvider service={service}>{children}</MediaServiceProvider>
}
