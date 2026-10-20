// 첫 화면: 음식 메모 → 식탁 → 쿼카에게 먹이기 → 브라우저에 기록 보관.
const $ = id => document.getElementById(id);
const today = new Date();
const dayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
$('date').textContent = today.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'});
let state;
try { state = JSON.parse(localStorage.getItem('quokka-diary-v1')); } catch (_) {}
if (!state || !Array.isArray(state.pending) || !Array.isArray(state.entries)) state = {pending:[],entries:[]};
let selection='🍙', drag=null, chewUntil=0, petUntil=0, toastTimer;
const canvas=$('quokka'), ctx=canvas.getContext('2d');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function entries(){return state.entries.filter(e=>e.day===dayKey)}
function total(){return entries().reduce((n,e)=>n+Number(e.kcal||0),0)}
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200)}
function save(){try{localStorage.setItem('quokka-diary-v1',JSON.stringify(state))}catch(_){notify('이 브라우저에서는 기록을 보관할 수 없어요. 현재 화면에서만 유지돼요.')}}
function render(){
 $('total').textContent=total().toLocaleString();$('count').textContent=entries().length;
 const list=$('foods');list.replaceChildren();
 if(!state.pending.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='아직 식탁이 비어 있어요.\n첫 번째 한 입을 놓아 볼까요?';list.append(empty)}
 state.pending.forEach(food=>{const card=document.createElement('button');card.className='food';card.type='button';card.setAttribute('aria-label',`${food.name}, ${food.kcal} kcal. 드래그하거나 눌러서 먹이기`);const icon=document.createElement('span');icon.className='icon';icon.textContent=food.icon;const name=document.createElement('strong');name.textContent=food.name;const kcal=document.createElement('small');kcal.textContent=`${food.kcal} kcal`;card.append(icon,name,kcal);card.addEventListener('pointerdown',e=>startDrag(e,food,card));card.addEventListener('click',e=>{if(e.detail===0)feed(food)});const wrap=document.createElement("div");wrap.className="food-wrap";const edit=document.createElement("button");edit.type="button";edit.className="edit-food";edit.textContent="수정하기";edit.onclick=()=>openEditor(food,"pending");wrap.append(card,edit);list.append(wrap)});
}
function feed(food){if(!state.pending.some(f=>f.id===food.id))return;state.pending=state.pending.filter(f=>f.id!==food.id);state.entries.push({...food,day:dayKey,eatenAt:new Date().toISOString()});chewUntil=performance.now()+1700;$('bubble').textContent=food.feeling?`“${food.feeling}”`:'냠냠, 오늘의 한 입을 기억할게!';save();render();notify(`${food.name}, 오늘의 기억에 담았어요`)}
function startDrag(e,food,card){if(e.button!==0)return;e.preventDefault();card.setPointerCapture(e.pointerId);const ghost=document.createElement('div');ghost.className='ghost';ghost.textContent=food.icon;document.body.append(ghost);drag={food,card,ghost,id:e.pointerId,x:e.clientX,y:e.clientY};card.classList.add('dragging');moveDrag(e);card.onpointermove=moveDrag;card.onpointerup=endDrag;card.onpointercancel=()=>finishDrag(false)}
function nearMouth(x,y){const r=canvas.getBoundingClientRect();const s=Math.min(r.width/500,r.height/365);return Math.hypot(x-(r.left+r.width/2),y-(r.top+168*s))<58*s}
function moveDrag(e){if(!drag)return;drag.x=e.clientX;drag.y=e.clientY;drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px'}
function endDrag(e){if(drag)finishDrag(nearMouth(e.clientX,e.clientY))}
function finishDrag(accepted){if(!drag)return;const {food,card,ghost}=drag;drag=null;ghost.remove();card.classList.remove('dragging');card.onpointermove=null;card.onpointerup=null;card.onpointercancel=null;if(accepted)feed(food);else notify('입 가까이 가져와서 놓아 주세요')}
$('newFood').onclick=()=>$('editor').showModal();$('cancel').onclick=()=>$('editor').close();
['🍙','🥗','🍞','🍎','🍜','🍰','🍚','🍗','🥩','🍕','🍔','🍣','☕','🥛','🍽️'].forEach(icon=>{const b=document.createElement('button');b.type='button';b.className='choice';b.textContent=icon;b.setAttribute('aria-label',icon);b.setAttribute('aria-pressed',icon===selection);b.onclick=()=>{selection=icon;for(const el of $('choices').children)el.setAttribute('aria-pressed',el===b)};$('choices').append(b)});
canvas.addEventListener('pointerdown',e=>{petUntil=performance.now()+1200;canvas.setPointerCapture(e.pointerId);$('bubble').textContent=`오늘 ${entries().length}번의 한 입, ${total()} kcal의 기억!`});
canvas.addEventListener('pointermove',e=>{if(e.buttons)petUntil=performance.now()+500});
// 고정 시드의 연필 입자: 매 프레임 생성하지 않고 한 번 그려 보관한다.
let seed=76;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function ellipse(c,x,y,w,h,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,w/2,h/2,0,0,Math.PI*2);c.fill()}
const fur=document.createElement('canvas');fur.width=500;fur.height=365;const f=fur.getContext('2d');
ellipse(f,190,64,62,69,'#997149');ellipse(f,310,64,62,69,'#997149');ellipse(f,190,64,36,45,'#c29a6b');ellipse(f,310,64,36,45,'#c29a6b');ellipse(f,206,324,74,29,'#9d744c');ellipse(f,294,324,74,29,'#9d744c');ellipse(f,250,251,209,171,'#c19a64');ellipse(f,250,144,231,185,'#caa36d');ellipse(f,161,174,59,76,'#caa36d');ellipse(f,339,174,59,76,'#caa36d');ellipse(f,250,265,138,115,'#d9bd8a');ellipse(f,174,242,53,83,'#b98e5d');ellipse(f,326,242,53,83,'#b98e5d');
f.save();f.globalCompositeOperation='source-atop';for(let i=0;i<60000;i++){const x=rnd()*500,y=rnd()*365;f.strokeStyle=rnd()>.48?'rgba(255,248,214,.28)':'rgba(105,73,43,.16)';f.lineWidth=.4+rnd()*.9;f.beginPath();f.moveTo(x,y);f.lineTo(x+1+rnd()*3,y-1-rnd()*2);f.stroke()}f.restore();
// 淡い色鉛筆のほっぺ。
for(let i=0;i<2300;i++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd());f.fillStyle='rgba(207,117,99,.07)';for(const x of [185,315]){f.fillRect(x+Math.cos(a)*23*r,170+Math.sin(a)*15*r,1.4,1.4)}}
let width=0,height=0;function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);width=r.width;height=r.height;canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}new ResizeObserver(resize).observe(canvas);
function frame(t){ctx.clearRect(0,0,width,height);const s=Math.min(width/500,height/365),fed=Math.min(total()/1000,1),pet=t<petUntil,chew=t<chewUntil,open=drag&&nearMouth(drag.x,drag.y);ctx.save();ctx.translate(width/2,height-365*s);ctx.scale(s,s);
 ellipse(ctx,0,338,265,20,'#dce0c8');ctx.save();const bounce=reduceMotion?0:Math.sin(t/1100)*1.6;ctx.translate(0,bounce+(pet?5:0));ctx.scale(pet?1.035:1,pet?.975:1);ctx.drawImage(fur,-250,0);
 // 目と口だけを動かし、基本の表情は記録量に応じて少しずつ変える。
 const blink=!reduceMotion&&(t%4800>4630),eyeH=blink?2:14-fed*4;let look=drag?Math.max(-3,Math.min(3,(drag.x-innerWidth/2)/80)):0;
 ellipse(ctx,-43+look,133,12,eyeH,'#493e2e');ellipse(ctx,43+look,133,12,eyeH,'#493e2e');
 ctx.strokeStyle='#6f5639';ctx.lineWidth=2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-53,116-fed*2);ctx.quadraticCurveTo(-45,111-fed*3,-36,114);ctx.moveTo(36,114);ctx.quadraticCurveTo(45,111-fed*3,53,116-fed*2);ctx.stroke();
 ellipse(ctx,0,155,24,17,'#58432e');ctx.strokeStyle='#58432e';ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(0,161);ctx.lineTo(0,171);ctx.stroke();
 if(open||chew){ellipse(ctx,0,178,open?31:22,open?29:13+Math.sin(t/75)*4,'#75513a');ellipse(ctx,0,184,15,7,'#ca9280')}else{ctx.beginPath();ctx.moveTo(-24,171);ctx.quadraticCurveTo(-14,187+fed*3,0,173);ctx.quadraticCurveTo(14,187+fed*3,24,171);ctx.stroke()}
 // 小さな葉っぱを抱く。
 ctx.save();ctx.translate(-6,247);ctx.rotate(-.35);ellipse(ctx,0,0,34,63,'#7f925a');ctx.strokeStyle='#c0ca91';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,32);ctx.lineTo(0,-24);ctx.moveTo(0,7);ctx.lineTo(-10,-4);ctx.moveTo(0,-2);ctx.lineTo(11,-14);ctx.stroke();ctx.restore();
 if(pet){ctx.fillStyle='#81915e';ctx.font='20px serif';ctx.fillText('♡',76,82);ctx.fillText('♡',-89,101)}ctx.restore();
 ctx.fillStyle='#9ba17e';ctx.font='14px serif';ctx.fillText('✳',-151,300);ctx.fillText('✳',137,320);ctx.restore();requestAnimationFrame(frame)}
