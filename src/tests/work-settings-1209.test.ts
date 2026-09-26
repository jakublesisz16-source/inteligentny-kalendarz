import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd());
const workView = fs.readFileSync(path.join(root, 'src/work/WorkView.tsx'), 'utf8');
const workProfile = fs.readFileSync(path.join(root, 'src/work/WorkProfileEditor.tsx'), 'utf8');
const planning = fs.readFileSync(path.join(root, 'src/planning/PlanningSettings.tsx'), 'utf8');
const comparison = fs.readFileSync(path.join(root, 'src/work/AvailabilityWorkComparisonPanel.tsx'), 'utf8');

describe('1.2.0.10 simplified Work settings', () => {
  it('uses one visible save action for profile and automation settings in the Work modal', () => {
    expect(workView).toContain('work-settings-header-save');
    expect(workView).toContain("settingsSaving ? 'Zapisuję...' : 'Zapisz'");
    expect(workView).not.toContain('work-settings-save-footer');
    expect(workView).toContain('workProfileSettingsRef.current?.save()');
    expect(workView).toContain('planningSettingsRef.current?.save()');
    expect(workView).toContain('hideSubmit');
    expect(workView).toContain('hideSaveButton');
    expect(workProfile).toContain('export interface WorkProfileEditorHandle');
    expect(planning).toContain('export interface PlanningSettingsHandle');
  });

  it('shows only the basic automatic planner controls in the everyday UI', () => {
    expect(planning).toContain('Cel tygodniowy');
    expect(planning).toContain('Szukaj od');
    expect(planning).toContain('Szukaj do');
    expect(planning).toContain('Sobota');
    expect(planning).toContain('Niedziela handlowa');
    expect(planning).not.toContain('Preferencje i limity');
    expect(planning).not.toContain('Stałe obowiązki i czas dla siebie');
    expect(planning).not.toContain('Minimum proponowanej zmiany');
    expect(planning).not.toContain('Bufor bezpieczeństwa');
  });

  it('keeps old advanced rules transparent without exposing a large configuration form', () => {
    expect(planning).toContain('Masz zapisane dodatkowe reguły z wcześniejszej wersji.');
    expect(planning).toContain('Wyczyść dodatkowe reguły');
    expect(planning).toContain('deleteDailyRoutineRule');
  });

  it('offers a direct route to availability when there is no sent snapshot', () => {
    expect(comparison).toContain('Przejdź do Dyspozycyjności');
    expect(comparison).toContain('onOpenAvailability');
    expect(workView).toContain("onOpenAvailability={() => changeWorkTab('availability')}");
    expect(workView).not.toContain('hasSentAvailability ? <AvailabilityWorkComparisonPanel');
  });
});
