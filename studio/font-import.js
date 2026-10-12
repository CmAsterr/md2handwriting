window.StudioFontImport=(()=>{
    'use strict';
    const MAX_BYTES=25*1024*1024,MAX_FILES=100;
    const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 16V3m-4 4 4-4 4 4M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>';
    function init({refresh,choose,current}){
        const dialog=document.createElement('dialog');dialog.id='font-import-dialog';dialog.setAttribute('aria-labelledby','font-import-title');dialog.setAttribute('aria-describedby','font-import-help');
        dialog.innerHTML=`<div class="font-import-heading"><div><span class="font-import-eyebrow">你的字体库</span><h2 id="font-import-title">导入字体</h2><p id="font-import-help">一次选择多个字体，导入后预览并选用。</p></div><button type="button" id="font-import-close" aria-label="关闭字体导入"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div>
        <div class="font-import-types" role="group" aria-label="导入到哪个字体库"><button type="button" data-font-type="text" aria-pressed="true">正文字体</button><button type="button" data-font-type="math" aria-pressed="false">公式字体</button></div>
        <button type="button" id="font-drop-zone">${icon}<span id="font-drop-title">选择字体，或拖到这里</span><span class="font-drop-hint">TTF / OTF / WOFF / WOFF2 · 可多选 · 每个最多 25 MB</span></button>
        <p id="font-import-context">导入到正文字体库。字体只保存在此浏览器。</p><p id="font-import-error" role="alert" hidden></p>
        <div id="font-import-results" hidden><div class="font-import-list-heading"><strong id="font-import-count">本次导入</strong><button type="button" id="font-import-clear" title="只清空本次记录，不删除字体">清空记录</button></div><ul id="font-import-list" aria-label="字体导入结果"></ul></div>
        <footer class="font-import-footer"><div><p id="font-import-status" role="status" aria-live="polite">支持批量导入，已有字体会自动识别。</p><progress id="font-import-progress" aria-label="字体导入进度" hidden></progress><span id="font-import-background" hidden>关闭面板后仍会继续，请保留当前网页。</span></div><button type="button" class="primary" id="font-import-done">完成</button></footer>`;
        document.body.append(dialog);
        const $=id=>document.getElementById(id),list=$('font-import-list'),rows=[],views=new Map();let type='text',busy=false,nextId=1,dragDepth=0;
        const finished=r=>['complete','duplicate','failed'].includes(r.status);
        const label=t=>t==='math'?'公式':'正文';
        const size=n=>n>=1024*1024?(n/(1024*1024)).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
        const error=message=>{$('font-import-error').textContent=message;$('font-import-error').hidden=!message;};
        function rowView(row){
            if(views.has(row.id))return views.get(row.id);
            const el=document.createElement('li');el.className='font-import-row';el.dataset.importId=row.id;
            const mark=document.createElement('span');mark.className='font-import-mark';mark.setAttribute('aria-hidden','true');
            const content=document.createElement('div');content.className='font-import-info';const name=document.createElement('strong'),meta=document.createElement('span');meta.className='font-import-meta';
            const preview=document.createElement('img');preview.className='font-import-specimen';preview.width=354;preview.height=46;preview.loading='lazy';preview.hidden=true;preview.onerror=()=>{preview.hidden=true;};
            const note=document.createElement('p');note.className='font-import-note';note.hidden=true;content.append(name,meta,preview,note);
            const action=document.createElement('button');action.type='button';action.className='font-import-action';
            action.onclick=async()=>{
                if(row.result){action.disabled=true;try{await choose(row.type,row.result.name);update();}catch(e){error('字体已保存，但未能选用：'+e.message);}finally{action.disabled=false;}}
                else if(row.status==='failed'&&row.retryable){row.status='queued';row.message='等待导入';row.progress=0;error('');update();pump();}
                else if(row.status==='queued'||row.status==='failed'){const index=rows.indexOf(row);if(index>=0)rows.splice(index,1);row.file=null;el.remove();views.delete(row.id);update();}
            };
            el.append(mark,content,action);list.append(el);const view={el,mark,name,meta,preview,note,action};views.set(row.id,view);return view;
        }
        function update(){
            const pending=rows.filter(r=>!finished(r)),done=rows.length-pending.length,added=rows.filter(r=>r.status==='complete').length,existing=rows.filter(r=>r.status==='duplicate').length,failed=rows.filter(r=>r.status==='failed').length;
            for(const row of rows){
                const v=rowView(row);v.el.hidden=row.type!==type;v.el.dataset.state=row.status;v.name.textContent=row.result?.displayName||row.name;v.name.title=row.name;
                v.mark.textContent=row.result?'✓':row.status==='failed'?'!':'Aa';v.meta.textContent=size(row.size)+' · '+row.message;
                v.note.textContent=row.result?.warnings?.join(' ')||'';v.note.hidden=!v.note.textContent;
                if(row.result&&!v.preview.dataset.requested){v.preview.dataset.requested='1';v.preview.alt=row.result.displayName+'字形预览';PagesRuntime.previewURL(row.type,row.result.name).then(url=>{v.preview.src=url;v.preview.hidden=false;}).catch(()=>{v.note.textContent='预览暂不可用，可以重新选用。';v.note.hidden=false;});}
                v.action.hidden=!row.result&&!['queued','failed'].includes(row.status);
                if(row.result){const selected=current(row.type)===row.result.name;v.action.textContent=selected?'已选用':'使用';v.action.setAttribute('aria-label',(selected?'已选用':'使用')+row.result.displayName+'作为'+label(row.type)+'字体');v.action.setAttribute('aria-pressed',String(selected));v.el.classList.toggle('is-selected',selected);}
                else{v.action.textContent=row.status==='failed'&&row.retryable?'重试':'移除';v.action.setAttribute('aria-label',v.action.textContent+row.name);}
            }
            const count=rows.filter(r=>r.type===type).length;$('font-import-results').hidden=!count;$('font-import-count').textContent=label(type)+'字体 · '+count+' 个';
            $('font-import-clear').disabled=busy;$('font-import-progress').hidden=!pending.length;$('font-import-progress').max=rows.length||1;$('font-import-progress').value=done+pending.reduce((n,r)=>n+(r.progress||0),0);
            $('font-import-background').hidden=!pending.length;
            $('font-import-status').textContent=pending.length?`正在处理 ${done+1} / ${rows.length}，完成后可直接选用。`:rows.length?`新增 ${added} · 已有 ${existing}${failed?' · 未导入 '+failed:''}`:'支持批量导入，已有字体会自动识别。';
            for(const button of document.querySelectorAll('[data-import-font]')){const n=pending.filter(r=>r.type===button.dataset.importFont).length;button.querySelector('span').textContent=n?'导入中 '+n:'导入';button.classList.toggle('is-importing',n>0);}
        }
        function setType(value){type=value;for(const b of dialog.querySelectorAll('[data-font-type]'))b.setAttribute('aria-pressed',String(b.dataset.fontType===type));$('font-import-context').textContent=type==='text'?'导入到正文字体库。字体只保存在此浏览器。':'导入到公式字体库，用于字母和数字；缺少的字符保留标准数学字形。';update();}
        function open(value){setType(value);error('');if(!dialog.open)dialog.showModal();$('font-drop-zone').focus();}
        function read(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('文件读取失败，请重新选择'));reader.readAsDataURL(file);});}
        async function upload(row,base64){row.progress=.5;row.message='正在检查并保存字体…';update();const response=await fetch('/md2handwriting/api/font',{method:'POST',body:JSON.stringify({name:row.name,type:row.type,base64})}),result=await response.json();if(!response.ok){const e=Error(result.error||'导入失败');e.retryable=false;throw e;}return result;}
        async function pump(){
            if(busy)return;busy=true;update();let imported=false;
            try{
                for(let row; (row=rows.find(r=>r.status==='queued'));){
                    row.status='processing';row.message='正在读取文件…';update();
                    try{const result=await upload(row,await read(row.file));row.result=result;row.status=result.duplicate?'duplicate':'complete';row.message=result.duplicate?'字体库中已有':'已导入';row.progress=1;row.file=null;imported=true;}
                    catch(e){row.status='failed';row.message=e.message;row.retryable=e.retryable!==false;row.progress=0;if(!row.retryable)row.file=null;}
                    update();
                }
                if(imported)try{await refresh();}catch(e){error('字体已保存，刷新字体列表失败：'+e.message+'。可以重试选用或刷新网页。');}
            }finally{busy=false;update();if(rows.some(r=>r.status==='queued'))pump();}
        }
        function add(files){
            error('');const incoming=Array.from(files),available=MAX_FILES-rows.length;
            if(incoming.length>available)error(`一次最多保留 ${MAX_FILES} 条记录，本次只加入前 ${Math.max(0,available)} 个文件；完成后可清空记录继续导入。`);
            for(const file of incoming.slice(0,Math.max(0,available))){
                let message='等待导入';if(!/\.(ttf|otf|woff2?)$/i.test(file.name))message='格式不支持，请选择 TTF、OTF、WOFF 或 WOFF2';else if(!file.size)message='文件为空，请重新选择';else if(file.size>MAX_BYTES)message='超过 25 MB，请选择较小的字体文件';
                rows.push({id:nextId++,name:file.name,size:file.size,type,file:message==='等待导入'?file:null,status:message==='等待导入'?'queued':'failed',message,retryable:false,progress:0});
            }
            update();pump();
        }
        for(const button of document.querySelectorAll('[data-import-font]'))button.onclick=()=>open(button.dataset.importFont);
        for(const [id,value]of [['font-file','text'],['math-font-file','math']])$(id).onchange=()=>{setType(value);const files=Array.from($(id).files);$(id).value='';if(files.length)add(files);};
        for(const b of dialog.querySelectorAll('[data-font-type]'))b.onclick=()=>setType(b.dataset.fontType);
        $('font-drop-zone').onclick=()=>$(type==='text'?'font-file':'math-font-file').click();
        const isFiles=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
        dialog.addEventListener('dragenter',e=>{if(isFiles(e)){e.preventDefault();dragDepth++;$('font-drop-zone').classList.add('is-dragging');}});
        dialog.addEventListener('dragover',e=>{if(isFiles(e)){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
        dialog.addEventListener('dragleave',e=>{if(isFiles(e)&&--dragDepth<=0){dragDepth=0;$('font-drop-zone').classList.remove('is-dragging');}});
        dialog.addEventListener('drop',e=>{if(isFiles(e)){e.preventDefault();dragDepth=0;$('font-drop-zone').classList.remove('is-dragging');add(e.dataTransfer.files);}});
        for(const id of ['font-import-close','font-import-done'])$(id).onclick=()=>dialog.close();
        dialog.addEventListener('close',()=>{dragDepth=0;$('font-drop-zone').classList.remove('is-dragging');});
        $('font-import-clear').onclick=()=>{if(busy)return;for(const row of rows)row.file=null;rows.length=0;views.clear();list.replaceChildren();error('');update();};
        update();return{open};
    }
    return{init};
})();
