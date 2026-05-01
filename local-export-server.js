const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const EXPORT_PORT = 8765;
const DEBUG_PORT = 9223;
const MAX_BODY = 25 * 1024 * 1024;
const CDP_TIMEOUT = 8 * 60 * 1000;
const EXPORT_TIMEOUT = 9 * 60 * 1000;
const CDP_RESULT_CHUNK = 1024 * 1024;
const SERVICE_VERSION = '10.19';

let browserProcess = null;
let userDataDir = null;

function findBrowser() {
    const candidates = [
        process.env.CHROME_PATH,
        path.join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.PROGRAMFILES || '', 'Microsoft/Edge/Application/msedge.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Edge/Application/msedge.exe')
    ].filter(Boolean);
    const found = candidates.find(candidate => fs.existsSync(candidate));
    if (!found) {
        throw new Error('未找到 Chrome 或 Edge。可设置 CHROME_PATH 指向浏览器可执行文件。');
    }
    return found;
}

function requestJson(method, route, body) {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port: DEBUG_PORT, path: route, method }, res => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 400) return reject(new Error(data || `HTTP ${res.statusCode}`));
                try { resolve(JSON.parse(data)); }
                catch { resolve(data); }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function waitForDebugEndpoint() {
    const started = Date.now();
    while (Date.now() - started < 10000) {
        try {
            return await requestJson('GET', '/json/version');
        } catch {
            await new Promise(resolve => setTimeout(resolve, 180));
        }
    }
    throw new Error('浏览器调试端口启动超时。');
}

async function ensureBrowser() {
    try {
        await requestJson('GET', '/json/version');
        return;
    } catch {
        // Start a private headless browser below.
    }

    const browserPath = findBrowser();
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md2handwriting-export-'));
    browserProcess = spawn(browserPath, [
        '--headless=new',
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--user-data-dir=${userDataDir}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank'
    ], { stdio: 'ignore' });

    browserProcess.on('exit', () => {
        browserProcess = null;
        if (userDataDir) fs.rm(userDataDir, { recursive: true, force: true }, () => {});
        userDataDir = null;
    });
    await waitForDebugEndpoint();
}

function createCdpClient(wsUrl) {
    let id = 0;
    const pending = new Map();
    const waiters = new Map();
    const ws = new WebSocket(wsUrl);

    ws.onmessage = event => {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else resolve(msg.result);
            return;
        }
        if (msg.method && waiters.has(msg.method)) {
            const list = waiters.get(msg.method);
            waiters.delete(msg.method);
            list.forEach(resolve => resolve(msg.params || {}));
        }
    };

    const openPromise = new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });

    return {
        async send(method, params = {}) {
            await openPromise;
            const callId = ++id;
            ws.send(JSON.stringify({ id: callId, method, params }));
            return new Promise((resolve, reject) => {
                pending.set(callId, { resolve, reject });
                setTimeout(() => {
                    if (pending.has(callId)) {
                        pending.delete(callId);
                        reject(new Error(`${method} timeout`));
                    }
                }, CDP_TIMEOUT);
            });
        },
        waitFor(method, timeout = 30000) {
            return new Promise((resolve, reject) => {
                if (!waiters.has(method)) waiters.set(method, []);
                waiters.get(method).push(resolve);
                setTimeout(() => reject(new Error(`${method} wait timeout`)), timeout);
            });
        },
        close() {
            ws.close();
        }
    };
}

