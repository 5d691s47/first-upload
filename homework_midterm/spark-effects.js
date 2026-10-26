/* White falling sparks and a brief floor impact. */
(() => {
'use strict';
class SparkEffects {
 constructor(canvas,{reducedMotion=false,onImpact=null}={}){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.reducedMotion=reducedMotion;this.onImpact=onImpact;this.particles=[];this.glows=[];this.drops=[];this.frame=0;this.last=0;this.lastScrape=-Infinity;this.width=0;this.height=0;}
 resize(width,height){if(this.width===width&&this.height===height)return;this.width=width;this.height=height;const dpr=Math.min(devicePixelRatio||1,1.75);this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);}
 // Scraping keeps its sound, while visible sparks are reserved for the downward fall.
 scrape(){const now=performance.now();if(now-this.lastScrape<28)return false;this.lastScrape=now;return true;}
 drop(start,floor,duration=.6){if(this.reducedMotion)return;this.drops.push({start,floor,duration,age:0,lastEmit:0,landed:false});if(this.drops.length>3)this.drops.shift();this.run();}
 burst(point){if(this.reducedMotion)return;this.emit(point,34,true);this.glows.push({x:point.x,y:point.y,age:0,life:.13,radius:24});this.run();}
 emit(point,count,impact=false){
  for(let i=0;i<count;i++){const life=impact ? .18+Math.random()*.24 : .24+Math.random()*.35;this.particles.push({x:point.x+(Math.random()-.5)*(impact?22:8),y:point.y,vx:(Math.random()-.5)*(impact?310:95),vy:impact?-35-Math.random()*100:90+Math.random()*160,life,maxLife:life,size:.65+Math.random()*1.05,floor:point.floor??null,bounced:false});}
  const max=this.width<700?100:160;if(this.particles.length>max)this.particles.splice(0,this.particles.length-max);
 }
 run(){if(!this.frame){this.last=performance.now();this.frame=requestAnimationFrame(now=>this.tick(now));}}
 tick(now){
  const dt=Math.min(.04,Math.max(.001,(now-this.last)/1000));this.last=now;const c=this.ctx;c.clearRect(0,0,this.width,this.height);c.save();c.globalCompositeOperation='lighter';
  for(const d of this.drops){d.age+=dt;const t=Math.min(1,d.age/d.duration),x=d.start.x+(d.floor.x-d.start.x)*t,y=d.start.y+(d.floor.y-d.start.y)*t*t;
   if(t<1&&d.age-d.lastEmit>.025){d.lastEmit=d.age;this.emit({x,y:y+5,floor:d.floor.y},3);}
   if(t>=1&&!d.landed){d.landed=true;this.onImpact?.();this.emit(d.floor,this.width<700?29:43,true);this.glows.push({x:d.floor.x,y:d.floor.y,age:0,life:.14,radius:29});}
  }
  for(const g of this.glows){g.age+=dt;const alpha=Math.max(0,1-g.age/g.life);if(!alpha)continue;c.save();c.translate(g.x,g.y);c.scale(1,.3);const gradient=c.createRadialGradient(0,0,0,0,0,g.radius);gradient.addColorStop(0,`rgba(255,255,255,${alpha*.65})`);gradient.addColorStop(.3,`rgba(255,255,255,${alpha*.23})`);gradient.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gradient;c.fillRect(-g.radius,-g.radius,g.radius*2,g.radius*2);c.restore();}
  for(const p of this.particles){p.life-=dt;if(p.life<=0)continue;p.vx*=Math.pow(.97,dt*60);p.vy+=790*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
   if(p.floor!=null&&p.y>=p.floor){if(!p.bounced){p.y=p.floor;p.vy=-Math.abs(p.vy)*.16;p.vx*=1.5;p.bounced=true;p.life=Math.min(p.life,.13);}else p.life=0;}
   const alpha=Math.max(0,p.life/p.maxLife);c.globalAlpha=Math.pow(alpha,.65);c.strokeStyle='#ffffff';c.fillStyle='#ffffff';c.lineCap='round';c.lineWidth=p.size;const trail=Math.min(.025,.009+Math.abs(p.vy)/23000);c.beginPath();c.moveTo(p.x-p.vx*trail,p.y-p.vy*trail);c.lineTo(p.x,p.y);c.stroke();if(alpha>.6)c.fillRect(p.x-.55,p.y-.55,1.1,1.1);
  }
  c.restore();this.particles=this.particles.filter(p=>p.life>0&&p.y<this.height+50);this.drops=this.drops.filter(d=>d.age<d.duration+.2);this.glows=this.glows.filter(g=>g.age<g.life);
  if(this.particles.length||this.drops.length||this.glows.length)this.frame=requestAnimationFrame(time=>this.tick(time));else{this.frame=0;c.clearRect(0,0,this.width,this.height);}
 }
 clear(){cancelAnimationFrame(this.frame);this.frame=0;this.particles=[];this.glows=[];this.drops=[];this.ctx.clearRect(0,0,this.width,this.height);}
}
globalThis.SparkEffects=SparkEffects;
})();
