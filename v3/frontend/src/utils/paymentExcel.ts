import { effectivePaymentStatus, type StudentPaymentRecord } from '../services/pocketbase/adminPayments'
import type { AdminEnrollmentRecord } from '../services/pocketbase/adminAcademic'
import type { AppUser } from '../services/pocketbase/types'

function xml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function nameOf(user?: AppUser): string {
  if (!user) return 'Alumno'
  return [user.name, user.surname].filter(Boolean).join(' ') || user.email
}

function statusLabel(record: StudentPaymentRecord): string {
  const status = effectivePaymentStatus(record)
  if (status === 'PAID') return 'Pagado'
  if (status === 'OVERDUE') return 'Vencido'
  if (status === 'PENDING') return 'Pendiente'
  if (status === 'CANCELLED') return 'Cancelado'
  return 'Reembolsado'
}

function methodLabel(record: StudentPaymentRecord): string {
  if (record.payment_method === 'CASH') return 'Efectivo'
  if (record.payment_method === 'CARD') return 'Tarjeta'
  if (record.payment_method === 'TRANSFER') return 'Transferencia'
  if (record.payment_method === 'BIZUM') return 'Bizum'
  if (record.payment_method === 'OTHER') return 'Otro'
  return ''
}

function row(values: Array<string | number>, numberColumns = new Set<number>()): string {
  return `<Row>${values.map((value, index) => `<Cell><Data ss:Type="${numberColumns.has(index) ? 'Number' : 'String'}">${xml(value)}</Data></Cell>`).join('')}</Row>`
}

export function downloadPaymentsExcel(input: {
  records: StudentPaymentRecord[]
  students: AppUser[]
  enrollments: AdminEnrollmentRecord[]
  periodLabel: string
}): void {
  const headers = ['Alumno', 'Email', 'Curso', 'Grupo', 'Modalidad', 'Inicio periodo', 'Fin periodo', 'Vencimiento', 'Estado', 'Importe EUR', 'Fecha pago', 'Método', 'Referencia', 'Observaciones']
  const dataRows = input.records.map((record) => {
    const student = input.students.find((item) => item.id === record.student) || record.expand?.student
    const enrollment = input.enrollments.find((item) => item.id === record.enrollment) || record.expand?.enrollment
    const group = enrollment?.expand?.group
    return row([
      nameOf(student),
      student?.email || '',
      group?.expand?.course?.title || '',
      group?.name || '',
      record.billing_mode === 'INTENSIVE' ? 'Intensivo' : 'Mensual',
      record.period_start.slice(0, 10),
      record.period_end.slice(0, 10),
      record.due_date.slice(0, 10),
      statusLabel(record),
      (record.amount_cents / 100).toFixed(2),
      record.paid_at ? record.paid_at.slice(0, 10) : '',
      methodLabel(record),
      record.reference || '',
      record.notes || '',
    ], new Set([9]))
  }).join('')

  const paid = input.records.filter((record) => record.status === 'PAID').reduce((sum, record) => sum + record.amount_cents, 0) / 100
  const pending = input.records.filter((record) => effectivePaymentStatus(record) === 'PENDING' || effectivePaymentStatus(record) === 'OVERDUE').reduce((sum, record) => sum + record.amount_cents, 0) / 100

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#B93E6D" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14" ss:Color="#4A2937"/></Style>
  </Styles>
  <Worksheet ss:Name="Pagos">
    <Table>
      <Column ss:Width="120"/><Column ss:Width="150"/><Column ss:Width="120"/><Column ss:Width="100"/><Column ss:Width="80"/><Column ss:Width="85"/><Column ss:Width="85"/><Column ss:Width="85"/><Column ss:Width="75"/><Column ss:Width="75"/><Column ss:Width="85"/><Column ss:Width="85"/><Column ss:Width="110"/><Column ss:Width="180"/>
      <Row><Cell ss:MergeAcross="13" ss:StyleID="Title"><Data ss:Type="String">Language School · Pagos · ${xml(input.periodLabel)}</Data></Cell></Row>
      <Row><Cell ss:MergeAcross="13"><Data ss:Type="String">Registros: ${input.records.length} · Pagado: ${paid.toFixed(2)} EUR · Pendiente/vencido: ${pending.toFixed(2)} EUR</Data></Cell></Row>
      <Row>${headers.map((header) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${xml(header)}</Data></Cell>`).join('')}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`

  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `pagos-language-school-${input.periodLabel.replace(/[^0-9A-Za-z_-]+/g, '-') || 'filtrado'}.xls`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
