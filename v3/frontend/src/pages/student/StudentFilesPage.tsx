import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  archiveMyFile,
  getMyFileDownloadUrl,
  listMyFiles,
  uploadMyFile,
  type StudentFileCategory,
  type StudentFileRecord,
} from '../../services/pocketbase/studentPortal'
import { studentNav } from './studentNav'

const demoFiles: StudentFileRecord[] = [
  { id: 'demo-1', collectionId: '', collectionName: 'student_files', created: '2026-08-10 18:00:00.000Z', updated: '2026-08-10 18:00:00.000Z', expand: {}, title: 'My-last-trip.docx', file: 'my-last-trip.docx', student: 'demo', uploaded_by: 'demo', category: 'HOMEWORK', description: 'Writing de la unidad Travel', status: 'ACTIVE' },
  { id: 'demo-2', collectionId: '', collectionName: 'student_files', created: '2026-08-08 17:00:00.000Z', updated: '2026-08-08 17:00:00.000Z', expand: {}, title: 'Speaking-notes.pdf', file: 'speaking-notes.pdf', student: 'demo', uploaded_by: 'demo', category: 'DOCUMENT', description: 'Notas personales', status: 'ACTIVE' },
]

const categories: Array<{ value: StudentFileCategory; label: string }> = [
  { value: 'HOMEWORK', label: 'Tarea' },
  { value: 'DOCUMENT', label: 'Documento' },
  { value: 'AUDIO', label: 'Audio' },
  { value: 'MATERIAL', label: 'Material' },
  { value: 'OTHER', label: 'Otro' },
]

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function extension(filename: string): string {
  return filename.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'
}

