/* A chrome tread crumbles into shards and settling silver powder while sliding out. */
(() => {
'use strict';
class SparkEffects {
 constructor(canvas,{reducedMotion=false,onImpact=null}={}){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.reducedMotion=reducedMotion;this.onImpact=onImpact;this.particles=[];this.powder=[];this.chips=[];this.mists=[];this.glows=[];this.drops=[];this.frame=0;this.last=0;this.lastScrape=-Infinity;this.lastCrumble=-Infinity;this.width=0;this.height=0;}
 resize(width,height){if(this.width===width&&this.height===height)return;this.width=width;this.height=height;const dpr=Math.min(devicePixelRatio||1,1.75);this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);}
 // Scraping keeps its sound, while visible sparks are reserved for the downward fall.
 scrape(){const now=performance.now();if(now-this.lastScrape<28)return false;this.lastScrape=now;return true;}
 drop(start,floor,duration=.6){if(this.reducedMotion)return;this.drops.push({start,floor,duration,age:0,lastEmit:0,landed:false});if(this.drops.length>3)this.drops.shift();this.run();}
 shatter(start,floor,duration=.6,direction=1){if(this.reducedMotion)return;this.drops.push({start,floor,duration,age:0,lastEmit:0,landed:false,shatter:true,direction:direction>=0?1:-1});if(this.drops.length>3)this.drops.shift();this.run();}
 crumble(point,direction=1,strength=.5){
  if(this.reducedMotion)return false;const now=performance.now();if(now-this.lastCrumble<24)return false;this.lastCrumble=now;direction=direction>=0?1:-1;const floor=Math.min(this.height-70,point.y+Math.max(85,this.height*.18)),count=2+Math.ceil(strength*4);
  for(let i=0;i<count;i++){const life=.32+Math.random()*.38;this.powder.push({x:point.x+(Math.random()-.5)*9,y:point.y+(Math.random()-.5)*6,floor,vx:direction*(18+Math.random()*70)+(Math.random()-.5)*25,vy:15+Math.random()*65,life,maxLife:life,size:.4+Math.random()*1.15,shade:Math.random(),settled:false});}
  if(strength>.35&&Math.random()<.56)this.emitChip(point,direction,floor,.45+strength*.45);this.run();return true;
 }
 burst(point){if(this.reducedMotion)return;this.emit(point,34,true);this.glows.push({x:point.x,y:point.y,age:0,life:.13,radius:24});this.run();}
 emit(point,count,impact=false){
  for(let i=0;i<count;i++){const life=impact ? .18+Math.random()*.24 : .24+Math.random()*.35;this.particles.push({x:point.x+(Math.random()-.5)*(impact?22:8),y:point.y,vx:(Math.random()-.5)*(impact?310:95),vy:impact?-35-Math.random()*100:90+Math.random()*160,life,maxLife:life,size:.65+Math.random()*1.05,floor:point.floor??null,bounced:false});}
  const max=this.width<700?100:160;if(this.particles.length>max)this.particles.splice(0,this.particles.length-max);
 }
 emitChip(point,direction,floor,energy=1){const life=.42+Math.random()*.42;this.chips.push({x:point.x+(Math.random()-.5)*10,y:point.y,vx:direction*(45+Math.random()*145)*energy,vy:-15+Math.random()*90,rotation:Math.random()*Math.PI,spin:(Math.random()-.5)*12,size:2.2+Math.random()*4.2,life,maxLife:life,floor,shade:Math.random(),bounced:false});const max=this.width<700?38:58;if(this.chips.length>max)this.chips.splice(0,this.chips.length-max);}
 emitPowder(point){
  const spread=Math.min(this.width<700?108:220,this.width*.27),count=this.width<700?165:260;
  for(let i=0;i<count;i++){
   const offset=(Math.random()-.5)*spread,life=.72+Math.random()*.8,size=.45+Math.random()*1.7;
   this.powder.push({x:point.x+offset,y:point.y-3-Math.random()*7,floor:point.y+Math.random()*2,vx:offset*.75+(Math.random()-.5)*125,vy:-25-Math.random()*115,life,maxLife:life,size,shade:Math.random(),settled:false});
  }
  const max=this.width<700?380:620;if(this.powder.length>max)this.powder.splice(0,this.powder.length-max);
  for(let i=0;i<4;i++)this.mists.push({x:point.x+(i-1.5)*spread*.2,y:point.y-3,age:-i*.035,life:.48+i*.065,radius:spread*(.33+i*.045)});
  if(this.mists.length>12)this.mists.splice(0,this.mists.length-12);
 }
 run(){if(!this.frame){this.last=performance.now();this.frame=requestAnimationFrame(now=>this.tick(now));}}
 tick(now){
  const dt=Math.min(.04,Math.max(.001,(now-this.last)/1000));this.last=now;const c=this.ctx;c.clearRect(0,0,this.width,this.height);c.save();c.globalCompositeOperation='lighter';
  for(const d of this.drops){d.age+=dt;const t=Math.min(1,d.age/d.duration),x=d.start.x+(d.floor.x-d.start.x)*t,y=d.start.y+(d.floor.y-d.start.y)*t*t;
   if(t<1&&d.age-d.lastEmit>.025){d.lastEmit=d.age;if(d.shatter){this.crumble({x,y:y+4},d.direction,.8);this.emitChip({x,y:y+4},d.direction,d.floor.y,.8);}else this.emit({x,y:y+5,floor:d.floor.y},3);}
   if(t>=1&&!d.landed){d.landed=true;this.onImpact?.();this.emitPowder(d.floor);for(let i=0;i<(this.width<700?7:11);i++)this.emitChip(d.floor,d.direction||1,d.floor.y,1);this.emit(d.floor,this.width<700?9:14,true);this.glows.push({x:d.floor.x,y:d.floor.y,age:0,life:.11,radius:21});}
  }
  for(const g of this.glows){g.age+=dt;const alpha=Math.max(0,1-g.age/g.life);if(!alpha)continue;c.save();c.translate(g.x,g.y);c.scale(1,.3);const gradient=c.createRadialGradient(0,0,0,0,0,g.radius);gradient.addColorStop(0,`rgba(255,255,255,${alpha*.65})`);gradient.addColorStop(.3,`rgba(255,255,255,${alpha*.23})`);gradient.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gradient;c.fillRect(-g.radius,-g.radius,g.radius*2,g.radius*2);c.restore();}
  for(const m of this.mists){m.age+=dt;if(m.age<=0||m.age>=m.life)continue;const progress=m.age/m.life,alpha=Math.sin(progress*Math.PI)*.12;c.save();c.translate(m.x,m.y-progress*15);c.scale(1,.22+progress*.12);const radius=m.radius*(.55+progress*.9),gradient=c.createRadialGradient(0,0,0,0,0,radius);gradient.addColorStop(0,`rgba(238,245,249,${alpha})`);gradient.addColorStop(.5,`rgba(203,216,224,${alpha*.45})`);gradient.addColorStop(1,'rgba(203,216,224,0)');c.fillStyle=gradient;c.fillRect(-radius,-radius,radius*2,radius*2);c.restore();}
  for(const p of this.powder){p.life-=dt;if(p.life<=0)continue;p.vx*=Math.pow(p.settled?.88:.982,dt*60);if(!p.settled){p.vy+=330*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.y>=p.floor){p.y=p.floor;p.vy=0;p.settled=true;}}else p.x+=p.vx*dt;
   const fade=Math.min(1,p.life/.45),alpha=fade*(p.settled?.37:.85);c.globalAlpha=alpha;c.fillStyle=p.shade>.7?'#ffffff':p.shade>.3?'#d5dee4':'#a6b3bd';c.beginPath();c.arc(p.x,p.y,p.size*(p.settled?.7:1),0,Math.PI*2);c.fill();
  }
  for(const p of this.chips){p.life-=dt;if(p.life<=0)continue;p.vy+=520*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rotation+=p.spin*dt;p.vx*=Math.pow(.985,dt*60);if(p.y>=p.floor){p.y=p.floor;if(!p.bounced){p.vy=-Math.abs(p.vy)*.2;p.vx*=.72;p.spin*=.55;p.bounced=true;}else{p.vy=0;p.vx*=.8;}}
   c.save();c.translate(p.x,p.y);c.rotate(p.rotation);c.globalAlpha=Math.min(1,p.life/.18);c.fillStyle=p.shade>.66?'#f6fbff':p.shade>.3?'#aebbc4':'#697780';c.fillRect(-p.size*.7,-p.size*.28,p.size*1.4,p.size*.56);c.restore();
  }
  c.globalAlpha=1;
  for(const p of this.particles){p.life-=dt;if(p.life<=0)continue;p.vx*=Math.pow(.97,dt*60);p.vy+=790*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
   if(p.floor!=null&&p.y>=p.floor){if(!p.bounced){p.y=p.floor;p.vy=-Math.abs(p.vy)*.16;p.vx*=1.5;p.bounced=true;p.life=Math.min(p.life,.13);}else p.life=0;}
   const alpha=Math.max(0,p.life/p.maxLife);c.globalAlpha=Math.pow(alpha,.65);c.strokeStyle='#ffffff';c.fillStyle='#ffffff';c.lineCap='round';c.lineWidth=p.size;const trail=Math.min(.025,.009+Math.abs(p.vy)/23000);c.beginPath();c.moveTo(p.x-p.vx*trail,p.y-p.vy*trail);c.lineTo(p.x,p.y);c.stroke();if(alpha>.6)c.fillRect(p.x-.55,p.y-.55,1.1,1.1);
  }
  c.restore();this.particles=this.particles.filter(p=>p.life>0&&p.y<this.height+50);this.powder=this.powder.filter(p=>p.life>0&&p.x>-40&&p.x<this.width+40);this.chips=this.chips.filter(p=>p.life>0&&p.x>-70&&p.x<this.width+70);this.mists=this.mists.filter(m=>m.age<m.life);this.drops=this.drops.filter(d=>d.age<d.duration+.2);this.glows=this.glows.filter(g=>g.age<g.life);
  if(this.particles.length||this.powder.length||this.chips.length||this.mists.length||this.drops.length||this.glows.length)this.frame=requestAnimationFrame(time=>this.tick(time));else{this.frame=0;c.clearRect(0,0,this.width,this.height);}
 }
 clear(){cancelAnimationFrame(this.frame);this.frame=0;this.particles=[];this.powder=[];this.chips=[];this.mists=[];this.glows=[];this.drops=[];this.ctx.clearRect(0,0,this.width,this.height);}
}
globalThis.SparkEffects=SparkEffects;
})();
