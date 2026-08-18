// Corre el HTML generado en un DOM real y verifica que dibuje de verdad.
// node --check solo valida sintaxis; esto atrapa errores de runtime.
//     node check.js [dist/index.html]
// En CI jsdom lo instala el workflow; en local puede estar en otro lado.
const jsdomPath = (() => {
  for (const p of ["jsdom", "/tmp/jsdomtest/node_modules/jsdom"]) {
    try { require.resolve(p); return p; } catch (e) {}
  }
  throw new Error("falta jsdom: npm install jsdom");
})();
const { JSDOM, VirtualConsole } = require(jsdomPath);
const fs = require("fs");
const file = process.argv[2] || "dist/index.html";
const errs = [];
const vc = new VirtualConsole().on("jsdomError", e => errs.push(e.message));
const dom = new JSDOM("<!doctype html><html><body>" + fs.readFileSync(file, "utf8") + "</body></html>",
  { runScripts: "dangerously", virtualConsole: vc });
const d = dom.window.document;
const n = s => d.querySelectorAll(s).length;
const txt = s => (d.querySelector(s) || {}).textContent;
let fail = errs.length > 0;
console.log("errores JS:", errs.length ? errs : "ninguno");
for (const [label, got, want] of [
  ["KPI cards", n(".kpi"), 5],
  ["sparklines", n(".kpi .spark svg"), 5],
  ["puntos del grafico de volumen", n("#chart-vol circle"), 1],
  ["motivos", n("#reasons .reason"), 1],
  ["filas del log", n("#log tbody tr"), 1],
  ["columnas del log", n("#loghead th"), 7],
  ["parrafos de insight", n("#insight p"), 1],
  ["donut removido", n("#donut") === 0 ? 1 : 0, 1],
]) {
  const ok = got >= want;
  if (!ok) fail = true;
  console.log(`  ${ok ? "OK  " : "FALLA"} ${label}: ${got}`);
}
console.log("  KPIs:", [...d.querySelectorAll(".kpi")].map(k =>
  k.querySelector(".lab").textContent + "=" + k.querySelector(".val").textContent).join("  "));
console.log("  rango:", txt("#picklabel"));
console.log("  motivos:", [...d.querySelectorAll("#reasons .rt")].map(r =>
  r.textContent.replace(/\s+/g, " ").trim()).join(" | "));
// el selector responde
d.querySelector('[data-range="all"]').dispatchEvent(new dom.window.Event("click"));
console.log("  tras All time:", txt("#picklabel"), "| filas:", n("#log tbody tr"));
process.exit(fail ? 1 : 0);
