import { describe, expect, it } from 'vitest';
import { optimizeAvailability } from '../availability/optimizer';
import type { AvailabilityDayInput, AvailabilityOptimizationInput } from '../availability/availability.types';

function day(date:string, weekday:number, start:number, end:number, eligible=true): AvailabilityDayInput {
  const blocks=[] as AvailabilityDayInput['blockingIntervals'];
  if(start>480) blocks.push({startMinute:480,endMinute:start,kind:'EVENT'});
  if(end<1320) blocks.push({startMinute:end,endMinute:1320,kind:'EVENT'});
  return {date,weekday,eligible,manualEligible:eligible,tradingSunday:weekday===0,allowedStartMinute:480,allowedEndMinute:1320,confirmedWorkMinutes:0,blockingIntervals:blocks,flexibleRequiredMinutes:0,lockedBlocks:[],rejectedCandidateKeys:[]};
}
function input(required:number, days:AvailabilityDayInput[], extra:Partial<AvailabilityOptimizationInput>={}): AvailabilityOptimizationInput {
  return {weekStart:'2026-08-17',weekEnd:'2026-08-23',targetWeeklyWorkMinutes:required,confirmedWorkMinutes:0,requiredAvailabilityMinutes:required,stepMinutes:15,days,...extra};
}

describe('availability optimizer 0.3.2',()=>{
  it('uses three 2h windows when no minimum is configured',()=>{
    const days=[day('2026-08-17',1,960,1080),day('2026-08-19',3,1020,1140),day('2026-08-21',5,1080,1200)];
    const result=optimizeAvailability(input(360,days));
    expect(result.coverageMinutes).toBe(360);
    expect(result.blocks.map((block)=>block.minutes)).toEqual([120,120,120]);
  });
  it('respects configured minimum shift',()=>{
    const days=[day('2026-08-17',1,960,1080),day('2026-08-19',3,1020,1140),day('2026-08-21',5,1080,1200)];
    expect(optimizeAvailability(input(360,days,{minimumShiftMinutes:180})).coverageMinutes).toBe(0);
  });
  it('keeps flexible required capacity',()=>{
    const d=day('2026-08-17',1,600,840); d.allowedStartMinute=600; d.allowedEndMinute=840; d.flexibleRequiredMinutes=120;
    expect(optimizeAvailability(input(240,[d])).coverageMinutes).toBe(120);
  });
  it('is deterministic',()=>{
    const days=[day('2026-08-17',1,960,1080),day('2026-08-19',3,1020,1140),day('2026-08-21',5,1080,1200)];
    const signature=JSON.stringify(optimizeAvailability(input(360,days)).blocks.map((block)=>[block.date,block.startTime,block.endTime]));
    for(let i=0;i<10;i+=1) expect(JSON.stringify(optimizeAvailability(input(360,days)).blocks.map((block)=>[block.date,block.startTime,block.endTime]))).toBe(signature);
  });
});
