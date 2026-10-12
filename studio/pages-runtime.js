window.PagesRuntime=(()=>{
    'use strict';
    const base=new URL('../',document.currentScript.src),nativeFetch=window.fetch.bind(window),asset=path=>new URL(path,base).href;
    const version=nativeFetch(asset('version.json'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('版本信息加载失败');return r.json();});
    const database=new Promise((resolve,reject)=>{const request=indexedDB.open('md2hw-pages-documents-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('data');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    async function get(key){const db=await database;return new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
    async function put(key,value){const db=await database;return new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(value,key);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(Error('浏览器存储不足，请下载源稿备份或清理导出记录'));});}
    async function keys(prefix){const db=await database;return new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').getAllKeys(IDBKeyRange.bound(prefix,prefix+'\uffff'));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
    async function remove(key){const db=await database;return new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
    const manifest=nativeFetch(asset('fonts.json?v=2.7.1-web.1')).then(r=>{if(!r.ok)throw Error('字体清单加载失败');return r.json();});
    const worker=new Worker(asset('studio/pen-worker.js?v=2.7.1-web.1')),requests=new Map(),urls=new Map();let sequence=0;
    worker.onmessage=event=>{const waiting=requests.get(event.data.id);if(!waiting)return;requests.delete(event.data.id);if(event.data.error)waiting.reject(Error(event.data.error));else waiting.resolve(event.data.result);};
    worker.onerror=()=>{for(const waiting of requests.values())waiting.reject(Error('浏览器笔迹引擎启动失败，请使用新版 Edge 或 Chrome 并刷新'));requests.clear();};
    const work=(type,value)=>new Promise((resolve,reject)=>{const id=++sequence;requests.set(id,{resolve,reject});worker.postMessage({id,type,value});});
    async function fontURL(type,name){const key='font/'+type+'/'+name;if(urls.has(key))return urls.get(key);const uploaded=await get(key);if(uploaded){const url=URL.createObjectURL(uploaded);urls.set(key,url);return url;}return asset('fonts/'+(type==='math'?'公式字体/':'正文字体/')+encodeURIComponent(name));}
    const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    async function previewURL(type,name){const list=await manifest;if(list.previews[type][name])return asset(list.previews[type][name]);const key='preview/'+type+'/'+name;if(urls.has(key))return urls.get(key);
        let sample=type==='math'?'Aa xyz 0123':'山水日月 0123';const font=await fontURL(type,name);let data=await work('glyphs',{url:font,chars:Array.from(sample)});
        if(type==='text'&&![...'山水日月'].some(ch=>data.glyphs[ch])){sample='The quick fox 0123';data=await work('glyphs',{url:font,chars:Array.from(sample)});}
        let x=0,paths='';const advance=Array.from(sample).reduce((n,ch)=>n+(data.glyphs[ch]?.advance||data.units*.5),0),scale=Math.min(26/data.units,252/advance);
        for(const ch of sample){const g=data.glyphs[ch];if(g?.path)paths+='<path d="'+esc(g.path)+'" transform="translate('+x+' 0)"/>';x+=g?.advance||data.units*.5;}
        const svg='<svg xmlns="http://www.w3.org/2000/svg" width="260" height="40"><g transform="translate(3 30) scale('+scale+' '+(-scale)+')" fill="none" stroke="#26392f" stroke-width="1.15" stroke-linecap="round"><style>path{vector-effect:non-scaling-stroke}</style>'+paths+'</g></svg>',url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));urls.set(key,url);return url;
    }
    function bytes(base64){return Uint8Array.from(atob(base64),c=>c.charCodeAt(0));}
    async function fallbackURLs(){const m=await manifest;return Promise.all(['李国夫手写体.ttf','handwritten-fixed.ttf','义启手写体.ttf'].filter(n=>m.text.includes(n)).map(n=>fontURL('text',n)));}
    async function fontList(){const m=await manifest,stored=await keys('font/'),result={text:[...m.text],math:[...m.math],labels:{text:{},math:{}}};for(const type of ['text','math'])for(const key of stored.filter(k=>k.startsWith('font/'+type+'/'))){const name=key.slice(('font/'+type+'/').length);if(!result[type].includes(name))result[type].push(name);const meta=await get('font-meta/'+type+'/'+name);if(meta?.displayName)result.labels[type][name]=meta.displayName;}return result;}
    let importQueue=Promise.resolve();
    async function importFont(value){
        if(!['text','math'].includes(value.type)||!/^.+\.(ttf|otf|woff2?)$/i.test(value.name))throw Error('请选择 TTF / OTF / WOFF / WOFF2 字体');
        if(typeof value.base64!=='string'||value.base64.length>Math.ceil(25*1024*1024/3)*4)throw Error('每个字体最多 25 MB');const buffer=bytes(value.base64);if(!buffer.length||buffer.length>25*1024*1024)throw Error('字体为空或超过 25 MB');
        const blob=new Blob([buffer]),url=URL.createObjectURL(blob);let parsed;try{parsed=await work('validate',{url});}finally{URL.revokeObjectURL(url);}
        const m=await manifest;let name=Object.entries(m.hashes?.[value.type]||{}).find(([,hash])=>hash===parsed.digest)?.[0];
        if(!name)for(const key of await keys('font/'+value.type+'/')){const savedName=key.slice(('font/'+value.type+'/').length),meta=await get('font-meta/'+value.type+'/'+savedName);let hash=meta?.digest;if(!hash){const stored=await get(key);hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await stored.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');}if(hash===parsed.digest){name=savedName;break;}}
        const duplicate=!!name;if(!name){const stem=value.name.replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/\.{2,}/g,'_').replace(/[. ]+$/g,'').slice(0,70)||'自定义字体';name=stem+'__'+parsed.digest.slice(0,12)+parsed.extension;await put('font/'+value.type+'/'+name,blob);}
        const displayName=/^导入_[a-f0-9]+\./.test(name)?parsed.family:name.replace(/\.(ttf|otf|woff2?)$/i,'').replace(/__[a-f0-9]{12}$/,'');const warnings=[];
        if(value.type==='text'&&!parsed.chinese)warnings.push('不含示例汉字，缺字将使用后备字形。');if(value.type==='math'&&!parsed.mathComplete)warnings.push('部分数学字符缺字，将使用手写补充。');
        const result={name,displayName,type:value.type,digest:parsed.digest,duplicate,bytes:buffer.length,warnings};await put('font-meta/'+value.type+'/'+name,result);return result;
    }
    async function uploadImage(value){const blob=new Blob([bytes(value.base64)]),image=await createImageBitmap(blob),scale=Math.min(1,2800/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();return{url:canvas.toDataURL('image/jpeg',.95)};}
    const downloadURLs=new Map();
    async function downloadURL(id){if(downloadURLs.has(id))return downloadURLs.get(id);const blob=await get('result/'+id);if(!blob)throw Error('导出文件未完成或已被浏览器清理');const url=URL.createObjectURL(blob);if(downloadURLs.size>=8){const first=downloadURLs.keys().next().value;URL.revokeObjectURL(downloadURLs.get(first));downloadURLs.delete(first);}downloadURLs.set(id,url);return url;}
    async function request(route,method,value,params){
        if(route==='/api/draft'){if(method==='PUT'){await put('draft',value);return{ok:true};}return await get('draft')||null;}
        if(route==='/api/fonts')return fontList();
        if(route==='/api/font'){const task=importQueue.catch(()=>{}).then(()=>importFont(value));importQueue=task;return task;}
        if(route==='/api/pen-font')return work('glyphs',{url:await fontURL(value.type,value.font),chars:value.chars,fallbackURLs:value.fallbackStyle==='hand'?await fallbackURLs():[]});
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
    return{get,put,remove,keys,fontURL,previewURL,downloadURL,asset,nativeFetch,version};
})();
