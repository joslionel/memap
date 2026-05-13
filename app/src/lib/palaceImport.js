/**
 * Palace import — parses several formats into a canonical
 * { name, description, loci: [{position, name, descriptor, notes, coords}] } shape.
 *
 * Supported formats:
 *   A) Clean palace JSON:  { name, description, loci: [...] }
 *   B) Clean loci array:   [{position|index, name, descriptor, notes, coords}, ...]
 *   C) Item-embedded:      array of memory items where userEdits.locus holds the locus name
 *                          (the roman_emperors_memory_palace_loci.json style)
 *   D) CSV:                position,name,descriptor,notes  (header row required)
 */

export function parsePalaceFile(text, filename) {
  const ext = filename.split('.').pop().toLowerCase()

  if (ext === 'csv') return parseCsv(text)

  const json = JSON.parse(text)

  // Format A: { name, loci: [...] }
  if (!Array.isArray(json) && json.loci && Array.isArray(json.loci)) {
    return {
      name: json.name ?? filename.replace(/\.json$/, ''),
      description: json.description ?? '',
      loci: normaliseLociArray(json.loci),
    }
  }

  // Format B or C: array
  if (Array.isArray(json)) {
    // Format C detection: items have userEdits.locus (item-embedded style)
    if (json[0]?.userEdits?.locus !== undefined) {
      return parseItemEmbedded(json, filename)
    }
    // Format B: plain loci array
    return {
      name: filename.replace(/\.json$/, ''),
      description: '',
      loci: normaliseLociArray(json),
    }
  }

  throw new Error('Unrecognised format. Expected a palace object, a loci array, or a CSV file.')
}

/** Format C: extract locus data from memory-item JSON */
function parseItemEmbedded(items, filename) {
  // Guess palace name from filename
  const name = filename
    .replace(/\.json$/, '')
    .replace(/_/g, ' ')
    .replace(/memory palace(?: loci)?/i, '')
    .trim()

  const loci = items
    .filter(item => item.userEdits?.locus && item.locusNumber != null)
    .sort((a, b) => (a.locusNumber ?? 0) - (b.locusNumber ?? 0))
    .map((item, i) => ({
      position: item.locusNumber ?? i,
      name: item.userEdits.locus,
      descriptor: item.userEdits.locusNote ?? '',
      notes: '',
      coords: item.userEdits.coords ?? null,
    }))

  return { name, description: '', loci }
}

/** Normalise an array of loci objects from Format A or B */
function normaliseLociArray(arr) {
  return arr.map((l, i) => ({
    position: l.position ?? l.index ?? l.order ?? i + 1,
    name: l.name ?? l.title ?? l.locus ?? '',
    descriptor: l.descriptor ?? l.description ?? l.desc ?? '',
    notes: l.notes ?? l.note ?? '',
    coords: l.coords ?? l.coordinates ?? null,
  }))
}

/** Format D: CSV with header row */
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.')

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const get = (row, ...keys) => {
    for (const k of keys) {
      const idx = headers.indexOf(k)
      if (idx !== -1 && row[idx] !== undefined) return row[idx].trim()
    }
    return ''
  }

  const loci = lines.slice(1)
    .filter(l => l.trim())
    .map((line, i) => {
      const row = line.split(',')
      const pos = parseInt(get(row, 'position', 'pos', 'index', 'order', 'no', '#'), 10)
      return {
        position: isNaN(pos) ? i + 1 : pos,
        name: get(row, 'name', 'locus', 'title', 'place'),
        descriptor: get(row, 'descriptor', 'description', 'desc', 'detail'),
        notes: get(row, 'notes', 'note', 'comments'),
        coords: null,
      }
    })
    .filter(l => l.name)

  return { name: '', description: '', loci }
}
