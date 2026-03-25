const container = document.getElementById('paper-container');
const textInput = document.getElementById('textInput');
const stagingArea = document.getElementById('staging-area');
const bgPreview = document.getElementById('bgPreview');
const resetBgBtn = document.getElementById('resetBgBtn');

let globalPageCounter = 0; 
const STATE_KEY = 'hw_generator_state_v33'; // 升级密钥，确保不受旧残缺数据干扰

let config = { tiltMode: 'random', yMode: 'random', slantMode: 'random' };
let currentScribbleStyle = 1;
let currentInkStyle = 1;
window.isRenderingCanceled = false;

// ==========================================
// 🚀 Github Pages 部署专属：内置预设字体配置
// ==========================================
// ==========================================
// 🚀 Github Pages 部署专属：内置预设字体配置
// ==========================================
// 【终极加速】：国内访问 GitHub 极慢，强烈建议使用 jsDelivr CDN。
// 请将下面链接中的 '你的仓库名' 替换为你真实的仓库名 (比如 markdown-to-handwriting)
// 如果你还在本地测试，先把这行改成 const CDN_PREFIX = "./"; 即可。
const CDN_PREFIX = "./";

const BUILTIN_FONTS = {
    text: [
        { id: "bt_chen", name: "辰宇落雁体", url: CDN_PREFIX + "正文字体/ChenYuluoyan-2.0-Thin.ttf" },
        { id: "bt_honglei", name: "洪雷拙书", url: CDN_PREFIX + "正文字体/HongLeiZhuoShuJianTi-2.ttf" },
        { id: "bt_lixu", name: "李旭科行书", url: CDN_PREFIX + "正文字体/LiXuKeJingDianXingShu-2.ttf" },
        { id: "bt_yozai", name: "悠哉字体", url: CDN_PREFIX + "正文字体/Yozai-Medium.ttf" },
        { id: "bt_yiqi", name: "义启手写体", url: CDN_PREFIX + "正文字体/义启手写体.ttf" },
        { id: "bt_yunyan", name: "云烟体", url: CDN_PREFIX + "正文字体/云烟体.ttf" },
        { id: "bt_ximai", name: "喜脉喜欢体", url: CDN_PREFIX + "正文字体/字制区喜脉喜欢体.ttf" },
        { id: "bt_liguofu", name: "李国夫手写体", url: CDN_PREFIX + "正文字体/李国夫手写体.ttf" },
        { id: "bt_qingye", name: "青叶手写体", url: CDN_PREFIX + "正文字体/青叶手写体.ttf" },
        { id: "bt_hw_text", name: "Handwritten (参考)", url: CDN_PREFIX + "正文字体/handwritten.ttf" }
    ],
    math: [
        { id: "bm_arch", name: "Architects Daughter", url: CDN_PREFIX + "公式字体/ArchitectsDaughter-Regular.ttf" },
        { id: "bm_caveat", name: "Caveat", url: CDN_PREFIX + "公式字体/Caveat-Regular.ttf" },
        { id: "bm_comic", name: "Comic Shanns", url: CDN_PREFIX + "公式字体/comic shanns 2.ttf" },
        { id: "bm_gochi", name: "Gochi Hand", url: CDN_PREFIX + "公式字体/GochiHand-Regular.ttf" },
        { id: "bm_kalam_b", name: "Kalam Bold", url: CDN_PREFIX + "公式字体/Kalam-Bold.ttf" },
        { id: "bm_kalam_l", name: "Kalam Light", url: CDN_PREFIX + "公式字体/Kalam-Light.ttf" },
        { id: "bm_kalam_r", name: "Kalam Regular", url: CDN_PREFIX + "公式字体/Kalam-Regular.ttf" },
        { id: "bm_neucha", name: "Neucha", url: CDN_PREFIX + "公式字体/Neucha.ttf" },
        { id: "bm_shadows", name: "Shadows Into Light", url: CDN_PREFIX + "公式字体/ShadowsIntoLight-Regular.ttf" },
        { id: "bm_virgil", name: "Virgil", url: CDN_PREFIX + "公式字体/Virgil.woff2" },
        { id: "bm_hw_math", name: "Handwritten (公式)", url: CDN_PREFIX + "公式字体/handwritten.ttf" }
    ]
};

