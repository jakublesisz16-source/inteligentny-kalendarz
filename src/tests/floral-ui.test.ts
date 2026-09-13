import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('1.2.0.2 clean visual surface', () => {
  it('does not mount the legacy floral background or inline floral accents', () => {
    const app = read('../app/App.tsx');
    const emptyState = read('../ui/EmptyState.tsx');
    expect(app).not.toContain('AppBackgroundDecor');
    expect(app).not.toContain('FloralAccent');
    expect(app).not.toContain('data-floral-mode');
    expect(emptyState).not.toContain('FloralAccent');
  });

  it('removes the floral appearance control from Settings while retaining data compatibility elsewhere', () => {
    const settings = read('../settings/SettingsView.tsx');
    expect(settings).not.toContain('Motyw kwiatowy');
    expect(settings).not.toContain('Kwiatowy charakter');
  });

  it('keeps the refined calendar-bloom mark shared by navigation and splash', () => {
    const navigation = read('../ui/Navigation.tsx');
    const splash = read('../ui/AppSplash.tsx');
    const mark = read('../ui/AppBrandMark.tsx');
    expect(navigation).toContain('AppBrandMark');
    expect(splash).toContain('AppBrandMark');
    expect(mark).toContain('data-brand-mark="calendar-bloom"');
    expect(mark).toContain('rx="17"');
  });
});
