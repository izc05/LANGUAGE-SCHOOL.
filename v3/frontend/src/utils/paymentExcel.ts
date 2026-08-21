import { effectivePaymentStatus, type StudentPaymentRecord } from '../services/pocketbase/adminPayments'
import type { AdminEnrollmentRecord } from '../services/pocketbase/adminAcademic'
import type { AppUser } from '../services/pocketbase/types'

export type PaymentReceiptAcademy = {
  academyName: string
  legalOwnerName?: string
  legalTaxId?: string
  address?: string
  email?: string
  phone?: string
}

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

function methodName(method?: StudentPaymentRecord['payment_method']): string {
  if (method === 'CASH') return 'Efectivo'
  if (method === 'CARD') return 'Tarjeta'
  if (method === 'TRANSFER') return 'Transferencia'
  if (method === 'BIZUM') return 'Bizum'
  if (method === 'OTHER') return 'Otro'
  return 'Sin método'
}

function methodLabel(record: StudentPaymentRecord): string {
  return record.payment_method ? methodName(record.payment_method) : ''
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

  const obligations = input.records.filter((record) => record.status !== 'CANCELLED').reduce((sum, record) => sum + record.amount_cents, 0) / 100
  const paid = input.records.filter((record) => record.status === 'PAID').reduce((sum, record) => sum + record.amount_cents, 0) / 100
  const pending = input.records.filter((record) => effectivePaymentStatus(record) === 'PENDING').reduce((sum, record) => sum + record.amount_cents, 0) / 100
  const overdue = input.records.filter((record) => effectivePaymentStatus(record) === 'OVERDUE').reduce((sum, record) => sum + record.amount_cents, 0) / 100
  const refunded = input.records.filter((record) => record.status === 'REFUNDED').reduce((sum, record) => sum + record.amount_cents, 0) / 100
  const paymentMethods = ['CASH', 'BIZUM', 'TRANSFER', 'CARD', 'OTHER'] as const
  const methodRows = paymentMethods.map((method) => {
    const records = input.records.filter((record) => record.status === 'PAID' && record.payment_method === method)
    const amount = records.reduce((sum, record) => sum + record.amount_cents, 0) / 100
    return row([methodName(method), records.length, amount.toFixed(2)], new Set([1, 2]))
  }).join('')

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#B93E6D" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14" ss:Color="#4A2937"/></Style>
    <Style ss:ID="Metric"><Font ss:Bold="1" ss:Color="#4A2937"/><Interior ss:Color="#FFF1F6" ss:Pattern="Solid"/></Style>
  </Styles>
  <Worksheet ss:Name="Resumen">
    <Table>
      <Column ss:Width="180"/><Column ss:Width="100"/><Column ss:Width="100"/>
      <Row><Cell ss:MergeAcross="2" ss:StyleID="Title"><Data ss:Type="String">Language School · Resumen económico · ${xml(input.periodLabel)}</Data></Cell></Row>
      ${row(['Registros exportados', input.records.length], new Set([1]))}
      ${row(['Obligaciones EUR', obligations.toFixed(2)], new Set([1]))}
      ${row(['Cobrado EUR', paid.toFixed(2)], new Set([1]))}
      ${row(['Pendiente EUR', pending.toFixed(2)], new Set([1]))}
      ${row(['Vencido EUR', overdue.toFixed(2)], new Set([1]))}
      ${row(['Reembolsado EUR', refunded.toFixed(2)], new Set([1]))}
      <Row/>
      <Row><Cell ss:MergeAcross="2" ss:StyleID="Metric"><Data ss:Type="String">Cobros por método</Data></Cell></Row>
      <Row><Cell ss:StyleID="Header"><Data ss:Type="String">Método</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Cobros</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Importe EUR</Data></Cell></Row>
      ${methodRows}
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Pagos">
    <Table>
      <Column ss:Width="120"/><Column ss:Width="150"/><Column ss:Width="120"/><Column ss:Width="100"/><Column ss:Width="80"/><Column ss:Width="85"/><Column ss:Width="85"/><Column ss:Width="85"/><Column ss:Width="75"/><Column ss:Width="75"/><Column ss:Width="85"/><Column ss:Width="85"/><Column ss:Width="110"/><Column ss:Width="180"/>
      <Row><Cell ss:MergeAcross="13" ss:StyleID="Title"><Data ss:Type="String">Language School · Pagos · ${xml(input.periodLabel)}</Data></Cell></Row>
      <Row><Cell ss:MergeAcross="13"><Data ss:Type="String">Registros: ${input.records.length} · Cobrado: ${paid.toFixed(2)} EUR · Pendiente: ${pending.toFixed(2)} EUR · Vencido: ${overdue.toFixed(2)} EUR · Reembolsado: ${refunded.toFixed(2)} EUR</Data></Cell></Row>
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

const cp1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
}

