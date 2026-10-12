let exportDocument;
window.renderDocument=async function(snapshot){
    const size=StudioCore.pageSize(snapshot.settings);document.body.style.width=size.width+'px';document.body.style.height=size.height+'px';document.getElementById('paper-host').style.width=size.width+'px';
    exportDocument=await StudioLayout.paginate(snapshot.markdown,snapshot.settings,p=>window.jobProgress?.(p),()=>false,Infinity,snapshot.images||{},snapshot.layout||{});
    return {pages:exportDocument.pages.length,segments:exportDocument.pages.map(p=>p.segment),warnings:exportDocument.warnings,fontFallbacks:exportDocument.fontFallbacks,layoutInfo:StudioLayout.describe(exportDocument)};
};
window.mountExportPage=async function(index){const page=StudioLayout.mount(exportDocument,index,document.getElementById('paper-host'));await document.fonts.ready;await Promise.all(Array.from(page.querySelectorAll('img')).map(img=>img.decode().catch(()=>{})));};
