import type { DashboardGateway } from '../src/dashboard/dashboard-gateway'
import { FakeLeadsGateway, type FakeLeadsGatewayOptions } from './fake-leads-gateway'
import { FakeSectionsGateway, type FakeSectionsGatewayOptions } from './fake-sections-gateway'

/**
 * Compõe os dois dublês que já existem — um por porta — em vez de duplicar o
 * comportamento de nenhum dos dois: o painel de início não fala com uma API
 * própria, fala com as mesmas duas que `SectionsScreen` e `LeadsScreen` já
 * usam (`dashboard-gateway.ts`).
 */
export function fakeDashboardGateway(options: {
  readonly sections?: FakeSectionsGatewayOptions
  readonly leads?: FakeLeadsGatewayOptions
} = {}): DashboardGateway {
  const sections = new FakeSectionsGateway(options.sections)
  const leads = new FakeLeadsGateway(options.leads)
  return {
    listSections: (token) => sections.listSections(token),
    getSection: (token, key) => sections.getSection(token, key),
    saveSection: (token, key, document) => sections.saveSection(token, key, document),
    setSectionVisibility: (token, key, isPublished) =>
      sections.setSectionVisibility(token, key, isPublished),
    listLeads: (token, query) => leads.listLeads(token, query),
    exportLeads: (token, period) => leads.exportLeads(token, period),
    deleteLead: (token, id) => leads.deleteLead(token, id),
  }
}
