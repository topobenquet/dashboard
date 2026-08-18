#!/usr/bin/env python3
"""
Genera el dashboard de Voice AI a partir de calls.json.

Un solo HTML autocontenido: la data va embebida y todo el filtrado por fechas
ocurre en el cliente, asi que el selector responde al instante, la pagina no
necesita servidor y no se cae si GHL no responde.

    python3 fetch_ghl.py <locationId> && python3 build.py "Alpha HVAC"
"""
import datetime, json, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent
CLIENT = sys.argv[1] if len(sys.argv) > 1 else "Alpha HVAC"
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "dist" / "index.html"
import base64

def data_uri(rel, mime="image/png"):
    """El logo va embebido: la pagina tiene que servirse igual si el CDN de GHL
    cambia la URL o la borra."""
    raw = (HERE / rel).read_bytes()
    return f"data:{mime};base64," + base64.b64encode(raw).decode()


LOGO = data_uri("assets/logo.png") if (HERE / "assets" / "logo.png").exists() else ""
DATA = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else HERE / "calls.json"
CALLS = json.loads(DATA.read_text())
APPT_FILE = DATA.parent / "appointments.json"
APPTS = json.loads(APPT_FILE.read_text()) if APPT_FILE.exists() else []

# Categorias derivadas del texto del resumen. Las reglas viven acá a proposito:
# son auditables y se corrigen sin tocar el HTML. El primer patron que matchea
# gana, asi que van de mas especifico a mas general.
REASONS = [
    ("No cooling / emergency repair", ("non-working", "not working", "completely down", "no cooling",
                                       "emergency", "broken")),
    # Va antes que mantenimiento: un termostato roto suele venir descripto como
    # "service visit", que es demasiado generico para dejarlo del otro lado.
    ("Thermostat issue", ("thermostat",)),
    ("Maintenance or AC check", ("check", "maintenance", "tune-up", "inspection")),
    ("Pricing or plans", ("pricing", "cost", "price", "quote", "plans")),
]


def classify(summary):
    s = (summary or "").lower()
    for label, keys in REASONS:
        if any(k in s for k in keys):
            return label
    return "Other" if s else "No summary"


for c in CALLS:
    c["reason"] = classify(c.get("summary"))

has_rec = any(c.get("rec") for c in CALLS)
has_sent = any(c.get("sentiment") for c in CALLS)
answered = [c for c in CALLS if c["outcome"] == "connected"]
callers = {c["phone"] for c in CALLS if c["phone"]}

