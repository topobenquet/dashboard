/* Tarjeta de donación compartida por las versiones b1, b2 y b3.
 *
 *   Donar.montar(document.getElementById('donar'), {
 *     montos: { mensual: [{gs, txt, pop}], unica: [{gs, txt, pop}] },
 *     modo: 'mensual',            // el que viene marcado
 *     botonMensual: 'Ser padrino por {monto} al mes',
 *     botonUnica: 'Donar {monto}',
 *   });
 *
 * Cada página da el estilo con sus propias clases .dn-*.
 * El cobro va a la API de donar-api (donar.jbenquet.com).
 */
(function () {
  const API = location.hostname === 'localhost' ? 'http://localhost:8780' : 'https://donar.jbenquet.com';
  const MINIMO = 10000;
  const qs = new URLSearchParams(location.search);
  const fmt = n => 'Gs ' + Number(n).toLocaleString('es-PY');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

  function montar(el, cfg) {
    let modo = qs.get('modo') === 'unica' ? 'unica' : (cfg.modo || 'mensual');
    let sel = popular(modo);
    const bMensual = cfg.botonMensual || 'Ser padrino por {monto} al mes';
    const bUnica = cfg.botonUnica || 'Donar {monto}';

    function popular(m) {
      const i = cfg.montos[m].findIndex(x => x.pop);
      return i < 0 ? 0 : i;
    }

    el.innerHTML = `
      <div class="dn">
        <div class="dn-tog" role="tablist" aria-label="Frecuencia">
          <button type="button" role="tab" data-modo="mensual">Todos los meses <span class="dn-tag">Más impacto</span></button>
          <button type="button" role="tab" data-modo="unica">Una sola vez</button>
        </div>
        <div class="dn-amts"></div>
        <div class="dn-otro" hidden><label class="dn-lbl" for="dn-otro">Tu monto en guaraníes</label><input id="dn-otro" inputmode="numeric" placeholder="Ej. 150.000"></div>
        <p class="dn-impacto" aria-live="polite"></p>
        <form class="dn-form" novalidate>
          <div class="dn-campo"><label class="dn-lbl" for="dn-nombre">Nombre y apellido</label><input id="dn-nombre" name="nombre" autocomplete="name" required></div>
          <div class="dn-fila">
            <div class="dn-campo"><label class="dn-lbl" for="dn-tel">WhatsApp</label><input id="dn-tel" name="telefono" type="tel" autocomplete="tel" placeholder="09xx xxx xxx" required></div>
            <div class="dn-campo"><label class="dn-lbl" for="dn-email">Email</label><input id="dn-email" name="email" type="email" autocomplete="email" required></div>
          </div>
          <label class="dn-chk"><input type="checkbox" name="novedades" checked> Quiero recibir novedades del hogar por WhatsApp</label>
          <p class="dn-err" role="alert"></p>
          <div class="dn-aviso" hidden></div>
          <button class="dn-cta dn-main" type="submit"></button>
        </form>
        <p class="dn-fine"></p>
        <button type="button" class="dn-down"></button>
        <div class="dn-medios">Tarjeta · Transferencia · Tigo Money · Personal Pay · Zimple · QR</div>
      </div>`;

    const $ = s => el.querySelector(s);
    const err = t => { $('.dn-err').textContent = t || ''; };

    function monto() {
      const m = cfg.montos[modo][sel];
      return m.gs || parseInt(($('#dn-otro').value || '').replace(/\D/g, ''), 10) || 0;
    }

    function pintar() {
      el.querySelectorAll('.dn-tog button').forEach(b => {
        const on = b.dataset.modo === modo;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on);
      });
      const box = $('.dn-amts');
      box.innerHTML = '';
      cfg.montos[modo].forEach((m, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dn-amt' + (i === sel ? ' on' : '');
        b.innerHTML = (m.pop ? '<span class="dn-pop">El más elegido</span>' : '') +
          `<span class="dn-gs">${m.gs ? fmt(m.gs) : 'Otro monto'}</span>` +
          (m.gs && modo === 'mensual' ? '<span class="dn-mes">por mes</span>' : '');
        b.onclick = () => { sel = i; pintar(); if (!m.gs) $('#dn-otro').focus(); };
        box.appendChild(b);
      });
      const m = cfg.montos[modo][sel];
      $('.dn-otro').hidden = !!m.gs;
      $('.dn-impacto').innerHTML = esc(m.txt || '');
      const n = monto();
      $('.dn-main').textContent = (modo === 'mensual' ? bMensual : bUnica).replace('{monto}', n ? fmt(n) : '').replace(/\s+/g, ' ').trim();
      $('.dn-fine').textContent = modo === 'mensual'
        ? 'Podés cancelar cuando quieras. Pago seguro con Pagopar.'
        : 'Pago seguro con Pagopar. Recibís la confirmación al instante.';
      $('.dn-down').textContent = modo === 'mensual' ? 'Prefiero donar una sola vez' : 'Mejor, quiero ayudar todos los meses';
      $('.dn-aviso').hidden = true;
      $('.dn-main').hidden = false;
      err('');
    }

    el.querySelectorAll('.dn-tog button').forEach(b => b.onclick = () => { modo = b.dataset.modo; sel = popular(modo); pintar(); });
    $('.dn-down').onclick = () => { modo = modo === 'mensual' ? 'unica' : 'mensual'; sel = popular(modo); pintar(); };
    $('#dn-otro').addEventListener('input', () => {
      const n = monto();
      $('.dn-main').textContent = bUnica.replace('{monto}', n ? fmt(n) : '').trim();
    });

    async function cobrar(datos, btn = $('.dn-main')) {
      const txt = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Abriendo el pago seguro...';
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid'].forEach(k => { if (qs.get(k)) datos[k] = qs.get(k); });
      try {
        const r = await fetch(API + '/donar.php', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos)});
        const j = await r.json();
        if (j.ok && j.url) { location.href = j.url; return; }
        err(j.error || 'No pudimos iniciar el pago. Probá de nuevo.');
      } catch (_) {
        err('No pudimos conectar. Revisá tu conexión y probá de nuevo.');
      }
      btn.disabled = false;
      btn.textContent = txt;
    }

    $('.dn-form').onsubmit = e => {
      e.preventDefault();
      err('');
      const f = e.target, n = monto();
      if (f.nombre.value.trim().length < 3) return err('Escribí tu nombre.');
      if (f.telefono.value.replace(/\D/g, '').length < 8) return err('Revisá el número de WhatsApp.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) return err('Revisá el email.');
      if (n < MINIMO) return err('El monto mínimo es ' + fmt(MINIMO) + '.');
      const datos = {nombre: f.nombre.value, telefono: f.telefono.value, email: f.email.value, novedades: f.novedades.checked, monto: n, modo: 'unica'};

      // El padrinazgo mensual se habilita cuando Pagopar active las suscripciones.
      // Mientras tanto, se ofrece empezar hoy con el mismo monto.
      if (modo === 'mensual') {
        const av = $('.dn-aviso');
        av.innerHTML = `<p>El aporte mensual se activa en los próximos días. ¿Querés empezar hoy con una primera donación de <b>${fmt(n)}</b>? Te avisamos por WhatsApp cuando puedas hacerlo mensual.</p><button type="button" class="dn-cta dn-cta-alt">Donar ${fmt(n)} ahora</button>`;
        av.hidden = false;
        $('.dn-main').hidden = true;
        av.querySelector('button').onclick = e => cobrar(datos, e.currentTarget);
        return;
      }
      cobrar(datos);
    };

    pintar();

    // Barra fija en el celular cuando la tarjeta sale de pantalla.
    const sticky = document.querySelector('.dn-sticky');
    if (sticky) {
      sticky.onclick = () => el.scrollIntoView({behavior: 'smooth', block: 'start'});
      new IntersectionObserver(([e]) => sticky.classList.toggle('ver', !e.isIntersecting && e.boundingClientRect.top > 0))
        .observe(el);
    }
  }

  window.Donar = {montar};
})();
