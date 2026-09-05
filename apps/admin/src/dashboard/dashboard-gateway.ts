import type { SectionsGateway } from '../content/sections-gateway'
import type { LeadsGateway } from '../leads/leads-gateway'

/**
 * O painel de início (T35, item 10) só lê o que a API já expõe para as outras
 * telas — sem endpoint novo: quantos leads chegaram na janela recente
 * (`LeadsGateway.listLeads`) e quais seções estão fora do ar
 * (`SectionsGateway.listSections`). Compõe as duas portas já existentes em
 * vez de declarar uma terceira.
 */
export interface DashboardGateway extends SectionsGateway, LeadsGateway {}
