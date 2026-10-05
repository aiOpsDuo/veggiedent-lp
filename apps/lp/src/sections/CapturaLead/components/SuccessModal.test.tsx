import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { SuccessModal } from './SuccessModal'
import { env } from '../../../config/env'
import { contentSnapshot } from '../../../content/content-snapshot'
import type { SectionContent } from '../../../content/published-content'

/**
 * O modal tem dois modos, decididos em build por `VITE_EBOOK_DELIVERY_MODE` e
 * `VITE_EBOOK_URL` (lidos via `config/env`): botão de download do e-book ou o
 * aviso de entrega por e-mail. Desde 2026-10-05 o build do Docker sai no modo
 * download, apontando para o "Guia Everyday Care" em `apps/lp/public/materiais/`.
 * `env` é um objeto mutável, então cada teste ajusta os dois campos e restaura.
 */
const envOriginal = { ...env }

const conteudo = contentSnapshot.sections.captura_lead as SectionContent<'captura_lead'>

function renderizarModal() {
  render(
    <SuccessModal content={conteudo} onClose={vi.fn()} triggerRef={createRef<HTMLButtonElement>()} />,
  )
}

afterEach(() => {
  cleanup()
  Object.assign(env, envOriginal)
})

describe('SuccessModal — entrega do e-book', () => {
  it('no modo download, oferece o link que baixa o PDF em vez de abri-lo por cima da página', () => {
    env.ebookDeliveryMode = 'download'
    env.ebookUrl = '/materiais/guia-everyday-care-virbac.pdf'

    renderizarModal()

    const link = screen.getByRole('link', { name: conteudo.successModalDownloadCtaLabel })
    expect(link.getAttribute('href')).toBe('/materiais/guia-everyday-care-virbac.pdf')
    expect(link.hasAttribute('download')).toBe(true)
    expect(screen.getByText(conteudo.successModalBody)).toBeTruthy()
  })

  it('sem URL configurada, não mostra botão apontando para lugar nenhum', () => {
    env.ebookDeliveryMode = 'download'
    env.ebookUrl = ''

    renderizarModal()

    expect(screen.queryByRole('link')).toBeNull()
  })

  it('no modo e-mail, mostra só o aviso, sem link de download', () => {
    env.ebookDeliveryMode = 'email'
    env.ebookUrl = '/materiais/guia-everyday-care-virbac.pdf'

    renderizarModal()

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText(/Enviamos o guia para o seu e-mail/)).toBeTruthy()
  })
})