// 动态注入内置字体引擎 (极速版：瞬间渲染列表，按需加载字体)
async function initBuiltinFonts() {
    for (let type in BUILTIN_FONTS) {
        const listEl = document.getElementById(type + 'FontList');
        if(!listEl) continue;

        if (BUILTIN_FONTS[type].length > 0) { listEl.style.display = 'block'; }

        const defaultText = type === 'math' ? '系统默认 (Cambria)' : '系统默认 (楷体)';
        listEl.innerHTML = `<div class="font-item active" data-val="default" onclick="selectFont('${type}', 'default', this)"><span class="font-item-text">${defaultText}</span></div>`;

        BUILTIN_FONTS[type].forEach(font => {
            // 1. 注入 CSS，使用 font-display: swap 保证不阻塞页面渲染
            const style = document.createElement('style');
            style.textContent = `@font-face { font-family: '${font.id}'; src: url('${font.url}'); font-display: swap; }`;
            document.head.appendChild(style);

            // 2. 瞬间生成 DOM 节点（不要再用 await 死等下载了！）
            const item = document.createElement('div');
            item.className = 'font-item';
            item.setAttribute('data-val', font.id);
            item.innerHTML = `<span class="font-item-text" style="font-family: '${font.id}', 'Kaiti', serif;"><span class="tag-builtin">内置</span>${font.name}</span>`;
            
            // 3. 点击时的优雅加载交互
            item.onclick = function() { 
                const textSpan = this.querySelector('.font-item-text');
                const originalHtml = textSpan.innerHTML;
                // 变身橙色加载提示
                textSpan.innerHTML = `<span class="tag-builtin" style="background:#f59e0b; color:white;">下载中</span>${font.name}`;
                
                // 强行要求浏览器优先下载该字体，下好了再排版
                document.fonts.load(`16px "${font.id}"`).then(() => {
                    textSpan.innerHTML = originalHtml;
                    selectFont(type, font.id, this);
                }).catch(() => {
                    textSpan.innerHTML = `<span class="tag-builtin" style="background:#ef4444; color:white;">失败</span>请检查网络`;
                    setTimeout(() => { textSpan.innerHTML = originalHtml; }, 2000);
                });
            };
            
            listEl.appendChild(item);
        });
    }
}
// ==========================================
// ==========================================

function setMode(type, val, el) {
    const parent = el.parentElement;
    Array.from(parent.children).forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    config[`${type}Mode`] = val;
    saveState();
    debounceRender();
}

function setStyle(type, val, el) {
    const parent = el.parentElement;
    Array.from(parent.children).forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    
    if(type === 'scribble') {
        currentScribbleStyle = val;
        const cssInput = document.getElementById('customScribbleCss');
        if(cssInput) cssInput.style.display = (val === 'custom') ? 'block' : 'none';
    }
    if(type === 'ink') {
        currentInkStyle = val;
        const cssInput = document.getElementById('customInkCss');
        if(cssInput) cssInput.style.display = (val === 'custom') ? 'block' : 'none';
    }
    
    updateCustomCss(); 
    saveState();
    forceRender(); 
}

function updateCustomCss() {
    let sc = document.getElementById('customScribbleCss');
    let ic = document.getElementById('customInkCss');
    let scribbleCss = sc ? sc.value : '';
    let inkCss = ic ? ic.value : '';
    
    let styleTag = document.getElementById('geek-custom-css');
    if(!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'geek-custom-css';
        document.head.appendChild(styleTag);
    }
    
    styleTag.innerHTML = `
        .scribble-line.scribble-type-custom { position: absolute; pointer-events: none; z-index: 5; top:0; bottom:0; left:0; right:0; ${scribbleCss} }
        .ink-type-custom { width: 20px; height: 20px; background: rgba(28,28,36,0.92); border-radius: 50%; box-shadow: inset 1px -1px 2px rgba(0,0,0,0.5); ${inkCss} }
    `;
}

let renderTimeout;
function debounceRender() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => { saveState(); renderContent(); }, 400); 
}
function forceRender() { clearTimeout(renderTimeout); saveState(); renderContent(); }

