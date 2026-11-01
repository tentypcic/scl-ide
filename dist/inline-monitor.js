import {debugView} from './debug-values.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function valueText(v,t){if(typeof v==='boolean')return v?'TRUE':'FALSE';if(t==='TIME'||t==='LTIME')return 'T#'+v+'ms';if(typeof v==='string')return "'"+v+"'";return String(v);}
export function setupInlineMonitor(code,onWatch){
 const surface=code.parentElement,layer=document.createElement('div');layer.className='inline-runtime';surface.append(layer);let enabled=true,lastMachine=null,previous=new Map(),changed=new Map(),context=null;
 try{enabled=localStorage.getItem('scl-inline-values')!=='false';}catch{}
 const button=document.querySelector('#inlineValuesBtn'),status=document.querySelector('#inlineValuesStatus'),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 function render(machine,state={}){context={machine,state};surface.classList.toggle('has-inline-values',enabled);if(lastMachine!==machine){lastMachine=machine;previous.clear();changed.clear();}if(machine)machine.debugEnabled=enabled;button.setAttribute('aria-pressed',String(enabled));button.classList.toggle('selected',enabled);layer.innerHTML='';
  if(!enabled){status.textContent='';return;}if(!machine||state.dirty||state.error){status.textContent=state.dirty?'Wartości: sprawdź zmieniony kod':'Wartości: brak aktualnej próbki';return;}
  const frames=debugView(machine,state.running);status.textContent=state.running?'Wartości · cykl '+machine.scans:machine.generator?'Wartości · pauza w cyklu '+(machine.scans+1):machine.scans?'Wartości · cykl '+machine.scans:'Wartości · wykonaj instrukcję / cykl';
  const lines=code.value.split('\n'),style=getComputedStyle(code),lineHeight=parseFloat(style.lineHeight)||24,first=Math.max(0,Math.floor(code.scrollTop/lineHeight)),last=first+Math.ceil(code.clientHeight/lineHeight)+1;ctx.font=style.fontWeight+' '+style.fontSize+' '+style.fontFamily;let html='';const cycle=machine.generator?machine.scans+1:machine.scans,now=Date.now();
  const rows=code.folding?.rows||lines.map((text,i)=>({line:i+1}));for(let viewIndex=first;viewIndex<Math.min(last,rows.length);viewIndex++){const index=rows[viewIndex].line-1;const frame=frames.get(index+1);if(!frame)continue;const fold=rows[viewIndex].range,foldPadding=fold?ctx.measureText('… '+(fold.end-fold.start)+' linii').width+22:0;const left=foldPadding+ctx.measureText(lines[index].replaceAll('\t','    ')).width+(parseFloat(style.letterSpacing)||0)*lines[index].length+20-code.scrollLeft;if(left>code.clientWidth-60)continue;const stale=frame.cycle<cycle&&!state.running;const values=frame.values.slice(0,3);let badges='';
   for(const item of values){const key=(index+1)+':'+item.path,encoded=JSON.stringify(item.value);if(previous.has(key)&&previous.get(key)!==encoded)changed.set(key,now+1100);previous.set(key,encoded);const flash=(changed.get(key)||0)>now;const text=valueText(item.value,item.type),short=text.length>35?text.slice(0,32)+'…':text;
    badges+=`<button class="runtime-value ${item.value===true?'true-value':''} ${item.value===false?'false-value':''} ${flash?'value-changed':''}" data-runtime-watch="${esc(item.path)}" title="${esc(item.path+' : '+item.type+' = '+text+' · cykl '+frame.cycle+' · wartość przy ostatnim wykonaniu tej linii; kliknij, aby obserwować')}"><span>${esc(item.path)}</span><b>${esc(short)}</b></button>`;
   }html+=`<div class="runtime-line ${stale?'stale':''}" style="top:${viewIndex*lineHeight-code.scrollTop}px;left:${Math.max(8,left)}px;height:${lineHeight}px">${badges}<small title="Numer cyklu tej próbki">#${frame.cycle}</small></div>`;
  }layer.innerHTML=html;
 }
 button.onclick=()=>{enabled=!enabled;try{localStorage.setItem('scl-inline-values',String(enabled));}catch{}if(context){if(context.machine){context.machine.debugPending.clear();context.machine.debugCompleted.clear();}render(context.machine,context.state);}};
 layer.onmousedown=e=>e.preventDefault();layer.onclick=e=>{const b=e.target.closest('[data-runtime-watch]');if(b)onWatch(b.dataset.runtimeWatch);};
 window.addEventListener('resize',()=>{if(context)render(context.machine,context.state);});return {render};
}
