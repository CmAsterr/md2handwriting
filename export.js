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

// 【核心】：3倍高清截图 + SVG噪点逆向补偿，解决“起雾”和“模糊”的终极黑魔法
async function captureHighRes(pageEl, scale = 3) {
    const filters = pageEl.querySelectorAll('filter');
    const filterStates = [];
    
    // 1. 逆向补偿滤镜：如果不做这一步，放大3倍截图时，水笔晕染的噪点也会变大3倍，导致画面起雾、字迹糊掉
    filters.forEach(f => {
        const turb = f.querySelector('feTurbulence');
        const disp = f.querySelector('feDisplacementMap');
        if (turb && disp) {
            const baseFreq = parseFloat(turb.getAttribute('baseFrequency') || 0.015);
            const dispScale = parseFloat(disp.getAttribute('scale') || 1.0);
            filterStates.push({ turb, disp, baseFreq, dispScale });
            
            // 频率除以3，振幅乘3，保证高分辨率下的噪点视觉大小与网页完全一致！
            turb.setAttribute('baseFrequency', baseFreq / scale);
            disp.setAttribute('scale', dispScale * scale);
        }
    });

    // 2. 强行将背景图印在内联样式上，防止截图库读取 CSS 变量失败导致白板
    const origBg = pageEl.style.backgroundImage;
    pageEl.style.backgroundImage = getComputedStyle(document.documentElement).getPropertyValue('--paper-bg-image');

    // 3. 极其重要：休眠 50 毫秒，强迫浏览器重绘更新后的 SVG 滤镜
    await new Promise(resolve => setTimeout(resolve, 50));

    // 4. 强制放大宽高并缩放内部元素，实现真正的 300 DPI 导出
    const config = {
        quality: 0.95,
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
        // 5. 截图完毕，瞬间恢复网页原状，做到无痕导出
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
        document.getElementById('progress-text').innerText = `正在生成 ZIP (300DPI 超清图片): 第 ${i+1} / ${pages.length} 页`;
        document.getElementById('progress-bar').style.width = Math.round(((i + 1) / pages.length) * 100) + '%';
        
        const imgData = await captureHighRes(pages[i], 3);
        if(window.isRenderingCanceled) return;
        
        zip.file(`${filename}_第${i+1}页.jpg`, imgData.split(',')[1], {base64: true});
    }
    
    if(window.isRenderingCanceled) return;
    const content = await zip.generateAsync({type:"blob"});
    saveAs(content, `${filename}.zip`);
    setTimeout(() => { document.getElementById('progress-modal').style.display = 'none'; }, 1000);
}

async function downloadPdf(filename, pages) {
    const { jsPDF } = window.jspdf; 
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    for (let i = 0; i < pages.length; i++) {
        if(window.isRenderingCanceled) return;
        document.getElementById('progress-text').innerText = `正在合成 PDF (包含所有涂改特效): 第 ${i+1} / ${pages.length} 页`;
        document.getElementById('progress-bar').style.width = Math.round(((i + 1) / pages.length) * 100) + '%';
        
        // PDF 也是通过切出完美的 300DPI 图像来塞进去，彻底杜绝丢失元素
        const imgData = await captureHighRes(pages[i], 3);
        if(window.isRenderingCanceled) return;
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }
    
    if(window.isRenderingCanceled) return;
    pdf.save(`${filename}.pdf`);
    setTimeout(() => { document.getElementById('progress-modal').style.display = 'none'; }, 1000);
}