// 绑定字体上传逻辑 (追加彩色导入 Tag 与 叉号删除功能)
function bindFontUploader(inputId, listId, typeName) {
    document.getElementById(inputId).addEventListener('change', async (e) => {
        const files = Array.from(e.target.files).filter(f => f.name.match(/\.(ttf|otf|woff|woff2)$/i));
        if(files.length === 0) return;
        
        const listEl = document.getElementById(listId);
        listEl.style.display = 'block';
        // ⚠️ 删除了这里覆盖 listEl.innerHTML 的代码，现在是“安全追加模式”！

        let firstFontName = null; let firstFontEl = null;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fontName = `Custom_${typeName}_${Date.now()}_${i}`;
            const reader = new FileReader();
            
            reader.onload = async function(e_read) {
                const fontDataUrl = e_read.target.result;
                const style = document.createElement('style');
                style.textContent = `@font-face { font-family: '${fontName}'; src: url('${fontDataUrl}'); }`;
                document.head.appendChild(style);
                
                try {
                    await document.fonts.load(`16px "${fontName}"`);
                    if(!firstFontName) firstFontName = fontName;
                    
                    const item = document.createElement('div');
                    item.className = 'font-item';
                    item.setAttribute('data-val', fontName);
                    
                    // 👇 加入优雅的“导入”标签 和 右侧的“删除叉号”
                    item.innerHTML = `
                        <span class="font-item-text" style="font-family: '${fontName}', 'Kaiti', serif;">
                            <span class="tag-imported">导入</span>${file.name}
                        </span>
                        <span class="font-del-btn" title="移除该字体">×</span>
                    `;
                    
                    // 点击字体项切换
                    item.onclick = function(event) { 
                        if (event.target.className === 'font-del-btn') return; // 点叉号时不要触发选择
                        selectFont(typeName, fontName, this); 
                    };

                    // 绑定删除按钮的逻辑
                    const delBtn = item.querySelector('.font-del-btn');
                    delBtn.onclick = function(event) {
                        event.stopPropagation(); // 阻止事件冒泡
                        // 如果正在删除的是当前选中的字体，安全退回到“默认字体”
                        if(item.classList.contains('active')) {
                            const defaultEl = listEl.querySelector('[data-val="default"]');
                            if(defaultEl) selectFont(typeName, 'default', defaultEl);
                        }
                        item.remove();       // 从 DOM 彻底销毁该项
                        style.remove();      // 从网页头部销毁它的残留 CSS 内存
                    };

                    listEl.appendChild(item); // 把新导入的字体追加到底部
                    
                    if(!firstFontEl) { 
                        firstFontEl = item; 
                        selectFont(typeName, firstFontName, firstFontEl); 
                    }
                } catch(err) { console.error("字体应用失败", err); }
            };
            reader.readAsDataURL(file);
        }
        
        // 【关键体验优化】：清空文件上传器的值，允许用户反复上传同一个文件夹里的文件
        e.target.value = '';
    });
}
bindFontUploader('textFontInput', 'textFontList', 'text');
bindFontUploader('mathFontInput', 'mathFontList', 'math');

function selectFont(type, fontName, el) {
    const parent = el.parentElement;
    Array.from(parent.children).forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    const fallback = type === 'math' ? "'Cambria Math', 'Times New Roman', serif" : "'Kaiti', 'STKaiti', serif";
    const fontStr = fontName === 'default' ? `'MyHandwriting', ${fallback}` : `'${fontName}', ${fallback}`;
    document.documentElement.style.setProperty(`--${type}-font`, fontStr);
    debounceRender(); 
}

let cropper = null;
const cropModal = document.getElementById('cropModal');
const cropImage = document.getElementById('cropImage');

document.getElementById('bgImageInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        cropImage.src = evt.target.result;
        cropModal.style.display = 'flex';
        if(cropper) cropper.destroy();
        cropper = new Cropper(cropImage, { 
            aspectRatio: 800 / 1131, 
            viewMode: 1, 
            autoCropArea: 0.9,
            wheelZoomRatio: 0.05, 
            ready: function() {
                const initialZoom = this.cropper.getImageData().width / this.cropper.getImageData().naturalWidth;
                document.getElementById('cropZoomSlider').value = initialZoom;
                document.getElementById('cropZoomInput').value = initialZoom.toFixed(2);
            },
            zoom: function(e) {
                document.getElementById('cropZoomSlider').value = e.detail.ratio;
                document.getElementById('cropZoomInput').value = e.detail.ratio.toFixed(2);
            }
        });
    };
    reader.readAsDataURL(file);
});

document.getElementById('cropZoomSlider').addEventListener('input', function() {
    if(cropper) cropper.zoomTo(parseFloat(this.value));
    document.getElementById('cropZoomInput').value = parseFloat(this.value).toFixed(2);
});
document.getElementById('cropZoomInput').addEventListener('change', function() {
    let val = parseFloat(this.value);
    if(isNaN(val) || val <= 0) val = 0.1;
    if(cropper) cropper.zoomTo(val);
    this.value = val.toFixed(2);
    document.getElementById('cropZoomSlider').value = val;
});

function closeCropModal() { cropModal.style.display = 'none'; if(cropper) cropper.destroy(); document.getElementById('bgImageInput').value = ''; }

function applyCrop() {
    if(!cropper) return;
    const croppedCanvas = cropper.getCroppedCanvas({ width: 800, height: 1131 });
    const base64Data = croppedCanvas.toDataURL('image/jpeg', 0.9);
    applyBg(base64Data);
    closeCropModal(); saveState(); debounceRender();
}

function applyBg(base64Data) {
    document.documentElement.style.setProperty('--paper-bg-image', `url('${base64Data}')`);
    bgPreview.style.backgroundImage = `url('${base64Data}')`;
    bgPreview.style.display = 'block';
    resetBgBtn.style.display = 'block';
    // 删除了修改文字的逻辑，保持它永远是“上传背景图片”
}

function resetBg() {
    document.documentElement.style.setProperty('--paper-bg-image', "url('paper_bg.jpg')");
    bgPreview.style.display = 'none'; resetBgBtn.style.display = 'none'; 
    // 删除了修改文字的逻辑，保持它永远是“上传背景图片”
    saveState(); debounceRender();
}

