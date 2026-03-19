'use strict';

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

let ops = null;
let opsError = null;
let backend = 'unknown';

async function initOps() {
  const { LobsterOps } = require('./index.js');
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    backend = 'supabase';
    ops = new LobsterOps({
      storageType: 'supabase',
      storageConfig: {
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_KEY,
        tableName: 'agent_events'
      },
      instanceId: 'lobster-ops-dashboard'
    });
  } else {
    backend = 'json';
    ops = new LobsterOps({
      storageType: 'json',
      storageConfig: { dataDir: './lobsterops-data' },
      instanceId: 'lobster-ops-dashboard'
    });
  }
  await ops.init();
  console.log(`\u2713 LobsterOps ready (${backend})`);
}

app.get('/health', (req, res) => res.json({ status: 'ok', backend, ready: !!ops }));

app.get('/api/stats', async (req, res) => {
  if (!ops) return res.status(503).json({ error: opsError || 'Not ready' });
  try { res.json(await ops.getStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/events', async (req, res) => {
  if (!ops) return res.status(503).json({ error: opsError || 'Not ready' });
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    res.json(await ops.getRecentActivity({ limit }) || []);
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analyze', async (req, res) => {
  if (!ops) return res.status(503).json({ error: opsError || 'Not ready' });
  try { res.json(await ops.analyze() || {}); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/', (req, res) => res.send(HTML));

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LOBSTER ACTUAL // OPERATIONS CENTER</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#050709;--panel:#0b0f14;--card:#0f1620;--border:#1a2332;
  --red:#e8263a;--red-dim:rgba(232,38,58,0.12);
  --amber:#f5a623;--green:#22d65e;--blue:#4a9eff;--purple:#a78bfa;
  --text:#b8c5d4;--text-bright:#dce8f4;--text-dim:#4a5a6a;
  --mono:'Share Tech Mono',monospace;--display:'Orbitron',sans-serif;
}
html,body{height:100%;overflow:hidden}
body{
  font-family:var(--mono);background:var(--bg);color:var(--text);
  display:flex;flex-direction:column;
}
body::after{
  content:'';position:fixed;inset:0;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px);
  pointer-events:none;z-index:9999;
}

/* ── HEADER ── */
.header{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 24px;border-bottom:1px solid var(--border);
  background:var(--panel);flex-shrink:0;
}
.header-left{display:flex;align-items:center;gap:16px}
.lobster{font-size:26px;filter:drop-shadow(0 0 10px var(--red));line-height:1}
.logo-title{font-family:var(--display);font-weight:700;font-size:13px;letter-spacing:4px;color:var(--text-bright)}
.logo-sub{font-family:var(--display);font-size:9px;letter-spacing:3px;color:var(--text-dim);margin-top:3px}
.header-right{display:flex;align-items:center;gap:28px}
.live{display:flex;align-items:center;gap:7px;font-family:var(--display);font-size:9px;letter-spacing:3px;color:var(--green)}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);animation:blink 1.4s ease-in-out infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.clock{font-size:11px;color:var(--text-dim);letter-spacing:1px}

/* ── STATS ROW ── */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);flex-shrink:0}
.stat{background:var(--panel);padding:16px 22px;position:relative;overflow:hidden}
.stat::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.stat.s-red::before{background:linear-gradient(90deg,var(--red),transparent)}
.stat.s-green::before{background:linear-gradient(90deg,var(--green),transparent)}
.stat.s-amber::before{background:linear-gradient(90deg,var(--amber),transparent)}
.stat.s-blue::before{background:linear-gradient(90deg,var(--blue),transparent)}
.stat-label{font-family:var(--display);font-size:8px;letter-spacing:3px;color:var(--text-dim);margin-bottom:7px}
.stat-val{font-family:var(--display);font-weight:700;font-size:28px;color:var(--text-bright);line-height:1}
.stat-hint{font-size:10px;color:var(--text-dim);margin-top:5px}

