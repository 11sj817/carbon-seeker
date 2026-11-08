/* 真机浏览器验收：Edge CDP 打开产物 → 清空本地状态 → 逐视图检查 + 截图。
   用法：node qa/cdp-check.mjs <port> <baseUrl> <outDir>
   设计要点：
     1. 每个视图独立 target，先 about:blank，清 localStorage 再导航，互不污染；
     2. 先设 device metrics 再导航，移动端才是真的 390 CSS 像素；
     3. 交互测试用真实焦点 + input 事件，验证“改参数 → 结果与图表同步变化”。 */
import fs from 'node:fs';
import path from 'node:path';

const port = process.argv[2] || '9333';
const base = process.argv[3] || 'file:///C:/Temp/cs-qa/index.html';
const outDir = process.argv[4] || 'qa';
const VIEWS = ['overview', 'personal', 'enterprise', 'points', 'dashboard', 'project', 'team', 'method'];
const DESKTOP = { width: 1440, height: 980, deviceScaleFactor: 1, mobile: false };
const PHONE = { width: 390, height: 844, deviceScaleFactor: 1, mobile: false };

fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newTarget() {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  if (!res.ok) throw new Error('创建 target 失败: ' + res.status);
  return res.json();
}

async function closeTarget(id) {
  try { await fetch(`http://127.0.0.1:${port}/json/close/${id}`); } catch { /* 忽略 */ }
}

class CDP {
  constructor(ws) { this.ws = ws; this.seq = 0; this.pending = new Map(); this.errors = []; }
  static async attach(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = () => bad(new Error('WebSocket 失败')); });
    const c = new CDP(ws);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && c.pending.has(m.id)) {
        const { ok, bad } = c.pending.get(m.id);
        c.pending.delete(m.id);
        m.error ? bad(new Error(m.error.message)) : ok(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        c.errors.push(d.text + ' ' + ((d.exception && d.exception.description) || '').split('\n')[0]);
      }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((ok, bad) => {
      this.pending.set(id, { ok, bad });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); bad(new Error(method + ' 超时')); } }, 20000);
    });
  }
  async ev(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      throw new Error('表达式异常: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
    }
    return r.result.value;
  }
}

/* 打开一个干净的页面：清存储 → 导航到带 hash 的地址 */
async function openClean(url, metrics) {
  const t = await newTarget();
  const cdp = await CDP.attach(t.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', metrics);
  await cdp.send('Page.navigate', { url });
  await sleep(900);
  await cdp.ev('(() => { try { localStorage.clear(); } catch (e) {} return true; })()');
  await cdp.send('Page.navigate', { url });
  await sleep(600);
  /* 导航会重置覆盖，导航后再设一次，视口才是目标尺寸 */
  await cdp.send('Emulation.setDeviceMetricsOverride', metrics);
  await cdp.send('Emulation.setDeviceMetricsOverride', metrics);
  await sleep(400);
  return { t, cdp };
}

const PROBE = `(() => {
  const main = document.getElementById('main');
  const txt = (main.innerText || '');
  const q = (s) => main.querySelectorAll(s).length;
  return {
    view: location.hash.slice(1) || 'overview',
    title: document.title,
    chars: txt.replace(/\\s+/g, '').length,
    h2: (main.querySelector('h2') || {}).innerText || '',
    cards: q('.card'), charts: q('svg.chart'), tables: q('table'),
    inputs: q('input,select'), kpis: q('.kpi'), tiles: q('.tile'),
    docWidth: document.documentElement.scrollWidth,
    winWidth: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    railOn: (document.querySelector('#rail button[aria-current="true"]') || {}).innerText || null,
    bad: /NaN|undefined|Infinity|\\[object Object\\]/.test(txt)
  };
})()`;

const results = { base, checkedAt: new Date().toISOString(), views: [], mobile: null, interaction: null, errors: [] };

for (const v of VIEWS) {
  const { t, cdp } = await openClean(`${base}#${v}`, DESKTOP);
  try {
    let info = null;
    for (let i = 0; i < 30; i++) {
      info = await cdp.ev(PROBE);
      if (info.cards > 0 && info.h2) break;
      await sleep(200);
    }
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(outDir, `shot-${v}-1440.png`), Buffer.from(shot.data, 'base64'));
    info.errors = cdp.errors.slice(0, 3);
    results.views.push(info);
  } finally {
    try { cdp.ws.close(); } catch { /* noop */ }
    await closeTarget(t.id);
  }
}

/* ---- 移动端 390 × 844 ---- */
{
  const { t, cdp } = await openClean(`${base}#personal`, PHONE);
  try {
    results.mobile = await cdp.ev(`(() => {
      const main = document.getElementById('main');
      const rail = document.getElementById('rail');
      const btn = rail.querySelector('button');
      const input = main.querySelector('input[type=number]');
      const tw = main.querySelector('.table-wrap');
      const status = document.querySelector('footer.status');
      return {
        docWidth: document.documentElement.scrollWidth,
        winWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        railDir: getComputedStyle(rail).flexDirection,
        railH: Math.round(rail.getBoundingClientRect().height),
        btnH: btn ? Math.round(btn.getBoundingClientRect().height) : 0,
        inputH: input ? Math.round(input.getBoundingClientRect().height) : 0,
        statusBottom: status ? Math.round(window.innerHeight - status.getBoundingClientRect().bottom) : null,
        tableFits: tw ? tw.scrollWidth <= tw.clientWidth + 1 : 'no-table',
        cards: main.querySelectorAll('.card').length
      };
    })()`);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'shot-personal-390.png'), Buffer.from(shot.data, 'base64'));
    await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).then((s) => {
      fs.writeFileSync(path.join(outDir, 'shot-personal-390-full.png'), Buffer.from(s.data, 'base64'));
    });
  } finally {
    try { cdp.ws.close(); } catch { /* noop */ }
    await closeTarget(t.id);
  }
}

