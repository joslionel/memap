import {
  createPalace, upsertLoci, createSet, upsertItems,
  createJourney, upsertAssignments,
} from './db'

// ─── Random object bank ──────────────────────────────────────────────────────
// Concrete, easy-to-picture nouns. A fresh 10 is drawn each visit.

export const OBJECT_BANK = [
  'banana', 'umbrella', 'toothbrush', 'anchor', 'trumpet', 'cactus', 'lightbulb',
  'hammer', 'jellyfish', 'kite', 'lantern', 'snowman', 'telescope', 'wheelbarrow',
  'accordion', 'pineapple', 'dumbbell', 'scarecrow', 'harpoon', 'teapot', 'domino',
  'saxophone', 'igloo', 'walrus', 'chandelier', 'boomerang', 'marshmallow', 'tractor',
  'periscope', 'garden gnome', 'cauldron', 'unicycle', 'pretzel', 'satellite dish',
  'hedgehog', 'xylophone', 'thimble', 'volcano', 'mousetrap', 'grand piano',
  'lighthouse', 'porcupine', 'disco ball', 'canoe', 'wind chime', 'typewriter',
]

export function sampleObjects(n = 10) {
  const pool = [...OBJECT_BANK]
  const out = []
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  }
  return out
}

// ─── Stash (survives the magic-link round trip via localStorage) ──────────────

const STASH_KEY = 'tutorial-palace-v1'

export function saveTutorialStash(data) {
  try { localStorage.setItem(STASH_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

export function loadTutorialStash() {
  try {
    const raw = localStorage.getItem(STASH_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.loci?.length || !data?.pairs?.length) return null
    return data
  } catch {
    return null
  }
}

export function clearTutorialStash() {
  try { localStorage.removeItem(STASH_KEY) } catch { /* ignore */ }
}

// ─── Turn a completed tutorial into a real palace + set + journey ─────────────

/**
 * stash shape: {
 *   loci:  [{ name }, ...],
 *   pairs: [{ locusIndex, object, imagery }, ...]   // one per assigned object
 * }
 */
export async function materializeTutorial(userId, stash) {
  const data = stash ?? loadTutorialStash()
  if (!data) return null

  const { data: palace } = await createPalace({
    user_id: userId,
    name: 'My First Palace',
    description: 'Built during the walkthrough — your home, room by room.',
  })
  if (!palace) throw new Error('palace create failed')

  const { data: loci } = await upsertLoci(
    data.loci.map((l, i) => ({
      palace_id: palace.id, name: l.name, descriptor: '', notes: '', position: i,
    }))
  )
  if (!loci?.length) throw new Error('loci create failed')
  const lociByPos = [...loci].sort((a, b) => a.position - b.position)

  const { data: set } = await createSet({
    user_id: userId,
    title: 'My First 10 Objects',
    description: 'The random list from the walkthrough.',
    icon: '🎯',
    schema: [
      { key: 'name',    label: 'Object',  type: 'text',     required: true },
      { key: 'imagery', label: 'Imagery', type: 'textarea', required: false },
    ],
  })
  if (!set) throw new Error('set create failed')

  const { data: items } = await upsertItems(
    data.pairs.map((p, i) => ({
      set_id: set.id, position: i, is_aside: false,
      data: { name: p.object, imagery: p.imagery ?? '' },
    }))
  )
  if (!items?.length) throw new Error('items create failed')
  const itemsByPos = [...items].sort((a, b) => a.position - b.position)

  const { data: journey } = await createJourney({
    user_id: userId,
    name: 'My First Journey',
    palace_id: palace.id,
    set_id: set.id,
  })
  if (!journey) throw new Error('journey create failed')

  await upsertAssignments(
    data.pairs.map((p, i) => ({
      journey_id: journey.id,
      locus_id: lociByPos[p.locusIndex ?? i]?.id ?? lociByPos[i]?.id ?? null,
      item_id: itemsByPos[i]?.id ?? null,
      position: i,
    }))
  )

  clearTutorialStash()
  return { journeyId: journey.id }
}
