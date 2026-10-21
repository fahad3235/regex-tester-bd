/* regex-tester-bd -- headless-Chrome smoke test via raw CDP.
   Run: node tests/smoke.mjs [desktop|mobile]
   Uses /opt/meta-chromium/chrome + Node global WebSocket. No deps. */
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODE = process.argv[2] || 'desktop';
const WIDTH = MODE === 'mobile' ? 390 : 1280;
const PORT = MODE === 'mobile' ? 9236 : 9235;
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file://' + DIR + '/index.html';

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('PASS ' + name); }
  else { failed++; console.log('FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class CDP {
  constructor(wsUrl) { this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map(); }
  async open() {
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) {
        const { resolve, reject } = this.pending.get(d.id);
        this.pending.delete(d.id);
        d.error ? reject(new Error(JSON.stringify(d.error))) : resolve(d.result);
      } else if (d.method === 'Runtime.consoleAPICalled' && d.params && d.params.type === 'error') {
        this.consoleErrors.push(JSON.stringify(d.params.args));
      } else if (d.method === 'Runtime.exceptionThrown') {
        this.consoleErrors.push('exception: ' + JSON.stringify(d.params.exceptionDetails));
      }
    };
    this.consoleErrors = [];
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async evalExpr(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval exception: ' + JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

const userDir = '/tmp/regex-tester-chrome-' + MODE;
execSync('rm -rf ' + userDir);
const chrome = spawn('/opt/meta-chromium/chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-proxy-server',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + userDir, 'about:blank'
], { stdio: 'ignore' });
await sleep(1500);
const ver = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json();
const cdp = new CDP(ver.webSocketDebuggerUrl);
await cdp.open();
await cdp.send('Target.createTarget', { url: 'about:blank' });
await sleep(500);
const targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
const page = targets.find(t => t.type === 'page' && t.url === 'about:blank') || targets.find(t => t.type === 'page');
const cdp2 = new CDP(page.webSocketDebuggerUrl);
await cdp2.open();
await cdp2.send('Page.enable');
await cdp2.send('Runtime.enable');
await cdp2.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: MODE === 'mobile' });
await cdp2.send('Page.navigate', { url: URL });
await sleep(2000);

const setVal = async (id, value) => {
  await cdp2.evalExpr(`(() => { const el = document.getElementById('${id}'); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(300);
};

// 1. Shell
check('title mentions Regex Tester', (await cdp2.evalExpr('document.title')).includes('Regex Tester'));
check('default pattern loaded', (await cdp2.evalExpr('document.getElementById("pattern").value')).length > 0);
check('default state shows highlighted matches', await cdp2.evalExpr('document.querySelectorAll("#highlight mark").length') >= 1);
check('match count shown', (await cdp2.evalExpr('document.getElementById("match-count").textContent')).includes('2'));

// 2. Groups: (\\d+)-(\\d+) on "12-34 and 56-78"
await setVal('pattern', '(\\d+)-(\\d+)');
await setVal('test-text', '12-34 and 56-78');
check('groups 12, 34 in match list', await cdp2.evalExpr('document.getElementById("match-list").innerText.includes(\'$1="12"\') && document.getElementById("match-list").innerText.includes(\'$2="34"\')'));
check('two matches found', (await cdp2.evalExpr('document.getElementById("match-count").textContent')).includes('2'));

// 3. Invalid pattern shows engine error
await setVal('pattern', '(');
check('invalid pattern error visible', await cdp2.evalExpr('!document.getElementById("error").hidden && document.getElementById("error").textContent.includes("Invalid")'));
await setVal('pattern', '\\d+');

// 4. Replace mode: [ $1-$2 ] on groups pattern
await setVal('pattern', '(\\d+)-(\\d+)');
await cdp2.evalExpr(`document.getElementById('replace-toggle').checked = true; document.getElementById('replace-toggle').dispatchEvent(new Event('change', { bubbles: true }));`);
await sleep(300);
await setVal('replacement', '[$1-$2]');
check('replace output has [12-34]', (await cdp2.evalExpr('document.getElementById("replace-output").textContent')).includes('[12-34]'));
check('replace output has [56-78]', (await cdp2.evalExpr('document.getElementById("replace-output").textContent')).includes('[56-78]'));

// 5. Library: BD mobile button loads pattern + matches
await cdp2.evalExpr(`(() => { const btns = [...document.querySelectorAll('.lib-btn')]; const b = btns.find(x => x.textContent.includes('BD mobile')); b.click(); })()`);
await sleep(400);
check('library loads BD mobile pattern', (await cdp2.evalExpr('document.getElementById("pattern").value')) === '01[3-9]\\d{8}');
check('library sample matches', await cdp2.evalExpr('document.querySelectorAll("#highlight mark").length') === 2);

// 6. Cheat sheet renders
check('cheat sheet has >=18 rows', await cdp2.evalExpr('document.querySelectorAll("#cheat-body tr").length') >= 18);

// 7. BN toggle flips language
await cdp2.evalExpr(`document.getElementById('lang-btn').click()`);
await sleep(400);
check('BN toggle sets html lang=bn', await cdp2.evalExpr('document.documentElement.lang') === 'bn');
await cdp2.evalExpr(`document.getElementById('lang-btn').click()`);
await sleep(400);
check('toggle back sets html lang=en', await cdp2.evalExpr('document.documentElement.lang') === 'en');

// 8. No horizontal overflow
check('no horizontal overflow', await cdp2.evalExpr('document.documentElement.scrollWidth <= window.innerWidth + 1'), String(await cdp2.evalExpr('document.documentElement.scrollWidth + " vs " + window.innerWidth')));

// 9. Zero console errors
check('0 console/page errors', cdp2.consoleErrors.length === 0, JSON.stringify(cdp2.consoleErrors.slice(0, 2)));

console.log(`\n${passed} passed, ${failed} failed (${MODE})`);
chrome.kill('SIGKILL');
process.exit(failed ? 1 : 0);
