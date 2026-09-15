# Publicar a LP no Vercel

Só a LP (`apps/lp`), servida por CDN. O painel e a API continuam no Render —
ver [`docs/RENDER.md`](RENDER.md).

| Onde | O quê |
|---|---|
| Vercel | `https://<projeto>.vercel.app/` → LP estática |
| Vercel (encaminhado) | `https://<projeto>.vercel.app/api/*` → API no Render |
| Render | `https://veggiedent.onrender.com/admin` → painel |

## A razão de existir o encaminhamento de `/api`

**A API não tem CORS.** Não é esquecimento de configuração: `apps/api` nunca
chama `enableCors`, em lugar nenhum. A variável `ALLOWED_ORIGINS` é validada na
inicialização e nunca aplicada. Isso nunca incomodou porque, no desenho de
origem única, LP, painel e API dividem o domínio e não existe requisição entre
origens.

Pôr a LP no Vercel quebra exatamente essa premissa. Contra a API publicada:

```
$ curl -D - -H 'Origin: https://exemplo.vercel.app' \
    https://veggiedent.onrender.com/api/content
HTTP/1.1 200 OK
# ... e nenhum Access-Control-Allow-Origin

$ curl -X OPTIONS -H 'Origin: https://exemplo.vercel.app' \
    -H 'Access-Control-Request-Method: POST' \
    https://veggiedent.onrender.com/api/leads
HTTP/1.1 404 Not Found
```

O que isso causaria numa LP servida de outra origem:

- **Conteúdo:** o `fetch` de `/api/content` falha, e
  `fetchPublishedContent` devolve `null` sem lançar — por desenho. A página
  renderiza o instantâneo embutido (`content-snapshot.json`) e fica com cara de
  saudável. **Falha em silêncio:** o que o marketing publicar no painel não
  aparece, e nada na tela diz por quê.
- **Lead:** `submitLead` **lança** quando a resposta não é 2xx, de propósito —
  o comentário do arquivo diz que engolir isso faria a página agradecer por um
  lead que não foi gravado. Com o preflight em 404, todo envio vira erro
  visível. A captação para de funcionar.

Duas saídas eram possíveis:

1. **Ligar CORS na API.** Mexe em `apps/api`, exige manter uma lista de origens
   e faz a LP depender de um endereço absoluto.
2. **Encaminhar `/api/*` no Vercel** para o Render. O navegador só vê a origem
   do Vercel; não há requisição entre origens e, portanto, não há o que liberar.

A segunda é a escolhida, e está no [`vercel.json`](../vercel.json). Ela tem uma
propriedade que a primeira não tem: a LP continua chamando **caminhos
relativos** (`/api/content`, `/api/leads`), que já são os padrões de
`apps/lp/src/config/env.ts`. Nenhuma variável de ambiente, nenhuma alteração de
código, e o mesmo build que roda no Render roda aqui.

## Passo a passo

### 1. Suba o `vercel.json`

Ele precisa estar na branch que o Vercel vai publicar.

### 2. Crie o projeto

No painel do Vercel: **Add New > Project**, importe `aiOpsDuo/veggiedent-lp`.

### 3. Configure — o ponto em que um monorepo costuma quebrar

| Campo | Valor | Por quê |
|---|---|---|
| Root Directory | **`.`** (a raiz do repositório) | **Não** aponte para `apps/lp`. A LP depende de `@veggiedent/content-schema`, que é um workspace irmão; instalando só de dentro de `apps/lp`, o npm não resolve esse pacote e o build morre. |
| Framework Preset | Vite | |
| Install Command | `npm ci --include=dev` | |
| Build Command | `npm run build -w apps/lp` | |
| Output Directory | `apps/lp/dist` | |

O `vercel.json` já declara os quatro últimos; preenchê-los na interface é
redundante, mas não atrapalha. **Root Directory não** vem do arquivo — esse é o
único que você precisa acertar na mão.

O `--include=dev` está aqui pela mesma razão que está no Render: o build é
`tsc --noEmit && vite build`, e `vite`, `typescript`, `tailwindcss`, `vitest` e
`@testing-library/jest-dom` são todos devDependencies. Se o ambiente definir
`NODE_ENV=production`, o npm passa a tratar isso como `--omit=dev` e o build
morre em `error TS2688: Cannot find type definition file for 'vitest/globals'`.

### 4. Variáveis de ambiente: nenhuma é obrigatória

A LP lê só quatro, e as duas que importam já têm o padrão relativo certo
(`/api/content` e `/api/leads`), que é o que o encaminhamento serve.

**Não** copie as variáveis do Render para cá. `VITE_SUPABASE_URL` e
`VITE_SUPABASE_PUBLISHABLE_KEY` existem lá por causa do **painel**; a LP não
importa `@supabase/supabase-js` e não tem uso para elas.

Opcionais, se quiser mudar o comportamento do e-book:

| Variável | Padrão |
|---|---|
| `VITE_EBOOK_DELIVERY_MODE` | `email` |
| `VITE_EBOOK_URL` | vazio |

### 5. Publique e verifique

```bash
curl -I https://<projeto>.vercel.app/                 # 200, text/html
curl -s  https://<projeto>.vercel.app/api/health      # {"status":"ok"} — prova o encaminhamento
curl -s  https://<projeto>.vercel.app/api/content | head -c 200
```

E no navegador, que é onde as duas falhas apareceriam: abra a LP, confirme no
DevTools que `GET /api/content` responde **200 da origem do Vercel** (e não um
erro de CORS), e **envie um lead de teste** — depois confirme que ele chegou na
listagem do painel, em `https://veggiedent.onrender.com/admin/`. O envio é o
único caminho que falha de forma visível; o conteúdo falha calado.

## O que saber depois

- **O Render hiberna.** O serviço está no plano `free`: depois de 15 min sem
  tráfego ele dorme, e a primeira requisição seguinte espera o processo subir —
  perto de um minuto. Como o `/api` da LP agora atravessa o Vercel até lá, esse
  minuto aparece para o visitante: o conteúdo cai no instantâneo embutido e um
  lead enviado nesse intervalo pode estourar o tempo. É o argumento mais forte
  para trocar o Render para `starter`, que não hiberna.
- **A LP passa a existir em dois endereços.** O Render continua servindo a LP na
  raiz dele, porque é o mesmo processo que serve o painel. Se o endereço do
  Vercel for o oficial, vale apontar o domínio para lá e tratar o do Render como
  interno — dois endereços públicos com o mesmo conteúdo dividem SEO e confundem
  quem valida.
- **O instantâneo embutido envelhece.** `content-snapshot.json` é gerado por
  `npm run instantaneo` e versionado. Ele é o que a página mostra enquanto a
  busca não responde — e o que ela mostra para sempre, se o encaminhamento
  quebrar. Regerá-lo de vez em quando mantém a rede de segurança parecida com o
  que está publicado.
