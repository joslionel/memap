import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getSet, createSet, updateSet, createItem, updateItem, deleteItem, deleteSet, upsertItems } from '../../lib/db'
import { useAuth } from '../../contexts/AuthContext'
import { STANDARD_FIELDS, DATE_FIELDS } from '../../lib/jsonImport'
import PasteTextModal from '../../components/PasteTextModal'
import Button from '../../components/ui/Button'
import { Input, Textarea, Select } from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { ArrowLeft, Plus, Trash2, Edit2, ChevronDown, ChevronUp, X, Check, ClipboardList } from 'lucide-react'

const FIELD_TYPES = [
  { value: 'text',     label: 'Text (single line)' },
  { value: 'textarea', label: 'Text (multi-line)' },
  { value: 'year',     label: 'Year (can be negative)' },
  { value: 'number',   label: 'Number' },
]

function FieldPill({ field, onRemove }) {
  return (
    <div className="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-1.5 text-sm">
      <span className="text-slate-200">{field.label}</span>
      <Badge colour="slate">{field.type}</Badge>
      {!STANDARD_FIELDS.find(f => f.key === field.key) && !DATE_FIELDS.find(f => f.key === field.key) && (
        <button onClick={() => onRemove(field.key)} className="text-slate-500 hover:text-red-400 transition-colors">
          <X size={12} />
        </button>
      )}
    </div>
  )
}

