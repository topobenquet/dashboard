#!/usr/bin/env python3
"""
Baja las llamadas del Voice AI desde GoHighLevel y las normaliza en calls.json.

    export GHL_TOKEN_s4nqDuXGLKo0n3HD9KB9=pit-...
    python3 fetch_ghl.py s4nqDuXGLKo0n3HD9KB9

El token es un Private Integration creado DENTRO de la sub-cuenta: los PIT son
por location y ni la agency key ni el de otra location sirven.

De donde sale cada cosa
-----------------------
- La llamada en si: mensajes `TYPE_CALL` de cada conversacion. Traen direccion,
  `meta.call.duration` y `meta.call.status`.
- El resumen: GHL no lo guarda en el mensaje. El Voice AI escribe una NOTA en
  el contacto con el formato "--------- AI Call with: ... ---------" y ahi si
  esta el Call Summary. Se parsea de ahi y se aparea con la llamada por
  contacto + duracion.
- Nombre del contacto: los contactos creados por `lc-phone-api` a partir de una
  llamada entrante no tienen nombre, solo telefono y ciudad. Se usa la ciudad
  como identificador secundario porque para un HVAC es informacion util.
- Grabacion y sentiment: hoy no existen (ver README). Los campos quedan vacios
  y la plantilla oculta esas columnas sola.

El telefono se publica completo por decision explicita del cliente.
"""
import datetime, json, os, pathlib, re, subprocess, sys, time

HERE = pathlib.Path(__file__).resolve().parent
LOC = sys.argv[1] if len(sys.argv) > 1 else "s4nqDuXGLKo0n3HD9KB9"
# En CI la salida va directo al directorio del cliente dentro del repo de
# dashboards; en local, a dist/. Se pasa como segundo argumento.
OUTDIR = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "dist"
DATA = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else HERE / "calls.json"
TOK = os.environ.get(f"GHL_TOKEN_{LOC}") or os.environ.get("GHL_TOKEN")
if not TOK:
    sys.exit(f"falta GHL_TOKEN_{LOC} en el entorno")
BASE = "https://services.leadconnectorhq.com"


