'use client';

import { useState, useRef, useEffect, useId, type KeyboardEvent } from 'react';

// ── Types ───────────────────────────────────────────────────

interface DatePickerDialogProps {
  value: string; // "yyyy-MM-ddTHH:mm" or ""
  onChange: (value: string) => void;
  label: string;
  name: string;
  error?: string;
  required?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────

const DAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

function parseValue(value: string): { date: Date; hours: number; minutes: number } {
  if (!value) {
    const now = new Date();
    return { date: now, hours: 9, minutes: 0 };
  }
  const d = new Date(value);
  return { date: d, hours: d.getHours(), minutes: d.getMinutes() };
}

function formatDisplay(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  const day = d.getDate();
  const month = MONTHS[d.getMonth()].slice(0, 3);
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${mins}`;
}

function formatIso(date: Date, hours: number, minutes: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  // getDay() returns 0=Sun, we want Mon=0 → shift
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = new Array(startDow).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }
  return weeks;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ── Component ───────────────────────────────────────────────

export default function DatePickerDialog({
  value,
  onChange,
  label,
  name,
  error,
  required,
}: DatePickerDialogProps) {
  const [open, setOpen] = useState(false);
  const { date: initialDate, hours: initialHours, minutes: initialMinutes } = parseValue(value);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [focusedDate, setFocusedDate] = useState(initialDate);
  const [selectedHours, setSelectedHours] = useState(initialHours);
  const [selectedMinutes, setSelectedMinutes] = useState(initialMinutes);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  const headingId = useId();
  const inputId = name;
  const errorId = `${name}-error`;

  const hasValue = value !== '';

  // ── Focus the active gridcell when dialog opens or focused date changes ──

  useEffect(() => {
    if (!open) return;
    const cell = gridRef.current?.querySelector('[tabindex="0"]') as HTMLElement | null;
    cell?.focus();
  }, [open, focusedDate, viewMonth, viewYear]);

  // ── Open / Close ──────────────────────────────────────────

  function openDialog() {
    const { date, hours, minutes } = parseValue(value);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
    setFocusedDate(date);
    setSelectedHours(hours);
    setSelectedMinutes(minutes);
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function selectDate(date: Date) {
    onChange(formatIso(date, selectedHours, selectedMinutes));
    setOpen(false);
    triggerRef.current?.focus();
  }

  // ── Month navigation ──────────────────────────────────────

  function prevMonth() {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }

  function nextMonth() {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }

  // ── Keyboard navigation in grid ───────────────────────────

  function navigateFocusedDate(offset: number) {
    setFocusedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + offset);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      return d;
    });
  }

  function handleGridKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        navigateFocusedDate(1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        navigateFocusedDate(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        navigateFocusedDate(7);
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateFocusedDate(-7);
        break;
      case 'Home':
        e.preventDefault();
        // Monday of current week (dow: Mon=0)
        setFocusedDate((prev) => {
          const d = new Date(prev);
          let dow = d.getDay() - 1;
          if (dow < 0) dow = 6;
          d.setDate(d.getDate() - dow);
          return d;
        });
        break;
      case 'End':
        e.preventDefault();
        // Sunday of current week
        setFocusedDate((prev) => {
          const d = new Date(prev);
          let dow = d.getDay() - 1;
          if (dow < 0) dow = 6;
          d.setDate(d.getDate() + (6 - dow));
          return d;
        });
        break;
      case 'PageDown':
        e.preventDefault();
        if (e.shiftKey) {
          setFocusedDate((prev) => {
            const d = new Date(prev);
            d.setFullYear(d.getFullYear() + 1);
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
            return d;
          });
        } else {
          setFocusedDate((prev) => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() + 1);
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
            return d;
          });
        }
        break;
      case 'PageUp':
        e.preventDefault();
        if (e.shiftKey) {
          setFocusedDate((prev) => {
            const d = new Date(prev);
            d.setFullYear(d.getFullYear() - 1);
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
            return d;
          });
        } else {
          setFocusedDate((prev) => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() - 1);
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
            return d;
          });
        }
        break;
      case 'Enter':
        e.preventDefault();
        selectDate(focusedDate);
        break;
      case ' ':
        e.preventDefault();
        selectDate(focusedDate);
        break;
      case 'Escape':
        e.preventDefault();
        closeDialog();
        break;
    }
  }

  // ── Grid data ─────────────────────────────────────────────

  const weeks = getMonthGrid(viewYear, viewMonth);
  const selectedDate = value ? new Date(value) : null;

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          name={name}
          type="text"
          readOnly
          value={formatDisplay(value)}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 ${
            error ? 'border-red-300 dark:border-red-600' : 'border-zinc-300 dark:border-zinc-600'
          }`}
          placeholder="Select date and time"
        />
        <button
          ref={triggerRef}
          type="button"
          onClick={openDialog}
          aria-label={hasValue ? `Change Date, ${formatDisplay(value)}` : 'Choose Date'}
          className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800 transition-colors"
        >
          <CalendarIcon />
        </button>
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose appointment date"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); closeDialog(); }
          }}
        >
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {/* Month/year header */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronLeftIcon />
              </button>
              <h2
                id={headingId}
                aria-live="polite"
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
              >
                {MONTHS[viewMonth]} {viewYear}
              </h2>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronRightIcon />
              </button>
            </div>

            {/* Calendar grid */}
            <table ref={gridRef} role="grid" aria-labelledby={headingId} className="w-full border-collapse">
              <thead>
                <tr>
                  {DAYS_SHORT.map((d, i) => (
                    <th
                      key={d}
                      role="columnheader"
                      abbr={DAYS_FULL[i]}
                      className="py-1 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody onKeyDown={handleGridKeyDown}>
                {weeks.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((day, di) => {
                      if (!day) {
                        return <td key={di} role="gridcell" className="p-0.5" />;
                      }
                      const isFocused = sameDay(day, focusedDate);
                      const isSelected = selectedDate ? sameDay(day, selectedDate) : false;
                      const isToday = sameDay(day, new Date());

                      return (
                        <td
                          key={di}
                          role="gridcell"
                          tabIndex={isFocused ? 0 : -1}
                          aria-selected={isSelected || undefined}
                          onClick={() => selectDate(day)}
                          className={`p-0.5 cursor-pointer`}
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors mx-auto
                              ${isSelected ? 'bg-blue-600 text-white' : ''}
                              ${isFocused && !isSelected ? 'ring-2 ring-blue-500' : ''}
                              ${isToday && !isSelected ? 'font-bold text-blue-600 dark:text-blue-400' : ''}
                              ${!isSelected && !isToday ? 'text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800' : ''}
                            `}
                          >
                            {day.getDate()}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Time selection */}
            <div className="mt-3 flex items-center justify-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <label htmlFor="dp-hour" className="sr-only">Hour</label>
              <select
                id="dp-hour"
                aria-label="Hour"
                value={selectedHours}
                onChange={(e) => setSelectedHours(Number(e.target.value))}
                className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                ))}
              </select>
              <span className="text-zinc-500">:</span>
              <label htmlFor="dp-minute" className="sr-only">Minute</label>
              <select
                id="dp-minute"
                aria-label="Minute"
                value={selectedMinutes}
                onChange={(e) => setSelectedMinutes(Number(e.target.value))}
                className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
            </div>

            {/* Dialog actions */}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