document.querySelectorAll('.editable-val').forEach(span => {
    span.addEventListener('blur', function() {
        let inputId = this.id.replace('val', ''); 
        inputId = inputId.charAt(0).toLowerCase() + inputId.slice(1); 
        const inputEl = document.getElementById(inputId);
        if(inputEl) {
            let val = parseFloat(this.innerText);
            if(isNaN(val)) val = inputEl.value; 
            val = Math.max(inputEl.min, Math.min(inputEl.max, val));
            inputEl.value = val; this.innerText = val; 
            if(inputId === 'wobble') document.querySelectorAll('.wobble-map').forEach(map => map.setAttribute('scale', val));
            debounceRender();
        }
    });
    span.addEventListener('keydown', function(e) { if(e.key === 'Enter') { e.preventDefault(); this.blur(); } });
});

const inputs = ['padTop', 'padBottom', 'padLeft', 'padRight', 'fontSize', 'mathSize', 'lineHeight', 'wobble', 'lineSlant', 'charTilt', 'charY', 'charX', 'charScale', 'letterSpace', 'inkSize', 'scribbleRand'];
inputs.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', function() {
        const valId = 'val' + id.charAt(0).toUpperCase() + id.slice(1);
        if(document.getElementById(valId)) document.getElementById(valId).innerText = this.value;
        debounceRender(); 
        if(id === 'wobble') document.querySelectorAll('.wobble-map').forEach(map => map.setAttribute('scale', this.value));
    });
});

// 【核心逻辑】：解析公式、处理漏墨、处理涂改标记、自动转公式
const protectMathGlobally = (text) => {
    let blocks = [];
    const inkBase = parseFloat(document.getElementById('inkSize').value) || 1.0;

    let temp = text;
    
    // 1. 优先提取漏墨标记
    temp = temp.replace(/\[ink\]/g, () => { 
        const scale = (Math.random() * 0.6 + 0.7) * inkBase; 
        const rot = Math.random() * 360; 
        const offsetX = -10 - Math.random() * 30; 
        const offsetY = (Math.random() - 0.5) * 30;
        const html = `<span class="ink-blot ink-type-${currentInkStyle}" style="transform: translate(${offsetX}px, ${offsetY}px) scale(${scale}) rotate(${rot}deg);"></span>`;
        blocks.push(html); return `@@MATH_EF_${blocks.length - 1}@@`; 
    });

    // 2. 提取保护原生公式
    temp = temp.replace(/\\begin\{([a-zA-Z0-9*]+)\}[\s\S]*?\\end\{\1\}/g, m => {
        blocks.push(m); return `@@MATH_ENV_${blocks.length - 1}@@`;
    });
    temp = temp.replace(/\$\$([\s\S]*?)\$\$/g, m => {
        blocks.push(m); return `@@MATH_BLOCK_${blocks.length - 1}@@`;
    });
    temp = temp.replace(/\$(.*?)\$/g, m => {
        blocks.push(m); return `@@MATH_INLINE_${blocks.length - 1}@@`;
    });
    
    // 3. 自动字母/数字转公式
    const isAutoMath = document.getElementById('autoMath') && document.getElementById('autoMath').checked;
    if (isAutoMath) {
        let parts = temp.split(/(@@.*?@@)/);
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) { 
                parts[i] = parts[i].replace(/[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*/g, m => {
                    blocks.push(`$${m}$`);
                    return `@@MATH_INLINE_${blocks.length - 1}@@`;
                });
            }
        }
        temp = parts.join('');
    }
    
    // 4. 将涂改符号拆解为首尾标志，方便底层逐字注入真实标签
    temp = temp.replace(/~~([\s\S]*?)~~/g, '@@S_START@@$1@@S_END@@');
    
    return { temp, blocks };
};

const restoreMathRecursive = (text, blocks) => { 
    let res = text;
    while (/@@MATH_(?:ENV|BLOCK|INLINE|EF)_(\d+)@@/.test(res)) {
        res = res.replace(/@@MATH_(?:ENV|BLOCK|INLINE|EF)_(\d+)@@/g, (m, i) => blocks[i]);
    }
    return res;
};

