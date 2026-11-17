// cdp.mjs — a minimal Chrome DevTools Protocol driver for the play tests and screenshot
// runs (tools/playtest.mjs, tools/shots.mjs). Node 24 standard library only: it spawns
// headless Chrome with a debugging port, talks over the built-in WebSocket, sends real
// Input events (the game cannot tell them from a hand), and records every console error.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = '/opt/meta-chromium/chrome';

// How the game is loaded in the test browser: this Chrome build blocks http://localhost
// outright (local-network protection) and file:// module scripts by default, but a
// file:// page launched with --allow-file-access-from-files loads its ES modules fine.
// The game itself is identical either way — it is plain static files.
export function gameUrl(gameRoot, query = '') {
  return `file://${join(gameRoot, 'index.html')}${query}`;
}

// This Chrome build also refuses to start without a Hatch WebGL domain policy: a file
// whose first line is the policy marker followed by sorted registrable domains, passed
// with its sha256. The game uses plain 2D canvas (no WebGL), so the list only has to be
// well-formed.
function webglPolicyFlags() {
  const body = 'hatch-webgl-allowed-domains-v1\nexample.com\n';
  writeFileSync('/tmp/emberward-webgl-policy.txt', body);
  const sha = createHash('sha256').update(body).digest('hex');
  return [
    '--hatch-webgl-allowed-domains-file=/tmp/emberward-webgl-policy.txt',
    `--hatch-webgl-allowed-domains-sha256=${sha}`,
  ];
}

export async function launchChrome(port = 9333) {
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`,
    '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--window-size=1280,800', '--mute-audio', '--allow-file-access-from-files',
    `--user-data-dir=/tmp/emberward-chrome-${port}`,
    ...webglPolicyFlags(),
    'about:blank',
  ], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/json/version`);
      if (r.ok) return { proc, base };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('chrome did not start');
}

export class Page {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.errors = [];
    this.exceptions = [];
    ws.addEventListener('message', (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        if (msg.params.type === 'error') this.errors.push(text);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.exceptions.push(msg.params.exceptionDetails?.exception?.description || 'exception');
      } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        this.errors.push(msg.params.entry.text);
      }
    });
  }

  static async open(base, url) {
    const r = await fetch(`${base}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
    const target = await r.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    const page = new Page(ws);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Log.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url });
    return page;
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const out = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (out.exceptionDetails) throw new Error('evaluate failed: ' + (out.exceptionDetails.exception?.description || ''));
    return out.result.value;
  }

  async waitFor(expression, timeoutMs = 15000, pollMs = 200) {
    const t0 = Date.now();
    for (;;) {
      try { if (await this.evaluate(expression)) return true; } catch { /* page still loading */ }
      if (Date.now() - t0 > timeoutMs) throw new Error(`waitFor timed out: ${expression}`);
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  async mouse(x, y, type, button = 'left') {
    await this.send('Input.dispatchMouseEvent', {
      type, x, y, button, clickCount: type === 'mousePressed' ? 1 : 0,
      buttons: type === 'mouseReleased' ? 0 : 1,
    });
  }

  async click(x, y) {
    await this.mouse(x, y, 'mouseMoved', 'none');
    await this.mouse(x, y, 'mousePressed');
    await new Promise((r) => setTimeout(r, 60));
    await this.mouse(x, y, 'mouseReleased');
  }

  async key(code, key, down) {
    await this.send('Input.dispatchKeyEvent', {
      type: down ? 'keyDown' : 'keyUp', code, key,
      windowsVirtualKeyCode: code.startsWith('Digit') ? 48 + Number(code.slice(5)) : undefined,
    });
  }

  async screenshotBase64(quality = 84) {
    const shot = await this.send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false });
    return shot.data;
  }

  problems() {
    return [...this.errors, ...this.exceptions];
  }
}
