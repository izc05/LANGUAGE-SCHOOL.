import { type FormEvent, useState } from 'react'
import {
  updatePricingPlan,
  type PricingPlanInput,
  type PricingPlanRecord,
} from '../services/pocketbase/siteManagement'

type Props = {
  plan: PricingPlanRecord
  demo: boolean
  onSaved: (record: PricingPlanRecord) => void
  onCancel: () => void
}

function inputFromRecord(record: PricingPlanRecord): PricingPlanInput {
  return {
    name: record.name,
    description: record.description,
    price: Number(record.price) || 0,
    billingText: record.billing_text,
    features: Array.isArray(record.features) ? record.features : [],
    sortOrder: Number(record.sort_order) || 0,
    active: Boolean(record.active),
    featured: Boolean(record.featured),
  }
}

function demoRecord(record: PricingPlanRecord, input: PricingPlanInput): PricingPlanRecord {
  return {
    ...record,
    name: input.name,
    description: input.description,
    price: input.price,
    billing_text: input.billingText,
    features: input.features,
    sort_order: input.sortOrder,
    active: input.active,
    featured: input.featured,
  }
}

export default function AdminPricingPlanEditor({ plan, demo, onSaved, onCancel }: Props) {
  const initial = inputFromRecord(plan)
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [price, setPrice] = useState(initial.price)
  const [billingText, setBillingText] = useState(initial.billingText)
  const [featuresText, setFeaturesText] = useState(initial.features.join('\n'))
  const [sortOrder, setSortOrder] = useState(initial.sortOrder)
  const [active, setActive] = useState(initial.active)
  const [featured, setFeatured] = useState(initial.featured)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const input: PricingPlanInput = {
      name: name.trim(),
      description: description.trim(),
      price,
      billingText: billingText.trim(),
      features: featuresText.split('\n').map((value) => value.trim()).filter(Boolean),
      sortOrder,
      active,
      featured,
    }

    if (!input.name) {
      setError('Escribe un nombre para la tarifa.')
      return
    }
    if (!Number.isFinite(input.price) || input.price < 0) {
      setError('El precio debe ser un número igual o superior a 0.')
      return
    }
    if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) {
      setError('El orden debe ser un número entero igual o superior a 0.')
      return
    }

    if (demo) {
      onSaved(demoRecord(plan, input))
      return
    }

    setSaving(true)
    try {
      const updated = await updatePricingPlan(plan.id, input)
      onSaved(updated)
    } catch {
      setError('No se ha podido guardar la tarifa.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="pricing-admin-edit-form" aria-label={`Editar tarifa ${plan.name}`} onSubmit={handleSubmit}>
      {error && <div className="cms-notice auth-error" role="alert">{error}</div>}
      <div className="admin-functional-edit-grid">
        <label className="field-stack"><span>Nombre de tarifa</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="field-stack"><span>Precio de tarifa (€)</span><input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></label>
        <label className="field-stack"><span>Periodo de tarifa</span><input value={billingText} onChange={(event) => setBillingText(event.target.value)} /></label>
        <label className="field-stack"><span>Orden de tarifa</span><input type="number" min="0" step="1" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} /></label>
        <label className="field-stack span-two"><span>Descripción de tarifa</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label className="field-stack span-two"><span>Características de tarifa</span><textarea rows={5} value={featuresText} onChange={(event) => setFeaturesText(event.target.value)} placeholder={'Clases en grupo\nMaterial incluido\nSeguimiento'} /></label>
      </div>
      <div className="admin-functional-checks">
        <label className="check-field"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span>Visible en la web</span></label>
        <label className="check-field"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /><span>Tarifa destacada</span></label>
      </div>
      <div className="admin-functional-edit-actions">
        <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar tarifa'}</button>
        <button className="button button-ghost" type="button" disabled={saving} onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}
