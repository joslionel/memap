import { supabase } from './supabase'

// ─── Palaces ────────────────────────────────────────────────────────────────

export const getPalaces = () =>
  supabase.from('palaces').select('*, loci(*)').order('created_at', { ascending: false })

export const getPalace = (id) =>
  supabase.from('palaces').select('*, loci(*)').eq('id', id).single()

export const createPalace = (data) =>
  supabase.from('palaces').insert(data).select().single()

export const updatePalace = (id, data) =>
  supabase.from('palaces').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

export const deletePalace = (id) =>
  supabase.from('palaces').delete().eq('id', id)

// ─── Loci ───────────────────────────────────────────────────────────────────

export const upsertLoci = (loci) =>
  supabase.from('loci').upsert(loci, { onConflict: 'id' }).select()

export const updateLocus = (id, data) =>
  supabase.from('loci').update(data).eq('id', id).select().single()

export const deleteLocus = (id) =>
  supabase.from('loci').delete().eq('id', id)

// ─── Memory Sets ────────────────────────────────────────────────────────────

export const getSets = () =>
  supabase.from('memory_sets').select('id, title, description, icon, schema, created_at').order('created_at', { ascending: false })

export const getSet = (id) =>
  supabase.from('memory_sets').select('*, memory_items(*)').eq('id', id).single()

export const createSet = (data) =>
  supabase.from('memory_sets').insert(data).select().single()

export const updateSet = (id, data) =>
  supabase.from('memory_sets').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

export const deleteSet = (id) =>
  supabase.from('memory_sets').delete().eq('id', id)

// ─── Memory Items ────────────────────────────────────────────────────────────

export const upsertItems = (items) =>
  supabase.from('memory_items').upsert(items, { onConflict: 'id' }).select()

export const createItem = (data) =>
  supabase.from('memory_items').insert(data).select().single()

export const updateItem = (id, data) =>
  supabase.from('memory_items').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

export const deleteItem = (id) =>
  supabase.from('memory_items').delete().eq('id', id)

// ─── Journeys ────────────────────────────────────────────────────────────────

export const getJourneys = () =>
  supabase
    .from('journeys')
    .select('*, palaces(name), memory_sets(title, icon)')
    .order('created_at', { ascending: false })

export const getJourney = (id) =>
  supabase
    .from('journeys')
    .select(`
      *,
      palaces ( id, name, description ),
      memory_sets ( id, title, icon, schema ),
      assignments (
        *,
        loci ( id, name, descriptor, notes, position ),
        memory_items ( id, data, is_aside, position )
      )
    `)
    .eq('id', id)
    .single()

export const createJourney = (data) =>
  supabase.from('journeys').insert(data).select().single()

export const updateJourney = (id, data) =>
  supabase.from('journeys').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

export const deleteJourney = (id) =>
  supabase.from('journeys').delete().eq('id', id)

// ─── Assignments ─────────────────────────────────────────────────────────────

export const upsertAssignments = (assignments) =>
  supabase.from('assignments').upsert(assignments, { onConflict: 'id' }).select()

export const updateAssignment = (id, data) =>
  supabase.from('assignments').update(data).eq('id', id).select().single()

export const deleteAssignment = (id) =>
  supabase.from('assignments').delete().eq('id', id)

// ─── Practice ────────────────────────────────────────────────────────────────

export const logPractice = (data) =>
  supabase.from('practice_log').insert(data).select().single()

export const getDueCount = (journeyId) =>
  supabase
    .from('assignments')
    .select('id', { count: 'exact' })
    .eq('journey_id', journeyId)
    .lte('next_review', new Date().toISOString())
