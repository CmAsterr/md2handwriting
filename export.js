// export.js - 专门处理作业的高清导出与 PDF 合成逻辑

function openExportModal() { 
    document.getElementById('export-modal').style.display = 'flex'; 
}
function closeExportModal() { 
    document.getElementById('export-modal').style.display = 'none'; 
}
function cancelExport() { 
    window.isRenderingCanceled = true; 
    document.getElementById('progress-modal').style.display = 'none'; 
}

function confirmExport() {
    closeExportModal();
    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    const filename = document.getElementById('exportFilename').value || "手写作业";
    
    const pages = document.querySelectorAll('.paper-page'); 
    if(pages.length === 0) return alert("没有可导出的页面！");
    
    window.isRenderingCanceled = false;
    document.getElementById('progress-modal').style.display = 'flex';

    if (format === 'zip') {
        downloadZip(filename, pages);
    } else {
        downloadPdf(filename, pages);
    }
}

// 【核心防崩】：2倍高清截图 + SVG噪点逆向补偿（清晰度与内存的完美平衡）
async function captureHighRes(pageEl, scale = 2) {
    const filters = pageEl.querySelectorAll('filter');
    const filterStates = [];
    
    // 逆向补偿滤镜噪点，防止模糊起雾
    filters.forEach(f => {
        const turb = f.querySelector('feTurbulence');
        const disp = f.querySelector('feDisplacementMap');
        if (turb && disp) {
            const baseFreq = parseFloat(turb.getAttribute('baseFrequency') || 0.015);
            const dispScale = parseFloat(disp.getAttribute('scale') || 1.0);
            filterStates.push({ turb, disp, baseFreq, dispScale });
            
            turb.setAttribute('baseFrequency', baseFreq / scale);
            disp.setAttribute('scale', dispScale * scale);
        }
    });

    // 强行将背景图印在内联样式上
    const origBg = pageEl.style.backgroundImage;
    pageEl.style.backgroundImage = getComputedStyle(document.documentElement).getPropertyValue('--paper-bg-image');

    // 极其重要：休眠 50 毫秒，强迫浏览器重绘更新后的 SVG 滤镜
    await new Promise(resolve => setTimeout(resolve, 50));

    const config = {
        quality: 0.92, // 稍微降低一点点质量，极大节省体积和内存
        bgcolor: '#ffffff',
        width: pageEl.clientWidth * scale,
        height: pageEl.clientHeight * scale,
        style: {
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: pageEl.clientWidth + 'px',
            height: pageEl.clientHeight + 'px'
        }
    };

    try {
        const dataUrl = await domtoimage.toJpeg(pageEl, config);
        return dataUrl;
    } catch (e) {
        console.error("截图渲染失败:", e);
        throw e;
    } finally {
        filterStates.forEach(state => {
            state.turb.setAttribute('baseFrequency', state.baseFreq);
            state.disp.setAttribute('scale', state.dispScale);
        });
        pageEl.style.backgroundImage = origBg;
    }
}

async function downloadZip(filename, pages) {
    let zip = new JSZip();
    for (let i = 0; i < pages.length; i++) {
        if(window.isRenderingCanceled) return;
        document.getElementById('progress-text').innerText = `正在生成 ZIP (高清防崩版): 第 ${i+1} / ${pages.length} 页`;
        document.getElementById('progress-bar').style.width = Math.round(((i + 1) / pages.length) * 100) + '%';
        
        // 生成图片数据
        let imgData = await captureHighRes(pages[i], 2);
        if(window.isRenderingCanceled) return;
        
        // 塞入压缩包
        zip.file(`${filename}_第${i+1}页.jpg`, imgData.split(',')[1], {base64: true});
        
        // ⚡️ 核心防崩：手动断开变量引用，立刻释放十几兆内存！
        imgData = null; 
        
        // ⚡️ 核心防崩：强制休眠 600ms，呼叫浏览器垃圾回收器(GC)工作清理内存！
        await window.yieldThread(600);
    }
    
    if(window.isRenderingCanceled) return;
    document.getElementById('progress-text').innerText = `图片生成完毕，正在封装 ZIP...`;
    
    const content = await zip.generateAsync({type:"blob"});
    saveAs(content, `${filename}.zip`);
    setTimeout(() => { document.getElementById('progress-modal').style.display = 'none'; }, 1000);
}

async function downloadPdf(filename, pages) {
    const { jsPDF } = window.jspdf; 
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    for (let i = 0; i < pages.length; i++) {
        if(window.isRenderingCanceled) return;
        document.getElementById('progress-text').innerText = `正在合成 PDF (高清防崩版): 第 ${i+1} / ${pages.length} 页`;
        document.getElementById('progress-bar').style.width = Math.round(((i + 1) / pages.length) * 100) + '%';
        
        // 生成图片数据
        let imgData = await captureHighRes(pages[i], 2);
        if(window.isRenderingCanceled) return;
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        
        // ⚡️ 核心防崩：向 PDF 写入后，立刻释放当前图片占据的内存！
        imgData = null;
        
        // ⚡️ 核心防崩：强制休眠 600ms，呼叫浏览器垃圾回收器(GC)工作清理内存！
        await window.yieldThread(600);
    }
    
    if(window.isRenderingCanceled) return;
    document.getElementById('progress-text').innerText = `文档合成完毕，正在保存...`;
    
    pdf.save(`${filename}.pdf`);
    setTimeout(() => { document.getElementById('progress-modal').style.display = 'none'; }, 1000);
}