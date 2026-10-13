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
  const MINIMO = 10000;           // donación única
  const MINIMO_MENSUAL = 50000;   // aporte mensual
  const BASE = (document.currentScript && document.currentScript.src || location.href).replace(/[^/]*$/, '');
  const qs = new URLSearchParams(location.search);
  const fmt = n => 'Gs ' + Number(n).toLocaleString('es-PY');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

  function montar(el, cfg) {
    // Texto del botón; sin monto todavía (Otro monto vacío) queda el verbo solo.
    const textoBoton = n => n
      ? (modo === 'mensual' ? bMensual : bUnica).replace('{monto}', fmt(n)).replace(/\s+/g, ' ').trim()
      : (modo === 'mensual' ? 'Ser padrino' : 'Donar');
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
          <div class="dn-campo"><label class="dn-lbl" for="dn-tel">WhatsApp</label><input id="dn-tel" name="telefono" type="tel" autocomplete="tel" required></div>
          <div class="dn-campo"><label class="dn-lbl" for="dn-email">Email</label><input id="dn-email" name="email" type="email" autocomplete="email" required></div>
          <label class="dn-chk"><input type="checkbox" name="novedades" checked> Quiero recibir novedades del hogar por WhatsApp</label>
          <p class="dn-err" role="alert"></p>
          <div class="dn-aviso" hidden></div>
          <button class="dn-cta dn-main" type="submit"></button>
        </form>
        <p class="dn-fine"></p>
        <button type="button" class="dn-down"></button>
        <div class="dn-medios">Tarjeta · Transferencia · Tigo Money · Personal Pay · QR</div>
      </div>`;

    const $ = s => el.querySelector(s);
    const minimo = () => modo === 'mensual' ? (cfg.minimoMensual || MINIMO_MENSUAL) : MINIMO;
    let iti = null;
    telefonoInternacional($('#dn-tel')).then(x => { iti = x; });
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
      $('#dn-otro').placeholder = 'Mínimo ' + fmt(minimo());
      $('.dn-impacto').innerHTML = esc(m.txt || '');
      const n = monto();
      $('.dn-main').textContent = textoBoton(n);
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
      $('.dn-main').textContent = textoBoton(n);
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
      if (iti ? !iti.isValidNumber() : f.telefono.value.replace(/\D/g, '').length < 8) return err('Revisá el número de WhatsApp.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) return err('Revisá el email.');
      if (n < minimo()) return err('El monto mínimo ' + (modo === 'mensual' ? 'mensual ' : '') + 'es ' + fmt(minimo()) + '.');
      const telefono = iti ? iti.getNumber() : f.telefono.value;
      const datos = {nombre: f.nombre.value, telefono, email: f.email.value, novedades: f.novedades.checked, monto: n, modo: 'unica'};

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

  /* Teléfono con bandera y código de país (intl-tel-input, alojado en assets/iti).
   * El país sale de la IP; el formato y el largo máximo, del país elegido. */
  function cargar(tag, attrs) {
    return new Promise((ok, mal) => {
      const e = Object.assign(document.createElement(tag), attrs);
      e.onload = ok; e.onerror = mal;
      document.head.appendChild(e);
    });
  }

  function paisPorIP(listo) {
    const corte = ms => new Promise((_, mal) => setTimeout(mal, ms));
    const iso = c => /^[A-Za-z]{2}$/.test(c || '') ? c.toLowerCase() : null;
    Promise.race([fetch('https://api.country.is/').then(r => r.json()).then(j => iso(j.country)), corte(2500)])
      .catch(() => Promise.race([fetch('https://get.geojs.io/v1/ip/country.json').then(r => r.json()).then(j => iso(j.country)), corte(2500)]))
      .then(c => listo(c || 'py'), () => listo('py'));
  }

  async function telefonoInternacional(input) {
    try {
      await Promise.all([
        cargar('link', {rel: 'stylesheet', href: BASE + 'assets/iti/css/intlTelInput.min.css'}),
        window.intlTelInput ? null : cargar('script', {src: BASE + 'assets/iti/js/intlTelInput.min.js'}),
      ]);
    } catch (_) {
      input.placeholder = '09xx xxx xxx';
      return null;
    }
    // Nombres de países en castellano, con el traductor del propio navegador.
    const i18n = {searchPlaceholder: 'Buscar país', zeroSearchResults: 'Sin resultados', oneSearchResult: '1 resultado',
      multipleSearchResults: '${count} resultados', selectedCountryAriaLabel: 'País elegido', noCountrySelected: 'Elegí un país',
      countryListAriaLabel: 'Lista de países'};
    try {
      const dn = new Intl.DisplayNames(['es'], {type: 'region'});
      window.intlTelInput.getCountryData().forEach(c => { i18n[c.iso2] = dn.of(c.iso2.toUpperCase()); });
    } catch (_) { /* quedan en inglés */ }
    const iti = window.intlTelInput(input, {
      initialCountry: 'auto',
      geoIpLookup: paisPorIP,
      countryOrder: ['py', 'ar', 'br', 'uy', 'bo', 'cl', 'us', 'es'],
      separateDialCode: true,
      strictMode: true,
      i18n,
      loadUtilsOnInit: BASE + 'assets/iti/js/utils.js',
    });
    // strictMode frena lo que se tipea, pero no lo que se pega: se recorta lo que sobra.
    // El tope es el largo de un celular del país elegido (es para WhatsApp); el 0 inicial no cuenta.
    input.addEventListener('input', () => {
      const u = window.intlTelInput.utils;
      if (!u) return;
      const pais = iti.getSelectedCountryData();
      const ej = u.getExampleNumber(pais.iso2, false, u.numberType.MOBILE, true) || '';
      const tope = ej.replace(/\D/g, '').length - String(pais.dialCode || '').length;
      const digitos = input.value.replace(/\D/g, '');
      const sobran = digitos.replace(/^0/, '').length - tope;
      if (tope > 0 && sobran > 0) {
        iti.setNumber(digitos.slice(0, digitos.length - sobran));
      }
    });
    return iti;
  }

  /* Barra de progreso de la campaña (donar-api/progreso.php).
   *   Donar.campana(el)           versión grande
   *   Donar.campana(el, {mini})   versión compacta, para la tarjeta
   * Se anima al aparecer y se actualiza cada minuto. Si la API no responde, no muestra nada. */
  function campana(el, opt = {}) {
    let mostrado = 0;
    const pinta = (d, animar) => {
      const pct = Math.min(100, d.recaudado / d.meta * 100);
      const dias = Math.max(0, Math.ceil((new Date(d.hasta) - Date.now()) / 864e5));
      el.hidden = false;
      el.classList.add('cp', opt.mini ? 'cp-mini' : 'cp-full');
      el.innerHTML = `
        <div class="cp-top"><span class="cp-nombre">${esc(d.nombre)}</span><span class="cp-dias">${dias > 1 ? 'Faltan ' + dias + ' días' : dias === 1 ? 'Último día' : 'Terminó'}</span></div>
        <div class="cp-montos"><b class="cp-rec">${fmt(mostrado)}</b><span>recaudados de ${fmt(d.meta)}</span></div>
        <div class="cp-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i></i></div>
        <div class="cp-pie"><span>${pct < 1 && pct > 0 ? '1' : Math.floor(pct)}% de la meta</span><span>${d.donantes} ${d.donantes === 1 ? 'persona ya ayudó' : 'personas ya ayudaron'}</span></div>`;
      const barra = el.querySelector('.cp-barra i'), rec = el.querySelector('.cp-rec');
      if (animar === 'prep') return;
      if (!animar) { barra.style.width = pct + '%'; rec.textContent = fmt(d.recaudado); mostrado = d.recaudado; return; }
      requestAnimationFrame(() => requestAnimationFrame(() => { barra.style.width = pct + '%'; }));
      const desde = mostrado, t0 = performance.now(), dur = 1400;
      const paso = t => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        rec.textContent = fmt(Math.round((desde + (d.recaudado - desde) * e) / 1000) * 1000);
        if (k < 1) requestAnimationFrame(paso); else { rec.textContent = fmt(d.recaudado); mostrado = d.recaudado; }
      };
      requestAnimationFrame(paso);
    };
    const traer = () => fetch(API + '/progreso.php').then(r => r.json());
    el.hidden = true;
    traer().then(d => {
      if (!d || !d.meta) return;
      pinta(d, 'prep');
      new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { obs.disconnect(); pinta(d, true); } }, {threshold: .3}).observe(el);
      setInterval(() => traer().then(n => { if (n.recaudado !== mostrado) pinta(n, true); }).catch(() => {}), 60000);
    }).catch(() => {});
  }

  window.Donar = {montar, campana};
})();
