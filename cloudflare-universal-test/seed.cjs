'use strict';
// Isolated Cloudflare project only: simulated product points to an already-public current installer.
const fs=require('node:fs');
const p='assets/zaowuji-extra-products.json', data=JSON.parse(fs.readFileSync(p,'utf8'));
const id='0123456789abcdef', version=process.env.ZAO_TEST_VERSION || '1.0.1';
data.products=data.products.filter(x=>x.id!==id);
data.products.push({id,version,size:2401644,sha256:'8dac10a5e7efca56119b9e048f432265b3cb52216fea4e659e13cf4dc9d26d83',suffix:'.exe',status:'active',url:`https://github.com/xiaodank99-art/xiaodank99-art.github.io/releases/download/extra-${id}-v${version}/extra-${id}-${version}.exe`});
fs.writeFileSync(p,JSON.stringify(data));
