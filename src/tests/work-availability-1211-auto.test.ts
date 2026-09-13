import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const view = fs.readFileSync(path.join(root, 'src/availability/AvailabilityView.tsx'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/availability/availability.service.ts'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'src/planning/PlanningSettings.tsx'), 'utf8');

describe('1.2.0.11 automatic calendar-first work availability', () => {
  it('regenerates automatically when a week has no plan or became stale', () => {
    expect(view).toContain("currentPlan.status === 'STALE'");
    expect(view).toContain('userRejectedAutomaticProposal');
    expect(view).toContain('generateAvailabilityPlan(weekStart)');
  });
  it('shows confirmed work and automatic proposals directly in the weekly rows', () => {
    expect(view).toContain('availability-fixed-work-chip');
    expect(view).toContain('availability-proposal-chip');
  });
  it('uses work location and commute time when building blocking intervals', () => {
    expect(service).toContain('getWorkProfile()');
    expect(service).toContain('travelBufferMinutesForEvent');
    expect(service).toContain('effectiveCommuteMinutes');
  });
  it('keeps commute as one simple basic setting', () => {
    expect(settings).toContain('Dojazd');
    expect(settings).toContain("loaded?.defaultBufferMinutes ?? 30");
  });
});
