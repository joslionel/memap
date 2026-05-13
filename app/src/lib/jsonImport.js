/**
 * Normalises the various JSON formats used in the existing data files
 * into the app's canonical MemorySet shape.
 */

// Fields that exist in the JSON but belong to journey/palace data, not item data
const SKIP_FIELDS = new Set(['id', 'locusNumber', 'type', 'userEdits'])

// Auto-mapping of common JSON field names → canonical schema keys
export const FIELD_MAP = {
  name: 'name',
  fact: 'description',
  mnemonic: 'imagery',
  notes: 'notes',
  start: 'startDate',
  end: 'endDate',
  start_date: 'startDate',
  end_date: 'endDate',
}

// Canonical schema fields every set has
export const STANDARD_FIELDS = [
  { key: 'name',        label: 'Name',        type: 'text',     required: true },
  { key: 'description', label: 'Description', type: 'textarea', required: false },
  { key: 'imagery',     label: 'Imagery',     type: 'textarea', required: false },
  { key: 'notes',       label: 'Notes',       type: 'textarea', required: false },
]

export const DATE_FIELDS = [
  { key: 'startDate', label: 'Start (year)', type: 'year', required: false },
  { key: 'endDate',   label: 'End (year)',   type: 'year', required: false },
]

/**
 * Parse a raw JSON string/object and return { meta, rawItems }.
 */
export function parseRaw(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json
  if (Array.isArray(parsed)) {
    return { meta: null, rawItems: parsed }
  }
  if (parsed.meta && Array.isArray(parsed.items)) {
    return { meta: parsed.meta, rawItems: parsed.items }
  }
  throw new Error('Unrecognised JSON format. Expected an array or { meta, items }.')
}

/**
 * Inspect sample items and suggest a field mapping + schema.
 * Returns { suggestedMappings, extraFields, hasDates }.
 */
export function detectMapping(rawItems, meta) {
  const sample = rawItems[0] ?? {}

  const suggestedMappings = {}   // jsonKey → canonical key (or null to skip)
  const extraFields = []         // additional schema fields beyond standard

  for (const key of Object.keys(sample)) {
    if (SKIP_FIELDS.has(key)) continue
    const canonical = FIELD_MAP[key] ?? key
    suggestedMappings[key] = canonical
  }

  // Detect date presence
  const hasDates = 'start' in sample || 'end' in sample || 'start_date' in sample

  // Extra fields from meta (tarot, european countries, etc.)
  const metaExtras = meta?.extraUserFields ?? []
  for (const f of metaExtras) {
    extraFields.push({ key: f.key, label: f.label.replace(/^[^\w]+/, '').trim(), type: 'textarea', required: false })
  }

  // Group fields by detected category: known metadata fields
  const knownMeta = ['dynasty', 'house', 'era', 'region', 'suit', 'number', 'capital', 'population']
  for (const key of Object.keys(sample)) {
    if (SKIP_FIELDS.has(key) || key in FIELD_MAP) continue
    if (knownMeta.includes(key)) {
      extraFields.push({ key, label: key.charAt(0).toUpperCase() + key.slice(1), type: 'text', required: false })
    }
  }

  return { suggestedMappings, extraFields, hasDates }
}

/**
 * Convert a raw item to a canonical memory_item using the given mappings.
 */
export function normaliseItem(raw, mappings, position) {
  const data = {}

  for (const [srcKey, destKey] of Object.entries(mappings)) {
    if (!destKey || SKIP_FIELDS.has(srcKey)) continue
    const val = raw[srcKey]
    if (val !== undefined && val !== null && val !== '') {
      data[destKey] = val
    }
  }

  // Pull user-edited mnemonic if the canonical one is blank
  if (!data.imagery && raw.userEdits?.mnemonic) {
    data.imagery = raw.userEdits.mnemonic
  }
  if (!data.notes && raw.userEdits?.notes) {
    data.notes = raw.userEdits.notes
  }

  return {
    position,
    is_aside: raw.type === 'aside',
    data,
  }
}

/**
 * Build the full schema array from detected + user-confirmed choices.
 */
export function buildSchema(hasDates, extraFields) {
  const schema = [...STANDARD_FIELDS]
  if (hasDates) schema.push(...DATE_FIELDS)
  schema.push(...extraFields.filter(f => !schema.find(s => s.key === f.key)))
  return schema
}
