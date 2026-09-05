/**
 * URL pública do logo oficial da Veggiedent, no Supabase Storage.
 *
 * Fonte: `apps/lp/src/components/layout/Header/Header.tsx` e `Footer.tsx` — a
 * LP já serve o logo direto dessa URL, sem baixar nem duplicar o arquivo em
 * lugar nenhum. `apps/admin` reaproveita a mesma URL (T35, item 2) pelo mesmo
 * motivo: um SVG novo aqui seria um segundo arquivo do mesmo logo (regra G5),
 * e não apenas um segundo lugar apontando para o mesmo arquivo.
 *
 * `apps/lp` está fora do escopo de edição desta tarefa (só pode ser lida), daí
 * a URL aparecer aqui como uma string igual à das duas telas da LP, e não como
 * uma importação delas.
 */
export const VEGGIEDENT_LOGO_URL =
  'https://wkcioegorxdvqtrzapem.supabase.co/storage/v1/object/public/veggiedent-images/9f38e6e3-765f-453f-bf8f-dfa9435b42d2/veggiedent-fresh-edc-logo.svg'
