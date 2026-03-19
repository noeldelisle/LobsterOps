'use strict';

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

let ops = null;
let opsError = null;
let backend = 'unknown';

async function initOps() {
  const { LobsterOps } = require('./index.js');
  if (SUPABASE_URL && SUPABASE_KEY) {
    backend = 'supabase';
    ops = new LobsterOps({
      storageType: 'supabase',
      storageConfig: {
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_KEY,
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

app.get('/', (req, res) => {
  const html = HTML
    .replace('__SUPABASE_URL__', SUPABASE_URL)
    .replace('__SUPABASE_KEY__', SUPABASE_KEY)
    .replace('__BACKEND__', backend);
  res.send(html);
});

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LOBSTER ACTUAL // OPERATIONS CENTER</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#050709;--panel:#0b0f14;--card:#0f1620;--border:#1a2332;
  --red:#e8263a;--amber:#f5a623;--green:#22d65e;--blue:#4a9eff;--purple:#a78bfa;
  --text:#b8c5d4;--text-bright:#dce8f4;--text-dim:#4a5a6a;
  --mono:'Share Tech Mono',monospace;--display:'Orbitron',sans-serif;
}
html,body{height:100%;overflow:hidden}
body{font-family:var(--mono);background:var(--bg);color:var(--text);display:flex;flex-direction:column;}
body::after{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px);pointer-events:none;z-index:9999;}
.header{display:flex;align-items:center;justify-content:space-between;padding:10px 24px;border-bottom:1px solid var(--border);background:var(--panel);flex-shrink:0;}
.header-left{display:flex;align-items:center;gap:16px}
.lobster{font-size:26px;filter:drop-shadow(0 0 10px var(--red));line-height:1}
.logo-title{font-family:var(--display);font-weight:700;font-size:13px;letter-spacing:4px;color:var(--text-bright)}
.logo-sub{font-family:var(--display);font-size:9px;letter-spacing:3px;color:var(--text-dim);margin-top:3px}
.header-right{display:flex;align-items:center;gap:20px}
.live{display:flex;align-items:center;gap:7px;font-family:var(--display);font-size:9px;letter-spacing:3px;color:var(--green)}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);animation:blink 1.4s ease-in-out infinite}
.rt-badge{display:flex;align-items:center;gap:6px;font-family:var(--display);font-size:9px;letter-spacing:2px;padding:3px 10px;border:1px solid rgba(74,158,255,0.3);border-radius:2px}
.rt-dot{width:6px;height:6px;border-radius:50%}
.rt-dot.pulse{animation:rtpulse 1s ease-in-out infinite}
@keyframes rtpulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.5}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.clock{font-size:11px;color:var(--text-dim);letter-spacing:1px}
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
.main{display:grid;grid-template-columns:1fr 320px;gap:1px;background:var(--border);flex:1;overflow:hidden;min-height:0}
.feed-panel{background:var(--bg);display:flex;flex-direction:column;overflow:hidden}
.panel-head{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-bottom:1px solid var(--border);background:var(--panel);flex-shrink:0}
.panel-title{font-family:var(--display);font-size:9px;letter-spacing:3px;color:var(--text-dim)}
.feed-count{font-size:11px;color:var(--red)}
.feed{flex:1;overflow-y:auto;min-height:0}
.feed::-webkit-scrollbar{width:3px}
.feed::-webkit-scrollbar-thumb{background:var(--border)}
.ev{display:grid;grid-template-columns:80px 100px 130px 1fr 22px 60px;gap:0 10px;padding:5px 20px;border-bottom:1px solid rgba(26,35,50,0.5);font-size:11.5px;line-height:1.5;}
.ev.new-ev{animation:flashIn .7s ease forwards}
@keyframes flashIn{0%{background:rgba(74,158,255,0.18);opacity:0;transform:translateX(-8px)}50%{background:rgba(74,158,255,0.06)}100%{background:transparent;opacity:1;transform:none}}
.ev:hover{background:rgba(255,255,255,0.018)}
.ev-time{color:var(--text-dim)}
.ev-agent{color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ev-action{color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ev-dur{color:var(--text-dim);text-align:right;white-space:nowrap}
.badge{display:inline-block;padding:1px 5px;border-radius:2px;font-size:9px;letter-spacing:1px;font-family:var(--display);font-weight:500;white-space:nowrap}
.b-tool{background:rgba(245,166,35,.12);color:var(--amber);border:1px solid rgba(245,166,35,.3)}
.b-decision{background:rgba(74,158,255,.12);color:var(--blue);border:1px solid rgba(74,158,255,.3)}
.b-error{background:rgba(232,38,58,.12);color:var(--red);border:1px solid rgba(232,38,58,.3)}
.b-thought{background:rgba(184,197,212,.06);color:var(--text-dim);border:1px solid rgba(184,197,212,.12)}
.b-lifecycle{background:rgba(34,214,94,.08);color:var(--green);border:1px solid rgba(34,214,94,.22)}
.b-spawn{background:rgba(167,139,250,.12);color:var(--purple);border:1px solid rgba(167,139,250,.28)}
.b-default{background:rgba(184,197,212,.08);color:var(--text);border:1px solid var(--border)}
.ok{color:var(--green)}.err{color:var(--red)}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;color:var(--text-dim)}
.empty-icon{font-size:44px;opacity:.2;filter:grayscale(1)}
.empty-msg{font-family:var(--display);font-size:10px;letter-spacing:3px}
.empty-sub{font-size:11px;color:var(--text-dim);opacity:.6}
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
.footer{display:flex;align-items:center;justify-content:space-between;padding:7px 24px;border-top:1px solid var(--border);background:var(--panel);font-size:10px;color:var(--text-dim);flex-shrink:0;letter-spacing:.5px}
.footer-left{display:flex;align-items:center;gap:20px}
.cdot{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green);display:inline-block;margin-right:5px}
.cdot.err{background:var(--red);box-shadow:0 0 6px var(--red)}
.new-flash{position:fixed;top:58px;right:16px;background:var(--blue);color:#fff;font-family:var(--display);font-size:9px;letter-spacing:3px;padding:5px 12px;border-radius:2px;opacity:0;transition:opacity .25s;z-index:1000;pointer-events:none;box-shadow:0 0 16px rgba(74,158,255,.5)}
.new-flash.show{opacity:1}
</style>
</head>
<body>
<div class="new-flash" id="new-flash">⚡ NEW EVENT</div>
<header class="header">
  <div class="header-left">
    <span class="lobster">🦞</span>
    <div>
      <div class="logo-title">LOBSTER ACTUAL</div>
      <div class="logo-sub">OPERATIONS CENTER</div>
    </div>
  </div>
  <div class="header-right">
    <div class="rt-badge">
      <div class="rt-dot" id="rt-dot" style="background:var(--amber);box-shadow:0 0 6px var(--amber)"></div>
      <span id="rt-label" style="color:var(--amber)">CONNECTING</span>
    </div>
    <div class="live"><div class="live-dot"></div>LIVE</div>
    <div class="clock" id="clock">--:--:--</div>
  </div>
</header>
<div class="stats">
  <div class="stat s-red"><div class="stat-label">TOTAL EVENTS</div><div class="stat-val" id="s-events">—</div><div class="stat-hint">logged to supabase</div></div>
  <div class="stat s-green"><div class="stat-label">SUCCESS RATE</div><div class="stat-val" id="s-rate">—</div><div class="stat-hint">tool call accuracy</div></div>
  <div class="stat s-amber"><div class="stat-label">LOOPS DETECTED</div><div class="stat-val" id="s-loops">—</div><div class="stat-hint">infinite cycles caught</div></div>
  <div class="stat s-blue"><div class="stat-label">INSTANCE</div><div class="stat-val" style="font-size:15px;padding-top:6px" id="s-instance">—</div><div class="stat-hint" id="s-backend">—</div></div>
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
        <div class="empty-sub">realtime channel open</div>
      </div>
    </div>
  </div>
  <div class="analysis">
    <div class="panel-head" style="position:sticky;top:0;z-index:10"><span class="panel-title">// ANALYSIS</span></div>
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
    <span id="f-backend">BACKEND: __BACKEND__</span>
  </div>
  <span id="f-updated">—</span>
</footer>
<script>
const SUPABASE_URL='__SUPABASE_URL__';
const SUPABASE_KEY='__SUPABASE_KEY__';
let events=[],eventCount=0,analysisTimer=null;

function tick(){document.getElementById('clock').textContent=new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'})+' ET';}
setInterval(tick,1000);tick();

function badge(type){
  const t=(type||'').toLowerCase();
  if(t.includes('tool'))return '<span class="badge b-tool">TOOL</span>';
  if(t.includes('decision'))return '<span class="badge b-decision">DECISION</span>';
  if(t.includes('error'))return '<span class="badge b-error">ERROR</span>';
  if(t.includes('thought')||t.includes('reason'))return '<span class="badge b-thought">THOUGHT</span>';
  if(t.includes('lifecycle'))return '<span class="badge b-lifecycle">LIFECYCLE</span>';
  if(t.includes('spawn'))return '<span class="badge b-spawn">SPAWN</span>';
  return '<span class="badge b-default">'+(type||'EVENT').toUpperCase().slice(0,8)+'</span>';
}
function fmtTime(ts){try{return new Date(ts).toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});}catch{return '--:--:--';}}
function fmtMs(ms){if(ms==null)return '';return ms<1000?ms+'ms':((ms/1000).toFixed(1))+'s';}

