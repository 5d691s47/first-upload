/* Procedural chrome stair machine. Three.js is vendored locally under MIT. */
(() => {
'use strict';
const T=globalThis.THREE;
if(!T)return;
class ChromeMachine {
 constructor(canvas){
  this.canvas=canvas;this.width=0;this.height=0;this.steps=[];this.labels=new Map();this.pose=0;this.lastFrame=0;this.disposed=false;
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setClearColor(0x000000,1);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
  this.scene=new T.Scene();this.scene.background=new T.Color(0x000000);
  this.camera=new T.PerspectiveCamera(33,1,.1,100);this.target=new T.Vector3(0,2.18,-.48);
  this.machine=new T.Group();this.scene.add(this.machine);
  this.chrome=new T.MeshPhysicalMaterial({color:0xd5d9dd,metalness:1,roughness:.085,clearcoat:1,clearcoatRoughness:.035,envMapIntensity:1.15});
  this.darkChrome=new T.MeshPhysicalMaterial({color:0x686f77,metalness:1,roughness:.115,clearcoat:.8,clearcoatRoughness:.05,envMapIntensity:1.1});
  this.treadChrome=new T.MeshPhysicalMaterial({color:0x9fa7ae,metalness:1,roughness:.145,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1.05});
  this.black=new T.MeshPhysicalMaterial({color:0x020305,metalness:.65,roughness:.2,clearcoat:1,clearcoatRoughness:.05});
  this.makeEnvironment();this.makeMachine();this.makeBloom();
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;});
  canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;});
 }
 roundedBox(w,h,d,r=.035){
  r=Math.min(r,w/3,h/3,d/3);const s=new T.Shape(),x=-w/2+r,y=-h/2+r,W=w-2*r,H=h-2*r,R=r*.8;
  s.moveTo(x+R,y);s.lineTo(x+W-R,y);s.quadraticCurveTo(x+W,y,x+W,y+R);s.lineTo(x+W,y+H-R);s.quadraticCurveTo(x+W,y+H,x+W-R,y+H);s.lineTo(x+R,y+H);s.quadraticCurveTo(x,y+H,x,y+H-R);s.lineTo(x,y+R);s.quadraticCurveTo(x,y,x+R,y);
  const g=new T.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:4,steps:1,curveSegments:5});g.translate(0,0,-d/2+r);return g;
 }
 box(w,h,d,material,pos,parent=this.machine,r=.035){const mesh=new T.Mesh(this.roundedBox(w,h,d,r),material);mesh.position.set(...pos);parent.add(mesh);return mesh;}
 tube(points,radius=.055,parent=this.machine,material=this.chrome){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal');const mesh=new T.Mesh(new T.TubeGeometry(curve,100,radius,16,false),material);parent.add(mesh);
  const sphere=new T.SphereGeometry(radius,16,12);for(const p of [points[0],points.at(-1)]){const cap=new T.Mesh(sphere,material);cap.position.set(...p);parent.add(cap);}return mesh;
 }
 bar(from,to,radius=.045,material=this.chrome,parent=this.machine){const a=new T.Vector3(...from),b=new T.Vector3(...to),v=b.clone().sub(a);const m=new T.Mesh(new T.CylinderGeometry(radius,radius,v.length(),16),material);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());parent.add(m);return m;}
 makeEnvironment(){
  const room=new T.Scene();room.background=new T.Color(.008,.009,.01);
  const panel=(w,h,position,power)=>{const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(power,power,power),side:T.DoubleSide}));mesh.position.set(...position);mesh.lookAt(0,2,0);room.add(mesh);};
  panel(2.6,9,[-5,4,1],4.5);panel(1.3,9,[5,4,-.5],7);panel(8,3,[0,8,-1],3.5);panel(2,7,[-1,3,-6],5);panel(3,.7,[1,3,6],2.5);panel(.5,6,[3,2,-4],4);panel(5,3,[-3,6,-8],3);
  const pmrem=new T.PMREMGenerator(this.renderer);this.environmentTarget=pmrem.fromScene(room,.018,.1,40);this.scene.environment=this.environmentTarget.texture;pmrem.dispose();room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  const rim=new T.DirectionalLight(0xeaf3ff,.8);rim.position.set(-3,7,3);this.scene.add(rim);const edge=new T.DirectionalLight(0xffffff,1.1);edge.position.set(4,4,-4);this.scene.add(edge);
  this.errorLight=new T.PointLight(0xff3025,0,10);this.errorLight.position.set(-1,3,3);this.scene.add(this.errorLight);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;const c=glowCanvas.getContext('2d'),g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(205,220,230,.11)');g.addColorStop(.45,'rgba(125,145,160,.03)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,128,128);
  const floor=new T.Mesh(new T.PlaneGeometry(7,6),new T.MeshBasicMaterial({map:new T.CanvasTexture(glowCanvas),transparent:true,depthWrite:false,opacity:.7}));floor.rotation.x=-Math.PI/2;floor.position.set(0,.03,-.2);this.scene.add(floor);
 }
 makeMachine(){
  for(const side of [-1,1]){
   const x=side*1.42;
   this.tube([[x,2.91,-2.08],[x,2.52,-1.5],[x,1.76,-.35],[x,.8,1.06],[x,.36,1.66]],.132,this.machine,this.chrome);
   const shape=new T.Shape();shape.moveTo(-2.25,2.96);shape.lineTo(-2.25,2.62);shape.lineTo(1.65,.15);shape.quadraticCurveTo(1.92,.11,1.94,.4);shape.lineTo(-1.98,3.12);shape.quadraticCurveTo(-2.14,3.22,-2.25,2.96);
   const geometry=new T.ExtrudeGeometry(shape,{depth:.11,bevelEnabled:true,bevelSize:.045,bevelThickness:.045,bevelSegments:5,curveSegments:8});geometry.rotateY(-Math.PI/2);const body=new T.Mesh(geometry,this.darkChrome);body.position.x=x+.055;this.machine.add(body);
   this.tube([[x,.38,1.75],[x,1.05,1.72],[x,3.72,-1.85],[x,4.12,-2.2],[x,4.22,-2.55],[x,3.98,-2.8],[x,3.32,-2.77]],.082);
   this.tube([[x*1.008,.39,1.78],[x*1.008,1.14,1.13],[x*1.008,2.92,-1.73]],.028,this.machine,this.chrome);
  }
  this.box(2.98,.24,.42,this.chrome,[0,.23,1.67],this.machine,.07);
  this.box(2.75,.13,.39,this.black,[0,.08,1.66],this.machine,.035);
  this.box(2.84,.22,.4,this.darkChrome,[0,2.89,-2.14],this.machine,.06);
  for(const x of [-1.15,1.15])this.bar([x,.18,1.57],[x,.18,1.84],.065,this.black);
  this.bar([0,3.02,-1.97],[0,3.72,-2.45],.058);
  this.console=new T.Group();this.console.position.set(0,3.82,-2.4);this.console.rotation.x=-.29;this.machine.add(this.console);
  this.box(1.57,.7,.12,this.chrome,[0,0,0],this.console,.07);
  this.box(1.4,.55,.035,this.black,[0,.015,.075],this.console,.035);
  this.consoleCanvas=document.createElement('canvas');this.consoleCanvas.width=512;this.consoleCanvas.height=192;this.consoleTexture=new T.CanvasTexture(this.consoleCanvas);this.consoleTexture.colorSpace=T.SRGBColorSpace;
  const screen=new T.Mesh(new T.PlaneGeometry(1.28,.44),new T.MeshBasicMaterial({map:this.consoleTexture,transparent:true,toneMapped:false}));screen.position.set(0,.02,.099);this.console.add(screen);
  const button=new T.Mesh(new T.CylinderGeometry(.073,.073,.025,32),this.darkChrome);button.rotation.x=Math.PI/2;button.position.set(.62,-.245,.108);this.console.add(button);
  this.buttonGroup=new T.Group();this.buttonGroup.position.copy(button.position);this.console.add(this.buttonGroup);
  const arrowCanvas=document.createElement('canvas');arrowCanvas.width=arrowCanvas.height=64;const ac=arrowCanvas.getContext('2d');ac.fillStyle='#dce4eb';ac.font='32px sans-serif';ac.textAlign='center';ac.fillText('↑',32,44);const arrow=new T.Mesh(new T.PlaneGeometry(.105,.105),new T.MeshBasicMaterial({map:new T.CanvasTexture(arrowCanvas),transparent:true,depthWrite:false}));arrow.position.z=.016;this.buttonGroup.add(arrow);
  const treadGeo=this.roundedBox(2.61,.24,.465,.038),topGeo=this.roundedBox(2.57,.055,.435,.016);
  const ribGeo=new T.BoxGeometry(.005,.002,.31),noseGeo=new T.CylinderGeometry(.019,.019,2.52,12);noseGeo.rotateZ(Math.PI/2);
  for(let i=0;i<10;i++){
   const group=new T.Group(),body=new T.Mesh(treadGeo,this.darkChrome),top=new T.Mesh(topGeo,this.treadChrome),nose=new T.Mesh(noseGeo,this.chrome);top.position.y=.125;nose.position.set(0,.13,.219);group.add(body,top,nose);
   const ribs=new T.InstancedMesh(ribGeo,this.darkChrome,12);const matrix=new T.Matrix4();for(let k=0;k<12;k++){matrix.makeTranslation(-1.15+k*.209,.156,0);ribs.setMatrixAt(k,matrix);}group.add(ribs);
   // Recorded treads have a high-contrast inset nameplate; empty chrome stays unmarked.
   const surfaceCanvas=document.createElement('canvas');surfaceCanvas.width=1024;surfaceCanvas.height=128;const texture=new T.CanvasTexture(surfaceCanvas);texture.colorSpace=T.SRGBColorSpace;
   const writing=new T.Mesh(new T.PlaneGeometry(2.15,.24),new T.MeshBasicMaterial({map:texture,transparent:true,opacity:.55,depthWrite:false,toneMapped:false}));writing.position.set(0,0,.248);group.add(writing);
   this.machine.add(group);this.steps.push({group,canvas:surfaceCanvas,texture,writing,key:''});
  }
  const boltGeo=new T.SphereGeometry(.028,12,8);for(const x of [-1.3,1.3]){const b=new T.Mesh(boltGeo,this.chrome);b.scale.z=.35;b.position.set(x,.27,1.89);this.machine.add(b);}
  this.pendingGroup=new T.Group();this.machine.add(this.pendingGroup);this.box(1.28,.025,.34,this.chrome,[0,0,0],this.pendingGroup,.007);
  this.pendingCanvas=document.createElement('canvas');this.pendingCanvas.width=512;this.pendingCanvas.height=128;this.pendingTexture=new T.CanvasTexture(this.pendingCanvas);this.pendingTexture.colorSpace=T.SRGBColorSpace;
  const p=new T.Mesh(new T.PlaneGeometry(1.15,.27),new T.MeshBasicMaterial({map:this.pendingTexture,transparent:true,depthWrite:false,toneMapped:false}));p.rotation.x=-Math.PI/2;p.position.y=.02;this.pendingGroup.add(p);this.pendingGroup.visible=false;
 }
 makeBloom(){
  const renderer=this.renderer;if(!renderer.capabilities.isWebGL2){this.bloom=false;return;}
  this.bloom=true;const options={type:T.HalfFloatType,format:T.RGBAFormat,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true};
  this.beauty=new T.WebGLRenderTarget(1,1,options);this.beauty.samples=4;this.blurA=new T.WebGLRenderTarget(1,1,{...options,depthBuffer:false});this.blurB=this.blurA.clone();
  this.postScene=new T.Scene();this.postCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);this.quad=new T.Mesh(new T.PlaneGeometry(2,2));this.postScene.add(this.quad);
  const vertex='varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}';
  this.blurMaterial=new T.ShaderMaterial({uniforms:{image:{value:null},stepSize:{value:new T.Vector2()},threshold:{value:1}},vertexShader:vertex,fragmentShader:`varying vec2 uv0;uniform sampler2D image;uniform vec2 stepSize;uniform float threshold;vec3 read(vec2 p){vec3 c=texture2D(image,p).rgb;return threshold>.5?max(c-vec3(1.25),vec3(0.)):c;}void main(){vec3 c=read(uv0)*.227027;c+=read(uv0+stepSize*1.384615)*.316216;c+=read(uv0-stepSize*1.384615)*.316216;c+=read(uv0+stepSize*3.230769)*.070270;c+=read(uv0-stepSize*3.230769)*.070270;gl_FragColor=vec4(c,1.);}`,depthTest:false,depthWrite:false,toneMapped:false});
  this.finalMaterial=new T.ShaderMaterial({uniforms:{image:{value:null},glow:{value:null},pixel:{value:new T.Vector2()}},vertexShader:vertex,fragmentShader:`varying vec2 uv0;uniform sampler2D image;uniform sampler2D glow;uniform vec2 pixel;vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}void main(){vec3 base=texture2D(image,uv0).rgb;vec3 g=texture2D(glow,uv0).rgb;g.r=texture2D(glow,uv0+pixel*.25).r;g.b=texture2D(glow,uv0-pixel*.25).b;vec3 c=aces(base+g*.17);c=mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));gl_FragColor=vec4(c,1.);}`,depthTest:false,depthWrite:false,toneMapped:false});
 }
 resize(width,height){
  if(this.width===width&&this.height===height)return;this.width=width;this.height=height;const dpr=Math.min(devicePixelRatio||1,width<700?1.65:1.5);this.renderer.setPixelRatio(dpr);this.renderer.setSize(width,height,false);this.camera.aspect=width/height;
  const direction=(width<700?new T.Vector3(3.1,3.8,10):new T.Vector3(5.3,3.7,8.7)).normalize();let distance=12;
  const corners=[];for(const x of [-1.65,1.65])for(const y of [0,4.35])for(const z of [-2.95,1.95])corners.push(new T.Vector3(x,y,z));
  for(let i=0;i<5;i++){
   this.camera.position.copy(this.target).addScaledVector(direction,distance);this.camera.lookAt(this.target);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
   const values=corners.map(p=>p.clone().project(this.camera));const spanX=Math.max(...values.map(v=>Math.abs(v.x))),spanY=Math.max(...values.map(v=>Math.abs(v.y)));
   const required=Math.max(spanX/.88,spanY/.84);if(Math.abs(required-1)<.01)break;distance*=required;
  }
  if(this.bloom){const w=Math.floor(width*dpr),h=Math.floor(height*dpr);this.beauty.setSize(w,h);this.blurA.setSize(Math.max(1,w>>1),Math.max(1,h>>1));this.blurB.setSize(Math.max(1,w>>1),Math.max(1,h>>1));this.finalMaterial.uniforms.pixel.value.set(1/w,1/h);}
 }
 project(point,group=this.machine){const v=new T.Vector3(...point);group.localToWorld(v);v.project(this.camera);return [(v.x+1)*this.width/2,(1-v.y)*this.height/2];}
 render(state){
  if(this.lost)return {areas:[],zones:[]};this.resize(state.width,state.height);this.errorLight.intensity=state.error?18:0;
  const now=performance.now();if(state.idle&&!state.reduceMotion)this.pose=Math.sin(now*.00016)*.027;this.machine.rotation.y=this.pose;
  const entries=state.entries,list=[null,...entries.slice().reverse()],cycleLength=Math.max(12,list.length+4),base=Math.floor(state.position),fraction=state.position-base;const areas=[];
  const meter=state.calorieMeter||{consumed:0,limit:null,label:'0 / —'},consoleKey=meter.label+'/'+state.date+'/'+Boolean(state.error);
  if(this.consoleKey!==consoleKey){
   this.consoleKey=consoleKey;const c=this.consoleCanvas.getContext('2d');c.clearRect(0,0,512,192);c.fillStyle=state.error?'#ff8e82':'#e5f0f8';c.textAlign='center';
   let size=52;c.font=size+'px monospace';while(c.measureText(meter.label).width>460&&size>25){size--;c.font=size+'px monospace';}c.fillText(meter.label,256,99);
   c.fillStyle='#91a6b7';c.font='15px monospace';c.fillText(state.error?'ERROR / NET KCAL':'NET KCAL / '+(state.date||'').slice(5).replace('-','.')+(meter.limit==null?' · SET LIMIT':''),256,143);
   c.fillStyle='#26323c';c.fillRect(55,166,402,2);if(meter.limit!=null){c.fillStyle=state.error?'#ff8275':'#cadce9';c.fillRect(55,166,402*Math.min(1,(meter.net??meter.consumed)/meter.limit),2);}this.consoleTexture.needsUpdate=true;
  }
  for(let k=0;k<this.steps.length;k++){
   const slot=this.steps[k],i=k-1,z=i-fraction+state.animation/43,recordIndex=(((base+i)%cycleLength)+cycleLength)%cycleLength,item=list[recordIndex];slot.group.visible=z>-.65&&z<7.65;if(!slot.group.visible)continue;
   const edge=Math.max(0,Math.min(1,(z+.65)/.65,(7.65-z)/.65));slot.group.scale.set(1,edge,edge);slot.group.rotation.x=z<0?Math.min(.85,-z*1.2):z>7?-Math.min(.85,(z-7)*1.2):0;
   const x=item?.id===state.extractedId?state.extractX/(this.width<700?90:155):0;
   slot.group.position.set(x,2.94-z*.305,-1.86+z*.43);
   const active=item?.id===state.selectedId;
   const key=item?`${item.id}:${item.name}:${item.at}:${active}:${state.flash>.3}`:`empty:${base+i}`;
   if(key!==slot.key){
    slot.key=key;const c=slot.canvas.getContext('2d');c.clearRect(0,0,1024,128);
    if(item){
     c.fillStyle='#030608';c.beginPath();c.roundRect(14,10,996,108,13);c.fill();
     c.strokeStyle=active?'#c7dfef':'#5e748578';c.lineWidth=active?4:2;c.stroke();
     c.fillStyle='#e8f6ff';c.beginPath();c.arc(65,64,7,0,Math.PI*2);c.fill();
     c.font='54px "Malgun Gothic","Apple SD Gothic Neo",sans-serif';c.textAlign='left';c.textBaseline='middle';
     const name=Array.from(item.name);c.fillText(name.length>10?name.slice(0,10).join('')+'…':item.name,108,66,780);
     c.font='43px sans-serif';c.textAlign='right';c.fillStyle='#aabfcd';c.fillText(item.type==='meal'?'↓':'↑',962,65);
    }else if(recordIndex===0){c.fillStyle='#e8f6ff';c.font='65px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('+',512,67);}
    slot.texture.needsUpdate=true;
   }
   slot.writing.material.opacity=item?1:.55;
   areas.push({group:slot.group,entry:item||null,index:base+i});
  }
  this.pendingGroup.visible=Boolean(state.pending);
  if(state.pending){this.pendingGroup.position.set(0,3.2+state.gesture*.0024,-1.55+state.gesture*.001);const key=state.pending.id;if(this.pendingKey!==key){this.pendingKey=key;const c=this.pendingCanvas.getContext('2d');c.clearRect(0,0,512,128);c.fillStyle='#f3f8fc';c.font='34px sans-serif';c.textAlign='center';c.fillText((state.pending.type==='meal'?'↓ ':'↑ ')+state.pending.name.slice(0,12),256,83);this.pendingTexture.needsUpdate=true;}}
  this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
  const projected=areas.map(a=>{const center=this.project([0,.165,0],a.group),next=this.project([0,.165-.305,.43],a.group);return {entry:a.entry,index:a.index,pitch:Math.max(18,Math.abs(next[1]-center[1])),points:[[-1.31,.165,-.222],[1.31,.165,-.222],[1.31,.165,.222],[-1.31,.165,.222]].map(p=>this.project(p,a.group)),frontPoints:[[-1.31,.12,.25],[1.31,.12,.25],[1.31,-.12,.25],[-1.31,-.12,.25]].map(p=>this.project(p,a.group))};});
  const zones=[{kind:'move',points:[[-.11,-.11,.025],[.11,-.11,.025],[.11,.11,.025],[-.11,.11,.025]].map(p=>this.project(p,this.buttonGroup))},{kind:'limit',points:[[-.69,-.2,.11],[.69,-.2,.11],[.69,.25,.11],[-.69,.25,.11]].map(p=>this.project(p,this.console))}];
  if(this.bloom){
   this.renderer.setRenderTarget(this.beauty);this.renderer.render(this.scene,this.camera);
   this.quad.material=this.blurMaterial;this.blurMaterial.uniforms.image.value=this.beauty.texture;this.blurMaterial.uniforms.stepSize.value.set(2/this.blurA.width,0);this.blurMaterial.uniforms.threshold.value=1;this.renderer.setRenderTarget(this.blurA);this.renderer.render(this.postScene,this.postCamera);
   this.blurMaterial.uniforms.image.value=this.blurA.texture;this.blurMaterial.uniforms.stepSize.value.set(0,2/this.blurA.height);this.blurMaterial.uniforms.threshold.value=0;this.renderer.setRenderTarget(this.blurB);this.renderer.render(this.postScene,this.postCamera);
   this.quad.material=this.finalMaterial;this.finalMaterial.uniforms.image.value=this.beauty.texture;this.finalMaterial.uniforms.glow.value=this.blurB.texture;this.renderer.setRenderTarget(null);this.renderer.render(this.postScene,this.postCamera);
  }else{this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.camera);}
  return {areas:projected,zones};
 }
}
globalThis.ChromeMachine=ChromeMachine;
})();
