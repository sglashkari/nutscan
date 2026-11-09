import {BrowserMultiFormatReader} from '@zxing/browser';
import {canonicalBarcode,metrics} from '../nutrition.js';
const $=s=>document.querySelector(s);
let products=[];
try{const saved=JSON.parse(localStorage.getItem('label-lens-products')||'[]');if(Array.isArray(saved)) products=saved.filter(p=>p?.id&&p?.nutrients&&typeof p.name==='string').slice(0,2);}catch{}
let controls,reader,scanning=false,scanGeneration=0,busy=false;
const message=s=>$('#status').textContent=s;
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function save(){try{localStorage.setItem('label-lens-products',JSON.stringify(products));}catch{message('Storage unavailable. Results will last for this visit.');}}
function render(){
 $('#results').hidden=!products.length;$('#products').replaceChildren();
 const basis=$('#basis').value;
 for(const p of products){
  const card=node('article',undefined,'product');card.append(node('span',p.brand||'USDA branded food','brand-name'),node('h3',p.name));
  card.append(node('p','Labeled serving: '+(p.serving||'Not reported')+(p.household?' · '+p.household:''),'muted'));
  const dl=node('dl');for(const [key,title,unit] of metrics){const row=node('div',undefined,'metric');const value=p.nutrients[key]?.[basis];row.append(node('dt',title),node('dd',typeof value==='number'?new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(value)+' '+unit:'—'));dl.append(row);}card.append(dl);
  const details=node('details');details.append(node('summary','Ingredients & source'),node('p',p.ingredients||'Ingredients not reported.'));const a=node('a','View USDA record ↗');a.href='https://fdc.nal.usda.gov/food-details/'+encodeURIComponent(p.id)+'/nutrients';a.target='_blank';a.rel='noreferrer';details.append(a,node('p','Barcode '+p.barcode+' · Record date '+(p.date||'not reported'),'metadata'));card.append(details);
  const remove=node('button','Remove','quiet');remove.onclick=()=>{products=products.filter(x=>x.id!==p.id);save();render();};card.append(remove);$('#products').append(card);
 }
}
async function lookup(){
 if(busy)return;stopCamera();const raw=$('#barcode').value;
 if(!canonicalBarcode(raw)){message('Check the barcode digits. Include all 8, 12, 13, or 14 digits, including leading zeros.');return;}
 busy=true;$('#lookup button').disabled=true;$('#scan').disabled=true;message('Looking for an exact barcode match in USDA…');
 try{const response=await fetch('/api/product?barcode='+encodeURIComponent(raw),{signal:AbortSignal.timeout(90000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Lookup failed.');
  if(!data.product){message('No exact match found in USDA. Check the number or use the package label. Store-specific deli barcodes may not be listed.');return;}
  products=[...products.filter(x=>x.id!==data.product.id),data.product].slice(-2);save();render();message('Exact match found. Check the product name and package.'+(data.demo?' Demo API access has a small shared request limit.':''));
 }catch(e){message(e.name==='TimeoutError'?'Lookup timed out. Please try again.':e instanceof TypeError?'Could not connect. Check your internet connection.':e.message);}
 finally{busy=false;$('#lookup button').disabled=false;$('#scan').disabled=false;}
}
function stopCamera(){scanGeneration++;scanning=false;controls?.stop();controls=undefined;const v=$('#video');v.srcObject?.getTracks().forEach(t=>t.stop());v.srcObject=null;$('#camera').hidden=true;$('#scan').disabled=busy;}
$('#scan').onclick=async()=>{
 if(scanning||busy)return;if(!navigator.mediaDevices?.getUserMedia){message('Camera access needs HTTPS and a supported browser. You can enter the barcode manually.');return;}
 scanning=true;const generation=++scanGeneration;$('#scan').disabled=true;$('#camera').hidden=false;message('Allow camera access, then point at the product barcode.');
 try{reader=new BrowserMultiFormatReader();const next=await reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'}},audio:false},$('#video'),(result,error,c)=>{
  if(generation!==scanGeneration){c.stop();return;}if(result&&canonicalBarcode(result.getText())){c.stop();$('#barcode').value=result.getText();stopCamera();lookup();}
 });if(generation!==scanGeneration)next.stop();else controls=next;
 }catch(e){if(generation!==scanGeneration)return;stopCamera();message(e.name==='NotAllowedError'?'Camera permission was denied. Enable it in browser settings or enter the barcode.':'Camera unavailable. Please enter the barcode number instead.');}
};
$('#stop').onclick=()=>{stopCamera();message('Camera stopped.');};
$('#lookup').onsubmit=e=>{e.preventDefault();lookup();};$('#basis').onchange=render;
$('#clear').onclick=()=>{stopCamera();products=[];save();render();$('#barcode').value='';message('Results cleared from this device.');};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});
window.addEventListener('pagehide',stopCamera);render();
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
