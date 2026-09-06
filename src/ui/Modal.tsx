import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}

const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function Modal({ title, children, onClose, wide = false }: ModalProps) {
  const cardRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const card = cardRef.current;
    const preferred = card?.querySelector<HTMLElement>('[data-modal-autofocus="true"]');
    const first = preferred ?? card?.querySelector<HTMLElement>(focusableSelector);
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab' || !card) return;
      const focusable = [...card.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => !element.hidden);
      if (!focusable.length) return;
      const firstElement = focusable[0]!;
      const lastElement = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === firstElement) { event.preventDefault(); lastElement.focus(); }
      else if (!event.shiftKey && document.activeElement === lastElement) { event.preventDefault(); firstElement.focus(); }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={cardRef}
        className={wide ? 'modal-card modal-wide' : 'modal-card'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zamknij okno">×</button>
        </header>
        {children}
      </section>
    </div>
  );
}
