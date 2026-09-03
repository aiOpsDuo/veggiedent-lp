import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { SectionKey } from '@veggiedent/content-schema'
import { contentSnapshot } from './content-snapshot'
import { fetchPublishedContent } from './fetch-published-content'
import type { PublishedContent, SectionContent } from './published-content'

/**
 * De onde toda seção da página tira o seu conteúdo (SDD § D-08, § C-10).
 *
 * A página começa a renderizar pelo **instantâneo embutido**, sem esperar rede:
 * é ele que garante que uma queda da API não deixe a página vazia, e é ele que
 * permite ao navegador começar a baixar a imagem da abertura no primeiro quadro.
 * A busca em `GET /api/content` acontece em seguida e substitui o instantâneo
 * quando responde. Se não responder — API fora do ar, erro, corpo ilegível —,
 * nada acontece: a página segue exibindo o instantâneo.
 */

const PublishedContentContext = createContext<PublishedContent>(contentSnapshot)

interface PublishedContentProviderProps {
  readonly children: ReactNode
  /** O conteúdo exibido antes de a busca responder. O instantâneo do build. */
  readonly fallback?: PublishedContent
  /** A busca em tempo de execução. Injetada para poder exercitar a queda da API. */
  readonly load?: () => Promise<PublishedContent | null>
}

export function PublishedContentProvider({
  children,
  fallback = contentSnapshot,
  load = fetchPublishedContent,
}: PublishedContentProviderProps) {
  const [content, setContent] = useState<PublishedContent>(fallback)

  useEffect(() => {
    let stillMounted = true

    void load().then((published) => {
      if (stillMounted && published !== null) setContent(published)
    })

    return () => {
      stillMounted = false
    }
  }, [load])

  return (
    <PublishedContentContext.Provider value={content}>{children}</PublishedContentContext.Provider>
  )
}

/** Todo o conteúdo publicado. Use `useSection` quando quiser uma seção só. */
export function usePublishedContent(): PublishedContent {
  return useContext(PublishedContentContext)
}

/**
 * O documento de uma seção, ou `undefined` quando ela não está publicada —
 * seção despublicada não chega na resposta da API (SDD § C-08).
 */
export function useSection<K extends SectionKey>(key: K): SectionContent<K> | undefined {
  return usePublishedContent().sections[key] as SectionContent<K> | undefined
}