// 【核心逻辑】：逐字扰动与涂改标签物理注入
function applyJitterOnly(lineStr, maxTilt, maxY, renderState) {
    let resultHTML = '';
    let currentTilt = 0; let currentY = 0;
    let currentX = 0; let currentScaleDiff = 0;
    
    const maxX = parseFloat(document.getElementById('charX').value) || 0;
    const maxScale = parseFloat(document.getElementById('charScale').value) || 0;
    const lSpace = parseFloat(document.getElementById('letterSpace').value) || 0;

    let i = 0;
    while(i < lineStr.length) {
        if (lineStr.substring(i, i+11) === '@@S_START@@') {
            renderState.isScribble = true; i += 11; continue;
        }
        if (lineStr.substring(i, i+9) === '@@S_END@@') {
            renderState.isScribble = false; i += 9; continue;
        }

        if (lineStr.substring(i, i+6).startsWith('@@MATH')) {
            let match = lineStr.substring(i).match(/^@@MATH_(ENV|BLOCK|INLINE|EF)_(\d+)@@/);
            if (match) {
                if (renderState.isScribble) {
                    let mType = match[1];
                    let wrapClass = (mType === 'BLOCK' || mType === 'ENV') ? 'block-math-scribble' : 'inline-math-scribble';
                    resultHTML += `<span class="${wrapClass}">${match[0]}<span class="scribble-line scribble-type-${currentScribbleStyle}"></span></span>`;
                } else {
                    resultHTML += match[0];
                }
                i += match[0].length;
                continue;
            }
        }
        
        let char = lineStr[i];
        if (char === ' ') {
            if (renderState.isScribble) {
                resultHTML += `<span class="char-span" style="margin-right: ${lSpace}px;">&nbsp;<span class="scribble-line scribble-type-${currentScribbleStyle}"></span></span>`;
            } else {
                resultHTML += char; 
            }
            i++; continue;
        }
        
        if (config.tiltMode === 'random') {
            currentTilt += (Math.random() - 0.5) * (maxTilt * 0.4); 
            currentTilt = Math.max(-maxTilt, Math.min(maxTilt, currentTilt)); 
        } else currentTilt = config.tiltMode === 'left' ? -maxTilt : maxTilt;

        if (config.yMode === 'random') {
            currentY += (Math.random() - 0.5) * (maxY * 0.3);
            currentY = Math.max(-maxY, Math.min(maxY, currentY));
        } else currentY = config.yMode === 'up' ? -maxY : maxY;

        if(maxX > 0) {
            currentX += (Math.random() - 0.5) * (maxX * 0.5);
            currentX = Math.max(-maxX, Math.min(maxX, currentX));
        } else { currentX = 0; }

        if(maxScale > 0) {
            currentScaleDiff += (Math.random() - 0.5) * (maxScale * 0.4);
            currentScaleDiff = Math.max(-maxScale, Math.min(maxScale, currentScaleDiff));
        } else { currentScaleDiff = 0; }
        
        let actualScale = 1.0 + currentScaleDiff;

        let scribbleHtml = renderState.isScribble ? `<span class="scribble-line scribble-type-${currentScribbleStyle}"></span>` : '';
        resultHTML += `<span class="char-span" style="transform: translate(${currentX}px, ${currentY}px) rotate(${currentTilt}deg) scale(${actualScale}); margin-right: ${lSpace}px;">${char}${scribbleHtml}</span>`;
        i++;
    }
    return resultHTML;
}

