import { describe, expect, it } from 'vitest';
import { effectiveBounds, normalizeBlockedIntervals } from '../availability/availability-day-rules';
import { freeIntervalsForAvailabilityDay, freeIntervalsForManualAvailabilityDay, optimizeAvailability } from '../availability/optimizer';
import type { AvailabilityBlock, AvailabilityDayInput, AvailabilityOptimizationInput } from '../availability/availability.types';

function day(date:string, weekday:number, start=8*60, end=22*60, extra: Partial<AvailabilityDayInput> = {}): AvailabilityDayInput {
  const blockingIntervals: AvailabilityDayInput['blockingIntervals'] = [];
  if(start>8*60) blockingIntervals.push({startMinute:8*60,endMinute:start,kind:'EVENT'});
  if(end<22*60) blockingIntervals.push({startMinute:end,endMinute:22*60,kind:'EVENT'});
  return {date,weekday,eligible:true,manualEligible:true,tradingSunday:false,allowedStartMinute:8*60,allowedEndMinute:22*60,confirmedWorkMinutes:0,blockingIntervals,flexibleRequiredMinutes:0,lockedBlocks:[],rejectedCandidateKeys:[],...extra};
}
function input(required:number, days:AvailabilityDayInput[], extra:Partial<AvailabilityOptimizationInput>={}): AvailabilityOptimizationInput {
  return {weekStart:'2026-08-17',weekEnd:'2026-08-23',targetWeeklyWorkMinutes:required,confirmedWorkMinutes:0,requiredAvailabilityMinutes:required,stepMinutes:15,days,...extra};
}

describe('availability day rules hotfix',()=>{
  it('applies per-day from/to inside global bounds',()=>{
    expect(effectiveBounds(8*60,22*60,{date:'2026-08-17',excluded:false,earliestTime:'14:00',latestTime:'20:00',blockedIntervals:[],updatedAt:'x'})).toEqual({start:14*60,end:20*60});
  });
  it('merges touching manual blocked intervals',()=>{
    expect(normalizeBlockedIntervals([{startTime:'17:00',endTime:'18:00'},{startTime:'18:00',endTime:'19:00'}]).map(x=>[x.startTime,x.endTime])).toEqual([['17:00','19:00']]);
  });
  it('keeps manual Saturday possible while automatic Saturday is disabled',()=>{
    const saturday=day('2026-08-22',6,12*60,18*60,{eligible:false,manualEligible:true});
    expect(freeIntervalsForAvailabilityDay(saturday)).toHaveLength(0);
    expect(freeIntervalsForManualAvailabilityDay(saturday).map(x=>[x.start,x.end])).toEqual([[12*60,18*60]]);
  });
  it('fills only remaining time after locked manual availability',()=>{
    const locked: AvailabilityBlock = {id:'manual',date:'2026-08-17',startTime:'08:00',endTime:'18:00',minutes:600,status:'ACCEPTED',locked:true,userEdited:true,origin:'MANUAL',validationState:'VALID',candidateKey:'2026-08-17|08:00|18:00',explanationFacts:[]};
    const result=optimizeAvailability(input(960,[day('2026-08-17',1,8*60,18*60,{lockedBlocks:[locked]}),day('2026-08-18',2,12*60,18*60)]));
    expect(result.coverageMinutes).toBe(960);
    expect(result.blocks.reduce((sum,block)=>sum+block.minutes,0)).toBe(360);
  });
  it('can choose a natural 4h subwindow from a large free interval',()=>{
    const result=optimizeAvailability(input(240,[day('2026-08-18',2,12*60,20*60)]));
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.minutes).toBe(240);
    expect(result.blocks[0]?.startTime.endsWith(':00') || result.blocks[0]?.startTime.endsWith(':30')).toBe(true);
  });
});
