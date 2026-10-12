const fs=require('fs'),path=require('path'),esbuild=require('esbuild'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
(async()=>{
    await esbuild.build({entryPoints:[path.join(root,'src/pen-worker.js')],outfile:path.join(root,'studio/pen-worker.js'),bundle:true,platform:'browser',format:'iife',target:'es2022',minify:true,legalComments:'linked'});
    const {Monoline}=require('../src/node-monoline.cjs'),{fontPreview}=require('../src/font-preview.cjs'),mono=new Monoline(root,path.join(root,'build-cache')),manifest={text:[],math:[],previews:{text:{},math:{}},hashes:{text:{},math:{}}};
    fs.mkdirSync(path.join(root,'font-previews'),{recursive:true});
    for(const type of ['text','math']){const names=fs.readdirSync(path.join(root,'fonts',type==='text'?'正文字体':'公式字体')).filter(n=>/\.(ttf|otf|woff2?)$/i.test(n)).sort();manifest[type]=names;
        for(const name of names)manifest.hashes[type][name]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'fonts',type==='text'?'正文字体':'公式字体',name))).digest('hex');
        for(const [i,name] of (type==='math'?['',...names]:names).entries()){const file='font-previews/'+type+'-'+i+'.svg';fs.writeFileSync(path.join(root,file),await fontPreview(root,type,name,mono,true));manifest.previews[type][name]=file;}}
    fs.writeFileSync(path.join(root,'fonts.json'),JSON.stringify(manifest));
    for(const rel of ['tex-svg-full.js','input/tex/extensions/color.js']){const target=path.join(root,'vendor/mathjax',rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,'node_modules/mathjax-full/es5',rel),target);}
    fs.cpSync(path.join(root,'node_modules/mathjax-full/es5/input/tex/extensions'),path.join(root,'vendor/mathjax/input/tex/extensions'),{recursive:true});
    fs.copyFileSync(path.join(root,'node_modules/marked/lib/marked.umd.js'),path.join(root,'vendor/marked.js'));
    const hash=crypto.createHash('sha256');for(const name of fs.readdirSync(path.join(root,'studio')).sort())if(/\.(js|css|html)$/.test(name))hash.update(name).update(fs.readFileSync(path.join(root,'studio',name)));hash.update(fs.readFileSync(path.join(root,'fonts.json')));
    fs.writeFileSync(path.join(root,'version.json'),JSON.stringify({version:'2.7.1-web.1',edition:'browser',sourceVersion:'2.7.1',build:hash.digest('hex').slice(0,24),releaseDate:'2026-10-12'},null,2)+'\n');
    console.log(JSON.stringify({built:true,textFonts:manifest.text.length,mathFonts:manifest.math.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
