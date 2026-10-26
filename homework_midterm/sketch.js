/* BITE / STRIDE — pointer-driven stair diary. No external UI dependencies. */
(() => {
'use strict';
const D = globalThis.Diary, $ = id => document.getElementById(id);
let storage;
try { storage = window.localStorage; } catch { storage = {getItem(){throw Error('브라우저 저장 공간에 접근할 수 없어요.');},setItem(){throw Error('브라우저 저장 공간에 접근할 수 없어요.');}}; }
const loaded = D.load(storage);
let personal = loaded.doc, sample = D.demo(), demoMode = false, pending = null, editing = null, draftId = null;
let selectedDate = D.day(), selectedId = null, mode = 'meal', icon = '🍚', expanded = false, sound = false;
let storageBlocked = Boolean(loaded.error), toastTimer, audioContext, photoData = null, photoVersion = 0, analyzing = false, photoController;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const icons = {meal:['🍚','🥗','🍞','🥑','🍎','🍜','🍣','🍗','🍰','☕','🥛','🍽️'],move:['🚶','🏃','🚴','🏊','🧘','🏋️','🥾','💃']};
const doc = () => demoMode ? sample : personal;
const rows = () => D.forDay(doc().entries,selectedDate);
const unit = entry => entry.type==='meal' ? 'kcal' : '분';
const format = number => new Intl.NumberFormat('ko-KR').format(number);
const text = (id,value) => { $(id).textContent = value; };
function notify(message){text('toast',message);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function persist(){
  if(demoMode) return true;
  if(storageBlocked){notify('브라우저 저장을 사용할 수 없어요. 기록 내보내기로 보관해 주세요.');return false;}
  try{storage.setItem(D.KEY,JSON.stringify(personal));text('storageStatus','이 브라우저에 자동 저장했어요.');return true;}
  catch{storageBlocked=true;text('storageStatus','자동 저장 불가 · 기록을 내보내 보관해 주세요.');notify('저장 공간을 사용할 수 없어요. 기록 내보내기로 보관해 주세요.');return false;}
}
if(loaded.migrated) persist();
if(loaded.error){text('storageStatus','이전 저장 데이터를 읽지 못했어요. 원본은 유지되어 있어요.');setTimeout(()=>notify('저장 데이터를 읽지 못해 원본을 보존했어요. 백업 파일을 불러올 수 있어요.'),300);}
function el(tag,className,value){const n=document.createElement(tag);if(className)n.className=className;if(value!=null)n.textContent=value;return n;}
function render(){
  const todaySummary=D.summary(D.forDay(doc().entries,D.day()));
  text('mealCount',String(todaySummary.meals).padStart(2,'0'));text('moveMinutes',String(todaySummary.minutes).padStart(2,'0'));
  text('foodEnergy',format(todaySummary.kcal));text('exerciseCount',todaySummary.moves);
  text('machineDate',D.day().replaceAll('-','.'));$('archiveDate').value=selectedDate;
  $('demoBanner').hidden=!demoMode;$('demoButton').setAttribute('aria-pressed',String(demoMode));text('demoButton',demoMode?'내 기록 보기':'예시 체험');
  if(demoMode)text('storageStatus','예시 공간 · 수정한 예시는 내 기록에 저장되지 않아요.');
  else if(!storageBlocked)text('storageStatus','이 브라우저에 기록을 보관해요.');
  const entries=rows();text('archiveCount',`${entries.length}개의 순간`);
  $('recordList').replaceChildren();
  if(!entries.length){const n=el('div','empty-state');n.append(el('b','', '아직 새겨지지 않은 하루.'),el('p','', '한 끼와 한 번의 움직임으로 첫 궤적을 만들어 보세요.'));$('recordList').append(n);}
  for(const e of entries){
    const b=el('button',`record-card ${e.type==='move'?'move':''}${selectedId===e.id?' selected':''}`);b.type='button';b.dataset.id=e.id;
    b.setAttribute('aria-label',`${e.at.slice(11)} ${e.name}, ${e.amount}${unit(e)}, 자세히 보기 및 수정`);
    const info=el('span','record-info'),time=el('time','',e.at.slice(11));time.dateTime=e.at;
    info.append(time,el('b','record-name',e.name),el('span','record-meta',`${format(e.amount)} ${unit(e)}${e.note?' · 메모 있음':''}`));
    b.append(el('span','record-emoji',e.icon),info,el('span','record-arrow',e.type==='meal'?'↓':'↑'));
    b.addEventListener('click',()=>openEditor(e.type,e));$('recordList').append(b);
  }
  renderTimeline();renderPending();renderLegacy();draw();
}
function renderTimeline(){
  $('timeline').hidden=!expanded;$('unfoldButton').setAttribute('aria-expanded',String(expanded));$('unfoldButton').querySelector('span').textContent=expanded?'접기':'펼치기';
  if(!expanded)return;
  const inner=el('div','timeline-inner');
  for(let h=0;h<=24;h+=3){const n=el('span','time-tick',String(h).padStart(2,'0')+':00');n.style.left=`${h/24*100}%`;inner.append(n);}
  for(const e of rows()){
    const minutes=Number(e.at.slice(11,13))*60+Number(e.at.slice(14,16));
    const n=el('button',`time-event ${e.type==='move'?'move':''}`);n.style.left=`${minutes/1440*100}%`;n.title=`${e.at.slice(11)} ${e.name}`;
    n.append(el('span','',e.icon),el('b','',e.name),el('small','',e.at.slice(11)));n.addEventListener('click',()=>openEditor(e.type,e));inner.append(n);
  }
  $('timeline').replaceChildren(inner);
}
function setExpanded(value,scroll=false){expanded=value;renderTimeline();if(scroll&&value)$('archive').scrollIntoView({behavior:reduceMotion?'instant':'smooth',block:'start'});}
function renderPending(){
  $('pendingCard').hidden=!pending;
  if(!pending){text('gestureHint','식사나 운동을 준비한 뒤 계단을 밀어 주세요.');$('gestureHint').append(el('small','','빈손으로 밀면 기록을 되감아 볼 수 있어요.'));return;}
  const move=pending.type==='move';$('pendingCard').classList.toggle('move',move);
  text('pendingIcon',pending.icon);text('pendingName',pending.name);text('pendingDescription',`${pending.at.slice(11)} · ${format(pending.amount)} ${unit(pending)} · ${move?'계단을 위로 밀어 주세요 ↑':'계단을 아래로 밀어 주세요 ↓'}`);
  text('stampButton',move?'한 칸 올려 움직임 새기기 ↑':'한 칸 내려 한 끼 새기기 ↓');
  text('gestureHint',move?'운동한 순간을 위로 밀어 새겨 주세요.':'먹은 순간을 아래로 밀어 새겨 주세요.');$('gestureHint').append(el('small','','끝까지 밀고 손을 떼면 저장돼요. 버튼으로도 가능해요.'));
}
function renderLegacy(){
  let button=$('legacyDraftButton');
  if(!button){button=el('button','text-button');button.id='legacyDraftButton';$('addMeal').insertAdjacentElement('afterend',button);button.addEventListener('click',()=>{const first=doc().drafts[0];if(first){openEditor('meal',null,first);}});}
  button.hidden=!doc().drafts.length;text('legacyDraftButton',`이전 식탁 메모 불러오기 (${doc().drafts.length})`);
}
function renderIcons(){
  $('iconChoices').replaceChildren();const list=[...new Set([icon,...icons[mode]])];
  for(const value of list){const b=el('button','icon-choice',value);b.type='button';b.setAttribute('aria-label',`${value} 아이콘`);b.setAttribute('aria-pressed',String(icon===value));b.addEventListener('click',()=>{icon=value;renderIcons();});$('iconChoices').append(b);}
}
function openEditor(type,entry=null,draft=null){
  mode=type;editing=entry?.id||null;draftId=draft?.id||null;const value=entry||draft;icon=value?.icon||icons[type][0];
  const move=type==='move';$('entryForm').reset();text('formError','');
  text('entryEyebrow',move?'STRIDE / RECORD':'BITE / RECORD');text('entryTitle',entry?'남겨 둔 순간, 다시 보기':move?'어떻게 움직였나요?':'어떤 한 끼였나요?');
  text('entryCopy',entry?'식사와 운동의 흔적은 각각 보관돼요. 내용을 확인하고 수정할 수 있어요.':move?'운동 시간을 입력한 뒤, 계단을 위로 밀어 새겨 주세요.':'입력한 뒤, 계단을 아래로 밀어 새겨 주세요.');
  text('nameLabel',move?'운동 종류':'음식 이름');text('amountLabel',move?'운동 시간 · 분':'칼로리 · kcal');
  $('entryName').placeholder=move?'예: 저녁 산책':'예: 따뜻한 비빔밥';$('entryName').value=value?.name||'';
  $('entryAmount').min=move?'1':'0';$('entryAmount').max=move?'1440':'10000';$('entryAmount').value=value?.amount??'';
  $('entryTime').value=value?.at||D.localTime();$('entryNote').value=value?.note||'';
  text('submitEntry',entry?'수정 내용 저장':move?'역방향 기록 준비 ↑':'계단에 올려두기 ↓');$('deleteEntry').hidden=!entry;
  $('photoSection').hidden=move;$('photoSection').open=false;resetPhoto();renderIcons();$('entryDialog').showModal();
}
$('entryForm').addEventListener('submit',event=>{
  event.preventDefault();
  try{
    const e=D.record({id:editing||D.uid(),type:mode,name:$('entryName').value,amount:Number($('entryAmount').value),at:$('entryTime').value,note:$('entryNote').value,icon});
    if(editing){const index=doc().entries.findIndex(x=>x.id===editing);if(index<0)throw Error('기록이 변경되었어요. 다시 열어 주세요.');doc().entries[index]=e;selectedDate=e.at.slice(0,10);persist();notify('기록을 수정했어요.');}
    else{pending=e;pending.draftId=draftId;gestureOffset=0;text('gestureStatus',e.type==='move'?'위로 밀어서 움직임을 새겨 주세요 ↑':'아래로 밀어서 한 끼를 새겨 주세요 ↓');}
    $('entryDialog').close();render();if(!editing)$('machine').focus({preventScroll:true});
  }catch(error){text('formError',error.message);}
});
function stamp(){
  if(!pending)return;
  const value=D.record(pending),move=value.type==='move';
  if(!doc().entries.some(x=>x.id===value.id))doc().entries.push(value);
  if(pending.draftId)doc().drafts=doc().drafts.filter(x=>x.id!==pending.draftId);
  selectedDate=value.at.slice(0,10);selectedId=value.id;pending=null;gestureOffset=0;historyOffset=0;
  const saved=persist();animateStamp(move?-1:1);clickSound(move);render();
  text('gestureStatus',move?'움직임의 선을 더했어요. 식사 기록도 그대로 남아요.':'한 끼의 자국이 계단에 남았어요.');
  if(saved)notify(demoMode?'예시 계단에 새겼어요. 내 기록에는 영향을 주지 않아요.':move?'운동을 새겼어요. 식사 기록은 그대로예요.':'한 끼를 새기고 저장했어요.');
}
$('stampButton').addEventListener('click',stamp);
$('cancelPending').addEventListener('click',()=>{pending=null;gestureOffset=0;render();text('gestureStatus','준비를 취소했어요. 저장된 기록은 그대로예요.');});
$('addMeal').addEventListener('click',()=>openEditor('meal'));$('addMove').addEventListener('click',()=>openEditor('move'));
$('deleteEntry').addEventListener('click',()=>$('confirmDialog').showModal());
$('confirmDelete').addEventListener('click',()=>{doc().entries=doc().entries.filter(x=>x.id!==editing);persist();$('confirmDialog').close();$('entryDialog').close();render();notify('선택한 기록을 삭제했어요.');});
$('helpButton').addEventListener('click',()=>$('helpDialog').showModal());
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>$(b.dataset.close).close());
$('entryDialog').addEventListener('close',()=>{photoVersion++;photoController?.abort();});
function switchDemo(){demoMode=!demoMode;pending=null;selectedId=null;selectedDate=D.day();historyOffset=0;gestureOffset=0;render();text('gestureStatus',demoMode?'예시 기록을 돌려 보세요. 새 기록도 연습할 수 있어요.':'손끝으로 돌리는, 나의 하루');}
$('demoButton').addEventListener('click',switchDemo);$('exitDemo').addEventListener('click',switchDemo);
$('unfoldButton').addEventListener('click',()=>setExpanded(!expanded,true));
$('archiveDate').addEventListener('change',()=>{if(!/^\d{4}-\d\d-\d\d$/.test($('archiveDate').value))return;selectedDate=$('archiveDate').value;historyOffset=0;selectedId=null;render();});
function shiftDay(delta){const d=new Date(`${selectedDate}T12:00`);d.setDate(d.getDate()+delta);selectedDate=D.day(d);selectedId=null;historyOffset=0;render();}
$('previousDay').addEventListener('click',()=>shiftDay(-1));$('nextDay').addEventListener('click',()=>shiftDay(1));$('todayButton').addEventListener('click',()=>{selectedDate=D.day();historyOffset=0;render();});
$('exportButton').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(doc(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`bite-stride-${demoMode?'example-':''}${D.day()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('기록 파일을 내보냈어요. 다른 기기에서 불러올 수 있어요.');
});
$('importFile').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>8*1024*1024)throw Error('8MB 이하의 기록 파일을 선택해 주세요.');const incoming=D.parse(await file.text());
    const result=D.merge(doc(),incoming);if(demoMode)sample=result;else{personal=result;if(storageBlocked){try{storage.setItem(D.KEY,JSON.stringify(personal));storageBlocked=false;}catch{}}}
    const saved=persist();selectedDate=incoming.entries.at(-1)?.at.slice(0,10)||D.day();render();if(saved)notify('기존 기록을 유지하며 불러왔어요. 중복 기록은 건너뛰었어요.');
  }catch(error){notify(error.message||'기록 파일을 읽지 못했어요.');}finally{event.target.value='';}
});
window.addEventListener('storage',event=>{if(event.key===D.KEY&&!demoMode){try{personal=event.newValue?D.parse(event.newValue):D.empty();pending=null;render();notify('다른 탭에서 바꾼 기록을 반영했어요.');}catch{notify('다른 탭의 기록을 읽지 못했어요. 현재 기록은 유지해요.');}}});
$('soundButton').addEventListener('click',()=>{sound=!sound;text('soundButton',sound?'소리 켜짐':'소리 꺼짐');$('soundButton').setAttribute('aria-pressed',String(sound));if(sound)clickSound(false);});
function clickSound(move){if(!sound)return;try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='triangle';osc.frequency.setValueAtTime(move?430:650,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(90,audioContext.currentTime+.09);gain.gain.setValueAtTime(.065,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.12);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.13);}catch{}}
// Camera analysis stays optional. Credentials remain on the local Node server.
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
// The stair machine is drawn locally so dragging has immediate tactile feedback.
const canvas=$('machine'),ctx=canvas.getContext('2d');let width=0,height=0,scale=1,originX=0,originY=0;
let gestureOffset=0,historyOffset=0,animationOffset=0,flash=0,animationFrame=0,hitAreas=[];
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);scale=Math.min(width/640,height/530);originX=(width-640*scale)/2;originY=(height-530*scale)/2;draw();}
function polygon(points,fill,stroke='#414a43',line=1){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}}
function line(points,color,lineWidth=2){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
function rail(points){line(points,'#2b3832',11);line(points.map(([x,y])=>[x-1.5,y-2]),'#829185',3);}
function label(value,x,y,size=10,color='#c5cbbb',font='monospace'){ctx.fillStyle=color;ctx.font=`${size}px ${font}`;ctx.fillText(value,x,y);}
function draw(){
  if(!width)return;ctx.clearRect(0,0,width,height);ctx.save();ctx.translate(originX,originY);ctx.scale(scale,scale);hitAreas=[];
  const shadow=ctx.createRadialGradient(383,451,10,383,451,225);shadow.addColorStop(0,'#26382c25');shadow.addColorStop(1,'#26382c00');ctx.fillStyle=shadow;ctx.save();ctx.translate(380,457);ctx.scale(1,.25);ctx.beginPath();ctx.arc(0,0,240,0,Math.PI*2);ctx.fill();ctx.restore();
  // Back rail and machine housing.
  rail([[368,181],[357,86],[364,57],[392,51],[432,95],[562,368],[561,416]]);
  polygon([[187,185],[434,122],[551,415],[324,485]],'#43554a');
  polygon([[187,185],[324,460],[324,485],[182,219]],'#607262');
  polygon([[324,460],[551,395],[551,425],[324,489]],'#283a31');
  line([[333,476],[540,419]],'#96a08f',2);
  // The console is deliberately small: the steps carry the records.
  rail([[290,163],[279,92]]);
  polygon([[241,93],[324,70],[344,101],[258,127]],'#35463a','#24352c',2);
  polygon([[255,95],[315,79],[328,99],[269,115]],'#b8c6a8','#6b7b68');
  ctx.save();ctx.transform(1,-.27,.5,.85,267,101);label('B / S',0,0,10,'#3b5745');ctx.restore();
  ctx.beginPath();ctx.arc(328,108,3,0,Math.PI*2);ctx.fillStyle='#e3794c';ctx.fill();
  const entries=rows();const display=entries.slice().reverse();const moveCount=entries.filter(x=>x.type==='move').length;
  const phase=(gestureOffset*.24+animationOffset)%43;
  for(let i=-1;i<8;i++){
    const z=i+phase/43;if(z<0||z>7)continue;
    const x=194+z*18,y=181+z*39;
    const item=display[i+historyOffset];
    const active=item?.id===selectedId;
    let top=item?.type==='meal'?'#e8d1ad':item?.type==='move'?'#b7c9b8':'#cbd0b9';
    if(active)top=item?.type==='move'?'#a7c9b8':'#efc598';
    const tread=[[x,y],[x+225,y-62],[x+245,y-39],[x+20,y+23]];
    polygon([[x+20,y+23],[x+245,y-39],[x+245,y-20],[x+20,y+42]],'#536650','#3e5143');
    polygon(tread,top,'#4b5c49',1.2);
    // Fine ribs make the object read as a stair climber, not a floating chart.
    for(let k=1;k<14;k++){const u=k/14;line([[x+u*225+4,y-u*62+4],[x+u*225+16,y-u*62+17]],'#68765b55',.8);}
    if(item){
      ctx.save();ctx.transform(1,-.275,.65,.75,x+52,y-5);
      ctx.fillStyle=item.type==='meal'?'#a14b2d':'#2d6d58';ctx.globalAlpha=.85;
      ctx.font='22px "Segoe UI Emoji","Apple Color Emoji",sans-serif';ctx.fillText(item.icon,0,3);
      ctx.font='bold 10px "Malgun Gothic",sans-serif';ctx.fillText(item.name.length>11?item.name.slice(0,11)+'…':item.name,33,0);
      ctx.font='8px monospace';ctx.globalAlpha=.7;ctx.fillText(item.at.slice(11),34,12);ctx.restore();
      hitAreas.push({x:x+113,y:y-13,entry:item});
    }else if(i===0&&!entries.length){ctx.save();ctx.transform(1,-.275,.65,.75,x+72,y-4);label('YOUR FIRST TRACE',0,0,9,'#697960');ctx.restore();}
    // Reverse movement adds teal etchings while the meal stamp stays intact.
    if(moveCount>0&&item?.type==='meal'){
      const lines=Math.min(moveCount,5);for(let j=0;j<lines;j++)line([[x+29+j*13,y+26-j*3.5],[x+37+j*13,y+32-j*3.5]],'#91c2a7',2);
    }
    if(flash>0&&item?.id===selectedId){ctx.globalAlpha=flash*.25;polygon(tread,item.type==='meal'?'#ff9b55':'#88dfb5',null);ctx.globalAlpha=1;}
  }
  // Front rail curves around the stair belt.
  rail([[183,265],[165,179],[165,130],[181,112],[202,115],[222,147],[348,416],[365,434],[389,424]]);
  line([[165,179],[183,265]],'#abb5a1',2);
  polygon([[327,476],[543,418],[548,435],[335,495]],'#394b3f');
  label('BITE / STRIDE',375,469,9,'#b9c6b1');
  for(const [x,y] of [[339,480],[532,429]]){ctx.beginPath();ctx.arc(x,y,2,0,7);ctx.fillStyle='#aebba4';ctx.fill();}
  if(pending){
    ctx.save();const px=282,py=212+Math.max(-45,Math.min(65,gestureOffset*.4));ctx.translate(px,py);
    ctx.shadowColor='#28382d33';ctx.shadowBlur=14;ctx.fillStyle=pending.type==='meal'?'#fae0c0':'#cce2d3';ctx.strokeStyle=pending.type==='meal'?'#dc5c35':'#33796f';ctx.lineWidth=1.4;ctx.beginPath();ctx.roundRect(-30,-34,145,58,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    label(pending.icon,-19,4,28,'#292d29','"Segoe UI Emoji","Apple Color Emoji",sans-serif');label(pending.name.slice(0,8),22,-6,10,'#394332','"Malgun Gothic",sans-serif');label(pending.type==='meal'?'PUSH DOWN ↓':'PULL UP ↑',22,10,8,pending.type==='meal'?'#b54e2c':'#33796f');ctx.restore();
  }
  ctx.restore();
}
function animateStamp(direction){
  cancelAnimationFrame(animationFrame);if(reduceMotion){animationOffset=0;flash=0;draw();return;}
  const start=performance.now();
  function tick(now){const t=Math.min(1,(now-start)/560);animationOffset=direction*43*(1-Math.pow(1-t,3));flash=1-t;draw();if(t<1)animationFrame=requestAnimationFrame(tick);else{animationOffset=0;flash=0;draw();}}
  animationFrame=requestAnimationFrame(tick);
}
const pointers=new Map();let startY=0,startX=0,startHistory=0,pinching=false,pinchDistance=0,dragMoved=false;
const distance=()=>{const a=[...pointers.values()];return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);};
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0&&event.pointerType==='mouse')return;
  canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size===1){startY=event.clientY;startX=event.clientX;startHistory=historyOffset;dragMoved=false;pinching=false;}
  else if(pointers.size===2){pinching=true;pinchDistance=distance();gestureOffset=0;text('gestureStatus','두 손가락으로 벌려 하루를 펼쳐 보세요.');}
});
canvas.addEventListener('pointermove',event=>{
  if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pinching){if(pointers.size===2){const delta=distance()-pinchDistance;if(delta>45)setExpanded(true);if(delta< -45)setExpanded(false);}return;}
  const delta=event.clientY-startY;if(Math.abs(delta)>7)dragMoved=true;
  if(pending){
    const signed=pending.type==='meal'?delta:-delta,threshold=Math.min(130,height*.3);gestureOffset=Math.max(-threshold,Math.min(threshold,delta));const ratio=Math.max(0,Math.min(1,signed/threshold));$('gestureProgress').style.width=`${ratio*100}%`;
    text('gestureStatus',signed< -15?(pending.type==='meal'?'한 끼는 아래로 밀어 주세요 ↓':'운동은 위로 밀어 주세요 ↑'):ratio>=1?'손을 떼면 기록이 새겨져요.':`${Math.round(ratio*100)}% · ${pending.type==='meal'?'아래로 ↓':'위로 ↑'}`);
  }else{
    const count=rows().length;historyOffset=Math.max(0,Math.min(Math.max(0,count-1),startHistory+Math.round(-delta/50)));gestureOffset=delta%50;
    const item=rows().slice().reverse()[historyOffset];selectedId=item?.id||null;text('gestureStatus',item?`${item.at.slice(11)} · ${item.name} · ${item.amount}${unit(item)}`:'아직 기록이 없어요. 첫 순간을 남겨 보세요.');
  }
  draw();
});
function endPointer(event,cancel=false){
  if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);
  if(pinching){if(!pointers.size){pinching=false;gestureOffset=0;draw();}return;}
  const delta=event.clientY-startY;
  if(!cancel&&pending){const signed=pending.type==='meal'?delta:-delta;if(signed>=Math.min(130,height*.3)){stamp();}else{text('gestureStatus','아직 저장 전이에요. 끝까지 밀고 손을 떼어 주세요.');}}
  else if(!cancel&&!dragMoved&&!pending){const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left-originX)/scale,y=(event.clientY-r.top-originY)/scale;const hit=hitAreas.find(a=>Math.abs(x-a.x)<105&&Math.abs(y-a.y)<20);if(hit)openEditor(hit.entry.type,hit.entry);}
  gestureOffset=0;$('gestureProgress').style.width='0%';draw();
}
canvas.addEventListener('pointerup',event=>endPointer(event));canvas.addEventListener('pointercancel',event=>endPointer(event,true));
canvas.addEventListener('keydown',event=>{
  if(!['ArrowUp','ArrowDown','Enter',' '].includes(event.key))return;event.preventDefault();
  if(pending){if(event.key==='Enter'||event.key===' '||(pending.type==='meal'&&event.key==='ArrowDown')||(pending.type==='move'&&event.key==='ArrowUp'))stamp();else notify(pending.type==='meal'?'한 끼는 아래 방향키로 새겨요.':'움직임은 위 방향키로 새겨요.');}
  else if(event.key==='ArrowUp'||event.key==='ArrowDown'){const list=rows().slice().reverse();historyOffset=Math.max(0,Math.min(list.length-1,historyOffset+(event.key==='ArrowUp'?1:-1)));const item=list[historyOffset];selectedId=item?.id;render();if(item)text('gestureStatus',`${item.at.slice(11)} · ${item.name}`);}
  else{const item=doc().entries.find(x=>x.id===selectedId);if(item)openEditor(item.type,item);}
});
new ResizeObserver(resize).observe(canvas);
render();resize();
if(loaded.migrated)notify('이전 식사 기록을 가져왔어요. 식탁의 미확정 메모도 보관했어요.');
})();
