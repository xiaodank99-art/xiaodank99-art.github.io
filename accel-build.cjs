'use strict';
// Build verified Pages assets from signed built-in manifests and the public product catalog.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const [source, output] = process.argv.slice(2);
if (!source || !output || fs.existsSync(output)) throw Error('Invalid source or output');
const MAX_PART = 20 * 1024 * 1024, EXTRA_MAX = 500000000;
const raw = 'https://raw.githubusercontent.com/xiaodank99-art/xiaodank99-art.github.io/main/assets/';
const repo = 'https://github.com/xiaodank99-art/xiaodank99-art.github.io/releases/download/';
const pub = crypto.createPublicKey({key:{kty:'RSA',n:'1dGjCGaG03u6zqLSLY0FF3FP__WLVLwXnG3j_6jYe0DNgmOIq96UU5TTMp9qRF0UsOlmrrFFwvCKggRF7ZdAEW-ZCfagm_iXXfW9t5LivpNhcxO04liMu7PskiccHKnapCmcsWYnEXpT7TPOv5_57mm6fLJzEzCPagxGMHmxBm9oanJAVcI1Gtvu8pN9jnz1DFvi5PmYWUtSnzJkpfjQzSocUySYSgxtVcS6a-0y0ytSy_eDLj8HDbkuoAomTwZxlEaPCTXiGLm4sDTD7Wn3KrMItTk95QTRFwuWJ-yEeGgNK_TXVJ19APj0NnUJsFvzIFrcPtzkB_kgTFQFdvghQcZ-kIem90FBOm3syP51fNP_LRgZ6m49Y75LJvb0uNuG9rVe_2PXLGxAXXlWhpUx-Q8OjgXrHEYMEAfLAtPRVYJ2S2u_aWD7c5LGYIxsrEfF7VZcFEK6H7kpz9ldH8UmsM7vQbFeUnBFYLuVmzFW39LASeDh6fDWnFGC7DlWAg8h',e:'AQAB'},format:'jwk'});
const builtins = [{id:'peripheral-battery',prefix:'battery-update-'},{id:'codex-monitor',prefix:'codex-update-'}];
function checkFields(id, version, size, sha) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !Number.isSafeInteger(size) || size < 1 || size > EXTRA_MAX || !/^[a-f0-9]{64}$/.test(sha)) throw Error('Invalid metadata: '+id);
}
function localParts(prefix, count) {
  return async function* () {
    for (let i=1;i<=count;i++) {
      const file = path.join(source,'assets',prefix+String(i).padStart(2,'0')+'.bin');
      for await (const chunk of fs.createReadStream(file)) yield chunk;
    }
  };
}
function parseBuiltin(spec) {
  const lines=fs.readFileSync(path.join(source,'update-'+spec.id+'.txt'),'utf8').trim().split(/\r?\n/);
  if(lines.length!==2 || !crypto.verify('RSA-SHA256',Buffer.from(lines[0],'base64'),pub,Buffer.from(lines[1],'base64'))) throw Error('Invalid signature: '+spec.id);
  const fields=Buffer.from(lines[0],'base64').toString('utf8').split('\n');
  const [format,id,version,sizeText,sha,,prefix,countText]=fields, size=Number(sizeText), count=Number(countText);
  checkFields(id,version,size,sha);
  if(fields.length!==8 || format!=='ZAOWUJI-UPDATE-1' || id!==spec.id || !Number.isInteger(count) || count<1 || count>100 || !prefix.startsWith(raw+spec.prefix) || !/^[-a-zA-Z0-9]+-part-$/.test(prefix.slice(raw.length))) throw Error('Invalid manifest: '+spec.id);
  return {id,version,size,sha,parts:localParts(prefix.slice(raw.length),count),chunkSize:id==='codex-monitor'?Math.min(MAX_PART,Math.ceil(size/6)):MAX_PART};
}
async function* release(url) {
  let next=url;
  for(let n=0;n<4;n++) {
    const u=new URL(next);
    if(u.protocol!=='https:' || !['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(u.hostname) || u.username || u.password) throw Error('Unexpected release host');
    const response=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(300000),headers:{'User-Agent':'Zaowuji-Pages-Sync'}});
    if([301,302,303,307,308].includes(response.status)) { const loc=response.headers.get('location'); if(!loc)throw Error('Invalid release redirect'); next=new URL(loc,u).href; continue; }
    if(!response.ok || !response.body) throw Error('Release download failed: HTTP '+response.status);
    yield* Readable.fromWeb(response.body);
    return;
  }
  throw Error('Too many release redirects');
}
function parseExtras() {
  const catalog=JSON.parse(fs.readFileSync(path.join(source,'assets','zaowuji-extra-products.json'),'utf8'));
  if(catalog.schema!==1 || !Array.isArray(catalog.products) || catalog.products.length>200) throw Error('Invalid catalog');
  const ids=new Set(), items=[];
  for(const item of catalog.products) {
    if(!/^[a-f0-9]{16}$/.test(item.id||'') || ids.has(item.id) || !['active','removed'].includes(item.status||'active')) throw Error('Invalid product id/status');
    ids.add(item.id);
    if(item.status==='removed') continue;
    const id='extra-'+item.id, {version,size,sha256:sha,suffix,url}=item;
    checkFields(id,version,size,sha);
    if(!['.exe','.msi','.zip'].includes(suffix) || url!==`${repo}${id}-v${version}/${id}-${version}${suffix}`) throw Error('Invalid release URL: '+id);
    items.push({id,version,size,sha,chunkSize:MAX_PART,parts:()=>release(url)});
  }
  return items;
}
async function writeItem(item) {
  const dir=path.join(output,'downloads',item.id,item.version); fs.mkdirSync(dir,{recursive:true});
  const hash=crypto.createHash('sha256'), names=[];
  let buffer=Buffer.allocUnsafe(item.chunkSize), used=0, size=0;
  function flush() { if(!used)return; const name='part-'+String(names.length+1).padStart(2,'0')+'.bin'; fs.writeFileSync(path.join(dir,name),buffer.subarray(0,used)); names.push(name); used=0; }
  for await(const part of item.parts()) {
    const data=Buffer.from(part); size+=data.length;
    if(size>item.size) throw Error('Release too large: '+item.id);
    hash.update(data);
    for(let offset=0;offset<data.length;) { const take=Math.min(data.length-offset,buffer.length-used); data.copy(buffer,used,offset,offset+take); used+=take; offset+=take; if(used===buffer.length)flush(); }
  }
  flush();
  if(size!==item.size || hash.digest('hex')!==item.sha) throw Error('Size or SHA-256 mismatch: '+item.id);
  const metadata={id:item.id,version:item.version,size,sha256:item.sha,parts:names};
  fs.writeFileSync(path.join(dir,'metadata.json'),JSON.stringify(metadata,null,2));
  fs.writeFileSync(path.join(output,'downloads',item.id,'latest.json'),JSON.stringify(metadata,null,2));
  console.log(item.id+' '+item.version+' verified '+size+' bytes');
}
module.exports={writeItem,parseExtras,parseBuiltin};
if(require.main===module) (async()=>{ for(const item of [...builtins.map(parseBuiltin),...parseExtras()]) await writeItem(item); })().catch(error=>{console.error(error.message);process.exitCode=1;});
