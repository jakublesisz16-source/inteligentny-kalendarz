import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const modal = readFileSync(new URL('../ui/Modal.tsx', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('1.2.0.99 mobile modal keyboard viewport', () => {
  it('tracks the browser visual viewport while a modal is open', () => {
    expect(modal).toContain('window.visualViewport');
    expect(modal).toContain("viewport?.addEventListener('resize', syncVisualViewport)");
    expect(modal).toContain("viewport?.addEventListener('scroll', syncVisualViewport)");
    expect(modal).toContain("--modal-visual-viewport-height");
    expect(modal).toContain("--modal-visual-viewport-offset-top");
    expect(modal).toContain("viewport?.removeEventListener('resize', syncVisualViewport)");
    expect(modal).toContain("viewport?.removeEventListener('scroll', syncVisualViewport)");
  });

  it('sizes the mobile modal to the real keyboard-reduced viewport', () => {
    expect(responsive).toContain('/* 1.2.0.99 - mobile modals follow the real visual viewport when the software keyboard opens. */');
    expect(responsive).toContain('height: var(--modal-visual-viewport-height, 100dvh)');
    expect(responsive).toContain('inset: var(--modal-visual-viewport-offset-top, 0px) 0 auto');
    expect(responsive).toContain('max-height: calc(var(--modal-visual-viewport-height, 100dvh) - max(8px, env(safe-area-inset-top)))');
  });

  it('keeps the checkpoint identity synchronized', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
  });
});
