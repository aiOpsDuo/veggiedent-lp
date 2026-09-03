import { lazy, Suspense, useEffect } from 'react'
import { SkipToContentLink } from './components/layout/SkipToContentLink'
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
import { Hero } from './sections/Hero'
import { Educacao } from './sections/Educacao'
import { RotinaCuidado } from './sections/RotinaCuidado'
import { Produto } from './sections/Produto'
import { Ingredientes } from './sections/Ingredientes'
import { ProvaAutoridade } from './sections/ProvaAutoridade'
import { CapturaLead } from './sections/CapturaLead'
import { OndeComprar } from './sections/OndeComprar'
import { Faq } from './sections/Faq'
import { useTracking } from './hooks/useTracking'
import { PublishedContentProvider } from './content/PublishedContentProvider'

// Demonstracao e a unica secao com React.lazy — decisao tecnica registrada no
// relatorio de comparacao v1.0 -> v1.1: e a secao que carrega o VideoPlayer
// (video.js-like markup + dois elementos <video> com poster/track), o unico
// bloco da pagina com peso real fora do bundle principal. LeadCaptureForm e
// ClaimsInfographic foram avaliados e mantidos no bundle principal (ver
// relatorio: o ganho de um chunk separado para eles e irrelevante frente ao
// tamanho total medido apos o build).
const Demonstracao = lazy(() =>
  import('./sections/Demonstracao').then((module) => ({ default: module.Demonstracao })),
)

// App.tsx so importa e organiza as secoes (Especificacao Funcional, secao 3.3).
// Nenhuma logica de secao, nenhum JSX de conteudo, nenhum texto solto aqui.
//
// O conteudo de todas elas vem de GET /api/content, servido pelo provedor que
// envolve a pagina (SDD, D-08 e C-10). Uma secao despublicada nao aparece: o
// proprio componente devolve null quando a API nao a entrega.
export default function App() {
  const { track } = useTracking()

  useEffect(() => {
    track('page_view', { page_path: window.location.pathname })
  }, [track])

  return (
    <PublishedContentProvider>
      <SkipToContentLink />
      <Header />

      <main id="main-content">
        <Hero />
        <Educacao />
        <RotinaCuidado />
        <Produto />
        <Suspense fallback={<div className="mx-auto max-w-content px-4 py-12 sm:px-8 lg:py-24" aria-hidden="true" />}>
          <Demonstracao />
        </Suspense>
        <Ingredientes />
        <ProvaAutoridade />
        <CapturaLead />
        <OndeComprar />
        <Faq />
      </main>

      <Footer />
    </PublishedContentProvider>
  )
}
