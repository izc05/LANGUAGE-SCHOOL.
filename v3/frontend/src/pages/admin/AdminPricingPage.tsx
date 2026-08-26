import { type FormEvent, useEffect, useMemo, useState } from 'react'
import AdminPricingPlanEditor from '../../components/AdminPricingPlanEditor'
import DashboardShell from '../../components/DashboardShell'
import { isDemoMode } from '../../config/environment'
import {
  createPricingPlan,
  deletePricingPlan,
  demoPricingPlans,
  listPricingPlans,
  updatePricingPlan,
  type PricingPlanInput,
  type PricingPlanRecord,
} from '../../services/pocketbase/siteManagement'
import { adminNav } from './adminNav'

const emptyPlan: PricingPlanInput = {
  name: '',
  description: '',
  price: 0,
  billingText: 'al mes',
  features: [],
  sortOrder: 10,
  active: true,
  featured: false,
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

function sortPlans(records: PricingPlanRecord[]): PricingPlanRecord[] {
  return [...records].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'es'))
}

export default function AdminPricingPage() {
  const [plans, setPlans] = useState<PricingPlanRecord[]>(isDemoMode ? demoPricingPlans : [])
  const [draft, setDraft] = useState<PricingPlanInput>(emptyPlan)
  const [featuresText, setFeaturesText] = useState('')
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    listPricingPlans()
      .then((records) => { if (mounted) setPlans(records) })
      .catch(() => { if (mounted) setError('No se han podido cargar las tarifas desde PocketBase.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const activeCount = useMemo(() => plans.filter((plan) => plan.active).length, [plans])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    const input: PricingPlanInput = {
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      billingText: draft.billingText.trim(),
      features: featuresText.split('\n').map((value) => value.trim()).filter(Boolean),
    }

    if (!input.name) {
      setError('Escribe un nombre para la tarifa.')
      return
    }

    if (isDemoMode) {
      const record = {
        ...demoPricingPlans[0],
        ...input,
        id: `demo-${Date.now()}`,
        name: input.name,
        description: input.description,
        billing_text: input.billingText,
        features: input.features,
        sort_order: input.sortOrder,
        active: input.active,
        featured: input.featured,
      } as PricingPlanRecord
      setPlans((current) => sortPlans([...current, record]))
      setDraft(emptyPlan)
      setFeaturesText('')
      setNotice('Modo demo: tarifa creada únicamente en este navegador.')
      return
    }

    setSaving(true)
    try {
      const created = await createPricingPlan(input)
      setPlans((current) => sortPlans([...current, created]))
      setDraft(emptyPlan)
      setFeaturesText('')
      setNotice('Tarifa creada en PocketBase.')
    } catch {
      setError('No se ha podido crear la tarifa.')
    } finally {
      setSaving(false)
    }
  }

  async function patchPlan(record: PricingPlanRecord, patch: Partial<PricingPlanInput>) {
    const input = { ...inputFromRecord(record), ...patch }
    setError(null)

    if (isDemoMode) {
      setPlans((current) => sortPlans(current.map((item) => item.id === record.id ? {
        ...item,
        name: input.name,
        description: input.description,
        price: input.price,
        billing_text: input.billingText,
        features: input.features,
        sort_order: input.sortOrder,
        active: input.active,
        featured: input.featured,
      } : item)))
      return
    }

    try {
      const updated = await updatePricingPlan(record.id, input)
      setPlans((current) => sortPlans(current.map((item) => item.id === updated.id ? updated : item)))
    } catch {
      setError('No se ha podido actualizar la tarifa.')
    }
  }

  function handlePlanSaved(updated: PricingPlanRecord) {
    setPlans((current) => sortPlans(current.map((item) => item.id === updated.id ? updated : item)))
    setEditingPlanId(null)
    setError(null)
    setNotice(isDemoMode ? 'Cambios de tarifa preparados en la demostración.' : 'Tarifa actualizada correctamente.')
  }

  async function removePlan(record: PricingPlanRecord) {
    if (isDemoMode) {
      setPlans((current) => current.filter((item) => item.id !== record.id))
      return
    }

    try {
      await deletePricingPlan(record.id)
      setPlans((current) => current.filter((item) => item.id !== record.id))
      if (editingPlanId === record.id) setEditingPlanId(null)
      setNotice('Tarifa eliminada.')
    } catch {
      setError('No se ha podido eliminar la tarifa.')
    }
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page admin-settings-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">CMS · TARIFAS</span>
            <h2>Planes y precios</h2>
            <p>Gestiona los precios que después podrá consumir la web pública sin tocar GitHub.</p>
          </div>
          <span className="status info">{activeCount} activas</span>
        </header>

        {loading && <div className="cms-notice">Cargando tarifas…</div>}
        {notice && <div className="cms-notice success-notice">{notice}</div>}
        {error && <div className="cms-notice" role="alert">{error}</div>}

        <div className="admin-settings-grid">
          <form className="panel cms-form" onSubmit={handleCreate}>
            <div className="panel-heading"><div><span className="eyebrow">NUEVA TARIFA</span><h3>Crear plan</h3></div></div>
            <label className="field-stack"><span>Nombre</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required /></label>
            <label className="field-stack"><span>Descripción</span><textarea rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
            <div className="field-row">
              <label className="field-stack"><span>Precio (€)</span><input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => setDraft((current) => ({ ...current, price: Number(event.target.value) }))} /></label>
              <label className="field-stack"><span>Periodo</span><input value={draft.billingText} onChange={(event) => setDraft((current) => ({ ...current, billingText: event.target.value }))} /></label>
            </div>
            <label className="field-stack"><span>Características · una por línea</span><textarea rows={5} value={featuresText} onChange={(event) => setFeaturesText(event.target.value)} placeholder={'Clases en grupo\nMaterial incluido\nSeguimiento'} /></label>
            <div className="field-row">
              <label className="field-stack"><span>Orden</span><input type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} /></label>
              <label className="check-field"><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft((current) => ({ ...current, featured: event.target.checked }))} /><span>Destacada</span></label>
            </div>
            <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Crear tarifa'}</button>
            {isDemoMode && <small className="muted">Modo demo: no se guardará en servidor.</small>}
          </form>

          <section className="panel pricing-admin-list">
            <div className="panel-heading"><div><span className="eyebrow">CATÁLOGO</span><h3>Tarifas actuales</h3></div></div>
            {plans.length === 0 && <div className="empty-state">Todavía no hay tarifas.</div>}
            {plans.map((plan) => (
              <article className={`pricing-admin-card ${plan.featured ? 'featured' : ''}`} key={plan.id}>
                <div className="pricing-admin-title">
                  <div><strong>{plan.name}</strong><small>{plan.description || 'Sin descripción'}</small></div>
                  <span className={`status ${plan.active ? 'success' : 'muted-status'}`}>{plan.active ? 'Activa' : 'Oculta'}</span>
                </div>
                <div className="pricing-admin-price"><strong>{Number(plan.price).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €</strong><span>{plan.billing_text}</span></div>
                {plan.features?.length > 0 && <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>}
                <div className="pricing-admin-actions">
                  <button className="button button-ghost" type="button" onClick={() => { setEditingPlanId((current) => current === plan.id ? null : plan.id); setNotice(null); setError(null) }}>{editingPlanId === plan.id ? 'Cerrar edición' : 'Editar'}</button>
                  <button className="button button-ghost" type="button" onClick={() => void patchPlan(plan, { active: !plan.active })}>{plan.active ? 'Ocultar' : 'Activar'}</button>
                  <button className="button button-ghost" type="button" onClick={() => void patchPlan(plan, { featured: !plan.featured })}>{plan.featured ? 'Quitar destacado' : 'Destacar'}</button>
                  <button className="button button-danger-soft" type="button" onClick={() => void removePlan(plan)}>Eliminar</button>
                </div>
                {editingPlanId === plan.id && <AdminPricingPlanEditor plan={plan} demo={isDemoMode} onSaved={handlePlanSaved} onCancel={() => setEditingPlanId(null)} />}
              </article>
            ))}
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}
