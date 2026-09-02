import { Inject, Injectable } from '@nestjs/common'
import { ENVIRONMENT } from '../../../config/environment'
import type { Environment } from '../../../config/environment.schema'
import type { LeadRelay } from '../domain/lead-relay.port'
import type { LeadSubmission } from '../domain/lead-submission'
import {
  relayAccepted,
  relayFailed,
  relayNotAttempted,
  type RdStationOutcome,
} from '../domain/rdstation-outcome'

const CONVERSIONS_ENDPOINT = 'https://api.rd.services/platform/conversions'

const MISSING_CREDENTIALS_REASON =
  'RDSTATION_API_TOKEN ou RDSTATION_CONVERSION_IDENTIFIER não configurados no ambiente do servidor.'

/**
 * O repasse ao RD Station Marketing, migrado do relay serverless (SDD § D-07).
 *
 * **O formato do payload é o mesmo do handler antigo, de propósito.** Ele segue
 * a API de Conversões (`POST /platform/conversions`, `event_type: CONVERSION`,
 * `event_family: CDP`, campos personalizados com prefixo `cf_`), que a
 * documentação vigente do RD Station confirma, mas o próprio código antigo o
 * marcava como "CONFIRMAR antes do go-live": tanto o método de autenticação
 * quanto o `api_identifier` de cada campo `cf_*` dependem de como a conta da
 * Virbac foi configurada. Isso é o risco R-08 do SDD — pendência externa,
 * registrada no README, não decisão a ser tomada aqui.
 *
 * A única diferença em relação ao handler antigo são os três campos que ele
 * descartava: `cf_conhece_virbac`, `cf_usa_produto_virbac` e
 * `cf_qual_produto_virbac` (risco R-01). Entram pelo mesmo mecanismo `cf_` que
 * os outros campos personalizados já usavam.
 *
 * Nada aqui decide o que acontece com o lead quando o repasse falha: isso é
 * regra de negócio e mora no caso de uso. Este adaptador só traduz o resultado.
 */
@Injectable()
export class RdStationLeadRelay implements LeadRelay {
  constructor(
    @Inject(ENVIRONMENT) private readonly environment: Environment,
  ) {}

  async forward(lead: LeadSubmission): Promise<RdStationOutcome> {
    const token = this.environment.RDSTATION_API_TOKEN
    const conversionIdentifier = this.environment.RDSTATION_CONVERSION_IDENTIFIER

    if (!token || !conversionIdentifier) {
      return relayNotAttempted(MISSING_CREDENTIALS_REASON)
    }

    const response = await fetch(
      `${CONVERSIONS_ENDPOINT}?api_key=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toConversionEvent(lead, conversionIdentifier)),
      },
    )

    return response.ok
      ? relayAccepted()
      : relayFailed(`RD Station recusou a conversão (status ${response.status}).`)
  }
}

/** O corpo da conversão, campo a campo como o relay antigo o montava. */
function toConversionEvent(lead: LeadSubmission, conversionIdentifier: string): unknown {
  return {
    event_type: 'CONVERSION',
    event_family: 'CDP',
    payload: {
      conversion_identifier: conversionIdentifier,
      email: lead.email,
      name: lead.nome,
      mobile_phone: lead.telefone ?? undefined,
      cf_nome_cachorro: lead.nomeCachorro ?? undefined,
      cf_porte_cachorro: lead.porteCachorro ?? undefined,
      cf_cidade_estado: lead.cidadeEstado ?? undefined,
      cf_conhece_virbac: lead.conheceVirbac ?? undefined,
      cf_usa_produto_virbac: lead.usaProdutoVirbac ?? undefined,
      cf_qual_produto_virbac: lead.qualProdutoVirbac ?? undefined,
      cf_aceite_comunicacoes: lead.aceiteComunicacoes,
      traffic_source: lead.origem ?? undefined,
    },
  }
}
