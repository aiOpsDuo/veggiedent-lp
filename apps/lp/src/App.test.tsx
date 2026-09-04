import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { contentSnapshot } from './content/content-snapshot'
import { PublishedContentProvider, useSection } from './content/PublishedContentProvider'
import type { PublishedContent } from './content/published-content'
import type { SectionKey } from '@veggiedent/content-schema'

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

/**
 * A primeira montagem paga o custo de compilar o pedaço carregado por
 * `React.lazy`, e sob a suíte inteira isso passa do 1s padrão do
 * `findBy*` — o teste falhava por prazo, não por a página estar errada. A
 * espera é generosa de propósito: quem resolve primeiro é a asserção, e o
 * prazo só existe para o caso em que a seção nunca aparece.
 */
const MONTAGEM_DA_PAGINA = { timeout: 10_000 }

async function renderizarPagina() {
  render(<App />)
  // A seção de demonstração entra por React.lazy: esperar por ela é esperar a
  // página inteira estar montada.
  await screen.findByRole(
    'heading',
    { name: contentSnapshot.sections.demonstracao!.heading },
    MONTAGEM_DA_PAGINA,
  )
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

  /**
   * O título da Prova de Autoridade é campo de texto rico (T22): a quebra e o
   * destaque saem do HTML que o operador escreve, e não mais de JSX na página.
   */
  it('exibe o título da Prova de Autoridade com a quebra e o destaque em turquesa', async () => {
    vi.stubGlobal('fetch', apiForaDoAr())

    await renderizarPagina()

    const titulo = document.getElementById('prova-autoridade-heading')
    expect(titulo?.querySelector('br')).toHaveClass('hidden', 'lg:block')

    const destaque = titulo?.querySelector('strong')
    expect(destaque).toHaveClass('text-brand-primary-hover', 'font-extrabold')
    expect(destaque?.textContent).toBe('médicos-veterinários,')
    expect(titulo?.textContent).toBe('A recomendação dos médicos-veterinários, em números')
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
    const semOndeComprar = structuredClone(contentSnapshot) as PublishedContent
    delete semOndeComprar.sections.onde_comprar

    vi.stubGlobal('fetch', apiRespondendo(semOndeComprar))

    await renderizarPagina()

    expect(document.getElementById('onde-comprar')).toBeNull()
  })
})

/**
 * Regressão da T27 — o usuário relatou que desligar uma seção no painel não a
 * tira da página (ligar, segundo ele, funciona).
 *
 * A API e o painel foram verificados à parte (SDD § C-08; CHANGELOG de
 * 2026-09-04) e estão corretos. O que estes dois testes cobrem é a ponta que
 * faltava medir: o caminho **instantâneo → API** do lado da LP — a mesma
 * garantia que a suíte acima já prova para "API fora do ar" e "API
 * respondendo", agora aplicada especificamente a uma seção que muda de estado
 * entre o instantâneo embutido e a resposta da API, nas duas direções.
 */
describe('Alterar a visibilidade de uma seção entre o instantâneo e a API (T27)', () => {
  it('some da página uma seção que o instantâneo tinha e a API deixou de entregar (desligar)', async () => {
    // `faq` está publicada no instantâneo embutido — é o que o navegador
    // mostra no primeiro quadro, antes de qualquer resposta de rede.
    expect(contentSnapshot.sections.faq).toBeDefined()

    const semFaq = structuredClone(contentSnapshot) as PublishedContent
    delete semFaq.sections.faq

    vi.stubGlobal('fetch', apiRespondendo(semFaq))

    await renderizarPagina()

    await waitFor(() => {
      expect(document.getElementById('faq')).toBeNull()
    })
  })

  /**
   * A partir da T28 nenhuma das 10 seções do CMS nasce despublicada por
   * padrão (a única que nascia assim, `ingredientes`, foi removida do
   * projeto) — então não existe mais uma seção real para simular "ausente
   * do instantâneo, presente na API" pelo caminho de `<App />` inteiro. O
   * teste abaixo prova o mesmo mecanismo (T27: a resposta da API substitui
   * por completo o que o instantâneo embutido tinha, inclusive acrescentando
   * uma seção que o instantâneo não tinha) direto no provedor, com um
   * instantâneo sintético em vez de depender da composição atual do banco.
   */
  it('mostra uma seção que o instantâneo (`fallback`) não tinha e a API passou a entregar (religar)', async () => {
    function Consumidor({ chave }: { chave: SectionKey }) {
      const secao = useSection(chave)
      return <div data-testid="presenca">{secao === undefined ? 'ausente' : 'presente'}</div>
    }

    const semFaq = structuredClone(contentSnapshot) as PublishedContent
    delete semFaq.sections.faq

    render(
      <PublishedContentProvider fallback={semFaq} load={() => Promise.resolve(contentSnapshot)}>
        <Consumidor chave="faq" />
      </PublishedContentProvider>,
    )

    expect(screen.getByTestId('presenca')).toHaveTextContent('ausente')

    await waitFor(() => {
      expect(screen.getByTestId('presenca')).toHaveTextContent('presente')
    })
  })
})
