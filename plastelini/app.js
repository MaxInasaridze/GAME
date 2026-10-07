'use strict';
const canvas = document.querySelector('#board'), ctx = canvas.getContext('2d');
const W = 1200, H = 900;
const palette = ['#9470ed','#f581a2','#f1bc54','#7fc3a6','#66b4d8','#ef8861','#e95e69','#f5eee4'];
let color = palette[0], shape = 'ball', tool = 'move', size = 70;
let pieces = [], undoStack = [], redoStack = [], gesture = null, selected = null, activePointer = null;
let toastTimer, savedTimer, changeCount = 0;
const clone = value => JSON.parse(JSON.stringify(value));
const hints = {move:'გადაადგილება · მოკიდე ნაჭერს და გადაათრიე',sculpt:'გამოძერწვა · გაწელე ნაჭრის კიდეები',squeeze:'შეკუმშვა · დააჭირე და გადაათრიე ნაჭერზე',draw:'ძაფი · დახატე პლასტელინის ფერადი ხაზები',add:'დამატება · დააჭირე დაფას ახალი ნაჭრისთვის',erase:'წაშლა · დააჭირე იმ ნაჭერს, რომლის წაშლაც გინდა'};
function notify(text){const el=document.querySelector('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),2400)}
function historyStart(){undoStack.push(clone(pieces));if(undoStack.length>50)undoStack.shift();redoStack=[];historyUI()}
function historyUI(){document.querySelector('#undo').disabled=!undoStack.length;document.querySelector('#redo').disabled=!redoStack.length}
function persist(){clearTimeout(savedTimer);savedTimer=setTimeout(()=>{try{localStorage.setItem('plastelini-v1',JSON.stringify(pieces))}catch{}},180)}
function changed(){changeCount++;persist();document.querySelector('#pieceCount').textContent=pieces.length+' ნაჭერი';historyUI();render()}
function colorSelect(hex){color=hex;document.querySelector('#customColor').value=hex;document.querySelectorAll('.color').forEach(b=>{const active=b.dataset.color===hex;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))})}
palette.forEach((hex,i)=>{const b=document.createElement('button');b.className='color';b.style.setProperty('--color',hex);b.dataset.color=hex;b.setAttribute('aria-label',['იისფერი','ვარდისფერი','ყვითელი','მწვანე','ცისფერი','ნარინჯისფერი','წითელი','თეთრი'][i]);b.addEventListener('click',()=>colorSelect(hex));document.querySelector('#colors').append(b)});
colorSelect(color);
document.querySelector('#customColor').addEventListener('input',e=>colorSelect(e.target.value));
document.querySelector('#size').addEventListener('input',e=>{size=Number(e.target.value);document.querySelector('#sizeValue').textContent=size});
document.querySelectorAll('[data-shape]').forEach(b=>b.addEventListener('click',()=>{shape=b.dataset.shape;document.querySelectorAll('[data-shape]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active))})}));
function setTool(next){tool=next;document.querySelectorAll('[data-tool]').forEach(b=>{const active=b.dataset.tool===tool;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});document.querySelector('#boardHint').textContent=hints[tool];canvas.style.cursor=tool==='move'?'grab':tool==='erase'?'not-allowed':'crosshair';selected=null;render()}
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
function makePiece(x,y,r,hex,type='ball',stretch=1,angle=0){
  const nodes=[];const n=type==='star'?50:48;
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2;let px,py;
    if(type==='square'){const c=Math.cos(a),s=Math.sin(a);const m=Math.pow(Math.abs(c),6)+Math.pow(Math.abs(s),6);const k=Math.pow(m,-1/6);px=c*r*k*.86;py=s*r*k*.86}
    else {const star=type==='star'?.64+.36*Math.cos(5*(a+Math.PI/2)):1;const wobble=1+.018*Math.sin(a*3+.7)+.012*Math.cos(a*7);px=Math.cos(a)*r*star*wobble;py=Math.sin(a)*r*star*wobble*(type==='oval'?.6:1)}
    px*=stretch;nodes.push({x:px*Math.cos(angle)-py*Math.sin(angle),y:px*Math.sin(angle)+py*Math.cos(angle)})
  }
  return {x,y,color:hex,nodes};
}
function piecePath(p){ctx.beginPath();const nodes=p.nodes;let previous=nodes[nodes.length-1];ctx.moveTo(p.x+(previous.x+nodes[0].x)/2,p.y+(previous.y+nodes[0].y)/2);for(let i=0;i<nodes.length;i++){const a=nodes[i],b=nodes[(i+1)%nodes.length];ctx.quadraticCurveTo(p.x+a.x,p.y+a.y,p.x+(a.x+b.x)/2,p.y+(a.y+b.y)/2)}ctx.closePath()}
function hexRgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))}
function tone(hex,amount){const rgb=hexRgb(hex).map(v=>Math.round(amount>0?v+(255-v)*amount:v*(1+amount)));return 'rgb('+rgb.join(',')+')'}
function drawPiece(p,highlight=true){
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const n of p.nodes){left=Math.min(left,n.x);right=Math.max(right,n.x);top=Math.min(top,n.y);bottom=Math.max(bottom,n.y)}
  const cx=p.x+(left+right)/2,cy=p.y+(top+bottom)/2,r=Math.max(right-left,bottom-top)/2;
  ctx.save();piecePath(p);ctx.shadowColor='#58463038';ctx.shadowBlur=15;ctx.shadowOffsetX=3;ctx.shadowOffsetY=12;
  const g=ctx.createRadialGradient(cx-r*.32,cy-r*.4,Math.max(r*.06,1),cx,cy,Math.max(r*1.25,1));g.addColorStop(0,tone(p.color,.24));g.addColorStop(.45,p.color);g.addColorStop(1,tone(p.color,-.25));ctx.fillStyle=g;ctx.fill();ctx.shadowColor='transparent';ctx.clip();
  // Tiny deterministic pores give each editable piece a soft clay surface.
  for(let i=0;i<60;i++){const nx=left+((i*43.721)%1)*(right-left),ny=top+((i*17.349)%1)*(bottom-top);ctx.beginPath();ctx.arc(p.x+nx,p.y+ny,.7+(i%3)*.25,0,Math.PI*2);ctx.fillStyle=i%2?'#ffffff12':'#0000000b';ctx.fill()}
  ctx.restore();
  if(highlight&&selected===p){piecePath(p);ctx.strokeStyle='#78659488';ctx.lineWidth=2;ctx.setLineDash([6,8]);ctx.stroke();ctx.setLineDash([])}
}
function render(highlight=true){ctx.clearRect(0,0,W,H);ctx.fillStyle='#faf8f1';ctx.fillRect(0,0,W,H);ctx.fillStyle='#cfc8bb65';for(let x=30;x<W;x+=35)for(let y=30;y<H;y+=35){ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill()}pieces.forEach(p=>drawPiece(p,highlight))}
function point(e){const rect=canvas.getBoundingClientRect();return {x:(e.clientX-rect.left)*W/rect.width,y:(e.clientY-rect.top)*H/rect.height}}
function hit(x,y){for(let i=pieces.length-1;i>=0;i--){piecePath(pieces[i]);if(ctx.isPointInPath(x,y))return pieces[i]}return null}
function addPiece(x=W/2,y=H/2){historyStart();const p=makePiece(x,y,size,color,shape);pieces.push(p);selected=p;changed()}
document.querySelector('#add').addEventListener('click',()=>{addPiece(W/2+(Math.random()-.5)*160,H/2+(Math.random()-.5)*100);setTool('move');notify('ახალი ნაჭერი დაემატა')});
canvas.addEventListener('pointerdown',e=>{
  if(activePointer!==null)return;e.preventDefault();activePointer=e.pointerId;canvas.setPointerCapture(e.pointerId);const pos=point(e),p=hit(pos.x,pos.y);selected=null;
  if(tool==='add'){addPiece(pos.x,pos.y);return}
  if(tool==='erase'){if(p){historyStart();pieces.splice(pieces.indexOf(p),1);changed()}return}
  if(tool==='draw'){historyStart();pieces.push(makePiece(pos.x,pos.y,Math.max(7,size*.2),color));gesture={last:pos,draw:true};changed();return}
  if(!p){render();return}
  historyStart();selected=p;pieces.splice(pieces.indexOf(p),1);pieces.push(p);
  gesture={p,last:pos,start:pos};if(tool==='move')canvas.style.cursor='grabbing';render();
});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerId!==activePointer||!gesture)return;e.preventDefault();const pos=point(e),last=gesture.last,dx=pos.x-last.x,dy=pos.y-last.y;
  if(gesture.draw){const distance=Math.hypot(dx,dy),radius=Math.max(7,size*.2),steps=Math.ceil(distance/Math.max(4,radius*.65));for(let i=1;i<=steps;i++){if(pieces.length>=1600){notify('დაფა სავსეა — წაშალე რამდენიმე ნაჭერი');break}pieces.push(makePiece(last.x+dx*i/steps,last.y+dy*i/steps,radius,color))}}
  else if(tool==='move'){gesture.p.x=Math.max(0,Math.min(W,gesture.p.x+dx));gesture.p.y=Math.max(0,Math.min(H,gesture.p.y+dy))}
  else if(tool==='sculpt'){
    for(const n of gesture.p.nodes){const dist=Math.hypot(gesture.p.x+n.x-last.x,gesture.p.y+n.y-last.y);const influence=Math.exp(-dist*dist/(2*100*100));n.x=Math.max(-450,Math.min(450,n.x+dx*influence));n.y=Math.max(-450,Math.min(450,n.y+dy*influence))}
  }else if(tool==='squeeze'){
    const factor=1-Math.min(.025,Math.hypot(dx,dy)*.0014);const p=gesture.p;const maxR=Math.max(...p.nodes.map(n=>Math.hypot(n.x,n.y)));if(maxR>16)for(const n of p.nodes){n.x*=factor;n.y*=factor}
  }
  gesture.last=pos;changed();
});
function release(e){if(e.pointerId!==activePointer)return;if(gesture){gesture=null;changed()}activePointer=null;canvas.style.cursor=tool==='move'?'grab':tool==='erase'?'not-allowed':'crosshair'}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
function undo(){if(!undoStack.length)return;redoStack.push(clone(pieces));pieces=undoStack.pop();selected=null;changed()}
function redo(){if(!redoStack.length)return;undoStack.push(clone(pieces));pieces=redoStack.pop();selected=null;changed()}
document.querySelector('#undo').addEventListener('click',undo);document.querySelector('#redo').addEventListener('click',redo);
document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}if((e.key==='Delete'||e.key==='Backspace')&&selected){e.preventDefault();historyStart();pieces.splice(pieces.indexOf(selected),1);selected=null;changed()}});
function preset(name){
  historyStart();pieces=[];selected=null;
  const add=(x,y,r,c,t='ball',s=1,a=0)=>pieces.push(makePiece(x,y,r,c,t,s,a));
  if(name==='flower'){
    add(610,640,120,'#7fc3a6','oval',1.5,-Math.PI/2);add(526,640,66,'#7fc3a6','oval',1.4,-.5);add(699,590,64,'#7fc3a6','oval',1.45,.5);
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;add(600+Math.cos(a)*132,360+Math.sin(a)*132,89,'#f1bc54','oval',1.08,a)}
    add(600,360,99,'#ef8861');add(576,348,9,'#594240');add(628,348,9,'#594240');
    add(602,389,18,'#594240','oval');add(540,380,11,'#f581a2','oval');add(660,380,11,'#f581a2','oval');
    add(298,274,48,'#9470ed','star',1,.1);add(864,550,38,'#f581a2','star',1,-.2);add(310,608,24,'#66b4d8');add(859,241,19,'#7fc3a6');
  }else if(name==='snail'){
    add(580,615,115,'#7fc3a6','oval',2.5);add(789,540,67,'#7fc3a6','oval',1.6,-Math.PI/2);add(752,425,40,'#7fc3a6','oval',1.6,-Math.PI/2);add(824,425,40,'#7fc3a6','oval',1.6,-Math.PI/2);
    add(574,499,149,'#9470ed');for(let i=0;i<95;i++){const a=i/94*Math.PI*4.3,r=110*(1-i/100);add(574+Math.cos(a)*r,499+Math.sin(a)*r,13,'#f581a2')}
    add(752,395,23,'#f5eee4');add(824,395,23,'#f5eee4');add(757,396,9,'#594240');add(829,396,9,'#594240');add(797,534,15,'#594240','oval');add(295,343,42,'#f1bc54','star');add(910,610,25,'#ef8861');
  }else{
    add(620,465,156,'#9470ed');add(568,411,36,'#b898f6');add(667,500,48,'#b898f6');add(565,529,20,'#b898f6');
    for(let i=0;i<120;i++){const a=i/120*Math.PI*2;const x=Math.cos(a)*246,y=Math.sin(a)*54;if(y<0)continue;const rot=-.32;add(620+x*Math.cos(rot)-y*Math.sin(rot),465+x*Math.sin(rot)+y*Math.cos(rot),17,'#f1bc54')}
    [[285,280,50],[907,287,35],[343,651,29],[849,682,24]].forEach(([x,y,r])=>add(x,y,r,'#f1bc54','star'));add(866,496,39,'#66b4d8');
  }
  setTool('move');changed();notify('მზადაა! ახლა შენი ხელით შეცვალე');
}
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>preset(b.dataset.preset)));
const dialog=document.querySelector('#confirm');document.querySelector('#clear').addEventListener('click',()=>{if(!pieces.length){notify('დაფა უკვე ცარიელია');return}dialog.showModal()});document.querySelector('#cancelClear').addEventListener('click',()=>dialog.close());document.querySelector('#confirmClear').addEventListener('click',()=>{historyStart();pieces=[];selected=null;changed();dialog.close();notify('ახალი იდეისთვის მზად ხარ')});
document.querySelector('#export').addEventListener('click',()=>{render(false);canvas.toBlob(blob=>{if(!blob){notify('სურათი ვერ შეინახა. სცადე ხელახლა.');return}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='plastelini-'+Date.now()+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);notify('შენი ნამუშევარი სურათად შეინახა')},'image/png');render()});
try{const stored=JSON.parse(localStorage.getItem('plastelini-v1'));if(Array.isArray(stored)&&stored.length<=1600&&stored.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&/^#[0-9a-f]{6}$/i.test(p.color)&&Array.isArray(p.nodes)&&p.nodes.length>=3&&p.nodes.length<=100&&p.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y))))pieces=stored;else preset('flower')}catch{preset('flower')}
undoStack=[];redoStack=[];setTool('move');changed();
window.addEventListener('pagehide',()=>{try{localStorage.setItem('plastelini-v1',JSON.stringify(pieces))}catch{}});