// 【核心逻辑】：主渲染流程
async function renderContent() {
    window.isRenderingCanceled = false;
    
    const mSize = parseFloat(document.getElementById('mathSize').value) || 0.85;
    document.documentElement.style.setProperty('--math-scale', mSize);

    let content = textInput.value;
    if (document.getElementById('removeEmptyLines') && document.getElementById('removeEmptyLines').checked) {
        content = content.replace(/\n\s*\n+/g, '\n'); 
    }
    
    let hwContent = content.replace(/\*\*([^*]+)\*\*/g, '$1'); 
    hwContent = hwContent.replace(/^#{1,6}\s*/gm, '');       
    hwContent = hwContent.replace(/^>\s*/gm, '');            
    hwContent = hwContent.replace(/`(.*?)`/g, '$1'); 
    
    hwContent = hwContent.replace(/^[ \t]*[-*_]{3,}[ \t]*\r?$/gm, '@@PAGE_BREAK@@');
    hwContent = hwContent.trimEnd();

    const { temp, blocks } = protectMathGlobally(hwContent);

    const pt = parseInt(document.getElementById('padTop').value);
    const pb = parseInt(document.getElementById('padBottom').value);
    const pl = parseInt(document.getElementById('padLeft').value);
    const pr = parseInt(document.getElementById('padRight').value);

    const fSize = parseInt(document.getElementById('fontSize').value);
    const lHeight = parseFloat(document.getElementById('lineHeight').value);
    const maxSlant = parseFloat(document.getElementById('lineSlant').value); 
    const maxTilt = parseFloat(document.getElementById('charTilt').value); 
    const maxY = parseFloat(document.getElementById('charY').value); 
    
    const stageWidth = 800 - pl - pr;
    stagingArea.style.width = stageWidth + 'px'; 
    stagingArea.style.fontSize = fSize + 'px';
    stagingArea.style.lineHeight = lHeight;
    stagingArea.style.fontFamily = "var(--text-font)";
    
    let lines = temp.split('\n');
    let stagingHtml = '';
    
    let renderState = { isScribble: false }; 
    
    lines.forEach(line => {
        let trimmed = line.trim();
        if(trimmed === '@@PAGE_BREAK@@') {
            stagingHtml += '<div class="page-break" style="height:0;"></div>';
        } else if (trimmed === '') {
            stagingHtml += `<div class="line-block" style="height: ${lHeight}em;"></div>`;
        } else {
            let lineAngle = 0;
            if (config.slantMode === 'random') lineAngle = (Math.random() * maxSlant * 2) - maxSlant;
            else lineAngle = config.slantMode === 'up' ? -maxSlant : maxSlant;
            let extraMargin = Math.abs(Math.sin(lineAngle * Math.PI / 180) * stageWidth);
            let jitteredText = applyJitterOnly(line, maxTilt, maxY, renderState);
            stagingHtml += `<div class="line-block" style="transform: rotate(${lineAngle}deg); margin-bottom: ${extraMargin * 0.4}px;">${jitteredText}</div>`;
        }
    });
    
    stagingArea.innerHTML = restoreMathRecursive(stagingHtml, blocks);

    // 防崩核心：渲染前清理 MathJax 缓存，防止频繁修改导致内存爆炸 (OOM)
    if (window.MathJax && MathJax.typesetClear) {
        MathJax.typesetClear();
    }
    await MathJax.typesetPromise([stagingArea]);

    const mjxContainers = stagingArea.querySelectorAll('mjx-container');
    mjxContainers.forEach(mjx => {
        let mTilt = (Math.random() - 0.5) * maxTilt * 0.7; 
        let mY = (Math.random() - 0.5) * maxY * 0.6;
        let mScale = 1.0 + (Math.random() - 0.5) * 0.05;
        
        mjx.style.transform = `translate(0px, ${mY}px) rotate(${mTilt}deg) scale(${mScale})`;
        
        if (!mjx.hasAttribute('display')) {
            mjx.style.display = 'inline-block';
            mjx.style.margin = '0 2px';
        }
    });

    // 记录重绘前的滚动条位置，防止跳转回顶部
    const scrollArea = document.querySelector('.paper-scroll-area');
    const previousScrollTop = scrollArea ? scrollArea.scrollTop : 0;

    container.innerHTML = '';
    const MAX_HEIGHT = 1131 - pt - pb; 
    let currentContentBox = createNewPage(fSize, lHeight, pt, pb, pl, pr);
    const children = Array.from(stagingArea.children);

    for (let i = 0; i < children.length; i++) {
        if(window.isRenderingCanceled) break;
        const child = children[i];
        if (child.className === 'page-break') {
            currentContentBox = createNewPage(fSize, lHeight, pt, pb, pl, pr); continue;
        }
        currentContentBox.appendChild(child);
        if (currentContentBox.offsetHeight > MAX_HEIGHT && currentContentBox.children.length > 1) {
            currentContentBox.removeChild(child);
            currentContentBox = createNewPage(fSize, lHeight, pt, pb, pl, pr);
            currentContentBox.appendChild(child);
        }
    }

    document.querySelectorAll('.paper-page').forEach(page => {
        const box = page.querySelector('.content-box');
        if (box && box.innerText.trim() === '' && box.querySelectorAll('mjx-container').length === 0 && box.querySelectorAll('.ink-blot').length === 0) page.remove();
    });

    // 还原滚动条位置
    if (scrollArea) {
        scrollArea.scrollTop = previousScrollTop;
    }
}

function createNewPage(fSize, lHeight, pt, pb, pl, pr) {
    globalPageCounter++;
    const filterId = `handdrawn-wobble-${globalPageCounter}`;
    const currentWobble = document.getElementById('wobble').value;

    const pageDiv = document.createElement('div');
    pageDiv.className = 'paper-page';
    pageDiv.style.padding = `${pt}px ${pr}px ${pb}px ${pl}px`; 

    const svgWrapper = document.createElement('div');
    svgWrapper.innerHTML = `<svg style="position:absolute; width:0; height:0; overflow:hidden;"><filter id="${filterId}"><feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="${currentWobble}" xChannelSelector="R" yChannelSelector="G" class="wobble-map" /></filter></svg>`;
    pageDiv.appendChild(svgWrapper);

    const contentBox = document.createElement('div');
    contentBox.className = 'content-box';
    contentBox.style.fontSize = fSize + 'px';
    contentBox.style.lineHeight = lHeight;
    contentBox.style.filter = `url(#${filterId})`; 
    
    pageDiv.appendChild(contentBox);
    container.appendChild(pageDiv);
    return contentBox;
}

function saveState() {
    const bgImageVar = document.documentElement.style.getPropertyValue('--paper-bg-image');
    const bgBase64 = bgImageVar && bgImageVar.startsWith("url('data:image") ? bgImageVar.match(/url\('(.*)'\)/)[1] : null;

    const state = {
        text: textInput.value, 
        removeEmptyLines: document.getElementById('removeEmptyLines') ? document.getElementById('removeEmptyLines').checked : false,
        autoMath: document.getElementById('autoMath') ? document.getElementById('autoMath').checked : false,
        scribble: currentScribbleStyle, ink: currentInkStyle,
        scribbleCss: document.getElementById('customScribbleCss') ? document.getElementById('customScribbleCss').value : '',
        inkCss: document.getElementById('customInkCss') ? document.getElementById('customInkCss').value : '',
        customBg: bgBase64, config: config
    };
    
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) state[id] = el.value;
    });

    localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

