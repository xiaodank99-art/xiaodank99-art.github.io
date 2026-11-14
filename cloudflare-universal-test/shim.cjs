'use strict';
// Only used in the isolated project: map its fabricated release to an existing public installer.
const original=global.fetch;
global.fetch=(url,options)=>{
  const value=String(url);
  if(/^https:\/\/github\.com\/xiaodank99-art\/xiaodank99-art\.github\.io\/releases\/download\/extra-0123456789abcdef-v\d+\.\d+\.\d+\/extra-0123456789abcdef-\d+\.\d+\.\d+\.exe$/.test(value))
    return original('https://github.com/xiaodank99-art/xiaodank99-art.github.io/releases/download/codex-v2.6.1/CodexUsageMonitor-2.6.1-setup.exe',options);
  return original(url,options);
};