export default function StudentFilesPage() {
  const { isDemoMode } = useAuth()
  const [files, setFiles] = useState<StudentFileRecord[]>(isDemoMode ? demoFiles : [])
  const [loading, setLoading] = useState(!isDemoMode)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<StudentFileCategory>('DOCUMENT')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    listMyFiles()
      .then((records) => {
        if (mounted) setFiles(records)
      })
      .catch(() => {
        if (mounted) setError('No se ha podido abrir tu carpeta privada. Inténtalo de nuevo en unos segundos.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [isDemoMode])

  const visibleFiles = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return files
    return files.filter((file) => `${file.title} ${file.description} ${file.category}`.toLowerCase().includes(query))
  }, [files, search])

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    setError(null)
    setMessage(null)

    if (file && file.size > 20 * 1024 * 1024) {
      setError('El archivo supera el límite de 20 MB.')
      event.target.value = ''
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
    if (file && !title.trim()) setTitle(file.name)
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!selectedFile) {
      setError('Selecciona un archivo antes de subir.')
      return
    }

    if (isDemoMode) {
      const demo: StudentFileRecord = {
        id: `demo-${Date.now()}`,
        collectionId: '',
        collectionName: 'student_files',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        expand: {},
        title: title.trim() || selectedFile.name,
        file: selectedFile.name,
        student: 'demo',
        uploaded_by: 'demo',
        category,
        description: description.trim(),
        status: 'ACTIVE',
      }
      setFiles((current) => [demo, ...current])
      setSelectedFile(null)
      setTitle('')
      setDescription('')
      setMessage('Archivo añadido a la demostración. No se ha enviado a ningún servidor.')
      return
    }

    setUploading(true)
    try {
      const record = await uploadMyFile({ title, file: selectedFile, category, description })
      setFiles((current) => [record, ...current])
      setSelectedFile(null)
      setTitle('')
      setDescription('')
      setMessage('Archivo guardado correctamente en tu espacio privado.')
    } catch {
      setError('No se ha podido subir el archivo. Revisa el formato, el tamaño y vuelve a intentarlo.')
    } finally {
      setUploading(false)
    }
  }

  async function downloadFile(record: StudentFileRecord) {
    setError(null)
    if (isDemoMode) {
      setMessage('La descarga real no está disponible en la demostración.')
      return
    }

    try {
      const url = await getMyFileDownloadUrl(record)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('No se ha podido preparar la descarga. Inténtalo de nuevo.')
    }
  }

  async function archiveFile(record: StudentFileRecord) {
    setError(null)
    if (!window.confirm(`¿Archivar "${record.title}"?`)) return

    if (isDemoMode) {
      setFiles((current) => current.filter((item) => item.id !== record.id))
      setMessage('Archivo archivado en la demostración.')
      return
    }

    try {
      await archiveMyFile(record)
      setFiles((current) => current.filter((item) => item.id !== record.id))
      setMessage('Archivo archivado correctamente.')
    } catch {
      setError('No se ha podido archivar el archivo.')
    }
  }

  return (
    <DashboardShell role="Alumno" name="Alumno" nav={[...studentNav]}>
      <div className="dashboard-content student-files-page">
        <header className="student-page-heading">
          <div>
            <span className="eyebrow">ESPACIO PRIVADO</span>
            <h2>Mis archivos</h2>
            <p>Guarda aquí tus documentos, tareas, audios y recursos personales para tenerlos siempre organizados.</p>
          </div>
          <div className="private-space-badge"><strong>Privado</strong><span>Acceso con tu cuenta</span></div>
        </header>

        {loading && <div className="cms-notice" role="status">Abriendo tu carpeta privada…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <div className="student-files-layout">
          <form className="panel student-upload-panel" onSubmit={submitUpload}>
            <div className="panel-heading"><div><span className="eyebrow">SUBIR</span><h3>Nuevo archivo</h3></div><span className="status success">Máx. 20 MB</span></div>

            <label className="upload-dropzone student-file-dropzone">
              <input type="file" accept=".pdf,.doc,.docx,.mp3,.m4a,.jpg,.jpeg,.png,.webp" onChange={chooseFile} disabled={uploading} />
              <strong>{selectedFile ? selectedFile.name : 'Seleccionar archivo'}</strong>
              <small>PDF, Word, audio o imagen</small>
            </label>

            <label className="field-stack"><span>Título</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nombre que verás en tu carpeta" /></label>
            <label className="field-stack"><span>Categoría</span><select value={category} onChange={(event) => setCategory(event.target.value as StudentFileCategory)}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="field-stack"><span>Descripción</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional" /></label>
            <button className="button button-primary button-full" type="submit" disabled={uploading}>{uploading ? 'Subiendo…' : 'Guardar en mi espacio'}</button>
          </form>

          <section className="panel student-files-list-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">ARCHIVOS</span><h3>{files.length} elementos</h3></div>
              <input className="student-files-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." aria-label="Buscar archivos" />
            </div>

            <div className="student-private-file-list">
              {visibleFiles.map((record) => (
                <article key={record.id}>
                  <span className="student-file-type">{extension(record.file)}</span>
                  <div className="student-file-copy">
                    <strong>{record.title}</strong>
                    <small>{record.category} · {formatDate(record.created)}</small>
                    {record.description && <p>{record.description}</p>}
                  </div>
                  <div className="student-file-actions">
                    <button type="button" onClick={() => void downloadFile(record)}>Descargar</button>
                    <button type="button" onClick={() => void archiveFile(record)}>Archivar</button>
                  </div>
                </article>
              ))}
              {!loading && visibleFiles.length === 0 && (
                <div className="portal-empty-inline">
                  <strong>{search.trim() ? 'No encontramos coincidencias' : 'Tu carpeta está preparada'}</strong>
                  <p>{search.trim() ? 'Prueba con otro nombre o categoría.' : 'Cuando subas tu primer archivo aparecerá aquí.'}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="panel student-security-note">
          <span>PRIVACIDAD</span>
          <p>Tus archivos están vinculados a tu cuenta. Solo tú y el personal autorizado de la academia pueden acceder a ellos según sus permisos.</p>
        </section>
      </div>
    </DashboardShell>
  )
}
