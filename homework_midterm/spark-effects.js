/* Lightweight screen-space metal sparks. No external images or audio files. */
(() => {
'use strict';
class SparkEffects {
 constructor(canvas,{reducedMotion=false}={}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.reducedMotion=reducedMotion;this.particles=[];this.glows=[];this.frame=0;this.last=0;this.lastScrape=-Infinity;this.width=0;this.height=0;
 }
 resize(width,height){if(this.width===width&&this.height===height)return;this.width=width;this.height=height;const dpr=Math.min(devicePixelRatio||1,1.75);this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);}
 scrape(point,direction=1,strength=.5){
  const now=performance.now();if(now-this.lastScrape<28)return false;this.lastScrape=now;
  if(!this.reducedMotion)this.emit(point,direction,Math.round(4+strength*6),false,strength);
  return true;
 }
 burst(point,direction=1){if(!this.reducedMotion)this.emit(point,direction,this.width<700?48:72,true,1);}
 emit(point,direction,count,burst,strength){
  for(let i=0;i<count;i++){
   const spread=(Math.random()-.5)*(burst?2.65:1.8),speed=(burst?160:85)+Math.random()*(burst?460:230)*(strength+.35);
   const angle=(direction>0?-.15:Math.PI+.15)+spread;
   const life=(burst ? .32 : .16)+Math.random()*(burst ? .55 : .24);
   this.particles.push({x:point.x+(Math.random()-.5)*5,y:point.y+(Math.random()-.5)*5,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-60-Math.random()*95,life,maxLife:life,size:.6+Math.random()*1.1,heat:Math.random()});
  }
  const max=this.width<700?110:180;if(this.particles.length>max)this.particles.splice(0,this.particles.length-max);
  this.glows.push({x:point.x,y:point.y,life:burst ? .095 : .045,maxLife:burst ? .095 : .045,size:burst?34:14});if(this.glows.length>6)this.glows.shift();
  if(!this.frame){this.last=performance.now();this.frame=requestAnimationFrame(time=>this.tick(time));}
 }
 tick(now){
  const dt=Math.min(.035,Math.max(.001,(now-this.last)/1000));this.last=now;const c=this.ctx;c.clearRect(0,0,this.width,this.height);c.save();c.globalCompositeOperation='lighter';
  for(const g of this.glows){g.life-=dt;if(g.life<=0)continue;const alpha=g.life/g.maxLife,r=g.size*(.7+alpha*.3),gradient=c.createRadialGradient(g.x,g.y,0,g.x,g.y,r);gradient.addColorStop(0,`rgba(255,241,199,${alpha*.55})`);gradient.addColorStop(.22,`rgba(255,169,69,${alpha*.24})`);gradient.addColorStop(1,'rgba(255,105,15,0)');c.fillStyle=gradient;c.fillRect(g.x-r,g.y-r,r*2,r*2);}
  for(const p of this.particles){
   p.life-=dt;if(p.life<=0)continue;p.vx*=Math.pow(.96,dt*60);p.vy+=510*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;const alpha=Math.pow(p.life/p.maxLife,.65),trail=Math.min(.024,.008+Math.hypot(p.vx,p.vy)/24000);
   c.globalAlpha=alpha;c.lineCap='round';c.lineWidth=p.size;c.strokeStyle=p.heat>.6?'#fff4d8':p.heat>.23?'#ffc56b':'#f48b37';c.beginPath();c.moveTo(p.x-p.vx*trail,p.y-p.vy*trail);c.lineTo(p.x,p.y);c.stroke();
   if(alpha>.55){c.fillStyle='#fff9e8';c.fillRect(p.x-.55,p.y-.55,1.1,1.1);}
  }
  c.restore();this.particles=this.particles.filter(p=>p.life>0&&p.y<this.height+60);this.glows=this.glows.filter(g=>g.life>0);
  if(this.particles.length||this.glows.length)this.frame=requestAnimationFrame(time=>this.tick(time));else{this.frame=0;c.clearRect(0,0,this.width,this.height);}
 }
 clear(){cancelAnimationFrame(this.frame);this.frame=0;this.particles=[];this.glows=[];this.ctx.clearRect(0,0,this.width,this.height);}
}
globalThis.SparkEffects=SparkEffects;
})();
