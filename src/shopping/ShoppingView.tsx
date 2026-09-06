import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  createShoppingItem,
  deletePurchasedShoppingItems,
  deleteShoppingItem,
  getLatestReversibleChange,
  listShoppingItems,
  setShoppingItemPurchased,
  undoChange,
  updateShoppingItem,
} from '../storage/database';
import type { ShoppingItem } from './shopping.types';
import { sortShoppingItems } from './shopping.utils';
import { ExpensesView } from './ExpensesView';

interface ShoppingToast {
  message: string;
  undoJournalId?: string;
}

export function ShoppingView() {
  const [section, setSection] = useState<'LIST' | 'EXPENSES'>('LIST');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ShoppingToast | null>(null);

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const groups = useMemo(() => sortShoppingItems(items), [items]);

  async function refresh() {
    setItems(await listShoppingItems());
  }

  async function showToast(message: string) {
    const latest = await getLatestReversibleChange();
    setToast({ message, ...(latest ? { undoJournalId: latest.id } : {}) });
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
      await showToast(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać zmiany.');
    } finally {
      setBusy(false);
    }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setError('Wpisz nazwę produktu.');
      inputRef.current?.focus();
      return;
    }
    await run(async () => {
      await createShoppingItem({ name });
      setNewName('');
    }, `Dodano: ${name}`);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function startEdit(item: ShoppingItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQuantity(item.quantity ?? '');
    setError('');
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    const current = items.find((item) => item.id === editingId);
    if (!current) return;
    await run(async () => {
      await updateShoppingItem(editingId, { name: editName, quantity: editQuantity });
      setEditingId(null);
    }, `Zapisano: ${editName.trim() || current.name}`);
  }

  async function togglePurchased(item: ShoppingItem) {
    await run(
      () => setShoppingItemPurchased(item.id, !item.isPurchased),
      item.isPurchased ? `Przywrócono do kupienia: ${item.name}` : `Kupione: ${item.name}`,
    );
  }

  async function removeOne(item: ShoppingItem) {
    await run(() => deleteShoppingItem(item.id), `Usunięto: ${item.name}`);
  }

  async function removePurchased() {
    const count = groups.purchased.length;
    if (!count) return;
    await run(() => deletePurchasedShoppingItems(), `Usunięto kupione produkty (${count}).`);
  }

  async function undoLatest(id: string) {
    try {
      await undoChange(id);
      await refresh();
      setToast({ message: 'Cofnięto zmianę.' });
    } catch (cause) {
      setToast({ message: cause instanceof Error ? cause.message : 'Nie udało się cofnąć zmiany.' });
    }
  }

  function renderItem(item: ShoppingItem) {
    const editing = editingId === item.id;
    return (
      <li key={item.id} className={item.isPurchased ? 'shopping-item purchased' : 'shopping-item'}>
        {editing ? (
          <form className="shopping-edit-form" onSubmit={(event: FormEvent<HTMLFormElement>) => void saveEdit(event)}>
            <label className="field"><span>Nazwa</span><input autoFocus value={editName} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditName(event.target.value)} /></label>
            <label className="field"><span>Ilość <em>opcjonalnie</em></span><input value={editQuantity} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditQuantity(event.target.value)} placeholder="Np. 2, 1 kg, 500 g" /></label>
            <div className="shopping-edit-actions">
              <button type="submit" className="button button-primary button-small" disabled={busy}>Zapisz</button>
              <button type="button" className="button button-secondary button-small" onClick={() => setEditingId(null)} disabled={busy}>Anuluj</button>
            </div>
          </form>
        ) : (
          <>
            <label className="shopping-check">
              <input
                type="checkbox"
                checked={item.isPurchased}
                onChange={() => void togglePurchased(item)}
                disabled={busy}
                aria-label={`${item.isPurchased ? 'Przywróć do kupienia' : 'Oznacz jako kupione'}: ${item.name}`}
              />
              <span className="shopping-item-copy">
                <strong>{item.name}</strong>
                {item.quantity ? <small>{item.quantity}</small> : null}
              </span>
            </label>
            <div className="shopping-item-actions">
              <button type="button" className="text-button" onClick={() => startEdit(item)} disabled={busy}>Edytuj</button>
              <button type="button" className="text-button danger-text" onClick={() => void removeOne(item)} disabled={busy} aria-label={`Usuń ${item.name}`}>Usuń</button>
            </div>
          </>
        )}
      </li>
    );
  }

  const nothingYet = items.length === 0;

  return (
    <section className={`view-shell shopping-view${section === 'EXPENSES' ? ' shopping-view-expenses' : ''}`}>
      <header className="view-header">
        <div>
          <p className="eyebrow">Zakupy lokalnie</p>
          <h1>Zakupy</h1>
          <p className="view-subtitle">{section === 'LIST' ? 'Jedna szybka lista. Dodaj produkt, odhacz po zakupie i gotowe.' : 'Prosty lokalny spis paragonów i miesięcznych wydatków.'}</p>
        </div>
      </header>

      <div className="shopping-section-tabs" role="tablist" aria-label="Sekcja Zakupów">
        <button type="button" role="tab" aria-selected={section === 'LIST'} className={section === 'LIST' ? 'active' : ''} onClick={() => setSection('LIST')}>Lista</button>
        <button type="button" role="tab" aria-selected={section === 'EXPENSES'} className={section === 'EXPENSES' ? 'active' : ''} onClick={() => setSection('EXPENSES')}>Wydatki</button>
      </div>

      {section === 'EXPENSES' ? <ExpensesView /> : <>
      <form className="shopping-add" onSubmit={(event: FormEvent<HTMLFormElement>) => void addItem(event)}>
        <label className="visually-hidden" htmlFor="shopping-new-item">Dodaj produkt</label>
        <input
          ref={inputRef}
          id="shopping-new-item"
          value={newName}
          onChange={(event: ChangeEvent<HTMLInputElement>) => { setNewName(event.target.value); if (error) setError(''); }}
          placeholder="Dodaj produkt..."
          autoComplete="off"
        />
        <button type="submit" className="button button-primary shopping-add-button" disabled={busy} aria-label="Dodaj produkt">+</button>
      </form>

      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}

      {nothingYet ? (
        <div className="panel shopping-empty">
          <strong>Lista jest pusta.</strong>
          <span>Dodaj pierwszą rzecz do kupienia.</span>
        </div>
      ) : (
        <div className="shopping-sections">
          <section className="panel shopping-section" aria-labelledby="shopping-active-heading">
            <div className="shopping-section-heading">
              <div>
                <p className="section-kicker">Do kupienia</p>
                <h2 id="shopping-active-heading">{groups.active.length ? `${groups.active.length} do kupienia` : 'Wszystko kupione'}</h2>
              </div>
            </div>
            {groups.active.length ? <ul className="shopping-list">{groups.active.map(renderItem)}</ul> : <p className="shopping-all-done">Wszystko kupione.</p>}
          </section>

          {groups.purchased.length ? (
            <section className="panel shopping-section purchased-section" aria-labelledby="shopping-purchased-heading">
              <div className="shopping-section-heading">
                <div>
                  <p className="section-kicker">Kupione</p>
                  <h2 id="shopping-purchased-heading">{groups.purchased.length} kupione</h2>
                </div>
                <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => void removePurchased()}>Usuń kupione</button>
              </div>
              <ul className="shopping-list">{groups.purchased.map(renderItem)}</ul>
            </section>
          ) : null}
        </div>
      )}

      {toast ? <div className="toast toast-with-action" role="status"><span>{toast.message}</span>{toast.undoJournalId ? <button type="button" onClick={() => void undoLatest(toast.undoJournalId!)}>Cofnij</button> : null}</div> : null}
      </>}
    </section>
  );
}
