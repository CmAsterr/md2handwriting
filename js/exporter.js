(function () {
    const HW = window.HW = window.HW || {};
    const { el, setProgress, showProgress, hideProgress, yieldToBrowser, dataUrlToBlob, loadImage, canvasToBlob, blobToDataUrl, safeFilename } = HW.utils;

    function openExportModal() {
        el('export-modal').style.display = 'flex';
    }

    function closeExportModal() {
        el('export-modal').style.display = 'none';
    }

    function cancelExport() {
        HW.state.isRenderingCanceled = true;
        window.isRenderingCanceled = true;
        el('progress-modal').style.display = 'none';
    }

    function ensureNotCanceled() {
        if (HW.state.isRenderingCanceled || window.isRenderingCanceled) {
            throw new Error('EXPORT_CANCELED');
        }
    }

    function getPages() {
        return Array.from(document.querySelectorAll('.paper-page'));
    }

    async function capturePage(pageEl, scale = 2, quality = 0.94) {
        ensureNotCanceled();
        const filters = pageEl.querySelectorAll('filter');
        const filterStates = [];
        filters.forEach(filter => {
            const turb = filter.querySelector('feTurbulence');
            const disp = filter.querySelector('feDisplacementMap');
            if (turb && disp) {
                const baseFreq = parseFloat(turb.getAttribute('baseFrequency') || 0.015);
                const dispScale = parseFloat(disp.getAttribute('scale') || 1);
                filterStates.push({ turb, disp, baseFreq, dispScale });
                turb.setAttribute('baseFrequency', baseFreq / scale);
                disp.setAttribute('scale', dispScale * scale);
            }
        });

        const origBg = pageEl.style.backgroundImage;
        const computedBg = getComputedStyle(pageEl).backgroundImage;
        if (computedBg && computedBg !== 'none') {
            pageEl.style.backgroundImage = computedBg;
        }
        await yieldToBrowser();

        const config = {
            quality,
            bgcolor: '#ffffff',
            width: pageEl.clientWidth * scale,
            height: pageEl.clientHeight * scale,
            cacheBust: true,
            style: {
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: `${pageEl.clientWidth}px`,
                height: `${pageEl.clientHeight}px`
            }
        };

        try {
            const dataUrl = await domtoimage.toJpeg(pageEl, config);
            if (!dataUrl || dataUrl === 'data:,') {
                throw new Error('页面截图为空，请检查背景图或页面尺寸。');
            }
            return dataUrl;
        } finally {
            filterStates.forEach(state => {
                state.turb.setAttribute('baseFrequency', state.baseFreq);
                state.disp.setAttribute('scale', state.dispScale);
            });
            pageEl.style.backgroundImage = origBg;
        }
    }

    async function combineImagesVertically(items) {
        const images = [];
        for (const item of items) images.push(await loadImage(item.dataUrl));
        const width = Math.max(...images.map(img => img.naturalWidth || img.width));
        const height = images.reduce((sum, img) => sum + (img.naturalHeight || img.height), 0);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        let y = 0;
        images.forEach(img => {
            const h = img.naturalHeight || img.height;
            ctx.drawImage(img, 0, y, width, h);
            y += h;
        });
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.94);
        return blobToDataUrl(blob);
    }

    function groupPagesBySegment(pages) {
        const groups = new Map();
        pages.forEach(page => {
            const key = page.dataset.segment || '1';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(page);
        });
        return Array.from(groups.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
    }

    async function createPageImages(pages, onProgress, scale = 2) {
        const images = [];
        for (let i = 0; i < pages.length; i++) {
            ensureNotCanceled();
            if (onProgress) onProgress(`正在渲染高清图像: ${i + 1}/${pages.length} 页`, (i / pages.length) * 82);
            const dataUrl = await capturePage(pages[i], scale);
            images.push({
                name: `第${i + 1}页.jpg`,
                dataUrl,
                segment: pages[i].dataset.segment || '1'
            });
            await yieldToBrowser();
        }
        return images;
    }

    async function createLongImages(pages, filename, onProgress) {
        const groups = groupPagesBySegment(pages);
        const output = [];
        let done = 0;
        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
            const [, segmentPages] = groups[groupIndex];
            const pageImages = [];
            for (let i = 0; i < segmentPages.length; i++) {
                ensureNotCanceled();
                done++;
                if (onProgress) onProgress(`正在渲染分段长图: 第 ${groupIndex + 1} 段 (${i + 1}/${segmentPages.length})`, (done / pages.length) * 75);
                pageImages.push({ dataUrl: await capturePage(segmentPages[i], 2) });
                await yieldToBrowser();
            }
            const dataUrl = await combineImagesVertically(pageImages);
            output.push({ name: `${filename}_第${groupIndex + 1}段.jpg`, dataUrl });
        }
        return output;
    }

    async function buildZip(filename, mode, pages, onProgress) {
        const zip = new JSZip();
        const images = mode === 'longzip'
            ? await createLongImages(pages, filename, onProgress)
            : (await createPageImages(pages, onProgress)).map((item, index) => ({ name: `${filename}_第${index + 1}页.jpg`, dataUrl: item.dataUrl }));

        images.forEach(item => {
            zip.file(item.name, item.dataUrl.split(',')[1], { base64: true });
        });
        if (onProgress) onProgress('正在封装 ZIP...', 92);
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } }, meta => {
            if (onProgress) onProgress('正在压缩 ZIP...', 92 + meta.percent * 0.07);
        });
        return { blob, extension: 'zip', mime: 'application/zip' };
    }

    async function buildPdf(filename, pages, onProgress) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4', true);
        for (let i = 0; i < pages.length; i++) {
            ensureNotCanceled();
            if (onProgress) onProgress(`正在合成 PDF: ${i + 1}/${pages.length} 页`, (i / pages.length) * 88);
            const dataUrl = await capturePage(pages[i], 2, 0.92);
            if (i > 0) pdf.addPage();
            pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
            await yieldToBrowser();
        }
        if (onProgress) onProgress('正在保存 PDF...', 96);
        const blob = pdf.output('blob');
        return { blob, extension: 'pdf', mime: 'application/pdf' };
    }

    async function createExportBlob(options = {}) {
        const format = options.format || document.querySelector('input[name="exportFormat"]:checked').value;
        const filename = safeFilename(options.filename || el('exportFilename').value || '手写作业');
        const pages = getPages();
        if (!pages.length) throw new Error('NO_PAGES');

        const onProgress = options.silent ? null : (text, percent) => setProgress(text, percent);
        if (format === 'pdf') return buildPdf(filename, pages, onProgress);
        return buildZip(filename, format, pages, onProgress);
    }

    async function saveBrowserExport(filename, format) {
        showProgress('正在准备导出...');
        const result = await createExportBlob({ filename, format });
        ensureNotCanceled();
        saveAs(result.blob, `${filename}.${result.extension}`);
        setProgress('导出完成。', 100);
        hideProgress();
    }

    async function saveLocalExport(filename, format) {
        showProgress('正在交给本地导出服务...');
        const payload = {
            url: location.href.split('#')[0],
            markdown: el('textInput').value,
            state: HW.app.captureState(),
            options: { filename, format }
        };
        const response = await fetch(HW.config.localExporterUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await response.text());
        const blob = await response.blob();
        const ext = response.headers.get('x-export-extension') || (format === 'pdf' ? 'pdf' : 'zip');
        saveAs(blob, `${filename}.${ext}`);
        setProgress('本地导出完成。', 100);
        hideProgress();
    }

    async function confirmExport() {
        closeExportModal();
        const format = document.querySelector('input[name="exportFormat"]:checked').value;
        const filename = safeFilename(el('exportFilename').value || '手写作业');
        const useLocal = !!(el('useLocalExporter') && el('useLocalExporter').checked);
        if (!getPages().length) {
            alert('没有可导出的页面！');
            return;
        }
        HW.state.isRenderingCanceled = false;
        window.isRenderingCanceled = false;

        try {
            if (useLocal) await saveLocalExport(filename, format);
            else await saveBrowserExport(filename, format);
        } catch (error) {
            if (error.message === 'EXPORT_CANCELED') return;
            console.error('导出失败', error);
            if (useLocal) {
                setProgress('本地服务不可用，正在回退到浏览器导出...', 8);
                await saveBrowserExport(filename, format);
                return;
            }
            alert(`导出失败：${error.message || error}`);
            hideProgress(0);
        }
    }

    HW.exporter = {
        openExportModal,
        closeExportModal,
        cancelExport,
        confirmExport,
        capturePage,
        createExportBlob,
        blobToDataUrl
    };
})();
