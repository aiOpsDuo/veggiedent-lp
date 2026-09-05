import '@testing-library/jest-dom/vitest'
import { Headers, Request, Response, fetch } from 'undici'

/**
 * O ambiente `jsdom` do Vitest implementa seu próprio `AbortController` (é
 * API de DOM), mas não implementa `fetch`/`Request` — esses continuam sendo os
 * nativos do Node (`undici` interno), cuja checagem de tipo do `signal` é
 * contra a classe `AbortSignal` original, não a do `jsdom`. O roteador de
 * dados do React Router (`createBrowserRouter`, usado pelo bloqueio de
 * navegação de T30-d) cria `new AbortController()` a cada navegação e passa o
 * `signal` para `new Request(...)` — como o `AbortController` que ele recebe é
 * o do `jsdom`, o `Request` nativo do Node rejeita o `signal` como inválido.
 *
 * Trocar `fetch`/`Request`/`Response`/`Headers` pelos do pacote `undici`
 * (userland, e não o embutido no Node) resolve isso: a checagem dele lê
 * `AbortSignal` do escopo global no momento em que este módulo é carregado —
 * depois que o `jsdom` já definiu o seu — então volta a bater com o
 * `AbortController` que o `jsdom` (e o roteador) já está usando.
 */
Object.assign(globalThis, { fetch, Headers, Request, Response })
