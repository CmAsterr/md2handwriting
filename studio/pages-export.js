window.PagesExport=(()=>{
    'use strict';
    const R=PagesRuntime,jobs=new Map(),queue=[],active=new Set(),assetCache=new Map();let running=false,initialized;
    async function init(){if(!initialized)initialized=(async()=>{for(const key of await R.keys('job/')){const job=await R.get(key);if(['queued','layout','rendering','packaging'].includes(job.status)){job.status='interrupted';job.message='页面已关闭，可继续任务';await R.put(key,job);}jobs.set(job.id,job);}})();return initialized;}
    async function save(job){await R.put('job/'+job.id,job);}
    async function list(){await init();return [...jobs.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
    async function create(value){await init();if(!['pdf','zip','longzip'].includes(value.format))throw Error('不支持的导出格式');const job={id:crypto.randomUUID(),filename:(value.filename||'手写作业').replace(/[\\/:*?"<>|]/g,'_'),format:value.format,status:'queued',createdAt:new Date().toISOString(),percent:0,message:'等待浏览器排版',total:0,warnings:[]};await R.put('snapshot/'+job.id,value);await save(job);jobs.set(job.id,job);queue.push(job.id);pump();return{...job};}
    async function cancel(id){await init();const job=jobs.get(id);if(!job)throw Error('任务不存在');if(job.status!=='complete'){job.status='canceled';job.message='已取消，可继续';await save(job);}return{...job};}
    async function retry(id){await init();const job=jobs.get(id);if(!job)throw Error('任务不存在');if(active.has(id)||queue.includes(id))throw Error('任务正在停止，请稍后再试');job.status='queued';job.message='等待继续';await save(job);queue.push(id);pump();return{...job};}
    function check(job){if(job.status==='canceled')throw Error('EXPORT_CANCELED');}
    async function dataURL(url){if(url.startsWith('data:'))return url;const absolute=new URL(url,location.href).href;if(!assetCache.has(absolute)){if(assetCache.size>20)assetCache.delete(assetCache.keys().next().value);assetCache.set(absolute,R.nativeFetch(absolute).then(r=>{if(!r.ok)throw Error('图片读取失败');return r.blob();}).then(blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);})));}return assetCache.get(absolute);}
    async function inlineURLs(text){for(const m of [...text.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)])if(!m[1].startsWith('#'))text=text.replaceAll(m[0],'url("'+await dataURL(m[1])+'")');return text;}
    async function pageCanvas(frame,size,quality){
        const doc=frame.contentDocument,clone=doc.querySelector('.paper').cloneNode(true);frame.contentWindow.PenFonts.ensure(clone);const defs=doc.getElementById('monoline-font-defs')?.parentElement.cloneNode(true);if(defs)clone.prepend(defs);clone.style.boxShadow='none';
        for(const el of clone.querySelectorAll('img,feImage')){const attr=el.tagName.toLowerCase()==='img'?'src':'href',url=el.getAttribute(attr);if(url&&!url.startsWith('#'))el.setAttribute(attr,await dataURL(url));}
        for(const el of [clone,...clone.querySelectorAll('[style]')])if(el.style.cssText.includes('url('))el.style.cssText=await inlineURLs(el.style.cssText);
        let css=await(await R.nativeFetch(R.asset('studio/style.css'))).text();css=await inlineURLs(css);css+='\n'+[...doc.head.querySelectorAll('style')].map(s=>s.textContent).join('\n')+'\n:root{background:transparent!important}.paper{box-shadow:none!important}';
        const canvas=document.createElement('canvas');canvas.width=Math.round(size.width*quality);canvas.height=Math.round(size.height*quality);if(canvas.width*canvas.height>26000000)throw Error('纸张像素过大，请降低清晰度');
        const wrap=document.createElement('div');wrap.setAttribute('xmlns','http://www.w3.org/1999/xhtml');wrap.append(clone);const xml=new XMLSerializer().serializeToString(wrap),svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+canvas.width+'" height="'+canvas.height+'" viewBox="0 0 '+size.width+' '+size.height+'"><style>'+css.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</style><foreignObject width="'+size.width+'" height="'+size.height+'">'+xml+'</foreignObject></svg>';
        // A self-contained data SVG stays origin-clean when its foreignObject is drawn to canvas.
        const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await image.decode();canvas.getContext('2d').drawImage(image,0,0);return canvas;
    }
    const jpeg=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('图片生成失败，请降低清晰度')),'image/jpeg',.94));
    async function render(job){
        const start=performance.now(),snapshot=await R.get('snapshot/'+job.id),frame=document.createElement('iframe');let wake;
        try{wake=await navigator.wakeLock?.request('screen').catch(()=>null);check(job);job.status='layout';job.message='正在准备笔迹与分页';await save(job);
            const build=(await R.version).build;
            if(job.renderBuild!==build){for(const key of await R.keys('page/'+job.id+'/'))await R.remove(key);job.renderBuild=build;job.percent=0;await save(job);}
            Object.assign(frame.style,{position:'fixed',left:'-30000px',top:'0',border:'0',pointerEvents:'none'});frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.src=R.asset('render.html');await new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=()=>reject(Error('导出页面加载失败'));document.body.append(frame);});
            const win=frame.contentWindow;for(let i=0;!win.renderDocument&&i<200;i++)await new Promise(r=>setTimeout(r,50));if(!win.renderDocument)throw Error('导出引擎未能启动，请刷新后继续');
            const size=win.StudioCore.pageSize(snapshot.settings);frame.width=size.width;frame.height=size.height;win.jobProgress=p=>{job.message='排版 '+p.done+'/'+p.total;};
            const meta=await win.renderDocument(snapshot);check(job);job.total=meta.pages;job.warnings=meta.warnings;job.fontFallbacks=meta.fontFallbacks||[];job.status='rendering';await save(job);let totalBytes=0;
            for(let i=0;i<meta.pages;i++){check(job);const key='page/'+job.id+'/'+i;let blob=await R.get(key);if(!blob){await win.mountExportPage(i);check(job);const canvas=await pageCanvas(frame,size,snapshot.settings.quality||2);blob=await jpeg(canvas);canvas.width=canvas.height=1;check(job);await R.put(key,blob);}totalBytes+=blob.size;if(totalBytes>220*1024*1024)throw Error('导出内容较大，请分段导出或降低清晰度');job.percent=Math.round((i+1)/meta.pages*90);job.message='已生成 '+(i+1)+' / '+meta.pages+' 页';await save(job);await new Promise(r=>setTimeout(r,0));}
            check(job);job.status='packaging';job.message='正在打包文件';await save(job);let output;
            if(job.format==='pdf'){
                const pdf=new jspdf.jsPDF({unit:'mm',format:[size.widthMM,size.heightMM],orientation:size.widthMM>size.heightMM?'landscape':'portrait',compress:true});
                for(let i=0;i<meta.pages;i++){check(job);if(i)pdf.addPage([size.widthMM,size.heightMM],size.widthMM>size.heightMM?'landscape':'portrait');const blob=await R.get('page/'+job.id+'/'+i);pdf.addImage(new Uint8Array(await blob.arrayBuffer()),'JPEG',0,0,size.widthMM,size.heightMM,undefined,'FAST');}output=pdf.output('blob');
            }else{const zip=new JSZip();if(job.format==='zip'){for(let i=0;i<meta.pages;i++)zip.file('page-'+String(i+1).padStart(4,'0')+'.jpg',await R.get('page/'+job.id+'/'+i));}
                else{const quality=snapshot.settings.quality||2,w=Math.round(size.width*quality),h=Math.round(size.height*quality),per=Math.max(1,Math.min(Math.floor(16000/h),Math.floor(24000000/(w*h))));let segmentPart=0;
                    for(let i=0;i<meta.pages;){check(job);const segment=meta.segments[i],startPage=i;let count=0;while(i+count<meta.pages&&meta.segments[i+count]===segment&&count<per)count++;if(i===0||meta.segments[i-1]!==segment)segmentPart=0;segmentPart++;
                        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h*count;const ctx=canvas.getContext('2d');for(let j=0;j<count;j++){const bmp=await createImageBitmap(await R.get('page/'+job.id+'/'+(startPage+j)));ctx.drawImage(bmp,0,j*h,w,h);bmp.close();}zip.file('segment-'+segment+'-part-'+segmentPart+'.jpg',await jpeg(canvas));canvas.width=canvas.height=1;i+=count;}
                }output=await zip.generateAsync({type:'blob',compression:'STORE'});}
            check(job);await R.put('result/'+job.id,output);job.status='complete';job.percent=100;job.message='导出完成，可下载';job.bytes=output.size;job.durationMs=Math.round(performance.now()-start);await save(job);
        }catch(error){if(error.message!=='EXPORT_CANCELED'){job.status='failed';job.error=error.message;job.message='导出失败，可继续或调整设置后重试';}await save(job).catch(()=>{});}finally{frame.remove();await wake?.release().catch(()=>{});}
    }
    async function pump(){if(running)return;running=true;try{while(queue.length){const id=queue.shift(),job=jobs.get(id);if(job.status!=='queued')continue;active.add(id);await render(job);active.delete(id);}}finally{running=false;}}
    window.addEventListener('beforeunload',event=>{if(running){event.preventDefault();event.returnValue='';}});
    return{create,list,cancel,retry};
})();
