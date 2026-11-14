(()=>{
  'use strict';
  const mirror='https://zwj-download-sync-20261115.pages.dev/downloads/';
  const publicModulus='1dGjCGaG03u6zqLSLY0FF3FP__WLVLwXnG3j_6jYe0DNgmOIq96UU5TTMp9qRF0UsOlmrrFFwvCKggRF7ZdAEW-ZCfagm_iXXfW9t5LivpNhcxO04liMu7PskiccHKnapCmcsWYnEXpT7TPOv5_57mm6fLJzEzCPagxGMHmxBm9oanJAVcI1Gtvu8pN9jnz1DFvi5PmYWUtSnzJkpfjQzSocUySYSgxtVcS6a-0y0ytSy_eDLj8HDbkuoAomTwZxlEaPCTXiGLm4sDTD7Wn3KrMItTk95QTRFwuWJ-yEeGgNK_TXVJ19APj0NnUJsFvzIFrcPtzkB_kgTFQFdvghQcZ-kIem90FBOm3syP51fNP_LRgZ6m49Y75LJvb0uNuG9rVe_2PXLGxAXXlWhpUx-Q8OjgXrHEYMEAfLAtPRVYJ2S2u_aWD7c5LGYIxsrEfF7VZcFEK6H7kpz9ldH8UmsM7vQbFeUnBFYLuVmzFW39LASeDh6fDWnFGC7DlWAg8h';
  const busy=new WeakSet();
  const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  function product(link){
    if(link.hasAttribute('data-battery-fast')){
      const found=link.href.match(/\/battery-v(\d+\.\d+\.\d+)\//);
      return found&&{id:'peripheral-battery',version:found[1]};
    }
    if(!link.matches('.button.primary.download'))return null;
    const found=link.href.match(/\/CodexUsageMonitor-(\d+\.\d+\.\d+)-final-setup\.exe(?:[?#]|$)/);
    return found&&{id:'codex-monitor',version:found[1]};
  }
  function statusFor(link){
    const container=link.closest('.product-info,.app-intro')||link.parentElement;
    const foot=container.querySelector('.product-foot')||container;
    let status=foot.querySelector('.backup-status,.cf-download-status');
    if(!status){status=document.createElement('span');status.className='cf-download-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');foot.appendChild(status)}
    return {status,container};
  }
  async function signedInfo(item,signal){
    const response=await fetch('update-'+item.id+'.txt',{cache:'no-store',signal});
    if(!response.ok)throw Error('更新信息不可用');
    const lines=(await response.text()).trim().split(/\r?\n/);
    if(lines.length!==2||lines[0].length>16384||lines[1].length>2048)throw Error('更新信息格式错误');
    const payload=decode(lines[0]),signature=decode(lines[1]);
    const key=await crypto.subtle.importKey('jwk',{kty:'RSA',n:publicModulus,e:'AQAB',ext:true},{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,signature,payload))throw Error('更新信息签名无效');
    const fields=new TextDecoder().decode(payload).split('\n');
    const size=Number(fields[3]);
    if(fields.length!==8||fields[0]!=='ZAOWUJI-UPDATE-1'||fields[1]!==item.id||fields[2]!==item.version||!Number.isSafeInteger(size)||size<1||size>200000000||!/^[a-f0-9]{64}$/.test(fields[4]))throw Error('网页与更新信息不一致');
    return {size,hash:fields[4]};
  }
  async function download(link,item){
    const {status,container}=statusFor(link),controller=new AbortController();
    let lastProgress=performance.now(),received=0,reason='',timer,started=performance.now();
    busy.add(link);link.setAttribute('aria-busy','true');
    status.textContent=' 正在准备下载…';
    timer=setInterval(()=>{
      const seconds=(performance.now()-started)/1000;
      if(received>0)status.textContent=` 正在下载 ${(received/1048576).toFixed(1)} MiB，平均 ${(received/1048576/Math.max(seconds,.01)).toFixed(2)} MiB/s…`;
      if(performance.now()-lastProgress>20000){reason='下载线路暂时没有响应';controller.abort()}
    },1000);
    try{
      if(!window.crypto||!crypto.subtle)throw Error('浏览器不支持安全校验');
      const [info,metaResponse]=await Promise.all([signedInfo(item,controller.signal),fetch(mirror+item.id+'/latest.json',{cache:'no-store',signal:controller.signal})]);
      if(!metaResponse.ok)throw Error('下载线路不可用');
      const meta=await metaResponse.json();
      if(meta.id!==item.id||meta.version!==item.version||meta.size!==info.size||meta.sha256!==info.hash||!Array.isArray(meta.parts)||meta.parts.length<1||meta.parts.length>20||!meta.parts.every((p,i)=>p==='part-'+String(i+1).padStart(2,'0')+'.bin'))throw Error('下载版本尚未同步');
      lastProgress=performance.now();started=performance.now();
      const parts=await Promise.all(meta.parts.map(async name=>{
        const response=await fetch(mirror+item.id+'/'+item.version+'/'+name,{cache:'no-store',signal:controller.signal});
        if(!response.ok||!response.body)throw Error('下载线路不可用');
        const reader=response.body.getReader(),pieces=[];
        while(true){const {done,value}=await reader.read();if(done)break;pieces.push(value);received+=value.byteLength;lastProgress=performance.now();if(received>info.size)throw Error('安装包大小异常')}
        return new Blob(pieces);
      }));
      clearInterval(timer);
      const blob=new Blob(parts,{type:'application/octet-stream'});
      if(blob.size!==info.size)throw Error('安装包大小不一致');
      status.textContent=' 正在校验安装包…';
      if(hex(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))!==info.hash)throw Error('安装包校验失败');
      const seconds=Math.max((performance.now()-started)/1000,.001),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=decodeURIComponent(new URL(link.href).pathname.split('/').pop());a.dataset.cfBypass='1';document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent=` 已校验，平均 ${(blob.size/1048576/seconds).toFixed(2)} MiB/s，请查看浏览器下载。`;
    }catch(error){
      controller.abort();status.textContent=' 加速线路暂不可用，正在使用备用下载…';
      const backup=item.id==='peripheral-battery'&&container.querySelector('[data-battery-backup]');
      if(backup&&!backup.disabled)backup.click();
      else{const a=document.createElement('a');a.href=link.href;a.download=link.getAttribute('download')||'';a.dataset.cfBypass='1';document.body.appendChild(a);a.click();a.remove()}
      console.warn('加速下载失败：',reason||error.message);
    }finally{clearInterval(timer);busy.delete(link);link.removeAttribute('aria-busy')}
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('a');if(!link||link.dataset.cfBypass||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    const item=product(link);if(!item)return;
    event.preventDefault();event.stopImmediatePropagation();if(!busy.has(link))download(link,item);
  },true);
})();
