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
 * 2. **A conta nasce pronta para logar, sem link** (D-09, revista na T34):
 *    `POST` recebe e-mail, senha e nome, e nenhuma senha volta na resposta.
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
  const criar = (body: Partial<{ email: string; password: string; name: string }>): request.Test =>
    comToken(agente().post('/api/admin/operators').send(body))
  const remover = (id: string): request.Test =>
    comToken(agente().delete(`/api/admin/operators/${id}`))

  const NOVO_OPERADOR = {
    email: 'nova.operadora@veggiedent.test',
    password: 'senha-inicial-forte',
    name: 'Nova Operadora',
  }

  describe('listagem', () => {
    it('responde 401 sem token', async () => {
      const response = await agente().get('/api/admin/operators')

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
    })

    it('lista os operadores existentes, com e-mail, nome, criação e último login', async () => {
      harness.database.auth.admin.seed({
        id: OPERATOR_ID,
        email: 'operadora@veggiedent.test',
        name: 'Operadora Original',
        createdAt: '2026-08-01T10:00:00.000Z',
        lastSignInAt: '2026-09-04T09:00:00.000Z',
      })

      const response = await listar()

      expect(response.status).toBe(HttpStatus.OK)
      expect(response.body).toEqual([
        {
          id: OPERATOR_ID,
          email: 'operadora@veggiedent.test',
          name: 'Operadora Original',
          createdAt: '2026-08-01T10:00:00.000Z',
          lastSignInAt: '2026-09-04T09:00:00.000Z',
        },
      ])
    })

    it('deriva um nome legível do e-mail para um operador sem nome cadastrado', async () => {
      harness.database.auth.admin.seed({ id: OPERATOR_ID, email: 'ana.paula@veggiedent.test' })

      const response = await listar()

      expect(response.body[0].name).toBe('Ana Paula')
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

  describe('criação', () => {
    it('responde 401 sem token e não cria', async () => {
      const response = await agente().post('/api/admin/operators').send(NOVO_OPERADOR)

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
      expect(harness.database.auth.admin.count()).toBe(0)
    })

    it('cria a conta com e-mail e nome informados, sem devolver a senha', async () => {
      const response = await criar(NOVO_OPERADOR)

      expect(response.status).toBe(HttpStatus.CREATED)
      expect(response.body.email).toBe(NOVO_OPERADOR.email)
      expect(response.body.name).toBe(NOVO_OPERADOR.name)
      expect(response.body.id).toEqual(expect.any(String))
      expect(JSON.stringify(response.body)).not.toMatch(/password|senha-inicial-forte/i)
    })

    it('o operador criado aparece na listagem, pronto — sem link nem segundo passo', async () => {
      await criar(NOVO_OPERADOR)

      const response = await listar()

      expect(response.body).toContainEqual(
        expect.objectContaining({ email: NOVO_OPERADOR.email, name: NOVO_OPERADOR.name }),
      )
    })

    it('recusa e-mail malformado com mensagem clara em português', async () => {
      const response = await criar({ ...NOVO_OPERADOR, email: 'nao-e-email' })

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(response.body.fields.email).toBe('Informe um e-mail válido.')
    })

    it('recusa senha curta com mensagem clara em português, sem chamar o Supabase', async () => {
      const response = await criar({ ...NOVO_OPERADOR, password: '12345' })

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(response.body.fields.password).toBe('A senha precisa ter pelo menos 6 caracteres.')
      expect(harness.database.auth.admin.count()).toBe(0)
    })

    it('recusa nome ausente com mensagem clara em português', async () => {
      const response = await criar({ email: NOVO_OPERADOR.email, password: NOVO_OPERADOR.password })

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(response.body.fields.name).toBe('Informe o nome do operador.')
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
