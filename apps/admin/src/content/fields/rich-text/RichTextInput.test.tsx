import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { FieldControl } from '../FieldControl'
import type { FieldSpec } from '@veggiedent/content-schema'

/**
 * O campo de texto rico no painel, montado pelo mesmo caminho da tela real: o
 * tipo declarado no esquema escolhe o controle (SDD § D-02).
 *
 * A edição de verdade — digitar, selecionar, marcar em negrito — depende de
 * `beforeinput` e de seleção do navegador, que o jsdom não reproduz com
 * fidelidade; ela é verificada em navegador real. O que dá para prender aqui é
 * o contrato do campo: o que ele mostra ao abrir, e o que ele **não** deixa
 * entrar.
 */

const ESPECIFICACAO: FieldSpec = {
  name: 'heading',
  type: 'texto-rico',
  label: 'Título da seção',
  help: 'O trecho em negrito aparece destacado na página.',
  required: true,
}

function renderizar(value: unknown) {
  return render(
    <FieldControl spec={ESPECIFICACAO} value={value} onChange={vi.fn()} />,
  )
}

afterEach(cleanup)

describe('campo de texto rico', () => {
  it('abre com o conteúdo já guardado, sem mostrar marcação ao operador', async () => {
    renderizar('A recomendação dos<br><strong>médicos-veterinários,</strong> em números')

    const area = await screen.findByRole('textbox', { name: 'Título da seção' })
    await waitFor(() => expect(area).toHaveTextContent('A recomendação dos'))
    // O operador vê o texto formatado, nunca as tags escritas por extenso.
    expect(area.innerHTML).not.toContain('&lt;')
    expect(area.querySelector('br')).not.toBeNull()
    expect(area.querySelector('strong')?.textContent).toBe('médicos-veterinários,')
    expect(area.textContent).toContain(' em números')
  })

  it('oferece as duas ações do campo, e só elas', async () => {
    renderizar('Título')

    expect(await screen.findByRole('button', { name: 'Negrito' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quebra de linha' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('não monta no editor o que veio malicioso do banco', async () => {
    renderizar('<img src=x onerror="window.__invadido = true"><script>window.__invadido = true</script>Título')

    const area = await screen.findByRole('textbox', { name: 'Título da seção' })
    await waitFor(() => expect(area).toHaveTextContent('Título'))
    expect(area.querySelectorAll('script, img, iframe, a')).toHaveLength(0)
    expect(area.innerHTML).not.toMatch(/\son\w+\s*=/i)
    expect((window as unknown as { __invadido?: boolean }).__invadido).toBeUndefined()
  })

  it('anuncia a obrigatoriedade e a ajuda do campo', async () => {
    renderizar('Título')

    const area = await screen.findByRole('textbox', { name: 'Título da seção' })
    expect(area).toHaveAttribute('aria-required', 'true')
    expect(area).toHaveAccessibleDescription('O trecho em negrito aparece destacado na página.')
  })
})