window.yieldThread = (ms = 30) => new Promise(resolve => setTimeout(resolve, ms));

// ======================= 导出模块开始 =======================
function openExportModal() { document.getElementById('export-modal').style.display = 'flex'; }
function closeExportModal() { document.getElementById('export-modal').style.display = 'none'; }
function cancelExport() { window.isRenderingCanceled = true; document.getElementById('progress-modal').style.display = 'none'; }

function confirmExport() {
    closeExportModal();
    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    const filename = document.getElementById('exportFilename').value || "手写作业";
    if (format === 'zip') downloadZip(filename);
    else downloadPdf(filename);
}

// 超清修正：强制以 2x 分辨率截取图片。2倍刚刚好，既清晰又不会引起滤镜噪点起雾！
async function generateHighResImage(pageEl) {
    const scale = 2; 
    const filters = pageEl.querySelectorAll('filter');
    const filterStates = [];
    
    // 逆向补偿滤镜噪点
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

    const origBg = pageEl.style.backgroundImage;
    pageEl.style.backgroundImage = getComputedStyle(document.documentElement).getPropertyValue('--paper-bg-image');
    
    await window.yieldThread(50); 

    const config = {
        quality: 1.0,
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
    } finally {
        filterStates.forEach(state => {
            state.turb.setAttribute('baseFrequency', state.baseFreq);
            state.disp.setAttribute('scale', state.dispScale);
        });
        pageEl.style.backgroundImage = origBg; 
    }
}

async function downloadZip(filename) {
    const pages = document.querySelectorAll('.paper-page'); if(pages.length === 0) return;
    window.isRenderingCanceled = false;
    
    const pModal = document.getElementById('progress-modal');
    const pText = document.getElementById('progress-text');
    const pBar = document.getElementById('progress-bar');
    
    if(pModal) pModal.style.display = 'flex';
    if(pBar) pBar.style.transition = 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    if(pText) pText.innerText = `准备打包中...`;
    if(pBar) pBar.style.width = '0%';
    await window.yieldThread(300);

    let zip = new JSZip();
    for (let i = 0; i < pages.length; i++) {
        if(window.isRenderingCanceled) return;
        
        let baseProgress = (i / pages.length) * 100;
        let halfProgress = baseProgress + (50 / pages.length);
        if(pText) pText.innerText = `正在渲染高清图像: ${i+1}/${pages.length} 页`;
        if(pBar) pBar.style.width = halfProgress + '%';
        await window.yieldThread(400); 
        
        try {
            const imgData = await generateHighResImage(pages[i]);
            if(window.isRenderingCanceled) return;
            zip.file(`${filename}_第${i + 1}页.jpg`, imgData.split(',')[1], {base64: true});
        } catch (e) { console.error(e); }

        let fullProgress = ((i + 1) / pages.length) * 100;
        if(pBar) pBar.style.width = fullProgress + '%';
        await window.yieldThread(400);
    }
    if(window.isRenderingCanceled) return;

    if(pText) pText.innerText = `生成完毕，正在封装 ZIP...`;
    await window.yieldThread(300);
    
    zip.generateAsync({type:"blob"}).then(content => { 
        saveAs(content, `${filename}.zip`); 
        setTimeout(() => { if(pModal) pModal.style.display = 'none'; }, 800); 
    });
}

async function downloadPdf(filename) {
    const pages = document.querySelectorAll('.paper-page'); if(pages.length === 0) return;
    window.isRenderingCanceled = false;
    
    const pModal = document.getElementById('progress-modal');
    const pText = document.getElementById('progress-text');
    const pBar = document.getElementById('progress-bar');
    
    if(pModal) pModal.style.display = 'flex';
    if(pBar) pBar.style.transition = 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    if(pText) pText.innerText = `准备合成 PDF...`;
    if(pBar) pBar.style.width = '0%';
    await window.yieldThread(300);

    const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4');
    
    for (let i = 0; i < pages.length; i++) {
        if(window.isRenderingCanceled) return;
        
        let baseProgress = (i / pages.length) * 100;
        let halfProgress = baseProgress + (50 / pages.length);
        if(pText) pText.innerText = `正在处理 PDF (图像直出): ${i+1}/${pages.length} 页`;
        if(pBar) pBar.style.width = halfProgress + '%';
        await window.yieldThread(400);
        
        try {
            const imgData = await generateHighResImage(pages[i]);
            if(window.isRenderingCanceled) return;
            
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        } catch (e) { console.error("PDF生成单页失败:", e); }

        let fullProgress = ((i + 1) / pages.length) * 100;
        if(pBar) pBar.style.width = fullProgress + '%';
        await window.yieldThread(400);
    }
    if(window.isRenderingCanceled) return;

    if(pText) pText.innerText = `处理完毕，正在保存文档...`;
    await window.yieldThread(300);

    pdf.save(`${filename}.pdf`);
    setTimeout(() => { if(pModal) pModal.style.display = 'none'; }, 800);
}
// ======================= 导出模块结束 =======================