function evRow(ev,isNew){
  const d=ev.data||{};
  const action=ev.action||d.action||d.tool||d.description||d.type||'—';
  const isErr=(ev.type||'').includes('error');
  return '<div class="ev'+(isNew?' new-ev':'')+'"><span class="ev-time">'+fmtTime(ev.timestamp||ev.createdat||ev.storedAt)+'</span>'+badge(ev.type)+'<span class="ev-agent">'+(ev.agentid||ev.agentId||'—')+'</span><span class="ev-action">'+action+'</span><span>'+(isErr?'<span class="err">\u2717</span>':'<span class="ok">\u2713</span>')+'</span><span class="ev-dur">'+fmtMs(ev.durationms||ev.durationMs||(d&&d.durationMs))+'</span></div>';
}

function renderFeed(newIdx){
  const feed=document.getElementById('feed');
  const empty=document.getElementById('empty');
  document.getElementById('feed-count').textContent=eventCount+' events';
  document.getElementById('s-events').textContent=eventCount.toLocaleString();
  if(!events.length){empty.style.display='flex';return;}
  empty.style.display='none';
  feed.innerHTML=events.map((ev,i)=>evRow(ev,i===newIdx)).join('');
  if(newIdx===0) feed.scrollTop=0;
}

function flashNew(){
  const f=document.getElementById('new-flash');
  const d=document.getElementById('rt-dot');
  f.classList.add('show');
  d.classList.add('pulse');
  setTimeout(()=>{f.classList.remove('show');d.classList.remove('pulse');},1400);
}

