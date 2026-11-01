const key='scl-lab-layout-v1';
const defaults={sidebar:false,inspector:true,bottom:false,sidebarWidth:205,inspectorWidth:320,bottomHeight:280,font:14};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||min));
let settings={...defaults},focus=false;
try{settings={...defaults,...JSON.parse(localStorage.getItem(key)||'{}')};}catch{}
settings.font=[12,14,16,18,20].includes(Number(settings.font))?Number(settings.font):14;
settings.sidebarWidth=clamp(settings.sidebarWidth,160,360);settings.inspectorWidth=clamp(settings.inspectorWidth,240,520);settings.bottomHeight=clamp(settings.bottomHeight,160,600);
const $=s=>document.querySelector(s);
function save(){try{localStorage.setItem(key,JSON.stringify(settings));}catch{}}
function apply(){
 document.body.classList.toggle('sidebar-collapsed',!settings.sidebar);document.body.classList.toggle('inspector-collapsed',!settings.inspector);document.body.classList.toggle('bottom-collapsed',!settings.bottom);document.body.classList.toggle('focus-mode',focus);
 const style=document.documentElement.style;style.setProperty('--nav-width',settings.sidebarWidth+'px');style.setProperty('--monitor-width',settings.inspectorWidth+'px');style.setProperty('--panel-height',settings.bottomHeight+'px');style.setProperty('--code-font',settings.font+'px');style.setProperty('--code-line',Math.ceil(settings.font*1.7)+'px');
 $('#fontSelect').value=String(settings.font);
 for(const [id,name] of [['toggleSidebar','sidebar'],['toggleInspector','inspector'],['toggleBottom','bottom']]){$('#'+id).setAttribute('aria-pressed',String(settings[name]&&!focus));$('#'+id).classList.toggle('selected',settings[name]&&!focus);}
 $('#focusMode').setAttribute('aria-pressed',String(focus));$('#focusMode').classList.toggle('selected',focus);$('#focusMode span').textContent=focus?'Wyjdź':'Skupienie';
 $('#collapsePanel').textContent=settings.bottom&&!focus?'⌄':'⌃';$('#collapsePanel').setAttribute('aria-label',settings.bottom&&!focus?'Zwiń panel dolny':'Rozwiń panel dolny');
 for(const el of document.querySelectorAll('[data-resize]')){const n=el.dataset.resize;el.setAttribute('aria-valuemin',n==='bottom'?160:n==='sidebar'?160:240);el.setAttribute('aria-valuemax',n==='bottom'?600:n==='sidebar'?360:520);el.setAttribute('aria-valuenow',settings[n==='bottom'?'bottomHeight':n+'Width']);}
 window.dispatchEvent(new Event('scl-layout'));save();
}
function toggle(name){const wasFocus=focus;focus=false;settings[name]=wasFocus?true:!settings[name];apply();}
$('#toggleSidebar').onclick=()=>toggle('sidebar');$('#toggleInspector').onclick=()=>toggle('inspector');$('#toggleBottom').onclick=()=>toggle('bottom');$('#collapsePanel').onclick=()=>toggle('bottom');$('#focusMode').onclick=()=>{focus=!focus;apply();};$('#fontSelect').onchange=()=>{settings.font=Number($('#fontSelect').value);apply();};
window.addEventListener('scl-open-panel',()=>{focus=false;settings.bottom=true;apply();});
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;if((e.ctrlKey||e.metaKey)&&['b','j'].includes(e.key.toLowerCase())){e.preventDefault();toggle(e.key.toLowerCase()==='b'?'sidebar':'bottom');}if(e.key==='F8'){e.preventDefault();focus=!focus;apply();}});
let drag=null;
for(const el of document.querySelectorAll('[data-resize]')){
 el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();el.setPointerCapture(e.pointerId);drag={kind:el.dataset.resize};document.body.classList.add('resizing');});
 el.addEventListener('pointermove',e=>{if(!drag)return;const rect=$('.workspace').getBoundingClientRect();if(drag.kind==='sidebar')settings.sidebarWidth=clamp(e.clientX-rect.left,160,Math.min(360,rect.width-500));if(drag.kind==='inspector')settings.inspectorWidth=clamp(rect.right-e.clientX,240,Math.min(520,rect.width-450));if(drag.kind==='bottom')settings.bottomHeight=clamp(rect.bottom-e.clientY,160,Math.min(600,rect.height-200));apply();});
 const end=()=>{drag=null;document.body.classList.remove('resizing');save();};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
 el.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const kind=el.dataset.resize,property=kind==='bottom'?'bottomHeight':kind+'Width';const increase=kind==='sidebar'?e.key==='ArrowRight':kind==='inspector'?e.key==='ArrowLeft':e.key==='ArrowUp';settings[property]=clamp(settings[property]+(increase?16:-16),kind==='bottom'?160:kind==='sidebar'?160:240,kind==='bottom'?600:kind==='sidebar'?360:520);apply();});
}
apply();