render();requestAnimationFrame(frame);

// 同じドキュメント内の画面切替で file:// でもホームと記録の保存領域を共有する。
let selectedDate=dayKey;
function showRecords(){
 const isArchive=location.hash==='#records';
 document.querySelector('.layout').hidden=isArchive;
 $('recordsPage').hidden=!isArchive;
 document.querySelector('.archive-link').setAttribute('aria-current',isArchive?'page':'false');
 document.title=isArchive?'기록 모아보기 · 한 입의 기억':'한 입의 기억 · quokka diary';
 if(isArchive){renderRecords();$('recordsTitle').focus({preventScroll:true})}
 window.scrollTo(0,0);
}
function dateLabel(key,options){const [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('ko-KR',options)}
function renderRecords(){
 $('recordDate').value=selectedDate;
 const days=[...new Set([dayKey,...state.entries.map(e=>e.day)])].sort().reverse();
 const dates=$('dateList');dates.replaceChildren();
 for(const day of days){const button=document.createElement('button');button.type='button';button.className='date-item';button.setAttribute('aria-pressed',day===selectedDate);const label=document.createElement('span');label.textContent=(day===dayKey?'오늘 · ':'')+dateLabel(day,{month:'long',day:'numeric'});const count=document.createElement('small');count.textContent=state.entries.filter(e=>e.day===day).length+'개의 기억';button.append(label,count);button.onclick=()=>{selectedDate=day;renderRecords()};dates.append(button)}
 const records=state.entries.filter(e=>e.day===selectedDate).sort((a,b)=>(a.eatenAt||'').localeCompare(b.eatenAt||''));
 $('selectedDay').textContent=dateLabel(selectedDate,{year:'numeric',month:'long',day:'numeric',weekday:'short'});
 $('recordTotal').textContent=records.reduce((n,e)=>n+Number(e.kcal||0),0).toLocaleString();$('recordCount').textContent=records.length;
 const list=$('recordList');list.replaceChildren();
 if(!records.length){const box=document.createElement('div');box.className='archive-empty';const leaf=document.createElement('span');leaf.textContent='❧';const message=document.createElement('div');message.textContent='아직 담긴 한 입이 없어요. 쿼카에게 음식을 먹이면 이곳에 기억이 남아요.';const link=document.createElement('a');link.href='#home';link.textContent='첫 번째 한 입 남기러 가기 →';box.append(leaf,message,link);list.append(box)}
 for(const food of records){const item=document.createElement('article');item.className='record-item';const icon=document.createElement('span');icon.className='record-icon';icon.textContent=food.icon;const content=document.createElement('div');content.className='record-content';const line=document.createElement('div');line.className='record-line';const name=document.createElement('h4');name.textContent=food.name;const kcal=document.createElement('span');kcal.textContent=Number(food.kcal).toLocaleString()+' kcal';line.append(name,kcal);content.append(line);const note=document.createElement('p');note.textContent=food.feeling||'말없이 남겨 둔, 작은 한 입.';content.append(note);const time=document.createElement('time');const eaten=new Date(food.eatenAt);if(!Number.isNaN(eaten.getTime())){time.dateTime=food.eatenAt;time.textContent=eaten.toLocaleTimeString('ko-KR',{hour:'numeric',minute:'2-digit'});content.append(time)}const edit=document.createElement("button");edit.type="button";edit.className="record-edit";edit.textContent="수정";edit.setAttribute("aria-label",food.name+" 기록 수정");edit.onclick=()=>openEditor(food,"entries");content.append(edit);item.append(icon,content);list.append(item)}
}
$('recordDate').addEventListener('change',e=>{if(e.target.value){selectedDate=e.target.value;renderRecords()}});
$('bubble').addEventListener('click',()=>{selectedDate=dayKey;location.hash='records'});
window.addEventListener('hashchange',showRecords);
window.addEventListener('pageshow',()=>{if(location.hash==='#records')renderRecords()});
showRecords();


let editing=null, analysisDraft=null, imageData=null, analysisController=null, imageVersion=0;
function setIcon(icon){selection=icon;for(const b of $('choices').children)b.setAttribute('aria-pressed',b.textContent===icon)}
function openEditor(food=null,collection=null){
 editing=food&&collection?{id:food.id,collection}:null;analysisDraft=food?.analysis||null;
 $('foodForm').reset();setIcon(food?.icon||'🍙');$('foodName').value=food?.name||'';$('calories').value=food?.kcal??'';$('feeling').value=food?.feeling||'';
 $('editorHint').textContent=analysisDraft?`AI 추정: ${analysisDraft.originalName} · ${analysisDraft.originalKcal} kcal. ${analysisDraft.assumption} 음식명·칼로리·아이콘을 확인하고 수정해 주세요.`:'이름과 칼로리, 아이콘을 자유롭게 수정해 주세요.';
 $('foodForm').querySelector('button[type="submit"]').textContent=editing?'수정 내용 저장':'확인하고 식탁에 놓기';$('editor').showModal();
}
$('foodForm').onsubmit=e=>{e.preventDefault();const name=$('foodName').value.trim(),kcal=Number($('calories').value);if(!name||!Number.isFinite(kcal)||kcal<0||kcal>10000)return;const values={name,kcal,icon:selection,feeling:$('feeling').value.trim(),analysis:analysisDraft};
 if(editing){const target=state[editing.collection].find(f=>f.id===editing.id);if(target)Object.assign(target,values)}else state.pending.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),...values});
 save();render();if(location.hash==='#records')renderRecords();$('editor').close();notify(editing?'수정한 내용으로 기록을 업데이트했어요':'식탁에 놓았어요. 쿼카에게 먹여 주세요!');editing=null;analysisDraft=null;
};
function syncAnalyze(){ $('analyzePhoto').disabled=!imageData||!$('photoConsent').checked||!!analysisController; }
function closeScanner(){imageVersion++;analysisController?.abort();analysisController=null;imageData=null;$('scanner').close();$('photoPreview').removeAttribute('src');$('photoPreview').hidden=true;syncAnalyze()}
$('scanFood').onclick=()=>{imageData=null;$('photoConsent').checked=false;$('cameraFile').value='';$('galleryFile').value='';$('photoPreview').hidden=true;$('photoPlaceholder').hidden=false;$('analysisStatus').textContent='사진을 고르면 분석을 시작할 수 있어요.';syncAnalyze();$('scanner').showModal()};
$('closeScan').onclick=closeScanner;$('scanner').addEventListener('cancel',e=>{e.preventDefault();closeScanner()});$('skipScan').onclick=()=>{closeScanner();openEditor()};$('photoConsent').onchange=syncAnalyze;
async function choosePhoto(e){const file=e.target.files[0];if(!file)return;const version=++imageVersion;analysisController?.abort();analysisController=null;imageData=null;syncAnalyze();if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024){$('analysisStatus').textContent='12MB 이하의 JPG·PNG·WebP 사진을 선택해 주세요.';return}
 const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();if(version!==imageVersion)return;const scale=Math.min(1,1280/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);imageData=c.toDataURL('image/jpeg',.82);$('photoPreview').src=imageData;$('photoPreview').hidden=false;$('photoPlaceholder').hidden=true;$('analysisStatus').textContent='사진이 준비됐어요. 분석 후 결과를 직접 수정할 수 있어요.'}catch(_){$('analysisStatus').textContent='사진을 읽지 못했어요. 다른 사진을 선택해 주세요.'}finally{URL.revokeObjectURL(url);syncAnalyze()}}
