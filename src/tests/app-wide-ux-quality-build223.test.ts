import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/app/App.tsx', 'utf8');
const modal = readFileSync('src/ui/Modal.tsx', 'utf8');
const refinement = readFileSync('src/styles/interface-refinement.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('Build223 app-wide UX quality audit hardening', () => {
  it('adds a keyboard skip link and a named main landmark', () => {
    expect(app).toContain('className="skip-link" href="#main-content"');
    expect(app).toContain('id="main-content" tabIndex={-1} aria-label={activeViewLabel}');
    expect(refinement).toContain('.skip-link');
    expect(refinement).toContain('.skip-link:focus-visible');
  });

  it('keeps the browser tab title in sync with the active main section', () => {
    expect(app).toContain("document.title = `${activeLabel} - Inteligentny Kalendarz`");
    expect(app).toContain('NAVIGATION_ITEMS.find((item) => item.id === view)');
  });

  it('gives each modal a unique accessible title id and a safe fallback focus target', () => {
    expect(modal).toContain('const titleId = useId();');
    expect(modal).toContain('aria-labelledby={titleId}');
    expect(modal).toContain('<h2 id={titleId}>{title}</h2>');
    expect(modal).toContain('tabIndex={-1}');
    expect(modal).not.toContain('id="modal-title"');
  });

  it('keeps CSS-hidden controls out of the modal focus trap', () => {
    expect(modal).toContain('function isVisibleFocusable');
    expect(modal).toContain("style.display !== 'none'");
    expect(modal).toContain("style.visibility !== 'hidden'");
    expect(modal).toContain('element.getClientRects().length > 0');
    expect(modal).toContain('.filter(isVisibleFocusable)');
  });

  it('provides shared focus-visible fallback and prevents background page scrolling behind modals', () => {
    expect(refinement).toContain(':where(.button, .icon-button, .nav-item, .bottom-nav-item, .filter-button):focus-visible');
    expect(refinement).toContain('body.modal-open { overflow: hidden; }');
  });

  it('keeps the database schema stable', () => {
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