def api(path, params=None, ver="2021-04-15"):
    # urllib recibe 403 de Cloudflare por el User-Agent; curl pasa.
    cmd = ["curl", "-s", "-G", BASE + path, "-H", f"Authorization: Bearer {TOK}",
           "-H", f"Version: {ver}", "-H", "Accept: application/json"]
    for k, v in (params or {}).items():
        cmd += ["--data-urlencode", f"{k}={v}"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    try:
        return json.loads(r.stdout or "{}")
    except Exception:
        sys.exit(f"respuesta no-JSON de {path}: {r.stdout[:300]}")


def phone(num):
    """Numero completo y legible. Se saca el +1 de USA y se agrupa como
    (956) 212-2958; cualquier otro pais se deja tal cual vino."""
    if not num:
        return ""
    d = "".join(ch for ch in str(num) if ch.isdigit())
    if len(d) == 11 and d.startswith("1"):
        d = d[1:]
    if len(d) == 10:
        return f"({d[:3]}) {d[3:6]}-{d[6:]}"
    return str(num)


def ms(iso_ts):
    return int(datetime.datetime.fromisoformat(iso_ts.replace("Z", "+00:00")).timestamp() * 1000)


# ---- conversaciones y mensajes de llamada ---------------------------------
convs, seen, last = [], set(), None
while True:
    p = {"locationId": LOC, "limit": 100, "sortBy": "last_message_date", "sort": "desc"}
    if last:
        p["startAfterDate"] = last
    d = api("/conversations/search", p)
    if "conversations" not in d:
        sys.exit(f"error de la API: {json.dumps(d)[:300]}")
    fresh = [c for c in d["conversations"] if c["id"] not in seen]
    if not fresh:
        break
    seen.update(c["id"] for c in fresh)
    convs += fresh
    if len(d["conversations"]) < 100 or not d["conversations"][-1].get("lastMessageDate"):
        break
    last = d["conversations"][-1]["lastMessageDate"]
    time.sleep(0.2)
print(f"{len(convs)} conversaciones")

calls = []
for c in convs:
    lastId = None
    while True:
        p = {"limit": 100}
        if lastId:
            p["lastMessageId"] = lastId
        blk = (api(f"/conversations/{c['id']}/messages", p).get("messages") or {})
        msgs = blk.get("messages", []) if isinstance(blk, dict) else []
        if not msgs:
            break
        calls += [m for m in msgs if m.get("messageType") in ("TYPE_CALL", "TYPE_PHONE")]
        if not blk.get("nextPage"):
            break
        lastId = msgs[-1]["id"]
        time.sleep(0.15)
    time.sleep(0.1)
print(f"{len(calls)} llamadas")

# ---- contactos y notas ----------------------------------------------------
cids = sorted({m["contactId"] for m in calls if m.get("contactId")})
contacts, notes = {}, []
for cid in cids:
    contacts[cid] = api(f"/contacts/{cid}", ver="2021-07-28").get("contact", {}) or {}
    for n in api(f"/contacts/{cid}/notes", ver="2021-07-28").get("notes", []) or []:
        n["_cid"] = cid
        notes.append(n)
    time.sleep(0.12)
print(f"{len(contacts)} contactos · {len(notes)} notas")

SUMMARY_RE = re.compile(r"Call Summary:\s*(.+?)(?:\n-{10,}|\Z)", re.S)
DUR_RE = re.compile(r"Call Duration:\s*(\d+)\s*seconds")
parsed = []
for n in notes:
    b = n.get("body") or ""
    if "AI Call with" not in b:
        continue
    sm = SUMMARY_RE.search(b)
    dm = DUR_RE.search(b)
    parsed.append({
        "cid": n["_cid"],
        "dur": int(dm.group(1)) if dm else None,
        "summary": " ".join(sm.group(1).split()) if sm else "",
        "used": False,
    })

# ---- normalizacion --------------------------------------------------------
rows = []
for m in calls:
    call = (m.get("meta") or {}).get("call") or {}
    status = str(call.get("status") or m.get("status") or "").lower()
    dur = int(call.get("duration") or 0)
    inbound = m.get("direction") == "inbound"
    ct = contacts.get(m.get("contactId"), {})

    if status in ("no-answer", "busy", "failed", "canceled"):
        outcome = "no_answer"
    elif status == "voicemail":
        outcome = "voicemail"
    elif dur > 0:
        outcome = "connected"
    else:
        outcome = "no_answer"

    # El resumen se aparea por contacto y duracion; GHL redondea distinto en la
    # nota que en el mensaje, asi que se tolera un segundo de diferencia.
    summary = ""
    best = None
    for p in parsed:
        if p["used"] or p["cid"] != m.get("contactId") or p["dur"] is None:
            continue
        if abs(p["dur"] - dur) <= 2 and (best is None or abs(p["dur"] - dur) < abs(best["dur"] - dur)):
            best = p
    if best:
        best["used"] = True
        summary = best["summary"]

    city = ", ".join(x for x in (ct.get("city"), ct.get("state")) if x)
    rows.append({
        "id": m["id"],
        "ts": ms(m["dateAdded"]),
        "name": " ".join(x for x in (ct.get("firstName"), ct.get("lastName")) if x),
        "place": city.title() if city else "",
        "phone": phone((m.get("from") if inbound else m.get("to")) or ct.get("phone") or ""),
        "dir": m.get("direction") or "",
        "demo": False,
        "outcome": outcome,
        "reason": status,
        "dur": dur,
        "sentiment": "",
        "summary": summary,
        "rec": "",
        "cost": 0,
    })

# ---- grabaciones --------------------------------------------------------
# GHL exige autenticacion para bajarlas, asi que se descargan aca y el HTML las
# enlaza por ruta relativa: el token nunca sale de esta maquina. Las llamadas
# anteriores a activar la grabacion devuelven 422 y quedan sin audio, que es lo
# correcto — no hay nada que escuchar.
RECDIR = OUTDIR / "rec"
RECDIR.mkdir(parents=True, exist_ok=True)
got = 0
for r in rows:
    dest = RECDIR / f"{r['id']}.mp3"
    if not dest.exists():
        ok = subprocess.run(
            ["curl", "-s", "-f", "-o", str(dest), "-H", f"Authorization: Bearer {TOK}",
             "-H", "Version: 2021-04-15",
             f"{BASE}/conversations/messages/{r['id']}/locations/{LOC}/recording"],
            capture_output=True, timeout=180).returncode == 0
        if not ok or not dest.exists() or dest.stat().st_size < 1024:
            dest.unlink(missing_ok=True)
    if dest.exists():
        r["rec"] = f"rec/{dest.name}"
        got += 1
    time.sleep(0.1)
print(f"grabaciones descargadas: {got}/{len(rows)}")

# ---- citas del calendario ------------------------------------------------
# Alimentan los KPI de Appointments Booked y Close Rate. Las que tienen TEST en
# el titulo son pruebas nuestras y se marcan para excluirlas de los numeros.
appts = []
for cal in api("/calendars/", {"locationId": LOC}, ver="2021-07-28").get("calendars", []) or []:
    for e in api("/calendars/events", {"locationId": LOC, "calendarId": cal["id"],
                                       "startTime": "1780000000000",
                                       "endTime": "1900000000000"},
                 ver="2021-07-28").get("events", []) or []:
        title = (e.get("title") or "").strip()
        appts.append({"ts": e.get("startTime"), "title": title,
                      "status": e.get("appointmentStatus"), "contactId": e.get("contactId"),
                      "test": "TEST" in title.upper()})
    time.sleep(0.15)
(DATA.parent / "appointments.json").write_text(json.dumps(appts, separators=(",", ":")))
print(f"{len(appts)} citas ({sum(1 for a in appts if not a['test'])} reales)")

rows.sort(key=lambda r: r["ts"], reverse=True)
DATA.write_text(json.dumps(rows, separators=(",", ":")))
from collections import Counter
print(f"\n-> calls.json con {len(rows)} llamadas")
print("  direccion:", Counter(r["dir"] for r in rows).most_common())
print("  resultado:", Counter(r["outcome"] for r in rows).most_common())
print("  con resumen:", sum(1 for r in rows if r["summary"]), "| con grabacion:", sum(1 for r in rows if r["rec"]))