HTML = r"""<title>__CLIENT__ · AI Voice Agent Analytics</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">

<style>
  :root {
    color-scheme: light;
    --plane:#f4f6f8; --card:#ffffff; --soft:#f7f9fa;
    --ink:#0f1720; --ink-2:#5a6672; --ink-3:#8a95a1; --rule:#e5e9ed; --hair:#eef1f4;
    --brand:#0f8a4d;
    --answered:#0f8a4d; --voicemail:#6d4bc4; --missed:#c2571a; --blue:#1f6fd0;
    --wash-answered:#e6f4ec; --wash-voicemail:#efeafb; --wash-missed:#fbeee4; --wash-blue:#e8f1fc;
    --grid:#eceff2; --up:#0f8a4d; --down:#c2571a;
    --shadow:0 1px 2px rgba(15,23,32,.05), 0 4px 14px rgba(15,23,32,.05);
  }
  @media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme="light"])) {
      color-scheme: dark;
      --plane:#0b0f0e; --card:#151a19; --soft:#1b2120;
      --ink:#eef2f4; --ink-2:#a3aeb6; --ink-3:#7d8891; --rule:#242b2c; --hair:#1e2526;
      --brand:#35c68d;
      --answered:#35c68d; --voicemail:#a78bfa; --missed:#f08a3c; --blue:#5fa8f5;
      --wash-answered:#122a20; --wash-voicemail:#241f38; --wash-missed:#2e2117; --wash-blue:#132335;
      --grid:#202728; --up:#35c68d; --down:#f08a3c;
      --shadow:0 1px 2px rgba(0,0,0,.35), 0 4px 14px rgba(0,0,0,.28);
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --plane:#0b0f0e; --card:#151a19; --soft:#1b2120;
    --ink:#eef2f4; --ink-2:#a3aeb6; --ink-3:#7d8891; --rule:#242b2c; --hair:#1e2526;
    --brand:#35c68d;
    --answered:#35c68d; --voicemail:#a78bfa; --missed:#f08a3c; --blue:#5fa8f5;
    --wash-answered:#122a20; --wash-voicemail:#241f38; --wash-missed:#2e2117; --wash-blue:#132335;
    --grid:#202728; --up:#35c68d; --down:#f08a3c;
    --shadow:0 1px 2px rgba(0,0,0,.35), 0 4px 14px rgba(0,0,0,.28);
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--plane); color:var(--ink); font-size:15px; line-height:1.5;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif; -webkit-font-smoothing:antialiased; }
  .wrap { max-width:1320px; margin:0 auto; padding:26px 22px 70px; }

  .head { display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start; justify-content:space-between;
    margin-bottom:22px; }
  .brand { display:flex; align-items:center; gap:15px; min-width:0; }
  /* El logo tiene contornos negros y se perderia sobre fondo oscuro, asi que
     va sobre una placa clara constante en los dos temas. */
  .logoplate { background:#ffffff; border:1px solid var(--rule); border-radius:12px; padding:7px;
    display:grid; place-items:center; flex:none; box-shadow:var(--shadow); }
  .logoplate img { display:block; height:46px; width:auto; }
  .head h1 { margin:0; font-size:1.7rem; letter-spacing:-.03em; font-weight:750; display:flex;
    align-items:center; gap:11px; }
  .head p { margin:5px 0 0; color:var(--ink-2); font-size:14px; }
  .headtools { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
  .btn { display:inline-flex; align-items:center; gap:8px; background:var(--card); border:1px solid var(--rule);
    border-radius:10px; padding:9px 14px; font:inherit; font-size:13.5px; color:var(--ink); cursor:pointer;
    box-shadow:var(--shadow); }
  .btn:hover { border-color:var(--ink-3); }
  .btn:focus-visible { outline:2px solid var(--brand); outline-offset:2px; }
  .picker { position:relative; }
  .menu { position:absolute; right:0; top:calc(100% + 6px); background:var(--card); border:1px solid var(--rule);
    border-radius:12px; box-shadow:var(--shadow); padding:8px; min-width:250px; z-index:20; }
  .menu[hidden] { display:none; }
  .menu button { display:block; width:100%; text-align:left; background:none; border:0; font:inherit;
    font-size:13.5px; color:var(--ink); padding:8px 10px; border-radius:7px; cursor:pointer; }
  .menu button:hover, .menu button:focus-visible { background:var(--soft); outline:none; }
  .menu button[aria-pressed="true"] { background:var(--soft); font-weight:650; }
  .menu .sep { border-top:1px solid var(--rule); margin:7px 2px; }
  .menu .row { display:flex; gap:8px; align-items:center; padding:4px 10px 8px; }
  .menu input { font:inherit; font-size:13px; padding:6px 8px; border:1px solid var(--rule); border-radius:7px;
    background:var(--card); color:var(--ink); width:100%; color-scheme:inherit; }

  .kpis { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(168px,1fr));
    margin-bottom:14px; }
  /* Las cinco entran en una sola linea desde tablet grande para arriba; por
     debajo se acomodan solas antes que apretarse hasta ser ilegibles. */
  @media (min-width:1000px) { .kpis { grid-template-columns:repeat(5,minmax(0,1fr)); } }
  .kpi { background:var(--card); border:1px solid var(--hair); border-radius:14px; padding:15px 13px 11px;
    box-shadow:var(--shadow); text-align:center; min-width:0; }
  .kpi .top { display:flex; align-items:center; justify-content:center; gap:9px; }
  .chip { width:31px; height:31px; border-radius:10px; display:grid; place-items:center; flex:none; }
  .chip svg { width:17px; height:17px; }
  .kpi .lab { font-size:12.5px; color:var(--ink-2); font-weight:550; line-height:1.25; text-align:left; }
  .kpi .val { font-size:1.65rem; font-weight:750; letter-spacing:-.03em; margin:7px 0 2px; }
  .kpi .delta { font-size:11.5px; color:var(--ink-3); justify-content:center; }
  .kpi .delta b { font-weight:650; }
  .kpi .delta.up b { color:var(--up); } .kpi .delta.down b { color:var(--down); }
  .kpi .spark { margin-top:9px; }

  .grid2 { display:grid; gap:14px; grid-template-columns:1fr; margin-bottom:14px; }
  @media (min-width:1000px) { .grid2 { grid-template-columns:1.85fr 1fr; } }
  .grid3 { display:grid; gap:14px; grid-template-columns:1fr; }
  @media (min-width:1000px) { .grid3 { grid-template-columns:1.85fr 1fr; } }
  .panel { background:var(--card); border:1px solid var(--hair); border-radius:14px; padding:18px 19px;
    box-shadow:var(--shadow); min-width:0; }
  .panel h2 { margin:0; font-size:1.02rem; font-weight:700; letter-spacing:-.015em; }
  .panel .ph { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
  select { font:inherit; font-size:13px; padding:6px 10px; border:1px solid var(--rule); border-radius:8px;
    background:var(--card); color:var(--ink); }
  .scroll { overflow-x:auto; }
  svg { display:block; max-width:100%; }
  svg text { font-family:system-ui,-apple-system,"Segoe UI",sans-serif; }
  .axis { font-size:11px; fill:var(--ink-3); }


  .reasons { display:grid; gap:15px; }
  .reason .rt { display:flex; justify-content:space-between; gap:10px; font-size:13px; margin-bottom:6px; }
  .reason .rt b { font-weight:600; }
  .reason .rt span { color:var(--ink-2); font-variant-numeric:tabular-nums; }
  .reason .bar { height:7px; border-radius:4px; background:var(--hair); overflow:hidden; }
  .reason .bar i { display:block; height:100%; border-radius:4px; background:var(--brand); }

  .insight { background:var(--wash-answered); border:1px solid var(--hair); border-radius:12px;
    padding:17px 19px; }
  .insight #insight { display:grid; gap:9px; }
  .insight #insight p { position:relative; padding-left:19px; }
  .insight #insight p::before { content:""; position:absolute; left:5px; top:8px; width:6px; height:6px;
    border-radius:50%; background:var(--brand); }
  .insight h3 { margin:0 0 6px; font-size:13px; font-weight:700; display:flex; align-items:center; gap:7px; }
  .insight p { margin:0; font-size:13px; color:var(--ink-2); }
  .insight b { color:var(--ink); }

  table { border-collapse:collapse; width:100%; font-size:13px; }
  th,td { text-align:left; padding:10px 11px; border-bottom:1px solid var(--hair); vertical-align:top; }
  thead th { color:var(--ink-3); font-weight:600; font-size:10.5px; letter-spacing:.06em; text-transform:uppercase;
    white-space:nowrap; position:sticky; top:0; background:var(--card); z-index:1; }
  tbody tr:last-child td { border-bottom:0; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  td.when { white-space:nowrap; font-variant-numeric:tabular-nums; }
  .pill { display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:650; padding:3px 9px;
    border-radius:20px; white-space:nowrap; }
  .pill i { width:6px; height:6px; border-radius:50%; }
  .pill.connected { color:var(--answered); background:var(--wash-answered); }
  .pill.connected i { background:var(--answered); }
  .pill.voicemail { color:var(--voicemail); background:var(--wash-voicemail); }
  .pill.voicemail i { background:var(--voicemail); }
  .pill.no_answer { color:var(--missed); background:var(--wash-missed); }
  .pill.no_answer i { background:var(--missed); }
  .rec { display:inline-flex; align-items:center; gap:8px; }
  .recbtn { width:34px; height:34px; flex:none; display:grid; place-items:center; padding:0;
    border:1px solid var(--rule); border-radius:9px; background:var(--card); color:var(--ink-2);
    cursor:pointer; }
  .recbtn svg { width:20px; height:20px; }
  .recbtn:hover { color:var(--brand); border-color:var(--brand); }
  .recbtn:focus-visible { outline:2px solid var(--brand); outline-offset:2px; }
  .recbtn:disabled { opacity:.45; cursor:default; }
  .rectime { font-size:11.5px; color:var(--ink-3); font-variant-numeric:tabular-nums; white-space:nowrap; }
  .norec { color:var(--ink-3); }
  .sum { color:var(--ink-2); font-size:12.5px; max-width:52ch; }
  .sum summary { cursor:pointer; color:var(--ink-2); }
  .sum summary::marker { color:var(--ink-3); }
  .muted { color:var(--ink-3); }
  .empty { padding:40px 20px; text-align:center; color:var(--ink-2); }
  @media (prefers-reduced-motion:reduce) { * { transition:none !important; } }
</style>

<div class="wrap">
  <div class="head">
    <div class="brand">
      __LOGO__
      <div>
      <h1>AI Voice Agent Analytics
        <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true">
          <g fill="var(--brand)">
            <rect x="0" y="6" width="2.6" height="6" rx="1.3"/>
            <rect x="4.4" y="2" width="2.6" height="14" rx="1.3"/>
            <rect x="8.8" y="7" width="2.6" height="4" rx="1.3"/>
            <rect x="13.2" y="0" width="2.6" height="18" rx="1.3"/>
            <rect x="17.6" y="4" width="2.6" height="10" rx="1.3"/>
            <rect x="22" y="7" width="2.6" height="4" rx="1.3"/>
          </g>
        </svg>
      </h1>
      <p>__CLIENT__ · inbound calls handled by the voice agent</p>
      </div>
    </div>
    <div class="headtools">
      <div class="picker">
        <button class="btn" id="pickbtn" aria-haspopup="true" aria-expanded="false">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
               aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/></svg>
          <span id="picklabel">This month</span>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"
               aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>
        </button>
        <div class="menu" id="pickmenu" hidden>
          <button type="button" data-range="thisMonth">This month</button>
          <button type="button" data-range="last7">Last 7 days</button>
          <button type="button" data-range="thisWeek">This week</button>
          <button type="button" data-range="lastWeek">Last week</button>
          <button type="button" data-range="last30">Last 30 days</button>
          <button type="button" data-range="all">All time</button>
          <div class="sep"></div>
          <div class="row"><label for="from" class="muted">From</label><input type="date" id="from"></div>
          <div class="row"><label for="to" class="muted">To</label><input type="date" id="to"></div>
        </div>
      </div>
      <button class="btn" id="export">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
             aria-hidden="true"><path d="M8 11V2M4.5 5.5L8 2l3.5 3.5M2.5 11v2a1 1 0 001 1h9a1 1 0 001-1v-2"/></svg>
        Export CSV
      </button>
    </div>
  </div>

  <div class="kpis" id="kpis"></div>

  <div class="grid2">
    <div class="panel">
      <div class="ph"><h2>Call Volume Over Time</h2>
        <select id="grain"><option value="day">Daily</option><option value="week">Weekly</option></select>
      </div>
      <div class="scroll"><svg id="chart-vol" role="img" aria-label="Call volume over time"></svg></div>
    </div>
    <div class="panel">
      <div class="ph"><h2>Top Call Reasons</h2></div>
      <div class="reasons" id="reasons"></div>
    </div>
  </div>

  <div class="panel" style="padding-bottom:8px; margin-bottom:14px">
    <div class="ph"><h2>Call Log</h2><span class="muted" id="logcount"></span></div>
    <div class="scroll" style="max-height:620px; overflow-y:auto">
      <table id="log"><thead><tr id="loghead"></tr></thead><tbody></tbody></table>
    </div>
    <div class="empty" id="empty" hidden>No calls in the selected range.</div>
  </div>

  <div class="insight">
    <h3>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--brand)" aria-hidden="true">
        <path d="M8 0l1.6 4.6L14 6l-4.4 1.4L8 12l-1.6-4.6L2 6l4.4-1.4z"/></svg>
      Insight
    </h3>
    <div id="insight"></div>
  </div>

</div>

<script>
var CALLS = __CALLS__;
var APPTS = __APPTS__;
var HAS_REC = true;
var NS = "http://www.w3.org/2000/svg";
var range = "thisMonth", custom = null, grain = "day";
var LABELS = { thisMonth:"This month", last7:"Last 7 days", thisWeek:"This week", lastWeek:"Last week",
  last30:"Last 30 days", all:"All time" };
var OUTCOME = { connected:{label:"Answered",color:"var(--answered)"},
  voicemail:{label:"Voicemail",color:"var(--voicemail)"}, no_answer:{label:"Missed",color:"var(--missed)"} };

function el(t,a,x){var n=document.createElementNS(NS,t);for(var k in a)n.setAttribute(k,a[k]);
  if(x!=null)n.textContent=x;return n;}
function pad(v){return String(v).padStart(2,"0");}
function iso(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function dayOf(ts){return iso(new Date(ts));}
function mmss(s){return Math.floor(s/60)+":"+pad(Math.round(s%60));}
function monday(d){var x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;}

function boundsFor(key){
  var now=new Date(),a,b=new Date(now);
  if(key==="thisMonth") a=new Date(now.getFullYear(),now.getMonth(),1);
  else if(key==="last7"){a=new Date(now);a.setDate(a.getDate()-6);}
  else if(key==="last30"){a=new Date(now);a.setDate(a.getDate()-29);}
  else if(key==="thisWeek") a=monday(now);
  else if(key==="lastWeek"){a=monday(now);a.setDate(a.getDate()-7);b=new Date(a);b.setDate(b.getDate()+6);}
  else a=new Date(2000,0,1);
  return {from:iso(a),to:iso(b)};
}
function bounds(){return custom||boundsFor(range);}
function inRange(ts,r){var d=dayOf(ts);return d>=r.from&&d<=r.to;}
function selected(r){r=r||bounds();return CALLS.filter(function(c){return inRange(c.ts,r);});}

/* Ventana anterior de igual largo, para el delta de los KPI. */
function previous(r){
  var a=new Date(r.from+"T12:00:00"),b=new Date(r.to+"T12:00:00");
  var days=Math.round((b-a)/86400000)+1;
  var pb=new Date(a);pb.setDate(pb.getDate()-1);
  var pa=new Date(pb);pa.setDate(pa.getDate()-days+1);
  return {from:iso(pa),to:iso(pb)};
}
function fmtRange(r){
  var o={month:"short",day:"numeric",year:"numeric"};
  var a=new Date(r.from+"T12:00:00"),b=new Date(r.to+"T12:00:00");
  return r.from===r.to?a.toLocaleDateString("en-US",o)
    :a.toLocaleDateString("en-US",o)+" \u2013 "+b.toLocaleDateString("en-US",o);
}

function stats(rows,r){
  var ans=rows.filter(function(c){return c.outcome==="connected";});
  var talk=ans.reduce(function(a,c){return a+c.dur;},0);
  var appts=APPTS.filter(function(a){return !a.test&&a.ts&&inRange(new Date(a.ts).getTime(),r);});
  return {calls:rows.length, answered:ans.length,
    rate:rows.length?ans.length/rows.length*100:null,
    avg:ans.length?talk/ans.length:null, talk:talk, appts:appts.length,
    // Citas sobre el total de llamadas: es la pregunta del duenio del negocio,
    // "de todo lo que entro, cuanto se convirtio en trabajo".
    close:rows.length?appts.length/rows.length*100:null};
}

var ICONS={
  phone:'<path d="M3 3.5c0-.6.4-1 1-1h1.8c.5 0 .9.3 1 .8l.5 2c.1.4 0 .8-.3 1l-1 .9a9 9 0 004 4l.9-1c.3-.3.7-.4 1-.3l2 .5c.5.1.8.5.8 1V13c0 .6-.4 1-1 1A11 11 0 013 3.5z"/>',
  head:'<path d="M3 9a5 5 0 0110 0v3a2 2 0 01-2 2H9" stroke="currentColor" fill="none" stroke-width="1.5"/><rect x="2" y="8" width="2.6" height="4.5" rx="1.3"/><rect x="11.4" y="8" width="2.6" height="4.5" rx="1.3"/>',
  clock:'<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.6V8l2.4 1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  cal:'<rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  target:'<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 .8v2.2M8 13v2.2M.8 8h2.2M13 8h2.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
};

function sparkline(vals,color){
  var W=180,H=34,n=vals.length;
  if(n<2) return "";
  var max=Math.max.apply(null,vals.concat([1]));
  var pts=vals.map(function(v,i){return [i/(n-1)*W, H-2-(v/max)*(H-6)];});
  var d=pts.map(function(p,i){return (i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1);}).join(" ");
  return '<svg width="100%" height="'+H+'" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true">'+
    '<path d="'+d+" L"+W+" "+H+" L0 "+H+' Z" fill="'+color+'" opacity=".12"/>'+
    '<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.6" stroke-linejoin="round"/></svg>';
}

function series(rows,r,pick){
  var out=[],a=new Date(r.from+"T12:00:00"),b=new Date(r.to+"T12:00:00"),g=0;
  for(var d=new Date(a);d<=b&&g<400;d.setDate(d.getDate()+1),g++){
    var k=iso(d),on=rows.filter(function(c){return dayOf(c.ts)===k;});
    out.push(pick(on,d,k));
  }
  return out;
}

function kpis(rows,r){
  var s=stats(rows,r), p=stats(selected(previous(r)),previous(r));
  var daily=series(rows,r,function(on){return on;});
  function delta(now,before,unit){
    if(before==null||!before) return {txt:"no prior data",cls:""};
    var d=(now-before)/before*100;
    return {txt:(d>=0?"\u2191 ":"\u2193 ")+Math.abs(d).toFixed(1)+"% vs previous period",
      cls:d>=0?"up":"down"};
  }
  var cards=[
    {lab:"Total Calls",val:String(s.calls),icon:"phone",color:"var(--answered)",wash:"var(--wash-answered)",
     d:delta(s.calls,p.calls),spark:daily.map(function(o){return o.length;})},
    {lab:"Answer Rate",val:s.rate==null?"\u2014":s.rate.toFixed(1)+"%",icon:"head",color:"var(--voicemail)",
     wash:"var(--wash-voicemail)",d:delta(s.rate,p.rate),
     spark:daily.map(function(o){return o.length?o.filter(function(c){return c.outcome==="connected";}).length/o.length*100:0;})},
    {lab:"Avg. Call Duration",val:s.avg==null?"\u2014":mmss(s.avg),icon:"clock",color:"var(--missed)",
     wash:"var(--wash-missed)",d:delta(s.avg,p.avg),
     spark:daily.map(function(o){var k=o.filter(function(c){return c.outcome==="connected";});
       return k.length?k.reduce(function(a,c){return a+c.dur;},0)/k.length:0;})},
    {lab:"Appointments Booked",val:String(s.appts),icon:"cal",color:"var(--blue)",wash:"var(--wash-blue)",
     d:delta(s.appts,p.appts),
     spark:series(rows,r,function(on,d,k){
       return APPTS.filter(function(a){return !a.test&&a.ts&&dayOf(new Date(a.ts).getTime())===k;}).length;})},
    {lab:"Close Rate",val:s.close==null?"\u2014":s.close.toFixed(1)+"%",icon:"target",
     color:"var(--answered)",wash:"var(--wash-answered)",d:delta(s.close,p.close),
     spark:series(rows,r,function(on,d,k){
       var a=APPTS.filter(function(x){return !x.test&&x.ts&&dayOf(new Date(x.ts).getTime())===k;}).length;
       return on.length?a/on.length*100:0;})}
  ];
  document.getElementById("kpis").innerHTML=cards.map(function(c){
    return '<div class="kpi"><div class="top">'+
      '<span class="chip" style="background:'+c.wash+';color:'+c.color+'">'+
      '<svg viewBox="0 0 16 16" fill="'+c.color+'" aria-hidden="true">'+ICONS[c.icon]+'</svg></span>'+
      '<span class="lab">'+c.lab+'</span></div>'+
      '<div class="val">'+c.val+'</div>'+
      '<div class="delta '+c.d.cls+'"><b>'+c.d.txt+'</b></div>'+
      '<div class="spark">'+sparkline(c.spark,c.color)+'</div></div>';
  }).join("");
}

function volume(rows,r){
  var svg=document.getElementById("chart-vol");
  svg.textContent="";
  var pts;
  if(grain==="week"){
    var byWeek={};
    rows.forEach(function(c){var m=monday(new Date(c.ts));byWeek[iso(m)]=(byWeek[iso(m)]||0)+1;});
    var keys=Object.keys(byWeek).sort();
    if(!keys.length){keys=[iso(monday(new Date(r.from+"T12:00:00")))];byWeek[keys[0]]=0;}
    pts=keys.map(function(k){return {k:k,v:byWeek[k],
      lab:new Date(k+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})};});
  } else {
    pts=series(rows,r,function(on,d,k){return {k:k,v:on.length,
      lab:d.toLocaleDateString("en-US",{month:"short",day:"numeric"})};});
  }
  var W=760,H=210,padL=34,padR=10,padT=12,padB=26;
  var n=pts.length,max=Math.max.apply(null,pts.map(function(p){return p.v;}).concat([2]));
  max=Math.ceil(max/2)*2;
  var x=function(i){return n<2?padL:padL+i/(n-1)*(W-padL-padR);};
  var y=function(v){return padT+(1-v/max)*(H-padT-padB);};
  svg.setAttribute("viewBox","0 0 "+W+" "+H);
  svg.style.minWidth=n>18?"700px":"0";
  [0,.5,1].forEach(function(t){
    svg.appendChild(el("line",{x1:padL,x2:W-padR,y1:y(max*t),y2:y(max*t),stroke:"var(--grid)"}));
    svg.appendChild(el("text",{x:padL-7,y:y(max*t)+4,class:"axis","text-anchor":"end"},String(Math.round(max*t))));
  });
  if(n>=2){
    var d=pts.map(function(p,i){return (i?"L":"M")+x(i).toFixed(1)+" "+y(p.v).toFixed(1);}).join(" ");
    svg.appendChild(el("path",{d:d+" L"+x(n-1)+" "+y(0)+" L"+x(0)+" "+y(0)+" Z",
      fill:"var(--brand)",opacity:".14"}));
    svg.appendChild(el("path",{d:d,fill:"none",stroke:"var(--brand)","stroke-width":2,
      "stroke-linejoin":"round"}));
  }
  pts.forEach(function(p,i){
    if(!p.v&&n>1) return;
    svg.appendChild(el("circle",{cx:x(i),cy:y(p.v),r:3.2,fill:"var(--brand)"}));
  });
  var every=Math.max(1,Math.ceil(n/7));
  pts.forEach(function(p,i){
    if(i%every!==0&&i!==n-1) return;
    var anchor=i===0?"start":(i===n-1?"end":"middle");
    svg.appendChild(el("text",{x:x(i),y:H-8,class:"axis","text-anchor":anchor},p.lab));
  });
}

function reasons(rows){
  var m={};
  rows.forEach(function(c){ if(c.outcome!=="connected") return; m[c.reason]=(m[c.reason]||0)+1; });
  var list=Object.keys(m).map(function(k){return {k:k,n:m[k]};})
    .sort(function(a,b){return b.n-a.n;});
  var total=list.reduce(function(a,b){return a+b.n;},0);
  var host=document.getElementById("reasons");
  if(!total){host.innerHTML='<p class="muted" style="margin:0;font-size:13px">No answered calls in this range.</p>';return;}
  host.innerHTML=list.map(function(r){
    var pct=r.n/total*100;
    return '<div class="reason"><div class="rt"><b>'+r.k+"</b><span>"+r.n+" ("+pct.toFixed(1)+
      '%)</span></div><div class="bar"><i style="width:'+pct.toFixed(1)+'%"></i></div></div>';
  }).join("");
}

function insight(rows,r){
  var s=stats(rows,r);
  var host=document.getElementById("insight");
  if(!rows.length){host.innerHTML='<p>No calls in the selected range.</p>';return;}
  var callers={};rows.forEach(function(c){if(c.phone)callers[c.phone]=1;});
  var uniq=Object.keys(callers).length;
  var urgent=rows.filter(function(c){return c.outcome==="connected"&&
    c.reason==="No cooling / emergency repair";}).length;
  var bits=[];
  var miss=rows.filter(function(c){return c.outcome==="no_answer";}).length;
  var vm=rows.filter(function(c){return c.outcome==="voicemail";}).length;
  bits.push("<p><b>"+s.answered+" of "+s.calls+"</b> calls were answered"+
    (miss||vm?" ("+[miss?miss+" missed":"",vm?vm+" to voicemail":""].filter(Boolean).join(", ")+")":"")+
    ", averaging <b>"+
    (s.avg?mmss(s.avg):"\u2014")+"</b> of conversation. <b>"+s.appts+"</b> turned into a booked appointment"+
    (s.answered?" \u2014 "+Math.round(s.appts/s.answered*100)+"% of answered calls":"")+".</p>");
  if(urgent) bits.push("<p><b>"+urgent+"</b> of the answered calls were a completely non-working unit \u2014 the "+
    "most urgent and highest-value job type. Same-day availability is what converts these.</p>");
  if(uniq&&uniq<rows.length) bits.push("<p>These "+rows.length+" calls came from <b>"+uniq+
    " distinct numbers</b>, so several are repeat attempts by the same caller rather than separate leads.</p>");
  host.innerHTML=bits.join("");
}

var COLS=["Date & time","Caller","Location","Status","Duration","Recording","Reason","Summary"];

function log(rows){
  var head=document.getElementById("loghead"), tb=document.querySelector("#log tbody");
  var cols=COLS.slice();
  head.innerHTML=cols.map(function(c){return "<th"+(c==="Duration"?' style="text-align:right"':"")+">"+c+"</th>";}).join("");
  tb.textContent="";
  document.getElementById("empty").hidden=rows.length>0;
  document.getElementById("logcount").textContent=rows.length?rows.length+" calls":"";
  rows.slice().sort(function(a,b){return b.ts-a.ts;}).forEach(function(c){
    var tr=document.createElement("tr"),d=new Date(c.ts);
    function td(cls){var x=document.createElement("td");if(cls)x.className=cls;tr.appendChild(x);return x;}
    td("when").textContent=d.toLocaleDateString("en-US",{month:"short",day:"numeric"})+", "+
      d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
    td().textContent=c.name||c.phone||"\u2014";
    td().textContent=c.place||"\u2014";
    var o=OUTCOME[c.outcome];
    var p=document.createElement("span");p.className="pill "+c.outcome;
    p.appendChild(document.createElement("i"));
    p.appendChild(document.createTextNode(o.label));
    td().appendChild(p);
    td("num").textContent=c.dur?mmss(c.dur):"\u2014";
    var rc=td();
    if(c.rec) rc.appendChild(player(c));
    else { var no=document.createElement("span"); no.className="norec";
      no.title="Recording was not enabled when this call came in";
      no.textContent="\u2014"; rc.appendChild(no); }
    td().textContent=c.reason||"\u2014";
    var sm=td("sum");
    if(c.summary&&c.summary.length>140){
      var det=document.createElement("details");
      var su=document.createElement("summary");su.textContent=c.summary.slice(0,120)+"\u2026";
      det.appendChild(su);det.appendChild(document.createTextNode(c.summary));sm.appendChild(det);
    } else sm.textContent=c.summary||"\u2014";
    tb.appendChild(tr);
  });
}

var WAVE='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" '+
  'stroke="currentColor" stroke-width="1.7"/><g stroke="currentColor" stroke-width="1.7" '+
  'stroke-linecap="round"><path d="M8 10.4v3.2"/><path d="M10.7 8.4v7.2"/><path d="M13.3 9.6v4.8"/>'+
  '<path d="M16 11v2"/></g></svg>';
var PAUSE='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" '+
  'stroke="currentColor" stroke-width="1.7"/><g fill="currentColor"><rect x="9.2" y="8.4" width="2.2" '+
  'height="7.2" rx="1"/><rect x="12.6" y="8.4" width="2.2" height="7.2" rx="1"/></g></svg>';

/* Un solo audio a la vez: si suena otro, se corta el anterior. */
var playing=null;
function player(c){
  var wrap=document.createElement("span"); wrap.className="rec";
  var btn=document.createElement("button");
  btn.type="button"; btn.className="recbtn"; btn.innerHTML=WAVE;
  btn.setAttribute("aria-label","Play call recording");
  var time=document.createElement("span"); time.className="rectime";
  time.textContent=c.dur?mmss(c.dur):"";
  var audio=null;
  btn.addEventListener("click",function(){
    if(!audio){
      audio=new Audio(c.rec); audio.preload="none";
      audio.addEventListener("timeupdate",function(){
        if(audio.duration) time.textContent=mmss(audio.currentTime)+" / "+mmss(audio.duration);});
      audio.addEventListener("ended",function(){
        btn.innerHTML=WAVE; btn.setAttribute("aria-label","Play call recording");
        time.textContent=c.dur?mmss(c.dur):""; playing=null;});
      audio.addEventListener("error",function(){
        time.textContent="unavailable"; btn.disabled=true;});
    }
    if(audio.paused){
      if(playing&&playing!==audio) playing.pause();
      playing=audio; audio.play();
      btn.innerHTML=PAUSE; btn.setAttribute("aria-label","Pause call recording");
    } else {
      audio.pause(); btn.innerHTML=WAVE; btn.setAttribute("aria-label","Play call recording");
    }
  });
  wrap.appendChild(btn); wrap.appendChild(time);
  return wrap;
}

function csv(rows){
  var head=["Date","Time","Caller","Location","Direction","Status","Duration (s)","Reason","Summary"];
  var q=function(v){return '"'+String(v==null?"":v).replace(/"/g,'""')+'"';};
  var lines=[head.map(q).join(",")];
  rows.slice().sort(function(a,b){return b.ts-a.ts;}).forEach(function(c){
    var d=new Date(c.ts);
    lines.push([iso(d),d.toTimeString().slice(0,5),c.name||c.phone,c.place,c.dir,
      OUTCOME[c.outcome].label,c.dur,c.reason,c.summary].map(q).join(","));
  });
  return lines.join("\n");
}

function render(){
  var r=bounds(),rows=selected(r);
  document.getElementById("picklabel").textContent=custom?fmtRange(r):LABELS[range];
  document.querySelectorAll("#pickmenu [data-range]").forEach(function(b){
    b.setAttribute("aria-pressed",String(!custom&&b.dataset.range===range));});
  kpis(rows,r);volume(rows,r);reasons(rows);insight(rows,r);log(rows);
}

var menu=document.getElementById("pickmenu"),pickbtn=document.getElementById("pickbtn");
pickbtn.addEventListener("click",function(e){
  e.stopPropagation();
  var open=menu.hidden;menu.hidden=!open;pickbtn.setAttribute("aria-expanded",String(open));});
document.addEventListener("click",function(e){
  if(!menu.hidden&&!menu.contains(e.target)){menu.hidden=true;pickbtn.setAttribute("aria-expanded","false");}});
menu.addEventListener("click",function(e){e.stopPropagation();});
document.querySelectorAll("#pickmenu [data-range]").forEach(function(b){
  b.addEventListener("click",function(){
    range=b.dataset.range;custom=null;
    document.getElementById("from").value="";document.getElementById("to").value="";
    menu.hidden=true;pickbtn.setAttribute("aria-expanded","false");render();});});
["from","to"].forEach(function(id){
  document.getElementById(id).addEventListener("change",function(){
    var a=document.getElementById("from").value,b=document.getElementById("to").value;
    if(a&&b){custom={from:a>b?b:a,to:a>b?a:b};render();}});});
document.getElementById("grain").addEventListener("change",function(e){
  grain=e.target.value;volume(selected(),bounds());});
document.getElementById("export").addEventListener("click",function(){
  var blob=new Blob([csv(selected())],{type:"text/csv;charset=utf-8"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="voice-ai-calls-"+bounds().from+"-to-"+bounds().to+".csv";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href);},2000);});

/* Si el mes en curso todavia no tiene llamadas, abrir en blanco no le sirve a
   nadie: se cae a todo el historico. */
if(!selected().length) range="all";
render();
</script>
"""

SUBS = {
    "__CLIENT__": CLIENT,
    "__LOGO__": (f'<span class="logoplate"><img src="{LOGO}" alt="{CLIENT} logo" height="46"></span>'
                 if LOGO else ""),
    "__CALLS__": json.dumps(CALLS, separators=(",", ":")),
    "__APPTS__": json.dumps(APPTS, separators=(",", ":")),
    "__HAS_REC__": "true" if has_rec else "false",
}
out = HTML
for k, v in SUBS.items():
    out = out.replace(k, str(v))
left = [c for c in out.split("__") if c in {k.strip("_") for k in SUBS}]
assert not left, f"placeholders sin resolver: {left}"

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(out)
print(f"escrito {OUT} ({len(out)} bytes)")
print(f"  {len(CALLS)} llamadas · {len(answered)} atendidas · {len(callers)} numeros distintos")
print(f"  citas reales: {sum(1 for a in APPTS if not a.get('test'))} de {len(APPTS)}")
print(f"  grabaciones: {'si' if has_rec else 'NO (recording apagado en GHL)'} · sentiment: {'si' if has_sent else 'NO'}")
from collections import Counter
print("  motivos:", Counter(c['reason'] for c in CALLS if c['outcome']=='connected').most_common())
