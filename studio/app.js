(() => {
    'use strict';
    const $=id=>document.getElementById(id),C=StudioCore;
    let settings={...C.defaults},layout=StudioBlocks.normalize(),result=null,pageIndex=0,revision=0,backgroundRevision=0,renderPromise=null,renderedRevision=-1,renderError=null,renderTimer,saveTimer,toastTimer,saveQueue=Promise.resolve(),jobSignature='';
    const example=String.raw`# 线性代数与微积分

## 1. 多行推导
设 $f(x)=x^2+2x+1$，则

$$
\begin{aligned}
f'(x)&=2x+2 \\
\int_0^1 f(x)\,dx &= \left[\frac{x^3}{3}+x^2+x\right]_0^1 \\
&=\frac{1}{3}+1+1=\frac{7}{3}.
\end{aligned}
$$

## 2. 矩阵与方程组
$$
A=\begin{pmatrix}1&2&3\\0&1&4\\5&6&0\end{pmatrix},\qquad
\left\{\begin{aligned}x+2y+3z&=1\\y+4z&=2\\5x+6y&=3\end{aligned}\right.
$$

原计算结果为 ~~$\det A=0$~~，\textcolor{red}{应修正为 $\det A=1$}。[ink]

---

## 3. 保留结构的分数与分段函数
$$
F(x)=\frac{x^4+2x^3+3x^2+4x+5}{(x+1)(x^2+1)(x^2+2x+3)}
$$

$$
g(x)=\begin{cases}
\dfrac{\sin x}{x},&x\ne0,\\
1,&x=0.
\end{cases}
$$

- 分数线保持连续，不添加锯齿滤镜。
- 矩阵与大括号作为完整公式参与排版。
- 导出时保持此页面打开；关闭后可从导出记录手动继续。

| 项目 | 结论 |
| --- | --- |
| $\det A$ | $1$ |
| $\lim_{x\to 0}g(x)$ | $1$ |
`;
    function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
    async function api(url,options={}){const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers}});const value=await response.json();if(!response.ok)throw new Error(value.error||`HTTP ${response.status}`);return value;}
    function controls(){
        for(const el of document.querySelectorAll('[data-setting]')){el.value=settings[el.id];const output=document.querySelector(`output[for="${el.id}"]`);if(output)output.textContent=el.value;}
        const size=C.pageSize(settings);$('page-format').value=size.preset;
        $('page-width').value=size.widthMM;$('page-height').value=size.heightMM;
        $('page-size-note').textContent=`宽高 50–420 mm · 排版区约 ${(size.contentWidth*210/800).toFixed(1)} × ${(size.contentHeight*210/800).toFixed(1)} mm。字号保持不变，自动重新分页。`;
        for(const option of $('quality').options)option.textContent=`${{1:'快速',2:'清晰',3:'精细'}[option.value]} · ${size.width*Number(option.value)} × ${size.height*Number(option.value)} 像素`;
        $('paper').querySelector('[value="custom"]').disabled=!settings.background;
        $('recrop-background').hidden=!settings.background;
        $('clear-background').hidden=!C.paperImage(settings);
        $('clear-background').textContent=settings.paper==='custom'?'移除图片背景':'改用空白纸';
        for(const button of document.querySelectorAll('[data-paper-type]'))button.setAttribute('aria-pressed',String(settings.paper===button.dataset.paperType));
        window.StudioFontPicker?.syncAll();window.StudioControls?.syncAll();
    }
    function snapshot(){return{markdown:$('source').value,settings:{...settings},layout:StudioBlocks.normalize(layout)};}
    function save(){const value=snapshot();$('save-status').textContent='正在保存…';
        saveQueue=saveQueue.catch(()=>{}).then(()=>api('/md2handwriting/api/draft',{method:'PUT',body:JSON.stringify(value)})).then(()=>{$('save-status').textContent='已保存到此浏览器';}).catch(error=>{$('save-status').textContent='保存失败';toast(error.message);});return saveQueue;
    }
    function schedule(){revision++;clearTimeout(renderTimer);clearTimeout(saveTimer);$('character-count').textContent=`${$('source').value.length.toLocaleString()} 字符`;$('layout-status').textContent='等待更新…';saveTimer=setTimeout(save,450);renderTimer=setTimeout(render,650);}
    function render(){
        clearTimeout(renderTimer);
        if(renderPromise)return renderPromise;
        renderPromise=(async()=>{do{
        const current=revision,source=$('source').value,options={...settings};$('layout-status').textContent='正在排版…';const started=performance.now();
        renderError=null;
        try{
            const next=await StudioLayout.paginate(source,options,p=>{$('layout-status').textContent=`排版 ${p.done}/${p.total}`;},()=>revision!==current,12,{},layout);
            while(window.StudioEditor?.dragging&&revision===current)await new Promise(r=>setTimeout(r,30));
            if(revision!==current)continue;
            result=next;pageIndex=Math.min(pageIndex,Math.max(0,result.pages.length-1));display();
            renderedRevision=current;
            $('layout-status').textContent=`${result.pages.length}${result.truncated?'+':''} 页 · ${((performance.now()-started)/1000).toFixed(1)} 秒`;
            $('warnings').textContent=result.warnings.join(' ');$('warnings').hidden=!result.warnings.length;
            const size=C.pageSize(result.settings);$('preview-note').textContent=`${size.widthMM} × ${size.heightMM} mm${result.truncated?' · 预览前 12 页':''}`;
        }catch(error){if(error.message!=='LAYOUT_CANCELED'){renderError=error;$('layout-status').textContent='排版失败';toast(error.message);console.error(error);}}
        if(revision===current)break;
        }while(true);})().finally(()=>{renderPromise=null;});
        return renderPromise;
    }
    function display(){if(!result)return;StudioLayout.mount(result,pageIndex,$('paper-host'));$('empty-state').hidden=!!result.pages.length;$('paper-wrap').hidden=!result.pages.length;$('page-label').textContent=`${result.pages.length?pageIndex+1:0} / ${result.pages.length}${result.truncated?'+':''}`;$('prev-page').disabled=pageIndex<=0;$('next-page').disabled=pageIndex>=result.pages.length-1;StudioPreview.refresh();StudioEditor.mount(result,pageIndex);}
    const statuses={queued:'等待',layout:'排版中',rendering:'生成图片',packaging:'写入文件',complete:'已完成',failed:'失败',canceled:'已取消',interrupted:'已中断'};
    async function poll(){try{
        const jobs=await api('/md2handwriting/api/jobs');const signature=JSON.stringify(jobs);if(signature===jobSignature)return;jobSignature=signature;
        $('job-count').textContent=jobs.filter(j=>['queued','layout','rendering','packaging'].includes(j.status)).length||jobs.length;
        const host=$('jobs-list');host.replaceChildren();if(!jobs.length){host.innerHTML='<p class="job-intro">还没有导出任务。</p>';return;}
        for(const job of jobs){const card=document.createElement('div');card.className='job-card';card.dataset.job=job.id;
            card.innerHTML=`<div class="job-top"><strong>${C.escape(job.filename)}</strong><span class="job-state">${statuses[job.status]||job.status}</span></div><div class="job-meta">${C.escape(job.message)}<br>${new Date(job.createdAt).toLocaleString('zh-CN')} · ${job.format.toUpperCase()}${job.durationMs?' · '+(job.durationMs/1000).toFixed(1)+' 秒':''}${job.bytes?' · '+(job.bytes/1048576).toFixed(1)+' MB':''}</div><progress max="100" value="${job.percent}"></progress>${job.error?`<p class="job-error">${C.escape(job.error)}</p>`:''}${job.warnings?.length?`<p class="job-warning">${job.warnings.map(C.escape).join('<br>')}</p>`:''}<div class="job-actions"></div>`;
            const actions=card.querySelector('.job-actions');
            if(job.status==='complete'){const a=document.createElement('a');a.textContent='下载文件';a.href=await PagesRuntime.downloadURL(job.id);a.download=job.filename+(job.format==='pdf'?'.pdf':'.zip');actions.append(a);}
            else{const button=document.createElement('button');const resume=['failed','interrupted','canceled'].includes(job.status);button.textContent=resume?'继续任务':'取消';button.onclick=async()=>{button.disabled=true;try{await api(`/md2handwriting/api/jobs/${job.id}/${resume?'retry':'cancel'}`,{method:'POST',body:'{}'});jobSignature='';}catch(e){toast(e.message);}finally{button.disabled=false;}};actions.append(button);}
            host.append(card);
        }
    }catch(error){$('save-status').textContent='浏览器存储暂不可用';}finally{setTimeout(poll,1500);}}
    async function fonts(){const list=await api('/md2handwriting/api/fonts');const names={'ChenYuluoyan-2.0-Thin.ttf':'辰宇落雁体','HongLeiZhuoShuJianTi-2.ttf':'洪雷拙书','LiXuKeJingDianXingShu-2.ttf':'李旭科行书','Yozai-Medium.ttf':'悠哉字体','FanMengWenRouNaiLaoTi-2.ttf':'温柔奶酪体','handwritten-fixed.ttf':'默认手写体（修复版）'};for(const [id,items] of [['font',list.text],['mathFont',list.math]]){const select=$(id);select.replaceChildren();if(id==='mathFont')select.add(new Option('标准数学字形',''));for(const file of items){if(file==='handwritten.ttf')continue;select.add(new Option(names[file]||file.replace(/\.(ttf|otf|woff2?)$/i,''),file));}}controls();StudioFontPicker.attach('font');StudioFontPicker.attach('mathFont');}
    async function uploadFont(input,type){const file=input.files[0];if(!file)return;try{toast('正在导入字体…');const data=await dataURL(file);const response=await api('/md2handwriting/api/font',{method:'POST',body:JSON.stringify({name:file.name,type,base64:data.split(',')[1]})});await fonts();settings[type==='math'?'mathFont':'font']=response.name;controls();schedule();toast('字体已保存到此浏览器');}catch(e){toast(e.message);}input.value='';}
    const dataURL=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
    function download(blob,name){const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
    $('source').addEventListener('input',schedule);
    function setPageSize(width,height){backgroundRevision++;settings=C.settings({...settings,pageWidth:width,pageHeight:height});controls();schedule();}
    $('page-format').addEventListener('change',()=>{const selected=C.paperSizes[$('page-format').value];if(selected){const landscape=settings.pageWidth>settings.pageHeight;setPageSize(...(landscape?[selected[1],selected[0]]:selected));}else{$('page-width').focus();$('page-width').select();}});
    for(const input of [$('page-width'),$('page-height')]){
        input.addEventListener('change',()=>{if(!$('page-width').checkValidity()||!$('page-height').checkValidity()){input.reportValidity();return;}setPageSize(Number($('page-width').value),Number($('page-height').value));});
        input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();input.blur();}});
    }
    $('page-rotate').onclick=()=>setPageSize(settings.pageHeight,settings.pageWidth);
    for(const el of document.querySelectorAll('[data-setting]'))el.addEventListener('input',()=>{if(el.id==='paper')backgroundRevision++;settings=C.settings({...settings,[el.id]:el.type==='range'?Number(el.value):el.value});controls();schedule();});
    $('new-seed').onclick=()=>{settings.seed=1+Math.floor(Math.random()*2147483646);schedule();};
    $('refresh').onclick=()=>{revision++;clearTimeout(renderTimer);save();render();};
    document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key==='Enter'){$('refresh').click();e.preventDefault();}});
    $('prev-page').onclick=()=>{pageIndex--;display();};$('next-page').onclick=()=>{pageIndex++;display();};
    $('jobs-toggle').onclick=()=>$('jobs-panel').hidden=!$('jobs-panel').hidden;$('jobs-close').onclick=()=>$('jobs-panel').hidden=true;
    $('export-button').onclick=()=>{if($('page-width').reportValidity()&&$('page-height').reportValidity())$('export-dialog').showModal();};$('export-close').onclick=()=>$('export-dialog').close();
    $('export-form').onsubmit=async event=>{event.preventDefault();const button=$('submit-export');button.disabled=true;button.textContent='正在确认预览…';
        try{
            // A newly selected background may still be waiting for image decode or
            // the preview debounce. Export only the revision that actually mounted.
            if(renderedRevision!==revision)await render();
            if(renderedRevision!==revision)throw renderError||new Error('预览未能更新，请稍后重试');
            const document=snapshot();document.settings={...document.settings,quality:Number($('quality').value),backgroundSource:'',backgroundCrop:null};
            await api('/md2handwriting/api/jobs',{method:'POST',body:JSON.stringify({...document,filename:$('filename').value,format:$('format').value})});$('export-dialog').close();$('jobs-panel').hidden=false;toast('正在浏览器中导出，请保持页面打开');
        }catch(error){toast(error.message);}finally{button.disabled=false;button.textContent='开始导出';}
    };
    $('font-file').onchange=()=>uploadFont($('font-file'),'text');$('math-font-file').onchange=()=>uploadFont($('math-font-file'),'math');
    $('content-image').onchange=async()=>{const file=$('content-image').files[0];if(!file)return;try{const data=await dataURL(file);const asset=await api('/md2handwriting/api/image',{method:'POST',body:JSON.stringify({base64:data.split(',')[1]})});const source=$('source'),insert=`\n\n![${file.name.replace(/[\[\]]/g,'')}](${asset.url})\n\n`;source.setRangeText(insert,source.selectionStart,source.selectionEnd,'end');schedule();}catch(error){toast(error.message);}$('content-image').value='';};
    async function setBackground(input,crop){const request=++backgroundRevision;
        try{const chosen=await StudioPaperCrop.open(input,crop,()=>request===backgroundRevision,settings);
            if(!chosen||request!==backgroundRevision)return;
            settings=C.settings({...settings,paper:'custom',...chosen});controls();schedule();
        }catch(error){if(request===backgroundRevision)toast('背景图片读取失败：'+error.message);}
    }
    $('import-background').onclick=()=>$('background-file').click();
    $('recrop-background').onclick=()=>setBackground(settings.backgroundSource||settings.background,settings.backgroundCrop);
    $('background-file').onchange=()=>{const file=$('background-file').files[0];if(file)setBackground(file);$('background-file').value='';};
    document.querySelectorAll('[data-paper-type]').forEach(button=>button.onclick=()=>{$('paper').value=button.dataset.paperType;$('paper').dispatchEvent(new Event('input',{bubbles:true}));});
    $('clear-background').onclick=()=>{backgroundRevision++;settings=C.settings({...settings,paper:'plain',background:settings.paper==='custom'?'':settings.background});controls();schedule();};
    $('import-button').onclick=()=>$('import-file').click();$('import-file').onchange=async()=>{const file=$('import-file').files[0];if(!file)return;try{const text=await file.text();if(file.name.endsWith('.json')){const draft=JSON.parse(text);if(typeof draft.markdown!=='string')throw new Error('不是有效的源稿文件');backgroundRevision++;layout=StudioBlocks.normalize(draft.layout);StudioEditor.resetHistory();settings=C.settings(draft.settings);$('source').value=draft.markdown;controls();}else{layout=StudioBlocks.normalize();StudioEditor.resetHistory();$('source').value=text;}pageIndex=0;schedule();}catch(e){toast(e.message);}$('import-file').value='';};
    $('save-source').onclick=()=>download(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}),'手写源稿.json');
    $('load-example').onclick=()=>{if($('source').value.trim())download(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}),'载入示例前的源稿.json');layout=StudioBlocks.normalize();StudioEditor.resetHistory();$('source').value=example;pageIndex=0;schedule();};
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){clearTimeout(saveTimer);fetch('/md2handwriting/api/draft',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot()),keepalive:true}).catch(()=>{});}});
    window.StudioApp={snapshot,render,get result(){return result;},get example(){return example;},applyLayout(value){layout=StudioBlocks.normalize(value);if(result)result.layout=layout;StudioEditor.refresh();schedule();},setDocument(markdown,options={},manual={}){backgroundRevision++;layout=StudioBlocks.normalize(manual);settings=C.settings(options);$('source').value=markdown;StudioEditor.resetHistory();controls();revision++;return render();}};
    (async()=>{try{const draft=await api('/md2handwriting/api/draft');if(draft){settings=C.settings(draft.settings);layout=StudioBlocks.normalize(draft.layout);$('source').value=draft.markdown||'';}else $('source').value=example;await fonts();$('save-status').textContent=draft?'已恢复浏览器源稿':'示例文稿';$('character-count').textContent=`${$('source').value.length} 字符`;await render();}catch(e){toast(e.message);}poll();})();
})();
