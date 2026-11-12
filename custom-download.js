(()=>{
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-extra-backup]'); if(!b||b.disabled)return;
    const status=b.parentElement.querySelector('.backup-status'); b.disabled=true;
    try{
      if(!window.crypto||!crypto.subtle)throw Error('校验不可用');
      const prefix=b.dataset.prefix, n=Number(b.dataset.parts), size=Number(b.dataset.size), hash=b.dataset.hash;
      if(!/^https:\/\/raw\.githubusercontent\.com\/xiaodank99-art\/xiaodank99-art\.github\.io\/main\/assets\/extra-[a-f0-9-]+-part-$/.test(prefix)||!Number.isInteger(n)||n<1||n>10||!Number.isSafeInteger(size)||size<1||size>200000000||!/^[a-f0-9]{64}$/.test(hash))throw Error('下载信息无效');
      const pieces=[];
      for(let i=1;i<=n;i++){
        status.textContent=` 正在准备备用下载（${i}/${n}）…`;
        const r=await fetch(prefix+String(i).padStart(2,'0')+'.bin');
        if(!r.ok)throw Error('下载失败'); pieces.push(await r.arrayBuffer());
      }
      const blob=new Blob(pieces,{type:'application/octet-stream'});
      if(blob.size!==size)throw Error('大小不一致');
      status.textContent=' 正在校验安装包…';
      const got=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
      if(got!==hash)throw Error('校验失败');
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url; a.download=b.dataset.filename; document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000); status.textContent=' 已校验，请查看浏览器下载。';
    }catch(err){status.textContent=' 备用下载未完成，请重试或使用主下载。';}
    finally{b.disabled=false;}
  });
})();
