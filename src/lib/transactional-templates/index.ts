/**
 * Transactional Templates public API (Phase 3, section 18).
 *
 * Pure-template service — does NOT send email. All rendering is preview-only.
 *
 * Two layers:
 *   - Service (service.ts): tenant-scoped persistence, immutable versioning.
 *   - Renderer (render.ts): deterministic substitution + escaping.
 *
 * Both are imported by /api/dashboard/templates/* routes.
 */
export {
  createTemplate,
  listTemplates,
  getTemplate,
  getVersion,
  listVersions,
  updateTemplate,
  deleteTemplate,
  TemplateValidationError,
  TemplateNotFoundError,
  type TemplateRow,
  type TemplateVersionRow,
  type TemplateDetail,
  type CreateResult,
  type UpdateResult,
} from "./service";

export {
  renderTransactionalTemplate,
  escapeHtml,
  scalarToText,
  type RenderInput,
  type RenderResult,
  type RenderSuccess,
  type MissingVariablesError,
} from "./render";

export {
  extractVariables,
  findMissingVariables,
} from "./variables";

export {
  sanitizeTemplateHtml,
  SANITIZER_ALLOWED_MODEL,
} from "./sanitize";

export {
  createTemplateSchema,
  patchTemplateSchema,
  previewSchema,
  slugSchema,
  nameSchema,
  descriptionSchema,
  subjectSchema,
  htmlSchema,
  textSchema,
  validateVariableValues,
  MAX_NAME_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_SUBJECT_LENGTH,
  MAX_HTML_BYTES,
  MAX_TEXT_BYTES,
  SLUG_RE,
  VARIABLE_NAME_RE,
  type CreateTemplateInput,
  type PatchTemplateInput,
  type PreviewInput,
} from "./validation";
