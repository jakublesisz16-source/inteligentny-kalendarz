import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createMonthGrid,
  eventOccursOnDate,
  formatMonthLabel,
  formatTime,
  sameMonth,
  sortEventsForDay,
  toLocalDateKey,
  combineDateAndTime,
} from './date.utils';
import { categoryCountsByDate } from './category-counters';
import type { CalendarEvent, EventDraft } from '../events/event.types';
import type { Location } from '../locations/location.types';
import type { TimeFormat } from '../settings/settings.types';
import type { DayConstraint } from '../safety/safety.types';
import type { CalendarConsistencyIssue, DayAttribute } from '../planning/planning.types';
import { ConsistencyCenter } from '../planning/ConsistencyCenter';
import { EventCard } from '../events/EventCard';
import { QuickEventEditor } from '../events/QuickEventEditor';
import { studyEventDisplay } from '../events/study-event-display';
import { EmptyState } from '../ui/EmptyState';
import type { AvailabilityPlan } from '../availability/availability.types';
import type { CoworkerOverlap } from '../work/work.types';
import type { UniversityImportEntry } from '../study/study.types';
import { studyGroupDisplayLabel } from '../imports/xlsx/group-normalizer';
import { buildWeekTimedEventLayout } from './week-layout';
import { detectPeriodSwipe, type SwipePoint } from './swipe-navigation';
import { buildMovedWeekEventDraft, buildResizedWeekEventDraft, canDragWeekEvent, canResizeWeekEvent, computeWeekDropStartMinutes, computeWeekResizeEndMinutes, weekEventDurationMinutes, weekEventStartMinutes } from './week-drag';
import { computeMobileWeekTargetDayIndex, shouldCancelWeekLongPress } from './week-touch-drag';
import { calendarOverlayMarkersForDate } from './calendar-overlays';

interface CalendarViewProps {
  events: CalendarEvent[];
  locations: Location[];
  timeFormat: TimeFormat;
  showPolishHolidays: boolean;
  showWumAcademicCalendar: boolean;
  dayConstraints: DayConstraint[];
  dayAttributes: DayAttribute[];
  consistencyIssues: CalendarConsistencyIssue[];
  activeStudyGroups?: string[];
  incompleteStudyEntries?: UniversityImportEntry[];
  onToggleWorkAvailabilityExclusion: (date: string, excluded: boolean) => Promise<void>;
  onToggleTradingSunday: (date: string, active: boolean) => Promise<void>;
  onAcknowledgeConsistency: (issue: CalendarConsistencyIssue) => Promise<void>;
  onAdd: (date?: Date, initialTitle?: string, initialEndDate?: Date) => void;
  onQuickAdd: (draft: EventDraft) => Promise<void>;
  onQuickEdit: (event: CalendarEvent, draft: EventDraft) => Promise<void>;
  onQuickMove: (event: CalendarEvent, draft: EventDraft) => Promise<void>;
  onQuickDelete: (event: CalendarEvent) => Promise<void>;
  onAddMany: (dateKeys: string[]) => void;
  onEdit: (event: CalendarEvent) => void;
  onStudyCorrect?: (event: CalendarEvent) => void;
  onStudySeriesCorrect: (event: CalendarEvent) => void;
  availabilityPlans?: AvailabilityPlan[];
  coworkersByEvent?: Record<string, CoworkerOverlap[]>;
  onOpenAvailability: (date: string, blockId?: string) => void;
}

const weekdayLabels = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'];
const categoryLabels = { STUDY: 'Zajęcia', WORK: 'Praca', PERSONAL: 'Prywatne', OTHER: 'Inne' } as const;

type CalendarDisplayMode = 'MONTH' | 'WEEK';
type CalendarFilter = 'ALL' | 'STUDY' | 'WORK' | 'MY';

const calendarFilters: Array<{ id: CalendarFilter; label: string }> = [
  { id: 'ALL', label: 'Wszystko' },
  { id: 'STUDY', label: 'Studia' },
  { id: 'WORK', label: 'Praca' },
  { id: 'MY', label: 'Moje' },
];

const CALENDAR_DISPLAY_MODE_STORAGE_KEY = 'ik.calendar.display-mode';
const CALENDAR_FILTER_STORAGE_KEY = 'ik.calendar.filter';

function readSavedDisplayMode(): CalendarDisplayMode {
  if (typeof window === 'undefined') return 'MONTH';
  try {
    const saved = window.localStorage.getItem(CALENDAR_DISPLAY_MODE_STORAGE_KEY);
    return saved === 'WEEK' ? 'WEEK' : 'MONTH';
  } catch {
    return 'MONTH';
  }
}

function readSavedFilter(): CalendarFilter {
  if (typeof window === 'undefined') return 'ALL';
  try {
    const saved = window.localStorage.getItem(CALENDAR_FILTER_STORAGE_KEY);
    return saved === 'STUDY' || saved === 'WORK' || saved === 'MY' ? saved : 'ALL';
  } catch {
    return 'ALL';
  }
}

const WEEK_START_HOUR = 6;
const WEEK_END_HOUR = 23;
const WEEK_HOUR_HEIGHT = 48;
const WEEK_HOUR_MIN_HEIGHT = 30;
const WEEK_DESKTOP_VERTICAL_CHROME = 225;
const WEEK_MOBILE_VERTICAL_CHROME = 350;

type QuickAddSource = 'WEEK' | 'MONTH';
type QuickAddState = {
  source: QuickAddSource;
  dateKey: string;
  hour: number;
  startTime: string;
  endTime: string;
  title: string;
  saving: boolean;
  error: string;
};

type WeekDragState = {
  eventId: string;
  durationMinutes: number;
  grabOffsetMinutes: number;
  previewDateKey: string;
  previewStartMinutes: number;
  inputMode: 'desktop' | 'touch';
};

type MobileWeekTouchSession = {
  touchId: number;
  eventId: string;
  startX: number;
  startY: number;
  originDateKey: string;
  originDayIndex: number;
  durationMinutes: number;
  grabOffsetMinutes: number;
  previewDateKey: string;
  previewStartMinutes: number;
  startScrollTop: number;
  startWindowScrollY: number;
  activated: boolean;
};

type WeekResizeState = {
  eventId: string;
  dateKey: string;
  startMinutes: number;
  previewEndMinutes: number;
  inputMode: 'desktop' | 'touch';
};

type WeekResizeSession = WeekResizeState & {
  pointerId: number;
  column: HTMLElement;
};

const MOBILE_WEEK_LONG_PRESS_MS = 450;

function calculateWeekHourHeight(): number {
  if (typeof window === 'undefined') return WEEK_HOUR_HEIGHT;
  const hourCount = WEEK_END_HOUR - WEEK_START_HOUR;
  if (window.innerWidth <= 620) {
    const availableHeight = Math.max(442, window.innerHeight - WEEK_MOBILE_VERTICAL_CHROME);
    return Math.max(26, Math.min(32, Math.floor(availableHeight / hourCount)));
  }
  if (window.innerWidth <= 820) return 40;
  const availableHeight = Math.max(WEEK_HOUR_MIN_HEIGHT * hourCount, window.innerHeight - WEEK_DESKTOP_VERTICAL_CHROME);
  return Math.max(WEEK_HOUR_MIN_HEIGHT, Math.min(WEEK_HOUR_HEIGHT, Math.floor(availableHeight / hourCount)));
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const mondayOffset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - mondayOffset);
  return copy;
}

function addCalendarDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function clampQuickAddHour(hour: number): number {
  return Math.max(WEEK_START_HOUR, Math.min(hour, WEEK_END_HOUR - 1));
}

function defaultQuickAddHour(day: Date): number {
  const now = new Date();
  const sameDay = toLocalDateKey(day) === toLocalDateKey(now);
  return clampQuickAddHour(sameDay ? now.getHours() : 12);
}

function buildQuickAddState(day: Date, source: QuickAddSource, initialHour?: number): QuickAddState {
  const hour = clampQuickAddHour(initialHour ?? defaultQuickAddHour(day));
  const startTime = `${String(hour).padStart(2, '0')}:00`;
  const endTime = `${String(Math.min(hour + 1, 23)).padStart(2, '0')}:00`;
  return { source, dateKey: toLocalDateKey(day), hour, startTime, endTime, title: '', saving: false, error: '' };
}

function shouldUseMobileEventSheet(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches;
}

function dateAtHour(day: Date, hour: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0);
}

