import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDayPlanningContext, buildWeekPlanningContext, createEvent, deleteDatabaseForTests, getDayPlanningProfile, initializeDatabase, listDayAttributes, listDailyRoutineRules, saveDailyRoutineRule, saveDayPlanningProfile, setTradingSunday } from '../storage/database';

beforeEach(async () => { await deleteDatabaseForTests(); });
afterEach(async () => { await deleteDatabaseForTests(); });

describe('schema 7 planning',()=>{
 it('stores target in minutes without requiring a minimum shift',async()=>{await initializeDatabase(); await saveDayPlanningProfile({targetWeeklyWorkMinutes:1440,allowSaturday:true,allowTradingSunday:false}); const p=await getDayPlanningProfile(); expect(p?.targetWeeklyWorkMinutes).toBe(1440); expect(p?.minimumShiftMinutes).toBeUndefined();});
 it('stores fixed and flexible routines',async()=>{await initializeDatabase(); await saveDailyRoutineRule({name:'Sen',type:'FIXED',daysOfWeek:[],durationMinutes:480,fixedStart:'23:00',fixedEnd:'07:00',priority:'REQUIRED',active:true}); await saveDailyRoutineRule({name:'Nauka',type:'FLEXIBLE',daysOfWeek:[1,2,3,4,5],durationMinutes:120,priority:'REQUIRED',active:true}); expect((await listDailyRoutineRules()).length).toBe(2);});
 it('marks a trading Sunday locally',async()=>{await initializeDatabase(); await setTradingSunday('2026-08-30',true); expect((await listDayAttributes()).some((a)=>a.date==='2026-08-30'&&a.active)).toBe(true);});
 it('builds day/week contexts and remaining work',async()=>{await initializeDatabase(); await saveDayPlanningProfile({targetWeeklyWorkMinutes:1440,allowSaturday:true,allowTradingSunday:true}); await createEvent({title:'Praca',startDateTime:'2026-08-10T10:00',endDateTime:'2026-08-10T20:00',category:'WORK'}); const day=await buildDayPlanningContext('2026-08-10'); expect(day.events.length).toBe(1); const week=await buildWeekPlanningContext('2026-08-10'); expect(week.confirmedWorkMinutes).toBe(600); expect(week.remainingWorkMinutes).toBe(840);});
});
