(() => {
    'use strict';
    const $=id=>document.getElementById(id),dialog=$('paper-crop-dialog'),canvas=$('crop-canvas'),ctx=canvas.getContext('2d');
    const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));let W=800,H=1131;
    let image=null,source='',crop=null,resolveCrop=null,drag=null;
    const readURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
    function geometry(){
        const scale=Math.max(W/image.width,H/image.height)*crop.zoom;
        const width=W/scale,height=H/scale;
        crop.x=clamp(crop.x,width/image.width/2,1-width/image.width/2);
        crop.y=clamp(crop.y,height/image.height/2,1-height/image.height/2);
        return {scale,width,height,left:crop.x*image.width-width/2,top:crop.y*image.height-height/2};
    }
    function draw(){
        if(!image)return;const g=geometry();ctx.drawImage(image,g.left,g.top,g.width,g.height,0,0,W,H);
        $('crop-zoom').value=String(Math.round(crop.zoom*100));$('crop-zoom-value').value=`${Math.round(crop.zoom*100)}%`;
    }
    function fitCanvas(){if(!dialog.open)return;const stage=canvas.parentElement,w=stage.clientWidth-24,h=stage.clientHeight-24,scale=Math.min(w/W,h/H);canvas.style.width=W*scale+'px';canvas.style.height=H*scale+'px';}
    new ResizeObserver(fitCanvas).observe(canvas.parentElement);
    function zoom(value,anchor={x:.5,y:.5}){
        if(!image)return;const before=geometry();crop.zoom=clamp(value,1,4);
        const scale=Math.max(W/image.width,H/image.height)*crop.zoom;
        crop.x+=(anchor.x-.5)*(before.width-W/scale)/image.width;
        crop.y+=(anchor.y-.5)*(before.height-H/scale)/image.height;draw();
    }
    function endDrag(){drag=null;canvas.classList.remove('dragging');}
    canvas.addEventListener('pointerdown',event=>{
        if(!image||event.button!==0)return;canvas.focus();const rect=canvas.getBoundingClientRect(),g=geometry();
        drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,cx:crop.x,cy:crop.y,width:g.width/rect.width,height:g.height/rect.height};
        canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');event.preventDefault();
    });
    canvas.addEventListener('pointermove',event=>{if(drag?.pointer!==event.pointerId)return;
        crop.x=drag.cx-(event.clientX-drag.x)*drag.width/image.width;crop.y=drag.cy-(event.clientY-drag.y)*drag.height/image.height;draw();
    });
    canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',endDrag);
    canvas.addEventListener('wheel',event=>{event.preventDefault();const rect=canvas.getBoundingClientRect(),delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?rect.height:1);
        zoom(crop.zoom*Math.exp(-clamp(delta,-120,120)*.0015),{x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height});
    },{passive:false});
    canvas.addEventListener('keydown',event=>{
        if(!image)return;const vectors={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},v=vectors[event.key];
        if(v){event.preventDefault();const d=(event.shiftKey?40:10)/geometry().scale;crop.x-=v[0]*d/image.width;crop.y-=v[1]*d/image.height;draw();}
        else if(event.key==='+'||event.key==='='){event.preventDefault();zoom(crop.zoom*1.05);}
        else if(event.key==='-'){event.preventDefault();zoom(crop.zoom/1.05);}
    });
    $('crop-zoom').addEventListener('input',()=>zoom(Number($('crop-zoom').value)/100));
    $('crop-reset').onclick=()=>{crop={x:.5,y:.5,zoom:1};draw();};
    function finish(value){const resolve=resolveCrop;resolveCrop=null;endDrag();image?.close();image=null;source='';crop=null;dialog.close();resolve?.(value);}
    $('crop-cancel').onclick=()=>finish(null);$('crop-close').onclick=()=>finish(null);
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
    $('crop-apply').onclick=()=>{
        const output=document.createElement('canvas');output.width=W*3;output.height=H*3;
        const g=geometry(),out=output.getContext('2d');out.fillStyle='#fff';out.fillRect(0,0,output.width,output.height);out.imageSmoothingQuality='high';
        out.drawImage(image,g.left,g.top,g.width,g.height,0,0,output.width,output.height);
        // Store exactly these pixels. Neither preview nor export recrops the original.
        finish({background:output.toDataURL('image/jpeg',.94),backgroundSource:source,backgroundCrop:{...crop}});
        output.width=output.height=1;
    };
    async function open(input,savedCrop,isCurrent=()=>true,pageSettings={}){
        let bitmap=null;
        try{
            const isFile=typeof input!=='string';
            bitmap=await createImageBitmap(isFile?input:await (await fetch(input)).blob());
            if(!isCurrent()){bitmap.close();return null;}
            let original=input;
            if(isFile){
                // A bounded, orientation-corrected original keeps source files portable.
                const prepared=document.createElement('canvas'),scale=Math.min(1,4096/Math.max(bitmap.width,bitmap.height));
                prepared.width=Math.max(1,Math.round(bitmap.width*scale));prepared.height=Math.max(1,Math.round(bitmap.height*scale));
                const context=prepared.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,prepared.width,prepared.height);context.imageSmoothingQuality='high';context.drawImage(bitmap,0,0,prepared.width,prepared.height);
                const blob=await new Promise(resolve=>prepared.toBlob(resolve,'image/jpeg',.94));prepared.width=prepared.height=1;
                if(!blob)throw new Error('无法处理这张图片');original=await readURL(blob);bitmap.close();bitmap=await createImageBitmap(blob);
            }
            if(!isCurrent()){bitmap.close();return null;}
            if(resolveCrop)finish(null);image=bitmap;source=original;crop={x:.5,y:.5,zoom:1,...savedCrop};crop.zoom=clamp(crop.zoom,1,4);
            const size=StudioCore.pageSize(pageSettings);W=size.width;H=size.height;canvas.width=W;canvas.height=H;canvas.style.aspectRatio=`${W} / ${H}`;
            canvas.setAttribute('aria-label',`${size.widthMM} × ${size.heightMM} 毫米裁剪预览，方向键移动图片，加减键缩放`);dialog.querySelector('.crop-ratio').textContent=`${size.widthMM} × ${size.heightMM} mm`;
            draw();dialog.showModal();fitCanvas();canvas.focus();return new Promise(resolve=>{resolveCrop=resolve;});
        }catch(error){bitmap?.close();throw error;}
    }
    window.StudioPaperCrop={open,cancel:()=>{if(resolveCrop)finish(null);}};
})();
