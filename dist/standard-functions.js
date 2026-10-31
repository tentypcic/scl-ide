// Explicitly supported CPU-independent subset. Hardware/system calls are not emulated.
const specs={
 LEN:['IN'],CONCAT:['IN1','IN2'],LEFT:['IN','L'],RIGHT:['IN','L'],MID:['IN','L','P'],FIND:['IN1','IN2'],INSERT:['IN1','IN2','P'],DELETE:['IN','L','P'],REPLACE:['IN1','IN2','L','P'],
 SHL:['IN','N'],SHR:['IN','N'],ROL:['IN','N'],ROR:['IN','N'],
 NORM_X:['MIN','VALUE','MAX'],SCALE_X:['MIN','VALUE','MAX'],FRAC:['IN']
};
export const standardSignatures=Object.fromEntries(Object.entries(specs).map(([n,args])=>[n,n+'('+args.join(', ')+')']));
export function supportsStandard(name){return Object.hasOwn(specs,name);}
export function callStandard(name,params){
 const keys=specs[name];if(!keys)throw Error('Nieobsługiwana funkcja '+name);
 if(params.some(p=>p.out))throw Error(name+': parametry => oraz ENO nie są emulowane.');
 let args;
 if(params.some(p=>p.name)){if(params.some(p=>!p.name))throw Error('Nie mieszaj argumentów nazwanych i pozycyjnych.');let seen=new Set();for(const p of params){let n=p.name.toUpperCase();if(!keys.includes(n)||seen.has(n))throw Error(name+': nieznany lub powtórzony parametr '+n);seen.add(n);}args=keys.map(k=>params.find(p=>p.name.toUpperCase()===k)?.result);}
 else args=params.map(p=>p.result);
 if(args.length!==keys.length||args.some(a=>!a))throw Error(name+': wymagane parametry '+keys.join(', '));
 const a=args.map(x=>x.v),num=i=>{if(typeof a[i]!=='number'||!Number.isFinite(a[i]))throw Error(name+': wymagane liczby.');return a[i];},str=i=>{if(typeof a[i]!=='string')throw Error(name+': wymagany STRING.');return a[i];},integer=i=>{const n=num(i);if(!Number.isInteger(n)||n<0)throw Error(name+': wymagany nieujemny indeks całkowity.');return n;};
 switch(name){
 case 'LEN':return {v:str(0).length,t:'DINT'};
 case 'CONCAT':return {v:str(0)+str(1),t:'STRING'};
 case 'LEFT':return {v:str(0).slice(0,integer(1)),t:'STRING'};
 case 'RIGHT':{const s=str(0),n=integer(1);return {v:n?s.slice(-n):'',t:'STRING'};}
 case 'MID':case 'DELETE':{const s=str(0),len=integer(1),pos=integer(2);if(pos<1)throw Error(name+': P zaczyna się od 1.');return {v:name==='MID'?s.slice(pos-1,pos-1+len):s.slice(0,pos-1)+s.slice(pos-1+len),t:'STRING'};}
 case 'FIND':return {v:str(0).indexOf(str(1))+1,t:'DINT'};
 case 'INSERT':{const s=str(0),s2=str(1),p=integer(2);return {v:s.slice(0,p)+s2+s.slice(p),t:'STRING'};}
 case 'REPLACE':{const s=str(0),s2=str(1),len=integer(2),p=integer(3);if(p<1)throw Error('REPLACE: P zaczyna się od 1.');return {v:s.slice(0,p-1)+s2+s.slice(p-1+len),t:'STRING'};}
 case 'FRAC':{const n=num(0);return {v:n-Math.trunc(n),t:'REAL'};}
 case 'NORM_X':case 'SCALE_X':{const min=num(0),value=num(1),max=num(2);if(min>=max)throw Error(name+': MIN musi być mniejsze od MAX.');const v=name==='NORM_X'?(value-min)/(max-min):value*(max-min)+min;const real=name==='NORM_X'||args[0].t==='REAL'||args[2].t==='REAL'||args[0].t==='LREAL'||args[2].t==='LREAL';return {v:real?v:Math.round(v),t:real?'REAL':'DINT'};}
 default:{const width={BYTE:8,WORD:16,DWORD:32}[args[0].t];if(!width)throw Error(name+': symulacja wymaga IN typu BYTE, WORD lub DWORD.');const n=integer(1),bits=BigInt(width),mask=(1n<<bits)-1n,input=BigInt(num(0))&mask;let v;if(name==='SHL'||name==='SHR')v=n>=width?0n:name==='SHL'?(input<<BigInt(n))&mask:input>>BigInt(n);else{const shift=BigInt(n%width);v=name==='ROL'?((input<<shift)|(input>>(bits-shift)))&mask:((input>>shift)|(input<<(bits-shift)))&mask;}return {v:Number(v),t:args[0].t};}
 }
}
