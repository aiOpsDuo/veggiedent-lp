import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { contentSnapshot } from './content/content-snapshot'
import type { PublishedContent } from './content/published-content'

/**
 * A LP inteira, montada como o navegador a monta (SDD § C-10).
 *
 * O que estes testes protegem é o requisito do PRD de que a indisponibilidade
 * do CMS não derrube a página pública: com `GET /api/content` fora do ar, a
 * página precisa aparecer com o conteúdo do instantâneo embutido, não vazia e
 * não quebrada. O caminho oposto — a API respondendo — também é exercitado,
 * porque um instantâneo que nunca é substituído passaria no primeiro teste sem
 * a LP consumir a API coisa nenhuma.
 */

/** As seções que a página publica hoje, na ordem em que aparecem. */
const SECOES_DA_PAGINA = [
  'hero',
  'educacao',
  'rotina',
  'produto',
  'demonstracao',
  'prova-autoridade',
  'formulario',
  'onde-comprar',
  'faq',
]

function apiForaDoAr() {
  return vi.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch
}

function apiRespondendo(content: PublishedContent) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(content), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch
}

/** O instantâneo com um título de abertura diferente, para saber quem venceu. */
function conteudoDaApiComTitulo(headline: string): PublishedContent {
  const copia = structuredClone(contentSnapshot) as PublishedContent
  return {
    ...copia,
    sections: { ...copia.sections, hero: { ...copia.sections.hero!, headline } },
  }
}

async function renderizarPagina() {
  render(<App />)
  // A seção de demonstração entra por React.lazy: esperar por ela é esperar a
  // página inteira estar montada.
  await screen.findByRole('heading', {
    name: contentSnapshot.sections.demonstracao!.heading,
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('LP com a API de conteúdo indisponível', () => {
  it('renderiza o instantâneo embutido em vez de tela vazia', async () => {
    vi.stubGlobal('fetch', apiForaDoAr())

    await renderizarPagina()

    const hero = contentSnapshot.sections.hero!
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(hero.headline)
    expect(screen.getByText(hero.subheadline)).toBeInTheDocument()
    expect(screen.getByText(contentSnapshot.sections.footer!.copyright)).toBeInTheDocument()
  })

  it('renderiza todas as seções publicadas, e não um esqueleto', async () => {
    vi.stubGlobal('fetch', apiForaDoAr())

    await renderizarPagina()

    for (const id of SECOES_DA_PAGINA) {
      expect(document.getElementById(id), `seção ${id} ausente`).not.toBeNull()
    }
    expect(document.querySelector('header')).not.toBeNull()
    expect(document.querySelector('footer')).not.toBeNull()
  })

  it('mostra as imagens do instantâneo, e não elementos sem endereço', async () => {
    vi.stubGlobal('fetch', apiForaDoAr())

    await renderizarPagina()

    const semEndereco = [...document.images].filter((img) => !img.getAttribute('src'))
    expect(semEndereco).toHaveLength(0)
    expect(screen.getByAltText(contentSnapshot.sections.hero!.imageAlt)).toBeInTheDocument()
  })
})

describe('LP com a API de conteúdo respondendo', () => {
  it('substitui o instantâneo pelo conteúdo publicado que a API entregou', async () => {
    const doCms = 'Título que só existe no CMS'
    vi.stubGlobal('fetch', apiRespondendo(conteudoDaApiComTitulo(doCms)))

    await renderizarPagina()

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(doCms)
    })
    expect(screen.queryByText(contentSnapshot.sections.hero!.headline)).toBeNull()
  })

  it('busca o conteúdo em /api/content', async () => {
    const buscar = apiRespondendo(contentSnapshot)
    vi.stubGlobal('fetch', buscar)

    await renderizarPagina()

    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(1))
    expect(vi.mocked(buscar).mock.calls[0]?.[0]).toBe('/api/content')
  })

  it('não renderiza seção que a API não entrega', async () => {
    vi.stubGlobal('fetch', apiRespondendo(contentSnapshot))

    await renderizarPagina()

    // `ingredientes` está despublicada de propósito: sem conteúdo aprovado, ela
    // não pode aparecer nem como título solto.
    expect(contentSnapshot.sections.ingredientes).toBeUndefined()
    expect(document.getElementById('ingredientes')).toBeNull()
  })
})
