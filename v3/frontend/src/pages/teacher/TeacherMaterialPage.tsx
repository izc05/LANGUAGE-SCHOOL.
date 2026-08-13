import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  createTeacherMaterial,
  deleteTeacherMaterial,
  getTeacherMaterialDownloadUrl,
  listMyTeacherEnrollments,
  listMyTeacherGroups,
  listMyTeacherMaterials,
  type TeacherEnrollmentRecord,
  type TeacherGroupRecord,
  type TeacherTarget,
} from '../../services/pocketbase/teacherPortal'
import type { MaterialRecord } from '../../services/pocketbase/studentPortal'
import { teacherNav } from './teacherNav'

type TargetOption = { key: string; type: TeacherTarget['type']; id: string; label: string }

function extension(filename: string): string {
  return filename.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'
}

export default function TeacherMaterialPage() {
  const { isDemoMode } = useAuth()
  const [groups, setGroups] = useState<TeacherGroupRecord[]>([])
  const [enrollments, setEnrollments] = useState<TeacherEnrollmentRecord[]>([])
  const [materials, setMaterials] = useState<MaterialRecord[]>([])
  const [targetKey, setTargetKey] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const targets = useMemo<TargetOption[]>(() => {
    const groupTargets = groups.map((group) => ({ key: `GROUP:${group.id}`, type: 'GROUP' as const, id: group.id, label: `Grupo · ${group.name}` }))
    const seen = new Set<string>()
    const studentTargets = enrollments.flatMap((enrollment) => {
      if (seen.has(enrollment.student)) return []
      seen.add(enrollment.student)
      const student = enrollment.expand?.student
      const name = student ? [student.name, student.surname].filter(Boolean).join(' ') : 'Alumno'
      return [{ key: `STUDENT:${enrollment.student}`, type: 'STUDENT' as const, id: enrollment.student, label: `Alumno · ${name}` }]
    })
    return [...groupTargets, ...studentTargets]
  }, [enrollments, groups])

  async function loadConnected() {
    const [groupRecords, enrollmentRecords, materialRecords] = await Promise.all([
      listMyTeacherGroups(),
      listMyTeacherEnrollments(),
      listMyTeacherMaterials(100),
    ])
    setGroups(groupRecords)
    setEnrollments(enrollmentRecords)
    setMaterials(materialRecords)
    setTargetKey((current) => current || (groupRecords[0] ? `GROUP:${groupRecords[0].id}` : enrollmentRecords[0] ? `STUDENT:${enrollmentRecords[0].student}` : ''))
  }

  useEffect(() => {
    if (isDemoMode) {
      setGroups([{ id: 'g1', collectionId: '', collectionName: 'groups', created: '', updated: '', expand: {}, name: 'Adultos B1', course: 'c1', teacher: 'demo', academic_year: '2026/27', schedule_text: 'M/J 18:00', capacity: 8, status: 'ACTIVE' }])
      setEnrollments([])
      setTargetKey('GROUP:g1')
      return
    }
    let mounted = true
    loadConnected().catch(() => { if (mounted) setError('No se han podido cargar tus recursos y destinos disponibles. Inténtalo de nuevo en unos segundos.') }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null
    setError(null)
    if (selected && selected.size > 20 * 1024 * 1024) {
      setError('El archivo supera el límite de 20 MB.')
      event.target.value = ''
      setFile(null)
      return
    }
    setFile(selected)
    if (selected && !title.trim()) setTitle(selected.name)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    const target = targets.find((item) => item.key === targetKey)
    if (!file || !target) {
      setError(targets.length === 0 ? 'Todavía no tienes grupos o alumnos activos a los que publicar material.' : 'Selecciona un archivo y un destino antes de publicar.')
      return
    }

    if (isDemoMode) {
      setMessage('Material preparado en la demostración. No se ha enviado ningún archivo.')
      setTitle(''); setDescription(''); setFile(null)
      return
    }

    setSaving(true)
    try {
      const record = await createTeacherMaterial({ title, description, file, target: { type: target.type, id: target.id }, published: true })
      setMaterials((current) => [record, ...current])
      setMessage('Material publicado correctamente.')
      setTitle(''); setDescription(''); setFile(null)
    } catch {
      setError('No se ha podido publicar el material. Comprueba que el grupo o alumno siga asignado a tu cuenta y vuelve a intentarlo.')
    } finally {
      setSaving(false)
    }
  }

  async function download(record: MaterialRecord) {
    if (isDemoMode) { setMessage('La descarga real no está disponible en la demostración.'); return }
    const downloadWindow = window.open('', '_blank')
    if (!downloadWindow) { setError('El navegador ha bloqueado la descarga. Permite las ventanas emergentes e inténtalo de nuevo.'); return }
    try {
      const url = await getTeacherMaterialDownloadUrl(record)
      downloadWindow.opener = null
      downloadWindow.location.replace(url)
    } catch {
      downloadWindow.close()
      setError('No se ha podido abrir el recurso.')
    }
  }

  async function remove(record: MaterialRecord) {
    if (!window.confirm(`¿Eliminar "${record.title}"?`)) return
    if (isDemoMode) { setMaterials((current) => current.filter((item) => item.id !== record.id)); return }
    try { await deleteTeacherMaterial(record); setMaterials((current) => current.filter((item) => item.id !== record.id)); setMessage('Material eliminado.') } catch { setError('No se ha podido eliminar el material.') }
  }

  return (
    <DashboardShell role="Profesor" name="Profesor" nav={[...teacherNav]}>
      <div className="dashboard-content teacher-portal-page">
        <header className="teacher-page-heading"><div><span className="eyebrow">RECURSOS</span><h2>Material</h2><p>Publica recursos únicamente para tus grupos o alumnos activos.</p></div><span className="status success">Ámbito protegido</span></header>
        {loading && <div className="cms-notice" role="status">Cargando recursos…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}
        <div className="teacher-authoring-grid">
          <form className="panel teacher-authoring-form" onSubmit={submit}>
            <div className="panel-heading"><div><span className="eyebrow">NUEVO MATERIAL</span><h3>Publicar recurso</h3></div></div>
            {targets.length === 0 && !loading && <PortalEmptyState compact title="Sin destinos disponibles" description="Necesitas al menos un grupo asignado o un alumno activo para publicar material." />}
            <label className="field-stack"><span>Destino</span><select value={targetKey} onChange={(e) => setTargetKey(e.target.value)} disabled={targets.length === 0}>{targets.length === 0 && <option value="">Sin destinos disponibles</option>}{targets.map((target) => <option key={target.key} value={target.key}>{target.label}</option>)}</select></label>
            <label className="field-stack"><span>Título</span><input value={title} onChange={(e) => setTitle(e.target.value)} required disabled={targets.length === 0} /></label>
            <label className="field-stack"><span>Descripción</span><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={targets.length === 0} /></label>
            <label className="upload-dropzone"><input type="file" accept=".pdf,.doc,.docx,.mp3,.m4a,.jpg,.jpeg,.png,.webp" onChange={chooseFile} disabled={targets.length === 0} /><strong>{file?.name || 'Seleccionar archivo'}</strong><small>Máximo 20 MB</small></label>
            <button className="button button-primary" type="submit" disabled={saving || targets.length === 0}>{saving ? 'Publicando…' : 'Publicar material'}</button>
          </form>
          <section className="panel teacher-record-list"><div className="panel-heading"><div><span className="eyebrow">MIS RECURSOS</span><h3>{materials.length} materiales</h3></div></div><div>{materials.map((record) => <article key={record.id}><span className="teacher-record-icon">{extension(record.file)}</span><div><strong>{record.title}</strong><small>{record.visibility === 'GROUP' ? 'Grupo' : record.visibility === 'STUDENT' ? 'Alumno' : 'Curso'}</small></div><div className="teacher-record-actions"><button type="button" onClick={() => void download(record)}>Abrir</button><button type="button" onClick={() => void remove(record)}>Eliminar</button></div></article>)}{!loading && materials.length === 0 && <PortalEmptyState compact title="Todavía no has publicado material" description="Tus recursos publicados aparecerán aquí para que puedas revisarlos o eliminarlos." />}</div></section>
        </div>
      </div>
    </DashboardShell>
  )
}