// 【生命周期模块】：绝对安全的顺序，优先渲染 DOM 数据，后绑样式按钮
window.onload = async () => { 
    // 新增这一行：优先加载部署好的内置字体
    await initBuiltinFonts();
    
    const savedStr = localStorage.getItem(STATE_KEY);
    if (savedStr) {
        try {
            const state = JSON.parse(savedStr);
            
            // 1. 无副作用回填静态数据
            if(state.text) textInput.value = state.text;
            
            if(state.removeEmptyLines !== undefined) {
                const cb = document.getElementById('removeEmptyLines');
                if(cb) cb.checked = state.removeEmptyLines;
            }
            if(state.autoMath !== undefined) {
                const cb = document.getElementById('autoMath');
                if(cb) cb.checked = state.autoMath;
            }
            
            if(state.scribbleCss) {
                const sCss = document.getElementById('customScribbleCss');
                if(sCss) sCss.value = state.scribbleCss;
            }
            if(state.inkCss) {
                const iCss = document.getElementById('customInkCss');
                if(iCss) iCss.value = state.inkCss;
            }
            
            // 2. 循环回填所有左侧参数框数值
            inputs.forEach(id => {
                if(state[id] !== undefined && document.getElementById(id)) {
                    document.getElementById(id).value = state[id];
                    const valId = 'val' + id.charAt(0).toUpperCase() + id.slice(1);
                    if(document.getElementById(valId)) {
                        document.getElementById(valId).innerText = state[id];
                    }
                    if(id === 'wobble') {
                        document.querySelectorAll('.wobble-map').forEach(map => map.setAttribute('scale', state[id]));
                    }
                }
            });

            // 3. 所有 DOM 准备完毕后，再触发事件监听模拟点击，继承状态
            if(state.scribble) {
                let btn = document.querySelector(`#scribbleSelector .style-btn[data-val="${state.scribble}"]`);
                if(btn) setStyle('scribble', state.scribble, btn);
            }
            if(state.ink) {
                let btn = document.querySelector(`#inkSelector .style-btn[data-val="${state.ink}"]`);
                if(btn) setStyle('ink', state.ink, btn);
            }
            
            if(state.customBg) applyBg(state.customBg);
            
            if(state.config) {
                config = state.config;
                let tiltBtn = document.querySelector(`#tiltMode .mode-btn[data-val="${config.tiltMode}"]`);
                if(tiltBtn) tiltBtn.click();
                
                let yBtn = document.querySelector(`#yMode .mode-btn[data-val="${config.yMode}"]`);
                if(yBtn) yBtn.click();
                
                let slantBtn = document.querySelector(`#slantMode .mode-btn[data-val="${config.slantMode}"]`);
                if(slantBtn) slantBtn.click();
            }
            
        } catch (e) { console.error("缓存恢复失败，已跳过", e); }
    }
    updateCustomCss();
    renderContent(); 
};

// 获取在线/本地的预设背景并应用
// 【修复核心】：内置背景图片也必须强制走裁剪逻辑，保证 A4 比例并允许用户缩放
// 获取在线/本地的预设背景并应用
function setPresetBg(url) {
    // 去掉了修改 btnLabel 状态的代码，后台静默拉取背景即可
    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.blob();
        })
        .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => {
                cropImage.src = reader.result;
                cropModal.style.display = 'flex';
                if(cropper) cropper.destroy();
                
                cropper = new Cropper(cropImage, { 
                    aspectRatio: 800 / 1131, 
                    viewMode: 1, 
                    autoCropArea: 0.9,
                    wheelZoomRatio: 0.05, 
                    ready: function() {
                        const initialZoom = this.cropper.getImageData().width / this.cropper.getImageData().naturalWidth;
                        document.getElementById('cropZoomSlider').value = initialZoom;
                        document.getElementById('cropZoomInput').value = initialZoom.toFixed(2);
                    },
                    zoom: function(e) {
                        document.getElementById('cropZoomSlider').value = e.detail.ratio;
                        document.getElementById('cropZoomInput').value = e.detail.ratio.toFixed(2);
                    }
                });
            }
            reader.readAsDataURL(blob);
        })
        .catch(err => {
            console.error("背景加载失败:", err);
            alert("内置图片加载失败！\n请确保已部署到 Github Pages 或使用本地服务器(Live Server)运行。");
        });
}