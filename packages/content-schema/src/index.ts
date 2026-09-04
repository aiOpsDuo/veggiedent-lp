export {
  ALT_TEXT_SUFFIX,
  FIELD_TYPES,
  IMAGE_ROLES,
  LIST_ITEM_BASE_FIELDS,
  MEDIA_FIELD_TYPES,
  SECTION_KEYS,
  altTextFieldName,
  isDecorativeImage,
  isMediaField,
  isSectionKey,
} from './contract'
export type {
  FieldSpec,
  FieldType,
  ImageRole,
  ListItemBase,
  ListSpec,
  MediaFieldType,
  SectionKey,
  SectionSchema,
} from './contract'

export { decorativeImage, optionalDecorativeImage, optionalImage, requiredImage } from './fields'

export {
  RICH_TEXT_ALLOWED_ATTRIBUTES,
  RICH_TEXT_ALLOWED_TAGS,
  createRichTextSanitizer,
  isBlankRichText,
} from './rich-text'
export type { RichTextSanitizer } from './rich-text'

export {
  getSectionSchema,
  orderedSectionSchemas,
  sectionSchemas,
  capturaLeadSchema,
  demonstracaoSchema,
  educacaoSchema,
  faqSchema,
  footerSchema,
  heroSchema,
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
  HeroDocument,
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
