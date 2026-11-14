// Isolated experiment: only read the release snapshot and emit verified files.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const [source, output] = process.argv.slice(2);
if (!source || !output) throw Error('Usage: node build.cjs <snapshot> <new-output-directory>');
if (fs.existsSync(output)) throw Error('Output directory must not already exist');
const specs = [
 {id:'peripheral-battery', manifest:'update-peripheral-battery.txt', prefix:'battery-update-'},
 {id:'codex-monitor', manifest:'update-codex-monitor.txt', prefix:'codex-update-'}
];
const MAX = 20*1024*1024;
const summaries=[];
for (const spec of specs) {
 const lines=fs.readFileSync(path.join(source,spec.manifest),'utf8').trim().split(/\r?\n/);
 const fields=Buffer.from(lines[0],'base64').toString('utf8').trim().split(/\r?\n/);
 const [format,id,version,sizeText,sha,,prefix,countText]=fields;
 const size=Number(sizeText), count=Number(countText);
 const expectedBase='https://raw.githubusercontent.com/xiaodank99-art/xiaodank99-art.github.io/main/assets/';
 if(format!=='ZAOWUJI-UPDATE-1'||id!==spec.id||!/^\d+(?:\.\d+){1,3}$/.test(version)||!Number.isSafeInteger(size)||size<1||!/^[a-f0-9]{64}$/.test(sha)||!Number.isInteger(count)||count<1||count>100||!prefix.startsWith(expectedBase+spec.prefix)||!/^[-a-zA-Z0-9]+-part-$/.test(prefix.slice(expectedBase.length))) throw Error('Invalid manifest for '+spec.id);
 const namePrefix=prefix.slice(expectedBase.length);
 const pieces=[];
 for(let i=1;i<=count;i++) pieces.push(fs.readFileSync(path.join(source,'assets',namePrefix+String(i).padStart(2,'0')+'.bin')));
 const whole=Buffer.concat(pieces);
 if(whole.length!==size||crypto.createHash('sha256').update(whole).digest('hex')!==sha) throw Error('Size or SHA-256 mismatch for '+spec.id);
 const target=path.join(output,'downloads',spec.id,version);fs.mkdirSync(target,{recursive:true});
 const chunkSize=spec.id==='codex-monitor'?Math.min(MAX,Math.ceil(size/6)):MAX;
 const names=[];
 for(let offset=0,n=1;offset<size;offset+=chunkSize,n++) {const name=`part-${String(n).padStart(2,'0')}.bin`;fs.writeFileSync(path.join(target,name),whole.subarray(offset,offset+chunkSize));names.push(name)}
 const metadata={id,version,size,sha256:sha,parts:names};
 fs.writeFileSync(path.join(target,'metadata.json'),JSON.stringify(metadata,null,2));
 fs.writeFileSync(path.join(output,'downloads',spec.id,'latest.json'),JSON.stringify(metadata,null,2));
 summaries.push(metadata);
}
console.log(JSON.stringify(summaries,null,2));
