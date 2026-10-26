import {test} from 'node:test';
import assert from 'node:assert/strict';
await import('./diary.js');
const D=globalThis.Diary;
const food=()=>D.record({id:'meal-1',type:'meal',name:'비빔밥',amount:620,at:'2026-10-26T12:30',icon:'🍚',note:'친구와 점심'});
const movement=()=>D.record({id:'move-1',type:'move',name:'산책',amount:30,at:'2026-10-26T18:00',icon:'🚶',note:''});
test('exercise is added independently and never subtracts a meal or its energy',()=>{
 const entries=[food(),movement()];assert.deepEqual(D.summary(entries),{meals:1,kcal:620,moves:1,minutes:30});
 assert.equal(D.parse(JSON.stringify({version:1,entries})).entries[0].name,'비빔밥');
});
test('legacy eaten meals migrate and uneaten tray notes remain drafts; original storage is untouched',()=>{
 const legacy=JSON.stringify({entries:[{id:'old',name:'밥',kcal:300,day:'2026-10-25',icon:'🍚',feeling:'따뜻해'}],pending:[{id:'draft',name:'사과',kcal:80,icon:'🍎'}]});
 const seen=[];const result=D.load({getItem:key=>{seen.push(key);return key===D.LEGACY_KEY?legacy:null;}});
 assert.equal(result.migrated,true);assert.equal(result.doc.entries.length,1);assert.equal(result.doc.drafts.length,1);assert.equal(result.doc.entries[0].note,'따뜻해');assert.equal(result.doc.entries[0].at,'2026-10-25T12:00');
});
test('invalid backups are rejected, including impossible date, negative amount and duplicated ids',()=>{
 assert.throws(()=>D.record({...movement(),amount:-3}));assert.throws(()=>D.record({...food(),at:'2026-02-30T12:00'}));assert.throws(()=>D.parse(JSON.stringify({version:1,entries:[food(),food()]})));assert.throws(()=>D.parse('{"entries":[]}'));
});
test('import is additive and idempotent, and never overwrites an existing edit',()=>{
 const a={version:1,entries:[food()],drafts:[]},b={version:1,entries:[{...food(),name:'다른 이름'},movement()],drafts:[]};
 const merged=D.merge(a,b);assert.equal(merged.entries.length,2);assert.equal(merged.entries[0].name,'비빔밥');assert.equal(D.merge(merged,b).entries.length,2);
});
test('broken storage is reported without erasing it; local dates filter independently',()=>{
 const result=D.load({getItem:()=>'{broken'});assert.ok(result.error);assert.equal(result.doc.entries.length,0);assert.equal(D.forDay([food(),movement()],'2026-10-26').length,2);assert.equal(D.forDay([food()],'2026-10-25').length,0);
});