function pdfLiteral(value: string): string {
  let result = ''
  for (const character of value.normalize('NFC')) {
    if (character === '(' || character === ')' || character === '\\') {
      result += `\\${character}`
      continue
    }
    const point = character.codePointAt(0) || 63
    const byte = point <= 0xff ? point : cp1252[point] ?? 63
    if (byte >= 32 && byte <= 126) result += String.fromCharCode(byte)
    else result += `\\${byte.toString(8).padStart(3, '0')}`
  }
  return result
}

function pdfText(x: number, y: number, size: number, value: string, bold = false): string {
  return `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${pdfLiteral(value)}) Tj ET`
}

function wrapText(value: string, max = 70): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= max) current = candidate
    else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['—']
}

function receiptDate(value?: string): string {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function safeFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'alumno'
}

function buildPdf(content: string): string {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n%LanguageSchool\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n` })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return pdf
}

export function downloadPaymentReceiptPdf(input: {
  record: StudentPaymentRecord
  student?: AppUser
  enrollment?: AdminEnrollmentRecord
  academy: PaymentReceiptAcademy
}): string {
  if (input.record.status !== 'PAID') throw new Error('Solo se puede emitir justificante de un pago realizado.')
  const group = input.enrollment?.expand?.group
  const course = group?.expand?.course
  const academyName = input.academy.academyName.trim() || 'Language School'
  const student = nameOf(input.student)
  const amount = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(input.record.amount_cents / 100)
  const mode = input.record.billing_mode === 'INTENSIVE' ? 'Intensivo' : 'Mensual'
  const reference = input.record.reference?.trim() || '—'
  const notes = input.record.notes?.trim() || '—'
  const documentReference = input.record.id ? input.record.id.slice(0, 12).toUpperCase() : '—'

  const commands: string[] = [
    '0.70 0.25 0.44 rg 0 792 595 50 re f',
    '1 1 1 rg',
    pdfText(48, 814, 18, academyName, true),
    pdfText(48, 798, 9, 'JUSTIFICANTE DE PAGO - NO FACTURA', true),
    '0.20 0.16 0.18 rg',
    pdfText(48, 760, 11, `Referencia del justificante: ${documentReference}`, true),
    pdfText(48, 742, 10, `Fecha de pago: ${receiptDate(input.record.paid_at)}`),
    pdfText(48, 724, 10, `Importe abonado: ${amount}`, true),
    '0.86 0.78 0.81 RG 48 704 m 547 704 l S',
    pdfText(48, 680, 11, 'DATOS DE LA ACADEMIA', true),
    pdfText(48, 661, 10, academyName),
  ]

  let y = 644
  const academyLines = [
    input.academy.legalOwnerName ? `Titular: ${input.academy.legalOwnerName}` : '',
    input.academy.legalTaxId ? `NIF/CIF: ${input.academy.legalTaxId}` : '',
    input.academy.address ? `Dirección: ${input.academy.address}` : '',
    input.academy.email ? `Email: ${input.academy.email}` : '',
    input.academy.phone ? `Teléfono: ${input.academy.phone}` : '',
  ].filter(Boolean)
  for (const line of academyLines) {
    for (const wrapped of wrapText(line, 78)) {
      commands.push(pdfText(48, y, 9, wrapped))
      y -= 15
    }
  }

  y -= 8
  commands.push('0.86 0.78 0.81 RG 48 ' + y + ' m 547 ' + y + ' l S')
  y -= 26
  commands.push(pdfText(48, y, 11, 'DATOS DEL PAGO', true))
  y -= 20
  const paymentLines = [
    `Alumno: ${student}`,
    input.student?.email ? `Email: ${input.student.email}` : '',
    course?.title ? `Curso: ${course.title}` : '',
    group?.name ? `Grupo / aula: ${group.name}` : '',
    `Modalidad económica: ${mode}`,
    `Periodo cubierto: ${receiptDate(input.record.period_start)} - ${receiptDate(input.record.period_end)}`,
    `Método de pago: ${methodName(input.record.payment_method)}`,
    `Referencia de pago: ${reference}`,
  ].filter(Boolean)
  for (const line of paymentLines) {
    for (const wrapped of wrapText(line, 78)) {
      commands.push(pdfText(48, y, 9.5, wrapped))
      y -= 16
    }
  }

  y -= 4
  commands.push(pdfText(48, y, 10, 'Observaciones', true))
  y -= 17
  for (const wrapped of wrapText(notes, 82).slice(0, 5)) {
    commands.push(pdfText(48, y, 9, wrapped))
    y -= 15
  }

  commands.push('0.86 0.78 0.81 RG 48 92 m 547 92 l S')
  commands.push(pdfText(48, 70, 8.5, 'Documento acreditativo del pago registrado por la academia. No constituye una factura.'))
  commands.push(pdfText(48, 55, 8, `ID interno del pago: ${input.record.id}`))

  const pdf = buildPdf(commands.join('\n'))
  const blob = new Blob([pdf], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const filename = `justificante-pago-${safeFilename(student)}-${input.record.paid_at?.slice(0, 10) || 'sin-fecha'}.pdf`
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return filename
}
