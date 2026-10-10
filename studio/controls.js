window.StudioControls = (() => {
    const controls = new Map();
    const chevron = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
    const check = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>';
    const descriptions = {
        paper:{plain:'干净的纯色纸面',ruled:'浅色横线辅助书写',grid:'均匀的浅色方格','photo-plain':'真实空白纸照片与纸纹','photo-ruled':'真实横线纸照片与光影',custom:'使用已上传或原稿保存的背景图'},
        scene:{scan:'平整、均匀的纸面光线',desk:'柔和的桌面光影',side:'从一侧照入的自然阴影'},
        tableStyle:{hand:'保留自然的线条起伏',ruled:'轻微弯曲，整体规整',minimal:'只保留表头与上下边线'},
        scribble:{mixed:'混合不同的涂改笔势',strike:'用一两笔划去内容',loop:'连续绕圈划除',cross:'交叉划去内容',dense:'多次圈划覆盖'},
        ink:{mixed:'混合不同的墨迹',drop:'笔尖停留的积墨',splash:'零散的细小墨点',drag:'擦蹭形成的拖痕',dry:'轻浅、断续的笔迹'}
    };
    function attach(select) {
        const label = select.getAttribute('aria-label') || select.closest('label')?.firstChild.textContent.trim() || select.id;
        const field = document.createElement('div'); field.className = 'select-field';
        const button = document.createElement('button'); button.type = 'button'; button.className = 'select-trigger';
        button.setAttribute('role','combobox'); button.setAttribute('aria-haspopup','listbox'); button.setAttribute('aria-expanded','false'); button.setAttribute('aria-controls',select.id+'-menu'); button.setAttribute('aria-label',label);
        const value = document.createElement('span'); value.className = 'select-value';
        const arrow = document.createElement('span'); arrow.className = 'select-arrow'; arrow.innerHTML = chevron;
        button.append(value,arrow); field.append(button); select.after(field); select.hidden = true;
        const panel = document.createElement('div'); panel.className = 'select-menu'; panel.id = select.id+'-menu'; panel.hidden = true;
        panel.setAttribute('role','listbox'); panel.setAttribute('aria-label',label); (select.closest('dialog') || document.body).append(panel);
        const state = {select,button,panel,value,active:0,search:'',timer:0}; controls.set(select.id,state);
        function close(focus=false) { panel.hidden=true; state.anchor=null; button.setAttribute('aria-expanded','false'); button.removeAttribute('aria-activedescendant'); if(focus)button.focus(); }
        state.close = close;
        function highlight(index) {
            state.active = index;
            [...panel.children].forEach((row,i)=>row.classList.toggle('highlighted',i===index));
            const row=panel.children[index]; if(row){button.setAttribute('aria-activedescendant',row.id);row.scrollIntoView({block:'nearest'});}
        }
        function choose(index) {
            if(select.options[index]?.disabled)return;
            select.selectedIndex=index; close();
            select.dispatchEvent(new Event('input',{bubbles:true})); select.dispatchEvent(new Event('change',{bubbles:true})); sync(select.id);
        }
        function open() {
            for(const other of controls.values())if(other!==state)other.close();
            panel.replaceChildren();
            [...select.options].forEach((option,i)=>{
                const row=document.createElement('div');row.className='select-option';row.id=panel.id+'-'+i;row.setAttribute('role','option');row.setAttribute('aria-selected',String(option.selected));row.setAttribute('aria-disabled',String(option.disabled));
                const text=document.createElement('div'),title=document.createElement('span');title.className='select-option-title';title.textContent=option.text;text.append(title);
                const description=descriptions[select.id]?.[option.value];if(description){const detail=document.createElement('span');detail.className='select-option-detail';detail.textContent=description;text.append(detail);}
                const marker=document.createElement('span');marker.className='select-check';marker.innerHTML=check;row.append(text,marker);panel.append(row);
                row.onpointerdown=e=>e.preventDefault();row.onclick=()=>choose(i);row.onpointermove=()=>{if(!option.disabled)highlight(i);};
            });
            panel.hidden=false;button.setAttribute('aria-expanded','true');
            const bounds=button.getBoundingClientRect(),width=Math.min(innerWidth-16,Math.max(bounds.width,200));
            state.anchor={left:bounds.left,top:bounds.top};
            panel.style.width=width+'px';panel.style.maxHeight=Math.min(310,innerHeight-24)+'px';
            panel.style.left=Math.max(8,Math.min(innerWidth-width-8,bounds.left))+'px';
            const height=panel.offsetHeight,below=innerHeight-bounds.bottom-8,above=bounds.top-8;
            const top=height<=below||below>=above?bounds.bottom+5:Math.max(8,bounds.top-height-5);
            panel.style.top=top+'px';panel.style.maxHeight=Math.max(80,(top>bounds.top?innerHeight-top-8:bounds.top-13))+'px';
            highlight(Math.max(0,select.selectedIndex));
        }
        button.onclick=()=>panel.hidden?open():close();
        button.onkeydown=event=>{
            const key=event.key;
            if(key==='Escape'&&!panel.hidden){close();event.preventDefault();event.stopPropagation();return;}
            if(key==='Tab'){close();return;}
            if(['ArrowDown','ArrowUp','Home','End'].includes(key)){
                event.preventDefault();if(panel.hidden){open();return;}
                const direction=key==='ArrowUp'?-1:1;
                let index=key==='Home'?0:key==='End'?select.options.length-1:Math.max(0,Math.min(select.options.length-1,state.active+direction));
                while(select.options[index]?.disabled)index+=direction;
                if(index>=0&&index<select.options.length)highlight(index);return;
            }
            if((key==='Enter'||key===' ')&&!panel.hidden){event.preventDefault();choose(state.active);return;}
            if(key.length===1&&!event.ctrlKey&&!event.metaKey&&key!==' '){
                if(panel.hidden)open();state.search+=key.toLowerCase();clearTimeout(state.timer);state.timer=setTimeout(()=>state.search='',700);
                const index=[...select.options].findIndex(o=>!o.disabled&&o.text.toLowerCase().startsWith(state.search));if(index>=0)highlight(index);event.preventDefault();
            }
        };
        select.addEventListener('change',()=>sync(select.id));sync(select.id);
    }
    function sync(id) {
        const state=controls.get(id);if(!state)return;
        const text=state.select.selectedOptions[0]?.text||'';state.value.textContent=text;state.button.title=text;state.button.disabled=state.select.disabled;
        if(!state.panel.hidden){[...state.panel.children].forEach((row,i)=>row.setAttribute('aria-selected',String(state.select.selectedIndex===i)));}
    }
    function syncAll(){for(const id of controls.keys())sync(id);for(const range of document.querySelectorAll('.settings input[type=range]')){const min=Number(range.min)||0,max=Number(range.max)||100;range.style.setProperty('--range-fill',100*(Number(range.value)-min)/(max-min)+'%');}}
    document.querySelectorAll('select:not(#font):not(#mathFont)').forEach(attach);
    document.addEventListener('pointerdown',event=>{for(const state of controls.values())if(!state.button.contains(event.target)&&!state.panel.contains(event.target))state.close();});
    document.addEventListener('scroll',event=>{for(const state of controls.values())if(!state.panel.hidden&&event.target instanceof Node&&event.target.contains(state.button)){const b=state.button.getBoundingClientRect();if(!state.anchor||Math.abs(b.left-state.anchor.left)>1||Math.abs(b.top-state.anchor.top)>1)state.close();}},true);
    window.addEventListener('resize',()=>{for(const state of controls.values())state.close();});
    return {sync,syncAll};
})();
