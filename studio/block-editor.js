window.StudioEditor=(()=>{
    'use strict';
    const $=id=>document.getElementById(id),B=StudioBlocks,viewport=document.querySelector('.preview-scroll'),host=$('paper-host');
    const names={heading:'标题',paragraph:'段落',formula:'公式',table:'表格',image:'图片',code:'代码',quote:'引用',list:'列表项'};
    let enabled=false,panKey=false,result=null,pageIndex=0,selected=new Set(),overlay=null,gesture=null,frame=0,pending=null,history=[],historyIndex=-1;
    const clone=value=>JSON.parse(JSON.stringify(value)),current=()=>StudioApp.snapshot().layout,records=()=>result?.pages[pageIndex]?.blocks||[];
    const view=(record,layout=current())=>B.view(gesture?.reflowBlock?.id===record.id?gesture.reflowBlock:record,layout.blocks[record.id]);
    function expanded(ids,layout=current()){const groups=new Set([...ids].map(id=>layout.blocks[id]?.group).filter(Boolean));return new Set(records().filter(b=>ids.has(b.id)||groups.has(layout.blocks[b.id]?.group)).map(b=>b.id));}
    const chosen=()=>records().filter(b=>selected.has(b.id));
    const views=(layout=current())=>chosen().map(b=>view(b,layout));
    function scale(){const paper=host.querySelector('.paper');return paper?paper.getBoundingClientRect().width/paper.offsetWidth:1;}
    function coordinates(event){const r=host.querySelector('.paper').getBoundingClientRect(),k=scale();return{x:(event.clientX-r.left)/k,y:(event.clientY-r.top)/k};}
    function groupBox(items){if(items.length===1)return{...items[0]};const box=B.bounds(items);return{x:box.x,y:box.y,width:box.right-box.x,height:box.bottom-box.y,rotation:0};}
    function boxElement(v,className){const e=document.createElement('div');e.className=className;Object.assign(e.style,{left:v.x+'px',top:v.y+'px',width:v.width+'px',height:v.height+'px',transform:`rotate(${v.rotation||0}deg)`});return e;}
    function draw(layout=current(),ghost=null){
        if(!overlay)return;overlay.replaceChildren();overlay.hidden=!enabled;if(!enabled)return;
        const items=views(layout);for(const v of items){const border=boxElement(v,'block-selection'+(v.locked?' locked':''));overlay.append(border);}
        if(ghost){const rect=boxElement(ghost,'block-marquee');overlay.append(rect);}
        if(!items.length)return;const box=groupBox(items),controls=boxElement(box,'block-handles');overlay.append(controls);
        if(items.some(v=>v.locked))return;
        const single=items.length===1;
        for(const position of (single?Object.keys(B.handles):['nw','ne','se','sw'])){const handle=document.createElement('button');handle.type='button';handle.dataset.handle=position;handle.className='block-handle '+position;const corner=position.length===2,label={nw:'左上角',n:'上边',ne:'右上角',e:'右边',se:'右下角',s:'下边',sw:'左下角',w:'左边'}[position],reflow=single&&['e','w'].includes(position)&&B.reflowable(chosen()[0].type);handle.setAttribute('aria-label','从'+label+(reflow?'调整排版宽度':single?'拉伸':'等比缩放'));handle.title=reflow?(chosen()[0].type==='formula'?'调整公式框宽，保留内部结构并等比适配':'调整文本框宽，文字与行内公式重新换行'):(single?(corner?'拖动自由拉伸，Shift 等比缩放':'拖动单向拉伸，保持对边不动'):'多选整体等比缩放；单独选择可自由拉伸');controls.append(handle);}
        const rotate=document.createElement('button');rotate.type='button';rotate.dataset.handle='rotate';rotate.className='block-handle rotate';rotate.setAttribute('aria-label','旋转选中内容');rotate.title='拖动旋转，Shift 吸附到 15°';controls.append(rotate);
    }
    function properties(){
        const blocks=chosen(),items=views(),single=blocks.length===1,locked=items.some(v=>v.locked);
        $('block-count').textContent=blocks.length?`选中 ${blocks.length} 块${locked?' · 已锁定':blocks.length>1?' · 整体等比缩放':''}`:'点击内容，或拖出框选';
        for(const id of ['block-group','block-ungroup','block-lock','block-reset','block-align-left','block-align-center'])$(id).disabled=!blocks.length;
        $('block-group').disabled=blocks.length<2;$('block-ungroup').disabled=!items.some(v=>v.group);$('block-lock').textContent=blocks.length&&items.every(v=>v.locked)?'解锁':'锁定';
        $('block-align-left').disabled=blocks.length<2||locked;$('block-align-center').disabled=blocks.length<2||locked;
        $('block-undo').disabled=historyIndex<=0;$('block-redo').disabled=historyIndex>=history.length-1;
        const values=single?{'block-x':items[0].x/B.PX,'block-y':items[0].y/B.PX,'block-scale':items[0].scale/(blocks[0].autoScale||1)*100,'block-stretch-x':items[0].stretchX*100,'block-stretch-y':items[0].stretchY*100,'block-angle':items[0].rotation,'block-width':blocks[0].width/B.PX}:{};
        for(const id of ['block-x','block-y','block-scale','block-stretch-x','block-stretch-y','block-angle','block-width']){const input=$(id);input.disabled=!single||locked||id==='block-width'&&!B.reflowable(blocks[0]?.type);if(document.activeElement!==input)input.value=single?Number(values[id].toFixed(2)):'';}
        $('block-select').value=single?blocks[0].id:'';StudioControls.sync('block-select');
        $('block-clear-missing').disabled=!result||result.truncated||!Object.keys(current().blocks).some(id=>!result.pages.some(p=>p.blocks.some(b=>b.id===id)));
    }
    function live(layout){for(const block of records()){const shell=host.querySelector(`[data-block-id="${block.id}"]`);if(shell)StudioLayout.setBlockView(shell,block,{...result,layout});}draw(layout);}
    function commit(next){next=B.normalize(next);const before=current();if(JSON.stringify(next)===JSON.stringify(before))return;
        if(historyIndex<0){history=[clone(before)];historyIndex=0;}history=history.slice(0,historyIndex+1);history.push(clone(next));if(history.length>80)history.shift();historyIndex=history.length-1;
        StudioApp.applyLayout(next);live(next);properties();
    }
    function editView(layout,block,v){const clamp=x=>Math.max(-1000,Math.min(1000,x));const edit={...layout.blocks[block.id],x:clamp(v.x/B.PX),y:clamp(v.y/B.PX),scale:Math.max(.25,Math.min(4,v.scale/(block.autoScale||1))),rotation:B.angle(v.rotation)};for(const key of ['stretchX','stretchY']){if(v[key]!==1||edit[key]!==undefined)edit[key]=Math.max(.25,Math.min(4,v[key]??1));}delete edit.dx;delete edit.dy;layout.blocks[block.id]=edit;}
    function snap(dx,dy,g){if(!$('block-snap').checked||g.alt)return{dx,dy};const bounds=B.bounds(g.views),threshold=6/scale(),xs=[result.size.marginX,result.size.width/2,result.size.width-result.size.marginX],ys=[result.size.marginY,result.size.height/2,result.size.height-result.size.marginY];
        for(const block of records())if(!selected.has(block.id)){const b=B.bounds([view(block,g.before)]);xs.push(b.x,(b.x+b.right)/2,b.right);ys.push(b.y,(b.y+b.bottom)/2,b.bottom);}
        const nearest=(points,targets)=>{let shift=0,best=threshold;for(const a of points)for(const b of targets)if(Math.abs(b-a)<best){best=Math.abs(b-a);shift=b-a;}return shift;};
        return{dx:dx+nearest([bounds.x+dx,(bounds.x+bounds.right)/2+dx,bounds.right+dx],xs),dy:dy+nearest([bounds.y+dy,(bounds.y+bounds.bottom)/2+dy,bounds.bottom+dy],ys)};
    }
    function updateGesture(event,force=false){if(!gesture)return;const g=gesture,p=coordinates(event);g.alt=event.altKey;g.lastEvent=event;
        if(g.mode==='marquee'){const box={x:Math.min(g.start.x,p.x),y:Math.min(g.start.y,p.y),width:Math.abs(p.x-g.start.x),height:Math.abs(p.y-g.start.y)};
            const hits=records().filter(b=>{const v=B.bounds([view(b)]);return v.x<=box.x+box.width&&v.right>=box.x&&v.y<=box.y+box.height&&v.bottom>=box.y;}).map(b=>b.id);selected=expanded(new Set([...g.initial,...hits]));draw(current(),box);properties();return;}
        const next=clone(g.before);let dx=p.x-g.start.x,dy=p.y-g.start.y;
        if(g.mode==='move'){({dx,dy}=snap(dx,dy,g));for(let i=0;i<g.blocks.length;i++)editView(next,g.blocks[i],{...g.views[i],x:g.views[i].x+dx,y:g.views[i].y+dy});}
        else if(g.mode==='rotate'){
            let delta=(Math.atan2(p.y-g.center.y,p.x-g.center.x)-g.startAngle)*180/Math.PI;if(event.shiftKey)delta=Math.round(delta/15)*15;
            const c=Math.cos(delta*Math.PI/180),s=Math.sin(delta*Math.PI/180);for(let i=0;i<g.blocks.length;i++){const v=g.views[i],x=v.x-g.center.x,y=v.y-g.center.y;editView(next,g.blocks[i],{...v,x:g.center.x+x*c-y*s,y:g.center.y+x*s+y*c,rotation:v.rotation+delta});}
        }else if(g.reflow){
            const v=g.views[0],a=v.rotation*Math.PI/180,local=dx*Math.cos(a)+dy*Math.sin(a),factor=v.scale*v.stretchX;
            const width=Math.max(20,Math.min(840,(v.width+(g.mode==='e'?local:-local))/factor/B.PX)),origin=g.mode==='w'?B.point(v,v.width-width*B.PX*factor,0):v;
            next.blocks[g.blocks[0].id]={...next.blocks[g.blocks[0].id],width,x:origin.x/B.PX,y:origin.y/B.PX};delete next.blocks[g.blocks[0].id].dx;delete next.blocks[g.blocks[0].id].dy;g.next=next;
            clearTimeout(g.reflowTimer);const remaining=60-(performance.now()-(g.lastReflow||0));
            if(!force&&remaining>0){g.reflowTimer=setTimeout(()=>{if(gesture===g&&g.lastEvent)updateGesture(g.lastEvent,true);},remaining);return;}g.lastReflow=performance.now();
            g.reflowBlock=StudioLayout.reflow(g.blocks[0],width,result);
            const shell=host.querySelector(`[data-block-id="${g.blocks[0].id}"]`);if(shell)StudioLayout.mountBlock(shell,g.reflowBlock,{...result,layout:next});
            draw(next);$('block-width').value=Number(width.toFixed(2));return;
        }else if(g.blocks.length===1){
            editView(next,g.blocks[0],B.resize(g.views[0],g.mode,{x:dx,y:dy},event.shiftKey,g.blocks[0].autoScale||1));
        }else{
            const ax=g.anchor.x,ay=g.anchor.y,vx=g.handle.x-ax,vy=g.handle.y-ay;let ratio=1+(dx*vx+dy*vy)/(vx*vx+vy*vy);
            const min=Math.max(...g.views.map((v,i)=>.25/(v.scale/(g.blocks[i].autoScale||1)))),max=Math.min(...g.views.map((v,i)=>4/(v.scale/(g.blocks[i].autoScale||1))));ratio=Math.max(min,Math.min(max,ratio));
            for(let i=0;i<g.blocks.length;i++){const v=g.views[i];editView(next,g.blocks[i],{...v,x:ax+(v.x-ax)*ratio,y:ay+(v.y-ay)*ratio,scale:v.scale*ratio});}
        }
        g.next=next;live(next);
    }
    viewport.addEventListener('pointerdown',event=>{
        if(!enabled||panKey||event.button!==0||!result)return;const paper=host.querySelector('.paper');if(!paper)return;const bounds=viewport.getBoundingClientRect();if(event.clientX>=bounds.left+viewport.clientWidth)return;
        const p=coordinates(event),handle=event.target.closest('[data-handle]')?.dataset.handle;let mode=handle;
        if(!handle){const hit=[...records()].reverse().find(b=>B.contains(view(b),p));if(hit){const ids=expanded(new Set([hit.id]));if(event.shiftKey){for(const id of ids)selected.has(id)?selected.delete(id):selected.add(id);}else if(!selected.has(hit.id))selected=ids;mode='move';}
            else{if(!event.shiftKey)selected.clear();mode='marquee';}}
        event.preventDefault();event.stopPropagation();viewport.focus();draw();properties();
        if(mode!=='marquee'&&(!selected.size||views().some(v=>v.locked)))return;
        const before=clone(current()),items=views(before),blocks=chosen();gesture={mode,start:p,before,views:items,blocks,initial:new Set(selected),pointer:event.pointerId,next:null};
        gesture.reflow=blocks.length===1&&['e','w'].includes(mode)&&B.reflowable(blocks[0].type);
        if(mode!=='marquee'){const box=groupBox(items),center=B.point(box,box.width/2,box.height/2);gesture.center=center;gesture.startAngle=Math.atan2(p.y-center.y,p.x-center.x);
            const h=B.handles[mode];if(h){gesture.handle=B.point(box,h[0]*box.width,h[1]*box.height);gesture.anchor=B.point(box,(1-h[0])*box.width,(1-h[1])*box.height);}}
        viewport.setPointerCapture(event.pointerId);document.body.classList.add('transforming-block');
    },true);
    viewport.addEventListener('pointermove',event=>{if(!gesture||gesture.pointer!==event.pointerId)return;pending=event;if(!frame)frame=requestAnimationFrame(()=>{frame=0;const e=pending;pending=null;if(e)updateGesture(e);});},true);
    function finish(event,cancel=false){if(!gesture||event&&gesture.pointer!==event.pointerId)return;if(frame){cancelAnimationFrame(frame);frame=0;}clearTimeout(gesture.reflowTimer);const last=pending||(gesture.reflow?gesture.lastEvent:null);if(last&&!cancel)updateGesture(last,true);pending=null;const g=gesture;gesture=null;document.body.classList.remove('transforming-block');if(viewport.hasPointerCapture(g.pointer))viewport.releasePointerCapture(g.pointer);
        if(g.reflowBlock){if(cancel){const shell=host.querySelector(`[data-block-id="${g.blocks[0].id}"]`);if(shell)StudioLayout.mountBlock(shell,g.blocks[0],{...result,layout:g.before});}else Object.assign(g.blocks[0],g.reflowBlock);}
        if(cancel)live(g.before);else if(g.next)commit(g.next);draw();properties();}
    viewport.addEventListener('pointerup',event=>finish(event),true);viewport.addEventListener('pointercancel',event=>finish(event,true),true);viewport.addEventListener('lostpointercapture',event=>finish(event,true),true);
    function action(callback){const next=clone(current());callback(next);commit(next);}
    $('edit-layout').onclick=()=>{enabled=!enabled;$('edit-layout').setAttribute('aria-pressed',String(enabled));$('block-tools').hidden=!enabled;document.body.classList.toggle('layout-editing',enabled);if(!enabled){finish(null,true);selected.clear();}viewport.focus();draw();properties();};
    $('block-select').onchange=()=>{selected=expanded(new Set($('block-select').value?[$('block-select').value]:[]));draw();properties();viewport.focus();};
    $('block-group').onclick=()=>action(next=>{const group='g-'+crypto.randomUUID();for(const id of selected)next.blocks[id]={...next.blocks[id],group};});
    $('block-ungroup').onclick=()=>action(next=>{for(const id of selected)if(next.blocks[id])delete next.blocks[id].group;});
    $('block-lock').onclick=()=>action(next=>{const locked=!views().every(v=>v.locked);for(const id of selected)next.blocks[id]={...next.blocks[id],locked};});
    $('block-reset').onclick=()=>action(next=>{for(const id of selected)delete next.blocks[id];});
    $('block-reset-all').onclick=()=>commit(B.normalize());
    $('block-clear-missing').onclick=()=>action(next=>{if(result.truncated)return;const present=new Set(result.pages.flatMap(p=>p.blocks.map(b=>b.id)));for(const id of Object.keys(next.blocks))if(!present.has(id))delete next.blocks[id];});
    function undo(delta){const index=historyIndex+delta;if(index<0||index>=history.length)return;historyIndex=index;StudioApp.applyLayout(clone(history[index]));live(current());properties();}
    $('block-undo').onclick=()=>undo(-1);$('block-redo').onclick=()=>undo(1);
    function align(center){action(next=>{const items=views(next),bounds=B.bounds(items),target=center?(bounds.x+bounds.right)/2:bounds.x;chosen().forEach((b,i)=>{const box=B.bounds([items[i]]);editView(next,b,{...items[i],x:items[i].x+target-(center?(box.x+box.right)/2:box.x)});});});}
    $('block-align-left').onclick=()=>align(false);$('block-align-center').onclick=()=>align(true);
    for(const [id,key] of Object.entries({'block-x':'x','block-y':'y','block-scale':'scale','block-stretch-x':'stretchX','block-stretch-y':'stretchY','block-angle':'rotation','block-width':'width'}))$(id).onchange=()=>{const input=$(id);if(!input.reportValidity()||selected.size!==1)return;action(next=>{const block=chosen()[0],edit={...next.blocks[block.id]},value=Number(input.value);edit[key]=['scale','stretchX','stretchY'].includes(key)?value/100:value;if(key==='x')delete edit.dx;if(key==='y')delete edit.dy;next.blocks[block.id]=edit;});};
    document.addEventListener('keydown',event=>{
        if(event.defaultPrevented||!enabled||event.target.closest('input,textarea,[contenteditable=true]'))return;
        if(event.code==='Space'){panKey=true;document.body.classList.add('block-pan');event.preventDefault();return;}
        if(!viewport.contains(document.activeElement)&&!$('block-tools').contains(document.activeElement))return;
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo(event.shiftKey?1:-1);}
        else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();undo(1);}
        else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();selected=new Set(records().map(b=>b.id));draw();properties();}
        else if(event.key==='Escape'){finish(null,true);selected.clear();draw();properties();}
        else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&selected.size&&!views().some(v=>v.locked)){event.preventDefault();const step=(event.shiftKey?1:.2)*B.PX,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;action(next=>chosen().forEach(b=>{const v=view(b,next);editView(next,b,{...v,x:v.x+dx,y:v.y+dy});}));}
    });
    document.addEventListener('keyup',event=>{if(event.code==='Space'){panKey=false;document.body.classList.remove('block-pan');}});window.addEventListener('blur',()=>{panKey=false;finish(null,true);document.body.classList.remove('block-pan');});
    function mount(next,index){if(gesture)finish(null,true);result=next;pageIndex=index;selected=new Set([...selected].filter(id=>records().some(b=>b.id===id)));overlay=document.createElement('div');overlay.className='block-overlay';host.append(overlay);
        const select=$('block-select');select.replaceChildren(new Option('选择内容块',''));for(const block of records())select.add(new Option(`${names[block.type]} · ${block.text.slice(0,24)}`,block.id));draw();properties();
        const paper=host.querySelector('.paper');if(paper)StudioRaster.mount(paper,result,index);
    }
    return {mount,refresh(){if(result){live(current());properties();}},resetHistory(){history=[];historyIndex=-1;selected.clear();},get enabled(){return enabled;},get panKey(){return panKey;},get dragging(){return!!gesture;},get selection(){return[...selected];}};
})();
