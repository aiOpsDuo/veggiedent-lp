// Claim/IpsosBR — componente de prova de autoridade.
// O texto do claim e a chamada são constantes internas.
const CLAIM_TEXT =
  "A marca mais recomendada pelos médicos-veterinários entrevistados.*";
const CLAIM_CALLOUT = "*Pesquisa IPSOS 2026.";

export function ClaimIpsosBR() {
  return (
    <p className="text-lg sm:text-xl font-medium text-ink-700 leading-relaxed max-w-[55ch]">
      {CLAIM_TEXT}{' '}
      <span className="text-sm font-semibold text-ink-400 block sm:inline sm:ml-1">
        {CLAIM_CALLOUT}
      </span>
    </p>
  );
}
