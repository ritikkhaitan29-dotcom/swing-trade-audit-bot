/**
 * Daily Swing Trade Automation Runner
 * Self-healing pipeline:
 * 1. Automatically locates or creates tabs for Chartink, NSE Charting, and Gemini Gem.
 * 2. Runs Chartink 9EMA screener (https://chartink.com/screener/9ema-100025).
 * 3. Captures daily charts with saved Technical Analysis layout on NSE Charting.
 * 4. Extracts OHLC & Volume metrics directly from the live DOM.
 * 5. Saves charts to screenshots/YYYY-MM-DD/.
 * 6. Verifies Flash mode in Gem 'Technical Analysis for anti gravity' (28176565b26c).
 * 7. Submits screenshots + structured prompt aligned with Minervini benchmark ground truth.
 * 8. Saves latest audit to audit_report.md and archives in history/YYYY-MM-DD/.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

const PROJECT_DIR = 'C:\\Users\\ritik\\OneDrive\\Desktop\\AI\\Tools\\Swing Trade Stocks';
const SCREENSHOTS_BASE_DIR = path.join(PROJECT_DIR, 'screenshots');
const HISTORY_BASE_DIR = path.join(PROJECT_DIR, 'history');
const GEM_ANTI_GRAVITY_ID = '28176565b26c';

function getOrCreateWsUrl(targetUrlSub, fullUrlToOpen) {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const pages = JSON.parse(data);
          const match = pages.find(p => p.url && p.url.includes(targetUrlSub));
          if (match) {
            resolve(match.webSocketDebuggerUrl);
          } else if (fullUrlToOpen) {
            console.log(`Tab matching "${targetUrlSub}" not found. Auto-opening: ${fullUrlToOpen}...`);
            const req = http.request(`http://127.0.0.1:9222/json/new?${encodeURIComponent(fullUrlToOpen)}`, { method: 'PUT' }, (newRes) => {
              let newData = '';
              newRes.on('data', c => newData += c);
              newRes.on('end', () => {
                const newPage = JSON.parse(newData);
                setTimeout(() => resolve(newPage.webSocketDebuggerUrl), 4000);
              });
            });
            req.on('error', reject);
            req.end();
          } else {
            reject(new Error('Page not found matching: ' + targetUrlSub));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function cdpSend(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 10000000);
    const handler = (event) => {
      const res = JSON.parse(event.data);
      if (res.id === id) {
        ws.removeEventListener('message', handler);
        if (res.error) reject(res.error);
        else resolve(res.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function ensureFlashMode(gemWs) {
  console.log('Verifying Flash mode on Gemini Gem...');
  const modeStatus = await cdpSend(gemWs, 'Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('button[aria-label*="Open mode picker"]');
      return btn ? btn.getAttribute('aria-label') : '';
    })()`,
    returnByValue: true
  });

  const currentMode = modeStatus.result?.value || '';
  if (!currentMode.includes('Flash')) {
    console.log(`Current mode is not Flash (${currentMode}). Switching to Flash...`);
    await cdpSend(gemWs, 'Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('button[aria-label*="Open mode picker"]');
        if (btn) btn.click();
      })()`
    });
    await sleep(800);
    await cdpSend(gemWs, 'Runtime.evaluate', {
      expression: `(() => {
        const items = Array.from(document.querySelectorAll('[role="menuitem"], .mat-mdc-menu-item'));
        const flashItem = items.find(el => el.innerText.includes('3.8 Flash') || (el.innerText.includes('Flash') && !el.innerText.includes('Lite')));
        if (flashItem) flashItem.click();
      })()`
    });
    await sleep(800);
    console.log('Switched to Flash mode.');
  } else {
    console.log('Confirmed: Gemini Gem is in Flash mode.');
  }
}

async function runPipeline() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const dateScreenshotsDir = path.join(SCREENSHOTS_BASE_DIR, todayStr);
  const dateHistoryDir = path.join(HISTORY_BASE_DIR, todayStr);

  if (!fs.existsSync(dateScreenshotsDir)) fs.mkdirSync(dateScreenshotsDir, { recursive: true });
  if (!fs.existsSync(dateHistoryDir)) fs.mkdirSync(dateHistoryDir, { recursive: true });

  // 1. Chartink Screener
  console.log('Step 1: Connecting to Chartink 9EMA Screener...');
  const chartinkWsUrl = await getOrCreateWsUrl('chartink.com/screener/9ema-100025', 'https://chartink.com/screener/9ema-100025');
  const chartinkWs = new WebSocket(chartinkWsUrl);
  await new Promise(r => chartinkWs.onopen = r);

  await cdpSend(chartinkWs, 'Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Run Scan');
      if (btn) btn.click();
    })()`
  });
  await sleep(3000);

  const extractRes = await cdpSend(chartinkWs, 'Runtime.evaluate', {
    expression: `(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows.map(tr => {
        const tds = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
        return {
          symbol: tds[2] || '',
          name: tds[1] || '',
          price: tds[3] || '',
          pctChange: tds[4] || '',
          volume: tds[5] || ''
        };
      }).filter(r => r.symbol && r.symbol !== '-');
    })()`,
    returnByValue: true
  });

  const stocks = extractRes.result?.value || [];
  chartinkWs.close();
  console.log(`Found ${stocks.length} qualifying stocks from Chartink:`, stocks.map(s => s.symbol));

  if (stocks.length === 0) {
    console.log('No stocks qualified today.');
    const msg = 'No stocks qualified today from the 9EMA screener.';
    fs.writeFileSync(path.join(PROJECT_DIR, 'audit_report.md'), msg);
    fs.writeFileSync(path.join(dateHistoryDir, `audit_report_${todayStr}.md`), msg);
    return;
  }

  // 2. NSE Technical Charting & Metric Extraction
  console.log('Step 2: Connecting to NSE Charting...');
  const nseWsUrl = await getOrCreateWsUrl('charting.nseindia.com', `https://charting.nseindia.com/?symbol=${stocks[0].symbol}-EQ`);
  const nseWs = new WebSocket(nseWsUrl);
  await new Promise(r => nseWs.onopen = r);
  await sleep(3000);

  const stockMetrics = [];
  const uploadedFiles = [];

  for (const s of stocks) {
    const sym = s.symbol;
    console.log(`Processing ${sym}...`);

    await cdpSend(nseWs, 'Runtime.evaluate', {
      expression: `if (window.tvWidget && window.tvWidget.setSymbol) window.tvWidget.setSymbol('${sym}-EQ', '1D');`
    });
    await sleep(2500);

    const metricsRes = await cdpSend(nseWs, 'Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('iframe');
        const doc = iframe ? (iframe.contentDocument || iframe.contentWindow.document) : document;
        const lines = doc.body.innerText.split('\\n').map(l => l.trim()).filter(Boolean);
        let open = 'N/A', high = 'N/A', low = 'N/A', close = 'N/A', vol = 'N/A', volSma = 'N/A';
        const oIdx = lines.indexOf('O'); if (oIdx !== -1) open = lines[oIdx + 1];
        const hIdx = lines.indexOf('H'); if (hIdx !== -1) high = lines[hIdx + 1];
        const lIdx = lines.indexOf('L'); if (lIdx !== -1) low = lines[lIdx + 1];
        const cIdx = lines.indexOf('C'); if (cIdx !== -1) close = lines[cIdx + 1];
        const vIdx = lines.indexOf('Volume');
        if (vIdx !== -1) {
          const nums = lines.slice(vIdx, vIdx + 8).filter(x => /[0-9]/.test(x) && !['9', '20', '50', '200'].includes(x));
          if (nums.length >= 2) { vol = nums[0]; volSma = nums[1]; }
          else if (nums.length === 1) { vol = nums[0]; }
        }
        return { open, high, low, close, vol, volSma };
      })()`,
      returnByValue: true
    });

    const m = metricsRes.result?.value || {};
    const shotRes = await cdpSend(nseWs, 'Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(shotRes.data, 'base64');
    const targetPath = path.join(dateScreenshotsDir, `${sym}_Daily_Chart.png`);
    fs.writeFileSync(targetPath, buf);

    uploadedFiles.push(targetPath);
    stockMetrics.push({
      symbol: sym,
      price: m.close !== 'N/A' ? m.close : s.price,
      open: m.open,
      high: m.high,
      low: m.low,
      close: m.close,
      volume: m.vol !== 'N/A' ? m.vol : s.volume,
      volumeSma: m.volSma,
      targetPath
    });
  }
  nseWs.close();

  // Save stock metadata
  fs.writeFileSync(path.join(PROJECT_DIR, 'stocks_data.json'), JSON.stringify(stockMetrics, null, 2));
  fs.writeFileSync(path.join(dateHistoryDir, `stocks_data_${todayStr}.json`), JSON.stringify(stockMetrics, null, 2));

  // 3. Build Prompt for Gemini Gem
  let promptText = `Analyze this batch of daily stock charts according to the Minervini 9/20 EMA Pullback and VCP framework.\n\nHere is the stock batch and associated market data:\n`;
  stockMetrics.forEach((m, idx) => {
    promptText += `${idx + 1}. ${m.symbol}: CMP ₹${m.price} | OHLC: [O:${m.open}, H:${m.high}, L:${m.low}, C:${m.close}] | Volume: ${m.volume} vs 20 SMA: ${m.volumeSma}\n`;
  });
  promptText += `\nReview the attached chart screenshots in matching order. Evaluate each stock, strictly enforce hard disqualification against breakdowns or inverted trends, and output the summary leaderboard followed by the full trade setup for qualifying stocks using the mandatory output format.`;

  // 4. Connect to Gemini Gem
  console.log('Step 3: Connecting to Gemini Gem (Technical Analysis for anti gravity)...');
  const gemWsUrl = await getOrCreateWsUrl(`gemini.google.com/gem/${GEM_ANTI_GRAVITY_ID}`, `https://gemini.google.com/gem/${GEM_ANTI_GRAVITY_ID}`);
  const gemWs = new WebSocket(gemWsUrl);
  await new Promise(r => gemWs.onopen = r);
  await sleep(3000);

  // Ensure Flash mode
  await ensureFlashMode(gemWs);

  // Upload charts
  await cdpSend(gemWs, 'DOM.enable');
  await cdpSend(gemWs, 'Page.enable');

  await cdpSend(gemWs, 'Runtime.evaluate', {
    expression: `(() => {
      let input = document.querySelector('input[type="file"]');
      if (!input) {
        const upBtn = document.querySelector('button[aria-label="Upload & tools"]') || 
                      document.querySelector('button[aria-label*="Upload"]') ||
                      Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Upload'));
        if (upBtn) upBtn.click();
      }
      return !!document.querySelector('input[type="file"]');
    })()`,
    returnByValue: true
  });
  await sleep(1500);

  const docRes = await cdpSend(gemWs, 'DOM.getDocument', { depth: -1 });
  const fileInputNode = await cdpSend(gemWs, 'DOM.querySelector', {
    nodeId: docRes.root.nodeId,
    selector: 'input[type="file"]'
  });

  console.log(`Uploading ${uploadedFiles.length} charts to Gemini Gem...`);
  await cdpSend(gemWs, 'DOM.setFileInputFiles', {
    files: uploadedFiles,
    nodeId: fileInputNode.nodeId
  });

  await sleep(7000);

  // Insert prompt
  console.log('Entering prompt into Gemini Gem...');
  await cdpSend(gemWs, 'Runtime.evaluate', {
    expression: `(() => {
      const editor = document.querySelector('rich-textarea div[contenteditable="true"]') || document.querySelector('div[contenteditable="true"]');
      if (editor) {
        editor.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, ${JSON.stringify(promptText)});
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`
  });

  await sleep(2000);

  // Submit prompt
  console.log('Submitting prompt...');
  await cdpSend(gemWs, 'Runtime.evaluate', {
    expression: `(() => {
      const sendBtn = document.querySelector('button[aria-label="Send message"]');
      if (sendBtn && !sendBtn.disabled) sendBtn.click();
    })()`
  });

  // Poll for output
  console.log('Waiting for Gemini Gem response...');
  let gemOutput = '';
  for (let i = 0; i < 90; i++) {
    await sleep(4000);
    const pollRes = await cdpSend(gemWs, 'Runtime.evaluate', {
      expression: `(() => {
        const stopBtn = document.querySelector('button[aria-label="Stop response"]') || document.querySelector('button[aria-label="Stop generation"]');
        const responses = Array.from(document.querySelectorAll('message-content, .model-response-text, [data-message-author-role="model"]'));
        const lastResp = responses.length > 0 ? responses[responses.length - 1].innerText : '';
        return { isGenerating: !!stopBtn, length: lastResp.length, text: lastResp };
      })()`,
      returnByValue: true
    });

    const val = pollRes.result?.value || {};
    if (!val.isGenerating && val.length > 250) {
      console.log(`Gemini Gem completed response! (${val.length} chars)`);
      gemOutput = val.text;
      break;
    }
  }

  gemWs.close();

  // Save audit results
  fs.writeFileSync(path.join(PROJECT_DIR, 'audit_report.md'), gemOutput);
  fs.writeFileSync(path.join(dateHistoryDir, `audit_report_${todayStr}.md`), gemOutput);
  console.log(`[${new Date().toISOString()}] Completed! Saved to ${path.join(PROJECT_DIR, 'audit_report.md')}`);
}

if (require.main === module) {
  runPipeline().catch(console.error);
}

module.exports = { runPipeline };
