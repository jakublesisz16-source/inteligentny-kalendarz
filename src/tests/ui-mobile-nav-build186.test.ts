import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const navigation = readFileSync('src/ui/Navigation.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const styles = readFileSync('src/styles/interface-consistency.css', 'utf8');

describe('Build186 startup-safe mobile navigation hotfix', () => {
  it('removes runtime viewport measurement from Navigation', () => {
    expect(navigation).not.toContain('window.visualViewport');
    expect(navigation).not.toContain('getBoundingClientRect');
    expect(navigation).not.toContain('useEffect');
    expect(navigation).not.toContain('useRef');
    expect(navigation).not.toContain('mobile-nav-viewport-lift');
  });

  it('uses the proven CSS-only fixed nav contract', () => {
    expect(responsive).toContain('bottom: max(8px, env(safe-area-inset-bottom));');
    expect(responsive).toContain('height: 70px;');
    expect(responsive).toContain('grid-template-columns: repeat(6, minmax(0, 1fr));');
    expect(styles).toContain('/* 1.2.0.186 - startup-safe mobile nav rollback: no runtime viewport measurement.');
  });

  it('keeps labels readable without changing geometry at runtime', () => {
    expect(styles).toContain('white-space: nowrap;');
    expect(styles).toContain('z-index: 240;');
    expect(styles).not.toContain('--mobile-nav-viewport-lift');
  });
});
