// Indentation formatter: changes leading whitespace only, preserves literals/comments.
export function formatSCL(source){
 let state='code',stack=[];const result=[];
 for(const original of source.replace(/\r\n/g,'\n').split('\n')){
  const entering=state;let masked='';
  for(let i=0;i<original.length;i++){const c=original[i],n=original[i+1];if(state==='block'||state==='cblock'){const close=state==='block'?')':'/';if(c==='*'&&n===close){state='code';i++;}masked+=' ';continue;}if(state==='single'||state==='double'){const quote=state==='single'?"'":'"';if(c==='$'){i++;continue;}if(c===quote){if(n===quote)i++;else state='code';}masked+=' ';continue;}if(c==='/'&&n==='/')break;if(c==='('&&n==='*'){state='block';i++;continue;}if(c==='/'&&n==='*'){state='cblock';i++;continue;}if(c==="'"||c==='"'){state=c==="'"?'single':'double';masked+=' ';continue;}masked+=c;}
  const code=masked.trim(),upper=code.toUpperCase();let indent=stack.length+stack.filter(f=>f.arm).length;
  const end=/^(END_TYPE|END_IF|END_FOR|END_WHILE|END_REPEAT|END_CASE|END_VAR|END_STRUCT|END_REGION|END_FUNCTION_BLOCK|END_FUNCTION|END_ORGANIZATION_BLOCK)\b/.exec(upper);
  if(end){if(/END_FUNCTION|END_ORGANIZATION/.test(end[1]))stack=[];else{const kind=end[1].slice(4);let index=stack.map(f=>f.kind).lastIndexOf(kind);if(index>=0)stack.splice(index);}indent=stack.length+stack.filter(f=>f.arm).length;}
  const top=stack.at(-1);const branch=/^(ELSE|ELSIF|UNTIL)\b/.test(upper);const arm=top?.kind==='CASE'&&/^[^:;]+:(?!=)/.test(code);
  if(branch){if(top?.kind==='CASE'){top.arm=false;indent=stack.length;}else indent=Math.max(0,indent-1);}
  if(arm){top.arm=false;indent=stack.length+stack.filter(f=>f.arm).length;}
  result.push(entering!=='code'?original:original.trim()? '    '.repeat(Math.max(0,indent))+original.trimStart(): '');
  if(arm)top.arm=true;
  if(branch&&top?.kind==='CASE')top.arm=true;
  if(!end){let kind=null;
   if(/^VAR(?:_INPUT|_OUTPUT|_IN_OUT|_TEMP|_STAT|_CONSTANT)?\b/.test(upper))kind='VAR';
   else if(/^IF\b/.test(upper)&&/\bTHEN\s*$/.test(upper)&&!upper.includes('END_IF'))kind='IF';
   else if(/^FOR\b/.test(upper)&&/\bDO\s*$/.test(upper))kind='FOR';
   else if(/^WHILE\b/.test(upper)&&/\bDO\s*$/.test(upper))kind='WHILE';
   else if(/^CASE\b/.test(upper)&&/\bOF\s*$/.test(upper))kind='CASE';
   else if(/^REPEAT\b/.test(upper))kind='REPEAT';
   else if(/^TYPE\b/.test(upper))kind='TYPE';
   else if(/^REGION\b/.test(upper))kind='REGION';
   else if(/^BEGIN\b/.test(upper))kind='BODY';
   else if(/\bSTRUCT\s*;?\s*$/.test(upper))kind='STRUCT';
   if(kind==='VAR'&&upper.includes('END_VAR'))kind=null;
   if(kind)stack.push({kind,arm:false});
  }
 }
 return result.join('\n');
}
