import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  headerActions?: ReactNode;
}

const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function isVisibleFocusable(element: HTMLElement) {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

export function Modal({ title, children, onClose, wide = false, headerActions }: ModalProps) {
  const titleId = useId();
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const body = document.body;
    const openCount = Number(body.dataset.modalOpenCount ?? '0') + 1;
    body.dataset.modalOpenCount = String(openCount);
    body.classList.add('modal-open');
    const card = cardRef.current;
    const backdrop = backdropRef.current;
    const viewport = window.visualViewport;

    function syncVisualViewport() {
      if (!backdrop) return;
      const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
      const offsetTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      backdrop.style.setProperty('--modal-visual-viewport-height', `${height}px`);
      backdrop.style.setProperty('--modal-visual-viewport-offset-top', `${offsetTop}px`);
    }

    syncVisualViewport();
    viewport?.addEventListener('resize', syncVisualViewport);
    viewport?.addEventListener('scroll', syncVisualViewport);
    window.addEventListener('resize', syncVisualViewport);

    const initialFocusable = card ? [...card.querySelectorAll<HTMLElement>(focusableSelector)].filter(isVisibleFocusable) : [];
    const preferred = initialFocusable.find((element) => element.dataset.modalAutofocus === 'true');
    (preferred ?? initialFocusable[0] ?? card)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab' || !card) return;
      const focusable = [...card.querySelectorAll<HTMLElement>(focusableSelector)].filter(isVisibleFocusable);
      if (!focusable.length) { event.preventDefault(); card.focus(); return; }
      const firstElement = focusable[0]!;
      const lastElement = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === firstElement) { event.preventDefault(); lastElement.focus(); }
      else if (!event.shiftKey && document.activeElement === lastElement) { event.preventDefault(); firstElement.focus(); }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      viewport?.removeEventListener('resize', syncVisualViewport);
      viewport?.removeEventListener('scroll', syncVisualViewport);
      window.removeEventListener('resize', syncVisualViewport);
      const remaining = Math.max(0, Number(body.dataset.modalOpenCount ?? '1') - 1);
      if (remaining === 0) {
        delete body.dataset.modalOpenCount;
        body.classList.remove('modal-open');
      } else {
        body.dataset.modalOpenCount = String(remaining);
      }
      previous?.focus();
    };
  }, []);

  return (
    <div ref={backdropRef} className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={cardRef}
        className={wide ? 'modal-card modal-wide' : 'modal-card'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <div className="modal-header-actions">
            {headerActions}
            <button type="button" className="icon-button" onClick={onClose} aria-label="Zamknij okno">×</button>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}
