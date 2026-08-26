import { type FormEvent, useState } from 'react'
import { updateAdminCourse } from '../services/pocketbase/adminAcademic'
import type { CourseRecord } from '../services/pocketbase/studentPortal'

type Props = {
  course: CourseRecord
  allCourses: CourseRecord[]
  demo: boolean
  onSaved: (record: CourseRecord) => void
  onCancel: () => void
}

type CourseWithCefr = CourseRecord & { cefr_levels?: string[] }

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function AdminCourseEditForm({ course, allCourses, demo, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(course.title)
  const [slug, setSlug] = useState(course.slug)
  const [level, setLevel] = useState(course.level || '')
  const [cefrLevels, setCefrLevels] = useState<string[]>([...((course as CourseWithCefr).cefr_levels || [])])
  const [description, setDescription] = useState(course.description || '')
  const [publicVisible, setPublicVisible] = useState(Boolean(course.public_visible))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleCefr(nextLevel: string) {
    setCefrLevels((current) => current.includes(nextLevel)
      ? current.filter((item) => item !== nextLevel)
      : [...current, nextLevel].sort((a, b) => CEFR_LEVELS.indexOf(a as typeof CEFR_LEVELS[number]) - CEFR_LEVELS.indexOf(b as typeof CEFR_LEVELS[number])))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const cleanTitle = title.trim()
    const cleanSlug = slugify(slug || title)

    if (!cleanTitle || !cleanSlug) {
      setError('Título y slug son obligatorios.')
      return
    }

    const duplicate = allCourses.some((item) => item.id !== course.id && item.slug.toLowerCase() === cleanSlug)
    if (duplicate) {
      setError('Ya existe otro curso con ese slug. Elige uno diferente.')
      return
    }

    const patch = {
      title: cleanTitle,
      slug: cleanSlug,
      level: level.trim(),
      cefr_levels: cefrLevels,
      description: description.trim(),
      public_visible: publicVisible,
    }

    if (demo) {
      onSaved({ ...course, ...patch } as CourseRecord)
      return
    }

    setSaving(true)
    try {
      const updated = await updateAdminCourse(course, patch)
      onSaved(updated)
    } catch {
      setError('No se ha podido actualizar el curso. Comprueba que el slug sea único y vuelve a intentarlo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="admin-course-edit-form" aria-label={`Editar curso ${course.title}`} onSubmit={handleSubmit}>
      {error && <div className="cms-notice auth-error" role="alert">{error}</div>}
      <div className="admin-functional-edit-grid">
        <label className="field-stack"><span>Título del curso</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
        <label className="field-stack"><span>Slug del curso</span><input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required /></label>
        <label className="field-stack"><span>Nivel del curso</span><input value={level} onChange={(event) => setLevel(event.target.value)} placeholder="A2 · B1" /></label>
        <label className="field-stack"><span>Visibilidad pública</span><select value={publicVisible ? 'PUBLIC' : 'PRIVATE'} onChange={(event) => setPublicVisible(event.target.value === 'PUBLIC')}><option value="PUBLIC">Visible en web</option><option value="PRIVATE">Oculto en web</option></select></label>
        <fieldset className="admin-course-cefr-fieldset span-two">
          <legend>Compatibilidad MCER para recomendaciones</legend>
          <p>Marca los niveles del test para los que este curso debe aparecer como recomendación. Es independiente del texto visible anterior.</p>
          <div className="admin-course-cefr-options">
            {CEFR_LEVELS.map((item) => (
              <label key={item} className={cefrLevels.includes(item) ? 'is-selected' : ''}>
                <input type="checkbox" checked={cefrLevels.includes(item)} onChange={() => toggleCefr(item)} />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field-stack span-two"><span>Descripción del curso</span><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      </div>
      <small className="admin-functional-help">El campo “Nivel del curso” sigue siendo editorial. La compatibilidad MCER es el dato estructurado que utiliza el test para recomendar programas. Los grupos, matrículas y clases continúan vinculados por el ID del curso.</small>
      <div className="admin-functional-edit-actions">
        <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar curso'}</button>
        <button className="button button-ghost" type="button" disabled={saving} onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}
