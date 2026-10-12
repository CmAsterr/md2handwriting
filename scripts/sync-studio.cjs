// Snapshot shared renderer files, then apply the static-host adapters.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const source=path.resolve(process.argv[2]||''),root=path.resolve(__dirname,'..');
if(!process.argv[2]||JSON.parse(fs.readFileSync(path.join(source,'package.json'))).version!=='2.7.1')throw Error('Pass the Studio 2.7.1 directory');
const hashes={};
for(const file of fs.readdirSync(path.join(source,'studio'))){if(!/\.(js|css|html|png|svg)$/.test(file))continue;const bytes=fs.readFileSync(path.join(source,'studio',file));hashes[file]=crypto.createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(path.join(root,'studio',file),bytes);}
fs.copyFileSync(path.join(source,'lib','fallback-outline.js'),path.join(root,'src','fallback-outline.cjs'));
for(const file of fs.readdirSync(path.join(root,'studio'))){if(!/\.(js|css|html)$/.test(file)||/^pages-|^pen-worker/.test(file))continue;
 let s=fs.readFileSync(path.join(root,'studio',file),'utf8');
 s=s.replace(/(["'`(])\/(studio|api|fonts|vendor|assets|仿真背景图)\//g,'$1/md2handwriting/$2/');
 if(file==='layout.js'){s=s.replace("const url='/md2handwriting/fonts/正文字体/'+encodeURIComponent(s.font);","const url=await PagesRuntime.fontURL('text',s.font);").replace("src='/md2handwriting/api/media?url='+encodeURIComponent(src);","src=src;");}
 if(file==='font-picker.js'){
  s=s.replace(/    const previewURL =[^\n]+/,"    const previewURL=(id,value)=>JSON.stringify({type:id==='font'?'text':'math',name:value});\n    async function loadSpecimen(image){try{const choice=JSON.parse(image.dataset.src);image.src=await PagesRuntime.previewURL(choice.type,choice.name);}catch{image.dispatchEvent(new Event('error'));}}");
  s=s.replaceAll('img.src = img.dataset.src;','loadSpecimen(img);').replaceAll('image.src = image.dataset.src;','loadSpecimen(image);');
 }
 if(file==='font-import.js'){
  s=s.replace("if(row.result&&!v.preview.getAttribute('src')){v.preview.alt=row.result.displayName+'字形预览';v.preview.src='/md2handwriting/api/font-preview.svg?type='+row.type+'&name='+encodeURIComponent(row.result.name);v.preview.hidden=false;}","if(row.result&&!v.preview.dataset.requested){v.preview.dataset.requested='1';v.preview.alt=row.result.displayName+'字形预览';PagesRuntime.previewURL(row.type,row.result.name).then(url=>{v.preview.src=url;v.preview.hidden=false;}).catch(()=>{v.note.textContent='预览暂不可用，可以重新选用。';v.note.hidden=false;});}");
  const start=s.indexOf('        function upload(row,base64)'),end=s.indexOf('        async function pump()',start);if(start<0||end<0)throw Error('Missing import adapter anchor');
  s=s.slice(0,start)+"        async function upload(row,base64){row.progress=.5;row.message='正在检查并保存字体…';update();const response=await fetch('/md2handwriting/api/font',{method:'POST',body:JSON.stringify({name:row.name,type:row.type,base64})}),result=await response.json();if(!response.ok){const e=Error(result.error||'导入失败');e.retryable=false;throw e;}return result;}\n"+s.slice(end);
  s=s.replaceAll('字体只保存在本机。','字体只保存在此浏览器。');
 }
 if(file==='app.js'){
  s=s.replace('a.href=`/md2handwriting/api/jobs/${job.id}/download`;a.download=\'\';',"a.href=await PagesRuntime.downloadURL(job.id);a.download=job.filename+(job.format==='pdf'?'.pdf':'.zip');");
  s=s.replaceAll('刷新或关闭编辑页，后台仍继续导出。','导出时保持网页打开，关闭后可从导出记录继续。').replaceAll('已保存到本机','已保存到此浏览器').replaceAll('已恢复本机源稿','已恢复浏览器源稿').replaceAll('本地服务未连接','浏览器存储暂不可用').replaceAll('已交给后台，可以离开此页面','正在浏览器中导出，请保持页面打开').replaceAll('开始后台导出','开始导出');
 }
 if(file==='index.html'||file==='render.html'){
  s=s.replace('<meta charset="utf-8">','<meta charset="utf-8"><link rel="icon" href="data:,">');
  s=s.replace('<script src="/md2handwriting/studio/math-config.js">','<script defer src="/md2handwriting/studio/pages-runtime.js"></script>'+(file==='index.html'?'<script defer src="/md2handwriting/vendor/jspdf.umd.min.js"></script><script defer src="/md2handwriting/vendor/jszip.min.js"></script><script defer src="/md2handwriting/studio/pages-export.js"></script>':'')+'<script src="/md2handwriting/studio/math-config.js">');
  s=s.replace('手写工坊 · Local','手写工坊 · 在线版 2.7.1').replace('<small>LOCAL</small>','<small>WEB 2.7.1</small>').replaceAll('源稿自动保存到本机','源稿自动保存到此浏览器').replace('网络图片缓存到本机；','网络图片需允许跨域访问；').replace('提交后可离开或关闭此网页。刷新后仍可查看进度、继续任务和下载文件。','导出时请保持网页打开。关闭或刷新后，可从这里继续未完成任务。').replace('所有导出均在本机后台进行。长图超过安全尺寸时自动拆成多个部分。电脑休眠或关机时无法继续，重新启动后可恢复任务。','导出在当前浏览器中进行，请保持页面打开。后台标签可能被限速；关闭、刷新或休眠后，可重新打开继续任务。长图过长时自动拆分。').replaceAll('开始后台导出','开始导出');
  s=s.replace(/((?:src|href)="\/md2handwriting\/[^"?]+\.(?:js|css))"/g,'$1?v=2.7.1-web.1"');
 }
 fs.writeFileSync(path.join(root,'studio',file),s);
}
fs.copyFileSync(path.join(root,'studio/index.html'),path.join(root,'index.html'));fs.copyFileSync(path.join(root,'studio/render.html'),path.join(root,'render.html'));
fs.writeFileSync(path.join(root,'studio-source.json'),JSON.stringify({sourceVersion:'2.7.1',files:hashes},null,2)+'\n');
console.log('Studio 2.7.1 renderer snapshot adapted.');
