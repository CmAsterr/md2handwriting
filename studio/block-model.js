(function(root,factory){if(typeof module==='object')module.exports=factory();else root.StudioBlocks=factory();})(globalThis,function(){
    'use strict';
    const PX=800/210;
    function normalize(input){
        if(input==null)return{version:1,blocks:{}};
        if(typeof input!=='object'||Array.isArray(input)||(input.version!==undefined&&input.version!==1))throw Error('布局必须为 version: 1 的对象');
        const entries=input.blocks||{};if(typeof entries!=='object'||Array.isArray(entries))throw Error('布局 blocks 应为编号到调整值的对象；清单中的 layout 字段可用作布局文件');
        if(Object.keys(entries).length>10000)throw Error('手动布局最多保存 10000 个内容块');
        const blocks=Object.create(null),ranges={x:[-1000,1000],y:[-1000,1000],dx:[-1000,1000],dy:[-1000,1000],width:[20,840],scale:[.25,4],stretchX:[.25,4],stretchY:[.25,4],rotation:[-180,180]};
        for(const [id,value] of Object.entries(entries)){
            if(!/^b-[a-z0-9-]{5,180}$/.test(id)||!value||typeof value!=='object'||Array.isArray(value))throw Error('无效内容块编号或调整对象：'+id);
            const edit={};for(const [key,v] of Object.entries(value)){
                if(ranges[key]){if(typeof v!=='number'||!Number.isFinite(v)||v<ranges[key][0]||v>ranges[key][1])throw Error(`布局 ${id}.${key} 超出范围 ${ranges[key].join('–')}`);edit[key]=v;}
                else if(key==='locked'){if(typeof v!=='boolean')throw Error('locked 应为布尔值');edit.locked=v;}
                else if(key==='group'){if(typeof v!=='string'||v.length>80)throw Error('group 应为不超过 80 字符的字符串');if(v)edit.group=v;}
                else throw Error('未知布局参数：'+key);
            }
            if(edit.x!==undefined&&edit.dx!==undefined||edit.y!==undefined&&edit.dy!==undefined)throw Error('同一方向的绝对坐标与相对偏移不能同时设置');
            blocks[id]=edit;
        }
        return{version:1,blocks};
    }
    const angle=value=>((value+180)%360+360)%360-180;
    function view(block,edit={}){const scale=(block.autoScale||1)*(edit.scale??1),stretchX=edit.stretchX??1,stretchY=edit.stretchY??1;return{id:block.id,x:edit.x!==undefined?edit.x*PX:block.x+(edit.dx||0)*PX,y:edit.y!==undefined?edit.y*PX:block.y+(edit.dy||0)*PX,width:block.width*scale*stretchX,height:block.height*scale*stretchY,scale,stretchX,stretchY,rotation:edit.rotation||0,locked:!!edit.locked,group:edit.group||''};}
    function point(v,x,y){const a=v.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:v.x+c*x-s*y,y:v.y+s*x+c*y};}
    const handles={nw:[0,0],n:[.5,0],ne:[1,0],e:[1,.5],se:[1,1],s:[.5,1],sw:[0,1],w:[0,.5]};
    function resize(v,handle,delta,proportional=false,autoScale=1){
        const h=handles[handle];if(!h)return{...v};
        const a=-v.rotation*Math.PI/180,dx=delta.x*Math.cos(a)-delta.y*Math.sin(a),dy=delta.x*Math.sin(a)+delta.y*Math.cos(a),changeX=h[0]!==.5,changeY=h[1]!==.5;
        let rx=changeX?1+(h[0]===1?dx:-dx)/v.width:1,ry=changeY?1+(h[1]===1?dy:-dy)/v.height:1;
        const clamp=(r,value)=>Math.max(.25/value,Math.min(4/value,r)),out={...v};
        if(proportional&&changeX&&changeY){const ratio=clamp((rx*v.width*v.width+ry*v.height*v.height)/(v.width*v.width+v.height*v.height),v.scale/autoScale);rx=ry=ratio;out.scale*=ratio;}
        else{rx=changeX?clamp(rx,v.stretchX??1):1;ry=changeY?clamp(ry,v.stretchY??1):1;out.stretchX=(v.stretchX??1)*rx;out.stretchY=(v.stretchY??1)*ry;}
        out.width=v.width*rx;out.height=v.height*ry;
        // Hold the opposite corner/edge midpoint in paper coordinates, even after rotation.
        const anchor=point(v,(1-h[0])*v.width,(1-h[1])*v.height),offset=point({...out,x:0,y:0},(1-h[0])*out.width,(1-h[1])*out.height);
        out.x=anchor.x-offset.x;out.y=anchor.y-offset.y;return out;
    }
    const corners=v=>[point(v,0,0),point(v,v.width,0),point(v,v.width,v.height),point(v,0,v.height)];
    function bounds(views){const p=views.flatMap(corners);return{x:Math.min(...p.map(p=>p.x)),y:Math.min(...p.map(p=>p.y)),right:Math.max(...p.map(p=>p.x)),bottom:Math.max(...p.map(p=>p.y))};}
    function contains(v,p){const a=-v.rotation*Math.PI/180,dx=p.x-v.x,dy=p.y-v.y,x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a);return x>=0&&y>=0&&x<=v.width&&y<=v.height;}
    function overlap(a,b){const p=corners(a),q=corners(b);for(const polygon of [p,q])for(let i=0;i<4;i++){const next=polygon[(i+1)%4],axis={x:next.y-polygon[i].y,y:polygon[i].x-next.x},project=r=>r.map(v=>v.x*axis.x+v.y*axis.y),u=project(p),v=project(q);if(Math.max(...u)<=Math.min(...v)+1||Math.max(...v)<=Math.min(...u)+1)return false;}return true;}
    function issues(blocks,layout,size){const out=[],views=blocks.map(b=>view(b,layout.blocks[b.id]));
        for(const v of views){const b=bounds([v]);if(b.x<-.5||b.y<-.5||b.right>size.width+.5||b.bottom>size.height+.5)out.push({type:'outside',ids:[v.id]});}
        for(let i=0;i<views.length;i++)for(let j=0;j<i;j++)if((layout.blocks[views[i].id]||layout.blocks[views[j].id])&&overlap(views[i],views[j]))out.push({type:'overlap',ids:[views[j].id,views[i].id]});return out;
    }
    // Text wraps around intact inline equations; standalone formula boxes fit their drawing.
    const reflowable=type=>['paragraph','heading','quote','list','code','formula'].includes(type);
    return{PX,normalize,angle,view,point,handles,resize,corners,bounds,contains,overlap,issues,reflowable};
});
