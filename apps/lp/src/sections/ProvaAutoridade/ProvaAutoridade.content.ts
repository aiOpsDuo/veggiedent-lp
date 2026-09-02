// Fonte: Copy Deck v2.0, secao 8.2. Terceiro card so entra se o documento de
// referencia de claims (ainda pendente) indicar novo dado apto a infografico —
// nao adicionar card especulativo (Especificacao Funcional, secao 6.8).
//
// O texto do claim textual (ClaimIpsosBR) NAO fica aqui — e constante interna
// do proprio componente, ver components/ClaimIpsosBR.tsx e a secao 9 da
// Especificacao Funcional.
import type { ClaimsInfographicContent } from './ProvaAutoridade.types'

export const claimsInfographicContent: ClaimsInfographicContent = {
  heading: 'A recomendação dos médicos-veterinários, em números',
  stats: [
    { stat: '1.116', label: 'Médicos-veterinários entrevistados' },
    { stat: 'N.º 1', label: 'Marca mais recomendada no Brasil*' },
  ],
  source:
    '*Pesquisa IPSOS 2026. Fonte: Pesquisa Ipsos 2026. Realizada com 1.116 veterinários, base de dados Virbac. Acesse: https://br.virbac.com/home/veggie.html',
}