/* ── MAIN GRID ── */
.main{display:grid;grid-template-columns:1fr 320px;gap:1px;background:var(--border);flex:1;overflow:hidden;min-height:0}

/* ── FEED ── */
.feed-panel{background:var(--bg);display:flex;flex-direction:column;overflow:hidden}
.panel-head{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 20px;border-bottom:1px solid var(--border);background:var(--panel);flex-shrink:0
}
.panel-title{font-family:var(--display);font-size:9px;letter-spacing:3px;color:var(--text-dim)}
.feed-count{font-size:11px;color:var(--red)}
.feed{flex:1;overflow-y:auto;min-height:0}
.feed::-webkit-scrollbar{width:3px}
.feed::-webkit-scrollbar-thumb{background:var(--border)}

.ev{
  display:grid;grid-template-columns:80px 100px 130px 1fr 22px 60px;
  gap:0 10px;padding:5px 20px;border-bottom:1px solid rgba(26,35,50,0.5);
  font-size:11.5px;line-height:1.5;animation:fadeIn .25s ease;
}
.ev:hover{background:rgba(255,255,255,0.018)}
@keyframes fadeIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
.ev-time{color:var(--text-dim)}
.ev-agent{color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ev-action{color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ev-dur{color:var(--text-dim);text-align:right;white-space:nowrap}

.badge{
  display:inline-block;padding:1px 5px;border-radius:2px;
  font-size:9px;letter-spacing:1px;font-family:var(--display);font-weight:500;white-space:nowrap
}
.b-tool{background:rgba(245,166,35,.12);color:var(--amber);border:1px solid rgba(245,166,35,.3)}
.b-decision{background:rgba(74,158,255,.12);color:var(--blue);border:1px solid rgba(74,158,255,.3)}
.b-error{background:rgba(232,38,58,.12);color:var(--red);border:1px solid rgba(232,38,58,.3)}
.b-thought{background:rgba(184,197,212,.06);color:var(--text-dim);border:1px solid rgba(184,197,212,.12)}
.b-lifecycle{background:rgba(34,214,94,.08);color:var(--green);border:1px solid rgba(34,214,94,.22)}
.b-spawn{background:rgba(167,139,250,.12);color:var(--purple);border:1px solid rgba(167,139,250,.28)}
.b-default{background:rgba(184,197,212,.08);color:var(--text);border:1px solid var(--border)}
.ok{color:var(--green)}.err{color:var(--red)}

.empty{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  height:100%;gap:14px;color:var(--text-dim)
}
.empty-icon{font-size:44px;opacity:.2;filter:grayscale(1)}
.empty-msg{font-family:var(--display);font-size:10px;letter-spacing:3px}
.empty-sub{font-size:11px;color:var(--text-dim);opacity:.6}

/* ── ANALYSIS ── */
.analysis{background:var(--bg);overflow-y:auto;min-height:0}
.analysis::-webkit-scrollbar{width:3px}
.analysis::-webkit-scrollbar-thumb{background:var(--border)}
.a-section{padding:16px 18px;border-bottom:1px solid var(--border)}
.a-title{font-family:var(--display);font-size:8px;letter-spacing:3px;color:var(--text-dim);margin-bottom:12px}
.big-num{font-family:var(--display);font-weight:700;font-size:26px;color:var(--text-bright);line-height:1;margin-bottom:8px}
.gauge-wrap{height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:5px}
.gauge-fill{height:100%;border-radius:3px;transition:width 1s ease;background:var(--green);box-shadow:0 0 8px var(--green)}
.gauge-fill.amber{background:var(--amber);box-shadow:0 0 8px var(--amber)}
.gauge-fill.red{background:var(--red);box-shadow:0 0 8px var(--red)}
.gauge-meta{display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim)}

.perf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.perf-card{background:var(--card);border:1px solid var(--border);border-radius:3px;padding:9px 11px}
.perf-label{font-family:var(--display);font-size:8px;letter-spacing:2px;color:var(--text-dim);margin-bottom:4px}
.perf-val{font-family:var(--display);font-weight:700;font-size:18px;color:var(--text-bright)}

.fail-row{display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:7px}
.fail-name{color:var(--text-dim);min-width:75px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fail-bar{flex:1;height:3px;background:var(--border);border-radius:2px;overflow:hidden}
.fail-fill{height:100%;background:var(--red);opacity:.7}
.fail-n{color:var(--red);min-width:18px;text-align:right}

.cost-val{font-family:var(--display);font-weight:700;font-size:22px;color:var(--text-bright);margin-bottom:4px}
.cost-label{font-size:10px;color:var(--text-dim)}

/* ── FOOTER ── */
.footer{
  display:flex;align-items:center;justify-content:space-between;
  padding:7px 24px;border-top:1px solid var(--border);background:var(--panel);
  font-size:10px;color:var(--text-dim);flex-shrink:0;letter-spacing:.5px
}
.footer-left{display:flex;align-items:center;gap:20px}
.cdot{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green);display:inline-block;margin-right:5px}
.cdot.err{background:var(--red);box-shadow:0 0 6px var(--red)}
.rbar-wrap{width:70px;height:2px;background:var(--border);border-radius:1px;overflow:hidden}
.rbar{height:100%;background:var(--blue);border-radius:1px;animation:shrink 30s linear}
@keyframes shrink{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.rbar{transform-origin:left}
</style>
</head>
<body>

<header class="header">
  <div class="header-left">
    <span class="lobster">🦞</span>
    <div>
      <div class="logo-title">LOBSTER ACTUAL</div>
      <div class="logo-sub">OPERATIONS CENTER</div>
    </div>
  </div>
  <div class="header-right">
    <div class="live"><div class="live-dot"></div>LIVE</div>
    <div class="clock" id="clock">--:--:--</div>
  </div>
</header>

<div class="stats">
  <div class="stat s-red">
    <div class="stat-label">TOTAL EVENTS</div>
    <div class="stat-val" id="s-events">—</div>
    <div class="stat-hint">logged to supabase</div>
  </div>
  <div class="stat s-green">
    <div class="stat-label">SUCCESS RATE</div>
    <div class="stat-val" id="s-rate">—</div>
    <div class="stat-hint">tool call accuracy</div>
  </div>
  <div class="stat s-amber">
    <div class="stat-label">LOOPS DETECTED</div>
    <div class="stat-val" id="s-loops">—</div>
    <div class="stat-hint">infinite cycles caught</div>
  </div>
  <div class="stat s-blue">
    <div class="stat-label">INSTANCE</div>
    <div class="stat-val" style="font-size:15px;padding-top:6px" id="s-instance">—</div>
    <div class="stat-hint" id="s-backend">—</div>
  </div>
</div>

<div class="main">
  <div class="feed-panel">
    <div class="panel-head">
      <span class="panel-title">// FLIGHT RECORDER</span>
      <span class="feed-count" id="feed-count">0 events</span>
    </div>
    <div class="feed" id="feed">
      <div class="empty" id="empty">
        <div class="empty-icon">🦞</div>
        <div class="empty-msg">AWAITING TELEMETRY</div>
        <div class="empty-sub">no events recorded yet</div>
      </div>
    </div>
  </div>

  <div class="analysis">
    <div class="panel-head" style="position:sticky;top:0;z-index:10">
      <span class="panel-title">// ANALYSIS</span>
    </div>

    <div class="a-section">
      <div class="a-title">SUCCESS RATE</div>
      <div class="big-num" id="a-rate">—</div>
      <div class="gauge-wrap"><div class="gauge-fill" id="a-bar" style="width:0%"></div></div>
      <div class="gauge-meta"><span>TOOL CALLS</span><span id="a-total">0 total</span></div>
    </div>

    <div class="a-section">
      <div class="a-title">PERFORMANCE</div>
      <div class="perf-grid">
        <div class="perf-card"><div class="perf-label">P50 LATENCY</div><div class="perf-val" id="a-p50">—</div></div>
        <div class="perf-card"><div class="perf-label">P95 LATENCY</div><div class="perf-val" id="a-p95">—</div></div>
        <div class="perf-card"><div class="perf-label">LOOPS</div><div class="perf-val" id="a-loops">—</div></div>
        <div class="perf-card"><div class="perf-label">EVENTS</div><div class="perf-val" id="a-evts">—</div></div>
      </div>
    </div>

    <div class="a-section">
      <div class="a-title">FAILURE PATTERNS</div>
      <div id="fail-list"><div style="font-size:11px;color:var(--text-dim)">No failures recorded 🦞</div></div>
    </div>

    <div class="a-section">
      <div class="a-title">COST ANALYSIS</div>
      <div id="cost-section"><div style="font-size:11px;color:var(--text-dim)">No cost data available</div></div>
    </div>
  </div>
</div>

<footer class="footer">
  <div class="footer-left">
    <span><span class="cdot" id="cdot"></span><span id="conn-label">CONNECTING</span></span>
    <span id="f-instance">INSTANCE: —</span>
    <span id="f-backend">BACKEND: —</span>
  </div>
  <div style="display:flex;align-items:center;gap:10px">
    <span id="f-updated">—</span>
    <div class="rbar-wrap"><div class="rbar" id="rbar"></div></div>
  </div>
</footer>

<script>
const INTERVAL = 30000;

// Clock
function tick(){
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}) + ' ET';
}
setInterval(tick,1000); tick();

