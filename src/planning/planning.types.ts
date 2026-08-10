import type { CalendarEvent } from '../events/event.types';
import type { DayConstraint } from '../safety/safety.types';

export const ROUTINE_RULE_TYPES = ['FIXED', 'FLEXIBLE'] as const;
export type RoutineRuleType = (typeof ROUTINE_RULE_TYPES)[number];

export const ROUTINE_PRIORITIES = ['REQUIRED', 'PREFERRED'] as const;
export type RoutinePriority = (typeof ROUTINE_PRIORITIES)[number];

export const DAY_ATTRIBUTE_TYPES = ['TRADING_SUNDAY'] as const;
export type DayAttributeType = (typeof DAY_ATTRIBUTE_TYPES)[number];

export const CONSISTENCY_ISSUE_TYPES = [
  'HARD_OVERLAP',
  'TOUCHING',
  'ALL_DAY_CONFLICT',
  'POTENTIAL_DUPLICATE',
  'SOURCE_INCONSISTENCY',
  'ROUTINE_CONFLICT',
] as const;
export type ConsistencyIssueType = (typeof CONSISTENCY_ISSUE_TYPES)[number];

export type PlanningImpact = 'BLOCKING' | 'WARNING' | 'INFO';

export interface DayPlanningProfile {
  id: 'default';
  targetWeeklyWorkMinutes?: number;
  allowedWorkStart?: string;
  allowedWorkEnd?: string;
  preferredWorkStart?: string;
  preferredWorkEnd?: string;
  minimumShiftMinutes?: number;
  maximumShiftMinutes?: number;
  maximumWorkDaysPerWeek?: number;
  maximumWorkMinutesPerDay?: number;
  minimumFullFreeDaysPerWeek?: number;
  allowSaturday?: boolean;
  allowTradingSunday?: boolean;
  defaultBufferMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyRoutineRule {
  id: string;
  name: string;
  type: RoutineRuleType;
  daysOfWeek: number[];
  durationMinutes: number;
  fixedStart?: string;
  fixedEnd?: string;
  preferredWindowStart?: string;
  preferredWindowEnd?: string;
  priority: RoutinePriority;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DayAttribute {
  id: string;
  date: string;
  type: DayAttributeType;
  active: boolean;
  source: 'MANUAL';
  createdAt: string;
  updatedAt: string;
}

export interface ConsistencyAcknowledgement {
  id: string;
  fingerprint: string;
  acknowledgedAt: string;
}

export interface CalendarConsistencyIssue {
  id: string;
  fingerprint: string;
  type: ConsistencyIssueType;
  planningImpact: PlanningImpact;
  eventIds: string[];
  routineRuleId?: string;
  startDateTime: string;
  endDateTime: string;
  overlapMinutes: number;
  gapMinutes?: number;
  categories: string[];
  sources: string[];
  title: string;
  description: string;
  acknowledged: boolean;
}

export interface PlanningTimeBlock {
  startDateTime: string;
  endDateTime: string;
  kind: 'EVENT' | 'ROUTINE';
  eventId?: string;
  routineRuleId?: string;
}

export interface DayPlanningContext {
  date: string;
  events: CalendarEvent[];
  constraints: DayConstraint[];
  attributes: DayAttribute[];
  routines: DailyRoutineRule[];
  freeIntervals: Array<{ startDateTime: string; endDateTime: string; minutes: number }>;
  consistencyIssues: CalendarConsistencyIssue[];
  tradingSunday: boolean;
  excludedFromWorkAvailability: boolean;
}

export interface WeekPlanningContext {
  weekStart: string;
  days: DayPlanningContext[];
  targetWeeklyWorkMinutes: number;
  confirmedWorkMinutes: number;
  remainingWorkMinutes: number;
  overTargetMinutes: number;
  blockingIssueCount: number;
}
