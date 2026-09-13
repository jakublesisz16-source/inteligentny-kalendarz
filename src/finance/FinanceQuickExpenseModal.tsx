import type { FormEvent, ReactNode } from 'react';
import type { FinanceCurrencyCode } from '../shopping/expenses.types';
import {
  convertForeignMinorToPlnMinor,
  FINANCE_CURRENCIES,
  formatMoneyMinor,
  parseCurrencyAmountToMinor,
} from '../shopping/expenses.utils';
import { Modal } from '../ui/Modal';

export interface QuickExpenseForm {
  date: string;
  merchant: string;
  name: string;
  categoryId: string;
  amountText: string;
  currency: FinanceCurrencyCode;
}

export type AutomaticRateStatus = 'idle' | 'loading' | 'ready' | 'error';

interface FinanceQuickExpenseModalProps {
  form: QuickExpenseForm;
  categoryOptions: ReactNode;
  tripName?: string;
  showCurrencySelect: boolean;
  busy: boolean;
  error: string;
  conversionRatePlnPerUnit: number | null;
  automaticRateStatus: AutomaticRateStatus;
  onChange: (patch: Partial<QuickExpenseForm>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function conversionStatus(
  form: QuickExpenseForm,
  ratePlnPerUnit: number | null,
  status: AutomaticRateStatus,
): { tone: 'normal' | 'muted' | 'warning'; text: string } | null {
  if (form.currency === 'PLN') return null;
  const originalAmountMinor = parseCurrencyAmountToMinor(form.amountText);
  if (ratePlnPerUnit && originalAmountMinor && originalAmountMinor > 0) {
    const converted = convertForeignMinorToPlnMinor(originalAmountMinor, ratePlnPerUnit);
    return converted === null ? null : { tone: 'normal', text: `≈ ${formatMoneyMinor(converted)} według lokalnego kursu orientacyjnego` };
  }
  if (status === 'loading') return { tone: 'muted', text: 'Przeliczam lokalny kurs…' };
  if (status === 'error') return { tone: 'warning', text: 'Brak lokalnego kursu dla tej waluty.' };
  return null;
}

export function FinanceQuickExpenseModal({
  form,
  categoryOptions,
  tripName,
  showCurrencySelect,
  busy,
  error,
  conversionRatePlnPerUnit,
  automaticRateStatus,
  onChange,
  onClose,
  onSubmit,
}: FinanceQuickExpenseModalProps) {
  const conversion = conversionStatus(form, conversionRatePlnPerUnit, automaticRateStatus);
  return (
    <Modal
      title="Dodaj wydatek"
      onClose={() => !busy && onClose()}
      headerActions={<button type="submit" form="finance-quick-expense-form" className="button button-primary modal-mobile-header-save finance-mobile-header-save" disabled={busy}>{busy ? 'Zapisuję...' : 'Zapisz'}</button>}
    >
      <form id="finance-quick-expense-form" className="finance-quick-expense-form finance-quick-expense-form-simple" onSubmit={onSubmit}>
        {error ? <div className="study-message error-message finance-form-message" role="alert">{error}</div> : null}
        {tripName ? <div className="finance-trip-form-context"><span>Wyjazd</span><strong>{tripName}</strong></div> : null}

        <label className="field finance-quick-expense-amount">
          <span>Kwota{form.currency !== 'PLN' ? ` (${form.currency})` : ''}</span>
          <input
            data-modal-autofocus="true"
            inputMode="decimal"
            value={form.amountText}
            onChange={(event) => onChange({ amountText: event.target.value })}
            placeholder="0,00"
          />
        </label>

        {conversion ? <div className={`finance-auto-rate-status is-${conversion.tone}`} aria-live="polite">{conversion.text}</div> : null}

        <label className="field">
          <span>Nazwa / opis</span>
          <input value={form.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="Np. obiad, paliwo, zakupy" />
        </label>
        <label className="field">
          <span>Kategoria</span>
          <select value={form.categoryId} onChange={(event) => onChange({ categoryId: event.target.value })}>{categoryOptions}</select>
        </label>
        <label className="field finance-quick-expense-date">
          <span>Data</span>
          <input type="date" value={form.date} onChange={(event) => onChange({ date: event.target.value })} />
        </label>
        <label className="field">
          <span>Miejsce / odbiorca <small>opcjonalnie</small></span>
          <input value={form.merchant} onChange={(event) => onChange({ merchant: event.target.value })} placeholder="Np. restauracja, sklep" />
        </label>
        {showCurrencySelect ? <label className="field">
          <span>Waluta</span>
          <select value={form.currency} onChange={(event) => onChange({ currency: event.target.value as FinanceCurrencyCode })}>
            {FINANCE_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </label> : null}

        <div className="modal-actions split-actions">
          <button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>Anuluj</button>
          <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Zapisywanie...' : 'Zapisz'}</button>
        </div>
      </form>
    </Modal>
  );
}
