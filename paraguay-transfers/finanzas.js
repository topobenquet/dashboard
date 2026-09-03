/* Paraguay Transfers — pestaña FINANZAS
 * Lee finanzas.json (lo genera brain/finanzas-update.mjs) y pinta en #fin.
 * Es independiente del dashboard operativo: si esto falla, lo otro sigue vivo.
 * Sin librerías: los gráficos son SVG inline, igual que en index.html.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const f$ = (n) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
  const fGs = (n) => "₲" + Math.round(n).toLocaleString("es-PY");
  const fp = (n) => (n * 100).toFixed(1) + "%";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const dLbl = (iso) => { const d = new Date(iso + "T12:00:00"); return `${DOW[d.getDay()]} ${iso.slice(8, 10)}`; };
  const kpi = (label, val, sub, cls) => `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value${cls ? " " + cls : ""}">${val}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ""}</div>`;
  const chip = (estado) => estado === "falta" ? '<span class="pill pill-eu">falta</span>' : estado === "estimado" ? '<span class="pill pill-ot">estimado</span>' : "";

  let F = null;

  /* ── KPIs de hoy ── */
  function kpisHoy() {
    const s = F.saldos, tc = F.tc;
    const cajaPY = (s.itauGs + s.uenoGs) / tc;
    const stripe = (s.stripeDisponible || 0) + (s.stripePendiente || 0);
    const p = F.pnl[F.pnl.length - 1];
    return `<div class="section"><div class="section-title">Caja hoy · ${esc(s.fecha)}</div>
      <div class="kpi-row kpi-row-5">
        ${kpi("En bancos de Paraguay", f$(cajaPY), `Itaú ${fGs(s.itauGs)} · ueno ${fGs(s.uenoGs)}`, cajaPY < 500 ? "neg" : "")}
        ${kpi("Pagopar sin acreditar", f$(s.pagoparPendienteUsd), `${fGs(F.pagopar.pendienteGs)} · liquida ${esc(F.pagopar.liquida)}`)}
        ${kpi("Dormido en Stripe", f$(stripe), `${f$(s.stripeDisponible)} disponible · ${f$(s.stripePendiente)} pendiente`)}
        ${kpi(`Resultado ${esc(p.mesLabel)}`, f$(p.resultado), `${fp(p.resultado / p.ingresos.total)} sobre ingresos`, p.resultado >= 0 ? "pos" : "neg")}
        ${kpi(`Margen bruto ${esc(p.mesLabel)}`, fp(p.margenBruto / p.ingresos.total), `${f$(p.margenBruto)} sobre ${f$(p.ingresos.total)}`)}
      </div></div>`;
  }

  /* ── Gráfico diario: barras entradas/salidas + línea acumulado ── */
  function chartCaja() {
    const D = F.caja; if (!D.length) return '<div class="chart-empty">Sin movimientos.</div>';
    const W = 900, H = 260, L = 46, R = 46, T = 14, B = 30;
    const iw = W - L - R, ih = H - T - B;
    const maxBar = Math.max(...D.map((d) => Math.max(d.in, d.out)), 1);
    const acumMax = Math.max(...D.map((d) => d.acum), 1), acumMin = Math.min(...D.map((d) => d.acum), 0);
    const yBar = (v) => T + ih - (v / maxBar) * ih;
    const yAc = (v) => T + ih - ((v - acumMin) / (acumMax - acumMin || 1)) * ih;
    const slot = iw / D.length, bw = Math.max(3, slot * 0.32);
    let bars = "", line = "", pts = "", xlab = "";
    D.forEach((d, i) => {
      const x = L + i * slot + slot / 2;
      bars += `<rect x="${(x - bw - 1).toFixed(1)}" y="${yBar(d.in).toFixed(1)}" width="${bw.toFixed(1)}" height="${(T + ih - yBar(d.in)).toFixed(1)}" fill="#10B981" rx="1.5"><title>${dLbl(d.fecha)} · entradas ${f$(d.in)}</title></rect>`;
      bars += `<rect x="${(x + 1).toFixed(1)}" y="${yBar(d.out).toFixed(1)}" width="${bw.toFixed(1)}" height="${(T + ih - yBar(d.out)).toFixed(1)}" fill="#DC2626" rx="1.5"><title>${dLbl(d.fecha)} · salidas ${f$(d.out)}</title></rect>`;
      line += (i ? " L" : "M") + `${x.toFixed(1)} ${yAc(d.acum).toFixed(1)}`;
      pts += `<circle cx="${x.toFixed(1)}" cy="${yAc(d.acum).toFixed(1)}" r="3" fill="#fff" stroke="#1F4E78" stroke-width="2"><title>${dLbl(d.fecha)} · acumulado ${f$(d.acum)} · neto del día ${f$(d.neto)} · ${d.n} mov.</title></circle>`;
      if (i % Math.ceil(D.length / 14) === 0 || i === D.length - 1) xlab += `<text x="${x.toFixed(1)}" y="${H - 8}" font-size="9.5" fill="#6B7280" text-anchor="middle">${d.fecha.slice(8, 10)}/${d.fecha.slice(5, 7)}</text>`;
    });
    let grid = "";
    for (let k = 0; k <= 4; k++) {
      const v = (maxBar / 4) * k, y = yBar(v);
      grid += `<line x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#F3F4F6"/><text x="${L - 6}" y="${(y + 3).toFixed(1)}" font-size="9" fill="#9CA3AF" text-anchor="end">${f$(v)}</text>`;
      const va = acumMin + ((acumMax - acumMin) / 4) * k;
      grid += `<text x="${W - R + 6}" y="${(yAc(va) + 3).toFixed(1)}" font-size="9" fill="#1F4E78" text-anchor="start">${f$(va)}</text>`;
    }
    const zero = yAc(0);
    const zeroLine = acumMin < 0 ? `<line x1="${L}" x2="${W - R}" y1="${zero.toFixed(1)}" y2="${zero.toFixed(1)}" stroke="#9CA3AF" stroke-dasharray="3 3"/>` : "";
    return `<div class="chart-card">
      <div class="chart-legend">
        <span class="mbtn" aria-pressed="true" style="background:#10B981"><span class="dotc"></span>Entradas</span>
        <span class="mbtn" aria-pressed="true" style="background:#DC2626"><span class="dotc"></span>Salidas</span>
        <span class="mbtn" aria-pressed="true" style="background:#1F4E78"><span class="dotc"></span>Acumulado del mes</span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:260px">${grid}${zeroLine}${bars}<path d="${line}" fill="none" stroke="#1F4E78" stroke-width="2"/>${pts}${xlab}</svg>
      <div class="chart-hint">Barras: eje izquierdo, dólares del día. Línea: eje derecho, cuánto quedó acumulado desde el 1. Pasá el mouse para el detalle.</div></div>`;
  }

  function tablaCaja() {
    const rows = F.caja.map((d) => {
      const fuentes = Object.entries(d.porFuente || {}).map(([k, v]) => `${esc(k)} ${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))}`).join(" · ");
      return `<tr><td>${dLbl(d.fecha)}</td><td class="pos">${d.in ? f$(d.in) : "–"}</td><td class="neg">${d.out ? f$(d.out) : "–"}</td>
        <td class="${d.neto >= 0 ? "pos" : "neg"}">${f$(d.neto)}</td><td><strong>${f$(d.acum)}</strong></td><td>${d.n}</td><td class="tl" style="white-space:normal;font-size:10px;color:#6B7280">${fuentes}</td></tr>`;
    }).join("");
    const ti = F.caja.reduce((s, d) => s + d.in, 0), to = F.caja.reduce((s, d) => s + d.out, 0);
    return `<div class="ft-wrap"><table class="ft nowrap1" style="min-width:640px;">
      <colgroup><col style="width:9%"><col style="width:11%"><col style="width:11%"><col style="width:11%"><col style="width:12%"><col style="width:6%"><col style="width:40%"></colgroup>
      <thead><tr><th>Día</th><th>Entradas</th><th>Salidas</th><th>Neto</th><th>Acumulado</th><th>Mov.</th><th class="tl">Por fuente</th></tr></thead>
      <tbody>${rows}<tr class="hi"><td>${esc(F.mesLabel)}</td><td class="pos">${f$(ti)}</td><td class="neg">${f$(to)}</td><td>${f$(ti - to)}</td><td>${f$(ti - to)}</td><td>${F.movimientos.length}</td><td></td></tr></tbody></table></div>`;
  }

  /* ── Pagopar ── */
  function pagoparPanel() {
    const P = F.pagopar;
    const rows = P.diario.map((d) => `<tr><td>${dLbl(d.fecha)}</td><td>${d.cobros}</td><td>${fGs(d.gs)}</td><td>${f$(d.usd)}</td></tr>`).join("");
    const acr = P.acreditaciones.map((a) => `<tr><td>${dLbl(a.fecha)}</td><td>${fGs(a.gs)}</td><td>${f$(a.usd)}</td><td class="tl" style="white-space:normal">${esc(a.nota || "")}</td></tr>`).join("") || `<tr><td colspan="4" class="tl neu">Todavía no hubo acreditaciones.</td></tr>`;
    const com = P.comision == null ? '<span class="neu">se mide en la primera liquidación completa</span>' : fp(P.comision);
    return `<div class="section"><div class="section-title">Pagopar · cobrado vs acreditado</div>
      <div class="kpi-row kpi-row-4">
        ${kpi("Cobrado en el mes", fGs(P.cobradoGs), f$(P.cobradoUsd) + " · " + P.diario.reduce((s, d) => s + d.cobros, 0) + " cobros")}
        ${kpi("Acreditado en ueno", fGs(P.acreditadoGs), P.acreditaciones.length + " liquidación" + (P.acreditaciones.length === 1 ? "" : "es"))}
        ${kpi("Pendiente de liquidar", fGs(P.pendienteGs), f$(P.pendienteUsd) + " · liquida " + esc(P.liquida), "neg")}
        ${kpi("Comisión real", com, P.pruebasExcluidas ? P.pruebasExcluidas + " cobros de prueba excluidos" : "")}
      </div>
      <div class="grid-2">
        <div class="card"><div class="card-title">Cobros por día</div><div class="ft-wrap"><table class="ft nowrap1" style="min-width:0"><thead><tr><th>Día</th><th>Cobros</th><th>Guaraníes</th><th>USD</th></tr></thead><tbody>${rows}</tbody></table></div></div>
        <div class="card"><div class="card-title">Acreditaciones en ueno</div><div class="ft-wrap"><table class="ft nowrap1" style="min-width:0"><thead><tr><th>Día</th><th>Guaraníes</th><th>USD</th><th class="tl">Nota</th></tr></thead><tbody>${acr}</tbody></table></div>
          <div class="info-box info-gray" style="margin-top:10px;margin-bottom:0">La diferencia entre cobrado y acreditado, una vez liquidado todo, es la comisión de Pagopar. Se calcula sola cuando cierre la primera tanda.</div></div>
      </div></div>`;
  }

  /* ── P&L ── */
  function pnlTabla() {
    const P = F.pnl, cur = P[P.length - 1];
    const cols = P.map((p) => `<th>${esc(p.mesLabel)}</th>`).join("") + "<th>% ingr.</th>";
    const pct = (v) => cur.ingresos.total ? fp(v / cur.ingresos.total) : "–";
    const row = (label, get, opts = {}) => {
      const cells = P.map((p) => { const v = get(p); return `<td class="${opts.cls || ""}">${v == null ? '<span class="neu">–</span>' : f$(v)}</td>`; }).join("");
      const v = get(cur);
      return `<tr class="${opts.hi ? "hi" : ""}"><td class="tl" style="${opts.indent ? "padding-left:18px" : ""}">${label}${opts.estado ? " " + chip(opts.estado) : ""}</td>${cells}<td>${v == null ? "–" : pct(v)}</td></tr>`;
    };
    const grp = (t) => `<tr><td class="tl" colspan="${P.length + 2}" style="background:#F9FAFB;font-size:9.5px;letter-spacing:.5px;text-transform:uppercase;color:#6B7280;padding:5px">${t}</td></tr>`;
    const e = cur.estado || {};
    return `<div class="section"><div class="section-title">Estado de resultados · devengado, por mes de salida del traslado</div>
      <div class="ft-wrap"><table class="ft" style="min-width:520px">
      <thead><tr><th class="tl">Concepto</th>${cols}</tr></thead><tbody>
      ${grp("Ingresos")}
      ${row("Traslados operados (planilla)", (p) => p.ingresos.planilla, { indent: 1 })}
      ${row("Cobros de Aloha sin fila", (p) => p.ingresos.alohaSinFila, { indent: 1 })}
      ${row("Total ingresos", (p) => p.ingresos.total, { hi: 1 })}
      ${grp("Costos directos")}
      ${row("Pago a choferes", (p) => p.directos.chofer, { indent: 1 })}
      ${row("Combustible", (p) => p.directos.combustible, { indent: 1 })}
      ${row("Peajes", (p) => p.directos.peajes, { indent: 1 })}
      ${row("Viáticos", (p) => p.directos.viaticos, { indent: 1 })}
      ${row("Otros y reembolsos", (p) => p.directos.otros, { indent: 1 })}
      ${row("Total costo directo", (p) => p.directos.total, { hi: 1 })}
      ${row("Margen bruto", (p) => p.margenBruto, { hi: 1, cls: "pos" })}
      ${grp("Costo de cobrar")}
      ${row("Stripe", (p) => p.cobro.stripe, { indent: 1 })}
      ${row("Aloha, comisión más spread", (p) => p.cobro.aloha, { indent: 1 })}
      ${row("Pagopar", (p) => p.cobro.pagopar, { indent: 1, estado: e.pagopar })}
      ${grp("Estructura y financiero")}
      ${row("Seguro de la H1 (1/12)", (p) => p.estructura.seguro, { indent: 1 })}
      ${row("Multa de banco por saldo mínimo", (p) => p.estructura.multaBanco, { indent: 1 })}
      ${row("Interés del préstamo de la H1", (p) => p.estructura.interesPrestamo, { indent: 1, estado: e.interesPrestamo })}
      ${row("Depreciación de la H1", (p) => p.estructura.depreciacion, { indent: 1, estado: e.depreciacion })}
      ${grp("Marketing")}
      ${row("Google Ads", (p) => p.marketing.google, { indent: 1 })}
      ${row("Meta Ads", (p) => p.marketing.meta, { indent: 1 })}
      ${grp("Impuestos")}
      ${row("IVA e IRE", (p) => p.impuestos, { indent: 1, estado: e.impuestos })}
      ${row("Resultado operativo", (p) => p.resultado, { hi: 1, cls: "pos" })}
      </tbody></table></div>
      <div class="info-box info-gray" style="margin-top:8px">Devengado: cada traslado cuenta en el mes en que <strong>sale</strong>, no en el que se cobra. La cuota completa del préstamo no es gasto: solo el interés; el capital cancela deuda.</div></div>`;
  }

  /* ── Rieles de cobro ── */
  function rielesTabla() {
    const rows = F.rieles.map((r) => `<tr><td class="tl"><strong>${esc(r.riel)}</strong></td><td>${r.cobros}</td><td>${f$(r.bruto)}</td>
      <td>${r.comision == null ? "–" : f$(r.comision)}</td><td class="${r.pct == null ? "neu" : r.pct > 5 ? "neg" : r.pct > 4 ? "" : "pos"}">${r.pct == null ? "–" : r.pct.toFixed(2) + "%"}</td>
      <td class="tl" style="white-space:normal;font-size:10.5px;color:#6B7280">${esc(r.nota || "")}</td></tr>`).join("");
    const inst = F.giros.filter((g) => g.tipo === "instant"), feeTot = inst.reduce((s, g) => s + g.fee, 0), montoInst = inst.reduce((s, g) => s + g.monto, 0);
    return `<div class="section"><div class="section-title">Rieles de cobro · qué cuesta cobrar por cada uno</div>
      <div class="ft-wrap"><table class="ft" style="min-width:560px"><colgroup><col style="width:11%"><col style="width:8%"><col style="width:12%"><col style="width:12%"><col style="width:10%"><col style="width:47%"></colgroup>
      <thead><tr><th class="tl">Riel</th><th>Cobros</th><th>Bruto</th><th>Comisión</th><th>% real</th><th class="tl">Nota</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="info-box ${feeTot > 0 ? "info-amber" : "info-green"}" style="margin-top:8px">Giros desde Stripe: ${F.giros.length} desde mayo, ${inst.length} instantáneos a tarjeta por ${f$(montoInst)} que costaron <strong>${f$(feeTot)}</strong> (1,5%). Los giros estándar son gratis y tardan dos días.</div></div>`;
  }


  /* ── Log de movimientos: cada entrada y cada salida, ítem por ítem ── */
  function logMovimientos() {
    const M = (F.movimientos || []).slice().sort((a, b) => a.d.localeCompare(b.d) || (a.t === b.t ? 0 : a.t === "in" ? -1 : 1));
    if (!M.length) return "";
    const fuentes = [...new Set(M.map((m) => m.fuente))].sort();
    const btn = (id, lbl, on) => `<button class="mbtn" data-f="${esc(id)}" aria-pressed="${on}" style="${on ? "background:#1F4E78" : ""}">${esc(lbl)}</button>`;
    const filtros = `<div class="chart-legend" id="log-filtros">${btn("*", "Todo", true)}${btn("in", "Solo entradas", false)}${btn("out", "Solo salidas", false)}<span style="width:8px"></span>${fuentes.map((f) => btn("src:" + f, f, false)).join("")}</div>`;
    let rows = "", dia = "", acum = 0;
    for (const m of M) {
      if (m.d !== dia) { dia = m.d; const tot = M.filter((x) => x.d === dia); const ti = tot.filter((x) => x.t === "in").reduce((s, x) => s + x.usd, 0), to = tot.filter((x) => x.t === "out").reduce((s, x) => s + x.usd, 0);
        rows += `<tr class="log-dia" data-d="${dia}"><td class="tl" colspan="2"><strong>${dLbl(dia)}</strong></td><td class="pos">${ti ? f$(ti) : "–"}</td><td class="neg">${to ? f$(to) : "–"}</td><td colspan="2" class="tl" style="color:#6B7280">${tot.length} mov. · neto <strong class="${ti - to >= 0 ? "pos" : "neg"}">${f$(ti - to)}</strong></td></tr>`; }
      acum += m.t === "in" ? m.usd : -m.usd;
      rows += `<tr class="log-row" data-t="${m.t}" data-src="${esc(m.fuente)}" data-d="${m.d}"><td>${m.d.slice(8)}/${m.d.slice(5, 7)}</td><td><span class="pill ${m.t === "in" ? "pill-sa" : "pill-eu"}">${m.t === "in" ? "entra" : "sale"}</span></td>
        <td class="pos">${m.t === "in" ? f$(m.usd) : ""}</td><td class="neg">${m.t === "out" ? f$(m.usd) : ""}</td>
        <td class="tl" style="white-space:normal"><strong>${esc(m.fuente)}</strong>${m.gs ? ` <span style="color:#9CA3AF;font-size:10px">${fGs(m.gs)}</span>` : ""}</td>
        <td class="tl" style="white-space:normal;color:#374151">${esc(m.det || "")}</td></tr>`;
    }
    const ti = M.filter((x) => x.t === "in").reduce((s, x) => s + x.usd, 0), to = M.filter((x) => x.t === "out").reduce((s, x) => s + x.usd, 0);
    return `<div class="section"><div class="section-title">Movimientos · ${esc(F.mesLabel)} · ítem por ítem</div>
      ${filtros}
      <div class="ft-wrap"><table class="ft nowrap1" id="log-tabla" style="min-width:720px">
        <colgroup><col style="width:7%"><col style="width:7%"><col style="width:10%"><col style="width:10%"><col style="width:22%"><col style="width:44%"></colgroup>
        <thead><tr><th>Día</th><th></th><th>Entra</th><th>Sale</th><th class="tl">Fuente</th><th class="tl">Concepto</th></tr></thead>
        <tbody>${rows}<tr class="hi"><td colspan="2">${esc(F.mesLabel)}</td><td class="pos">${f$(ti)}</td><td class="neg">${f$(to)}</td><td colspan="2" class="tl">${M.length} movimientos · neto <strong>${f$(ti - to)}</strong></td></tr></tbody></table></div>
      <div class="info-box info-gray" style="margin-top:8px">Cada cobro aparece el día que el cliente pagó, con su riel y cliente. Cada salida trae de dónde se leyó (extracto del banco o el grupo de WhatsApp) y el monto original en guaraníes. Los traspasos entre cuentas propias no están.</div></div>`;
  }
  function activarLog() {
    const box = $("log-filtros"), tabla = $("log-tabla"); if (!box || !tabla) return;
    let tipo = "*", src = null;
    const apply = () => {
      tabla.querySelectorAll("tr.log-row").forEach((tr) => { tr.hidden = !((tipo === "*" || tr.dataset.t === tipo) && (!src || tr.dataset.src === src)); });
      tabla.querySelectorAll("tr.log-dia").forEach((tr) => { const d = tr.dataset.d; tr.hidden = ![...tabla.querySelectorAll(`tr.log-row[data-d="${d}"]`)].some((r) => !r.hidden); });
      box.querySelectorAll(".mbtn").forEach((b) => { const f = b.dataset.f, on = f === "*" ? (tipo === "*" && !src) : f.startsWith("src:") ? src === f.slice(4) : tipo === f; b.setAttribute("aria-pressed", String(on)); b.style.background = on ? "#1F4E78" : ""; });
    };
    box.addEventListener("click", (e) => { const b = e.target.closest(".mbtn"); if (!b) return; const f = b.dataset.f;
      if (f === "*") { tipo = "*"; src = null; } else if (f.startsWith("src:")) { src = src === f.slice(4) ? null : f.slice(4); } else { tipo = tipo === f ? "*" : f; } apply(); });
  }

  function alertas() {
    if (!F.alertas?.length) return "";
    return `<div class="section">${F.alertas.map((a) => `<div class="info-box ${a.nivel === "crit" ? "info-amber" : "info-blue"}" style="margin-bottom:6px">${a.nivel === "crit" ? "⚠️" : "•"} ${esc(a.texto)}</div>`).join("")}</div>`;
  }

  function render() {
    const fin = $("fin");
    fin.innerHTML = kpisHoy() + alertas()
      + `<div class="section"><div class="section-title">Libro de caja · ${esc(F.mesLabel)} · entradas y salidas día a día</div>${chartCaja()}${tablaCaja()}
         <div class="info-box info-gray" style="margin-top:8px">Todas las fuentes en una sola moneda (USD a ${F.tc.toLocaleString("es-PY")} ₲/USD, ${esc(F.fuenteTc)}). Las transferencias entre cuentas propias no cuentan. La publicidad se paga con una tarjeta fuera de este circuito y no aparece acá, sí en el P&amp;L.</div></div>`
      + logMovimientos() + pagoparPanel() + pnlTabla() + rielesTabla();
    activarLog();   // después del innerHTML, si no los listeners se pierden
  }

  async function init() {
    const fin = $("fin"); if (!fin) return;
    try {
      const r = await fetch("finanzas.json?t=" + Date.now()); if (!r.ok) throw new Error("HTTP " + r.status);
      F = await r.json(); render();
      const g = $("fin-updated"); if (g) g.textContent = "Finanzas al " + new Date(F.generated).toLocaleString("es");
    } catch (e) { fin.innerHTML = `<div class="err">No pude cargar finanzas.json. ${esc(e.message)}</div>`; }
  }

  /* ── Tabs ── */
  function setTab(name) {
    document.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === name)));
    $("root").hidden = name !== "ops"; $("fin").hidden = name !== "fin";
    try { localStorage.setItem("pt-tab", name); } catch {}
    if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
    let t = location.hash === "#fin" ? "fin" : location.hash === "#ops" ? "ops" : null;
    if (!t) { try { t = localStorage.getItem("pt-tab"); } catch {} }
    setTab(t === "fin" ? "fin" : "ops");
    init();
  });
})();
