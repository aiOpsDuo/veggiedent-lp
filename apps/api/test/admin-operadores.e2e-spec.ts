import { HttpStatus } from '@nestjs/common'
import request from 'supertest'
import { OPERATOR_ID, startContentHarness, type ContentHarness } from './content-harness'

/**
 * Rotas de gestão de operadores (SDD § D-09, § C-13, § R-10).
 *
 * O que esta suíte prende, em ordem de importância:
 *
 * 1. **As duas recusas de R-10**: remover a si mesmo e remover o último
 *    operador restante respondem `409`, sem apagar ninguém. É a prova em
 *    nível de HTTP das mesmas regras que `remove-operator.use-case.spec.ts`
 *    prova por mutação em nível de unidade.
 * 2. **O link de convite nunca é senha**: `POST` devolve um link, nunca
 *    define credencial nenhuma.
 * 3. **Tudo aqui exige token** — a guarda global cobre a listagem também.
 */

describe('rotas administrativas de operadores', () => {
  let harness: ContentHarness

  beforeEach(async () => {
    harness = await startContentHarness()
  })

  afterEach(async () => {
    await harness.close()
  })

  const agente = (): request.Agent => request.agent(harness.app.getHttpServer())
  const comToken = (req: request.Test): request.Test =>
    req.set('authorization', `Bearer ${harness.token}`)

  const listar = (): request.Test => comToken(agente().get('/api/admin/operators'))
  const convidar = (email: string): request.Test =>
    comToken(agente().post('/api/admin/operators').send({ email }))
  const remover = (id: string): request.Test =>
    comToken(agente().delete(`/api/admin/operators/${id}`))

  describe('listagem', () => {
    it('responde 401 sem token', async () => {
      const response = await agente().get('/api/admin/operators')

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
    })

    it('lista os operadores existentes, com e-mail, criação e último login', async () => {
      harness.database.auth.admin.seed({
        id: OPERATOR_ID,
        email: 'operadora@veggiedent.test',
        createdAt: '2026-08-01T10:00:00.000Z',
        lastSignInAt: '2026-09-04T09:00:00.000Z',
      })

      const response = await listar()

      expect(response.status).toBe(HttpStatus.OK)
      expect(response.body).toEqual([
        {
          id: OPERATOR_ID,
          email: 'operadora@veggiedent.test',
          createdAt: '2026-08-01T10:00:00.000Z',
          lastSignInAt: '2026-09-04T09:00:00.000Z',
        },
      ])
    })

    it('lista mais recente primeiro', async () => {
      harness.database.auth.admin.seed({
        id: OPERATOR_ID,
        email: 'antiga@veggiedent.test',
        createdAt: '2026-08-01T10:00:00.000Z',
      })
      harness.database.auth.admin.seed({
        id: '22222222-0000-4000-8000-000000000002',
        email: 'recente@veggiedent.test',
        createdAt: '2026-09-01T10:00:00.000Z',
      })

      const response = await listar()

      expect(response.body.map((operator: { email: string }) => operator.email)).toEqual([
        'recente@veggiedent.test',
        'antiga@veggiedent.test',
      ])
    })
  })

  describe('convite', () => {
    it('responde 401 sem token e não convida', async () => {
      const response = await agente()
        .post('/api/admin/operators')
        .send({ email: 'nova@veggiedent.test' })

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
      expect(harness.database.auth.admin.count()).toBe(0)
    })

    it('gera o link de ativação de uso único e o devolve na resposta', async () => {
      const response = await convidar('nova.operadora@veggiedent.test')

      expect(response.status).toBe(HttpStatus.CREATED)
      expect(response.body.email).toBe('nova.operadora@veggiedent.test')
      expect(response.body.activationLink).toEqual(expect.any(String))
      expect(response.body.activationLink).toContain('nova.operadora%40veggiedent.test')
      /** Nenhuma senha viaja nesta resposta (SDD § D-09). */
      expect(JSON.stringify(response.body)).not.toMatch(/password|senha/i)
    })

    it('o convidado aparece na listagem depois do convite', async () => {
      await convidar('nova.operadora@veggiedent.test')

      const response = await listar()

      expect(response.body.map((operator: { email: string }) => operator.email)).toContain(
        'nova.operadora@veggiedent.test',
      )
    })

    it('aponta o link de ativação para a rota do painel, não para o Site URL padrão do Supabase', async () => {
      const response = await convidar('nova.operadora@veggiedent.test')

      const link = new URL(response.body.activationLink)
      expect(link.searchParams.get('redirect_to')).toBe(
        `${process.env.ADMIN_APP_URL}/admin/ativar`,
      )
    })

    it('recusa e-mail malformado com mensagem clara em português', async () => {
      const response = await convidar('nao-e-email')

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(response.body.fields.email).toBe('Informe um e-mail válido.')
    })
  })

  describe('remoção', () => {
    const OUTRO_OPERADOR = '22222222-0000-4000-8000-000000000002'

    beforeEach(() => {
      harness.database.auth.admin.seed({ id: OPERATOR_ID, email: 'operadora@veggiedent.test' })
    })

    it('responde 401 sem token e não remove', async () => {
      harness.database.auth.admin.seed({ id: OUTRO_OPERADOR, email: 'outro@veggiedent.test' })

      const response = await agente().delete(`/api/admin/operators/${OUTRO_OPERADOR}`)

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
      expect(harness.database.auth.admin.has(OUTRO_OPERADOR)).toBe(true)
    })

    it('remove um operador que não é o autenticado, havendo outro restante', async () => {
      harness.database.auth.admin.seed({ id: OUTRO_OPERADOR, email: 'outro@veggiedent.test' })

      const response = await remover(OUTRO_OPERADOR)

      expect(response.status).toBe(HttpStatus.NO_CONTENT)
      expect(harness.database.auth.admin.has(OUTRO_OPERADOR)).toBe(false)
    })

    /** R-10, primeira recusa: ninguém remove a própria conta. */
    it('recusa com 409 remover a si mesmo, mesmo havendo outro operador', async () => {
      harness.database.auth.admin.seed({ id: OUTRO_OPERADOR, email: 'outro@veggiedent.test' })

      const response = await remover(OPERATOR_ID)

      expect(response.status).toBe(HttpStatus.CONFLICT)
      expect(response.body).toEqual({
        statusCode: HttpStatus.CONFLICT,
        error: 'Um operador não pode remover a própria conta.',
      })
      expect(harness.database.auth.admin.has(OPERATOR_ID)).toBe(true)
    })

    /**
     * R-10, segunda recusa: o último operador restante não sai da lista.
     *
     * A checagem de "a si mesmo" compara o alvo com o id do token, não com a
     * lista de operadores (`remove-operator.use-case.ts`) — então, para
     * exercitar a segunda guarda isoladamente, o cenário aqui é o de um token
     * cuja conta já não existe mais no Supabase Auth (ex.: removida por outro
     * caminho, sessão ainda não expirada): o alvo da remoção **não é** "eu
     * mesmo" segundo o token, e ainda assim é o único operador que resta.
     */
    it('recusa com 409 remover o único operador restante, quando o alvo não é o próprio autenticado', async () => {
      const database = harness.database
      await database.auth.admin.deleteUser(OPERATOR_ID)
      database.auth.admin.seed({ id: OUTRO_OPERADOR, email: 'unico@veggiedent.test' })

      const response = await remover(OUTRO_OPERADOR)

      expect(response.status).toBe(HttpStatus.CONFLICT)
      expect(response.body).toEqual({
        statusCode: HttpStatus.CONFLICT,
        error: 'Não é possível remover o último operador restante.',
      })
      expect(database.auth.admin.has(OUTRO_OPERADOR)).toBe(true)
    })

    it('responde 404 ao remover um id que não é operador', async () => {
      const response = await remover('00000000-0000-4000-8000-00000000dead')

      expect(response.status).toBe(HttpStatus.NOT_FOUND)
    })
  })
})
