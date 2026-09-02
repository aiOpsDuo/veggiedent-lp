export {
  ALT_TEXT_SUFFIX,
  FIELD_TYPES,
  LIST_ITEM_BASE_FIELDS,
  MEDIA_FIELD_TYPES,
  SECTION_KEYS,
  altTextFieldName,
  isMediaField,
  isSectionKey,
} from './contract'
export type {
  FieldSpec,
  FieldType,
  ListItemBase,
  ListSpec,
  MediaFieldType,
  SectionKey,
  SectionSchema,
} from './contract'

export { optionalImage, requiredImage } from './fields'

export {
  getSectionSchema,
  orderedSectionSchemas,
  sectionSchemas,
  capturaLeadSchema,
  demonstracaoSchema,
  educacaoSchema,
  faqSchema,
  footerSchema,
  headerSchema,
  heroSchema,
  ingredientesSchema,
  ondeComprarSchema,
  produtoSchema,
  provaAutoridadeSchema,
  rotinaSchema,
} from './sections'
export type { SectionSchemas } from './sections'

export { siteMetadataSchema } from './site-metadata'

export { MESSAGES, minimumItemsMessage } from './messages'

export { buildZodSchema } from './zod'
export type { ZodBuildableSchema } from './zod'

export { checkSchemaInvariants } from './invariants'
export type { InvariantCheckable } from './invariants'

export {
  SECTION_ERROR_KEY,
  SITE_METADATA_ERROR_PREFIX,
  getSectionValidator,
  getSiteMetadataValidator,
  validateSectionDocument,
  validateSiteMetadata,
} from './validation'
export type { FieldErrors, ValidationResult } from './validation'

export type {
  CapturaLeadDocument,
  DemonstracaoDocument,
  EducacaoDocument,
  FaqDocument,
  FieldsShape,
  FooterDocument,
  HeaderDocument,
  HeroDocument,
  IngredientesDocument,
  ListItem,
  OndeComprarDocument,
  ProdutoDocument,
  ProvaAutoridadeDocument,
  RotinaDocument,
  SectionDocument,
  SectionDocumentOf,
  SectionDocuments,
  SiteMetadata,
} from './types'