$('cameraFile').onchange=choosePhoto;$('galleryFile').onchange=choosePhoto;
$('analyzePhoto').onclick=async()=>{if(!imageData||!$('photoConsent').checked||analysisController)return;if(location.protocol==='file:'){$('analysisStatus').textContent='현재 파일 미리보기에서는 AI 서버가 연결되지 않아요. 서버로 실행한 뒤 분석하거나, 직접 입력해 주세요.';return}
 const controller=new AbortController();analysisController=controller;const version=imageVersion;syncAnalyze();$('analysisStatus').textContent='음식과 대략적인 양을 살펴보고 있어요…';const timeout=setTimeout(()=>controller.abort(),45000);
 try{const response=await fetch('/api/analyze-food',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:imageData}),signal:controller.signal});const result=await response.json();if(!response.ok)throw new Error(result.error||'분석하지 못했어요. 잠시 후 다시 시도해 주세요.');if(version!==imageVersion)return;if(!result.food)throw new Error('음식을 찾지 못했어요. 음식을 가까이 찍거나 직접 입력해 주세요.');closeScanner();openEditor({name:result.food.name,kcal:result.food.kcal,icon:result.food.icon,analysis:{originalName:result.food.name,originalKcal:result.food.kcal,assumption:result.food.assumption}},null)}catch(error){if(version===imageVersion)$('analysisStatus').textContent=error.name==='AbortError'?'분석 시간이 길어졌어요. 다시 시도하거나 직접 입력해 주세요.':error.message}finally{clearTimeout(timeout);if(analysisController===controller)analysisController=null;syncAnalyze()}
};
$('newFood').onclick=()=>openEditor();

