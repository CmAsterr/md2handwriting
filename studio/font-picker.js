window.StudioFontPicker = (() => {
    const pickers = new Map();
    const previewURL=(id,value)=>JSON.stringify({type:id==='font'?'text':'math',name:value});
    async function loadSpecimen(image){try{const choice=JSON.parse(image.dataset.src);image.src=await PagesRuntime.previewURL(choice.type,choice.name);}catch{image.dispatchEvent(new Event('error'));}}
    function specimen(id, option) {
        const image = document.createElement('img');
        image.className = 'font-specimen';
        image.alt = `${option.text}字形预览`;
        image.width = 260; image.height = 40;
        image.dataset.src = previewURL(id, option.value);
        image.addEventListener('error', () => { image.hidden = true; const note = document.createElement('span'); note.className = 'font-preview-error'; note.textContent = '预览暂不可用'; image.after(note); }, {once: true});
        return image;
    }
    function attach(id) {
        const select = document.getElementById(id);
        if (!select) return;
        pickers.get(id)?.observer.disconnect();
        pickers.get(id)?.host.remove();
        select.hidden = true;
        const host = document.createElement('div'); host.className = 'font-picker';
        const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'font-picker-trigger'; trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', id + '-choices');
        const panel = document.createElement('div'); panel.className = 'font-picker-panel'; panel.hidden = true; panel.id = id + '-choices';
        const search = document.createElement('input'); search.type = 'search'; search.placeholder = '搜索字体名称'; search.setAttribute('aria-label', id === 'font' ? '搜索正文字体' : '搜索公式字体');
        const list = document.createElement('div'); list.className = 'font-choice-list'; list.id=id+'-font-list'; list.setAttribute('aria-label', id === 'font' ? '正文字体预览列表' : '公式字体预览列表');
        const observer = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) { const img = entry.target; loadSpecimen(img); observer.unobserve(img); } }, {root: list, rootMargin: '30px'});
        const options = Array.from(select.options);
        const close = () => {panel.hidden = true; trigger.setAttribute('aria-expanded', 'false');};
        const choose = option => {select.value = option.value; select.dispatchEvent(new Event('input', {bubbles: true}));};
        for (const option of options) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'font-choice'; button.dataset.value = option.value;
            const name = document.createElement('span'); name.className = 'font-choice-name'; name.textContent = option.text; name.title = option.text;
            const image = specimen(id, option); button.append(name, image); button.onclick = () => choose(option); list.append(button); observer.observe(image);
        }
        search.oninput = () => { for (const button of list.children) button.hidden = !button.querySelector('.font-choice-name').textContent.toLowerCase().includes(search.value.toLowerCase()); list.scrollTop = 0; };
        trigger.onclick = () => { const opening = panel.hidden; panel.hidden = !opening; trigger.setAttribute('aria-expanded', String(opening)); if (opening) {search.focus();} };
        host.addEventListener('keydown', event => {
            if (event.key === 'Escape') {close(); trigger.focus(); event.preventDefault();}
            if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !event.target.matches('input')) {
                if (panel.hidden) {trigger.click(); event.preventDefault(); return;}
                const buttons = Array.from(list.children).filter(b => !b.hidden); const index = buttons.indexOf(document.activeElement);
                const next = Math.min(buttons.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)));
                buttons[next]?.focus(); event.preventDefault();
            }
        });
        const header = document.createElement('div'); header.className = 'font-picker-search';
        const collapse = document.createElement('button'); collapse.type = 'button'; collapse.className = 'font-picker-collapse'; collapse.textContent = '收起'; collapse.setAttribute('aria-label', '收起字体列表'); collapse.onclick = () => {close(); trigger.focus();};
        const resizer=document.createElement('div');resizer.className='font-picker-resizer';resizer.tabIndex=0;resizer.setAttribute('role','separator');resizer.setAttribute('aria-orientation','horizontal');resizer.setAttribute('aria-controls',list.id);resizer.setAttribute('aria-label',id==='font'?'调整正文字体列表高度':'调整公式字体列表高度');
        resizer.title='向下拖动查看更多字体 · 双击恢复 · 上下方向键微调';resizer.innerHTML='<span class="font-resize-grip" aria-hidden="true"></span><span aria-hidden="true">拖动调高</span>';
        const storageKey='md2handwriting-font-list-height-'+id;let listHeight=202,drag=null;
        const maxHeight=()=>Math.max(240,Math.min(640,innerHeight*.75));
        function size(height){listHeight=Math.round(Math.max(96,Math.min(maxHeight(),height)));list.style.maxHeight=listHeight+'px';resizer.setAttribute('aria-valuemin','96');resizer.setAttribute('aria-valuemax',String(Math.round(maxHeight())));resizer.setAttribute('aria-valuenow',String(listHeight));resizer.setAttribute('aria-valuetext',listHeight+' 像素');}
        function persist(){try{localStorage.setItem(storageKey,String(listHeight));}catch{}}
        try{const saved=Number(localStorage.getItem(storageKey));if(Number.isFinite(saved)&&saved>=96)listHeight=saved;}catch{}size(listHeight);
        function finish(cancel=false){if(!drag)return;const previous=drag;drag=null;if(cancel)size(previous.height);else persist();document.body.classList.remove('resizing-font-list');if(resizer.hasPointerCapture(previous.id))resizer.releasePointerCapture(previous.id);}
        resizer.onpointerdown=event=>{if(event.button!==0)return;drag={id:event.pointerId,y:event.clientY,height:listHeight,visibleHeight:list.getBoundingClientRect().height};resizer.focus({preventScroll:true});resizer.setPointerCapture(event.pointerId);document.body.classList.add('resizing-font-list');event.preventDefault();};
        resizer.onpointermove=event=>{if(drag&&drag.id===event.pointerId)size(drag.visibleHeight+event.clientY-drag.y);};
        resizer.onpointerup=()=>finish();resizer.onpointercancel=()=>finish(true);resizer.onlostpointercapture=()=>finish(true);
        resizer.ondblclick=()=>{finish(true);size(202);persist();};
        resizer.onkeydown=event=>{
            if(event.key==='Escape'&&drag){finish(true);event.preventDefault();event.stopPropagation();return;}
            if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
            event.preventDefault();event.stopPropagation();size(event.key==='Home'?202:event.key==='End'?maxHeight():listHeight+(event.key==='ArrowDown'?1:-1)*(event.shiftKey?64:16));persist();
        };
        header.append(search, collapse); panel.append(header, list, resizer); host.append(trigger, panel); select.after(host);
        pickers.set(id, {host, trigger, list, observer, close, value: null}); sync(id);
    }
    function sync(id) {
        const picker = pickers.get(id), select = document.getElementById(id); if (!picker || !select) return;
        const option = select.selectedOptions[0]; if (!option) return;
        if (picker.value !== option.value) {
            picker.value = option.value;
            const name = document.createElement('span'); name.className = 'font-choice-name'; name.textContent = option.text; name.title = option.text;
            const arrow = document.createElement('span'); arrow.className = 'font-picker-arrow'; arrow.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m4 6 4 4 4-4"/></svg>'; arrow.setAttribute('aria-hidden', 'true');
            const image = specimen(id, option); loadSpecimen(image);
            picker.trigger.replaceChildren(name, arrow, image);
            picker.trigger.setAttribute('aria-label', `${id === 'font' ? '正文字体' : '公式字体'}：${option.text}，展开预览列表`);
        }
        for (const button of picker.list.children) {const active = button.dataset.value === select.value; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active));}
    }
    return { attach, syncAll() { for (const id of pickers.keys()) sync(id); } };
})();

