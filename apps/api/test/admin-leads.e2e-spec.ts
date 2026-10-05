import { HttpStatus } from '@nestjs/common'
import request from 'supertest'
import { startContentHarness, type ContentHarness } from './content-harness'
import type { Row } from './fake-supabase'

/**
 * Rotas administrativas de lead (T8; SDD § C-12 e § "Endpoints administrativos").
 *
 * O que esta suíte prende, em ordem de importância:
 *
 * 1. **Nenhum lead é acessível sem autenticação** — listagem, exportação e
 *    exclusão respondem `401` sem token, e nada do conteúdo aparece na resposta.
 * 2. **A listagem vem do mais recente ao mais antigo**, paginada.
 * 3. **O filtro por período inclui os dois dias extremos por inteiro.**
 * 4. **A busca por e-mail acha o titular** por trecho, sem diferenciar
 *    maiúsculas, com `%` e `_` como texto — somada ao período e à paginação.
 * 5. **O CSV abre no Excel em português**: BOM, ponto e vírgula, acentuação.
 * 6. **A exclusão apaga de verdade** — é o pedido do titular, e não há desfazer.
 */

const ROTA = '/api/admin/leads'
const EXPORTACAO = `${ROTA}/export`

function lead(id: string, createdAt: string, overrides: Row = {}): Row {
  return {
    id,
    nome: 'Ana Conceição',
    email: `${id}@exemplo.com`,
    telefone: '11999999999',
    nome_cachorro: 'Bidu',
    porte_cachorro: 'medio',
    cidade_estado: 'São Paulo/SP',
    conhece_virbac: 'sim',
    usa_produto_virbac: 'não',
    qual_produto_virbac: null,
    aceite_comunicacoes: true,
    origem: 'lp-veggiedent',
    created_at: createdAt,
    aceite_lgpd: true,
    aceite_lgpd_em: createdAt,
    aceite_lgpd_texto: 'Li e aceito a Política de Privacidade.',
    aceite_lgpd_politica_url: 'https://br.virbac.com/home/legal-notice.html',
    ...overrides,
  }
}

const PRIMEIRO = '11111111-1111-4111-8111-111111111111'
const SEGUNDO = '22222222-2222-4222-8222-222222222222'
const TERCEIRO = '33333333-3333-4333-8333-333333333333'
const INEXISTENTE = '44444444-4444-4444-8444-444444444444'