function ItemCard({ item, schema, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const name = item.data?.name ?? '(unnamed)'
  const description = item.data?.description ?? ''

  return (
    <div className={`bg-slate-800 rounded-xl overflow-hidden border border-slate-700 ${item.is_aside ? 'border-amber-600/50 bg-amber-950/20' : ''}`}>
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-750 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {item.is_aside && <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">aside</span>}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-100 truncate">{name}</p>
          {!expanded && description && <p className="text-xs text-slate-400 truncate mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(item) }}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
            className="p-1.5 rounded-lg hover:bg-red-900/50 text-slate-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700 pt-3 flex flex-col gap-2">
          {schema.map((field) => {
            const val = item.data?.[field.key]
            if (!val && val !== 0) return null
            return (
              <div key={field.key}>
                <span className="text-xs text-slate-500 uppercase tracking-wider">{field.label}</span>
                <p className="text-sm text-slate-300 mt-0.5 whitespace-pre-wrap">{val}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ItemModal({ open, onClose, item, schema, setId, onSave }) {
  const [data, setData] = useState({})
  const [isAside, setIsAside] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setData(item?.data ?? {})
      setIsAside(item?.is_aside ?? false)
    }
  }, [open, item])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ ...item, data, is_aside: isAside })
    setSaving(false)
  }

  const setField = (key, val) => setData((d) => ({ ...d, [key]: val }))

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit item' : 'New item'} maxWidth="max-w-2xl">
      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={isAside}
            onChange={(e) => setIsAside(e.target.checked)}
            className="accent-amber-500"
          />
          This is an aside (contextual note, not assigned to a locus)
        </label>

        {schema.map((field) => {
          const val = data[field.key] ?? ''
          return field.type === 'textarea' ? (
            <Textarea
              key={field.key}
              label={field.label + (field.required ? ' *' : '')}
              value={val}
              onChange={(e) => setField(field.key, e.target.value)}
              rows={field.key === 'imagery' ? 5 : 3}
            />
          ) : (
            <Input
              key={field.key}
              label={field.label + (field.required ? ' *' : '')}
              type={field.type === 'year' || field.type === 'number' ? 'number' : 'text'}
              value={val}
              onChange={(e) => setField(field.key, e.target.value)}
            />
          )
        })}

        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Saving…' : 'Save item'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function SetEditor() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [set, setSet] = useState(null)
  const [items, setItems] = useState([])
  const [schema, setSchema] = useState([...STANDARD_FIELDS])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('📚')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  // New field form
  const [addingField, setAddingField] = useState(false)
  const [newFieldKey, setNewFieldKey] = useState('')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState('text')

  // Item modal
  const [itemModal, setItemModal] = useState({ open: false, item: null })
  const [pasteOpen, setPasteOpen] = useState(false)

  useEffect(() => {
    if (isNew) return
    getSet(id).then(({ data }) => {
      if (!data) { navigate('/sets'); return }
      setSet(data)
      setTitle(data.title)
      setDescription(data.description ?? '')
      setIcon(data.icon ?? '📚')
      setSchema(data.schema ?? [...STANDARD_FIELDS])
      const sorted = [...(data.memory_items ?? [])].sort((a, b) => a.position - b.position)
      setItems(sorted)
      setLoading(false)
    })
  }, [id])

  const saveMeta = async () => {
    if (!title.trim()) return
    setSaving(true)
    if (isNew) {
      const { data } = await createSet({ user_id: user.id, title: title.trim(), description, icon, schema })
      if (data) navigate(`/sets/${data.id}`, { replace: true })
    } else {
      await updateSet(id, { title: title.trim(), description, icon, schema })
    }
    setSaving(false)
  }

  const addCustomField = () => {
    const key = newFieldKey.trim().replace(/\s+/g, '_').toLowerCase() || newFieldLabel.trim().replace(/\s+/g, '_').toLowerCase()
    if (!key || !newFieldLabel.trim()) return
    if (schema.find(f => f.key === key)) return
    setSchema([...schema, { key, label: newFieldLabel.trim(), type: newFieldType, required: false }])
    setNewFieldKey('')
    setNewFieldLabel('')
    setNewFieldType('text')
    setAddingField(false)
  }

  const removeField = (key) => {
    setSchema(schema.filter(f => f.key !== key))
  }

  const handleSaveItem = async (item) => {
    if (item.id) {
      const { data } = await updateItem(item.id, { data: item.data, is_aside: item.is_aside })
      if (data) setItems((prev) => prev.map(i => i.id === data.id ? data : i))
    } else {
      const { data } = await createItem({ set_id: id, data: item.data, is_aside: item.is_aside, position: items.length })
      if (data) setItems((prev) => [...prev, data])
    }
    setItemModal({ open: false, item: null })
  }

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Delete this item?')) return
    await deleteItem(itemId)
    setItems((prev) => prev.filter(i => i.id !== itemId))
  }

  const handleBulkItems = async (newItems, newFields) => {
    const updatedSchema = [...schema]
    for (const f of newFields) {
      if (!updatedSchema.find(s => s.key === f.key)) updatedSchema.push(f)
    }
    if (newFields.length) {
      await updateSet(id, { schema: updatedSchema })
      setSchema(updatedSchema)
    }
    const toInsert = newItems.map((item, i) => ({
      set_id: id,
      position: items.length + i,
      is_aside: false,
      data: item.data,
    }))
    const { data } = await upsertItems(toInsert)
    if (data) setItems((prev) => [...prev, ...data])
  }

  const handleDeleteSet = async () => {
    if (!confirm('Delete this entire memory set and all its items?')) return
    await deleteSet(id)
    navigate('/sets')
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/sets"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
        <h1 className="text-2xl font-bold text-slate-100">{isNew ? 'New memory set' : 'Edit set'}</h1>
      </div>

      {/* Meta */}
      <div className="bg-slate-800 rounded-2xl p-6 flex flex-col gap-4 mb-6">
        <div className="flex gap-3">
          <Input
            label="Icon (emoji)"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="w-20 text-center text-xl"
          />
          <Input
            label="Title *"
            placeholder="e.g. Roman Emperors, Tarot Cards…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
        </div>
        <Input
          label="Description"
          placeholder="Brief description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button onClick={saveMeta} disabled={saving || !title.trim()}>
          {saving ? 'Saving…' : isNew ? 'Create set' : 'Save metadata'}
        </Button>
      </div>

      {/* Schema */}
      {!isNew && (
        <>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-200">Fields</h2>
              <Button size="sm" variant="secondary" onClick={() => setAddingField(!addingField)}>
                <Plus size={14} /> Add field
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {schema.map(f => (
                <FieldPill key={f.key} field={f} onRemove={removeField} />
              ))}
            </div>

            {addingField && (
              <div className="mt-3 bg-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex gap-3">
                  <Input
                    label="Label"
                    placeholder="e.g. Dynasty, Capital city…"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    className="flex-1"
                  />
                  <Select
                    label="Type"
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value)}
                    className="w-36"
                  >
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addCustomField} disabled={!newFieldLabel.trim()}>
                    <Check size={14} /> Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingField(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="flex items-center justify-between mb-4 mt-6">
            <h2 className="text-lg font-semibold text-slate-200">
              Items <span className="text-slate-500 font-normal text-sm">({items.length})</span>
            </h2>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setPasteOpen(true)}>
                <ClipboardList size={14} /> Paste text
              </Button>
              <Button size="sm" onClick={() => setItemModal({ open: true, item: null })}>
                <Plus size={14} /> Add item
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <p className="mb-4">No items yet.</p>
              <Button variant="secondary" onClick={() => setItemModal({ open: true, item: null })}>
                <Plus size={14} /> Add first item
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  schema={schema}
                  onEdit={(i) => setItemModal({ open: true, item: i })}
                  onDelete={handleDeleteItem}
                />
              ))}
            </div>
          )}

          {/* Delete set */}
          <div className="mt-10 pt-6 border-t border-slate-800">
            <Button variant="danger" onClick={handleDeleteSet} className="w-full">
              <Trash2 size={15} /> Delete this memory set
            </Button>
          </div>
        </>
      )}

      <ItemModal
        open={itemModal.open}
        onClose={() => setItemModal({ open: false, item: null })}
        item={itemModal.item}
        schema={schema}
        setId={id}
        onSave={handleSaveItem}
      />

      <PasteTextModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onImport={handleBulkItems}
        existingSchema={schema}
      />
    </div>
  )
}
