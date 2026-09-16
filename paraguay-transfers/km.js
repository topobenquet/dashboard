/* Paraguay Transfers: pestaña KILOMETRAJE
 * Lee km.json (lo genera brain/kilometraje.mjs desde las fotos del tablero que los choferes mandan a sus grupos)
 * y pinta en #km. Independiente de las otras pestañas: si falla, lo demás sigue.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const fGs = (n) => (n == null ? "–" : "₲" + Math.round(n).toLocaleString("es-PY"));
  const fKm = (n) => (n == null ? "–" : Math.round(n).toLocaleString("es-PY") + " km");
  const fN = (n) => (n == null ? "–" : Math.round(n).toLocaleString("es-PY"));
  const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "–");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const kpi = (label, val, sub, cls) => `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value${cls ? " " + cls : ""}">${val}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ""}</div>`;
  const tanque = (t) => (t == null ? "" : ` <span style="color:#9CA3AF" title="nivel del tanque en la foto">${["E", "¼", "½", "¾", "F"][Math.round(t * 4)]}</span>`);
  let K = null;

  function kpis() {
    const h = K.vehiculos.H1, rH = K.resumen.H1, rV = K.resumen.Voxy;
    const fotos = K.cumplimiento.reduce((a, c) => a + c.lecturas, 0), conFoto = K.cumplimiento.reduce((a, c) => a + c.conFoto, 0);
    const pctFuera = rH.kmViajes + rH.kmFuera ? rH.kmFuera / (rH.kmViajes + rH.kmFuera) : 0;
    const mes = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][Number(K.mes.slice(5))];
    return `<div class="section"><div class="section-title">Flota propia · ${mes}</div>
      <div class="kpi-row kpi-row-5">
        ${kpi("H1: km en traslados", fKm(rH.kmViajes), `${rH.viajes} viajes · Alfredo, Gustavo y a veces Luis`)}
        ${kpi("H1: km fuera de traslado", fKm(rH.kmFuera), `${Math.round(pctFuera * 100)}% del total · entre un final y el siguiente inicio`, pctFuera > 0.1 ? "neg" : "")}
        ${kpi("Combustible por km (H1)", fGs(h.gsKm), `${fGs(h.precioL)}/L ÷ ${String(h.rend).replace(".", ",")} km/L`)}
        ${kpi("Voxy (Luis): km en traslados", fKm(rV.kmViajes), `${rV.viajes} viajes · ${fGs(K.vehiculos.Voxy.gsKm)}/km estimado`)}
        ${kpi("Lecturas con foto", fotos ? Math.round((conFoto / fotos) * 100) + "%" : "–", K.cumplimiento.map((c) => `${c.chofer} ${c.conFoto}/${c.lecturas}`).join(" · "), fotos && conFoto / fotos < 0.8 ? "neg" : "")}
      </div></div>`;
  }

  function alertas() {
    const A = (K.alertas || []).slice(0, 12);
    if (!A.length) return "";
    return `<div class="section"><div class="section-title">Para revisar</div>${A.map((a) => `<div class="info-box ${a.nivel === "grupo" ? "info-blue" : "info-amber"}" style="margin-bottom:6px">${a.nivel === "grupo" ? "📨" : "⚠️"} <b>${dm(a.fecha)}</b> ${esc(a.texto.replace(/^[📸🚐]\s*/u, ""))}</div>`).join("")}
      <div class="info-box info-gray" style="margin-top:8px">⚠️ solo para Juan: km sin traslado de más de ${K.reglas.huecoKm} km, desvío contra la ruta de más de ${Math.round(K.reglas.desvio * 100)}% (y más de ${K.reglas.desvioMinKm} km), combustible pagado ${Math.round(K.reglas.combustible * 100)}% por encima de lo que dan los km, o número escrito distinto de la foto. 📨 también le llega al chofer en su grupo: falta la foto, falta el km final o falta el km de un traslado. Los avisos arrancaron el ${new Date(K.activacion).toLocaleDateString("es")}; lo anterior queda acá, sin avisar.</div></div>`;
  }

  function viajes() {
    const rows = K.viajes.map((v) => {
      const des = v.desvio == null ? "–" : `<span style="color:${Math.abs(v.desvio) > K.reglas.desvio ? "#DC2626" : "#059669"}">${v.desvio > 0 ? "+" : ""}${Math.round(v.desvio * 100)}%</span>`;
      const comb = v.combustiblePagado && v.combustibleCorresponde ? `<span style="color:${v.combustiblePagado > v.combustibleCorresponde * (1 + K.reglas.combustible) ? "#DC2626" : "inherit"}">${fGs(v.combustiblePagado)}</span>` : fGs(v.combustiblePagado);
      const estado = v.abierto ? '<span class="pill pill-eu">en curso</span>' : v.faltanFotos.length ? `<span class="pill pill-eu" title="km sin foto: ${v.faltanFotos.join(", ")}">${v.faltanFotos.length} sin foto</span>` : '<span class="pill pill-sa">ok</span>';
      return `<tr><td>${dm(v.fechaIni)}${v.fechaFin !== v.fechaIni ? "–" + dm(v.fechaFin) : ""}</td><td class="tl">${v.vehiculo}</td><td class="tl">${esc(v.choferes.join(" / "))}</td>
        <td class="tl" title="${esc(v.traslados.join(" + "))}">${esc(v.traslados.join(" + ") || "sin traslado en planilla")}</td>
        <td>${fN(v.kmIni)}${tanque(v.tanqueIni)}</td><td>${v.kmFin == null ? "–" : fN(v.kmFin) + tanque(v.tanqueFin)}</td>
        <td><b>${fKm(v.km)}</b></td><td>${fKm(v.kmEsperado)}</td><td>${des}</td><td>${comb}</td><td>${fGs(v.combustibleCorresponde)}</td><td>${estado}</td></tr>`;
    }).join("");
    return `<div class="section"><div class="section-title">Viajes · km del tablero, inicio a final</div>
      <div class="ft-wrap"><table class="ft" style="min-width:980px;">
      <colgroup><col style="width:92px"><col style="width:42px"><col style="width:90px"><col><col style="width:78px"><col style="width:78px"><col style="width:70px"><col style="width:70px"><col style="width:55px"><col style="width:85px"><col style="width:85px"><col style="width:75px"></colgroup>
      <thead><tr><th>Fecha</th><th class="tl">Veh.</th><th class="tl">Chofer</th><th class="tl">Traslado (planilla)</th><th title="E ¼ ½ ¾ F = nivel del tanque en la foto">Km inicio ⛽</th><th title="E ¼ ½ ¾ F = nivel del tanque en la foto">Km final ⛽</th><th>Recorrido</th><th>Esperado</th><th>Desvío</th><th>Comb. pagado</th><th>Corresponde</th><th>Fotos</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <div class="info-box info-gray" style="margin-top:8px">"Esperado" = km de ida de la ruta × 2 (el chofer vuelve). "Corresponde" = km recorridos × ₲/km del vehículo. El combustible pagado sale del desglose de las transferencias de Majo ("combustible 800.000"); un pago que menciona dos viajes va al más largo. Rutas sin km cargado (vehículo a disposición, tours) no tienen esperado: se editan en <code>brain/km-rutas.json</code>.</div></div>`;
  }

  function huecos() {
    const H = K.huecos.filter((h) => h.km > 0);
    if (!H.length) return "";
    const rows = H.map((h) => `<tr${h.km > K.reglas.huecoKm ? ' style="background:#FEF2F2"' : ""}><td>${dm(h.fechaDesde)}${h.fechaHasta !== h.fechaDesde ? "–" + dm(h.fechaHasta) : ""}</td><td class="tl">${h.vehiculo}</td><td class="tl">${esc(h.choferes.join(" / "))}</td><td>${fN(h.desde)}</td><td>${fN(h.hasta)}</td><td><b>${fKm(h.km)}</b></td><td class="tl">${h.sinFinal ? "no hubo km final" : ""}</td></tr>`).join("");
    return `<div class="section"><div class="section-title">Km fuera de traslado · del final de un viaje al inicio del siguiente</div>
      <div class="ft-wrap"><table class="ft nowrap1" style="min-width:560px;">
      <thead><tr><th>Fechas</th><th class="tl">Veh.</th><th class="tl">Chofer</th><th>Desde km</th><th>Hasta km</th><th>Km</th><th class="tl">Nota</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
  }

  function combustible() {
    const cv = (k) => { const v = K.vehiculos[k]; return `<b>${k}</b> (${esc(v.combustible)}): ${fGs(v.precioL)}/L <span style="color:#9CA3AF">(${esc(v.precioFuente)})</span> ÷ ${String(v.rend).replace(".", ",")} km/L <span style="color:#9CA3AF">(${esc(v.rendFuente)})</span> = <b>${fGs(v.gsKm)}/km</b>. Último km: ${fN(v.ultimoKm)}.`; };
    const rows = K.cargas.map((c) => `<tr><td>${dm(c.fecha)}</td><td class="tl">${c.vehiculo}</td><td class="tl">${esc(c.grupo)}</td><td>${fN(c.odo)}</td><td>${c.litros ? String(c.litros).replace(".", ",") : "–"}</td><td>${fGs(c.gs)}</td><td>${fGs(c.precioL)}</td></tr>`).join("");
    const tramos = [...K.vehiculos.H1.tramos, ...K.vehiculos.Voxy.tramos];
    return `<div class="section"><div class="section-title">Combustible · cuánto cuesta el km</div>
      <div class="info-box info-blue" style="margin-bottom:8px">${cv("H1")}<br>${cv("Voxy")}</div>
      ${tramos.length ? `<div class="info-box info-gray" style="margin-bottom:8px">Rendimiento medido: ${tramos.map((t) => `${fN(t.desde)} → ${fN(t.hasta)}: ${fKm(t.km)} con ${String(t.litros).replace(".", ",")} L = ${String(t.rend).replace(".", ",")} km/L`).join(" · ")}</div>` : ""}
      ${rows ? `<div class="ft-wrap"><table class="ft nowrap1" style="min-width:520px;"><thead><tr><th>Fecha</th><th class="tl">Veh.</th><th class="tl">Grupo</th><th>Km</th><th>Litros</th><th>Monto</th><th>₲/L</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}
      <div class="info-box info-gray" style="margin-top:8px">El rendimiento se mide solo de tanque lleno a tanque lleno: km entre las dos cargas "lleno" ÷ litros cargados en el medio. Para eso el chofer tiene que escribir "lleno" y mandar la factura con los litros. Hasta que haya dos llenos seguidos se usa un estimado (H1 10 km/L, Voxy 9 km/L). Las cargas en Brasil o Argentina cuentan para los km, no para el precio.</div></div>`;
  }

  function proximos() {
    const P = K.proximos || [];
    if (!P.length) return "";
    const rows = P.map((p) => `<tr><td>${dm(p.fecha)}</td><td class="tl">${esc(p.chofer)}</td><td class="tl">${p.vehiculo}</td><td class="tl">${esc(p.ruta)}</td><td>${fKm(p.km)}</td><td><b>${p.adelanto ? fGs(p.adelanto) : "a definir"}</b></td></tr>`).join("");
    return `<div class="section"><div class="section-title">Próximos traslados · combustible a adelantar</div>
      <div class="ft-wrap"><table class="ft nowrap1" style="min-width:520px;"><thead><tr><th>Fecha</th><th class="tl">Chofer</th><th class="tl">Veh.</th><th class="tl">Ruta</th><th>Km (ida y vuelta)</th><th>Adelanto</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="info-box info-gray" style="margin-top:8px">Adelanto = km × ₲/km del vehículo × ${String(K.reglas.margenAdelanto).replace(".", ",")} (10% de margen), redondeado a miles. El chofer rinde con factura y la diferencia se ajusta en la liquidación. "A definir" = ruta sin km cargado (vehículo a disposición, tours).</div></div>`;
  }

  async function init() {
    const el = $("km"); if (!el) return;
    try {
      const r = await fetch("km.json?t=" + Date.now()); if (!r.ok) throw new Error("HTTP " + r.status);
      K = await r.json();
      el.innerHTML = kpis() + alertas() + proximos() + viajes() + huecos() + combustible()
        + `<div class="info-box info-gray">Regla para los choferes: foto del tablero (odómetro y aguja del combustible) con el número escrito, al INICIO y al FINAL de cada traslado, y en cada carga con la factura. Datos al ${new Date(K.generated).toLocaleString("es")}.</div>`;
    } catch (e) { el.innerHTML = `<div class="err">No pude cargar km.json. ${esc(e.message)}</div>`; }
  }
  document.addEventListener("DOMContentLoaded", init);
})();
