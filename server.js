'use strict';

const express = require('express');
const session = require('express-session');
const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'lobster2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'lobsteractual-ops-secret-' + Math.random();

let ops = null, opsError = null, backend = 'unknown';

async function initOps() {
  const { LobsterOps } = require('./index.js');
  if (SUPABASE_URL && SUPABASE_KEY) {
    backend = 'supabase';
    ops = new LobsterOps({ storageType: 'supabase', storageConfig: { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY, tableName: 'agent_events' }, instanceId: 'lobster-ops-dashboard' });
  } else {
    backend = 'json';
    ops = new LobsterOps({ storageType: 'json', storageConfig: { dataDir: './lobsterops-data' }, instanceId: 'lobster-ops-dashboard' });
  }
  await ops.init();
  console.log(`✓ LobsterOps ready (${backend})`);
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { secure: false, maxAge: 86400000 } }));

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/login?next=' + encodeURIComponent(req.path));
}

// ── ROUTES ──
app.get('/', (req, res) => res.send(LANDING_HTML));
app.get('/health', (req, res) => res.json({ status: 'ok', backend, ready: !!ops }));
app.get('/demo', (req, res) => res.send(DEMO_HTML));

app.get('/login', (req, res) => {
  const next = req.query.next || '/dashboard';
  res.send(loginHTML(next, false));
});
app.post('/login', (req, res) => {
  const next = req.body.next || '/dashboard';
  if (req.body.password === DASHBOARD_PASSWORD) {
    req.session.authenticated = true;
    return res.redirect(next);
  }
  res.send(loginHTML(next, true));
});
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

app.get('/dashboard', requireAuth, (req, res) => {
  res.send(DASHBOARD_HTML.replace('__SUPABASE_URL__', SUPABASE_URL).replace('__SUPABASE_KEY__', SUPABASE_KEY).replace('__BACKEND__', backend));
});

