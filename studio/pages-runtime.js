window.PagesRuntime=(()=>{
    'use strict';
    const base=new URL('../',document.currentScript.src),nativeFetch=window.fetch.bind(window),asset=path=>new URL(path,base).href;
    const database=new Promise((resolve,reject)=>{const request=indexedDB.open('md2hw-pages-documents-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('data');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    async function get(key){const db=await database;return new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
    async function put(key,value){const db=await database;return new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(value,key);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(Error('浏览器存储不足，请下载源稿备份或清理导出记录'));});}
    async function keys(prefix){const db=await database;return new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').getAllKeys(IDBKeyRange.bound(prefix,prefix+'\uffff'));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
    const manifest=nativeFetch(asset('fonts.json')).then(r=>{if(!r.ok)throw Error('字体清单加载失败');return r.json();});
    const worker=new Worker(asset('studio/pen-worker.js')),requests=new Map(),urls=new Map();let sequence=0;
    worker.onmessage=event=>{const waiting=requests.get(event.data.id);if(!waiting)return;requests.delete(event.data.id);if(event.data.error)waiting.reject(Error(event.data.error));else waiting.resolve(event.data.result);};
    worker.onerror=()=>{for(const waiting of requests.values())waiting.reject(Error('浏览器笔迹引擎启动失败，请使用新版 Edge 或 Chrome 并刷新'));requests.clear();};
    const work=(type,value)=>new Promise((resolve,reject)=>{const id=++sequence;requests.set(id,{resolve,reject});worker.postMessage({id,type,value});});
    async function fontURL(type,name){const key='font/'+type+'/'+name;if(urls.has(key))return urls.get(key);const uploaded=await get(key);if(uploaded){const url=URL.createObjectURL(uploaded);urls.set(key,url);return url;}return asset('fonts/'+(type==='math'?'公式字体/':'正文字体/')+encodeURIComponent(name));}
    const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    async function previewURL(type,name){const list=await manifest;if(list.previews[type][name])return asset(list.previews[type][name]);const key='preview/'+type+'/'+name;if(urls.has(key))return urls.get(key);
        const sample=type==='math'?'Aa xyz 0123':'山水日月 0123',data=await work('glyphs',{url:await fontURL(type,name),chars:Array.from(sample)});let x=0,paths='';const scale=26/data.units;
        for(const ch of sample){const g=data.glyphs[ch];if(g?.path)paths+='<path d="'+esc(g.path)+'" transform="translate('+x+' 0)"/>';x+=g?.advance||data.units*.5;}
        const svg='<svg xmlns="http://www.w3.org/2000/svg" width="260" height="40"><g transform="translate(3 30) scale('+scale+' '+(-scale)+')" fill="none" stroke="#26392f" stroke-width="1.15" stroke-linecap="round"><style>path{vector-effect:non-scaling-stroke}</style>'+paths+'</g></svg>',url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));urls.set(key,url);return url;
    }
    function bytes(base64){return Uint8Array.from(atob(base64),c=>c.charCodeAt(0));}
    async function uploadImage(value){const blob=new Blob([bytes(value.base64)]),image=await createImageBitmap(blob),scale=Math.min(1,2800/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();return{url:canvas.toDataURL('image/jpeg',.95)};}
    const downloadURLs=new Map();
    async function downloadURL(id){if(downloadURLs.has(id))return downloadURLs.get(id);const blob=await get('result/'+id);if(!blob)throw Error('导出文件未完成或已被浏览器清理');const url=URL.createObjectURL(blob);if(downloadURLs.size>=8){const first=downloadURLs.keys().next().value;URL.revokeObjectURL(downloadURLs.get(first));downloadURLs.delete(first);}downloadURLs.set(id,url);return url;}
    async function request(route,method,value,params){
        if(route==='/api/draft'){if(method==='PUT'){await put('draft',value);return{ok:true};}return await get('draft')||null;}
        if(route==='/api/fonts'){const m=await manifest,stored=await keys('font/');return{text:[...m.text,...stored.filter(k=>k.startsWith('font/text/')).map(k=>k.slice(10))],math:[...m.math,...stored.filter(k=>k.startsWith('font/math/')).map(k=>k.slice(10))]};}
        if(route==='/api/font'){
            if(!/\.(ttf|otf|woff2?)$/i.test(value.name))throw Error('请选择字体文件');const buffer=bytes(value.base64);if(buffer.length>25*1024*1024)throw Error('字体最多 25 MB');const blob=new Blob([buffer]),url=URL.createObjectURL(blob);let parsed;try{parsed=await work('validate',{url});}finally{URL.revokeObjectURL(url);}
            const name='导入_'+parsed.id.slice(0,12)+value.name.slice(value.name.lastIndexOf('.')).toLowerCase();await put('font/'+(value.type==='math'?'math':'text')+'/'+name,blob);return{name};
        }
        if(route==='/api/pen-font')return work('glyphs',{url:await fontURL(value.type,value.font),chars:value.chars});
        if(route==='/api/pen-paths')return work('paths',value);
        if(route==='/api/math-font')return work('math',{url:await fontURL('math',params.get('name'))});
        if(route==='/api/image')return uploadImage(value);
        if(route==='/api/jobs'&&method==='POST')return PagesExport.create(value);
        if(route==='/api/jobs')return PagesExport.list();
        const job=/^\/api\/jobs\/([a-f0-9-]+)\/(cancel|retry)$/.exec(route);if(job)return PagesExport[job[2]](job[1]);
        throw Error('浏览器版不支持此操作');
    }
    window.fetch=async(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url||String(input),location.href);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname+'api/'))return nativeFetch(input,options);
        try{const route='/'+url.pathname.slice(base.pathname.length),method=(options.method||'GET').toUpperCase(),body=options.body?JSON.parse(options.body):{};return new Response(JSON.stringify(await request(route,method,body,url.searchParams)),{status:200,headers:{'Content-Type':'application/json'}});}catch(error){return new Response(JSON.stringify({error:error.message}),{status:400,headers:{'Content-Type':'application/json'}});}
    };
    return{get,put,keys,fontURL,previewURL,downloadURL,asset,nativeFetch};
})();