async function waitForApp(cdp) {
    const started = Date.now();
    while (Date.now() - started < 30000) {
        const ready = await cdp.send('Runtime.evaluate', {
            expression: `
                (() => {
                    const depsReady = !!(window.domtoimage && window.JSZip && window.jspdf && window.MathJax);
                    return document.readyState === "complete" && depsReady && !!(window.HW && HW.app && HW.exporter);
                })()
            `,
            returnByValue: true
        });
        if (ready.result && ready.result.value) return;
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('页面应用初始化超时。');
}

function describeException(details) {
    if (!details) return '';
    const parts = [];
    if (details.text) parts.push(details.text);
    if (details.exception) {
        if (details.exception.description) parts.push(details.exception.description);
        else if (details.exception.value) parts.push(String(details.exception.value));
    }
    if (details.stackTrace && Array.isArray(details.stackTrace.callFrames)) {
        const frames = details.stackTrace.callFrames.slice(0, 6).map(frame => {
            const location = `${frame.url || '<anonymous>'}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`;
            return `at ${frame.functionName || '<anonymous>'} (${location})`;
        });
        if (frames.length) parts.push(frames.join('\n'));
    }
    return parts.filter(Boolean).join('\n');
}

async function runExport(payload) {
    await ensureBrowser();
    const target = await requestJson('PUT', `/json/new?${encodeURIComponent('about:blank')}`);
    const cdp = createCdpClient(target.webSocketDebuggerUrl);
    try {
        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');
        await cdp.send('Page.navigate', { url: payload.url });
        await cdp.waitFor('Page.loadEventFired', 30000).catch(() => {});
        await waitForApp(cdp);

        const expression = `
            (async () => {
                try {
                    await window.HW.app.applyExternalState(${JSON.stringify(payload.state || {})}, ${JSON.stringify(payload.markdown || '')});
                    const result = await window.HW.exporter.createExportBlob({
                        filename: ${JSON.stringify(payload.options.filename || '手写作业')},
                        format: ${JSON.stringify(payload.options.format || 'pdf')},
                        silent: true
                    });
                    const dataUrl = await window.HW.exporter.blobToDataUrl(result.blob);
                    window.__md2hwExportResult = { dataUrl, extension: result.extension, mime: result.mime };
                    return { ok: true, length: dataUrl.length, extension: result.extension, mime: result.mime };
                } catch (error) {
                    return {
                        ok: false,
                        error: error && (error.stack || error.message || String(error))
                    };
                }
            })()
        `;
        const result = await cdp.send('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true
        });
        if (result.exceptionDetails) throw new Error(describeException(result.exceptionDetails) || '页面导出执行失败');
        const value = result.result && result.result.value;
        if (!value || value.ok === false) {
            throw new Error((value && value.error) || '页面导出未返回有效结果');
        }
        const chunks = [];
        const length = Number(value.length || 0);
        for (let offset = 0; offset < length; offset += CDP_RESULT_CHUNK) {
            const chunkResult = await cdp.send('Runtime.evaluate', {
                expression: `window.__md2hwExportResult.dataUrl.slice(${offset}, ${Math.min(offset + CDP_RESULT_CHUNK, length)})`,
                returnByValue: true
            });
            chunks.push((chunkResult.result && chunkResult.result.value) || '');
        }
        await cdp.send('Runtime.evaluate', {
            expression: 'delete window.__md2hwExportResult',
            returnByValue: true
        }).catch(() => {});
        return { ok: true, dataUrl: chunks.join(''), extension: value.extension, mime: value.mime };
    } finally {
        cdp.close();
        if (target.id) requestJson('GET', `/json/close/${target.id}`).catch(() => {});
    }
}

function withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        let body = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
            size += Buffer.byteLength(chunk);
            if (size > MAX_BODY) {
                reject(new Error('请求体过大。'));
                req.destroy();
                return;
            }
            body += chunk;
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

const server = http.createServer(async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            ok: true,
            service: 'md2handwriting-local-export',
            version: SERVICE_VERSION
        }));
        return;
    }
    if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`md2handwriting local export service is running. version=${SERVICE_VERSION}`);
        return;
    }
    if (req.method !== 'POST' || req.url !== '/export') {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    try {
        const payload = JSON.parse(await readBody(req));
        if (!payload.url || !payload.options) throw new Error('缺少导出参数。');
        const result = await withTimeout(runExport(payload), EXPORT_TIMEOUT, '本地导出超时，请重启 local-export-server.js 后重试。');
        const base64 = result.dataUrl.split(',')[1];
        const buffer = Buffer.from(base64, 'base64');
        res.writeHead(200, {
            'Content-Type': result.mime || 'application/octet-stream',
            'Content-Length': buffer.length,
            'X-Export-Extension': result.extension || 'bin'
        });
        res.end(buffer);
    } catch (error) {
        console.error(error);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(error.message || String(error));
    }
});

server.listen(EXPORT_PORT, '127.0.0.1', () => {
    console.log(`md2handwriting local export service: http://127.0.0.1:${EXPORT_PORT}`);
});

process.on('SIGINT', () => {
    if (browserProcess) browserProcess.kill();
    server.close(() => process.exit(0));
});
