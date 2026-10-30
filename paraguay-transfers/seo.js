/* Paraguay Transfers: pestaña SEO
 * Lee seo.json (lo genera content-publisher/src/seo/pt-gsc-semanal.mjs todos los días desde Search Console, la
 * inspección de URLs y GA4) y pinta en #seo. Independiente de las otras pestañas: si falla, lo demás sigue.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fN = (n) => (n == null ? "–" : Math.round(n).toLocaleString("es-PY"));
  const fP = (n) => (n == null ? "–" : String(n).replace(".", ","));
  const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const kpi = (label, val, sub, cls) => `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value${cls ? " " + cls : ""}">${val}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ""}</div>`;
  const delta = (a, b) => { if (!b) return a ? '<span class="pos">nuevo</span>' : '<span class="neu">–</span>'; const d = Math.round((100 * (a - b)) / b); return `<span class="${d > 0 ? "pos" : d < 0 ? "neg" : "neu"}">${d > 0 ? "+" : ""}${d}%</span>`; };
  const dpos = (a, b) => { if (a == null || b == null) return '<span class="neu">–</span>'; const d = Math.round((b - a) * 10) / 10; return `<span class="${d > 0 ? "pos" : d < 0 ? "neg" : "neu"}">${d > 0 ? "▲" : d < 0 ? "▼" : ""}${fP(Math.abs(d))}</span>`; };
  const short = (p) => (p.length > 62 ? p.slice(0, 60) + "…" : p);
  const link = (p) => `<a href="https://paraguaytransfers.com${esc(p)}" target="_blank" rel="noopener" style="color:#1F4E78;text-decoration:none" title="${esc(p)}">${esc(short(p))}</a>`;
  const spark = (vals, w = 70, h = 18) => {
    const v = vals.map((x) => x || 0), mx = Math.max(1, ...v);
    const pts = v.map((y, i) => `${(i * w) / Math.max(1, v.length - 1)},${h - 1 - (y / mx) * (h - 2)}`).join(" ");
    return `<svg width="${w}" height="${h}" style="vertical-align:middle"><polyline points="${pts}" fill="none" stroke="#2563EB" stroke-width="1.5"/></svg>`;
  };
  let S = null;
  const state = { metric: {} };

  function kpis() {
    const L = S.last, P = S.prev, ih = S.index?.hist || [], ia = ih.at(-1), ib = ih.at(-2), g = S.ga4 && !S.ga4.error ? S.ga4.total : null;
    return `<div class="section"><div class="section-title">Últimos 7 días con datos: ${dm(L.start)} a ${dm(L.end)} · Search Console</div>
      <div class="kpi-row kpi-row-5">
        ${kpi("Clics de 7 días", fN(L.c), `${delta(L.c, P.c)} vs los 7 anteriores (${fN(P.c)})`)}
        ${kpi("Impresiones", fN(L.i), `${delta(L.i, P.i)} vs ${fN(P.i)}`)}
        ${kpi("Clics 4 semanas", fN(S.w4.c), `${delta(S.w4.c, S.w4prev.c)} vs las 4 anteriores · CTR ${fP(S.w4.ctr)}%`)}
        ${kpi("URLs indexadas", ia ? `${ia.ok}/${ia.total}` : "–", ib ? `antes ${ib.ok}/${ib.total} (${dm(ib.date)})` : "del sitemap")}
        ${kpi("GA4 orgánico: clics de reserva", g ? fN(g.at(-1).e) : "–", g ? `${fN(g.at(-1).s)} sesiones · antes ${fN(g.at(-2).e)} eventos, ${fN(g.at(-2).s)} sesiones` : "")}
      </div></div>`;
  }

  function chart() {
    const T = S.total, W = 900, H = 200, pad = 28, n = T.length, bw = (W - pad * 2) / n;
    const mc = Math.max(...T.map((x) => x.c)), mi = Math.max(...T.map((x) => x.i));
    const bars = T.map((x, k) => { const h = (x.c / mc) * (H - 40); return `<rect x="${pad + k * bw + 2}" y="${H - 20 - h}" width="${bw - 4}" height="${h}" fill="#93C5FD"><title>${dm(S.weeks[k])}: ${x.c} clics, ${fN(x.i)} impresiones, pos. ${fP(x.pos)}</title></rect>${k % 3 === n % 3 || k === n - 1 ? `<text x="${pad + k * bw + bw / 2}" y="${H - 6}" font-size="9" text-anchor="middle" fill="#9CA3AF">${dm(S.weeks[k])}</text>` : ""}${k === n - 1 || k % 4 === 0 ? `<text x="${pad + k * bw + bw / 2}" y="${H - 24 - h}" font-size="9" text-anchor="middle" fill="#1F4E78">${x.c}</text>` : ""}`; }).join("");
    const line = T.map((x, k) => `${pad + k * bw + bw / 2},${H - 20 - (x.i / mi) * (H - 40)}`).join(" ");
    return `<div class="section"><div class="section-title">Evolución semanal · ${n} semanas</div><div class="chart-card">
      <svg viewBox="0 0 ${W} ${H}">${bars}<polyline points="${line}" fill="none" stroke="#F59E0B" stroke-width="2"/></svg>
      <div class="chart-hint">Barras azules: clics. Línea naranja: impresiones (escala propia). Pasá el mouse por una barra para ver el detalle.</div></div></div>`;
  }

  /** Tabla con una columna por semana (últimas 8) y botones clics / impresiones / posición. */
  function weekTable(id, title, rows, note) {
    const m = state.metric[id] || "c", k = 8, n = S.weeks.length, wk = S.weeks.slice(-k);
    const val = (x) => (m === "pos" ? (x.pos == null ? "–" : fP(x.pos)) : fN(x[m]));
    const agg = (s, a, b) => { const z = s.slice(a, b); const c = z.reduce((t, x) => t + x.c, 0), i = z.reduce((t, x) => t + x.i, 0); return { c, i, pos: i ? Math.round((z.reduce((t, x) => t + (x.pos || 0) * x.i, 0) / i) * 10) / 10 : null }; };
    const body = rows.filter((r) => r.s.slice(-8).some((x) => x.i > 0)).map((r) => {
      const a = agg(r.s, n - 4, n), b = agg(r.s, n - 8, n - 4);
      return `<tr><td class="tl"><b>${esc(r.label)}</b></td>${r.s.slice(-k).map((x, j) => { const p = j ? r.s.slice(-k)[j - 1] : null; let st = ""; if (p && m !== "pos" && p[m] && x[m] !== p[m]) st = x[m] > p[m] ? "color:#059669" : "color:#DC2626"; return `<td style="${st}">${val(x)}</td>`; }).join("")}
        <td>${fN(a.c)}</td><td>${delta(a.c, b.c)}</td><td>${fN(a.i)}</td><td>${delta(a.i, b.i)}</td><td>${fP(a.pos)}</td><td>${dpos(a.pos, b.pos)}</td></tr>`;
    }).join("");
    const btn = (k2, l) => `<button class="mbtn" data-seo-metric="${id}:${k2}" aria-pressed="${m === k2}" style="${m === k2 ? "background:#1F4E78" : ""}">${l}</button>`;
    return `<div class="section" id="seo-${id}"><div class="section-title">${title}</div>
      <div class="chart-legend">${btn("c", "Clics")}${btn("i", "Impresiones")}${btn("pos", "Posición")}</div>
      <div class="ft-wrap"><table class="ft" style="min-width:1100px"><colgroup><col style="width:210px">${wk.map(() => "<col>").join("")}<col><col><col><col><col><col></colgroup>
      <thead><tr><th class="tl">Grupo</th>${wk.map((w) => `<th>${dm(w)}</th>`).join("")}<th>Clics 4s</th><th>Δ</th><th>Impr. 4s</th><th>Δ</th><th>Pos. 4s</th><th>Δ pos.</th></tr></thead><tbody>${body}</tbody></table></div>
      ${note ? `<div class="info-box info-gray" style="margin-top:8px">${note}</div>` : ""}</div>`;
  }
  const rowsOf = (obj, labels) => Object.keys(obj).map((k) => ({ label: labels[k] || k, s: obj[k] }));

  function pagesTable() {
    const rows = S.pages.map((p) => `<tr><td class="tl">${link(p.p)}</td><td class="tl"><span class="pill pill-ot">${esc(S.labels.pageGroups[p.g] || p.g)}</span></td><td>${p.lang}</td>
      <td><b>${fN(p.c)}</b></td><td>${delta(p.c, p.cPrev)}</td><td>${fN(p.i)}</td><td>${delta(p.i, p.iPrev)}</td><td>${fP(p.ctr)}%</td><td>${fP(p.pos)}</td><td>${dpos(p.pos, p.posPrev)}</td><td>${spark(p.wk)}</td></tr>`).join("");
    return `<div class="section"><div class="section-title">Páginas más populares · últimas 4 semanas</div>
      <div class="ft-wrap"><table class="ft" style="min-width:1000px"><colgroup><col style="width:330px"><col style="width:120px"><col style="width:40px"><col><col><col><col><col><col><col><col style="width:80px"></colgroup>
      <thead><tr><th class="tl">Página</th><th class="tl">Sección</th><th>Id.</th><th>Clics</th><th>Δ</th><th>Impr.</th><th>Δ</th><th>CTR</th><th>Pos.</th><th>Δ pos.</th><th>8 sem.</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="info-box info-gray" style="margin-top:8px">Δ compara las últimas 4 semanas con las 4 anteriores. En posición, ▲ es mejora (número más chico).</div></div>`;
  }

  function queriesTable() {
    const wk = S.weeks.slice(-8);
    const rows = S.queries.map((q) => `<tr><td class="tl" title="${esc(q.q)}">${esc(q.q)}</td><td class="tl"><span class="pill pill-ot">${esc(S.labels.kwGroups[q.g] || q.g)}</span></td>
      ${q.wk.map((x) => `<td style="color:${x[2] == null ? "#D1D5DB" : x[2] <= 10 ? "#059669" : x[2] <= 20 ? "#1F2937" : "#9CA3AF"}" title="${x[0]} clics, ${x[1]} impr.">${x[2] == null ? "·" : fP(Math.round(x[2] * 10) / 10)}</td>`).join("")}
      <td>${fN(q.c)}</td><td>${fN(q.i)}</td><td>${delta(q.i, q.iPrev)}</td><td><b>${fP(q.pos)}</b></td><td>${dpos(q.pos, q.posPrev)}</td></tr>`).join("");
    return `<div class="section"><div class="section-title">Keywords principales · posición semana a semana</div>
      <div class="ft-wrap"><table class="ft" style="min-width:1150px"><colgroup><col style="width:260px"><col style="width:130px">${wk.map(() => "<col>").join("")}<col><col><col><col><col></colgroup>
      <thead><tr><th class="tl">Consulta</th><th class="tl">Grupo</th>${wk.map((w) => `<th>${dm(w)}</th>`).join("")}<th>Clics 4s</th><th>Impr. 4s</th><th>Δ</th><th>Pos. 4s</th><th>Δ pos.</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="info-box info-gray" style="margin-top:8px">Columnas de semana = posición media (verde: top 10). Pasá el mouse para ver clics e impresiones. Ordenadas por impresiones de las últimas 4 semanas.</div></div>`;
  }

  function moversQ(title, arr, kind) {
    if (!arr.length) return `<div class="card"><div class="card-title">${title}</div><div class="chart-empty">Nada esta vez</div></div>`;
    const rows = arr.map((q) => `<tr><td class="tl" title="${esc(q.q)}">${esc(q.q)}</td><td>${fP(q.posPrev)} → <b>${fP(q.pos)}</b></td><td>${fN(q.i)}</td><td>${fN(q.c)}</td></tr>`).join("");
    return `<div class="card"><div class="card-title">${title}</div><div class="ft-wrap"><table class="ft" style="min-width:0"><colgroup><col><col style="width:95px"><col style="width:55px"><col style="width:45px"></colgroup><thead><tr><th class="tl">Consulta</th><th>Posición</th><th>Impr.</th><th>Clics</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }
  function moversP(title, arr, f) {
    if (!arr.length) return `<div class="card"><div class="card-title">${title}</div><div class="chart-empty">Nada esta vez</div></div>`;
    const rows = arr.map((p) => `<tr><td class="tl">${link(p.p)}</td><td>${f === "i" ? `${fN(p.iPrev)} → <b>${fN(p.i)}</b>` : `${fN(p.cPrev)} → <b>${fN(p.c)}</b>`}</td><td>${fP(p.pos)}</td></tr>`).join("");
    return `<div class="card"><div class="card-title">${title}</div><div class="ft-wrap"><table class="ft" style="min-width:0"><colgroup><col><col style="width:105px"><col style="width:45px"></colgroup><thead><tr><th class="tl">Página</th><th>${f === "i" ? "Impresiones" : "Clics"}</th><th>Pos.</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  function opportunities() {
    const st = S.striking.map((q) => `<tr><td class="tl">${esc(q.q)}</td><td>${fP(q.pos)}</td><td>${fN(q.i)}</td><td>${fN(q.c)}</td></tr>`).join("");
    const lc = S.lowCtr.map((p) => `<tr><td class="tl">${link(p.p)}</td><td>${fP(p.pos)}</td><td>${fN(p.i)}</td><td>${fP(p.ctr)}%</td></tr>`).join("");
    const nq = S.newQueries.map((q) => `<tr><td class="tl">${esc(q.q)}</td><td>${fP(q.pos)}</td><td>${fN(q.i)}</td></tr>`).join("");
    const cb = S.cannib.map((c) => `<tr><td class="tl">${esc(c.q)}</td><td>${fN(c.i)}</td><td class="tl" style="white-space:normal">${c.pages.map((p) => `${link(p.p)} <span style="color:#9CA3AF">(${fN(p.i)} impr., pos. ${fP(p.pos)})</span>`).join("<br>")}</td></tr>`).join("");
    return `<div class="section"><div class="section-title">Oportunidades</div><div class="grid-2">
      <div class="card"><div class="card-title">Al borde del top: posición 4 a 15 con impresiones</div><div class="ft-wrap"><table class="ft" style="min-width:0"><colgroup><col><col style="width:50px"><col style="width:55px"><col style="width:45px"></colgroup><thead><tr><th class="tl">Consulta</th><th>Pos.</th><th>Impr.</th><th>Clics</th></tr></thead><tbody>${st}</tbody></table></div></div>
      <div class="card"><div class="card-title">Se ven pero no se clickean: CTR bajo 1% en el top 15</div><div class="ft-wrap"><table class="ft" style="min-width:0"><colgroup><col><col style="width:50px"><col style="width:60px"><col style="width:50px"></colgroup><thead><tr><th class="tl">Página</th><th>Pos.</th><th>Impr.</th><th>CTR</th></tr></thead><tbody>${lc}</tbody></table></div></div>
      <div class="card"><div class="card-title">Consultas nuevas esta semana</div><div class="ft-wrap"><table class="ft" style="min-width:0"><colgroup><col><col style="width:50px"><col style="width:55px"></colgroup><thead><tr><th class="tl">Consulta</th><th>Pos.</th><th>Impr.</th></tr></thead><tbody>${nq}</tbody></table></div></div>
      <div class="card"><div class="card-title">Canibalización: una consulta, varias páginas</div><div class="ft-wrap"><table class="ft" style="min-width:0"><colgroup><col style="width:34%"><col style="width:55px"><col></colgroup><thead><tr><th class="tl">Consulta</th><th>Impr.</th><th class="tl">Páginas que compiten</th></tr></thead><tbody>${cb}</tbody></table></div></div>
    </div></div>`;
  }

  function indexing() {
    const I = S.index; if (!I) return "";
    const ia = I.hist.at(-1);
    const st = Object.entries(I.states).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="pill ${/indexed/i.test(k) && !/not/i.test(k) ? "pill-sa" : "pill-eu"}" style="margin:0 4px 4px 0">${esc(k)}: ${v}</span>`).join("");
    const sec = Object.entries(I.bySec).sort((a, b) => b[1].total - a[1].total).map(([k, v]) => `<tr><td class="tl">${esc(S.labels.pageGroups[k] || k)}</td><td>${v.ok}</td><td>${v.total}</td><td>${Math.round((100 * v.ok) / v.total)}%</td></tr>`).join("");
    const hist = I.hist.map((h) => `${dm(h.date)}: <b>${h.ok}</b>/${h.total}`).join(" · ");
    const ni = I.notIndexed.map((x) => `<tr><td class="tl">${link(x.p)}</td><td class="tl">${esc(x.c)}</td><td>${x.last ? dm(x.last) : "nunca"}</td><td class="tl">${x.canon ? esc(x.canon) : ""}</td></tr>`).join("");
    return `<div class="section"><div class="section-title">Indexación · inspección de todas las URLs del sitemap (${dm(I.date)})</div>
      <div class="info-box info-blue">${hist}${I.gained.length ? ` · <b>${I.gained.length} nuevas indexadas</b> desde la foto anterior` : ""}${I.lost.length ? ` · <b style="color:#DC2626">${I.lost.length} se desindexaron</b>: ${I.lost.map((x) => esc(x.p)).join(", ")}` : ""}</div>
      <div style="margin-bottom:8px">${st}</div>
      <div class="grid-2"><div class="card"><div class="card-title">Por sección</div><table class="ft" style="min-width:0"><thead><tr><th class="tl">Sección</th><th>Indexadas</th><th>URLs</th><th>%</th></tr></thead><tbody>${sec}</tbody></table>
        <div class="info-box info-gray" style="margin-top:8px">${I.indexedNoImpr.length} URLs indexadas no tuvieron ni una impresión en 4 semanas.</div></div>
      <div class="card"><div class="card-title">Sin indexar (${I.notIndexed.length})</div><div class="ft-wrap" style="max-height:340px;overflow-y:auto"><table class="ft" style="min-width:0"><colgroup><col><col style="width:150px"><col style="width:60px"><col style="width:90px"></colgroup><thead><tr><th class="tl">URL</th><th class="tl">Estado</th><th>Rastreo</th><th class="tl">Canónica</th></tr></thead><tbody>${ni}</tbody></table></div></div></div></div>`;
  }

  function ga4() {
    const G = S.ga4; if (!G || G.error) return G?.error ? `<div class="err">GA4: ${esc(G.error)}</div>` : "";
    const rows = Object.entries(G.bySec).sort((a, b) => b[1].reduce((t, x) => t + x.e, 0) - a[1].reduce((t, x) => t + x.e, 0)).map(([k, v]) => {
      const s4 = v.slice(-4).reduce((t, x) => t + x.s, 0), e4 = v.slice(-4).reduce((t, x) => t + x.e, 0);
      return `<tr><td class="tl"><b>${esc(S.labels.pageGroups[k] || k)}</b></td>${v.map((x) => `<td>${x.s}<span style="color:#059669"> · ${x.e}</span></td>`).join("")}<td>${s4}</td><td><b>${e4}</b></td><td>${s4 ? fP(Math.round((e4 / s4) * 100) / 100) : "–"}</td></tr>`;
    }).join("");
    const tot = `<tr class="hi"><td class="tl">Total orgánico</td>${G.total.map((x) => `<td>${x.s}<span> · ${x.e}</span></td>`).join("")}<td>${G.total.slice(-4).reduce((t, x) => t + x.s, 0)}</td><td>${G.total.slice(-4).reduce((t, x) => t + x.e, 0)}</td><td></td></tr>`;
    return `<div class="section"><div class="section-title">Lo que trae negocio · GA4, tráfico orgánico por sección</div>
      <div class="ft-wrap"><table class="ft" style="min-width:1000px"><colgroup><col style="width:200px">${G.weeks.map(() => "<col>").join("")}<col><col><col></colgroup>
      <thead><tr><th class="tl">Sección (página de entrada)</th>${G.weeks.map((w) => `<th>${dm(w)}</th>`).join("")}<th>Sesiones 4s</th><th>Eventos 4s</th><th>Ev./sesión</th></tr></thead><tbody>${rows}${tot}</tbody></table></div>
      <div class="info-box info-gray" style="margin-top:8px">Cada celda: sesiones orgánicas · <span style="color:#059669">eventos clave</span> (clic en reservar o en WhatsApp). Es la señal de intención: los clics de Search Console miden visitas, esto mide quién quiso comprar.</div></div>`;
  }

  function render() {
    const L = S.labels, n = S.weeks.length;
    const vis = S.visible.slice(-4).reduce((t, x) => t + x.c, 0), tot = S.total.slice(-4).reduce((t, x) => t + x.c, 0);
    $("seo").innerHTML = kpis() + chart()
      + weekTable("sec", "Secciones del sitio · semana a semana", rowsOf(S.pageGroups, L.pageGroups), "Clasificación por URL: ve el 100% de los clics.")
      + weekTable("kw", "Grupos de keywords · semana a semana", rowsOf(S.kwGroups, L.kwGroups), `Clasificación por consulta. Google oculta las consultas de poco volumen: en las últimas 4 semanas solo ${vis} de ${tot} clics (${Math.round((100 * vis) / tot)}%) traen la consulta visible. Para clics usar la tabla de secciones; esta sirve para impresiones y posición.`)
      + weekTable("cor", "Corredores · páginas de traslado, taxi y servicios", rowsOf(S.corridors, L.corridors))
      + weekTable("lang", "Idiomas", rowsOf(S.langs, { EN: "Inglés", ES: "Español", PT: "Portugués" }))
      + ga4()
      + `<div class="section"><div class="section-title">Ganadores y perdedores · 4 semanas contra las 4 anteriores</div><div class="grid-2">${moversP("Páginas que más clics ganaron", S.pageWinners, "c")}${moversP("Páginas que más clics perdieron", S.pageLosers, "c")}${moversQ("Keywords que más subieron de posición", S.queryWinners)}${moversQ("Keywords que más cayeron", S.queryLosers)}${moversP("Páginas que más impresiones ganaron", S.pageImprUp, "i")}${moversP("Páginas que más impresiones perdieron", S.pageImprDown, "i")}</div></div>`
      + pagesTable() + queriesTable() + opportunities() + indexing()
      + `<div class="section"><div class="section-title">Países · 4 semanas</div><div class="ft-wrap"><table class="ft" style="min-width:0"><thead><tr><th class="tl">País</th><th>Clics</th><th>Δ</th><th>Impr.</th><th>Δ</th><th>Pos.</th></tr></thead><tbody>${S.countries.map((c) => `<tr><td class="tl">${c.k.toUpperCase()}</td><td>${fN(c.c)}</td><td>${delta(c.c, c.cPrev)}</td><td>${fN(c.i)}</td><td>${delta(c.i, c.iPrev)}</td><td>${fP(c.pos)}</td></tr>`).join("")}</tbody></table></div>
        <div class="info-box info-gray" style="margin-top:8px">Dispositivos: ${S.devices.map((d) => `${d.k.toLowerCase()} ${fN(d.c)} clics (CTR ${fP(d.ctr)}%)`).join(" · ")}</div></div>`
      + `<div class="info-box info-gray">Se actualiza todos los días. Cada columna es un bloque de 7 días (la fecha es el primer día) y el último termina en el día más reciente que Search Console ya cerró, que va 2 o 3 días atrás de hoy. Datos al ${new Date(S.generated).toLocaleString("es")}.</div>`;
    document.querySelectorAll("[data-seo-metric]").forEach((b) => b.addEventListener("click", () => { const [id, m] = b.dataset.seoMetric.split(":"); state.metric[id] = m; const y = window.scrollY; render(); window.scrollTo(0, y); }));
  }

  async function init() {
    const el = $("seo"); if (!el) return;
    try {
      const r = await fetch("seo.json?t=" + Date.now()); if (!r.ok) throw new Error("HTTP " + r.status);
      S = await r.json(); render();
    } catch (e) { el.innerHTML = `<div class="err">No pude cargar seo.json. ${esc(e.message)}</div>`; }
  }
  document.addEventListener("DOMContentLoaded", init);
})();
