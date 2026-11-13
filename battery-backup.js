(()=>{
  const base='https://raw.githubusercontent.com/xiaodank99-art/xiaodank99-art.github.io/main/assets/battery-update-1-3-8-part-';
  const expected='e2e1d05b61786b35a7e6599da8cdc2ad1adfd25398a227b026c762817c48da65';
  const totalSize=56823029;
  const partSize=20*1024*1024, rangeSize=1024*1024, concurrency=32;
  const partUrl=i=>base+String(i).padStart(2,'0')+'.bin?v=1.3.8';

  document.querySelectorAll('[data-battery-backup]').forEach(button=>button.addEventListener('click',async()=>{
    const status=button.parentElement.querySelector('.backup-status');
    button.disabled=true;
    try{
      if(!window.crypto||!crypto.subtle)throw Error('此浏览器不支持完整性校验');
      const partCount=3;
      const jobs=[], remaining=[];
      for(let i=1;i<=partCount;i++){
        const length=Math.min(partSize,totalSize-(i-1)*partSize);
        if(length<=0)throw Error('下载信息不正确');
        let count=0;
        for(let start=0;start<length;start+=rangeSize){
          jobs.push({part:i,start,end:Math.min(start+rangeSize,length)-1});
          count++;
        }
        remaining[i]=count;
      }
      let completed=0,completedRanges=0,bytes=0;
      let started=performance.now();
      function report(i){status.textContent=` 正在下载（${i}/${partCount}）…`}
      function reportRanges(){
        const seconds=Math.max((performance.now()-started)/1000,0.001);
        status.textContent=` 正在下载（${completedRanges}/${jobs.length}），平均 ${(bytes/1048576/seconds).toFixed(2)} MiB/s…`;
      }
      status.textContent=' 正在准备下载…';
      const results=new Array(jobs.length), controller=new AbortController();
      let next=0;
      async function worker(){
        while(true){
          const index=next++;
          if(index>=jobs.length)return;
          const job=jobs[index];
          const response=await fetch(partUrl(job.part),{headers:{Range:`bytes=${job.start}-${job.end}`},signal:controller.signal});
          if(response.status!==206)throw Error('分段下载不可用');
          const data=await response.arrayBuffer();
          if(data.byteLength!==job.end-job.start+1)throw Error('分段数据不完整');
          results[index]=data;
          bytes+=data.byteLength;
          completedRanges++;
          if(--remaining[job.part]===0)report(++completed);
          reportRanges();
        }
      }
      const workers=Array.from({length:Math.min(concurrency,jobs.length)},()=>worker());
      let chunks;
      try{
        await Promise.all(workers);
        chunks=results;
      }catch(error){
        controller.abort();
        await Promise.allSettled(workers);
        status.textContent=' 正在切换备用方式下载…';
        started=performance.now();
        completed=0;
        chunks=await Promise.all(Array.from({length:partCount},(_,index)=>(async()=>{
          const response=await fetch(partUrl(index+1));
          if(!response.ok)throw Error('下载线路暂时不可用');
          const data=await response.arrayBuffer();
          report(++completed);
          return data;
        })()));
      }
      const blob=new Blob(chunks,{type:'application/octet-stream'});
      if(blob.size!==totalSize)throw Error('文件大小不正确');
      const seconds=Math.max((performance.now()-started)/1000,0.001);
      const speed=(blob.size/1048576/seconds).toFixed(2);
      status.textContent=' 正在校验安装包…';
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==expected)throw Error('安装包校验失败');
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='PeripheralBatteryMonitor-1.3.8-Windows-x64-Setup.exe';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent=` 已校验，平均 ${speed} MiB/s，请查看浏览器下载。`;
    }catch(error){
      status.textContent=' 下载未完成，请重试或使用直链下载。';
      console.error(error);
    }finally{button.disabled=false}
  }));
  document.querySelectorAll('[data-battery-fast]').forEach(link=>link.addEventListener('click',event=>{
    const card=link.closest('.product, .app-intro');
    const button=card&&card.querySelector('[data-battery-backup]');
    if(button){event.preventDefault();if(!button.disabled)button.click()}
  }));
})();