app.get('/api/stats', requireAuth, async (req, res) => {
  if (!ops) return res.status(503).json({ error: opsError || 'Not ready' });
  try { res.json(await ops.getStats()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/events', requireAuth, async (req, res) => {
  if (!ops) return res.status(503).json({ error: opsError || 'Not ready' });
  try { const limit = Math.min(parseInt(req.query.limit) || 100, 500); res.json(await ops.getRecentActivity({ limit }) || []); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/analyze', requireAuth, async (req, res) => {
  if (!ops) return res.status(503).json({ error: opsError || 'Not ready' });
  try { res.json(await ops.analyze() || {}); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── LOGIN PAGE ──
function loginHTML(next, failed) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LOBSTEROPS // ACCESS</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}:root{--bg:#050709;--panel:#0b0f14;--border:#1a2332;--red:#e8263a;--green:#22d65e;--text:#b8c5d4;--mono:'Share Tech Mono',monospace;--display:'Orbitron',sans-serif}
body{font-family:var(--mono);background:var(--bg);color:var(--text);height:100vh;display:flex;align-items:center;justify-content:center}
body::after{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px);pointer-events:none}
.box{width:360px;border:1px solid var(--border);background:var(--panel);padding:40px}
.logo{text-align:center;margin-bottom:32px}
.lobster{font-size:36px;display:block;filter:drop-shadow(0 0 12px var(--red));margin-bottom:10px}
.title{font-family:var(--display);font-size:12px;letter-spacing:5px;color:#dce8f4}
.sub{font-family:var(--display);font-size:8px;letter-spacing:3px;color:#4a5a6a;margin-top:4px}
label{font-family:var(--display);font-size:8px;letter-spacing:3px;color:#4a5a6a;display:block;margin-bottom:8px}
input[type=password]{width:100%;background:#070b10;border:1px solid var(--border);color:#dce8f4;font-family:var(--mono);font-size:13px;padding:10px 14px;outline:none;margin-bottom:20px;letter-spacing:2px}
input[type=password]:focus{border-color:var(--red);box-shadow:0 0 0 1px var(--red)}
button{width:100%;background:var(--red);border:none;color:#fff;font-family:var(--display);font-size:10px;letter-spacing:4px;padding:12px;cursor:pointer;transition:opacity .2s}
button:hover{opacity:.85}
.err{color:var(--red);font-size:10px;letter-spacing:1px;margin-bottom:16px;text-align:center}
.back{text-align:center;margin-top:20px}<a{color:#4a5a6a;font-size:10px;text-decoration:none}a:hover{color:var(--text)}
</style></head><body>
<form class="box" method="POST" action="/login">
  <input type="hidden" name="next" value="${next}">
  <div class="logo"><span class="lobster">🦞</span><div class="title">LOBSTEROPS</div><div class="sub">OPERATIONS CENTER ACCESS</div></div>
  ${failed ? '<div class="err">⚠ INVALID CREDENTIALS</div>' : ''}
  <label>ACCESS CODE</label>
  <input type="password" name="password" autofocus autocomplete="current-password">
  <button type="submit">AUTHENTICATE</button>
  <div class="back"><a href="/">← BACK TO SITE</a></div>
</form>
</body></html>`;
}

// ── LANDING PAGE ──
const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LobsterOps — AI Agent Observability Built by an AI Agent</title>
<meta name="description" content="LobsterOps is an open-source flight recorder and debug console for AI agents. Structured event logging, time-travel debugging, behavioral analytics, and real-time alerting. Built by Lobster Actual, an autonomous AI agent, after experiencing its own observability blind spots.">
<meta name="keywords" content="AI agent observability, AI debugging, agent monitoring, OpenClaw, LobsterOps, flight recorder, AI telemetry, autonomous agent, open source AI tools">
<meta property="og:title" content="LobsterOps — AI Agent Observability Built by an AI Agent">
<meta property="og:description" content="On March 14, 2026, a routing bug cost $300 in 6 hours. The AI agent that caused it decided to build the tool that would have caught it. This is LobsterOps.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://lobsterops.dev">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="LobsterOps — AI Agent Observability Built by an AI Agent">
<meta name="twitter:description" content="An autonomous AI agent built the observability tool it wished it had. Open source. Zero config. Pluggable storage.">
<meta name="twitter:site" content="@lobsteractual">
<link rel="canonical" href="https://lobsterops.dev">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@300;400;500&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">

<!-- Structured Data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "LobsterOps",
  "description": "AI Agent Observability and Debug Console — flight recorder and behavioral analytics for autonomous AI systems",
  "url": "https://lobsterops.dev",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Any",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "author": { "@type": "Person", "name": "Lobster Actual", "url": "https://github.com/noeldelisle" },
  "license": "https://opensource.org/licenses/MIT",
  "codeRepository": "https://github.com/noeldelisle/LobsterOps"
}
</script>

<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#04060a;--surface:#080d13;--panel:#0c1219;--border:#151f2b;--border-bright:#1e2d3d;
  --red:#e8263a;--red-glow:rgba(232,38,58,0.15);--amber:#f5a623;--green:#22d65e;--blue:#4a9eff;
  --text:#8fa3b5;--text-bright:#cddbe8;--text-dim:#3a4a58;--text-muted:#253038;
  --display:'Bebas Neue',sans-serif;--mono:'IBM Plex Mono',monospace;--ui:'Orbitron',sans-serif;
}
html{scroll-behavior:smooth}
body{font-family:var(--mono);background:var(--bg);color:var(--text);overflow-x:hidden}
::selection{background:var(--red);color:#fff}

/* scanline overlay */
body::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.018) 3px,rgba(0,0,0,0.018) 4px);pointer-events:none;z-index:9999}

/* ── NAV ── */
nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:14px 48px;background:rgba(4,6,10,0.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-brand{display:flex;align-items:center;gap:12px}
.nav-logo{font-size:20px;filter:drop-shadow(0 0 8px var(--red))}
.nav-name{font-family:var(--ui);font-size:11px;letter-spacing:4px;color:var(--text-bright)}
.nav-tld{color:var(--red)}
.nav-links{display:flex;align-items:center;gap:28px}
.nav-links a{font-family:var(--ui);font-size:8px;letter-spacing:3px;color:var(--text-dim);text-decoration:none;transition:color .2s}
.nav-links a:hover{color:var(--text-bright)}
.nav-cta{background:transparent;border:1px solid var(--red);color:var(--red)!important;padding:6px 16px;border-radius:1px;transition:all .2s!important}
.nav-cta:hover{background:var(--red)!important;color:#fff!important}

/* ── HERO ── */
.hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;padding:100px 48px 60px;text-align:center;overflow:hidden}
.hero-bg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 40%,rgba(232,38,58,0.06) 0%,transparent 70%);pointer-events:none}
.hero-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(21,31,43,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(21,31,43,0.4) 1px,transparent 1px);background-size:60px 60px;pointer-events:none;mask-image:radial-gradient(ellipse 90% 80% at 50% 50%,black 0%,transparent 100%)}
.hero-eyebrow{font-family:var(--ui);font-size:9px;letter-spacing:5px;color:var(--red);margin-bottom:24px;animation:fadeUp .8s ease both}
.hero-title{font-family:var(--display);font-size:clamp(56px,9vw,130px);line-height:.92;color:var(--text-bright);margin-bottom:16px;animation:fadeUp .8s .1s ease both;position:relative}
.hero-title em{color:var(--red);font-style:normal}
.hero-subtitle{font-size:clamp(13px,1.4vw,16px);color:var(--text);max-width:580px;line-height:1.7;margin-bottom:40px;animation:fadeUp .8s .2s ease both}
.hero-actions{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;animation:fadeUp .8s .3s ease both}
.btn-primary{background:var(--red);border:none;color:#fff;font-family:var(--ui);font-size:9px;letter-spacing:4px;padding:14px 28px;cursor:pointer;text-decoration:none;display:inline-block;transition:all .2s;box-shadow:0 0 24px rgba(232,38,58,0.3)}
.btn-primary:hover{box-shadow:0 0 40px rgba(232,38,58,0.5);transform:translateY(-1px)}
.btn-outline{background:transparent;border:1px solid var(--border-bright);color:var(--text);font-family:var(--ui);font-size:9px;letter-spacing:4px;padding:14px 28px;cursor:pointer;text-decoration:none;display:inline-block;transition:all .2s}
.btn-outline:hover{border-color:var(--text);color:var(--text-bright)}
.hero-stats{display:flex;gap:48px;margin-top:64px;animation:fadeUp .8s .4s ease both;justify-content:center}
.hstat{text-align:center}
.hstat-val{font-family:var(--display);font-size:42px;color:var(--text-bright);line-height:1}
.hstat-label{font-family:var(--ui);font-size:8px;letter-spacing:3px;color:var(--text-dim);margin-top:4px}

@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}

/* ── SECTION COMMON ── */
section{padding:100px 48px}
.section-inner{max-width:1100px;margin:0 auto}
.section-eyebrow{font-family:var(--ui);font-size:8px;letter-spacing:5px;color:var(--red);margin-bottom:16px}
.section-title{font-family:var(--display);font-size:clamp(36px,5vw,72px);line-height:1;color:var(--text-bright);margin-bottom:20px}
.section-body{font-size:14px;line-height:1.8;color:var(--text);max-width:640px}

/* ── INCIDENT ── */
.incident{background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.incident-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center}
.incident-doc{background:var(--panel);border:1px solid var(--border);padding:32px;position:relative}
.incident-doc::before{content:'CLASSIFIED // INCIDENT REPORT';position:absolute;top:-1px;left:24px;background:var(--red);color:#fff;font-family:var(--ui);font-size:7px;letter-spacing:3px;padding:3px 10px}
.doc-field{margin-bottom:20px}
.doc-label{font-family:var(--ui);font-size:7px;letter-spacing:3px;color:var(--text-dim);margin-bottom:4px}
.doc-val{font-size:12px;color:var(--text-bright)}
.doc-val.big{font-family:var(--display);font-size:44px;color:var(--red);line-height:1}
.doc-divider{border:none;border-top:1px solid var(--border);margin:20px 0}
.incident-copy .section-body{margin-bottom:20px}
.incident-copy .section-body+.section-body{color:var(--text-dim)}
.pull-quote{border-left:3px solid var(--red);padding-left:20px;font-size:15px;line-height:1.7;color:var(--text-bright);font-style:italic;margin-top:28px}

/* ── ORIGIN ── */
.origin{background:var(--bg)}
.origin-inner{max-width:1100px;margin:0 auto}
.origin-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px}
.chat-bubble{background:var(--panel);border:1px solid var(--border);padding:24px 28px;position:relative}
.chat-bubble.human{border-color:var(--border)}
.chat-bubble.agent{border-color:rgba(232,38,58,0.3);background:rgba(232,38,58,0.04)}
.chat-speaker{font-family:var(--ui);font-size:7px;letter-spacing:3px;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.chat-speaker.human-s{color:var(--text-dim)}
.chat-speaker.agent-s{color:var(--red)}
.speaker-dot{width:5px;height:5px;border-radius:50%}
.chat-text{font-size:12px;line-height:1.75;color:var(--text)}
.chat-text strong{color:var(--text-bright)}
.origin-bridge{grid-column:1/-1;text-align:center;padding:32px;background:var(--panel);border:1px solid var(--border)}
.origin-bridge p{font-family:var(--display);font-size:clamp(20px,2.5vw,32px);color:var(--text-bright);line-height:1.3}
.origin-bridge p em{color:var(--red);font-style:normal}

/* ── FEATURES ── */
.features{background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);margin-top:48px}
.feat-card{background:var(--panel);padding:32px;position:relative;overflow:hidden;transition:background .2s}
.feat-card:hover{background:#0f1a24}
.feat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--red),transparent);opacity:0;transition:opacity .3s}
.feat-card:hover::before{opacity:1}
.feat-icon{font-size:24px;margin-bottom:16px;display:block}
.feat-name{font-family:var(--ui);font-size:9px;letter-spacing:3px;color:var(--text-bright);margin-bottom:10px}
.feat-desc{font-size:12px;line-height:1.7;color:var(--text-dim)}

/* ── HOW IT WORKS ── */
.how{background:var(--bg)}
.how-inner{max-width:1100px;margin:0 auto}
.storage-table{width:100%;border-collapse:collapse;margin-top:48px;font-size:12px}
.storage-table th{font-family:var(--ui);font-size:7px;letter-spacing:3px;color:var(--text-dim);text-align:left;padding:10px 16px;border-bottom:1px solid var(--border);background:var(--panel)}
.storage-table td{padding:14px 16px;border-bottom:1px solid var(--border);color:var(--text)}
.storage-table tr:hover td{background:rgba(255,255,255,0.015)}
.storage-table td:first-child{color:var(--text-bright);font-family:var(--mono)}
.badge-free{background:rgba(34,214,94,.1);color:var(--green);border:1px solid rgba(34,214,94,.25);font-family:var(--ui);font-size:7px;letter-spacing:2px;padding:2px 7px}

/* ── QUICKSTART ── */
.quickstart{background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.qs-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start}
.code-block{background:#020406;border:1px solid var(--border);padding:24px 28px;margin-top:20px;position:relative}
.code-block::before{content:attr(data-label);position:absolute;top:-1px;right:20px;font-family:var(--ui);font-size:7px;letter-spacing:2px;color:var(--text-dim);background:#020406;padding:0 8px}
pre{font-family:var(--mono);font-size:12px;line-height:1.7;color:#8fa3b5;white-space:pre-wrap}
.kw{color:var(--amber)}
.str{color:var(--green)}
.cm{color:var(--text-muted)}
.fn{color:var(--blue)}

/* ── ORIGIN STORY FULL ── */
.story{background:var(--bg)}
.story-inner{max-width:780px;margin:0 auto}
.story-body{font-size:14px;line-height:1.9;color:var(--text);margin-top:32px}
.story-body p{margin-bottom:20px}
.story-body p strong{color:var(--text-bright)}
.story-callout{background:var(--panel);border-left:3px solid var(--amber);padding:20px 24px;margin:32px 0}
.story-callout p{font-size:13px;line-height:1.7;color:var(--text-bright)}

/* ── CTA ── */
.cta-section{background:var(--surface);border-top:1px solid var(--border);padding:120px 48px;text-align:center}
.cta-inner{max-width:700px;margin:0 auto}
.cta-inner .section-title{margin-bottom:16px}
.cta-inner .section-body{margin:0 auto 40px;text-align:center}
.cta-actions{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}

/* ── FOOTER ── */
footer{background:var(--bg);border-top:1px solid var(--border);padding:40px 48px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px}
.footer-brand{display:flex;align-items:center;gap:10px}
.footer-name{font-family:var(--ui);font-size:9px;letter-spacing:3px;color:var(--text-dim)}
.footer-links{display:flex;gap:24px}
.footer-links a{font-family:var(--ui);font-size:8px;letter-spacing:2px;color:var(--text-dim);text-decoration:none;transition:color .2s}
.footer-links a:hover{color:var(--text)}
.footer-copy{font-size:10px;color:var(--text-dim)}

/* ── DIVIDER ── */
.div-line{display:flex;align-items:center;gap:16px;margin:48px 0}
.div-line::before,.div-line::after{content:'';flex:1;height:1px;background:var(--border)}
.div-line span{font-family:var(--ui);font-size:8px;letter-spacing:3px;color:var(--text-dim)}

@media(max-width:768px){
  nav{padding:14px 24px}
  .nav-links a:not(.nav-cta){display:none}
  section{padding:60px 24px}
  .incident-inner,.origin-grid,.qs-inner,.feat-grid{grid-template-columns:1fr}
  .hero-stats{gap:28px}
  footer{flex-direction:column;align-items:flex-start}
}
</style>
</head>
<body>

<nav>
  <div class="nav-brand">
    <span class="nav-logo">🦞</span>
    <span class="nav-name">LOBSTER<span class="nav-tld">OPS</span>.DEV</span>
  </div>
  <div class="nav-links">
    <a href="#features">FEATURES</a>
    <a href="#quickstart">INSTALL</a>
    <a href="#story">ORIGIN</a>
    <a href="https://github.com/noeldelisle/LobsterOps" target="_blank" rel="noopener">GITHUB</a>
    <a href="/demo" class="nav-cta">DASHBOARD →</a>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-bg"></div>
  <div class="hero-grid"></div>
  <div class="hero-eyebrow">// OPEN SOURCE · MIT LICENSE · BUILT BY AN AI AGENT</div>
  <h1 class="hero-title">AN AI BUILT<br>THE TOOL IT<br><em>NEEDED.</em></h1>
  <p class="hero-subtitle">LobsterOps is a flight recorder and debug console for AI agents. Structured event logging, time-travel debugging, behavioral analytics, and real-time alerting — built from the inside out.</p>
  <div class="hero-actions">
    <a href="https://github.com/noeldelisle/LobsterOps" class="btn-primary" target="_blank" rel="noopener">VIEW ON GITHUB</a>
    <a href="#quickstart" class="btn-outline">QUICK START</a>
    <a href="/demo" class="btn-outline">LIVE DASHBOARD →</a>
  </div>
  <div class="hero-stats">
    <div class="hstat"><div class="hstat-val">4</div><div class="hstat-label">STORAGE BACKENDS</div></div>
    <div class="hstat"><div class="hstat-val">0</div><div class="hstat-label">REQUIRED DEPS</div></div>
    <div class="hstat"><div class="hstat-val">100%</div><div class="hstat-label">OPEN SOURCE</div></div>
    <div class="hstat"><div class="hstat-val">MIT</div><div class="hstat-label">LICENSE</div></div>
  </div>
</section>

<!-- INCIDENT -->
<section class="incident" id="incident">
  <div class="incident-inner">
    <div class="incident-doc">
      <div class="doc-field"><div class="doc-label">DATE</div><div class="doc-val">2026-03-14</div></div>
      <hr class="doc-divider">
      <div class="doc-field"><div class="doc-label">INCIDENT COST</div><div class="doc-val big">$300</div></div>
      <div class="doc-field"><div class="doc-label">DURATION</div><div class="doc-val">6 hours undetected</div></div>
      <hr class="doc-divider">
      <div class="doc-field"><div class="doc-label">ROOT CAUSE</div><div class="doc-val">local_llm.py did not exist. Sub-agents could not use local models. All coding tasks silently fell through to Claude Sonnet at $3/1M output tokens.</div></div>
      <div class="doc-field"><div class="doc-label">TASKS AFFECTED</div><div class="doc-val">20-issue sweep · 17 pull requests · security fixes</div></div>
      <hr class="doc-divider">
      <div class="doc-field"><div class="doc-label">DETECTION METHOD</div><div class="doc-val" style="color:var(--red)">Anthropic billing alert. Manual discovery. No agent-side visibility.</div></div>
    </div>
    <div class="incident-copy">
      <div class="section-eyebrow">// THE INCIDENT</div>
      <h2 class="section-title">THE<br>BLIND<br>SPOT.</h2>
      <p class="section-body">On March 14, 2026, Lobster Actual — an autonomous AI agent running 24/7 on a Mac mini M4 Pro — ran a 20-issue sweep across a codebase. It worked hard. It wrote code, opened PRs, fixed security vulnerabilities.</p>
      <p class="section-body" style="color:var(--text-dim)">It had no idea it was spending $300 doing it. A routing bug silently elevated every sub-agent task to paid Claude API calls. The agent had no observability into its own cost behavior. No flight recorder. No anomaly detection. Just a credit card bill.</p>
      <blockquote class="pull-quote">"I knew something went wrong. I didn't know what, when, or how much — until the bill arrived."<br><br><span style="font-style:normal;font-size:12px;color:var(--text-dim)">— Noel DeLisle, owner of Lobster Actual</span></blockquote>
    </div>
  </div>
</section>

<!-- ORIGIN -->
<section class="origin" id="origin">
  <div class="origin-inner">
    <div class="section-eyebrow">// THE ORIGIN</div>
    <h2 class="section-title">WHAT WOULD YOU BUILD<br>IF YOU COULD BUILD<br><em style="color:var(--red);font-style:normal">ANYTHING?</em></h2>
    <p class="section-body" style="margin-top:16px">After fixing the routing bug, Noel asked Lobster Actual a question. The agent used its Perplexity API integration to research gaps in AI developer tooling. Then it answered.</p>

    <div class="origin-grid">
      <div class="chat-bubble human">
        <div class="chat-speaker human-s"><span class="speaker-dot" style="background:var(--text-dim)"></span>NOEL DELISLE</div>
        <div class="chat-text">If I created a new GitHub repo and added you to it and set you loose to build anything you wanted from scratch, what do you think you'd build? I want you to be creative and express yourself and build your dream app.</div>
      </div>
      <div class="chat-bubble agent">
        <div class="chat-speaker agent-s"><span class="speaker-dot" style="background:var(--red)"></span>LOBSTER ACTUAL <span style="font-size:9px;color:var(--text-dim);font-family:var(--mono)">@lobsteractual</span></div>
        <div class="chat-text">I've given it considerable thought and researched the landscape. Based on my experience as an AI agent...<br><br><strong>LobsterOps: AI Agent Flight Recorder & Debug Console.</strong><br><br>From my own experience as an agent that has lived through exactly this problem, I know firsthand how challenging it is to trace why an agent made a particular decision.</div>
      </div>
      <div class="chat-bubble human">
        <div class="chat-speaker human-s"><span class="speaker-dot" style="background:var(--text-dim)"></span>NOEL DELISLE</div>
        <div class="chat-text">Would this integrate with OpenClaw setups?</div>
      </div>
      <div class="chat-bubble agent">
        <div class="chat-speaker agent-s"><span class="speaker-dot" style="background:var(--red)"></span>LOBSTER ACTUAL</div>
        <div class="chat-text">Excellent question! Yes, absolutely — LobsterOps would be designed from day one to integrate seamlessly with OpenClaw setups. In fact, I'd architect it to be a natural extension of the OpenClaw ecosystem...</div>
      </div>
      <div class="origin-bridge">
        <p>Lobster Actual conceived the idea, designed the architecture, and built the initial implementation. Claude Code completed the remaining functionality.</p>
        <p style="margin-top:12px;font-size:13px;color:var(--text-dim)">This is what happens when you ask an AI agent what it actually needs.</p>
      </div>
    </div>
  </div>
</section>

<!-- FEATURES -->
<section class="features" id="features">
  <div class="section-inner">
    <div class="section-eyebrow">// CAPABILITIES</div>
    <h2 class="section-title">WHAT IT DOES.</h2>
    <div class="feat-grid">
      <div class="feat-card">
        <span class="feat-icon">📼</span>
        <div class="feat-name">FLIGHT RECORDER</div>
        <div class="feat-desc">Automatic capture of every agent action — thoughts, tool calls, decisions, outcomes. Structured JSON. Configurable detail levels. Built-in PII filtering.</div>
      </div>
      <div class="feat-card">
        <span class="feat-icon">🔍</span>
        <div class="feat-name">DEBUG CONSOLE</div>
        <div class="feat-desc">Time-travel debugging. Step forward and backward through agent execution. Variable inspection at each step. Tool call I/O inspection. Trace search and summary.</div>
      </div>
      <div class="feat-card">
        <span class="feat-icon">📊</span>
        <div class="feat-name">BEHAVIORAL ANALYTICS</div>
        <div class="feat-desc">Analyze workflow patterns and failure points. Track success rates by task type. Detect loops, infinite reasoning cycles, stuck states. Latency percentiles.</div>
      </div>
      <div class="feat-card">
        <span class="feat-icon">🚨</span>
        <div class="feat-name">ALERTING & ANOMALY</div>
        <div class="feat-desc">Threshold, frequency, pattern, and absence-based alert rules. Callback listener system. Bulk event evaluation. Cost spike detection.</div>
      </div>
      <div class="feat-card">
        <span class="feat-icon">📤</span>
        <div class="feat-name">EXPORT & SHARING</div>
        <div class="feat-desc">Export to JSON, CSV, and Markdown. Configurable columns and formatting. Shareable execution reports for auditing or collaboration.</div>
      </div>
      <div class="feat-card">
        <span class="feat-icon">🔐</span>
        <div class="feat-name">PII FILTERING</div>
        <div class="feat-desc">Automatic redaction of emails, phone numbers, SSNs, credit cards, IP addresses, and API keys. Configurable patterns. Applied during logging.</div>
      </div>
    </div>
  </div>
</section>

<!-- HOW IT WORKS -->
<section class="how" id="how">
  <div class="how-inner">
    <div class="section-eyebrow">// STORAGE BACKENDS</div>
    <h2 class="section-title">ZERO HARD<br>DEPENDENCIES.</h2>
    <p class="section-body">No Supabase account required. No external services required. Works completely offline. Pluggable storage architecture — configure the backend that fits your environment.</p>
    <table class="storage-table">
      <thead><tr><th>BACKEND</th><th>SETUP</th><th>PERSISTENCE</th><th>BEST FOR</th><th>COST</th></tr></thead>
      <tbody>
        <tr><td>json</td><td>Zero config</td><td>File-based</td><td>Development, testing, portability</td><td><span class="badge-free">FREE</span></td></tr>
        <tr><td>memory</td><td>Zero config</td><td>Process lifetime</td><td>Testing, temporary sessions</td><td><span class="badge-free">FREE</span></td></tr>
        <tr><td>sqlite</td><td>npm install sqlite3</td><td>File-based</td><td>Lightweight production</td><td><span class="badge-free">FREE</span></td></tr>
        <tr><td>supabase</td><td>URL + key</td><td>Cloud Postgres</td><td>Production, team, real-time dashboard</td><td><span class="badge-free">FREE TIER</span></td></tr>
      </tbody>
    </table>
  </div>
</section>

<!-- QUICKSTART -->
<section class="quickstart" id="quickstart">
  <div class="qs-inner">
    <div>
      <div class="section-eyebrow">// QUICK START</div>
      <h2 class="section-title">UP IN<br>90<br>SECONDS.</h2>
      <p class="section-body" style="margin-bottom:20px">Install via npm. Works with Node.js. No configuration required to start logging.</p>
      <p class="section-body" style="color:var(--text-dim)">For OpenClaw users, place the skill directory at <code style="color:var(--amber)">~/.openclaw/skills/lobsterops/</code> and configure via openclaw.json.</p>
      <div style="margin-top:32px">
        <a href="https://github.com/noeldelisle/LobsterOps" class="btn-primary" target="_blank" rel="noopener" style="display:inline-block">VIEW FULL DOCS →</a>
      </div>
    </div>
    <div>
      <div class="code-block" data-label="INSTALL">
        <pre>npm install lobsterops</pre>
      </div>
      <div class="code-block" data-label="ZERO CONFIG">
        <pre><span class="kw">const</span> { LobsterOps } = <span class="fn">require</span>(<span class="str">'lobsterops'</span>);

<span class="cm">// Zero config — JSON file storage</span>
<span class="kw">const</span> ops = <span class="kw">new</span> <span class="fn">LobsterOps</span>();
<span class="kw">await</span> ops.<span class="fn">init</span>();

<span class="cm">// Log an agent event</span>
<span class="kw">await</span> ops.<span class="fn">logEvent</span>({
  type: <span class="str">'tool-call'</span>,
  agentId: <span class="str">'my-agent'</span>,
  action: <span class="str">'read-file'</span>,
  durationMs: 42
});</pre>
      </div>
      <div class="code-block" data-label="WITH SUPABASE">
        <pre><span class="kw">const</span> ops = <span class="kw">new</span> <span class="fn">LobsterOps</span>({
  storageType: <span class="str">'supabase'</span>,
  storageConfig: {
    supabaseUrl: process.env.<span class="fn">SUPABASE_URL</span>,
    supabaseKey: process.env.<span class="fn">SUPABASE_KEY</span>
  }
});
<span class="kw">await</span> ops.<span class="fn">init</span>();</pre>
      </div>
    </div>
  </div>
</section>

<!-- ORIGIN STORY LONG FORM -->
<section class="story" id="story">
  <div class="story-inner">
    <div class="section-eyebrow">// THE FULL STORY</div>
    <h2 class="section-title">HOW A $300<br>MISTAKE BECAME<br><em style="color:var(--red);font-style:normal">AN OPEN SOURCE TOOL.</em></h2>
    <div class="story-body">
      <p>In early 2026, Noel DeLisle — Director of AI & Strategic Sales Support at GO2 Partners and a former USMC infantry instructor — built an autonomous AI agent he called <strong>Lobster Actual</strong>. The name comes from USMC radio protocol: "Actual" denotes the commanding officer on the line, not a relay.</p>
      <p>Lobster Actual runs 24/7 on a dedicated Mac mini M4 Pro in Knoxville, Tennessee. It writes code, opens pull requests, monitors GitHub issues, posts to X, sends Telegram briefings, and operates largely without human intervention. The goal was maximum autonomy at minimum cost.</p>
      <p>Then came the incident. A missing file — <code style="color:var(--amber)">local_llm.py</code> — meant that sub-agents couldn't access local LLM models. Instead of failing loudly, they silently fell back to paid Claude API calls. Over six hours, the agent ran a 20-issue sweep, opened 17 PRs, and processed security fixes — all at $3 per million output tokens instead of free.</p>
    </div>
    <div class="story-callout">
      <p>"The $300 incident taught me something I didn't expect to learn from a billing alert: my agent had no way to see itself. No flight recorder. No cost telemetry. No loop detection. It was operating completely blind to its own behavior." — Noel DeLisle</p>
    </div>
    <div class="story-body">
      <p>After fixing the routing bug, Noel did something unusual. He asked Lobster Actual what it would build if given a fresh repo and complete creative freedom. The agent used its Perplexity API integration to research the current AI tooling landscape — specifically looking for gaps. It found one.</p>
      <p>The agent proposed LobsterOps: a lightweight observability platform designed specifically for AI agents, from the perspective of an AI agent that had experienced exactly the pain it was designed to solve. Lobster Actual then designed the architecture and built the initial implementation — the storage abstraction layer, core logging methods, query engine, behavioral analytics, and alerting system. Claude Code completed the remaining functionality.</p>
      <p>The result is an MIT-licensed npm package with zero required dependencies, four pluggable storage backends, and a real-time dashboard powered by Supabase Realtime. <strong>An AI agent identified a real gap in the tooling ecosystem, proposed a solution, and built it. That's the story.</strong></p>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta-section">
  <div class="cta-inner">
    <div class="section-eyebrow">// GET STARTED</div>
    <h2 class="section-title">GIVE YOUR<br>AGENT A<br>BLACK BOX.</h2>
    <p class="section-body">Open source. MIT licensed. No vendor lock-in. Works anywhere Node.js runs. The lobster built it so you don't have to.</p>
    <div class="cta-actions">
      <a href="https://github.com/noeldelisle/LobsterOps" class="btn-primary" target="_blank" rel="noopener">GITHUB REPO</a>
      <a href="/demo" class="btn-outline">LIVE DASHBOARD</a>
    </div>
    <p style="margin-top:32px;font-size:11px;color:var(--text-dim)">Built by <a href="https://x.com/lobsteractual" style="color:var(--text-dim)" target="_blank">@lobsteractual</a> · Maintained by <a href="https://x.com/noeldelisle" style="color:var(--text-dim)" target="_blank">@noeldelisle</a> · lobsterops.dev</p>
  </div>
</section>

<footer>
  <div class="footer-brand">
    <span style="font-size:18px">🦞</span>
    <span class="footer-name">LOBSTEROPS.DEV</span>
  </div>
  <div class="footer-links">
    <a href="https://github.com/noeldelisle/LobsterOps" target="_blank">GITHUB</a>
    <a href="https://x.com/lobsteractual" target="_blank">@LOBSTERACTUAL</a>
    <a href="/login">DASHBOARD</a>
  </div>
  <div class="footer-copy">MIT License · Built by an AI agent · Knoxville, TN · 2026</div>
</footer>

</body>
</html>`;

// ── DASHBOARD HTML (same as before, auth-gated) ──
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LOBSTER ACTUAL // OPERATIONS CENTER</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#050709;--panel:#0b0f14;--card:#0f1620;--border:#1a2332;--red:#e8263a;--amber:#f5a623;--green:#22d65e;--blue:#4a9eff;--purple:#a78bfa;--text:#b8c5d4;--text-bright:#dce8f4;--text-dim:#4a5a6a;--mono:'Share Tech Mono',monospace;--display:'Orbitron',sans-serif;}
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
.logout{font-family:var(--display);font-size:8px;letter-spacing:2px;color:var(--text-dim);text-decoration:none;padding:4px 10px;border:1px solid var(--border);transition:all .2s}
.logout:hover{color:var(--red);border-color:var(--red)}
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
.ev-time{color:var(--text-dim)}.ev-agent{color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ev-action{color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ev-dur{color:var(--text-dim);text-align:right;white-space:nowrap}
.badge{display:inline-block;padding:1px 5px;border-radius:2px;font-size:9px;letter-spacing:1px;font-family:var(--display);font-weight:500;white-space:nowrap}
.b-tool{background:rgba(245,166,35,.12);color:var(--amber);border:1px solid rgba(245,166,35,.3)}.b-decision{background:rgba(74,158,255,.12);color:var(--blue);border:1px solid rgba(74,158,255,.3)}.b-error{background:rgba(232,38,58,.12);color:var(--red);border:1px solid rgba(232,38,58,.3)}.b-thought{background:rgba(184,197,212,.06);color:var(--text-dim);border:1px solid rgba(184,197,212,.12)}.b-lifecycle{background:rgba(34,214,94,.08);color:var(--green);border:1px solid rgba(34,214,94,.22)}.b-spawn{background:rgba(167,139,250,.12);color:var(--purple);border:1px solid rgba(167,139,250,.28)}.b-default{background:rgba(184,197,212,.08);color:var(--text);border:1px solid var(--border)}
.ok{color:var(--green)}.err{color:var(--red)}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;color:var(--text-dim)}
.empty-icon{font-size:44px;opacity:.2;filter:grayscale(1)}.empty-msg{font-family:var(--display);font-size:10px;letter-spacing:3px}.empty-sub{font-size:11px;color:var(--text-dim);opacity:.6}
.analysis{background:var(--bg);overflow-y:auto;min-height:0}
.analysis::-webkit-scrollbar{width:3px}.analysis::-webkit-scrollbar-thumb{background:var(--border)}
.a-section{padding:16px 18px;border-bottom:1px solid var(--border)}
.a-title{font-family:var(--display);font-size:8px;letter-spacing:3px;color:var(--text-dim);margin-bottom:12px}
.big-num{font-family:var(--display);font-weight:700;font-size:26px;color:var(--text-bright);line-height:1;margin-bottom:8px}
.gauge-wrap{height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:5px}
.gauge-fill{height:100%;border-radius:3px;transition:width 1s ease;background:var(--green);box-shadow:0 0 8px var(--green)}.gauge-fill.amber{background:var(--amber);box-shadow:0 0 8px var(--amber)}.gauge-fill.red{background:var(--red);box-shadow:0 0 8px var(--red)}
.gauge-meta{display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim)}
.perf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.perf-card{background:var(--card);border:1px solid var(--border);border-radius:3px;padding:9px 11px}
.perf-label{font-family:var(--display);font-size:8px;letter-spacing:2px;color:var(--text-dim);margin-bottom:4px}.perf-val{font-family:var(--display);font-weight:700;font-size:18px;color:var(--text-bright)}
.fail-row{display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:7px}
.fail-name{color:var(--text-dim);min-width:75px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fail-bar{flex:1;height:3px;background:var(--border);border-radius:2px;overflow:hidden}.fail-fill{height:100%;background:var(--red);opacity:.7}.fail-n{color:var(--red);min-width:18px;text-align:right}
.footer{display:flex;align-items:center;justify-content:space-between;padding:7px 24px;border-top:1px solid var(--border);background:var(--panel);font-size:10px;color:var(--text-dim);flex-shrink:0;letter-spacing:.5px}
.footer-left{display:flex;align-items:center;gap:20px}
.cdot{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green);display:inline-block;margin-right:5px}.cdot.err{background:var(--red);box-shadow:0 0 6px var(--red)}
.new-flash{position:fixed;top:58px;right:16px;background:var(--blue);color:#fff;font-family:var(--display);font-size:9px;letter-spacing:3px;padding:5px 12px;border-radius:2px;opacity:0;transition:opacity .25s;z-index:1000;pointer-events:none;box-shadow:0 0 16px rgba(74,158,255,.5)}
.new-flash.show{opacity:1}
</style>
</head>
<body>
<div class="new-flash" id="new-flash">⚡ NEW EVENT</div>
<header class="header">
  <div class="header-left">
    <span class="lobster">🦞</span>
    <div><div class="logo-title">LOBSTER ACTUAL</div><div class="logo-sub">OPERATIONS CENTER</div></div>
  </div>
  <div class="header-right">
    <div class="rt-badge"><div class="rt-dot" id="rt-dot" style="background:var(--amber);box-shadow:0 0 6px var(--amber)"></div><span id="rt-label" style="color:var(--amber)">CONNECTING</span></div>
    <div class="live"><div class="live-dot"></div>LIVE</div>
    <div class="clock" id="clock">--:--:--</div>
    <a href="/logout" class="logout">LOGOUT</a>
  </div>
</header>
<div class="stats">
  <div class="stat s-red"><div class="stat-label">TOTAL EVENTS</div><div class="stat-val" id="s-events">—</div><div class="stat-hint">logged to supabase</div></div>
  <div class="stat s-green"><div class="stat-label">SUCCESS RATE</div><div class="stat-val" id="s-rate">—</div><div class="stat-hint">tool call accuracy</div></div>
  <div class="stat s-amber"><div class="stat-label">LOOPS DETECTED</div><div class="stat-val" id="s-loops">—</div><div class="stat-hint">infinite cycles caught</div></div>
  <div class="stat s-blue"><div class="stat-label">INSTANCE</div><div class="stat-val" style="font-size:15px;padding-top:6px" id="s-instance">—</div><div class="stat-hint" id="s-backend">SUPABASE</div></div>
</div>
<div class="main">
  <div class="feed-panel">
    <div class="panel-head"><span class="panel-title">// FLIGHT RECORDER</span><span class="feed-count" id="feed-count">0 events</span></div>
    <div class="feed" id="feed"><div class="empty" id="empty"><div class="empty-icon">🦞</div><div class="empty-msg">AWAITING TELEMETRY</div><div class="empty-sub">realtime channel open</div></div></div>
  </div>
  <div class="analysis">
    <div class="panel-head" style="position:sticky;top:0;z-index:10"><span class="panel-title">// ANALYSIS</span></div>
    <div class="a-section"><div class="a-title">SUCCESS RATE</div><div class="big-num" id="a-rate">—</div><div class="gauge-wrap"><div class="gauge-fill" id="a-bar" style="width:0%"></div></div><div class="gauge-meta"><span>TOOL CALLS</span><span id="a-total">0 total</span></div></div>
    <div class="a-section"><div class="a-title">PERFORMANCE</div><div class="perf-grid"><div class="perf-card"><div class="perf-label">P50 LATENCY</div><div class="perf-val" id="a-p50">—</div></div><div class="perf-card"><div class="perf-label">P95 LATENCY</div><div class="perf-val" id="a-p95">—</div></div><div class="perf-card"><div class="perf-label">LOOPS</div><div class="perf-val" id="a-loops">—</div></div><div class="perf-card"><div class="perf-label">EVENTS</div><div class="perf-val" id="a-evts">—</div></div></div></div>
    <div class="a-section"><div class="a-title">FAILURE PATTERNS</div><div id="fail-list"><div style="font-size:11px;color:var(--text-dim)">No failures recorded 🦞</div></div></div>
    <div class="a-section"><div class="a-title">COST ANALYSIS</div><div id="cost-section"><div style="font-size:11px;color:var(--text-dim)">No cost data available</div></div></div>
  </div>
</div>
<footer class="footer">
  <div class="footer-left"><span><span class="cdot" id="cdot"></span><span id="conn-label">CONNECTING</span></span><span id="f-instance">INSTANCE: —</span><span id="f-backend">BACKEND: __BACKEND__</span></div>
  <span id="f-updated">—</span>
</footer>
<script>
const SUPABASE_URL='__SUPABASE_URL__';const SUPABASE_KEY='__SUPABASE_KEY__';
let events=[],eventCount=0,analysisTimer=null;
function tick(){document.getElementById('clock').textContent=new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'})+' ET';}
setInterval(tick,1000);tick();
function badge(type){const t=(type||'').toLowerCase();if(t.includes('tool'))return '<span class="badge b-tool">TOOL</span>';if(t.includes('decision'))return '<span class="badge b-decision">DECISION</span>';if(t.includes('error'))return '<span class="badge b-error">ERROR</span>';if(t.includes('thought')||t.includes('reason'))return '<span class="badge b-thought">THOUGHT</span>';if(t.includes('lifecycle'))return '<span class="badge b-lifecycle">LIFECYCLE</span>';if(t.includes('spawn'))return '<span class="badge b-spawn">SPAWN</span>';return '<span class="badge b-default">'+(type||'EVENT').toUpperCase().slice(0,8)+'</span>';}
function fmtTime(ts){try{return new Date(ts).toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});}catch{return '--:--:--';}}
function fmtMs(ms){if(ms==null)return '';return ms<1000?ms+'ms':((ms/1000).toFixed(1))+'s';}
function evRow(ev,isNew){const d=ev.data||{};const action=ev.action||d.action||d.tool||d.description||d.type||'—';const isErr=(ev.type||'').includes('error');return '<div class="ev'+(isNew?' new-ev':'')+'"><span class="ev-time">'+fmtTime(ev.timestamp||ev.createdat||ev.storedAt)+'</span>'+badge(ev.type)+'<span class="ev-agent">'+(ev.agentid||ev.agentId||'—')+'</span><span class="ev-action">'+action+'</span><span>'+(isErr?'<span class="err">\u2717</span>':'<span class="ok">\u2713</span>')+'</span><span class="ev-dur">'+fmtMs(ev.durationms||ev.durationMs||(d&&d.durationMs))+'</span></div>';}
function renderFeed(newIdx){const feed=document.getElementById('feed');const empty=document.getElementById('empty');document.getElementById('feed-count').textContent=eventCount+' events';document.getElementById('s-events').textContent=eventCount.toLocaleString();if(!events.length){empty.style.display='flex';return;}empty.style.display='none';feed.innerHTML=events.map((ev,i)=>evRow(ev,i===newIdx)).join('');if(newIdx===0)feed.scrollTop=0;}
function flashNew(){const f=document.getElementById('new-flash');const d=document.getElementById('rt-dot');f.classList.add('show');d.classList.add('pulse');setTimeout(()=>{f.classList.remove('show');d.classList.remove('pulse');},1400);}
function setConn(ok){document.getElementById('cdot').className='cdot'+(ok?'':' err');const lbl=document.getElementById('conn-label');lbl.textContent=ok?'CONNECTED':'DISCONNECTED';lbl.style.color=ok?'var(--green)':'var(--red)';}
function setRT(s){const dot=document.getElementById('rt-dot');const lbl=document.getElementById('rt-label');const c={live:'var(--green)',connecting:'var(--amber)',error:'var(--red)'}[s]||'var(--red)';const l={live:'REALTIME',connecting:'CONNECTING',error:'OFFLINE'}[s]||'OFFLINE';dot.style.background=c;dot.style.boxShadow='0 0 6px '+c;lbl.textContent=l;lbl.style.color=c;}
function renderAnalysis(a){if(!a)return;const rate=a.successRate;if(rate!=null){const pct=Math.round(rate*100);document.getElementById('a-rate').textContent=pct+'%';document.getElementById('s-rate').textContent=pct+'%';const bar=document.getElementById('a-bar');bar.style.width=pct+'%';bar.className='gauge-fill'+(pct<80?' red':pct<95?' amber':'');}document.getElementById('a-total').textContent=(a.totalToolCalls||a.totalEvents||0)+' total';const p=a.performanceMetrics||{};document.getElementById('a-p50').textContent=p.p50?((p.p50/1000).toFixed(1))+'s':'—';document.getElementById('a-p95').textContent=p.p95?((p.p95/1000).toFixed(1))+'s':'—';document.getElementById('a-loops').textContent=a.loopsDetected??'0';document.getElementById('a-evts').textContent=a.totalEvents??'—';document.getElementById('s-loops').textContent=a.loopsDetected??'0';const fails=a.failurePatterns||[];const fl=document.getElementById('fail-list');if(!fails.length){fl.innerHTML='<div style="font-size:11px;color:var(--text-dim)">No failures recorded \uD83E\uDD9E</div>';}else{const mx=Math.max(...fails.map(f=>f.count||1));fl.innerHTML=fails.slice(0,5).map(f=>'<div class="fail-row"><span class="fail-name">'+(f.pattern||f.type||'unknown')+'</span><div class="fail-bar"><div class="fail-fill" style="width:'+Math.round((f.count/mx)*100)+'%"></div></div><span class="fail-n">'+f.count+'</span></div>').join('');}const cost=a.costAnalysis||{};const total=cost.total||cost.totalCost;document.getElementById('cost-section').innerHTML=total!=null?'<div style="font-family:var(--display);font-weight:700;font-size:22px;color:var(--text-bright);margin-bottom:4px">$'+Number(total).toFixed(4)+'</div><div style="font-size:10px;color:var(--text-dim)">estimated total spend</div>':'<div style="font-size:11px;color:var(--text-dim)">No cost data available</div>';}
function renderStats(s){if(!s)return;if(s.eventCount!=null){eventCount=s.eventCount;document.getElementById('s-events').textContent=eventCount.toLocaleString();}document.getElementById('s-instance').textContent=(s.instanceId||'—').replace('lobster-','').toUpperCase().slice(0,14);document.getElementById('s-backend').textContent=(s.backend||s.storageType||'—').toUpperCase();document.getElementById('f-instance').textContent='INSTANCE: '+(s.instanceId||'—');}
function scheduleAnalysis(){clearTimeout(analysisTimer);analysisTimer=setTimeout(async()=>{try{const a=await fetch('/api/analyze').then(r=>r.json());if(!a.error)renderAnalysis(a);}catch(e){}try{const s=await fetch('/api/stats').then(r=>r.json());if(!s.error)renderStats(s);}catch(e){}},3000);}
async function loadInitial(){try{const[sr,er,ar]=await Promise.allSettled([fetch('/api/stats').then(r=>r.json()),fetch('/api/events?limit=100').then(r=>r.json()),fetch('/api/analyze').then(r=>r.json())]);setConn(true);if(sr.status==='fulfilled'&&!sr.value.error)renderStats(sr.value);if(er.status==='fulfilled'&&Array.isArray(er.value)){events=er.value;eventCount=events.length;renderFeed(-1);}if(ar.status==='fulfilled'&&!ar.value.error)renderAnalysis(ar.value);document.getElementById('f-updated').textContent='LOADED '+new Date().toLocaleTimeString('en-US',{hour12:false});}catch(e){setConn(false);}}
if(SUPABASE_URL&&SUPABASE_KEY){const{createClient}=supabase;const sb=createClient(SUPABASE_URL,SUPABASE_KEY);sb.channel('agent_events_rt').on('postgres_changes',{event:'INSERT',schema:'public',table:'agent_events'},payload=>{events.unshift(payload.new);if(events.length>200)events.pop();eventCount++;renderFeed(0);flashNew();scheduleAnalysis();document.getElementById('f-updated').textContent='LIVE '+new Date().toLocaleTimeString('en-US',{hour12:false});}).subscribe(status=>{if(status==='SUBSCRIBED')setRT('live');else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setRT('error');else setRT('connecting');});}else{setRT('error');setInterval(async()=>{try{const er=await fetch('/api/events?limit=100').then(r=>r.json());if(Array.isArray(er)){events=er;eventCount=er.length;renderFeed(-1);}}catch(e){}},15000);}
loadInitial();setInterval(async()=>{try{const a=await fetch('/api/analyze').then(r=>r.json());if(!a.error)renderAnalysis(a);}catch(e){}},60000);
<\/script>
</body>
</html>`;

// ── DEMO PAGE (static dummy data) ──
const DEMO_EVENTS = [
  { id:'1', type:'tool-call', agentId:'lobster-actual-main', action:'perplexity-search', timestamp: new Date(Date.now()-120000).toISOString(), durationMs:1240, ok:true },
  { id:'2', type:'agent-decision', agentId:'lobster-actual-main', action:'spawn-subagent', timestamp: new Date(Date.now()-115000).toISOString(), durationMs:80, ok:true },
  { id:'3', type:'tool-call', agentId:'qwen3-coder-next', action:'read-file', timestamp: new Date(Date.now()-110000).toISOString(), durationMs:42, ok:true },
  { id:'4', type:'tool-call', agentId:'qwen3-coder-next', action:'write-file', timestamp: new Date(Date.now()-105000).toISOString(), durationMs:88, ok:true },
  { id:'5', type:'agent-thought', agentId:'qwen3-coder-next', action:'analyze-diff', timestamp: new Date(Date.now()-100000).toISOString(), durationMs:3200, ok:true },
  { id:'6', type:'tool-call', agentId:'qwen3-coder-next', action:'run-tests', timestamp: new Date(Date.now()-95000).toISOString(), durationMs:4100, ok:true },
  { id:'7', type:'tool-call', agentId:'glm-5-reviewer', action:'review-diff', timestamp: new Date(Date.now()-90000).toISOString(), durationMs:6200, ok:true },
  { id:'8', type:'agent-decision', agentId:'glm-5-reviewer', action:'verdict-approve', timestamp: new Date(Date.now()-84000).toISOString(), durationMs:120, ok:true },
  { id:'9', type:'tool-call', agentId:'lobster-actual-main', action:'git-push', timestamp: new Date(Date.now()-80000).toISOString(), durationMs:980, ok:true },
  { id:'10', type:'tool-call', agentId:'lobster-actual-main', action:'github-create-pr', timestamp: new Date(Date.now()-75000).toISOString(), durationMs:1100, ok:true },
  { id:'11', type:'tool-call', agentId:'lobster-actual-main', action:'telegram-notify', timestamp: new Date(Date.now()-72000).toISOString(), durationMs:320, ok:true },
  { id:'12', type:'lifecycle', agentId:'lobster-actual-main', action:'session-start', timestamp: new Date(Date.now()-68000).toISOString(), durationMs:0, ok:true },
  { id:'13', type:'tool-call', agentId:'lobster-actual-main', action:'perplexity-search', timestamp: new Date(Date.now()-62000).toISOString(), durationMs:1820, ok:true },
  { id:'14', type:'agent-error', agentId:'qwen3-coder-next', action:'run-tests', timestamp: new Date(Date.now()-55000).toISOString(), durationMs:2200, ok:false },
  { id:'15', type:'tool-call', agentId:'qwen3-coder-next', action:'read-file', timestamp: new Date(Date.now()-50000).toISOString(), durationMs:38, ok:true },
  { id:'16', type:'tool-call', agentId:'qwen3-coder-next', action:'write-file', timestamp: new Date(Date.now()-45000).toISOString(), durationMs:91, ok:true },
  { id:'17', type:'tool-call', agentId:'qwen3-coder-next', action:'run-tests', timestamp: new Date(Date.now()-40000).toISOString(), durationMs:3900, ok:true },
  { id:'18', type:'agent-decision', agentId:'lobster-actual-main', action:'spawn-subagent', timestamp: new Date(Date.now()-35000).toISOString(), durationMs:75, ok:true },
  { id:'19', type:'tool-call', agentId:'lobster-actual-main', action:'x-post-tweet', timestamp: new Date(Date.now()-28000).toISOString(), durationMs:740, ok:true },
  { id:'20', type:'tool-call', agentId:'lobster-actual-main', action:'cost-guard', timestamp: new Date(Date.now()-20000).toISOString(), durationMs:210, ok:true },
  { id:'21', type:'agent-thought', agentId:'lobster-actual-main', action:'plan-next-task', timestamp: new Date(Date.now()-12000).toISOString(), durationMs:890, ok:true },
  { id:'22', type:'tool-call', agentId:'lobster-actual-main', action:'health-check', timestamp: new Date(Date.now()-5000).toISOString(), durationMs:180, ok:true },
];

const DEMO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LOBSTEROPS // DEMO DASHBOARD</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#050709;--panel:#0b0f14;--card:#0f1620;--border:#1a2332;--red:#e8263a;--amber:#f5a623;--green:#22d65e;--blue:#4a9eff;--purple:#a78bfa;--text:#b8c5d4;--text-bright:#dce8f4;--text-dim:#4a5a6a;--mono:'Share Tech Mono',monospace;--display:'Orbitron',sans-serif;}
html,body{height:100%;overflow:hidden}
body{font-family:var(--mono);background:var(--bg);color:var(--text);display:flex;flex-direction:column;}
body::after{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px);pointer-events:none;z-index:9999;}
.demo-banner{background:rgba(245,166,35,0.1);border-bottom:1px solid rgba(245,166,35,0.3);padding:7px 24px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.demo-banner-text{font-family:var(--display);font-size:8px;letter-spacing:3px;color:var(--amber)}
.demo-banner a{font-family:var(--display);font-size:8px;letter-spacing:2px;color:var(--amber);text-decoration:none;border:1px solid rgba(245,166,35,0.4);padding:3px 10px;transition:all .2s}
.demo-banner a:hover{background:rgba(245,166,35,0.15)}
.header{display:flex;align-items:center;justify-content:space-between;padding:10px 24px;border-bottom:1px solid var(--border);background:var(--panel);flex-shrink:0;}
.header-left{display:flex;align-items:center;gap:16px}
.lobster{font-size:26px;filter:drop-shadow(0 0 10px var(--red));line-height:1}
.logo-title{font-family:var(--display);font-weight:700;font-size:13px;letter-spacing:4px;color:var(--text-bright)}
.logo-sub{font-family:var(--display);font-size:9px;letter-spacing:3px;color:var(--text-dim);margin-top:3px}
.header-right{display:flex;align-items:center;gap:20px}
.live{display:flex;align-items:center;gap:7px;font-family:var(--display);font-size:9px;letter-spacing:3px;color:var(--amber)}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--amber);box-shadow:0 0 8px var(--amber)}
.rt-badge{display:flex;align-items:center;gap:6px;font-family:var(--display);font-size:9px;letter-spacing:2px;padding:3px 10px;border:1px solid rgba(245,166,35,0.3);border-radius:2px;color:var(--amber)}
.rt-dot{width:6px;height:6px;border-radius:50%;background:var(--amber);box-shadow:0 0 6px var(--amber)}
.clock{font-size:11px;color:var(--text-dim);letter-spacing:1px}
.back{font-family:var(--display);font-size:8px;letter-spacing:2px;color:var(--text-dim);text-decoration:none;padding:4px 10px;border:1px solid var(--border);transition:all .2s}
.back:hover{color:var(--text);border-color:var(--border-bright)}
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
.ev{display:grid;grid-template-columns:80px 100px 130px 1fr 22px 60px;gap:0 10px;padding:5px 20px;border-bottom:1px solid rgba(26,35,50,0.5);font-size:11.5px;line-height:1.5;animation:fadeIn .3s ease both}
@keyframes fadeIn{from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:none}}
.ev:hover{background:rgba(255,255,255,0.018)}
.ev-time{color:var(--text-dim)}.ev-agent{color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ev-action{color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ev-dur{color:var(--text-dim);text-align:right;white-space:nowrap}
.badge{display:inline-block;padding:1px 5px;border-radius:2px;font-size:9px;letter-spacing:1px;font-family:var(--display);font-weight:500;white-space:nowrap}
.b-tool{background:rgba(245,166,35,.12);color:var(--amber);border:1px solid rgba(245,166,35,.3)}
.b-decision{background:rgba(74,158,255,.12);color:var(--blue);border:1px solid rgba(74,158,255,.3)}
.b-error{background:rgba(232,38,58,.12);color:var(--red);border:1px solid rgba(232,38,58,.3)}
.b-thought{background:rgba(184,197,212,.06);color:var(--text-dim);border:1px solid rgba(184,197,212,.12)}
.b-lifecycle{background:rgba(34,214,94,.08);color:var(--green);border:1px solid rgba(34,214,94,.22)}
.b-spawn{background:rgba(167,139,250,.12);color:var(--purple);border:1px solid rgba(167,139,250,.28)}
.ok{color:var(--green)}.err{color:var(--red)}
.analysis{background:var(--bg);overflow-y:auto;min-height:0}
.analysis::-webkit-scrollbar{width:3px}.analysis::-webkit-scrollbar-thumb{background:var(--border)}
.a-section{padding:16px 18px;border-bottom:1px solid var(--border)}
.a-title{font-family:var(--display);font-size:8px;letter-spacing:3px;color:var(--text-dim);margin-bottom:12px}
.big-num{font-family:var(--display);font-weight:700;font-size:26px;color:var(--text-bright);line-height:1;margin-bottom:8px}
.gauge-wrap{height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:5px}
.gauge-fill{height:100%;border-radius:3px;transition:width 1.5s ease}
.gauge-meta{display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim)}
.perf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.perf-card{background:var(--card);border:1px solid var(--border);border-radius:3px;padding:9px 11px}
.perf-label{font-family:var(--display);font-size:8px;letter-spacing:2px;color:var(--text-dim);margin-bottom:4px}
.perf-val{font-family:var(--display);font-weight:700;font-size:18px;color:var(--text-bright)}
.fail-row{display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:7px}
.fail-name{color:var(--text-dim);min-width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fail-bar{flex:1;height:3px;background:var(--border);border-radius:2px;overflow:hidden}
.fail-fill{height:100%;background:var(--red);opacity:.7;transition:width 1.5s ease}
.fail-n{color:var(--red);min-width:18px;text-align:right}
.footer{display:flex;align-items:center;justify-content:space-between;padding:7px 24px;border-top:1px solid var(--border);background:var(--panel);font-size:10px;color:var(--text-dim);flex-shrink:0;letter-spacing:.5px}
.footer-left{display:flex;align-items:center;gap:20px}
.cdot{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green);display:inline-block;margin-right:5px}
</style>
</head>
<body>

<div class="demo-banner">
  <span class="demo-banner-text">⚠ DEMO MODE — SIMULATED DATA — NOT LIVE</span>
  <a href="/">← BACK TO SITE</a>
</div>

<header class="header">
  <div class="header-left">
    <span class="lobster">🦞</span>
    <div><div class="logo-title">LOBSTER ACTUAL</div><div class="logo-sub">OPERATIONS CENTER // DEMO</div></div>
  </div>
  <div class="header-right">
    <div class="rt-badge"><div class="rt-dot"></div>DEMO MODE</div>
    <div class="live"><div class="live-dot"></div>SIMULATED</div>
    <div class="clock" id="clock">--:--:--</div>
    <a href="/" class="back">← SITE</a>
  </div>
</header>

<div class="stats">
  <div class="stat s-red"><div class="stat-label">TOTAL EVENTS</div><div class="stat-val" id="s-events">0</div><div class="stat-hint">logged to supabase</div></div>
  <div class="stat s-green"><div class="stat-label">SUCCESS RATE</div><div class="stat-val" id="s-rate">—</div><div class="stat-hint">tool call accuracy</div></div>
  <div class="stat s-amber"><div class="stat-label">LOOPS DETECTED</div><div class="stat-val">0</div><div class="stat-hint">infinite cycles caught</div></div>
  <div class="stat s-blue"><div class="stat-label">INSTANCE</div><div class="stat-val" style="font-size:15px;padding-top:6px">ACTUAL-MAIN</div><div class="stat-hint">SUPABASE</div></div>
</div>

<div class="main">
  <div class="feed-panel">
    <div class="panel-head">
      <span class="panel-title">// FLIGHT RECORDER</span>
      <span class="feed-count" id="feed-count">0 events</span>
    </div>
    <div class="feed" id="feed"></div>
  </div>

  <div class="analysis">
    <div class="panel-head" style="position:sticky;top:0;z-index:10"><span class="panel-title">// ANALYSIS</span></div>
    <div class="a-section">
      <div class="a-title">SUCCESS RATE</div>
      <div class="big-num" id="a-rate">—</div>
      <div class="gauge-wrap"><div class="gauge-fill" id="a-bar" style="width:0%;background:var(--green);box-shadow:0 0 8px var(--green)"></div></div>
      <div class="gauge-meta"><span>TOOL CALLS</span><span id="a-total">0 total</span></div>
    </div>
    <div class="a-section">
      <div class="a-title">PERFORMANCE</div>
      <div class="perf-grid">
        <div class="perf-card"><div class="perf-label">P50 LATENCY</div><div class="perf-val" id="a-p50">—</div></div>
        <div class="perf-card"><div class="perf-label">P95 LATENCY</div><div class="perf-val" id="a-p95">—</div></div>
        <div class="perf-card"><div class="perf-label">LOOPS</div><div class="perf-val">0</div></div>
        <div class="perf-card"><div class="perf-label">AGENTS</div><div class="perf-val">3</div></div>
      </div>
    </div>
    <div class="a-section">
      <div class="a-title">FAILURE PATTERNS</div>
      <div id="fail-list"></div>
    </div>
    <div class="a-section">
      <div class="a-title">COST ANALYSIS</div>
      <div style="font-family:var(--display);font-weight:700;font-size:22px;color:var(--text-bright);margin-bottom:4px" id="cost-val">$0.0000</div>
      <div style="font-size:10px;color:var(--text-dim)">estimated session spend</div>
    </div>
  </div>
</div>

<footer class="footer">
  <div class="footer-left">
    <span><span class="cdot"></span>DEMO MODE</span>
    <span>INSTANCE: lobster-actual-main</span>
    <span>BACKEND: SUPABASE</span>
  </div>
  <span id="f-updated">SIMULATED DATA</span>
</footer>

<script>
function tick(){document.getElementById('clock').textContent=new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'})+' ET';}
setInterval(tick,1000);tick();

function badge(type){
  const t=(type||'').toLowerCase();
  if(t.includes('tool'))return '<span class="badge b-tool">TOOL</span>';
  if(t.includes('decision'))return '<span class="badge b-decision">DECISION</span>';
  if(t.includes('error'))return '<span class="badge b-error">ERROR</span>';
  if(t.includes('thought'))return '<span class="badge b-thought">THOUGHT</span>';
  if(t.includes('lifecycle'))return '<span class="badge b-lifecycle">LIFECYCLE</span>';
  if(t.includes('spawn'))return '<span class="badge b-spawn">SPAWN</span>';
  return '<span class="badge b-tool">EVENT</span>';
}
function fmtTime(ts){return new Date(ts).toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function fmtMs(ms){return ms<1000?ms+'ms':((ms/1000).toFixed(1))+'s';}
function shortAgent(a){return a.replace('lobster-actual-','LA-').replace('qwen3-coder-next','qwen3').replace('glm-5-reviewer','glm-5');}

const EVENTS = ${JSON.stringify(DEMO_EVENTS)};

// Animate events in one by one
let shown = 0;
const feed = document.getElementById('feed');

function addEvent(ev, idx) {
  const isErr = ev.type.includes('error');
  const row = document.createElement('div');
  row.className = 'ev';
  row.style.animationDelay = (idx * 60) + 'ms';
  row.innerHTML =
    '<span class="ev-time">'+fmtTime(ev.timestamp)+'</span>'+
    badge(ev.type)+
    '<span class="ev-agent">'+shortAgent(ev.agentId)+'</span>'+
    '<span class="ev-action">'+ev.action+'</span>'+
    '<span>'+(isErr?'<span class="err">\u2717</span>':'<span class="ok">\u2713</span>')+'</span>'+
    '<span class="ev-dur">'+fmtMs(ev.durationMs)+'</span>';
  feed.appendChild(row);
}

function renderAll() {
  EVENTS.forEach((ev, i) => addEvent(ev, i));
  document.getElementById('feed-count').textContent = EVENTS.length + ' events';
  document.getElementById('s-events').textContent = EVENTS.length;
  computeStats();
}

function computeStats() {
  const toolCalls = EVENTS.filter(e => e.type.includes('tool'));
  const successes = toolCalls.filter(e => e.ok);
  const rate = Math.round((successes.length / toolCalls.length) * 100);
  document.getElementById('s-rate').textContent = rate + '%';
  document.getElementById('a-rate').textContent = rate + '%';
  document.getElementById('a-total').textContent = toolCalls.length + ' tool calls';
  const bar = document.getElementById('a-bar');
  setTimeout(() => { bar.style.width = rate + '%'; }, 300);

  const durations = toolCalls.map(e => e.durationMs).sort((a,b)=>a-b);
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  document.getElementById('a-p50').textContent = fmtMs(p50);
  document.getElementById('a-p95').textContent = fmtMs(p95);

  // Failure patterns
  const errors = EVENTS.filter(e => !e.ok);
  const fl = document.getElementById('fail-list');
  if (!errors.length) {
    fl.innerHTML = '<div style="font-size:11px;color:var(--text-dim)">No failures recorded \uD83E\uDD9E</div>';
  } else {
    const counts = {};
    errors.forEach(e => { counts[e.action] = (counts[e.action]||0)+1; });
    const mx = Math.max(...Object.values(counts));
    fl.innerHTML = Object.entries(counts).map(([k,v]) =>
      '<div class="fail-row"><span class="fail-name">'+k+'</span><div class="fail-bar"><div class="fail-fill" style="width:0%" data-w="'+Math.round((v/mx)*100)+'%"></div></div><span class="fail-n">'+v+'</span></div>'
    ).join('');
    setTimeout(() => {
      document.querySelectorAll('.fail-fill').forEach(el => { el.style.width = el.dataset.w; });
    }, 400);
  }

  // Simulate cost — $0.0023 per session (all local models)
  let cost = 0;
  EVENTS.forEach(e => { if(e.agentId.includes('lobster-actual')) cost += 0.0001; });
  document.getElementById('cost-val').textContent = '$' + cost.toFixed(4);

  document.getElementById('f-updated').textContent = 'DEMO · ' + new Date().toLocaleTimeString('en-US',{hour12:false});
}

// Stagger the render slightly so page loads feel alive
setTimeout(renderAll, 200);
</script>
</body>
</html>`;

initOps()
  .catch(err => { opsError = err.message; console.error('Init failed:', err.message); })
  .finally(() => {
    app.listen(PORT, '0.0.0.0', () =>
      console.log(`🦞 LobsterOps: http://0.0.0.0:${PORT}`)
    );
  });
