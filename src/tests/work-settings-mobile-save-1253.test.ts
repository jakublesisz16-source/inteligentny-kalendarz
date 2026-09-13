import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workView = readFileSync('src/work/WorkView.tsx', 'utf8');
const modal = readFileSync('src/ui/Modal.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.53 mobile work settings save', () => {
  it('puts the primary save action in the modal header', () => {
    expect(modal).toContain('headerActions?: ReactNode');
    expect(workView).toContain('className="button button-primary button-small work-settings-header-save"');
    expect(workView).toContain('saveWorkSettings(true)');
    expect(workView).toContain("setSettingsOpen(false)");
  });

  it('keeps the action visible on mobile and removes the redundant bottom footer there', () => {
    expect(responsive).toContain('1.2.0.53 - keep the primary work-settings action visible without scrolling');
    expect(responsive).toContain('.work-settings-header-save { display: inline-flex;');
    expect(responsive).toContain('.work-settings-modal .work-settings-save-footer { display: none; }');
  });

  it('does not require a database migration', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