/* ---- 交互 ---- */
{
  const { t, cdp } = await openClean(`${base}#personal`, DESKTOP);
  try {
    await sleep(600);
    const before = await cdp.ev(`(() => {
      const k = document.querySelector('#main .kpi.hl .v');
      const donut = document.querySelector('#main svg.chart circle:nth-child(3)');
      return {
        kpi: k ? k.innerText.replace(/\\s+/g, ' ') : null,
        donutDash: donut ? donut.getAttribute('stroke-dasharray') : null,
        car: (document.querySelector('[data-bind="personal.travel.car"]') || {}).value
      };
    })()`);

    /* 真实焦点后输入，验证重渲染后焦点与数值都还在 */
    await cdp.ev(`(() => {
      const el = document.querySelector('[data-bind="personal.travel.car"]');
      el.focus();
      el.value = '1800';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await sleep(500);

    const after = await cdp.ev(`(() => {
      const k = document.querySelector('#main .kpi.hl .v');
      const donut = document.querySelector('#main svg.chart circle:nth-child(3)');
      const el = document.querySelector('[data-bind="personal.travel.car"]');
      return {
        kpi: k ? k.innerText.replace(/\\s+/g, ' ') : null,
        donutDash: donut ? donut.getAttribute('stroke-dasharray') : null,
        car: el ? el.value : null,
        focused: document.activeElement ? document.activeElement.getAttribute('data-bind') : null
      };
    })()`);

    /* 企业页：新增 / 删除 */
    await cdp.ev(`(() => { document.querySelector('#rail button[data-go="enterprise"]').click(); return true; })()`);
    await sleep(500);
    const rows0 = await cdp.ev(`document.querySelectorAll('#main tbody tr').length`);
    await cdp.ev(`(() => { document.querySelector('[data-act="row-add"]').click(); return true; })()`);
    await sleep(400);
    const rows1 = await cdp.ev(`document.querySelectorAll('#main tbody tr').length`);
    await cdp.ev(`(() => { document.querySelector('#main [data-del]').click(); return true; })()`);
    await sleep(400);
    const rows2 = await cdp.ev(`document.querySelectorAll('#main tbody tr').length`);

    /* 主题翻转 */
    const darkBefore = await cdp.ev(`document.body.classList.contains('dark')`);
    await cdp.ev(`(() => { document.getElementById('themeBtn').click(); return true; })()`);
    await sleep(350);
    const darkAfter = await cdp.ev(`document.body.classList.contains('dark')`);
    const dshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(outDir, 'shot-enterprise-dark-1440.png'), Buffer.from(dshot.data, 'base64'));

    /* 导出：拦截 a.click，检查文件内容长度 */
    const exp = await cdp.ev(`(() => {
      const out = {};
      const orig = HTMLAnchorElement.prototype.click;
      const origCreate = URL.createObjectURL;
      URL.createObjectURL = function (blob) { out.blobSize = blob.size; out.blobType = blob.type; return 'blob:qa'; };
      HTMLAnchorElement.prototype.click = function () { out.download = this.download; };
      document.querySelector('[data-act="export-md"]').click();
      HTMLAnchorElement.prototype.click = orig;
      URL.createObjectURL = origCreate;
      return out;
    })()`);

    results.interaction = {
      before, after,
      kpiChanged: before.kpi !== after.kpi,
      donutChanged: before.donutDash !== after.donutDash,
      focusKept: after.focused === 'personal.travel.car',
      rows: { initial: rows0, afterAdd: rows1, afterDelete: rows2 },
      rowAddWorks: rows1 === rows0 + 1,
      rowDeleteWorks: rows2 === rows1 - 1,
      darkBefore, darkAfter, darkWorks: darkBefore !== darkAfter,
      export: exp,
      errors: cdp.errors.slice(0, 4)
    };
  } finally {
    try { cdp.ws.close(); } catch { /* noop */ }
    await closeTarget(t.id);
  }
}

results.errors = results.views.flatMap((v) => v.errors || []);
fs.writeFileSync(path.join(outDir, 'browser-check.json'), JSON.stringify(results, null, 2));

const problems = results.views.filter((v) => v.overflow || v.bad || v.cards === 0 || !v.railOn || (v.errors || []).length);
console.log(JSON.stringify({
  views: results.views.map((v) => `${v.view}: ${v.chars}字 ${v.cards}卡 ${v.charts}图 ${v.inputs}输入 ${v.overflow ? '溢出!' : 'ok'}${v.bad ? ' 异常文本!' : ''}${(v.errors || []).length ? ' JS错误!' : ''}`),
  mobile: results.mobile,
  interaction: results.interaction,
  problems: problems.map((v) => v.view)
}, null, 2));