function setConn(ok){
  document.getElementById('cdot').className='cdot'+(ok?'':' err');
  const lbl=document.getElementById('conn-label');
  lbl.textContent=ok?'CONNECTED':'DISCONNECTED';
  lbl.style.color=ok?'var(--green)':'var(--red)';
}
function setRT(s){
  const dot=document.getElementById('rt-dot');
  const lbl=document.getElementById('rt-label');
  const colors={live:'var(--green)',connecting:'var(--amber)',error:'var(--red)'};
  const labels={live:'REALTIME',connecting:'CONNECTING',error:'OFFLINE'};
  const c=colors[s]||colors.error;
  dot.style.background=c;dot.style.boxShadow='0 0 6px '+c;
  lbl.textContent=labels[s]||'OFFLINE';lbl.style.color=c;
}
function renderAnalysis(a){
  if(!a)return;
  const rate=a.successRate;
  if(rate!=null){
    const pct=Math.round(rate*100);
    document.getElementById('a-rate').textContent=pct+'%';
    document.getElementById('s-rate').textContent=pct+'%';
    const bar=document.getElementById('a-bar');
    bar.style.width=pct+'%';
    bar.className='gauge-fill'+(pct<80?' red':pct<95?' amber':'');
  }
  document.getElementById('a-total').textContent=(a.totalToolCalls||a.totalEvents||0)+' total';
  const p=a.performanceMetrics||{};
  document.getElementById('a-p50').textContent=p.p50?((p.p50/1000).toFixed(1))+'s':'—';
  document.getElementById('a-p95').textContent=p.p95?((p.p95/1000).toFixed(1))+'s':'—';
  document.getElementById('a-loops').textContent=a.loopsDetected??'0';
  document.getElementById('a-evts').textContent=a.totalEvents??'—';
  document.getElementById('s-loops').textContent=a.loopsDetected??'0';
  const fails=a.failurePatterns||[];
  const fl=document.getElementById('fail-list');
  if(!fails.length){fl.innerHTML='<div style="font-size:11px;color:var(--text-dim)">No failures recorded \uD83E\uDD9E</div>';}
  else{
    const mx=Math.max(...fails.map(f=>f.count||1));
    fl.innerHTML=fails.slice(0,5).map(f=>'<div class="fail-row"><span class="fail-name">'+(f.pattern||f.type||'unknown')+'</span><div class="fail-bar"><div class="fail-fill" style="width:'+Math.round((f.count/mx)*100)+'%"></div></div><span class="fail-n">'+f.count+'</span></div>').join('');
  }
  const cost=a.costAnalysis||{};
  const total=cost.total||cost.totalCost;
  document.getElementById('cost-section').innerHTML=total!=null
    ?'<div style="font-family:var(--display);font-weight:700;font-size:22px;color:var(--text-bright);margin-bottom:4px">$'+Number(total).toFixed(4)+'</div><div style="font-size:10px;color:var(--text-dim)">estimated total spend</div>'
    :'<div style="font-size:11px;color:var(--text-dim)">No cost data available</div>';
}
function renderStats(s){
  if(!s)return;
  if(s.eventCount!=null){eventCount=s.eventCount;document.getElementById('s-events').textContent=eventCount.toLocaleString();}
  document.getElementById('s-instance').textContent=(s.instanceId||'—').replace('lobster-','').toUpperCase().slice(0,14);
  document.getElementById('s-backend').textContent=(s.backend||s.storageType||'—').toUpperCase();
  document.getElementById('f-instance').textContent='INSTANCE: '+(s.instanceId||'—');
}
function scheduleAnalysis(){
  clearTimeout(analysisTimer);
  analysisTimer=setTimeout(async()=>{
    try{const a=await fetch('/api/analyze').then(r=>r.json());if(!a.error)renderAnalysis(a);}catch(e){}
    try{const s=await fetch('/api/stats').then(r=>r.json());if(!s.error)renderStats(s);}catch(e){}
  },3000);
}
async function loadInitial(){
  try{
    const[sr,er,ar]=await Promise.allSettled([
      fetch('/api/stats').then(r=>r.json()),
      fetch('/api/events?limit=100').then(r=>r.json()),
      fetch('/api/analyze').then(r=>r.json())
    ]);
    setConn(true);
    if(sr.status==='fulfilled'&&!sr.value.error)renderStats(sr.value);
    if(er.status==='fulfilled'&&Array.isArray(er.value)){events=er.value;eventCount=events.length;renderFeed(-1);}
    if(ar.status==='fulfilled'&&!ar.value.error)renderAnalysis(ar.value);
    document.getElementById('f-updated').textContent='LOADED '+new Date().toLocaleTimeString('en-US',{hour12:false});
  }catch(e){setConn(false);}
}

