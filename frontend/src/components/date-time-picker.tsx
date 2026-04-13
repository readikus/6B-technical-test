'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type DateTimePickerProps = {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
};

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function startDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Monday = 0
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function toLocalValue(val: string) {
  if (!val) return { date: '', time: '' };
  const d = new Date(val);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function DateTimePicker({
  id,
  value,
  onChange,
  onBlur,
  ...ariaProps
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogId = useId();

  const parsed = toLocalValue(value);
  const now = new Date();
  const selectedDate = parsed.date ? new Date(parsed.date) : null;

  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? now.getMonth());
  const [time, setTime] = useState(parsed.time || '09:00');
  const [typedText, setTypedText] = useState<string | null>(null);
  const isTyping = typedText !== null;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [open]);

  function selectDay(day: number) {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}T${time}`;
    onChange(dateStr);
  }

  function handleTimeChange(newTime: string) {
    setTime(newTime);
    if (selectedDate) {
      const dateStr = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}T${newTime}`;
      onChange(dateStr);
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  const days = daysInMonth(viewYear, viewMonth);
  const startDay = startDayOfWeek(viewYear, viewMonth);
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const selectedStr = selectedDate
    ? `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`
    : '';

  const formattedValue = selectedDate
    ? `${pad(selectedDate.getDate())}/${pad(selectedDate.getMonth() + 1)}/${selectedDate.getFullYear()} ${time}`
    : '';
  const displayValue = isTyping ? typedText : formattedValue;

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          'flex items-center rounded-md border bg-transparent text-sm transition-colors',
          'focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500',
          ariaProps['aria-invalid']
            ? 'border-red-300 dark:border-red-600'
            : 'border-zinc-300 dark:border-zinc-600',
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          value={displayValue}
          placeholder="DD/MM/YYYY HH:MM"
          className="h-9 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-gray-400 dark:text-zinc-100"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            const val = e.target.value;
            setTypedText(val);
            // Parse when complete: DD/MM/YYYY HH:MM
            const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
            if (match) {
              const [, dd, mm, yyyy, hh, min] = match;
              onChange(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
              setTypedText(null);
            }
          }}
          onBlur={(e) => {
            if (containerRef.current?.contains(e.relatedTarget as Node)) return;
            setTypedText(null);
            onBlur?.();
          }}
          aria-invalid={ariaProps['aria-invalid']}
          aria-describedby={ariaProps['aria-describedby']}
          aria-required={ariaProps['aria-required']}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          aria-autocomplete="none"
        />
        <button
          type="button"
          tabIndex={-1}
          className="inline-flex size-9 items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
          onClick={() => setOpen(!open)}
          aria-label="Open date picker"
        >
          <CalendarIcon className="size-4" />
        </button>
      </div>

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-modal="false"
          aria-label="Choose date and time"
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-md dark:border-zinc-700 dark:bg-zinc-900"
        >
          {/* Month navigation */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              disabled={viewYear === now.getFullYear() && viewMonth <= now.getMonth()}
              className="inline-flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none dark:hover:bg-zinc-800"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="inline-flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {DAYS.map((d) => (
              <span key={d} className="pb-1 text-xs font-medium text-gray-400">
                {d}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 text-center" role="grid" aria-label={`${MONTHS[viewMonth]} ${viewYear}`}>
            {Array.from({ length: startDay }).map((_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1;
              const cellStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
              const isSelected = cellStr === selectedStr;
              const isToday = cellStr === todayStr;
              const isPast = cellStr < todayStr;

              return (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-disabled={isPast}
                  disabled={isPast}
                  onClick={() => selectDay(day)}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-md text-sm outline-none transition-colors',
                    'hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-zinc-800',
                    isSelected && 'bg-blue-600 text-white hover:bg-blue-700',
                    isToday && !isSelected && 'border border-zinc-300 dark:border-zinc-600',
                    isPast && 'text-gray-300 dark:text-zinc-700 pointer-events-none',
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time picker */}
          <div className="mt-3 flex items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <span className="text-xs text-gray-500">Time</span>
            <select
              value={time.split(':')[0]}
              onChange={(e) => handleTimeChange(`${e.target.value}:${time.split(':')[1] ?? '00'}`)}
              className="h-7 rounded-md border border-zinc-300 bg-transparent px-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:text-zinc-100"
              aria-label="Hour"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={pad(i)}>{pad(i)}</option>
              ))}
            </select>
            <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">:</span>
            <select
              value={time.split(':')[1] ?? '00'}
              onChange={(e) => handleTimeChange(`${time.split(':')[0]}:${e.target.value}`)}
              className="h-7 rounded-md border border-zinc-300 bg-transparent px-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:text-zinc-100"
              aria-label="Minute"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={pad(i * 5)}>{pad(i * 5)}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
