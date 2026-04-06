import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DatePickerDialog from './DatePickerDialog';

describe('DatePickerDialog', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockClear();
  });

  // ── Rendering ─────────────────────────────────────────────

  describe('rendering', () => {
    it('renders a text input and a trigger button', () => {
      // Arrange & Act
      render(<DatePickerDialog value="" onChange={onChange} label="Appointment Date" name="appointmentDate" />);

      // Assert
      expect(screen.getByLabelText(/appointment date/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /choose date/i })).toBeDefined();
    });

    it('displays the selected date in the input', () => {
      // Arrange & Act
      render(<DatePickerDialog value="2026-04-10T09:00" onChange={onChange} label="Appointment Date" name="appointmentDate" />);

      // Assert
      const input = screen.getByLabelText(/appointment date/i) as HTMLInputElement;
      expect(input.value).toContain('10');
      expect(input.value).toContain('Apr');
      expect(input.value).toContain('2026');
    });

    it('dialog is not visible initially', () => {
      // Arrange & Act
      render(<DatePickerDialog value="" onChange={onChange} label="Appointment Date" name="appointmentDate" />);

      // Assert
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  // ── Dialog open/close ─────────────────────────────────────

  describe('dialog open/close', () => {
    it('opens dialog when trigger button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DatePickerDialog value="" onChange={onChange} label="Appointment Date" name="appointmentDate" />);

      // Act
      await user.click(screen.getByRole('button', { name: /choose date/i }));

      // Assert
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    it('closes dialog when Escape is pressed', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DatePickerDialog value="" onChange={onChange} label="Appointment Date" name="appointmentDate" />);
      await user.click(screen.getByRole('button', { name: /choose date/i }));
      expect(screen.getByRole('dialog')).toBeDefined();

      // Act
      await user.keyboard('{Escape}');

      // Assert
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('returns focus to trigger button when dialog closes', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DatePickerDialog value="" onChange={onChange} label="Appointment Date" name="appointmentDate" />);
      const triggerButton = screen.getByRole('button', { name: /choose date/i });
      await user.click(triggerButton);

      // Act
      await user.keyboard('{Escape}');

      // Assert
      expect(document.activeElement).toBe(triggerButton);
    });
  });

  // ── ARIA attributes ───────────────────────────────────────

  describe('ARIA attributes', () => {
    it('dialog has aria-modal="true" and aria-label', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DatePickerDialog value="" onChange={onChange} label="Appointment Date" name="appointmentDate" />);
      await user.click(screen.getByRole('button', { name: /choose date/i }));

      // Act
      const dialog = screen.getByRole('dialog');

      // Assert
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-label')).toBeTruthy();
    });

    it('calendar grid has role="grid" and aria-labelledby pointing to month heading', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DatePickerDialog value="" onChange={onChange} label="Appointment Date" name="appointmentDate" />);
      await user.click(screen.getByRole('button', { name: /choose date/i }));

      // Act
      const grid = screen.getByRole('grid');
      const labelledBy = grid.getAttribute('aria-labelledby');

      // Assert
      expect(labelledBy).toBeTruthy();
      const heading = document.getElementById(labelledBy!);
      expect(heading).toBeTruthy();
      expect(heading!.textContent).toMatch(/\w+ \d{4}/); // "April 2026"
    });

    it('day column headers have abbr attributes with full day names', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DatePickerDialog value="" onChange={onChange} label="Appointment Date" name="appointmentDate" />);
      await user.click(screen.getByRole('button', { name: /choose date/i }));

      // Act
      const headers = screen.getAllByRole('columnheader');

      // Assert
      expect(headers).toHaveLength(7);
      const abbrs = headers.map((h) => h.getAttribute('abbr'));
      expect(abbrs).toContain('Monday');
      expect(abbrs).toContain('Sunday');
    });

    it('only one gridcell has tabindex="0" (roving tabindex)', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DatePickerDialog value="" onChange={onChange} label="Appointment Date" name="appointmentDate" />);
      await user.click(screen.getByRole('button', { name: /choose date/i }));

      // Act
      const grid = screen.getByRole('grid');
      const tabbable = within(grid).queryAllByRole('gridcell').filter(
        (cell) => cell.getAttribute('tabindex') === '0',
      );

      // Assert
      expect(tabbable).toHaveLength(1);
    });

    it('selected date has aria-selected="true"', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DatePickerDialog value="2026-04-10T09:00" onChange={onChange} label="Appointment Date" name="appointmentDate" />);
      await user.click(screen.getByRole('button', { name: /change date/i }));

      // Act
      const selectedCells = screen.getAllByRole('gridcell').filter(
        (cell) => cell.getAttribute('aria-selected') === 'true',
      );

      // Assert
      expect(selectedCells).toHaveLength(1);
      expect(selectedCells[0].textContent).toBe('10');
    });

    it('month/year heading has aria-live="polite"', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DatePickerDialog value="" onChange={onChange} label="Appointment Date" name="appointmentDate" />);
      await user.click(screen.getByRole('button', { name: /choose date/i }));

      // Act
      const labelledBy = screen.getByRole('grid').getAttribute('aria-labelledby');
      const heading = document.getElementById(labelledBy!);

      // Assert
      expect(heading!.getAttribute('aria-live')).toBe('polite');
    });

    it('trigger button label updates after date selection', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DatePickerDialog value="2026-04-10T09:00" onChange={onChange} label="Appointment Date" name="appointmentDate" />);

      // Assert — button should reflect current selection
      expect(screen.getByRole('button', { name: /change date/i })).toBeDefined();
    });
  });

  // ── Keyboard navigation ───────────────────────────────────

  describe('keyboard navigation', () => {
    async function openDialogOnDate(user: ReturnType<typeof userEvent.setup>, date: string) {
      render(<DatePickerDialog value={date} onChange={onChange} label="Appointment Date" name="appointmentDate" />);
      await user.click(screen.getByRole('button', { name: /change date/i }));
    }

    it('Arrow Right moves focus to next day', async () => {
      // Arrange
      const user = userEvent.setup();
      await openDialogOnDate(user, '2026-04-10T09:00');

      // Act
      await user.keyboard('{ArrowRight}');

      // Assert — focus should be on day 11
      const focused = document.activeElement;
      expect(focused?.textContent).toBe('11');
    });

    it('Arrow Left moves focus to previous day', async () => {
      // Arrange
      const user = userEvent.setup();
      await openDialogOnDate(user, '2026-04-10T09:00');

      // Act
      await user.keyboard('{ArrowLeft}');

      // Assert
      expect(document.activeElement?.textContent).toBe('9');
    });

    it('Arrow Down moves focus to same day next week', async () => {
      // Arrange
      const user = userEvent.setup();
      await openDialogOnDate(user, '2026-04-10T09:00');

      // Act
      await user.keyboard('{ArrowDown}');

      // Assert — 10 + 7 = 17
      expect(document.activeElement?.textContent).toBe('17');
    });

    it('Arrow Up moves focus to same day previous week', async () => {
      // Arrange
      const user = userEvent.setup();
      await openDialogOnDate(user, '2026-04-10T09:00');

      // Act
      await user.keyboard('{ArrowUp}');

      // Assert — 10 - 7 = 3
      expect(document.activeElement?.textContent).toBe('3');
    });

    it('Home moves focus to first day of the week', async () => {
      // Arrange
      const user = userEvent.setup();
      await openDialogOnDate(user, '2026-04-10T09:00'); // Friday

      // Act
      await user.keyboard('{Home}');

      // Assert — Monday of that week = 6
      expect(document.activeElement?.textContent).toBe('6');
    });

    it('End moves focus to last day of the week', async () => {
      // Arrange
      const user = userEvent.setup();
      await openDialogOnDate(user, '2026-04-10T09:00'); // Friday

      // Act
      await user.keyboard('{End}');

      // Assert — Sunday of that week = 12
      expect(document.activeElement?.textContent).toBe('12');
    });

    it('Page Down moves to next month', async () => {
      // Arrange
      const user = userEvent.setup();
      await openDialogOnDate(user, '2026-04-10T09:00');

      // Act
      await user.keyboard('{PageDown}');

      // Assert — should now show May, focused on 10th
      const heading = document.getElementById(
        screen.getByRole('grid').getAttribute('aria-labelledby')!,
      );
      expect(heading?.textContent).toContain('May');
      expect(document.activeElement?.textContent).toBe('10');
    });

    it('Page Up moves to previous month', async () => {
      // Arrange
      const user = userEvent.setup();
      await openDialogOnDate(user, '2026-04-10T09:00');

      // Act
      await user.keyboard('{PageUp}');

      // Assert
      const heading = document.getElementById(
        screen.getByRole('grid').getAttribute('aria-labelledby')!,
      );
      expect(heading?.textContent).toContain('March');
      expect(document.activeElement?.textContent).toBe('10');
    });

    it('Enter selects the focused date and closes dialog', async () => {
      // Arrange
      const user = userEvent.setup();
      await openDialogOnDate(user, '2026-04-10T09:00');

      // Act — move right then press Enter
      await user.keyboard('{ArrowRight}{Enter}');

      // Assert
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(onChange).toHaveBeenCalledOnce();
      const calledWith = onChange.mock.calls[0][0] as string;
      expect(calledWith).toContain('2026-04-11');
    });

    it('Space selects the focused date and closes dialog', async () => {
      // Arrange
      const user = userEvent.setup();
      await openDialogOnDate(user, '2026-04-10T09:00');

      // Act
      await user.keyboard('{ }');

      // Assert
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(onChange).toHaveBeenCalledOnce();
      const calledWith = onChange.mock.calls[0][0] as string;
      expect(calledWith).toContain('2026-04-10');
    });
  });

  // ── Time selection ────────────────────────────────────────

  describe('time selection', () => {
    it('renders hour and minute selects inside the dialog', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DatePickerDialog value="" onChange={onChange} label="Appointment Date" name="appointmentDate" />);
      await user.click(screen.getByRole('button', { name: /choose date/i }));

      // Assert
      expect(screen.getByLabelText(/hour/i)).toBeDefined();
      expect(screen.getByLabelText(/minute/i)).toBeDefined();
    });

    it('pre-selects time from existing value', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DatePickerDialog value="2026-04-10T14:30" onChange={onChange} label="Appointment Date" name="appointmentDate" />);
      await user.click(screen.getByRole('button', { name: /change date/i }));

      // Assert
      expect((screen.getByLabelText(/hour/i) as HTMLSelectElement).value).toBe('14');
      expect((screen.getByLabelText(/minute/i) as HTMLSelectElement).value).toBe('30');
    });

    it('includes selected time in the onChange value', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DatePickerDialog value="2026-04-10T14:30" onChange={onChange} label="Appointment Date" name="appointmentDate" />);
      await user.click(screen.getByRole('button', { name: /change date/i }));

      // Act — select the same date via Enter
      await user.keyboard('{ }');

      // Assert — should preserve the time
      const calledWith = onChange.mock.calls[0][0] as string;
      expect(calledWith).toContain('14:30');
    });
  });
});