if(SUPABASE_URL&&SUPABASE_KEY){
  const{createClient}=supabase;
  const sb=createClient(SUPABASE_URL,SUPABASE_KEY);
  sb.channel('agent_events_rt')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'agent_events'},payload=>{
      events.unshift(payload.new);
      if(events.length>200)events.pop();
      eventCount++;
      renderFeed(0);
      flashNew();
      scheduleAnalysis();
      document.getElementById('f-updated').textContent='LIVE '+new Date().toLocaleTimeString('en-US',{hour12:false});
    })
    .subscribe(status=>{
      if(status==='SUBSCRIBED')setRT('live');
      else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setRT('error');
      else setRT('connecting');
    });
}else{
  setRT('error');
  setInterval(async()=>{
    try{const er=await fetch('/api/events?limit=100').then(r=>r.json());if(Array.isArray(er)){events=er;eventCount=er.length;renderFeed(-1);}}catch(e){}
  },15000);
}

loadInitial();
setInterval(async()=>{
  try{const a=await fetch('/api/analyze').then(r=>r.json());if(!a.error)renderAnalysis(a);}catch(e){}
},60000);
<\/script>
</body>
</html>`;

initOps()
  .catch(err => { opsError = err.message; console.error('Init failed:', err.message); })
  .finally(() => {
    app.listen(PORT, '0.0.0.0', () =>
      console.log(`\uD83E\uDD9E Lobster Actual Operations Center: http://0.0.0.0:${PORT}`)
    );
  });
