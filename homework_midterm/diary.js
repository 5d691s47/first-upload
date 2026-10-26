/* Shared diary model: no network, no UI, and no calorie compensation. */
(() => {
  'use strict';
  const KEY = 'bite-stride-diary-v1';
  const LEGACY_KEY = 'quokka-diary-v1';
  const uid = () => globalThis.crypto?.randomUUID?.() || `trace-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const localTime = (date = new Date()) => {
    const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0,16);
  };
  const day = (date = new Date()) => localTime(date).slice(0,10);
  const validTime = value => {
    if(typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return false;
    const d = new Date(value);
    return Number.isFinite(d.getTime()) && localTime(d) === value && Number(value.slice(0,4)) >= 2000;
  };
  function record(value) {
    if(!value || !['meal','move'].includes(value.type)) throw Error('기록 종류를 확인해 주세요.');
    if(typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80) throw Error('이름은 1~80자로 입력해 주세요.');
    if(!Number.isInteger(value.amount) || value.amount < (value.type === 'move' ? 1 : 0) || value.amount > (value.type === 'move' ? 1440 : 10000)) throw Error(value.type === 'move' ? '운동 시간은 1~1440분으로 입력해 주세요.' : '칼로리는 0~10000 사이 정수로 입력해 주세요.');
    if(!validTime(value.at)) throw Error('올바른 날짜와 시각을 입력해 주세요.');
    if(value.note != null && (typeof value.note !== 'string' || value.note.length > 240)) throw Error('메모는 240자 이내로 입력해 주세요.');
    return {id: typeof value.id === 'string' && value.id.length < 120 ? value.id : uid(),type:value.type,name:value.name.trim(),amount:value.amount,at:value.at,icon:typeof value.icon === 'string' && value.icon.length <= 16 ? value.icon : value.type === 'meal' ? '🍚' : '🚶',note:value.note || ''};
  }
  const empty = () => ({version:1,entries:[],drafts:[]});
  function parse(text) {
    const value = JSON.parse(text);
    if(value?.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 20000 || (value.drafts != null && (!Array.isArray(value.drafts) || value.drafts.length > 2000))) throw Error('지원하는 기록 파일이 아니에요.');
    const entries = value.entries.map(record), drafts = (value.drafts || []).map(record);
    if(new Set(entries.map(x=>x.id)).size !== entries.length) throw Error('중복된 기록 ID가 있어요.');
    return {version:1,entries,drafts};
  }
  function load(storage) {
    try {
      const saved = storage.getItem(KEY);
      if(saved !== null) return {doc:parse(saved),migrated:false};
      const old = storage.getItem(LEGACY_KEY);
      if(!old) return {doc:empty(),migrated:false};
      const legacy = JSON.parse(old);
      if(!Array.isArray(legacy.entries)) throw Error('이전 기록을 읽지 못했어요.');
      const convert = (x,draft=false) => {
        const t = x.eatenAt && Number.isFinite(new Date(x.eatenAt).getTime()) ? localTime(new Date(x.eatenAt)) : /^\d{4}-\d\d-\d\d$/.test(x.day || '') ? `${x.day}T12:00` : localTime();
        return record({id:`legacy-${x.id || uid()}`,type:'meal',name:x.name,amount:Number(x.kcal),at:t,icon:x.icon,note:String(x.feeling || (draft ? '이전 식탁에 남겨 둔 메모' : '')).slice(0,240)});
      };
      return {doc:{version:1,entries:legacy.entries.map(x=>convert(x)),drafts:(legacy.pending || []).map(x=>convert(x,true))},migrated:true};
    } catch(error) { return {doc:empty(),migrated:false,error:error.message}; }
  }
  const summary = entries => entries.reduce((s,e) => { if(e.type==='meal'){s.meals++;s.kcal+=e.amount;}else{s.moves++;s.minutes+=e.amount;} return s; },{meals:0,kcal:0,moves:0,minutes:0});
  const forDay = (entries,date) => entries.filter(e=>e.at.slice(0,10)===date).sort((a,b)=>a.at.localeCompare(b.at));
  function merge(a,b) {
    const byId = new Map(a.entries.map(x=>[x.id,x]));
    // Existing records win; importing the same backup twice does not duplicate it.
    for(const item of b.entries) if(!byId.has(item.id)) byId.set(item.id,item);
    const drafts = new Map((a.drafts||[]).map(x=>[x.id,x]));
    for(const item of b.drafts||[]) if(!drafts.has(item.id)) drafts.set(item.id,item);
    return {version:1,entries:[...byId.values()],drafts:[...drafts.values()]};
  }
  function demo() {
    const result = empty();
    for(let offset=2;offset>=0;offset--){
      const d = new Date();d.setDate(d.getDate()-offset);const date=day(d);
      [['meal','아보카도 토스트',380,'08:20','🥑','천천히 시작한 아침.'],['move','점심 산책',25,'12:00','🚶','햇빛을 따라 한 바퀴.'],['meal','따뜻한 비빔밥',620,'13:10','🍚','친구와 함께 먹은 점심.'],['meal','사과와 요거트',210,'16:30','🍎','오후의 작은 쉼표.'],['move','가벼운 러닝',30,'18:15','🏃','내 속도대로 달렸어요.'],['meal','연어 샐러드',450,'19:40','🥗','오늘도 수고한 나에게.']].forEach(([type,name,amount,time,icon,note],i)=>result.entries.push(record({id:`demo-${date}-${i}`,type,name,amount,at:`${date}T${time}`,icon,note})));
    }
    return result;
  }
  globalThis.Diary = {KEY,LEGACY_KEY,uid,localTime,day,validTime,record,empty,parse,load,summary,forDay,merge,demo};
})();
