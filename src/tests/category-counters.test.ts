import { describe, expect, it } from 'vitest';
import { categoryCountsByDate } from '../calendar/category-counters';
import type { CalendarEvent } from '../events/event.types';
function e(id:string, category:CalendarEvent['category'], start:string, end:string):CalendarEvent { return {id,title:id,startDateTime:start,endDateTime:end,allDay:false,spanType:start.slice(0,10)===end.slice(0,10)?'SINGLE_DAY':'MULTI_DAY',category,source:'MANUAL',createdAt:'x',updatedAt:'x'}; }
describe('category counters',()=>{
 it('counts categories independently',()=>{const map=categoryCountsByDate([e('s1','STUDY','2026-08-12T10:00','2026-08-12T11:00'),e('s2','STUDY','2026-08-12T12:00','2026-08-12T13:00'),e('w','WORK','2026-08-12T14:00','2026-08-12T16:00'),e('p','PERSONAL','2026-08-12T18:00','2026-08-12T19:00')]);expect(map.get('2026-08-12')).toEqual({STUDY:2,WORK:1,PERSONAL:1,OTHER:0});});
 it('counts one multi-day event once per date',()=>{const map=categoryCountsByDate([e('trip','PERSONAL','2026-08-10T09:00','2026-08-14T18:00')]); for (const d of ['2026-08-10','2026-08-11','2026-08-12','2026-08-13','2026-08-14']) expect(map.get(d)?.PERSONAL).toBe(1);});
});