// Badge
function badge(type){
  const t=(type||'').toLowerCase();
  if(t.includes('tool'))   return '<span class="badge b-tool">TOOL</span>';
  if(t.includes('decision'))return '<span class="badge b-decision">DECISION</span>';
  if(t.includes('error'))  return '<span class="badge b-error">ERROR</span>';
  if(t.includes('thought')||t.includes('reason')) return '<span class="badge b-thought">THOUGHT</span>';
  if(t.includes('lifecycle'))return '<span class="badge b-lifecycle">LIFECYCLE</span>';
  if(t.includes('spawn'))  return '<span class="badge b-spawn">SPAWN</span>';
  return \`<span class="badge b-default">\${(type||'EVENT').toUpperCase().slice(0,8)}</span>\`;
}

function fmtTime(ts){
  try{return new Date(ts).toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});}
  catch{return '--:--:--';}
}
function fmtMs(ms){
  if(ms==null)return '';
  return ms<1000?\`\${ms}ms\`:\`\${(ms/1000).toFixed(1)}s\`;
}

function renderFeed(events){
  const feed=document.getElementById('feed');
  const empty=document.getElementById('empty');
  document.getElementById('feed-count').textContent=\`\${(events||[]).length} events\`;
  if(!events||!events.length){empty.style.display='flex';return;}
  empty.style.display='none';
  feed.innerHTML=events.map(ev=>{
    const d=ev.data||{};
    const action=ev.action||d.action||d.tool||d.description||d.type||'—';
    const isErr=(ev.type||'').includes('error');
    const status=isErr?'<span class="err">\u2717</span>':'<span class="ok">\u2713</span>';
    return \`<div class="ev">
      <span class="ev-time">\${fmtTime(ev.timestamp)}</span>
      \${badge(ev.type)}
      <span class="ev-agent">\${ev.agentId||'—'}</span>
      <span class="ev-action">\${action}</span>
      <span>\${status}</span>
      <span class="ev-dur">\${fmtMs(ev.durationMs||d.durationMs)}</span>
    </div>\`;
  }).join('');
}

function renderAnalysis(a){
  if(!a)return;
  const rate=a.successRate;
  if(rate!=null){
    const pct=Math.round(rate*100);
    document.getElementById('a-rate').textContent=\`\${pct}%\`;
    const bar=document.getElementById('a-bar');
    bar.style.width=\`\${pct}%\`;
    bar.className='gauge-fill'+(pct<80?' red':pct<95?' amber':'');
    document.getElementById('s-rate').textContent=\`\${pct}%\`;
  }
  document.getElementById('a-total').textContent=\`\${a.totalToolCalls||a.totalEvents||0} total\`;
  const p=a.performanceMetrics||{};
  document.getElementById('a-p50').textContent=p.p50?\`\${(p.p50/1000).toFixed(1)}s\`:'—';
  document.getElementById('a-p95').textContent=p.p95?\`\${(p.p95/1000).toFixed(1)}s\`:'—';
  document.getElementById('a-loops').textContent=a.loopsDetected??'0';
  document.getElementById('a-evts').textContent=a.totalEvents??'—';
  document.getElementById('s-loops').textContent=a.loopsDetected??'0';

  const fails=a.failurePatterns||[];
  const fl=document.getElementById('fail-list');
  if(!fails.length){fl.innerHTML='<div style="font-size:11px;color:var(--text-dim)">No failures recorded \uD83E\uDD9E</div>';}
  else{
    const mx=Math.max(...fails.map(f=>f.count||1));
    fl.innerHTML=fails.slice(0,5).map(f=>\`
      <div class="fail-row">
        <span class="fail-name">\${f.pattern||f.type||'unknown'}</span>
        <div class="fail-bar"><div class="fail-fill" style="width:\${Math.round((f.count/mx)*100)}%"></div></div>
        <span class="fail-n">\${f.count}</span>
      </div>\`).join('');
  }

  const cost=a.costAnalysis||{};
  const cs=document.getElementById('cost-section');
  const total=cost.total||cost.totalCost;
  if(total!=null){
    cs.innerHTML=\`<div class="cost-val">$\${Number(total).toFixed(4)}</div><div class="cost-label">estimated total spend</div>\`;
  } else {
    cs.innerHTML='<div style="font-size:11px;color:var(--text-dim)">No cost data available</div>';
  }
}

function renderStats(s){
  if(!s)return;
  document.getElementById('s-events').textContent=(s.eventCount??0).toLocaleString();
  document.getElementById('s-instance').textContent=(s.instanceId||'—').replace('lobster-','').toUpperCase().slice(0,14);
  document.getElementById('s-backend').textContent=(s.backend||s.storageType||'—').toUpperCase();
  document.getElementById('f-instance').textContent=\`INSTANCE: \${s.instanceId||'—'}\`;
  document.getElementById('f-backend').textContent=\`BACKEND: \${(s.backend||s.storageType||'—').toUpperCase()}\`;
}

function setConn(ok){
  const dot=document.getElementById('cdot');
  const lbl=document.getElementById('conn-label');
  dot.className='cdot'+(ok?'':' err');
  lbl.textContent=ok?'CONNECTED':'DISCONNECTED';
  lbl.style.color=ok?'var(--green)':'var(--red)';
}

function resetBar(){
  const b=document.getElementById('rbar');
  b.style.animation='none';
  b.offsetHeight;
  b.style.animation=\`shrink \${INTERVAL/1000}s linear\`;
}

async function fetchAll(){
  try{
    const [sr,er,ar]=await Promise.allSettled([
      fetch('/api/stats').then(r=>r.json()),
      fetch('/api/events?limit=100').then(r=>r.json()),
      fetch('/api/analyze').then(r=>r.json())
    ]);
    setConn(true);
    if(sr.status==='fulfilled'&&!sr.value.error) renderStats(sr.value);
    if(er.status==='fulfilled'&&Array.isArray(er.value)) renderFeed(er.value);
    if(ar.status==='fulfilled'&&!ar.value.error) renderAnalysis(ar.value);
    document.getElementById('f-updated').textContent=
      'UPDATED '+new Date().toLocaleTimeString('en-US',{hour12:false});
  }catch(e){setConn(false);console.error(e);}
  resetBar();
}

fetchAll();
setInterval(fetchAll,INTERVAL);
</script>
</body>
</html>`;

initOps()
  .catch(err => { opsError = err.message; console.error('Init failed:', err.message); })
  .finally(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`\uD83E\uDD9E Lobster Actual Operations Center: http://0.0.0.0:${PORT}`));
  });
