import { useMemo } from 'react'
import type { ClassRecord } from '../services/pocketbase/studentPortal'

type Props = {
  classes: ClassRecord[]
  month: Date
  selectedDate: string
  onMonthChange: (month: Date) => void
  onSelectDate: (dateKey: string) => void
}

const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function classDateKey(record: ClassRecord): string {
  return dateKey(new Date(record.starts_at))
}

function startOfMonthGrid(month: Date): Date {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const mondayOffset = (first.getDay() + 6) % 7
  first.setDate(first.getDate() - mondayOffset)
  return first
}

function monthLabel(month: Date): string {
  const label = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(month)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function dayAriaLabel(date: Date, count: number): string {
  const label = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
  if (count === 0) return `${label}, sin clases`
  return `${label}, ${count} ${count === 1 ? 'clase' : 'clases'}`
}

export function todayKey(): string {
  return dateKey(new Date())
}

export function monthForDateKey(value: string): Date {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return new Date()
  return new Date(year, month - 1, 1, 12)
}

export default function MonthlyClassCalendar({ classes, month, selectedDate, onMonthChange, onSelectDate }: Props) {
  const classesByDate = useMemo(() => {
    const map = new Map<string, ClassRecord[]>()
    classes.forEach((record) => {
      const key = classDateKey(record)
      const list = map.get(key) || []
      list.push(record)
      map.set(key, list)
    })
    map.forEach((list) => list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()))
    return map
  }, [classes])

  const days = useMemo(() => {
    const start = startOfMonthGrid(month)
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }, [month])

  const today = todayKey()
  const previousMonth = () => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))
  const nextMonth = () => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))
  const goToday = () => {
    const now = new Date()
    onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1, 12))
    onSelectDate(todayKey())
  }

  return (
    <section className="monthly-class-calendar" aria-label="Agenda mensual de clases">
      <div className="calendar-toolbar">
        <div>
          <span className="eyebrow">AGENDA MENSUAL</span>
          <h3>{monthLabel(month)}</h3>
        </div>
        <div className="calendar-nav-actions" aria-label="Cambiar mes">
          <button type="button" onClick={previousMonth} aria-label="Mes anterior">←</button>
          <button type="button" className="calendar-today-button" onClick={goToday}>Hoy</button>
          <button type="button" onClick={nextMonth} aria-label="Mes siguiente">→</button>
        </div>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {weekdays.map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="calendar-grid">
        {days.map((day) => {
          const key = dateKey(day)
          const dayClasses = classesByDate.get(key) || []
          const inCurrentMonth = day.getMonth() === month.getMonth()
          const isSelected = key === selectedDate
          const isToday = key === today
          const statuses = new Set(dayClasses.map((record) => record.status))
          return (
            <button
              key={key}
              type="button"
              className={`calendar-day${inCurrentMonth ? '' : ' outside-month'}${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}${dayClasses.length ? ' has-classes' : ''}`}
              onClick={() => onSelectDate(key)}
              aria-pressed={isSelected}
              aria-label={dayAriaLabel(day, dayClasses.length)}
            >
              <span className="calendar-day-number">{day.getDate()}</span>
              {dayClasses.length > 0 && (
                <span className="calendar-class-markers" aria-hidden="true">
                  <b>{dayClasses.length}</b>
                  <span className="calendar-dots">
                    {statuses.has('SCHEDULED') && <i className="scheduled" />}
                    {statuses.has('COMPLETED') && <i className="completed" />}
                    {statuses.has('CANCELLED') && <i className="cancelled" />}
                  </span>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