function formatWeekLabel(start: Date, end: Date): string {
  const startText = start.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  const endText = end.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startText} - ${endText}`;
}

function eventMatchesCalendarFilter(event: CalendarEvent, filter: CalendarFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'STUDY') return event.category === 'STUDY';
  if (filter === 'WORK') return event.category === 'WORK';
  return event.category === 'PERSONAL' || event.category === 'OTHER';
}


function issueDateKeys(issue: CalendarConsistencyIssue): string[] {
  const start = new Date(`${issue.startDateTime.slice(0, 10)}T12:00:00`);
  const end = new Date(`${issue.endDateTime.slice(0, 10)}T12:00:00`);
  const result: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    result.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function incompleteEntryAppliesOnDate(entry: UniversityImportEntry, dateKey: string): boolean {
  if (entry.date) return entry.date === dateKey;
  if (entry.sourceWeekStart && entry.sourceWeekEnd) return dateKey === entry.sourceWeekStart;
  return false;
}

function incompleteEntryRangeLabel(entry: UniversityImportEntry): string {
  if (entry.date) return entry.date;
  if (entry.sourceWeekStart && entry.sourceWeekEnd) return `${entry.sourceWeekStart} - ${entry.sourceWeekEnd}`;
  return 'Termin nieustalony';
}

function calendarEventTimeLabel(event: CalendarEvent, dateKey: string, timeFormat: TimeFormat): string {
  if (event.allDay) return 'Cały dzień';
  const startKey = toLocalDateKey(event.startDateTime);
  const endKey = toLocalDateKey(event.endDateTime);
  const start = formatTime(event.startDateTime, timeFormat);
  const end = formatTime(event.endDateTime, timeFormat);
  if (startKey === endKey) return `${start}-${end}`;
  if (dateKey === startKey) return `od ${start}`;
  if (dateKey === endKey) return `do ${end}`;
  return 'trwa';
}

export function CalendarView({ events, locations, timeFormat, showPolishHolidays, showWumAcademicCalendar, dayConstraints, dayAttributes, consistencyIssues, incompleteStudyEntries = [], onToggleWorkAvailabilityExclusion, onToggleTradingSunday, onAcknowledgeConsistency, onAdd, onQuickAdd, onQuickEdit, onQuickMove, onQuickDelete, onAddMany, onEdit, onStudyCorrect, onStudySeriesCorrect, availabilityPlans = [], coworkersByEvent = {}, onOpenAvailability }: CalendarViewProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => { const today = new Date(); return new Date(today.getFullYear(), today.getMonth(), today.getDate()); });
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [weekHourHeight, setWeekHourHeight] = useState(calculateWeekHourHeight);
  const [displayMode, setDisplayMode] = useState<CalendarDisplayMode>(readSavedDisplayMode);
  const [filter, setFilter] = useState<CalendarFilter>(readSavedFilter);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDateKeys, setSelectedDateKeys] = useState<string[]>([]);
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null);
  const [quickEditEventId, setQuickEditEventId] = useState<string | null>(null);
  const [mobileDayPanelOpen, setMobileDayPanelOpen] = useState(false);
  const [desktopWeekDragEnabled, setDesktopWeekDragEnabled] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 821px)').matches);
  const [weekDrag, setWeekDrag] = useState<WeekDragState | null>(null);
  const [weekResize, setWeekResize] = useState<WeekResizeState | null>(null);
  const weekResizeSessionRef = useRef<WeekResizeSession | null>(null);
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const suppressWeekEventClickUntilRef = useRef(0);
  const mobileWeekTouchSessionRef = useRef<MobileWeekTouchSession | null>(null);
  const mobileWeekLongPressTimerRef = useRef<number | null>(null);
  const periodSwipeStartRef = useRef<SwipePoint | null>(null);
  const suppressSwipeClickUntilRef = useRef(0);
  const days = useMemo(() => createMonthGrid(visibleMonth), [visibleMonth]);
  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index)), [weekStart]);
  const filteredEvents = useMemo(() => events.filter((event) => eventMatchesCalendarFilter(event, filter)), [events, filter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(CALENDAR_DISPLAY_MODE_STORAGE_KEY, displayMode); } catch { /* storage may be blocked */ }
  }, [displayMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(CALENDAR_FILTER_STORAGE_KEY, filter); } catch { /* storage may be blocked */ }
  }, [filter]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let frame = 0;
    const refreshWeekDensity = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setWeekHourHeight(calculateWeekHourHeight());
        setDesktopWeekDragEnabled(window.matchMedia('(min-width: 821px)').matches);
      });
    };
    refreshWeekDensity();
    window.addEventListener('resize', refreshWeekDensity);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', refreshWeekDensity);
    };
  }, []);

  useEffect(() => () => {
    if (mobileWeekLongPressTimerRef.current !== null) window.clearTimeout(mobileWeekLongPressTimerRef.current);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || weekDrag?.inputMode !== 'touch') return undefined;
    const handleTouchMove = (event: TouchEvent) => {
      const session = mobileWeekTouchSessionRef.current;
      if (!session?.activated) return;
      if (event.touches.length !== 1) {
        event.preventDefault();
        cancelMobileWeekTouchSession(true);
        return;
      }
      const touch = Array.from(event.touches).find((item) => item.identifier === session.touchId);
      if (!touch) return;
      event.preventDefault();
      updateMobileWeekTouchPosition(touch);
    };
    const handleTouchEnd = (event: TouchEvent) => {
      const session = mobileWeekTouchSessionRef.current;
      if (!session?.activated || !Array.from(event.changedTouches).some((item) => item.identifier === session.touchId)) return;
      event.preventDefault();
      void commitMobileWeekTouchDrag();
    };
    const handleTouchCancel = (event: TouchEvent) => {
      const session = mobileWeekTouchSessionRef.current;
      if (!session?.activated || !Array.from(event.changedTouches).some((item) => item.identifier === session.touchId)) return;
      event.preventDefault();
      cancelMobileWeekTouchSession(true);
    };
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: false });
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [weekDrag?.inputMode]);

  useEffect(() => {
    setMobileDayPanelOpen(false);
    cancelMobileWeekTouchSession();
    weekResizeSessionRef.current = null;
    setWeekResize(null);
    setWeekDrag(null);
    setQuickAdd((current) => {
      if (!current) return current;
      if (displayMode === 'WEEK' && current.source !== 'WEEK') return null;
      if (displayMode === 'MONTH' && current.source !== 'MONTH') return null;
      return current;
    });
  }, [displayMode]);

  useEffect(() => {
    if (!mobileDayPanelOpen || typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.classList.add('calendar-day-sheet-open');
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      body.classList.remove('calendar-day-sheet-open');
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [mobileDayPanelOpen]);


  useEffect(() => {
    if (!selectionMode) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSelectionMode(false); setSelectedDateKeys([]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectionMode]);

  const countsByDate = useMemo(() => categoryCountsByDate(filteredEvents), [filteredEvents]);
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of days) {
      const key = toLocalDateKey(day);
      const matching = sortEventsForDay(filteredEvents.filter((event) => eventOccursOnDate(event, key)));
      if (matching.length) map.set(key, matching);
    }
    return map;
  }, [days, filteredEvents]);
  const weekEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of weekDays) {
      const key = toLocalDateKey(day);
      map.set(key, sortEventsForDay(filteredEvents.filter((event) => eventOccursOnDate(event, key))));
    }
    return map;
  }, [filteredEvents, weekDays]);

  const issuesByDate = useMemo(() => {
    const map = new Map<string, CalendarConsistencyIssue[]>();
    for (const issue of consistencyIssues.filter((item) => !item.acknowledged)) {
      for (const key of issueDateKeys(issue)) map.set(key, [...(map.get(key) ?? []), issue]);
    }
    return map;
  }, [consistencyIssues]);

  const incompleteStudyByDate = useMemo(() => {
    const map = new Map<string, UniversityImportEntry[]>();
    for (const day of days) {
      const key = toLocalDateKey(day);
      const entries = incompleteStudyEntries.filter((entry) => incompleteEntryAppliesOnDate(entry, key));
      if (entries.length) map.set(key, entries);
    }
    return map;
  }, [days, incompleteStudyEntries]);

  const seriesCountById = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((event) => { if (event.seriesId && event.seriesType === 'MANUAL_MULTI_DATE') map.set(event.seriesId, (map.get(event.seriesId) ?? 0) + 1); });
    return map;
  }, [events]);

  const selectedKey = toLocalDateKey(selectedDate);
  const selectedDayOverlayMarkers = calendarOverlayMarkersForDate(selectedKey, { showPolishHolidays, showWumAcademicCalendar });
  const todayKey = toLocalDateKey(currentTime);
  const selectedEvents = useMemo(() => sortEventsForDay(filteredEvents.filter((event) => eventOccursOnDate(event, selectedKey))), [filteredEvents, selectedKey]);
  const selectedIncompleteStudyEntries = useMemo(() => (filter === 'ALL' || filter === 'STUDY') ? incompleteStudyEntries.filter((entry) => incompleteEntryAppliesOnDate(entry, selectedKey)) : [], [filter, incompleteStudyEntries, selectedKey]);

  useEffect(() => {
    setQuickEditEventId(null);
  }, [selectedKey, filter]);
  const selectedDayIssues = issuesByDate.get(selectedKey) ?? [];
  useEffect(() => {
    if (displayMode !== 'WEEK' || typeof window === 'undefined' || !window.matchMedia('(max-width: 620px)').matches) return;
    const container = weekScrollRef.current;
    if (!container) return;
    if (weekHourHeight <= 32) {
      window.requestAnimationFrame(() => { container.scrollTop = 0; });
      return;
    }
    const selectedEventsForWeek = weekEventsByDate.get(selectedKey) ?? [];
    const firstTimed = selectedEventsForWeek.find((event) => !event.allDay);
    const firstHour = firstTimed ? Number(firstTimed.startDateTime.slice(11, 13)) : undefined;
    const targetHour = selectedKey === todayKey ? currentTime.getHours() - 1 : firstHour !== undefined ? firstHour - 1 : 8;
    const clampedHour = Math.max(WEEK_START_HOUR, Math.min(targetHour, WEEK_END_HOUR - 3));
    window.requestAnimationFrame(() => { container.scrollTop = Math.max(0, (clampedHour - WEEK_START_HOUR) * weekHourHeight); });
  }, [displayMode, selectedKey, todayKey, weekEventsByDate, weekHourHeight]);

  const locationMap = new Map(locations.map((location) => [location.id, location]));
  const conflictEventIds = useMemo(() => new Set(consistencyIssues.filter((issue) => !issue.acknowledged).flatMap((issue) => issue.eventIds)), [consistencyIssues]);
  const periodLabel = displayMode === 'MONTH' ? formatMonthLabel(visibleMonth) : formatWeekLabel(weekDays[0] ?? selectedDate, weekDays[6] ?? selectedDate);
  const weekTimelineHeight = (WEEK_END_HOUR - WEEK_START_HOUR) * weekHourHeight;

  function mobilePeriodSwipeEnabled(): boolean {
    return typeof window !== 'undefined'
      && window.matchMedia('(max-width: 820px)').matches
      && !selectionMode
      && !quickAdd
      && !mobileDayPanelOpen
      && !mobileWeekTouchSessionRef.current?.activated
      && weekDrag?.inputMode !== 'touch'
      && weekResize?.inputMode !== 'touch';
  }

  function handlePeriodSwipeStart(event: React.TouchEvent<HTMLElement>) {
    if (!mobilePeriodSwipeEnabled() || event.touches.length !== 1) {
      periodSwipeStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    if (!touch) {
      periodSwipeStartRef.current = null;
      return;
    }
    periodSwipeStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }

  function handlePeriodSwipeEnd(event: React.TouchEvent<HTMLElement>) {
    const start = periodSwipeStartRef.current;
    periodSwipeStartRef.current = null;
    if (!start || !mobilePeriodSwipeEnabled() || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const delta = detectPeriodSwipe(start, { x: touch.clientX, y: touch.clientY, time: Date.now() });
    if (!delta) return;
    suppressSwipeClickUntilRef.current = Date.now() + 450;
    changePeriod(delta);
  }

  function handlePeriodSwipeCancel() {
    periodSwipeStartRef.current = null;
  }

  function handlePeriodSwipeClickCapture(event: React.MouseEvent<HTMLElement>) {
    if (Date.now() >= suppressSwipeClickUntilRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function formatMinuteTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (timeFormat === '24h') return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    return new Date(2000, 0, 1, hours, mins).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function startWeekResize(event: React.PointerEvent<HTMLSpanElement>, calendarEvent: CalendarEvent) {
    const inputMode: WeekResizeState['inputMode'] = event.pointerType === 'touch' || event.pointerType === 'pen' ? 'touch' : 'desktop';
    const allowed = inputMode === 'desktop'
      ? desktopWeekDragEnabled
      : typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches;
    if (!allowed || !canResizeWeekEvent(calendarEvent) || event.button !== 0) return;
    const startMinutes = weekEventStartMinutes(calendarEvent);
    const durationMinutes = weekEventDurationMinutes(calendarEvent);
    const column = event.currentTarget.closest<HTMLElement>('.calendar-week-column');
    if (startMinutes === null || !durationMinutes || !column) return;
    event.preventDefault();
    event.stopPropagation();
    clearMobileWeekLongPressTimer();
    mobileWeekTouchSessionRef.current = null;
    periodSwipeStartRef.current = null;
    const dateKey = toLocalDateKey(calendarEvent.startDateTime);
    const session: WeekResizeSession = {
      pointerId: event.pointerId,
      eventId: calendarEvent.id,
      dateKey,
      startMinutes,
      previewEndMinutes: startMinutes + durationMinutes,
      inputMode,
      column,
    };
    weekResizeSessionRef.current = session;
    setQuickAdd(null);
    setWeekDrag(null);
    setWeekResize({ eventId: session.eventId, dateKey, startMinutes, previewEndMinutes: session.previewEndMinutes, inputMode });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (inputMode === 'touch' && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12);
  }

  function updateWeekResize(event: React.PointerEvent<HTMLSpanElement>) {
    const session = weekResizeSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (session.inputMode === 'touch') {
      const scroll = weekScrollRef.current;
      if (scroll) {
        const scrollRect = scroll.getBoundingClientRect();
        if (event.clientY < scrollRect.top + 56) scroll.scrollTop = Math.max(0, scroll.scrollTop - 18);
        else if (event.clientY > scrollRect.bottom - 56) scroll.scrollTop += 18;
      }
    }
    const previewEndMinutes = computeWeekResizeEndMinutes({
      clientY: event.clientY,
      columnTop: session.column.getBoundingClientRect().top,
      hourHeight: weekHourHeight,
      startHour: WEEK_START_HOUR,
      endHour: WEEK_END_HOUR,
      eventStartMinutes: session.startMinutes,
    });
    if (previewEndMinutes === null || previewEndMinutes === session.previewEndMinutes) return;
    session.previewEndMinutes = previewEndMinutes;
    setWeekResize({ eventId: session.eventId, dateKey: session.dateKey, startMinutes: session.startMinutes, previewEndMinutes, inputMode: session.inputMode });
  }

  async function finishWeekResize(event: React.PointerEvent<HTMLSpanElement>) {
    const session = weekResizeSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    weekResizeSessionRef.current = null;
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* pointer capture may already be released */ }
    suppressWeekEventClickUntilRef.current = Date.now() + 450;
    suppressSwipeClickUntilRef.current = Date.now() + 450;
    setWeekResize(null);
    const resizedEvent = events.find((item) => item.id === session.eventId);
    if (!resizedEvent) return;
    const draft = buildResizedWeekEventDraft(resizedEvent, session.previewEndMinutes);
    if (!draft || draft.endDateTime === resizedEvent.endDateTime) return;
    await onQuickEdit(resizedEvent, draft);
  }

  function cancelWeekResize(event?: React.PointerEvent<HTMLSpanElement>) {
    const session = weekResizeSessionRef.current;
    if (!session) return;
    event?.preventDefault();
    event?.stopPropagation();
    weekResizeSessionRef.current = null;
    suppressWeekEventClickUntilRef.current = Date.now() + 300;
    suppressSwipeClickUntilRef.current = Date.now() + 300;
    setWeekResize(null);
  }

  function handleWeekResizeLostPointerCapture(event: React.PointerEvent<HTMLSpanElement>) {
    const session = weekResizeSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    weekResizeSessionRef.current = null;
    suppressWeekEventClickUntilRef.current = Date.now() + 300;
    suppressSwipeClickUntilRef.current = Date.now() + 300;
    setWeekResize(null);
  }

  function startWeekEventDrag(event: React.DragEvent<HTMLButtonElement>, calendarEvent: CalendarEvent) {
    if (weekResizeSessionRef.current?.eventId === calendarEvent.id || !desktopWeekDragEnabled || !canDragWeekEvent(calendarEvent)) {
      event.preventDefault();
      return;
    }
    const durationMinutes = weekEventDurationMinutes(calendarEvent);
    if (!durationMinutes) {
      event.preventDefault();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const rawOffset = ((event.clientY - rect.top) / Math.max(1, weekHourHeight)) * 60;
    const grabOffsetMinutes = Math.max(0, Math.min(durationMinutes - 1, rawOffset));
    const startTime = calendarEvent.startDateTime.slice(11, 16);
    const [hours = '0', minutes = '0'] = startTime.split(':');
    const previewStartMinutes = Number(hours) * 60 + Number(minutes);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', calendarEvent.id);
    setQuickAdd(null);
    setWeekDrag({
      eventId: calendarEvent.id,
      durationMinutes,
      grabOffsetMinutes,
      previewDateKey: toLocalDateKey(calendarEvent.startDateTime),
      previewStartMinutes,
      inputMode: 'desktop',
    });
  }

  function updateWeekDragPreview(event: React.DragEvent<HTMLDivElement>, dateKey: string) {
    if (!weekDrag || weekDrag.inputMode !== 'desktop' || !desktopWeekDragEnabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const startMinutes = computeWeekDropStartMinutes({
      clientY: event.clientY,
      columnTop: rect.top,
      hourHeight: weekHourHeight,
      startHour: WEEK_START_HOUR,
      endHour: WEEK_END_HOUR,
      durationMinutes: weekDrag.durationMinutes,
      grabOffsetMinutes: weekDrag.grabOffsetMinutes,
    });
    if (startMinutes === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (weekDrag.previewDateKey === dateKey && weekDrag.previewStartMinutes === startMinutes) return;
    setWeekDrag((current) => current ? { ...current, previewDateKey: dateKey, previewStartMinutes: startMinutes } : current);
  }

  async function dropWeekEvent(event: React.DragEvent<HTMLDivElement>, dateKey: string) {
    if (!weekDrag || weekDrag.inputMode !== 'desktop' || !desktopWeekDragEnabled) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const startMinutes = computeWeekDropStartMinutes({
      clientY: event.clientY,
      columnTop: rect.top,
      hourHeight: weekHourHeight,
      startHour: WEEK_START_HOUR,
      endHour: WEEK_END_HOUR,
      durationMinutes: weekDrag.durationMinutes,
      grabOffsetMinutes: weekDrag.grabOffsetMinutes,
    });
    const draggedEvent = events.find((item) => item.id === weekDrag.eventId);
    if (!draggedEvent || startMinutes === null) {
      setWeekDrag(null);
      return;
    }
    const draft = buildMovedWeekEventDraft(draggedEvent, dateKey, startMinutes);
    if (!draft) {
      setWeekDrag(null);
      return;
    }
    if (draft.startDateTime === draggedEvent.startDateTime && draft.endDateTime === draggedEvent.endDateTime) {
      setWeekDrag(null);
      return;
    }
    suppressWeekEventClickUntilRef.current = Date.now() + 450;
    setWeekDrag(null);
    await onQuickMove(draggedEvent, draft);
    const [year = '0', month = '1', day = '1'] = dateKey.split('-');
    setSelectedDate(new Date(Number(year), Number(month) - 1, Number(day)));
  }

  function clearMobileWeekLongPressTimer() {
    if (mobileWeekLongPressTimerRef.current !== null) {
      window.clearTimeout(mobileWeekLongPressTimerRef.current);
      mobileWeekLongPressTimerRef.current = null;
    }
  }

  function cancelMobileWeekTouchSession(suppressClick = false) {
    if (typeof window !== 'undefined') clearMobileWeekLongPressTimer();
    if (suppressClick) suppressWeekEventClickUntilRef.current = Date.now() + 450;
    mobileWeekTouchSessionRef.current = null;
    setWeekDrag((current) => current?.inputMode === 'touch' ? null : current);
  }

  function mobileWeekTouchEnabled(calendarEvent: CalendarEvent): boolean {
    return displayMode === 'WEEK'
      && !desktopWeekDragEnabled
      && typeof window !== 'undefined'
      && window.matchMedia('(max-width: 820px)').matches
      && canDragWeekEvent(calendarEvent);
  }

  function startMobileWeekLongPress(event: React.TouchEvent<HTMLButtonElement>, calendarEvent: CalendarEvent, day: Date) {
    if (!mobileWeekTouchEnabled(calendarEvent) || event.touches.length !== 1) return;
    const durationMinutes = weekEventDurationMinutes(calendarEvent);
    if (!durationMinutes) return;
    const touch = event.touches[0];
    if (!touch) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rawOffset = ((touch.clientY - rect.top) / Math.max(1, weekHourHeight)) * 60;
    const grabOffsetMinutes = Math.max(0, Math.min(durationMinutes - 1, rawOffset));
    const [hours = '0', minutes = '0'] = calendarEvent.startDateTime.slice(11, 16).split(':');
    const previewStartMinutes = Number(hours) * 60 + Number(minutes);
    const originDateKey = toLocalDateKey(day);
    const originDayIndex = Math.max(0, weekDays.findIndex((item) => toLocalDateKey(item) === originDateKey));

    clearMobileWeekLongPressTimer();
    mobileWeekTouchSessionRef.current = {
      touchId: touch.identifier,
      eventId: calendarEvent.id,
      startX: touch.clientX,
      startY: touch.clientY,
      originDateKey,
      originDayIndex,
      durationMinutes,
      grabOffsetMinutes,
      previewDateKey: originDateKey,
      previewStartMinutes,
      startScrollTop: weekScrollRef.current?.scrollTop ?? 0,
      startWindowScrollY: window.scrollY,
      activated: false,
    };

    mobileWeekLongPressTimerRef.current = window.setTimeout(() => {
      mobileWeekLongPressTimerRef.current = null;
      const session = mobileWeekTouchSessionRef.current;
      if (!session || session.eventId !== calendarEvent.id || session.activated) return;
      const scrollTop = weekScrollRef.current?.scrollTop ?? session.startScrollTop;
      if (Math.abs(scrollTop - session.startScrollTop) > 1 || Math.abs(window.scrollY - session.startWindowScrollY) > 1) {
        mobileWeekTouchSessionRef.current = null;
        return;
      }
      session.activated = true;
      periodSwipeStartRef.current = null;
      setQuickAdd(null);
      setMobileDayPanelOpen(false);
      setWeekDrag({
        eventId: session.eventId,
        durationMinutes: session.durationMinutes,
        grabOffsetMinutes: session.grabOffsetMinutes,
        previewDateKey: session.previewDateKey,
        previewStartMinutes: session.previewStartMinutes,
        inputMode: 'touch',
      });
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(18);
    }, MOBILE_WEEK_LONG_PRESS_MS);
  }

  function handleMobileWeekScroll() {
    const session = mobileWeekTouchSessionRef.current;
    if (!session || session.activated) return;
    const scrollTop = weekScrollRef.current?.scrollTop ?? session.startScrollTop;
    if (Math.abs(scrollTop - session.startScrollTop) <= 1) return;
    clearMobileWeekLongPressTimer();
    mobileWeekTouchSessionRef.current = null;
  }

  function updateMobileWeekTouchPosition(touch: Pick<React.Touch, 'clientX' | 'clientY'>) {
    const session = mobileWeekTouchSessionRef.current;
    if (!session?.activated) return;
    const scroll = weekScrollRef.current;
    const selectedColumn = scroll?.querySelector<HTMLElement>('.calendar-week-column.selected');
    if (!scroll || !selectedColumn) return;
    const scrollRect = scroll.getBoundingClientRect();
    if (touch.clientY < scrollRect.top + 54) scroll.scrollTop = Math.max(0, scroll.scrollTop - 18);
    else if (touch.clientY > scrollRect.bottom - 54) scroll.scrollTop += 18;

    const columnRect = selectedColumn.getBoundingClientRect();
    const previewStartMinutes = computeWeekDropStartMinutes({
      clientY: touch.clientY,
      columnTop: columnRect.top,
      hourHeight: weekHourHeight,
      startHour: WEEK_START_HOUR,
      endHour: WEEK_END_HOUR,
      durationMinutes: session.durationMinutes,
      grabOffsetMinutes: session.grabOffsetMinutes,
    });
    if (previewStartMinutes === null) return;
    const targetIndex = computeMobileWeekTargetDayIndex({
      startIndex: session.originDayIndex,
      startX: session.startX,
      currentX: touch.clientX,
      viewportWidth: window.innerWidth,
      dayCount: weekDays.length,
    });
    const targetDay = weekDays[targetIndex] ?? weekDays[session.originDayIndex];
    if (!targetDay) return;
    const previewDateKey = toLocalDateKey(targetDay);
    session.previewDateKey = previewDateKey;
    session.previewStartMinutes = previewStartMinutes;
    setWeekDrag((current) => current?.inputMode === 'touch' ? { ...current, previewDateKey, previewStartMinutes } : current);
  }

  function moveMobileWeekTouchDrag(event: React.TouchEvent<HTMLButtonElement>) {
    const session = mobileWeekTouchSessionRef.current;
    if (!session) return;
    if (event.touches.length !== 1) {
      if (session.activated) {
        event.preventDefault();
        cancelMobileWeekTouchSession(true);
      } else {
        clearMobileWeekLongPressTimer();
        mobileWeekTouchSessionRef.current = null;
      }
      return;
    }
    const touch = Array.from(event.touches).find((item) => item.identifier === session.touchId);
    if (!touch) return;
    if (session.activated) {
      event.preventDefault();
      updateMobileWeekTouchPosition(touch);
      return;
    }
    if (shouldCancelWeekLongPress({ x: session.startX, y: session.startY }, { x: touch.clientX, y: touch.clientY })) {
      clearMobileWeekLongPressTimer();
      mobileWeekTouchSessionRef.current = null;
    }
  }

  async function commitMobileWeekTouchDrag() {
    const session = mobileWeekTouchSessionRef.current;
    clearMobileWeekLongPressTimer();
    if (!session?.activated) return;
    mobileWeekTouchSessionRef.current = null;
    suppressWeekEventClickUntilRef.current = Date.now() + 500;
    setWeekDrag(null);
    const draggedEvent = events.find((item) => item.id === session.eventId);
    if (!draggedEvent) return;
    const draft = buildMovedWeekEventDraft(draggedEvent, session.previewDateKey, session.previewStartMinutes);
    if (!draft || (draft.startDateTime === draggedEvent.startDateTime && draft.endDateTime === draggedEvent.endDateTime)) return;
    await onQuickMove(draggedEvent, draft);
    const [year = '0', month = '1', day = '1'] = session.previewDateKey.split('-');
    setSelectedDate(new Date(Number(year), Number(month) - 1, Number(day)));
  }

  function finishMobileWeekTouchDrag(event?: React.TouchEvent<HTMLButtonElement>) {
    const session = mobileWeekTouchSessionRef.current;
    clearMobileWeekLongPressTimer();
    if (!session) return;
    if (session.activated) {
      event?.preventDefault();
      void commitMobileWeekTouchDrag();
      return;
    }
    mobileWeekTouchSessionRef.current = null;
  }

  function cancelMobileWeekTouchDrag(event?: React.TouchEvent<HTMLButtonElement>) {
    const active = Boolean(mobileWeekTouchSessionRef.current?.activated);
    if (active) {
      event?.preventDefault();
      cancelMobileWeekTouchSession(true);
      return;
    }
    event?.stopPropagation();
    cancelMobileWeekTouchSession(false);
  }

  function finishWeekEventDrag() {
    suppressWeekEventClickUntilRef.current = Date.now() + 300;
    setWeekDrag(null);
  }

  function selectWeekEventDay(event: React.MouseEvent<HTMLButtonElement>, day: Date) {
    if (Date.now() < suppressWeekEventClickUntilRef.current) {
      event.preventDefault();
      return;
    }
    selectDay(day);
  }

  function goToToday() {
    setQuickAdd(null);
    setMobileDayPanelOpen(false);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    setSelectedDate(today);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  function changePeriod(amount: number) {
    setQuickAdd(null);
    setMobileDayPanelOpen(false);
    if (displayMode === 'MONTH') {
      changeMonth(amount);
      return;
    }
    setSelectedDate((current) => addCalendarDays(current, amount * 7));
  }

  function selectDay(day: Date) {
    setQuickAdd(null);
    setSelectedDate(day);
    if (displayMode === 'MONTH') setMobileDayPanelOpen(false);
    if (!sameMonth(day, visibleMonth)) setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  }

  function addAtHour(day: Date, hour: number) {
    setSelectedDate(day);
    if (shouldUseMobileEventSheet()) {
      setQuickAdd(null);
      const initial = dateAtHour(day, hour);
      onAdd(initial, undefined, new Date(initial.getTime() + 60 * 60 * 1000));
      return;
    }
    setQuickAdd(buildQuickAddState(day, 'WEEK', hour));
  }

  function openMonthQuickAdd(day: Date) {
    setSelectedDate(day);
    if (shouldUseMobileEventSheet()) {
      setQuickAdd(null);
      setMobileDayPanelOpen(false);
      return;
    }
    setMobileDayPanelOpen(false);
    const dateKey = toLocalDateKey(day);
    setQuickAdd((current) => current?.source === 'MONTH' && current.dateKey === dateKey ? null : buildQuickAddState(day, 'MONTH'));
  }

  function quickAddInitialDate(): Date | undefined {
    if (!quickAdd) return undefined;
    const [year = '0', month = '1', day = '1'] = quickAdd.dateKey.split('-');
    const [hour = '0', minute = '0'] = quickAdd.startTime.split(':');
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  }

  async function submitQuickAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quickAdd || quickAdd.saving) return;
    const title = quickAdd.title.trim();
    if (!title) {
      setQuickAdd({ ...quickAdd, error: 'Wpisz nazwę wydarzenia.' });
      return;
    }
    const startTime = quickAdd.startTime;
    const endTime = quickAdd.endTime;
    if (!startTime || !endTime || endTime <= startTime) {
      setQuickAdd({ ...quickAdd, error: 'Godzina zakończenia musi być późniejsza od rozpoczęcia.' });
      return;
    }
    const draft: EventDraft = {
      title,
      startDateTime: combineDateAndTime(quickAdd.dateKey, startTime),
      endDateTime: combineDateAndTime(quickAdd.dateKey, endTime),
      allDay: false,
      spanType: 'SINGLE_DAY',
      category: 'PERSONAL',
      availabilityImpact: 'BLOCKING',
    };
    setQuickAdd({ ...quickAdd, saving: true, error: '' });
    try {
      await onQuickAdd(draft);
      setQuickAdd(null);
    } catch (error) {
      setQuickAdd((current) => current ? { ...current, saving: false, error: error instanceof Error ? error.message : 'Nie udało się dodać wydarzenia.' } : current);
    }
  }

  function openQuickAddDetails() {
    if (!quickAdd) return;
    if (!quickAdd.startTime || !quickAdd.endTime || quickAdd.endTime <= quickAdd.startTime) {
      setQuickAdd({ ...quickAdd, error: 'Godzina zakończenia musi być późniejsza od rozpoczęcia.' });
      return;
    }
    const initial = quickAddInitialDate();
    if (!initial) return;
    const title = quickAdd.title.trim();
    const [year = '0', month = '1', day = '1'] = quickAdd.dateKey.split('-');
    const [endHour = '0', endMinute = '0'] = quickAdd.endTime.split(':');
    const initialEnd = new Date(Number(year), Number(month) - 1, Number(day), Number(endHour), Number(endMinute), 0, 0);
    setQuickAdd(null);
    onAdd(initial, title || undefined, initialEnd);
  }


  function changeMonth(amount: number) {
    setQuickAdd(null);
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1);
    setVisibleMonth(next); if (!selectionMode) setSelectedDate(next);
  }
  function toggleSelection(key: string) { setSelectedDateKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key].sort()); }
  function beginSelection() { setQuickAdd(null); setSelectionMode(true); setSelectedDateKeys([]); }
  function cancelSelection() { setQuickAdd(null); setSelectionMode(false); setSelectedDateKeys([]); }
  function addSelectedDates() { if (!selectedDateKeys.length) return; const values = [...selectedDateKeys]; cancelSelection(); onAddMany(values); }

  function canQuickEdit(event: CalendarEvent): boolean {
    return event.source === 'MANUAL' && !event.allDay && event.spanType === 'SINGLE_DAY';
  }

  function openFullEditor(event: CalendarEvent) {
    setQuickEditEventId(null);
    onEdit(event);
  }

  return (
    <section className="view-shell calendar-view-shell">
      <header className="view-header calendar-view-header">
        <div className="calendar-header-title-row"><h1>Kalendarz</h1></div>
        <div className="calendar-primary-controls calendar-primary-controls-minimal">
          <div className="calendar-view-switch" aria-label="Widok kalendarza">
            <button type="button" className={displayMode === 'MONTH' ? 'active' : ''} onClick={() => setDisplayMode('MONTH')}>Miesiąc</button>
            <button type="button" className={displayMode === 'WEEK' ? 'active' : ''} onClick={() => setDisplayMode('WEEK')}>Tydzień</button>
          </div>
          <div className="calendar-filter-row calendar-filter-desktop" aria-label="Filtr wydarzeń">
            {calendarFilters.map((item) => <button type="button" key={item.id} className={`calendar-filter-chip filter-${item.id.toLowerCase()}${filter === item.id ? ' active' : ''}`} onClick={() => setFilter(item.id)}>{item.label}</button>)}
          </div>
          <div className="calendar-mobile-filter-actions">
            <label className="calendar-filter-select">
              <span className="visually-hidden">Filtr wydarzeń</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value as CalendarFilter)} aria-label="Filtr wydarzeń">
                {calendarFilters.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            {displayMode === 'MONTH' ? <button type="button" className="button button-primary button-small calendar-mobile-explicit-add" onClick={() => onAdd(selectedDate)}>+ Dodaj</button> : null}
          </div>
        </div>
      </header>

      <div className="calendar-layout">
        <div className="panel calendar-panel">
          <div className="calendar-toolbar calendar-toolbar-modern">
            <button type="button" className="icon-button soft" onClick={() => changePeriod(-1)} aria-label={displayMode === 'MONTH' ? 'Poprzedni miesiąc' : 'Poprzedni tydzień'}>‹</button>
            <h2>{periodLabel}</h2>
            <button type="button" className="icon-button soft" onClick={() => changePeriod(1)} aria-label={displayMode === 'MONTH' ? 'Następny miesiąc' : 'Następny tydzień'}>›</button>
            <button type="button" className="button button-secondary button-small calendar-today-button" onClick={goToToday}>Dzisiaj</button>
            {displayMode === 'MONTH' ? <button type="button" className="text-button calendar-multi-day-trigger" onClick={selectionMode ? cancelSelection : beginSelection}>{selectionMode ? 'Zakończ wybór' : 'Wiele dni'}</button> : null}
          </div>
          {displayMode === 'MONTH' && selectionMode ? <div className="multi-day-selection-bar" role="status" aria-live="polite"><div><strong>{selectedDateKeys.length} {selectedDateKeys.length === 1 ? 'dzień zaznaczony' : 'dni zaznaczone'}</strong><span>Klikaj kolejne daty. Mogą być niekolejne.</span></div><div className="multi-day-selection-actions"><button type="button" className="button button-secondary button-small" onClick={() => setSelectedDateKeys([])}>Wyczyść</button><button type="button" className="button button-primary button-small" disabled={!selectedDateKeys.length} onClick={addSelectedDates}>Dodaj wydarzenie</button></div></div> : null}

          {displayMode === 'MONTH' ? (
            <>
            <div className="calendar-period-swipe-surface" onTouchStart={handlePeriodSwipeStart} onTouchEnd={handlePeriodSwipeEnd} onTouchCancel={handlePeriodSwipeCancel} onClickCapture={handlePeriodSwipeClickCapture}>
              <div className="calendar-weekdays">{weekdayLabels.map((day) => <span key={day}>{day}</span>)}</div>
              <div className={selectionMode ? 'calendar-grid selection-mode' : 'calendar-grid'}>
                {days.map((day) => {
                  const key = toLocalDateKey(day);
                  const overlayMarkers = calendarOverlayMarkersForDate(key, { showPolishHolidays, showWumAcademicCalendar });
                  const counts = countsByDate.get(key) ?? { STUDY: 0, WORK: 0, PERSONAL: 0, OTHER: 0 };
                  const dayEvents = eventsByDate.get(key) ?? [];
                  const total = counts.STUDY + counts.WORK + counts.PERSONAL + counts.OTHER;
                  const issueCount = issuesByDate.get(key)?.length ?? 0;
                  const incompleteStudyCount = (filter === 'ALL' || filter === 'STUDY') ? (incompleteStudyByDate.get(key)?.length ?? 0) : 0;
                  const selected = key === selectedKey;
                  const multiSelected = selectedDateKeys.includes(key);
                  const isToday = key === todayKey;
                  const ariaEvents = dayEvents.length ? dayEvents.map((event) => `${event.title}, ${calendarEventTimeLabel(event, key, timeFormat)}`).join('; ') : 'brak wydarzeń';
                  const monthQuickAdd = quickAdd?.source === 'MONTH' && quickAdd.dateKey === key ? quickAdd : null;
                  const showMonthQuickAdd = Boolean(monthQuickAdd);
                  const monthQuickAddAlignEnd = day.getDay() === 0 || day.getDay() === 6;
                  return <div key={key} className="calendar-day-shell">
                    <button type="button" className={`calendar-day${sameMonth(day, visibleMonth) ? '' : ' muted'}${day.getDay() === 0 || day.getDay() === 6 ? ' weekend' : ''}${!selectionMode && selected ? ' selected' : ''}${multiSelected ? ' multi-selected' : ''}${isToday ? ' today' : ''}`} onClick={() => selectionMode ? toggleSelection(key) : selectDay(day)} aria-pressed={selectionMode ? multiSelected : undefined} aria-label={`${day.toLocaleDateString('pl-PL')}, ${ariaEvents}${overlayMarkers.length ? `, ${overlayMarkers.map((marker) => marker.label).join(', ')}` : ''}${incompleteStudyCount ? `, niepełne dane planu studiów: ${incompleteStudyCount}` : ''}${issueCount ? `, niespójności: ${issueCount}` : ''}`}>
                      <span className="day-number">{day.getDate()}</span>
                      {overlayMarkers.length ? <span className="calendar-overlay-dots" role="img" aria-label={overlayMarkers.map((marker) => marker.label).join(', ')} title={overlayMarkers.map((marker) => marker.label).join(' · ')}>{overlayMarkers.map((marker) => <i key={marker.kind} className={`overlay-${marker.kind.toLowerCase()}`} aria-hidden="true" />)}</span> : null}
                      {total > 0 ? <span className="category-count-row calendar-day-counts" title={dayEvents.map((event) => `${calendarEventTimeLabel(event, key, timeFormat)} ${event.title}`).join('\n')}>{(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).filter((category) => counts[category] > 0).map((category) => <span key={category} className={`category-count category-${category.toLowerCase()}`} aria-label={`${counts[category]} wydarzenia: ${categoryLabels[category]}`}>{counts[category]}</span>)}</span> : <span className="event-placeholder" />}
                      {incompleteStudyCount ? <span className="study-incomplete-marker" title="Niepełne dane z planu studiów - to nie jest potwierdzone wydarzenie" aria-label={`${incompleteStudyCount} niepełnych wpisów planu studiów`}>? {incompleteStudyCount}</span> : null}
                      {issueCount ? <span className="calendar-conflict-badge" aria-label={`${issueCount} niespójności kalendarza`}>! {issueCount}</span> : null}
                      {multiSelected ? <span className="multi-select-check" aria-hidden="true">✓</span> : null}
                    </button>
                    {!selectionMode && selected && desktopWeekDragEnabled ? <button type="button" className="calendar-day-quick-add-trigger" onClick={() => openMonthQuickAdd(day)} aria-label={`Szybko dodaj wydarzenie ${day.toLocaleDateString('pl-PL')}`}>{showMonthQuickAdd ? '×' : '+'}</button> : null}
                    {!selectionMode && monthQuickAdd ? (
                      <form className={`calendar-week-quick-add calendar-month-quick-add${monthQuickAddAlignEnd ? ' align-end' : ''}`} onSubmit={(event) => void submitQuickAdd(event)} onKeyDown={(event) => { if (event.key === 'Escape') setQuickAdd(null); }}>
                        <div className="calendar-week-quick-add-head">
                          <div className="calendar-week-quick-add-times">
                            <label><span>Od</span><input type="time" value={monthQuickAdd.startTime} step={300} onChange={(event) => setQuickAdd((current) => current ? { ...current, startTime: event.target.value, error: '' } : current)} aria-label="Godzina rozpoczęcia" /></label>
                            <label><span>Do</span><input type="time" value={monthQuickAdd.endTime} step={300} onChange={(event) => setQuickAdd((current) => current ? { ...current, endTime: event.target.value, error: '' } : current)} aria-label="Godzina zakończenia" /></label>
                          </div>
                          <button type="button" onClick={() => setQuickAdd(null)} aria-label="Zamknij szybkie dodawanie">×</button>
                        </div>
                        <input value={monthQuickAdd.title} onChange={(event) => setQuickAdd((current) => current ? { ...current, title: event.target.value, error: '' } : current)} placeholder="Co planujesz?" autoFocus aria-label="Nazwa wydarzenia" />
                        {monthQuickAdd.error ? <small role="alert">{monthQuickAdd.error}</small> : null}
                        <div className="calendar-week-quick-add-actions"><button type="button" className="text-button" onClick={openQuickAddDetails}>Więcej opcji</button><button type="submit" className="button button-primary button-small" disabled={monthQuickAdd.saving}>{monthQuickAdd.saving ? 'Dodawanie...' : 'Dodaj'}</button></div>
                      </form>
                    ) : null}
                  </div>;
                })}
              </div>
            </div>
              {!selectionMode && (selectedEvents.length || selectedIncompleteStudyEntries.length || selectedDayOverlayMarkers.length) ? (
                <section className="calendar-mobile-day-preview" aria-label={`Podgląd dnia ${selectedDate.toLocaleDateString('pl-PL')}`}>
                  <div className="calendar-mobile-day-preview-head">
                    <div>
                      <strong>{selectedDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}</strong>
                      <span>{selectedEvents.length ? `${selectedEvents.length} ${selectedEvents.length === 1 ? 'wydarzenie' : selectedEvents.length >= 2 && selectedEvents.length <= 4 ? 'wydarzenia' : 'wydarzeń'}` : selectedIncompleteStudyEntries.length ? 'Niepełne dane planu' : 'Informacja o dniu'}</span>
                    </div>
                    {selectedEvents.length > 3 || selectedIncompleteStudyEntries.length ? <button type="button" className="text-button" onClick={() => setMobileDayPanelOpen(true)}>Pokaż szczegóły</button> : null}
                  </div>
                  {selectedDayOverlayMarkers.length ? <div className="calendar-mobile-day-preview-overlays" aria-label="Informacje o wybranym dniu">{selectedDayOverlayMarkers.map((marker) => <span key={marker.kind} className={`overlay-${marker.kind.toLowerCase()}`}>{marker.label}</span>)}</div> : null}
                  {selectedEvents.length ? <div className="calendar-mobile-day-preview-list">{selectedEvents.slice(0, 3).map((event) => <button key={event.id} type="button" className={`calendar-mobile-day-preview-event category-${event.category.toLowerCase()}`} onClick={() => setMobileDayPanelOpen(true)} aria-label={`Otwórz szczegóły wydarzenia ${event.title}`}><span>{calendarEventTimeLabel(event, selectedKey, timeFormat)}</span><strong>{event.title}</strong><i aria-hidden="true">›</i></button>)}</div> : null}
                  {selectedIncompleteStudyEntries.length ? <button type="button" className="calendar-mobile-day-preview-incomplete" onClick={() => setMobileDayPanelOpen(true)}><span>?</span><strong>Niepełne dane z planu studiów</strong><i aria-hidden="true">›</i></button> : null}
                </section>
              ) : null}
            </>
          ) : (
            <div className={`calendar-week-shell calendar-period-swipe-surface${weekHourHeight < 40 ? ' compact-density' : ''}`} onTouchStart={handlePeriodSwipeStart} onTouchEnd={handlePeriodSwipeEnd} onTouchCancel={handlePeriodSwipeCancel} onClickCapture={handlePeriodSwipeClickCapture}>
              <div className="calendar-week-day-headings">
                <span className="calendar-week-axis-spacer" />
                {weekDays.map((day) => {
                  const key = toLocalDateKey(day);
                  const isToday = key === todayKey;
                  const overlayMarkers = calendarOverlayMarkersForDate(key, { showPolishHolidays, showWumAcademicCalendar });
                  return <button type="button" key={key} className={`calendar-week-day-heading${day.getDay() === 0 || day.getDay() === 6 ? ' weekend' : ''}${key === selectedKey ? ' selected' : ''}${isToday ? ' today' : ''}`} onClick={() => selectDay(day)}><span>{weekdayLabels[(day.getDay() + 6) % 7]}</span><strong>{day.getDate()}</strong>{overlayMarkers.length ? <i className="calendar-week-overlay-dot" title={overlayMarkers.map((marker) => marker.label).join(' · ')} aria-label={overlayMarkers.map((marker) => marker.label).join(', ')} /> : null}</button>;
                })}
              </div>
              {weekDays.some((day) => (weekEventsByDate.get(toLocalDateKey(day)) ?? []).some((event) => event.allDay)) ? (
                <div className="calendar-week-all-day-strip" aria-label="Wydarzenia całodniowe">
                  <span className="calendar-week-all-day-label">Cały dzień</span>
                  {weekDays.map((day) => {
                    const key = toLocalDateKey(day);
                    const dayAllDayEvents = (weekEventsByDate.get(key) ?? []).filter((event) => event.allDay);
                    const hiddenCount = Math.max(0, dayAllDayEvents.length - 2);
                    return <div key={key} className={`calendar-week-all-day-cell${day.getDay() === 0 || day.getDay() === 6 ? ' weekend' : ''}${key === selectedKey ? ' selected' : ''}`}>
                      {dayAllDayEvents.slice(0, 2).map((event) => <button key={event.id} type="button" className={`calendar-week-all-day-event category-${event.category.toLowerCase()}${conflictEventIds.has(event.id) ? ' conflict' : ''}`} onClick={() => selectDay(day)} title={`${event.title} - cały dzień`}><span>{event.title}</span>{conflictEventIds.has(event.id) ? <i aria-label="Konflikt">!</i> : null}</button>)}
                      {hiddenCount ? <button type="button" className="calendar-week-all-day-more" onClick={() => selectDay(day)} aria-label={`Pokaż wszystkie wydarzenia całodniowe: ${dayAllDayEvents.length}`}>+{hiddenCount}</button> : null}
                    </div>;
                  })}
                </div>
              ) : null}
              <div ref={weekScrollRef} className="calendar-week-scroll" onScroll={handleMobileWeekScroll} style={weekHourHeight < WEEK_HOUR_HEIGHT ? { height: weekTimelineHeight } : undefined}>
                <div className="calendar-week-time-axis" style={weekHourHeight < WEEK_HOUR_HEIGHT ? { height: weekTimelineHeight } : undefined}>
                  {Array.from({ length: WEEK_END_HOUR - WEEK_START_HOUR }, (_, index) => <span key={index} data-hour={WEEK_START_HOUR + index} style={{ top: index * weekHourHeight }}>{String(WEEK_START_HOUR + index).padStart(2, '0')}:00</span>)}
                </div>
                <div className="calendar-week-columns" style={weekHourHeight < WEEK_HOUR_HEIGHT ? { height: weekTimelineHeight } : undefined}>
                  {weekDays.map((day) => {
                    const key = toLocalDateKey(day);
                    const dayEvents = weekEventsByDate.get(key) ?? [];
                    const timedEvents = dayEvents.filter((event) => !event.allDay);
                    const timedLayouts = buildWeekTimedEventLayout(timedEvents, key, WEEK_START_HOUR, WEEK_END_HOUR, weekHourHeight);
                    const isToday = key === todayKey;
                    const weekQuickAdd = quickAdd?.source === 'WEEK' && quickAdd.dateKey === key ? quickAdd : null;
                    const currentMinute = currentTime.getHours() * 60 + currentTime.getMinutes();
                    const nowLineTop = ((currentMinute - WEEK_START_HOUR * 60) / 60) * weekHourHeight;
                    const showNowLine = isToday && currentMinute >= WEEK_START_HOUR * 60 && currentMinute <= WEEK_END_HOUR * 60;
                    const isDragPreviewColumn = weekDrag ? (weekDrag.inputMode === 'touch' ? key === selectedKey : weekDrag.previewDateKey === key) : false;
                    return <div key={key} className={`calendar-week-column${day.getDay() === 0 || day.getDay() === 6 ? ' weekend' : ''}${key === selectedKey ? ' selected' : ''}${isToday ? ' today' : ''}${isDragPreviewColumn ? ' drag-target' : ''}`} style={weekHourHeight < WEEK_HOUR_HEIGHT ? { height: weekTimelineHeight, backgroundImage: 'linear-gradient(to bottom, transparent calc(100% - 1px), rgba(75,68,72,.07) calc(100% - 1px))', backgroundSize: `100% ${weekHourHeight}px` } : undefined} onDragOver={(event) => updateWeekDragPreview(event, key)} onDrop={(event) => { void dropWeekEvent(event, key); }}>
                      {Array.from({ length: WEEK_END_HOUR - WEEK_START_HOUR }, (_, index) => {
                        const hour = WEEK_START_HOUR + index;
                        return <button type="button" key={hour} className="calendar-week-slot" style={{ top: index * weekHourHeight, height: weekHourHeight }} onClick={() => addAtHour(day, hour)} aria-label={`Dodaj wydarzenie ${day.toLocaleDateString('pl-PL')} o ${String(hour).padStart(2, '0')}:00`} />;
                      })}
                      {weekQuickAdd ? (
                        <form className={`calendar-week-quick-add${day.getDay() === 0 || day.getDay() === 6 ? ' align-end' : ''}`} style={{ top: Math.min((weekQuickAdd.hour - WEEK_START_HOUR) * weekHourHeight + 4, weekTimelineHeight - 180) }} onSubmit={(event) => void submitQuickAdd(event)} onKeyDown={(event) => { if (event.key === 'Escape') setQuickAdd(null); }}>
                          <div className="calendar-week-quick-add-head">
                            <div className="calendar-week-quick-add-times">
                              <label><span>Od</span><input type="time" value={weekQuickAdd.startTime} step={300} onChange={(event) => setQuickAdd((current) => current ? { ...current, startTime: event.target.value, error: '' } : current)} aria-label="Godzina rozpoczęcia" /></label>
                              <label><span>Do</span><input type="time" value={weekQuickAdd.endTime} step={300} onChange={(event) => setQuickAdd((current) => current ? { ...current, endTime: event.target.value, error: '' } : current)} aria-label="Godzina zakończenia" /></label>
                            </div>
                            <button type="button" onClick={() => setQuickAdd(null)} aria-label="Zamknij szybkie dodawanie">×</button>
                          </div>
                          <input value={weekQuickAdd.title} onChange={(event) => setQuickAdd((current) => current ? { ...current, title: event.target.value, error: '' } : current)} placeholder="Co planujesz?" autoFocus aria-label="Nazwa wydarzenia" />
                          {weekQuickAdd.error ? <small role="alert">{weekQuickAdd.error}</small> : null}
                          <div className="calendar-week-quick-add-actions"><button type="button" className="text-button" onClick={openQuickAddDetails}>Więcej opcji</button><button type="submit" className="button button-primary button-small" disabled={weekQuickAdd.saving}>{weekQuickAdd.saving ? 'Dodawanie...' : 'Dodaj'}</button></div>
                        </form>
                      ) : null}
                      {weekDrag && isDragPreviewColumn ? <span className="calendar-week-drag-preview" style={{ top: ((weekDrag.previewStartMinutes - WEEK_START_HOUR * 60) / 60) * weekHourHeight, height: Math.max(26, (weekDrag.durationMinutes / 60) * weekHourHeight) }} aria-hidden="true" /> : null}
                      {showNowLine ? <span className="calendar-week-now-line" style={{ top: nowLineTop }} aria-label={`Aktualna godzina ${currentTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`}><i aria-hidden="true" /></span> : null}
                      {timedEvents.map((event) => {
                        const position = timedLayouts.get(event.id);
                        if (!position) return null;
                        const studyGroupLabel = event.source === 'UNIVERSITY_XLSX' ? studyEventDisplay(event).groupLabel : undefined;
                        const conflict = conflictEventIds.has(event.id);
                        const title = `${calendarEventTimeLabel(event, key, timeFormat)} ${event.title}${studyGroupLabel ? ` - ${studyGroupLabel}` : ''}${position.overlapping ? ' - nakłada się czasowo z innym wydarzeniem' : ''}${conflict ? ' - konflikt kalendarza' : ''}`;
                        const draggable = desktopWeekDragEnabled && canDragWeekEvent(event);
                        const desktopResizable = desktopWeekDragEnabled && canResizeWeekEvent(event);
                        const touchResizable = !desktopWeekDragEnabled && canResizeWeekEvent(event);
                        const resizable = desktopResizable || touchResizable;
                        const touchDraggable = !desktopWeekDragEnabled && canDragWeekEvent(event);
                        const resizeState = weekResize?.eventId === event.id ? weekResize : null;
                        const resizeHeight = resizeState ? Math.max(26, ((resizeState.previewEndMinutes - resizeState.startMinutes) / 60) * weekHourHeight) : position.height;
                        const timeLabel = resizeState ? `${formatMinuteTime(resizeState.startMinutes)}-${formatMinuteTime(resizeState.previewEndMinutes)}` : calendarEventTimeLabel(event, key, timeFormat);
                        return <button key={event.id} type="button" draggable={draggable && !resizeState} className={`calendar-week-event category-${event.category.toLowerCase()}${position.overlapping ? ' overlapping' : ''}${conflict ? ' conflict' : ''}${draggable ? ' draggable' : ''}${resizable ? ' resizable' : ''}${touchDraggable ? ' touch-draggable' : ''}${weekDrag?.eventId === event.id ? ' dragging' : ''}${resizeState ? ' resizing' : ''}`} style={{ top: position.top, height: resizeHeight, left: `calc(${position.leftPercent}% + 3px)`, width: `calc(${position.widthPercent}% - 6px)`, right: 'auto' }} onDragStart={(dragEvent) => startWeekEventDrag(dragEvent, event)} onDragEnd={finishWeekEventDrag} onTouchStart={(touchEvent) => startMobileWeekLongPress(touchEvent, event, day)} onTouchMove={moveMobileWeekTouchDrag} onTouchEnd={finishMobileWeekTouchDrag} onTouchCancel={cancelMobileWeekTouchDrag} onClick={(clickEvent) => selectWeekEventDay(clickEvent, day)} title={`${title}${draggable ? ' - przeciągnij, aby zmienić termin' : touchDraggable ? ' - przytrzymaj, aby przenieść' : ''}${desktopResizable ? ' - przeciągnij dolną krawędź, aby zmienić czas trwania' : touchResizable ? ' - przeciągnij uchwyt w dół lub w górę, aby zmienić czas trwania' : ''}`}><span data-mobile-time={resizeState ? formatMinuteTime(resizeState.startMinutes) : formatTime(event.startDateTime, timeFormat)}>{timeLabel}</span><strong data-mobile-label={event.title.split(' - ')[0]?.trim() || event.title}>{event.title}</strong>{studyGroupLabel ? <small className="calendar-week-study-group">{studyGroupLabel}</small> : null}{conflict ? <i aria-label="Konflikt">!</i> : null}{resizable ? <span className={`calendar-week-resize-handle${touchResizable ? ' touch-resize-handle' : ''}`} onTouchStart={(touchEvent) => touchEvent.stopPropagation()} onTouchMove={(touchEvent) => touchEvent.stopPropagation()} onTouchEnd={(touchEvent) => touchEvent.stopPropagation()} onPointerDown={(pointerEvent) => startWeekResize(pointerEvent, event)} onPointerMove={updateWeekResize} onPointerUp={(pointerEvent) => { void finishWeekResize(pointerEvent); }} onPointerCancel={cancelWeekResize} onLostPointerCapture={handleWeekResizeLostPointerCapture} aria-hidden="true" /> : null}</button>;
                      })}
                    </div>;
                  })}
                </div>
              </div>
              {weekDrag?.inputMode === 'touch' ? <div className="calendar-mobile-drag-status" aria-hidden="true"><strong>{weekDays.find((day) => toLocalDateKey(day) === weekDrag.previewDateKey)?.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }) ?? weekDrag.previewDateKey}</strong><span>{`${String(Math.floor(weekDrag.previewStartMinutes / 60)).padStart(2, '0')}:${String(weekDrag.previewStartMinutes % 60).padStart(2, '0')}`}</span><small>Puść, aby przenieść</small></div> : null}
              {weekResize?.inputMode === 'touch' ? <div className="calendar-mobile-drag-status calendar-mobile-resize-status" aria-hidden="true"><strong>{`${formatMinuteTime(weekResize.startMinutes)}-${formatMinuteTime(weekResize.previewEndMinutes)}`}</strong><span>{Math.max(15, weekResize.previewEndMinutes - weekResize.startMinutes)} min</span><small>Puść, aby ustawić czas</small></div> : null}
            </div>
          )}
        </div>

        <div className={`calendar-side-column${!selectedEvents.length && !selectedIncompleteStudyEntries.length ? ' is-empty' : ''}${mobileDayPanelOpen ? ' mobile-open' : ''}`}>
          {mobileDayPanelOpen ? <button type="button" className="calendar-mobile-day-backdrop" aria-label="Zamknij szczegóły dnia" onClick={() => setMobileDayPanelOpen(false)} /> : null}
          <aside className={`panel selected-day-panel${mobileDayPanelOpen ? ' mobile-open' : ''}`}>
            <div className="panel-heading compact-heading calendar-selected-day-heading">
              <div className="calendar-selected-day-heading-copy">
                {selectionMode ? <span className="section-kicker">Tryb wyboru</span> : null}
                <h2>{selectionMode ? `${selectedDateKeys.length} zaznaczonych` : selectedDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}</h2>
              </div>
              <div className="calendar-selected-day-heading-actions">
                {!selectionMode && (selectedEvents.length || selectedIncompleteStudyEntries.length) ? <div className="selected-day-quick-actions"><button type="button" className="button button-primary button-small" onClick={() => onAdd(selectedDate)}>Dodaj wydarzenie</button></div> : null}
                <button type="button" className="calendar-mobile-day-close" onClick={() => setMobileDayPanelOpen(false)} aria-label="Zamknij szczegóły dnia">×</button>
              </div>
            </div>
            {!selectionMode && selectedDayOverlayMarkers.length ? <div className="calendar-selected-day-overlays" aria-label="Informacje o dniu">{selectedDayOverlayMarkers.map((marker) => <span key={marker.kind} className={`overlay-${marker.kind.toLowerCase()}`}>{marker.label}</span>)}</div> : null}
            {!selectionMode && selectedDayIssues.length ? <div className="calendar-day-alerts">{selectedDayIssues.slice(0, 2).map((issue) => <div key={issue.id} className="calendar-day-alert"><strong>{issue.title}</strong><span>{issue.description}</span></div>)}</div> : null}
            <div className="calendar-selected-day-content">
              {selectionMode ? <div className="selection-help"><p>Zaznacz dni w siatce po lewej, a potem utwórz jedno wydarzenie wielodniowe albo serię na wybranych datach.</p><button type="button" className="button button-primary" disabled={!selectedDateKeys.length} onClick={addSelectedDates}>Dodaj dla wybranych dni</button></div> : <>{selectedEvents.length ? <div className="event-list compact-event-list">{selectedEvents.map((event) => quickEditEventId === event.id && canQuickEdit(event) ? <QuickEventEditor key={event.id} event={event} locations={locations} onSave={async (draft) => { await onQuickEdit(event, draft); setQuickEditEventId(null); }} onMore={() => openFullEditor(event)} onCancel={() => setQuickEditEventId(null)} /> : <EventCard key={event.id} event={event} location={event.locationId ? locationMap.get(event.locationId) : undefined} timeFormat={timeFormat} seriesCount={event.seriesId ? seriesCountById.get(event.seriesId) : undefined} onEdit={canQuickEdit(event) ? () => setQuickEditEventId(event.id) : onEdit} onDelete={event.source === 'MANUAL' && !event.seriesId ? () => { void onQuickDelete(event); } : undefined} onStudyCorrect={onStudyCorrect} workCoworkers={coworkersByEvent[event.id] ?? []} showAllWorkCoworkers compactTimeRange />)}</div> : null}{selectedIncompleteStudyEntries.length ? <div className="selected-day-study-incomplete"><span className="section-kicker">Niepełne dane z planu studiów</span>{selectedIncompleteStudyEntries.map((entry) => <article key={entry.id} className="study-incomplete-card"><div><strong>{entry.subject || 'Zajęcia studiów'}</strong><span>{entry.date ? 'Godzina nie została podana w planie źródłowym.' : 'Plan przypisuje zajęcia do tego tygodnia, ale nie podaje jednoznacznego dnia i pełnych godzin.'}</span></div><small>{incompleteEntryRangeLabel(entry)}</small></article>)}</div> : null}{!selectedEvents.length && !selectedIncompleteStudyEntries.length ? <EmptyState title="Brak wydarzeń" description="" actionLabel="+ Dodaj" onAction={() => onAdd(selectedDate)} /> : null}</>}
            </div>
          </aside>
        </div>
      </div>

      <ConsistencyCenter issues={consistencyIssues} events={events} onEdit={onEdit} onAcknowledge={onAcknowledgeConsistency} onStudySeriesCorrect={onStudySeriesCorrect} />
    </section>
  );
}
