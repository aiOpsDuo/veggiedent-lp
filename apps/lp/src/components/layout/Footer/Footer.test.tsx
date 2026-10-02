import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { PRIVACY_POLICY_URL } from '@veggiedent/content-schema'
import { Footer } from './Footer'

/**
 * Os links institucionais do rodapé (2026-10-02). Até aqui apontavam para
 * `/politica-de-privacidade`, `/termos-de-uso` e `/fale-conosco`, rotas que a
 * LP nunca teve: o clique caía de volta na própria página. Agora levam às
 * páginas do site da Virbac Brasil, em nova aba.
 */

afterEach(cleanup)

function linkInstitucional(nome: string): HTMLElement {
  render(<Footer />)
  const navegacao = screen.getByRole('navigation', { name: 'Links institucionais' })
  return within(navegacao).getByRole('link', { name: new RegExp(`^${nome}`) })
}

describe('Links institucionais do rodapé', () => {
  it.each([
    ['Política de privacidade', PRIVACY_POLICY_URL],
    ['Termos de uso', 'https://br.virbac.com/home/legal-notice.html'],
    ['Fale conosco', 'https://br.virbac.com/contato'],
  ])('"%s" leva a %s', (nome, endereco) => {
    expect(linkInstitucional(nome)).toHaveAttribute('href', endereco)
  })

  it('a política do rodapé é a mesma que a API grava junto do lead', () => {
    expect(PRIVACY_POLICY_URL).toBe('https://br.virbac.com/home/legal-notice.html')
  })

  it.each(['Política de privacidade', 'Termos de uso', 'Fale conosco'])(
    '"%s" abre em nova aba, sem dar à página aberta acesso a esta',
    (nome) => {
      const link = linkInstitucional(nome)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    },
  )

  it('avisa o leitor de tela de que o link abre em nova aba', () => {
    expect(linkInstitucional('Fale conosco')).toHaveAccessibleName(
      'Fale conosco (abre em nova aba)',
    )
  })

  it('nenhum link institucional aponta para uma rota interna da LP', () => {
    render(<Footer />)
    const navegacao = screen.getByRole('navigation', { name: 'Links institucionais' })

    for (const link of within(navegacao).getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\//)
    }
  })
})
