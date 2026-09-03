/**
 * O que o painel mostra enquanto ainda não sabe se há sessão.
 *
 * Deliberadamente sem nenhum dado administrativo: esta tela aparece antes de a
 * sessão ser confirmada, e é justamente por ela existir que não há instante em
 * que conteúdo protegido apareça para quem não tem acesso (SDD § C-01).
 */
export function SessionCheck(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <p role="status" className="text-sm text-slate-500">
        Verificando sessão…
      </p>
    </main>
  )
}
