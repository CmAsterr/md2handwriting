(function () {
    const HW = window.HW = window.HW || {};
    const { el, setProgress, showProgress, hideProgress, yieldToBrowser, dataUrlToBlob, loadImage, canvasToBlob, blobToDataUrl, safeFilename } = HW.utils;
    const LOCAL_EXPORT_TIMEOUT = 8 * 60 * 1000;
    const LONG_IMAGE_SCALE = 3;
    const LONG_IMAGE_QUALITY = 0.98;
    const EXPORT_FONT_STYLE_ID = 'export-font-face-overrides';
    const exportFontCache = new Map();

    function setAbortController(controller) {
        HW.state.exportAbortController = controller || null;
    }

    function openExportModal() {
        el('export-modal').style.display = 'flex';
    }

    function closeExportModal() {
        el('export-modal').style.display = 'none';
    }

    function cancelExport() {
        HW.state.isRenderingCanceled = true;
        window.isRenderingCanceled = true;
        if (HW.state.exportAbortController) {
            HW.state.exportAbortController.abort();
            HW.state.exportAbortController = null;
        }
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

    function getSelectedFont(type) {
        const id = HW.state && HW.state[`${type}Font`];
        if (!id || id === 'default') return null;
        const list = HW.config && HW.config.fonts && HW.config.fonts[type];
        return Array.isArray(list) ? list.find(font => font.id === id) || null : null;
    }

    async function blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async function getExportFontSource(font) {
        if (!font || !font.url) return null;
        if (exportFontCache.has(font.id)) return exportFontCache.get(font.id);
        const url = new URL(font.url, document.baseURI).href;
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Font load failed: ${font.name || font.id}`);
        const dataUrl = await blobToDataURL(await response.blob());
        exportFontCache.set(font.id, dataUrl);
        return dataUrl;
    }

    async function prepareExportFonts() {
        const selectedFonts = [getSelectedFont('text'), getSelectedFont('math')].filter(Boolean);
        const builtinStyles = Array.from(document.querySelectorAll('style[id^="font-face-"]'));
        const disabledStates = builtinStyles.map(style => [style, style.disabled]);

        if (!selectedFonts.length) return () => {};

        const rules = [];
        for (const font of selectedFonts) {
            const source = await getExportFontSource(font);
            if (source) rules.push(`@font-face { font-family: '${font.id}'; src: url('${source}'); font-display: block; }`);
        }

        builtinStyles.forEach(style => { style.disabled = true; });
        const styleEl = document.createElement('style');
        styleEl.id = EXPORT_FONT_STYLE_ID;
        styleEl.textContent = rules.join('\n');
        document.head.appendChild(styleEl);

        if (document.fonts && document.fonts.load) {
            await Promise.all(selectedFonts.map(font => document.fonts.load(`16px "${font.id}"`).catch(() => null)));
        }
        if (document.fonts && document.fonts.ready) await document.fonts.ready;

        return () => {
            styleEl.remove();
            disabledStates.forEach(([style, disabled]) => { style.disabled = disabled; });
        };
    }

    async function freezePageFonts(pageEl) {
        const restoreExportFonts = await prepareExportFonts();
        const rootStyle = getComputedStyle(document.documentElement);
        const vars = ['--text-font', '--math-font', '--math-scale', '--ink-color', '--paper-bg-image'];
        const originalVars = vars.map(name => [name, pageEl.style.getPropertyValue(name)]);
        vars.forEach(name => {
            const value = rootStyle.getPropertyValue(name);
            if (value) pageEl.style.setProperty(name, value.trim());
        });

        const mathFont = rootStyle.getPropertyValue('--math-font').trim();
        const mathGlyphs = Array.from(pageEl.querySelectorAll('mjx-c'));
        const originalMathFonts = mathGlyphs.map(node => node.style.fontFamily);
        if (mathFont) mathGlyphs.forEach(node => { node.style.fontFamily = mathFont; });

        if (document.fonts && document.fonts.ready) await document.fonts.ready;

        return () => {
            originalVars.forEach(([name, value]) => {
                if (value) pageEl.style.setProperty(name, value);
                else pageEl.style.removeProperty(name);
            });
            mathGlyphs.forEach((node, index) => {
                node.style.fontFamily = originalMathFonts[index] || '';
            });
            restoreExportFonts();
        };
    }

    async function capturePage(pageEl, scale = 2, quality = 0.94, format = 'jpeg') {
        ensureNotCanceled();
        let restoreFonts = () => {};
        restoreFonts = await freezePageFonts(pageEl);
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
                height: `${pageEl.clientHeight}px`,
                margin: '0',
                boxShadow: 'none',
                backgroundColor: '#ffffff'
            }
        };

        try {
            const dataUrl = format === 'png'
                ? await domtoimage.toPng(pageEl, config)
                : await domtoimage.toJpeg(pageEl, config);
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
            restoreFonts();
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
        const blob = await canvasToBlob(canvas, 'image/jpeg', LONG_IMAGE_QUALITY);
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
            if (onProgress) onProgress(`正在渲染高清图像: ${i + 1}/${pages.length} 页`, (i / pages.length) * 78);
            const dataUrl = await capturePage(pages[i], scale);
            images.push({
                name: `第${i + 1}页.jpg`,
                dataUrl,
                segment: pages[i].dataset.segment || '1'
            });
            if (onProgress) onProgress(`已完成第 ${i + 1}/${pages.length} 页截图`, ((i + 1) / pages.length) * 82);
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
                pageImages.push({ dataUrl: await capturePage(segmentPages[i], LONG_IMAGE_SCALE, LONG_IMAGE_QUALITY, 'png') });
                await yieldToBrowser();
            }
            const dataUrl = await combineImagesVertically(pageImages);
            output.push({ name: `${filename}_第${groupIndex + 1}段.jpg`, dataUrl });
            if (onProgress) onProgress(`已拼接第 ${groupIndex + 1}/${groups.length} 段长图`, 75 + ((groupIndex + 1) / groups.length) * 14);
            await yieldToBrowser();
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
            if (onProgress) onProgress(`正在合成 PDF: ${i + 1}/${pages.length} 页`, (i / pages.length) * 84);
            const dataUrl = await capturePage(pages[i], 2, 0.92);
            if (i > 0) pdf.addPage();
            pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
            if (onProgress) onProgress(`已写入 PDF 第 ${i + 1}/${pages.length} 页`, ((i + 1) / pages.length) * 88);
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

    function startLocalProgress(format) {
        const started = Date.now();
        const baseText = format === 'pdf'
            ? '本地服务正在后台生成 PDF...'
            : format === 'longzip'
                ? '本地服务正在后台生成分段长图 ZIP...'
                : '本地服务正在后台生成图片 ZIP...';
        setProgress(baseText, 6);
        return setInterval(() => {
            if (HW.state.isRenderingCanceled || window.isRenderingCanceled) return;
            const elapsed = Date.now() - started;
            const softPercent = 6 + Math.min(82, Math.log1p(elapsed / 1200) * 18);
            setProgress(`${baseText} 请保持本地导出服务运行。`, softPercent);
        }, 800);
    }

    function localHealthUrl() {
        return HW.config.localExporterUrl.replace(/\/export(?:\?.*)?$/, '/health');
    }

    async function checkLocalExporter() {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const response = await fetch(localHealthUrl(), {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            });
            if (!response.ok) throw new Error(await response.text());
            return await response.json().catch(() => ({}));
        } catch (error) {
            const reason = error.name === 'AbortError'
                ? '本地导出服务连接超时。'
                : '浏览器无法连接本地导出服务。';
            throw new Error(`${reason} 请确认 local-export-server.js 正在运行，并允许当前网页访问 http://127.0.0.1:8765。`);
        } finally {
            clearTimeout(timer);
        }
    }

    async function saveLocalExport(filename, format) {
        showProgress('正在检测本地导出服务...');
        await checkLocalExporter();
        showProgress('正在交给本地导出服务...');
        const controller = new AbortController();
        setAbortController(controller);
        const timer = setTimeout(() => controller.abort(), LOCAL_EXPORT_TIMEOUT);
        const progressTimer = startLocalProgress(format);
        const payload = {
            url: location.href.split('#')[0],
            markdown: el('textInput').value,
            state: HW.app.captureState(),
            options: { filename, format }
        };
        try {
            const response = await fetch(HW.config.localExporterUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            if (!response.ok) throw new Error(await response.text());
            setProgress('本地服务已返回文件，正在保存...', 94);
            const blob = await response.blob();
            const ext = response.headers.get('x-export-extension') || (format === 'pdf' ? 'pdf' : 'zip');
            saveAs(blob, `${filename}.${ext}`);
            setProgress('本地导出完成。', 100);
            hideProgress();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(HW.state.isRenderingCanceled ? 'EXPORT_CANCELED' : '本地导出超时：本地服务长时间没有返回结果，请重启 local-export-server.js 后重试，或取消“本地加速”改用浏览器导出。');
            }
            throw error;
        } finally {
            clearTimeout(timer);
            clearInterval(progressTimer);
            setAbortController(null);
        }
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
                setProgress('本地导出失败。', 100);
                alert(`本地导出失败：${error.message || error}\n\nGitHub Pages 页面本身可以正常使用浏览器导出；“本地加速”需要本机运行 local-export-server.js，并允许页面访问 http://127.0.0.1:8765。`);
                hideProgress(0);
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
