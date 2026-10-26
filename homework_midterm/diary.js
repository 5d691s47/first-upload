/* Local diary model: original meals and exercise expenditure are preserved separately. */
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
    if(value.detached != null && typeof value.detached !== 'boolean') throw Error('계단 보관 상태를 확인해 주세요.');
    const result={id: typeof value.id === 'string' && value.id.length < 120 ? value.id : uid(),type:value.type,name:value.name.trim(),amount:value.amount,at:value.at,icon:typeof value.icon === 'string' && value.icon.length <= 16 ? value.icon : value.type === 'meal' ? '🍚' : '🚶',note:value.note || '',detached:value.detached === true};
    if(value.type==='move'){
      const burned=value.burnedKcal ?? 0;
      if(!Number.isInteger(burned)||burned<0||burned>100000)throw Error('소비 칼로리는 0~100000 사이 정수로 입력해 주세요.');
      result.burnedKcal=burned;
    }
    return result;
  }
  function dailyLimit(value) {
    if(value == null) return null;
    if(!Number.isInteger(value) || value < 1 || value > 100000) throw Error('하루 한도는 1~100000 사이 정수로 입력해 주세요.');
    return value;
  }
  function editHistory(value){
    if(value==null)return {};
    if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>20000)throw Error('한도 수정 기록을 읽지 못했어요.');
    const result={};
    for(const [date,item]of Object.entries(value)){
      if(!validTime(date+'T12:00')||!item||!Number.isInteger(item.count)||item.count<0||item.count>3||(typeof item.initialized!=='boolean'||(item.count>0&&!item.initialized)))throw Error('한도 수정 기록이 올바르지 않아요.');
      result[date]={count:item.count,initialized:item.initialized};
    }
    return result;
  }
  const empty = () => ({version:1,entries:[],drafts:[],dailyLimit:null,limitEdits:{}});
  function parse(text) {
    const value = JSON.parse(text);
    if(value?.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 20000 || (value.drafts != null && (!Array.isArray(value.drafts) || value.drafts.length > 2000))) throw Error('지원하는 기록 파일이 아니에요.');
    const entries = value.entries.map(record), drafts = (value.drafts || []).map(record);
    if(new Set(entries.map(x=>x.id)).size !== entries.length) throw Error('중복된 기록 ID가 있어요.');
    return {version:1,entries,drafts,dailyLimit:dailyLimit(value.dailyLimit),limitEdits:editHistory(value.limitEdits)};
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
      return {doc:{version:1,entries:legacy.entries.map(x=>convert(x)),drafts:(legacy.pending || []).map(x=>convert(x,true)),dailyLimit:null,limitEdits:{}},migrated:true};
    } catch(error) { return {doc:empty(),migrated:false,error:error.message}; }
  }
  const summary = entries => entries.reduce((s,e) => { if(e.type==='meal'){s.meals++;s.kcal+=e.amount;}else{s.moves++;s.minutes+=e.amount;} return s; },{meals:0,kcal:0,moves:0,minutes:0});
  const forDay = (entries,date) => entries.filter(e=>e.at.slice(0,10)===date).sort((a,b)=>a.at.localeCompare(b.at));
  function quota(document,date=day()){
    const saved=document.limitEdits?.[date];
    return {count:saved?.count||0,remaining:3-(saved?.count||0),initialized:Boolean(saved?.initialized||document.dailyLimit!=null)};
  }
  function changeLimit(document,value,date=day()){
    const target=dailyLimit(value);if(target==null)throw Error('한도를 입력해 주세요.');
    if(!validTime(date+'T12:00'))throw Error('한도 설정 날짜를 확인해 주세요.');
    if(target===document.dailyLimit)return document;
    const q=quota(document,date);if(q.remaining<=0)throw Error('오늘의 수정 기회 3회를 모두 사용했어요. 내일 다시 수정할 수 있어요.');
    return {...document,dailyLimit:target,limitEdits:{...document.limitEdits,[date]:{count:q.count+(q.initialized?1:0),initialized:true}}};
  }
  function meter(document,date) {
    const entries=forDay(document.entries,date),consumed=summary(entries).kcal,limit=dailyLimit(document.dailyLimit);
    const burned=entries.reduce((sum,e)=>sum+(e.type==='move'?(e.burnedKcal||0):0),0),net=Math.max(0,consumed-burned);
    return {consumed,burned,net,limit,label:net+' / '+(limit ?? '—')};
  }
  function overload(document,date=day()){
    const current=meter(document,date),edits=quota(document,date);
    return {active:current.limit!=null&&edits.remaining===0&&current.net>current.limit,excess:current.limit==null?0:Math.max(0,current.net-current.limit),...current,...edits};
  }
  function merge(a,b) {
    const byId = new Map(a.entries.map(x=>[x.id,x]));
    // Existing records win; importing the same backup twice does not duplicate it.
    for(const item of b.entries) if(!byId.has(item.id)) byId.set(item.id,item);
    const drafts = new Map((a.drafts||[]).map(x=>[x.id,x]));
    for(const item of b.drafts||[]) if(!drafts.has(item.id)) drafts.set(item.id,item);
    const history=editHistory(a.limitEdits),incoming=editHistory(b.limitEdits);
    for(const [date,item]of Object.entries(incoming)){const current=history[date]||{count:0,initialized:false};history[date]={count:Math.max(current.count,item.count),initialized:current.initialized||item.initialized};}
    return {version:1,entries:[...byId.values()],drafts:[...drafts.values()],dailyLimit:dailyLimit(a.dailyLimit ?? b.dailyLimit),limitEdits:history};
  }
  function demo() {
    const result = empty();
    for(let offset=2;offset>=0;offset--){
      const d = new Date();d.setDate(d.getDate()-offset);const date=day(d);
      [['meal','아보카도 토스트',380,'08:20','🥑','천천히 시작한 아침.'],['move','점심 산책',25,'12:00','🚶','햇빛을 따라 한 바퀴.'],['meal','따뜻한 비빔밥',620,'13:10','🍚','친구와 함께 먹은 점심.'],['meal','사과와 요거트',210,'16:30','🍎','오후의 작은 쉼표.'],['move','가벼운 러닝',30,'18:15','🏃','내 속도대로 달렸어요.'],['meal','연어 샐러드',450,'19:40','🥗','오늘도 수고한 나에게.']].forEach(([type,name,amount,time,icon,note],i)=>result.entries.push(record({id:`demo-${date}-${i}`,type,name,amount,at:`${date}T${time}`,icon,note})));
    }
    return result;
  }
  globalThis.Diary = {KEY,LEGACY_KEY,uid,localTime,day,validTime,record,empty,parse,load,summary,forDay,dailyLimit,editHistory,quota,changeLimit,meter,overload,merge,demo};
})();
