/* BITE / STRIDE — a tactile, monochrome stair diary. */
(() => {
'use strict';
const D=globalThis.Diary,$=id=>document.getElementById(id),text=(id,value)=>{$(id).textContent=value;};
let storage;try{storage=window.localStorage;}catch{storage={getItem(){throw Error('저장 공간을 사용할 수 없어요.');},setItem(){throw Error('저장 공간을 사용할 수 없어요.');}};}
const loaded=D.load(storage);
let personal=loaded.doc,sample=D.demo(),demoMode=false,storageBlocked=Boolean(loaded.error);
let selectedDate=D.day(),selectedId=null,pending=null,editing=null,draftId=null,mode='meal',icon='🍚',peekVisible=false;
let sound=false,audioContext,toastTimer,hintTimer,undoAction=null;
let photoData=null,photoVersion=0,analyzing=false,photoController;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const doc=()=>demoMode?sample:personal,rows=()=>D.forDay(doc().entries,selectedDate),unit=e=>e.type==='meal'?'kcal':'분';
const format=value=>new Intl.NumberFormat('ko-KR').format(value);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=value;return n;};
function hint(value,quietAfter=6500){text('gestureStatus',value);$('gestureStatus').classList.remove('quiet');clearTimeout(hintTimer);if(quietAfter)hintTimer=setTimeout(()=>$('gestureStatus').classList.add('quiet'),quietAfter);}
function notify(message,undo=null){const active=document.activeElement?.closest('dialog[open]')||Array.from(document.querySelectorAll('dialog[open]')).at(-1);(active||document.body).append(document.getElementById("toast"));clearTimeout(toastTimer);undoAction=undo;text('toastText',message);$('undoButton').hidden=!undo;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;undoAction=null;},undo?8500:3800);}
$('undoButton').addEventListener('click',()=>{const action=undoAction;undoAction=null;$('toast').hidden=true;clearTimeout(toastTimer);action?.();});
function persist(target=doc()){
  if(target!==personal)return true;
  if(storageBlocked){text('storageStatus','저장 불가 · 내보내기로 보관해 주세요.');notify('자동 저장을 사용할 수 없어요. 기록을 내보내 주세요.');return false;}
  try{storage.setItem(D.KEY,JSON.stringify(personal));text('storageStatus','이 브라우저에 보관돼요.');return true;}
  catch{storageBlocked=true;text('storageStatus','저장 불가 · 내보내기로 보관해 주세요.');notify('자동 저장을 사용할 수 없어요. 기록을 내보내 주세요.');return false;}
}
function render(){
  const s=D.summary(rows());text('mealCount',String(s.meals).padStart(2,'0'));text('moveMinutes',String(s.minutes).padStart(2,'0'));text('foodEnergy',format(s.kcal));text('exerciseCount',s.moves);text('machineDate',selectedDate);
  $('archiveDate').value=selectedDate;$('demoBanner').hidden=!demoMode;$('demoButton').setAttribute('aria-pressed',String(demoMode));text('demoButton',demoMode?'내 기록':'예시');
  text('storageStatus',demoMode?'예시 공간 · 내 기록과 분리돼요.':storageBlocked?'저장 불가 · 내보내기로 보관해 주세요.':'이 브라우저에 보관돼요.');
  renderPending();renderPeek();renderArchive();draw();
}
function renderPending(){
  $('pendingCard').hidden=!pending;
  if(pending){text('pendingName',pending.name);text('stampButton',pending.type==='meal'?'↓':'↑');$('stampButton').setAttribute('aria-label',pending.type==='meal'?'한 끼 기록 확정':'운동 기록 확정');}
}
function renderPeek(){
  const e=doc().entries.find(x=>x.id===selectedId);$('recordPeek').hidden=!peekVisible||!e||Boolean(pending);
  if(e){text('peekTime',e.at.slice(11));text('peekName',e.name);text('peekAmount',`${format(e.amount)} ${unit(e)}`);}
}
function renderArchive(){
  const entries=rows();text('archiveCount',`${entries.length} TRACES`);$('recordList').replaceChildren();
  if(!entries.length)$('recordList').append(el('div','empty-state','아직 새겨지지 않은 하루.'));
  for(const e of entries){
    const b=el('button',`record-card ${e.type}${selectedId===e.id?' selected':''}`);b.type='button';b.dataset.id=e.id;b.setAttribute('aria-label',`${e.at.slice(11)} ${e.name}, ${e.amount}${unit(e)}, 수정`);
    const info=el('span','record-info'),time=el('time','',e.at.slice(11));time.dateTime=e.at;
    info.append(time,el('b','record-name',e.name));if(e.note)info.append(el('span','record-note-dot'));
    b.append(el('span','record-arrow',e.type==='meal'?'↓':'↑'),info,el('span','record-meta',`${format(e.amount)} ${unit(e)}`));
    b.addEventListener('click',()=>openEditor(e.type,e));$('recordList').append(b);
  }
  const inner=el('div','timeline-inner');
  for(let h=0;h<=24;h+=3){const tick=el('span','time-tick',String(h).padStart(2,'0'));tick.style.left=`${h/24*100}%`;inner.append(tick);}
  for(const e of entries){const minutes=Number(e.at.slice(11,13))*60+Number(e.at.slice(14,16));const n=el('button',`time-event ${e.type}`);n.style.left=`${minutes/1440*100}%`;n.title=`${e.at.slice(11)} ${e.name}`;n.append(el('span','',e.type==='meal'?'↓':'↑'),el('b','',e.name),el('small','',e.at.slice(11)));n.addEventListener('click',()=>openEditor(e.type,e));inner.append(n);}
  $('timeline').replaceChildren(inner);$('legacyDraftButton').hidden=!doc().drafts.length;text('legacyDraftButton',`이전 식탁 메모 (${doc().drafts.length})`);
}
function openArchive(){stopMotion();resetPointers();renderArchive();if(!$('archiveDialog').open)$('archiveDialog').showModal();$('unfoldButton').setAttribute('aria-expanded','true');}
$('archiveDialog').addEventListener('close',()=>{$('unfoldButton').setAttribute('aria-expanded','false');canvas.focus({preventScroll:true});});
function openEditor(type,entry=null,draft=null){
  stopMotion();resetPointers();mode=type;editing=entry?.id||null;draftId=draft?.id||null;const value=entry||draft;icon=value?.icon||(type==='meal'?'🍚':'🚶');const move=type==='move';
  $('entryForm').reset();text('formError','');text('entryEyebrow',move?'STRIDE / REVERSE':'BITE / FORWARD');text('entryTitle',entry?'새겨 둔 순간.':move?'움직임을 새기기.':'한 끼를 새기기.');
  text('entryCopy',entry?'확인하고, 필요한 것만 고쳐 주세요.':move?'준비한 뒤 계단을 위로 밀어요.':'준비한 뒤 계단을 아래로 밀어요.');text('nameLabel',move?'운동':'음식');text('amountLabel',move?'시간 · 분':'kcal');
  $('entryName').placeholder=move?'어떻게 움직였나요?':'무엇을 먹었나요?';$('entryName').value=value?.name||'';$('entryAmount').min=move?'1':'0';$('entryAmount').max=move?'1440':'10000';$('entryAmount').value=value?.amount??'';$('entryTime').value=value?.at||D.localTime();$('entryNote').value=value?.note||'';
  text('submitEntry',entry?'수정하기':move?'준비하기 ↑':'준비하기 ↓');$('deleteEntry').hidden=!entry;$('photoSection').hidden=move;$('photoSection').open=false;resetPhoto();
  if(!$('entryDialog').open)$('entryDialog').showModal();
}
$('entryForm').addEventListener('submit',event=>{
  event.preventDefault();try{
    const e=D.record({id:editing||D.uid(),type:mode,name:$('entryName').value,amount:Number($('entryAmount').value),at:$('entryTime').value,note:$('entryNote').value,icon});
    if(editing){const index=doc().entries.findIndex(x=>x.id===editing);if(index<0)throw Error('기록을 다시 열어 주세요.');doc().entries[index]=e;selectedDate=e.at.slice(0,10);persist();hint('수정한 순간을 보관했어요.');}
    else{pending={...e,draftId};gestureOffset=0;peekVisible=false;hint(e.type==='meal'?'아래로 밀고 손을 떼면 새겨져요. ↓':'위로 밀고 손을 떼면 새겨져요. ↑',0);}
    $('entryDialog').close();render();if(!editing)canvas.focus({preventScroll:true});
  }catch(error){text('formError',error.message);}
});
function stamp(){
  if(!pending)return;stopMotion();const e=D.record(pending),move=e.type==='move';
  if(!doc().entries.some(x=>x.id===e.id))doc().entries.push(e);if(pending.draftId)doc().drafts=doc().drafts.filter(x=>x.id!==pending.draftId);
  pending=null;selectedDate=e.at.slice(0,10);selectedId=e.id;peekVisible=false;beltPosition=0;gestureOffset=0;extractX=0;
  const saved=persist();render();animateStamp(move?-1:1);clickSound(move);$('gestureProgress').style.width='0%';
  if(saved)hint(move?'움직임을 새겼어요. 식사 기록도 남아 있어요.':'한 끼가 새겨졌어요.');
}
function removeRecord(id){
  const target=doc(),index=target.entries.findIndex(e=>e.id===id);if(index<0)return;
  const [entry]=target.entries.splice(index,1);persist(target);selectedId=null;peekVisible=false;extractX=0;beltPosition=clamp(beltPosition,0,Math.max(0,target.entries.length));render();clickSound(true);
  notify('기록을 분리했어요.',()=>{if(!target.entries.some(e=>e.id===entry.id))target.entries.splice(Math.min(index,target.entries.length),0,entry);persist(target);render();hint('기록을 되돌렸어요.');});
}
$('stampButton').addEventListener('click',stamp);$('cancelPending').addEventListener('click',()=>{pending=null;gestureOffset=0;render();hint('아직 새기지 않은 기록을 내려놓았어요.');});
$('addMeal').addEventListener('click',()=>openEditor('meal'));$('addMove').addEventListener('click',()=>openEditor('move'));$('unfoldButton').addEventListener('click',openArchive);
$('editPeek').addEventListener('click',()=>{const e=doc().entries.find(x=>x.id===selectedId);if(e)openEditor(e.type,e);});$('closePeek').addEventListener('click',()=>{peekVisible=false;renderPeek();});
$('legacyDraftButton').addEventListener('click',()=>{const e=doc().drafts[0];if(e)openEditor('meal',null,e);});
$('deleteEntry').addEventListener('click',()=>$('confirmDialog').showModal());$('confirmDelete').addEventListener('click',()=>{const id=editing;$('confirmDialog').close();$('entryDialog').close();removeRecord(id);});
$('helpButton').addEventListener('click',()=>{stopMotion();$('helpDialog').showModal();});
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>$(b.dataset.close).close());
$('entryDialog').addEventListener('close',()=>{photoVersion++;photoController?.abort();});
function switchDemo(){stopMotion();clearHold();demoMode=!demoMode;pending=null;selectedId=null;peekVisible=false;selectedDate=D.day();beltPosition=0;gestureOffset=0;undoAction=null;$('toast').hidden=true;render();hint(demoMode?'밀어 보고, 붙잡아 보세요. 예시는 내 기록과 분리돼요.':'빈 계단을 길게 눌러 시작하세요.');}
$('demoButton').addEventListener('click',switchDemo);$('exitDemo').addEventListener('click',switchDemo);
$('archiveDate').addEventListener('change',()=>{if(!/^\d{4}-\d\d-\d\d$/.test($('archiveDate').value))return;stopMotion();selectedDate=$('archiveDate').value;beltPosition=0;selectedId=null;peekVisible=false;render();});
function shiftDay(delta){stopMotion();const date=new Date(`${selectedDate}T12:00`);date.setDate(date.getDate()+delta);selectedDate=D.day(date);beltPosition=0;selectedId=null;peekVisible=false;render();}
$('previousDay').addEventListener('click',()=>shiftDay(-1));$('nextDay').addEventListener('click',()=>shiftDay(1));$('todayButton').addEventListener('click',()=>{selectedDate=D.day();beltPosition=0;selectedId=null;peekVisible=false;render();});
$('exportButton').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(doc(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`bite-stride-${demoMode?'example-':''}${D.day()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('기록을 파일로 내보냈어요.');});
$('importFile').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>8*1024*1024)throw Error('8MB 이하 파일을 선택해 주세요.');const incoming=D.parse(await file.text()),merged=D.merge(doc(),incoming);if(demoMode)sample=merged;else{personal=merged;if(storageBlocked){try{storage.setItem(D.KEY,JSON.stringify(personal));storageBlocked=false;}catch{}}}const saved=persist();selectedDate=incoming.entries.at(-1)?.at.slice(0,10)||D.day();beltPosition=0;render();if(saved)notify('기존 기록에 합쳤어요. 중복은 건너뛰었어요.');}catch(error){notify(error.message||'파일을 읽지 못했어요.');}finally{event.target.value='';}});
window.addEventListener('storage',event=>{if(event.key===D.KEY&&!demoMode){try{personal=event.newValue?D.parse(event.newValue):D.empty();pending=null;beltPosition=0;stopMotion();render();hint('다른 탭에서 바꾼 기록을 반영했어요.');}catch{notify('기록을 읽지 못해 현재 상태를 유지해요.');}}});
$('soundButton').addEventListener('click',()=>{sound=!sound;$('soundButton').setAttribute('aria-pressed',String(sound));$('soundButton').setAttribute('aria-label',sound?'소리 끄기':'소리 켜기');$('soundButton').title=sound?'소리 끄기':'소리 켜기';$('soundButton').style.color=sound?'#f0f5fa':'';if(sound)clickSound(false);});
function clickSound(move){if(!sound)return;try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='triangle';osc.frequency.setValueAtTime(move?420:660,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(85,audioContext.currentTime+.1);gain.gain.setValueAtTime(.06,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.13);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.14);}catch{}}
function renderIcons(){} // Legacy icon metadata is retained; the machine uses only monochrome etchings.
function resetPhoto(){photoVersion++;photoController?.abort();photoData=null;analyzing=false;$('photoFile').value='';$('photoPreview').hidden=true;$('photoPreview').removeAttribute('src');$('photoConsent').checked=false;$('analyzeButton').disabled=true;text('photoStatus','사진은 기록에 저장되지 않아요. 분석값을 확인·수정해 주세요.');}
$('photoConsent').addEventListener('change',()=>{$('analyzeButton').disabled=!photoData||!$('photoConsent').checked||analyzing;});
$('photoFile').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;const version=++photoVersion;photoController?.abort();photoData=null;analyzing=false;$('analyzeButton').disabled=true;$('photoConsent').checked=false;
  try{
    if(!file.type.startsWith('image/')||file.size>20*1024*1024)throw Error('20MB 이하의 이미지 파일을 선택해 주세요.');
    const url=URL.createObjectURL(file);let image;
    try{image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('사진을 읽지 못했어요. JPG 또는 PNG를 선택해 주세요.'));img.src=url;});}finally{URL.revokeObjectURL(url);}
    if(version!==photoVersion)return;const ratio=Math.min(1,1280/Math.max(image.width,image.height)),c=document.createElement('canvas');c.width=Math.round(image.width*ratio);c.height=Math.round(image.height*ratio);c.getContext('2d').drawImage(image,0,0,c.width,c.height);photoData=c.toDataURL('image/jpeg',.78);
    if(photoData.length>2500000)throw Error('사진 크기를 줄여 다시 선택해 주세요.');$('photoPreview').src=photoData;$('photoPreview').hidden=false;text('photoStatus','전송 동의 후 분석할 수 있어요. 결과는 직접 수정할 수 있어요.');
  }catch(error){if(version===photoVersion){photoData=null;text('photoStatus',error.message);}}
});
$('analyzeButton').addEventListener('click',async()=>{
  if(!photoData||!$('photoConsent').checked||analyzing)return;
  const version=photoVersion;analyzing=true;$('analyzeButton').disabled=true;photoController=new AbortController();const controller=photoController,timer=setTimeout(()=>controller.abort(),40000);text('photoStatus','음식을 살펴보고 있어요…');
  try{const response=await fetch('/api/analyze-food',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:photoData}),signal:controller.signal});if(!response.headers.get('content-type')?.includes('application/json'))throw Error('사진 분석은 로컬 Node 서버에서 사용할 수 있어요. 직접 입력도 가능해요.');const result=await response.json();if(!response.ok)throw Error(result.error||'분석에 연결하지 못했어요.');if(version!==photoVersion)return;if(!result.food)throw Error('음식을 찾지 못했어요. 직접 입력해 주세요.');$('entryName').value=result.food.name;$('entryAmount').value=result.food.kcal;icon=result.food.icon;renderIcons();text('photoStatus',`추정 결과예요. ${result.food.assumption} · 값을 확인하고 수정해 주세요.`);}
  catch(error){if(version===photoVersion)text('photoStatus',error.name==='AbortError'?'분석이 중단됐어요. 다시 시도하거나 직접 입력해 주세요.':error.message);}
  finally{clearTimeout(timer);if(version===photoVersion){analyzing=false;$('analyzeButton').disabled=!photoData||!$('photoConsent').checked;}}
});

// Locally drawn metal: gradients, bevels, brushed ribs, and specular handrails.
const canvas=$('machine'),ctx=canvas.getContext('2d');
let width=0,height=0,scale=1,originX=0,originY=0,beltPosition=0,gestureOffset=0,extractX=0,extractedId=null;
let animationOffset=0,flash=0,stampFrame=0,motionFrame=0,holdFrame=0,holdTimer=0,holdStart=0,holdPoint=null,hitAreas=[],hitZones=[];
let chromeRenderer=null;
try{if(globalThis.ChromeMachine){chromeRenderer=new ChromeMachine($('chromeMachine'));document.body.classList.add('has-chrome');}}catch(error){console.warn('Chrome renderer unavailable; using Canvas fallback.',error.message);$('chromeMachine').hidden=true;}
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);scale=Math.min((width-25)/540,(height-190)/620,1.35);scale=Math.max(.32,scale);originX=width/2-390*scale;originY=height/2-345*scale-6;draw();}
function poly(points,fill,stroke='#ffffff20',thickness=1){ctx.beginPath();for(let i=0;i<points.length;i++)i?ctx.lineTo(...points[i]):ctx.moveTo(...points[i]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=thickness;ctx.stroke();}}
function line(points,color,thickness=1){ctx.beginPath();for(let i=0;i<points.length;i++)i?ctx.lineTo(...points[i]):ctx.moveTo(...points[i]);ctx.strokeStyle=color;ctx.lineWidth=thickness;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}
function gradient(x1,y1,x2,y2,stops){const g=ctx.createLinearGradient(x1,y1,x2,y2);for(const [offset,color]of stops)g.addColorStop(offset,color);return g;}
function label(value,x,y,size=10,color='#d3dbe0',font='monospace'){ctx.font=`${size}px ${font}`;ctx.fillStyle=color;ctx.fillText(value,x,y);}
function rail(points){line(points,'#000000aa',21);const g=gradient(150,0,650,0,[[0,'#252b31'],[.12,'#d8dfe3'],[.24,'#545c64'],[.4,'#9aa5ad'],[.51,'#f0f4f6'],[.56,'#66717b'],[.8,'#b9c2c9'],[1,'#333e48']]);line(points,g,15);line(points.map(([x,y])=>[x-2,y-2]),'#f2f7fc66',1.3);line(points.map(([x,y])=>[x+4,y+1]),'#0000005c',2);}
function drawLegacy(){
  if(!width)return;ctx.clearRect(0,0,width,height);ctx.save();ctx.translate(originX,originY);ctx.scale(scale,scale);hitAreas=[];hitZones=[];
  const halo=ctx.createRadialGradient(400,602,15,400,602,270);halo.addColorStop(0,'#9db5c52a');halo.addColorStop(.5,'#617d9410');halo.addColorStop(1,'#66829900');ctx.save();ctx.translate(390,622);ctx.scale(1,.27);ctx.fillStyle=halo;ctx.fillRect(-500,-500,1000,1000);ctx.restore();
  const floor=gradient(180,610,620,630,[[0,'#ffffff00'],[.5,'#aebfcb0b'],[1,'#ffffff00']]);line([[145,630],[653,630]],floor,1);
  rail([[466,252],[449,157],[448,102],[462,81],[486,86],[509,124],[627,474],[624,534]]);
  const body=gradient(180,240,620,590,[[0,'#353c44'],[.3,'#171c21'],[.65,'#333c44'],[1,'#0a0e12']]);
  poly([[183,249],[458,173],[625,554],[351,631]],body,'#68768066',1.2);
  poly([[183,249],[351,606],[351,637],[172,284]],gradient(175,0,350,0,[[0,'#727f88'],[.12,'#3c454e'],[.55,'#151c23'],[1,'#53606c']]),'#b8c5ce33');
  poly([[351,606],[625,531],[625,563],[351,640]],gradient(350,606,350,640,[[0,'#86939d'],[.12,'#273039'],[.8,'#111820'],[1,'#4a5966']]),'#95a5b044');
  line([[182,249],[351,606],[622,532]],'#c3d0d966',1.3);
  rail([[318,207],[303,139]]);
  poly([[251,120],[369,89],[410,139],[286,174]],gradient(250,100,400,175,[[0,'#9da8b0'],[.15,'#3b454e'],[.85,'#0e151c'],[1,'#88949e']]),'#b8c8d455',1);
  poly([[264,122],[364,97],[392,135],[290,162]],'#04080c','#84939e66');
  const summary=D.summary(rows());
  ctx.save();ctx.transform(1,-.27,.6,.87,283,130);label(`${String(summary.meals).padStart(2,'0')} / ${String(summary.minutes).padStart(2,'0')}`,0,0,17,'#eff6fc');label('MEALS     MIN',1,12,5.7,'#8699a9');ctx.restore();
  ctx.beginPath();ctx.arc(395,151,9,0,Math.PI*2);ctx.fillStyle='#202a33';ctx.fill();ctx.strokeStyle='#aabcc966';ctx.stroke();label('↑',391,155,12,'#e3edf4');hitZones.push({kind:'move',points:[[382,137],[408,137],[408,164],[382,164]]});
  const list=[null,...rows().slice().reverse()],cycleLength=Math.max(12,list.length+4),base=Math.floor(beltPosition),fraction=beltPosition-base;
  const phase=animationOffset;
  const moveCount=rows().filter(e=>e.type==='move').length;
  for(let i=-1;i<=8;i++){
    const z=i-fraction+phase/43;if(z<-.05||z>7.05)continue;
    const recordIndex=(((base+i)%cycleLength)+cycleLength)%cycleLength,item=list[recordIndex],x=193+z*19,y=246+z*43,active=item?.id===selectedId;
    const delta=item?.id===extractedId?extractX/scale:0;ctx.save();ctx.translate(delta,0);
    const top=[[x,y],[x+260,y-70],[x+282,y-45],[x+22,y+25]],front=[[x+22,y+25],[x+282,y-45],[x+282,y-24],[x+22,y+46]];
    if(delta){poly([[x-delta,y],[x+260-delta,y-70],[x+282-delta,y-24],[x+22-delta,y+46]],'#020305','#6d778244');}
    poly(front,gradient(x,y+20,x,y+48,[[0,'#57636f'],[.14,'#171e26'],[.85,'#0b1017'],[1,'#81909b']]),'#a6b6c133',.7);
    const metal=gradient(x,y,x+270,y-60,[[0,active?'#8997a3':'#4d5863'],[.12,active?'#c2cdd5':'#89959e'],[.32,'#424d58'],[.55,active?'#a8bac7':'#788691'],[.78,'#3e4b57'],[1,'#a2afb9']]);
    poly(top,metal,'#d3e3ed55',.8);line([[x+1,y],[x+261,y-70]],'#edf6fd77',.8);line([[x+22,y+25],[x+281,y-45]],'#e2edf4aa',1);
    for(let k=1;k<36;k++){const u=k/36;line([[x+u*260+3,y-u*70+5],[x+u*260+17,y-u*70+19]],'#080d1360',.8);line([[x+u*260+4,y-u*70+5],[x+u*260+18,y-u*70+19]],'#ecf3f72a',.45);}
    if(item){
      ctx.save();ctx.transform(1,-.269,.72,.79,x+45,y+1);
      const name=item.name.length>15?item.name.slice(0,15)+'…':item.name;
      label(item.type==='meal'?'↓':'↑',0,0,14,'#f4f8fc');
      ctx.shadowColor='#000';ctx.shadowBlur=1.7;ctx.shadowOffsetY=1;label(name,24,-1,11,'#f1f5f8','"Malgun Gothic","Apple SD Gothic Neo",sans-serif');ctx.shadowBlur=0;ctx.shadowOffsetY=0;label(item.at.slice(11),24,11,7,'#d4dde3');ctx.restore();
      hitAreas.push({points:top.map(([px,py])=>[px+delta,py]),entry:item,index:base+i});
      if(item.type==='move'){for(let j=0;j<Math.min(12,Math.max(1,Math.ceil(item.amount/5)));j++)line([[x+41+j*12,y+28-j*3.2],[x+44+j*12,y+36-j*3.2]],'#d3eafba6',1.4);}
      else if(moveCount){for(let j=0;j<Math.min(moveCount,5);j++)line([[x+29+j*11,y+28-j*3],[x+36+j*11,y+33-j*3]],'#a9c1d17a',1);}
    }else{
      hitAreas.push({points:top.map(([px,py])=>[px+delta,py]),entry:null,index:base+i});
      if(recordIndex===0){ctx.save();ctx.transform(1,-.269,.72,.79,x+100,y-8);label('+',0,0,20,'#f0f7fbcc');label('PRESS / HOLD',28,-2,7,'#dae5ecaa');ctx.restore();}
    }
    if(flash>0&&item?.id===selectedId){ctx.globalAlpha=flash*.35;poly(top,'#f3faff',null);ctx.globalAlpha=1;}
    ctx.restore();
  }
  rail([[180,350],[160,247],[159,183],[174,163],[196,167],[220,205],[366,554],[386,577],[409,565]]);
  // Heavy end cap and exposed fasteners anchor the belt in a physical chassis.
  poly([[351,615],[627,540],[634,560],[359,639]],gradient(350,610,365,640,[[0,'#a9b5bf'],[.1,'#3b4753'],[.75,'#111b25'],[1,'#6c7e8f']]),'#bcccd866');
  for(const [x,y]of [[368,625],[619,555]]){ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fillStyle='#a5b5c0';ctx.fill();line([[x-1,y],[x+1,y]],'#18222c',.8);}
  ctx.save();ctx.transform(1,-.27,.3,.9,420,611);label('B / S     •     '+selectedDate.slice(5).replace('-','.'),0,0,7,'#b5c5d2');ctx.restore();
  if(pending){
    const px=320,py=279+clamp(gestureOffset*.35,-50,55);ctx.save();ctx.translate(px,py);ctx.shadowColor='#0009';ctx.shadowBlur=25;
    poly([[-28,-22],[127,-63],[144,-39],[-11,3]],gradient(0,0,100,-45,[[0,'#d2dde5'],[.3,'#6b7c8a'],[.7,'#899eaf'],[1,'#ecf6fd']]),'#ecf7fcdd',1.1);ctx.shadowBlur=0;ctx.transform(1,-.269,.72,.79,-3,-10);label(pending.type==='meal'?'↓':'↑',0,0,17,'#fff');label(pending.name.slice(0,10),23,0,10,'#fff','"Malgun Gothic",sans-serif');ctx.restore();
  }
  ctx.restore();
  if(holdPoint&&holdStart){const progress=clamp((performance.now()-holdStart)/520,0,1);ctx.beginPath();ctx.arc(holdPoint.x,holdPoint.y,19,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.strokeStyle='#edf8ff';ctx.lineWidth=1.3;ctx.stroke();}
}
function draw(){
  if(!chromeRenderer){drawLegacy();return;}
  if(!width)return;
  ctx.clearRect(0,0,width,height);
  const result=chromeRenderer.render({width,height,entries:rows(),pending,selectedId,position:beltPosition,gesture:gestureOffset,animation:animationOffset,extractedId,extractX,flash,idle:pointers.size===0&&!document.querySelector('dialog[open]'),reduceMotion});
  const convert=points=>points.map(([x,y])=>[(x-originX)/scale,(y-originY)/scale]);
  hitAreas=result.areas.map(a=>({...a,points:convert(a.points)}));hitZones=result.zones.map(a=>({...a,points:convert(a.points)}));
  if(holdPoint&&holdStart){const progress=clamp((performance.now()-holdStart)/520,0,1);ctx.beginPath();ctx.arc(holdPoint.x,holdPoint.y,19,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.strokeStyle='#edf8ff';ctx.lineWidth=1.3;ctx.stroke();}
}
function animateStamp(direction){cancelAnimationFrame(stampFrame);if(reduceMotion){animationOffset=0;flash=0;draw();return;}const start=performance.now();function tick(now){const t=clamp((now-start)/520,0,1);animationOffset=direction*43*(1-Math.pow(1-t,3));flash=1-t;draw();if(t<1)stampFrame=requestAnimationFrame(tick);else{animationOffset=0;flash=0;draw();}}stampFrame=requestAnimationFrame(tick);}
function stopMotion(){cancelAnimationFrame(motionFrame);motionFrame=0;}
function inertia(velocity){stopMotion();if(reduceMotion||Math.abs(velocity)<.012)return;let last=performance.now();function tick(now){const delta=Math.min(32,now-last);last=now;velocity*=Math.pow(.88,delta/16);beltPosition+=velocity*delta/16;draw();if(Math.abs(velocity)>.003)motionFrame=requestAnimationFrame(tick);else motionFrame=0;}motionFrame=requestAnimationFrame(tick);}
function inside(point,points){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,yi]=points[i],[xj,yj]=points[j];if(((yi>point.y)!==(yj>point.y))&&(point.x<(xj-xi)*(point.y-yi)/(yj-yi)+xi))yes=!yes;}return yes;}
function localPoint(event){const r=canvas.getBoundingClientRect();return {x:(event.clientX-r.left-originX)/scale,y:(event.clientY-r.top-originY)/scale};}
function pick(event){const point=localPoint(event);return hitZones.find(h=>inside(point,h.points))||hitAreas.slice().reverse().find(h=>inside(point,h.points))||null;}
function clearHold(){clearTimeout(holdTimer);cancelAnimationFrame(holdFrame);holdStart=0;holdPoint=null;}
const pointers=new Map();let startX=0,startY=0,startPosition=0,lastY=0,lastTime=0,velocity=0,dragStepPitch=68,axis=null,downHit=null,holdFired=false,pinching=false,pinchDistance=0,pinchOpen=false,dragMoved=false;
function resetPointers(){for(const id of pointers.keys()){try{if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}catch{}}pointers.clear();pinching=false;clearHold();gestureOffset=0;extractX=0;extractedId=null;}
window.addEventListener('blur',()=>{resetPointers();stopMotion();draw();});
const threshold=()=>Math.min(135,height*.22),deleteThreshold=()=>Math.min(135,width*.28);
const distance=()=>{const p=[...pointers.values()];return Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);};
canvas.addEventListener('pointerdown',event=>{
  if(event.pointerType==='mouse'&&event.button!==0)return;stopMotion();cancelAnimationFrame(stampFrame);animationOffset=0;flash=0;
  try{canvas.setPointerCapture(event.pointerId);}catch{}pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size===1){startX=event.clientX;startY=lastY=event.clientY;lastTime=performance.now();velocity=0;startPosition=beltPosition;axis=null;downHit=pick(event);dragStepPitch=downHit?.pitch||Math.max(24,43*scale);dragMoved=false;holdFired=false;pinching=false;extractX=0;extractedId=null;
    if(!pending&&downHit&&!downHit.kind){holdStart=performance.now();const r=canvas.getBoundingClientRect();holdPoint={x:event.clientX-r.left,y:event.clientY-r.top};
      function ring(){draw();if(holdStart)holdFrame=requestAnimationFrame(ring);}holdFrame=requestAnimationFrame(ring);
      holdTimer=setTimeout(()=>{holdFired=true;const entry=downHit?.entry;clearHold();openEditor(entry?.type||'meal',entry||null);draw();},520);
    }
    draw();
  }else{clearHold();pinching=true;pinchOpen=false;pinchDistance=pointers.size===2?distance():pinchDistance;gestureOffset=0;extractX=0;extractedId=null;draw();}
});
canvas.addEventListener('pointermove',event=>{
  if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pinching){if(pointers.size===2&&distance()-pinchDistance>50){pinchOpen=true;hint('손을 떼면 기록이 펼쳐져요.',0);}return;}
  if(holdFired)return;
  const dx=event.clientX-startX,dy=event.clientY-startY,now=performance.now();
  if(Math.hypot(dx,dy)>8){dragMoved=true;clearHold();}
  if(!axis&&dragMoved)axis=!pending&&downHit?.entry&&Math.abs(dx)>Math.abs(dy)*1.25?'x':'y';
  if(axis==='x'){
    extractedId=downHit.entry.id;selectedId=extractedId;peekVisible=false;extractX=clamp(dx,-220,220);renderPeek();hint(Math.abs(dx)>=deleteThreshold()?'손을 떼면 기록이 분리돼요.':'옆으로 빼내기 · 놓으면 돌아가요.',0);draw();return;
  }
  if(axis==='y'){
    beltPosition=startPosition-dy/dragStepPitch;
    if(pending){gestureOffset=clamp(dy,-threshold(),threshold());const signed=pending.type==='meal'?dy:-dy,ratio=clamp(signed/threshold(),0,1);$('gestureProgress').style.width=`${ratio*100}%`;hint(signed< -12?(pending.type==='meal'?'한 끼는 아래로 ↓':'운동은 위로 ↑'):ratio>=1?'손을 떼면 새겨져요.':pending.type==='meal'?'아래로 밀어 주세요. ↓':'위로 밀어 주세요. ↑',0);}
    else{velocity=clamp(-(event.clientY-lastY)/dragStepPitch/(Math.max(1,now-lastTime)/16),-.65,.65);peekVisible=false;renderPeek();}
    lastY=event.clientY;lastTime=now;draw();
  }
});
function endPointer(event,cancel=false){
  if(!pointers.has(event.pointerId))return;clearHold();pointers.delete(event.pointerId);
  if(pinching){if(cancel)pinchOpen=false;if(!pointers.size){pinching=false;gestureOffset=0;draw();if(pinchOpen){pinchOpen=false;openArchive();hint('지나온 순간을 펼쳤어요.');}}return;}
  if(holdFired){gestureOffset=0;draw();return;}
  const dx=event.clientX-startX,dy=event.clientY-startY;
  if(!cancel&&axis==='x'&&downHit?.entry&&Math.abs(dx)>=deleteThreshold()){removeRecord(downHit.entry.id);}
  else if(!cancel&&pending&&axis==='y'){const signed=pending.type==='meal'?dy:-dy;if(signed>=threshold())stamp();else hint('아직 저장 전이에요. 끝까지 밀어 주세요.',0);}
  else if(!cancel&&!pending&&axis==='y'){if(performance.now()-lastTime<90)inertia(velocity);hint('손을 대면 멈춰요. 길게 누르면 기록을 열어요.');}
  else if(!cancel&&!dragMoved&&!pending){
    if(downHit?.kind==='move')openEditor('move');
    else if(downHit?.entry){selectedId=downHit.entry.id;peekVisible=true;renderPeek();hint('길게 눌러 수정 · 옆으로 밀어 분리');}
    else if(downHit){selectedId=null;peekVisible=false;renderPeek();hint('빈 계단을 길게 눌러 한 끼를 남겨요.');}
  }
  gestureOffset=0;extractX=0;extractedId=null;$('gestureProgress').style.width='0%';draw();
}
canvas.addEventListener('pointerup',event=>endPointer(event));canvas.addEventListener('pointercancel',event=>endPointer(event,true));
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('keydown',event=>{
  if(!['ArrowUp','ArrowDown','Enter',' ','Delete','Escape'].includes(event.key))return;event.preventDefault();stopMotion();
  if(event.key==='Escape'){if(pending)$('cancelPending').click();else{peekVisible=false;renderPeek();}return;}
  if(pending){if(event.key==='Enter'||event.key===' '||(pending.type==='meal'&&event.key==='ArrowDown')||(pending.type==='move'&&event.key==='ArrowUp'))stamp();else hint(pending.type==='meal'?'한 끼는 아래 방향키 ↓':'운동은 위 방향키 ↑',0);return;}
  if(event.key==='ArrowUp'||event.key==='ArrowDown'){const all=rows().slice().reverse();const current=all.findIndex(e=>e.id===selectedId),index=clamp(current+(event.key==='ArrowUp'?1:-1),0,Math.max(0,all.length-1));selectedId=all[index]?.id||null;beltPosition=clamp(index,0,all.length);peekVisible=Boolean(selectedId);renderPeek();draw();}
  else if(event.key==='Delete'&&selectedId){editing=selectedId;$('confirmDialog').showModal();}
  else if(event.key==='Enter'||event.key===' '){const entry=doc().entries.find(e=>e.id===selectedId);openEditor(entry?.type||'meal',entry||null);}
});
new ResizeObserver(resize).observe(canvas);render();resize();
let lastIdleFrame=0;
function idleFrame(now){if(chromeRenderer&&!document.hidden&&now-lastIdleFrame>70&&!pointers.size&&!document.querySelector('dialog[open]')){lastIdleFrame=now;draw();}requestAnimationFrame(idleFrame);}
if(chromeRenderer&&!reduceMotion)requestAnimationFrame(idleFrame);
if(loaded.migrated){persist();notify('이전 기록과 식탁 메모를 가져왔어요.');}
else if(loaded.error)notify('저장 데이터를 읽지 못해 원본을 보존했어요. 백업을 불러올 수 있어요.');
hint('계단을 잡고 위아래로 밀어 보세요. 길게 누르면 기록해요.',10000);
})();