describe('rotas administrativas de leads', () => {
  let harness: ContentHarness

  beforeEach(async () => {
    harness = await startContentHarness()
    harness.database.seed('leads', [
      lead(PRIMEIRO, '2026-09-01T10:00:00.000Z'),
      lead(SEGUNDO, '2026-09-03T23:50:00.000Z'),
      lead(TERCEIRO, '2026-09-05T08:00:00.000Z', { nome: 'Bruno Araújo' }),
    ])
  })

  afterEach(async () => {
    await harness.close()
  })

  const agente = (): request.Agent => request.agent(harness.app.getHttpServer())
  const comToken = (req: request.Test): request.Test =>
    req.set('authorization', `Bearer ${harness.token}`)

  describe('nenhum lead é acessível sem autenticação', () => {
    it('listagem sem token responde 401 e não devolve lead nenhum', async () => {
      const resposta = await agente().get(ROTA)

      expect(resposta.status).toBe(HttpStatus.UNAUTHORIZED)
      expect(resposta.text).not.toContain('exemplo.com')
    })

    it('exportação sem token responde 401 e não devolve CSV', async () => {
      const resposta = await agente().get(EXPORTACAO)

      expect(resposta.status).toBe(HttpStatus.UNAUTHORIZED)
      expect(resposta.text).not.toContain('exemplo.com')
    })

    it('exclusão sem token responde 401 e não apaga nada', async () => {
      const resposta = await agente().delete(`${ROTA}/${PRIMEIRO}`)

      expect(resposta.status).toBe(HttpStatus.UNAUTHORIZED)
      expect(harness.database.rows('leads')).toHaveLength(3)
    })

    it('token inválido também é recusado', async () => {
      const resposta = await agente().get(ROTA).set('authorization', 'Bearer nao-e-um-token')

      expect(resposta.status).toBe(HttpStatus.UNAUTHORIZED)
    })
  })

  describe('listagem', () => {
    it('vem do mais recente ao mais antigo', async () => {
      const resposta = await comToken(agente().get(ROTA))

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(resposta.body.leads.map((item: { id: string }) => item.id)).toEqual([
        TERCEIRO,
        SEGUNDO,
        PRIMEIRO,
      ])
    })

    it('devolve os três campos antes descartados, já em camelCase', async () => {
      const resposta = await comToken(agente().get(ROTA))

      expect(resposta.body.leads[0]).toMatchObject({
        conheceVirbac: 'sim',
        usaProdutoVirbac: 'não',
        qualProdutoVirbac: null,
      })
    })

    it('devolve o registro do consentimento LGPD', async () => {
      const resposta = await comToken(agente().get(ROTA))

      expect(resposta.body.leads[0]).toMatchObject({
        aceiteLgpd: true,
        aceiteLgpdEm: '2026-09-05T08:00:00.000Z',
        aceiteLgpdTexto: 'Li e aceito a Política de Privacidade.',
        aceiteLgpdPoliticaUrl: 'https://br.virbac.com/home/legal-notice.html',
      })
    })

    it('informa o total, a página e o tamanho da página', async () => {
      const resposta = await comToken(agente().get(ROTA).query({ page: 1, pageSize: 2 }))

      expect(resposta.body).toMatchObject({ total: 3, page: 1, pageSize: 2 })
      expect(resposta.body.leads).toHaveLength(2)
    })

    it('a segunda página continua de onde a primeira parou', async () => {
      const resposta = await comToken(agente().get(ROTA).query({ page: 2, pageSize: 2 }))

      expect(resposta.body.leads.map((item: { id: string }) => item.id)).toEqual([PRIMEIRO])
    })

    it('página além da última devolve lista vazia, não erro', async () => {
      const resposta = await comToken(agente().get(ROTA).query({ page: 9, pageSize: 2 }))

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(resposta.body.leads).toEqual([])
      expect(resposta.body.total).toBe(3)
    })

    it('página zero é recusada com 422', async () => {
      const resposta = await comToken(agente().get(ROTA).query({ page: 0 }))

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(resposta.body.fields).toHaveProperty('page')
    })

    it('filtro por período inclui os dois dias extremos por inteiro', async () => {
      const resposta = await comToken(
        agente().get(ROTA).query({ from: '2026-09-01', to: '2026-09-03' }),
      )

      expect(resposta.body.leads.map((item: { id: string }) => item.id)).toEqual([
        SEGUNDO,
        PRIMEIRO,
      ])
      expect(resposta.body.total).toBe(2)
    })

    it('filtro de um único dia traz só o daquele dia', async () => {
      const resposta = await comToken(
        agente().get(ROTA).query({ from: '2026-09-03', to: '2026-09-03' }),
      )

      expect(resposta.body.leads.map((item: { id: string }) => item.id)).toEqual([SEGUNDO])
    })

    it('data fora do formato é recusada com 422', async () => {
      const resposta = await comToken(agente().get(ROTA).query({ from: '03/09/2026' }))

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(resposta.body.fields).toHaveProperty('from')
    })

    it('período invertido é recusado com 422', async () => {
      const resposta = await comToken(
        agente().get(ROTA).query({ from: '2026-09-05', to: '2026-09-01' }),
      )

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    })
  })

  /**
   * A busca por e-mail (pedido do cliente de 2026-10-05): o Marketing recebe o
   * pedido de exclusão com o e-mail do titular e precisa achar o lead dele.
   * Os cinco leads abaixo têm e-mails escolhidos para cada borda — maiúsculas
   * gravadas, `_` e `%` que não podem virar curinga, e duas pessoas no mesmo
   * domínio para o total da paginação.
   */
  describe('busca por e-mail', () => {
    const MARIA = 'aaaaaaaa-0000-4000-8000-000000000001'
    const MARIA_DE_NOVO = 'aaaaaaaa-0000-4000-8000-000000000002'
    const MARIAXS = 'aaaaaaaa-0000-4000-8000-000000000003'
    const CEM_POR_CENTO = 'aaaaaaaa-0000-4000-8000-000000000004'
    const JOAO = 'aaaaaaaa-0000-4000-8000-000000000005'

    beforeEach(() => {
      harness.database.seed('leads', [
        lead(MARIA, '2026-09-01T15:00:00.000Z', { email: 'Maria_Souza@Gmail.com' }),
        lead(MARIA_DE_NOVO, '2026-09-03T15:00:00.000Z', { email: 'maria_souza@gmail.com' }),
        lead(MARIAXS, '2026-09-03T16:00:00.000Z', { email: 'mariaXsouza@gmail.com' }),
        lead(CEM_POR_CENTO, '2026-09-04T15:00:00.000Z', { email: 'cem100%@exemplo.com' }),
        lead(JOAO, '2026-09-05T15:00:00.000Z', { email: 'joao@exemplo.com', nome: 'João Lima' }),
      ])
    })

    const idsDaBusca = async (filtros: Record<string, string | number>): Promise<string[]> => {
      const resposta = await comToken(agente().get(ROTA).query(filtros))

      expect(resposta.status).toBe(HttpStatus.OK)
      return resposta.body.leads.map((item: { id: string }) => item.id)
    }

    it('acha por trecho do e-mail', async () => {
      expect(await idsDaBusca({ email: '@exemplo' })).toEqual([JOAO, CEM_POR_CENTO])
    })

    it('não diferencia maiúsculas de minúsculas', async () => {
      expect(await idsDaBusca({ email: 'MARIA_SOUZA@' })).toEqual([MARIA_DE_NOVO, MARIA])
    })

    it('trata _ como texto, não como qualquer caractere', async () => {
      expect(await idsDaBusca({ email: 'a_s' })).toEqual([MARIA_DE_NOVO, MARIA])
    })

    it('trata % como texto, não como qualquer trecho', async () => {
      expect(await idsDaBusca({ email: '%' })).toEqual([CEM_POR_CENTO])
    })

    it('apara as bordas, e busca vazia não filtra', async () => {
      expect(await idsDaBusca({ email: '  joao@  ' })).toEqual([JOAO])
      expect(await idsDaBusca({ email: '   ' })).toHaveLength(5)
    })

    const GMAIL_NO_DIA_3 = { email: 'gmail', from: '2026-09-03', to: '2026-09-03', pageSize: 1 }

    it('se soma ao período, e o total conta só o que passou pelos dois', async () => {
      const resposta = await comToken(agente().get(ROTA).query({ ...GMAIL_NO_DIA_3, page: 1 }))

      expect(resposta.body).toMatchObject({ total: 2, page: 1, pageSize: 1 })
      expect(resposta.body.leads.map((item: { id: string }) => item.id)).toEqual([MARIAXS])
    })

    it('a segunda página da busca continua de onde a primeira parou', async () => {
      expect(await idsDaBusca({ ...GMAIL_NO_DIA_3, page: 2 })).toEqual([MARIA_DE_NOVO])
    })

    it('nenhum e-mail encontrado devolve lista vazia e total zero, não erro', async () => {
      const resposta = await comToken(agente().get(ROTA).query({ email: 'ninguem@' }))

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(resposta.body).toMatchObject({ leads: [], total: 0 })
    })

    it('busca mais longa que a coluna de e-mail é recusada com 422', async () => {
      const resposta = await comToken(agente().get(ROTA).query({ email: 'a'.repeat(256) }))

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(resposta.body.fields).toHaveProperty('email')
    })

    it('e-mail repetido na URL é recusado com 422, pedindo texto', async () => {
      const resposta = await comToken(agente().get(`${ROTA}?email=maria&email=joao`))

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(resposta.body.fields).toEqual({ email: 'Informe o e-mail da busca como texto.' })
    })

    it('aceita a busca no tamanho exato da coluna', async () => {
      const resposta = await comToken(agente().get(ROTA).query({ email: 'a'.repeat(255) }))

      expect(resposta.status).toBe(HttpStatus.OK)
    })

    it('a exportação traz só os leads da busca', async () => {
      const resposta = await comToken(agente().get(EXPORTACAO).query({ email: 'MARIA_souza' }))

      const linhas = resposta.text.split('\r\n').filter((linha) => linha.length > 0)
      expect(linhas).toHaveLength(3)
      expect(resposta.text).toContain('"Maria_Souza@Gmail.com"')
      expect(resposta.text).toContain('"maria_souza@gmail.com"')
      expect(resposta.text).not.toContain('mariaXsouza')
      expect(resposta.text).not.toContain('João Lima')
    })

    it('a exportação soma a busca ao período', async () => {
      const resposta = await comToken(
        agente().get(EXPORTACAO).query({ email: 'maria_souza', from: '2026-09-03' }),
      )

      const linhas = resposta.text.split('\r\n').filter((linha) => linha.length > 0)
      expect(linhas).toHaveLength(2)
      expect(resposta.text).toContain('"maria_souza@gmail.com"')
    })

    it('a exportação recusa a busca longa demais com 422', async () => {
      const resposta = await comToken(agente().get(EXPORTACAO).query({ email: 'a'.repeat(256) }))

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      // A rota declara `text/csv`, então o erro chega como texto; o corpo é o JSON de sempre.
      expect(JSON.parse(resposta.text).fields).toHaveProperty('email')
    })
  })

  /**
   * O dia do filtro é o dia que o operador viveu, em Brasília, e não o dia em
   * UTC. Os dois leads abaixo estão a duas horas de distância um do outro e em
   * dias diferentes nos dois fusos — é a borda em que um recorte feito em UTC
   * jogaria o lead da noite para o dia seguinte.
   */
  describe('o dia do filtro é o dia de Brasília', () => {
    const AS_23H_DO_DIA_2 = '2026-09-03T02:00:00.000Z'
    const A_1H_DO_DIA_3 = '2026-09-03T04:00:00.000Z'

    beforeEach(() => {
      harness.database.seed('leads', [
        lead(PRIMEIRO, AS_23H_DO_DIA_2),
        lead(SEGUNDO, A_1H_DO_DIA_3),
      ])
    })

    const idsDoDia = async (dia: string): Promise<string[]> => {
      const resposta = await comToken(agente().get(ROTA).query({ from: dia, to: dia }))

      expect(resposta.status).toBe(HttpStatus.OK)
      return resposta.body.leads.map((item: { id: string }) => item.id)
    }

    it('o lead das 23h de 2 de setembro é do dia 2', async () => {
      expect(await idsDoDia('2026-09-02')).toEqual([PRIMEIRO])
    })

    it('o lead da 1h de 3 de setembro é do dia 3', async () => {
      expect(await idsDoDia('2026-09-03')).toEqual([SEGUNDO])
    })

    it('a exportação recorta o dia do mesmo jeito que a listagem', async () => {
      const resposta = await comToken(
        agente().get(EXPORTACAO).query({ from: '2026-09-02', to: '2026-09-02' }),
      )

      const linhas = resposta.text.split('\r\n').filter((linha) => linha.length > 0)
      expect(linhas).toHaveLength(2)
      expect(resposta.text).toContain(PRIMEIRO)
      expect(resposta.text).not.toContain(SEGUNDO)
    })

    /**
     * A divergência que a T18 fecha: em UTC este lead sairia da planilha como
     * 03/09, enquanto a tela do painel o mostra como 02/09. Um lead, duas datas.
     */
    it('a data no CSV é a de Brasília, a mesma que a tela mostra', async () => {
      const resposta = await comToken(
        agente().get(EXPORTACAO).query({ from: '2026-09-02', to: '2026-09-02' }),
      )

      expect(resposta.text).toContain('"02/09/2026 23:00:00"')
      expect(resposta.text).not.toContain('03/09/2026')
    })

    it('o cabeçalho da data diz de que fuso ela é', async () => {
      const resposta = await comToken(agente().get(EXPORTACAO))

      expect(resposta.text.split('\r\n')[0]).toContain('"Data de envio (Brasília)"')
    })
  })

  describe('exportação em CSV', () => {
    it('responde como CSV, com nome de arquivo para baixar', async () => {
      const resposta = await comToken(agente().get(EXPORTACAO))

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(resposta.headers['content-type']).toContain('text/csv')
      expect(resposta.headers['content-disposition']).toMatch(/attachment; filename="leads-/)
    })

    it('começa com o BOM UTF-8 e separa por ponto e vírgula', async () => {
      const resposta = await comToken(agente().get(EXPORTACAO))

      expect(resposta.text.charCodeAt(0)).toBe(0xfeff)
      expect(resposta.text.split('\r\n')[0]).toContain('"Nome";"E-mail"')
    })

    it('preserva a acentuação dos dados e dos títulos', async () => {
      const resposta = await comToken(agente().get(EXPORTACAO))

      expect(resposta.text).toContain('Ana Conceição')
      expect(resposta.text).toContain('Aceite de comunicações')
    })

    /**
     * O registro do consentimento LGPD (pedido do cliente de 2026-10-02) sai na
     * planilha que chega ao Marketing, que é quem atende a revogação.
     */
    it('traz o registro do consentimento LGPD', async () => {
      const resposta = await comToken(agente().get(EXPORTACAO))

      const [cabecalho, primeira] = resposta.text.split('\r\n')
      expect(cabecalho).toContain(
        '"Consentimento LGPD";"Consentimento LGPD em (Brasília)";"Texto do consentimento LGPD";"Política de Privacidade aceita"',
      )
      expect(primeira).toContain(
        '"sim";"05/09/2026 05:00:00";"Li e aceito a Política de Privacidade.";"https://br.virbac.com/home/legal-notice.html"',
      )
    })

    it('respeita o mesmo filtro de período da listagem', async () => {
      const resposta = await comToken(agente().get(EXPORTACAO).query({ to: '2026-09-01' }))

      const linhas = resposta.text.split('\r\n').filter((linha) => linha.length > 0)
      expect(linhas).toHaveLength(2)
      expect(resposta.text).not.toContain('Bruno Araújo')
    })

    it('exporta do mais recente ao mais antigo, como a tela mostra', async () => {
      const resposta = await comToken(agente().get(EXPORTACAO))

      const linhas = resposta.text.split('\r\n')
      expect(linhas[1]).toContain(TERCEIRO)
      expect(linhas[3]).toContain(PRIMEIRO)
    })
  })

  describe('exclusão a pedido do titular', () => {
    it('apaga definitivamente e responde 204', async () => {
      const resposta = await comToken(agente().delete(`${ROTA}/${SEGUNDO}`))

      expect(resposta.status).toBe(HttpStatus.NO_CONTENT)
      expect(harness.database.rows('leads').map((row) => row.id)).toEqual([PRIMEIRO, TERCEIRO])
    })

    it('o lead apagado some da listagem', async () => {
      await comToken(agente().delete(`${ROTA}/${SEGUNDO}`))
      const resposta = await comToken(agente().get(ROTA))

      expect(resposta.body.total).toBe(2)
      expect(resposta.text).not.toContain(SEGUNDO)
    })

    it('identificador inexistente responde 404', async () => {
      const resposta = await comToken(agente().delete(`${ROTA}/${INEXISTENTE}`))

      expect(resposta.status).toBe(HttpStatus.NOT_FOUND)
      expect(harness.database.rows('leads')).toHaveLength(3)
    })

    it('identificador malformado responde 404, não erro do banco', async () => {
      const resposta = await comToken(agente().delete(`${ROTA}/nao-e-uuid`))

      expect(resposta.status).toBe(HttpStatus.NOT_FOUND)
    })
  })

  it('a rota de exportação não é confundida com um identificador de lead', async () => {
    const resposta = await comToken(agente().get(EXPORTACAO))

    expect(resposta.status).toBe(HttpStatus.OK)
    expect(resposta.headers['content-type']).toContain('text/csv')
  })
})
