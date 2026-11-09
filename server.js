import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {canonicalBarcode,exactMatches,normalizeFood} from './nutrition.js';
const key=process.env.USDA_API_KEY||'DEMO_KEY';
const cache=new Map();
const pending=new Map();
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const allowed=new Set(['index.html','styles.css','bundle.js','icon.svg','manifest.webmanifest','sw.js']);
async function usda(path,params={}) {
  const url=new URL('https://api.nal.usda.gov/fdc/v1/'+path);
  url.search=new URLSearchParams({...params,api_key:key});
  const r=await fetch(url,{signal:AbortSignal.timeout(12000)});
  if (!r.ok) {const e=new Error(r.status===429?'USDA request limit reached. Please try again later.':r.status===403?'USDA API key is not accepted. Check server configuration.':'USDA is temporarily unavailable. Please try again.');e.status=r.status===429?429:502;throw e;}
  return r.json();
}
export async function lookup(code) {
  const cached=cache.get(code);
  if(cached && cached.until>Date.now()) return cached.value;
  if(pending.has(code)) return pending.get(code);
  const job=(async()=>{
    // USDA searches text, so verify GTIN on every candidate. Never accept a fuzzy hit.
    const variants=[code,...[13,12,8].filter(n=>/^0*$/.test(code.slice(0,-n))).map(n=>code.slice(-n))];
    let found=[];
    for(const query of [...new Set(variants)]) {
      for(let pageNumber=1;pageNumber<=3;pageNumber++) {
        const data=await usda('foods/search',{query,dataType:'Branded',pageSize:'200',pageNumber:String(pageNumber)});
        found.push(...exactMatches(data.foods??[],code));
        if(found.length || pageNumber>=(data.totalPages??1)) break;
      }
      if(found.length) break;
    }
    found=exactMatches(found,code);
    const full=found.length?await usda('food/'+found[0].fdcId):null;
    if(full && canonicalBarcode(full.gtinUpc)!==code) throw new Error('Product identifier mismatch. Please check the package.');
    const value={product:full?normalizeFood(full):null,demo:key==='DEMO_KEY'};
    if(cache.size>=200) cache.delete(cache.keys().next().value);
    cache.set(code,{until:Date.now()+3600000,value});
    return value;
  })();
  pending.set(code,job);
  try{return await job;}finally{pending.delete(code);}
}
export const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(self), microphone=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  const url=new URL(req.url,'http://localhost');
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  if(url.pathname==='/api/product') {
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const code=canonicalBarcode(url.searchParams.get('barcode'));
    if(!code){res.writeHead(400);res.end(JSON.stringify({error:'Enter a valid 8, 12, 13, or 14-digit retail barcode, including its check digit.'}));return;}
    try {res.end(JSON.stringify(await lookup(code)));}catch(e){res.writeHead(e.status??502);res.end(JSON.stringify({error:e.name==='TimeoutError'?'USDA took too long to respond. Please try again.':e.message==='fetch failed'?'Could not reach USDA. Please try again.':e.message}));}
    return;
  }
  const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!allowed.has(file)){res.writeHead(404);res.end('Not found');return;}
  try{const body=await readFile(new URL('./public/'+file,import.meta.url));res.setHeader('Content-Type',types[file.slice(file.lastIndexOf('.'))]??'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end('Build the app with npm run build first.');}
});
if(process.argv[1]===fileURLToPath(import.meta.url)) server.listen(Number(process.env.PORT)||3000,()=>console.log('Label Lens ready on http://localhost:'+(process.env.PORT||3000)));
