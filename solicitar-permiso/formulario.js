(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const action = () => document.querySelector('[name=action]:checked').value;
  const storageKey = 'g50-formulario-envio-pendiente-v2';
  const endpoint = document.querySelector('meta[name="g50-permisos-endpoint"]')?.content;
  let recovered = null;
  try { recovered = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch (_) { /* El formulario funciona también sin almacenamiento de sesión. */ }
  let key = recovered?.key || crypto.randomUUID(), inFlight = false, finished = false;
  async function call(method, payload) {
    if (endpoint) {
      if (endpoint !== 'https://script.google.com/macros/s/AKfycbzDwNkr7Wf1sVOhx-qtLROUeu27ujdTVO00y4lRS2aO6jWOXmpKiAwrU0Lx88qVw78U/exec') throw new Error('La conexión del formulario necesita revisión.');
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(endpoint + '?api=' + (method === 'config' ? 'config' : 'solicitud'), {
          method: method === 'config' ? 'GET' : 'POST', mode: 'cors', credentials: 'omit', redirect: 'follow', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
          ...(method === 'config' ? {} : { headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(payload) })
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'No se ha confirmado la conexión.');
        return result.data;
      } catch (error) {
        if (error.name === 'AbortError') throw new Error('La conexión está tardando demasiado. No se ha confirmado el envío.');
        throw error;
      } finally { clearTimeout(timer); }
    }
    if (typeof google !== 'undefined' && google.script?.run) {
      return new Promise((resolve, reject) => { const runner = google.script.run.withSuccessHandler(resolve).withFailureHandler(reject); if (method === 'config') runner.configuracionPublica(); else runner.registrarSolicitud(payload); });
    }
    const response = await fetch(method === 'config' ? '/api/config' : '/api/requests', method === 'config' ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'No se ha podido registrar.'); return result;
  }
  function day(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function update() {
    const cancel = action() === 'CANCELAR', split = $('repartir').checked;
    $('referencia-campo').hidden = action() === 'SOLICITAR'; $('referencia').required = action() !== 'SOLICITAR';
    $('datos').hidden = cancel; $('datos').disabled = cancel;
    $('segundo-tramo').hidden = !split;
    for (const id of ['corte', 'ejercicio2']) { $(id).required = split && !cancel; $(id).disabled = !split; }
    $('fin').min = $('inicio').value;
    $('corte').min = $('inicio').value ? day($('inicio').value, 1) : ''; $('corte').max = $('fin').value;
  }
  $('solicitud').addEventListener('change', update);
  $('solicitud').addEventListener('submit', async event => {
    event.preventDefault(); if (inFlight || finished) return;
    inFlight = true; $('enviar').disabled = true; $('resultado').className = ''; $('resultado').textContent = 'Registrando…';
    try {
      const payload = { key, action: action(), personId: $('persona').value, email: $('email').value.trim() };
      if (action() !== 'SOLICITAR') payload.reference = $('referencia').value.trim();
      if (action() !== 'CANCELAR') {
        payload.type = document.querySelector('[name=type]:checked').value;
        payload.segments = [{ exercise: Number($('ejercicio').value), start: $('inicio').value, end: $('fin').value }];
        if ($('repartir').checked) {
          const cut = $('corte').value;
          if (cut <= $('inicio').value || cut > $('fin').value) throw new Error('Comprueba dónde empieza el segundo tramo.');
          if ($('ejercicio').value === $('ejercicio2').value) throw new Error('El segundo tramo debe cargarse a un año distinto.');
          payload.segments[0].end = day(cut, -1);
          payload.segments.push({ exercise: Number($('ejercicio2').value), start: cut, end: $('fin').value });
        }
      }
      // Conserva el envío incluso si se recarga la pestaña tras perder la respuesta.
      try { sessionStorage.setItem(storageKey, JSON.stringify(payload)); } catch (_) { /* La clave se conserva en memoria si el navegador bloquea sessionStorage. */ }
      const receipt = await call('submit', payload);
      try { sessionStorage.removeItem(storageKey); } catch (_) { /* Sin almacenamiento de sesión. */ }
      $('resultado').className = 'ok'; $('resultado').textContent = `${receipt.message}\n\nRecibo: ${receipt.id}\nEnvío: ${new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' }).format(new Date(receipt.receivedAt))} · España peninsular\n\nConserva este recibo. No reenvíes la misma solicitud mientras esperas la revisión.`;
      finished = true; $('otra').hidden = false;
      for (const field of $('solicitud').querySelectorAll('input, select')) field.disabled = true;
    } catch (error) { $('resultado').className = 'error'; $('resultado').textContent = error.message + ' Si falló la conexión, reintenta sin cambiar los datos.'; }
    finally { inFlight = false; $('enviar').disabled = finished; }
  });
  $('otra').addEventListener('click', () => location.reload());
  call('config').then(config => {
    if (!((config.mode === 'test' && config.synthetic) || (config.mode === 'production' && config.synthetic === false))) throw new Error('No se ha podido verificar el modo del formulario.');
    $('aviso').textContent = config.notice;
    if (config.mode === 'production') {
      document.title = 'Solicitar permiso · G50';
      $('enviar').textContent = 'Enviar solicitud';
      document.querySelector('footer').textContent = 'AP y VA · Revisión 08:00 y 21:00 · Hora peninsular española. No hay concesión hasta recibir la respuesta.';
    }
    $('persona').replaceChildren(new Option('Selecciona tu nombre e indicativo', ''));
    let group, indicative;
    for (const p of config.people) {
      if (indicative !== p.indicative) {
        indicative = p.indicative; group = document.createElement('optgroup'); group.label = `Gamo ${indicative}`; $('persona').append(group);
      }
      group.append(new Option(p.name, p.id));
    }
    $('persona').disabled = false;
    for (const id of ['ejercicio', 'ejercicio2']) $(id).replaceChildren(new Option('Selecciona el año', ''), ...config.years.map(y => new Option(String(y), String(y))));
    $('inicio').value = day(config.today, 1); $('fin').value = day(config.today, 1);
    $('inicio').min = day(config.today, 1); $('inicio').max = config.maxStart;
    if (recovered) {
      const radio = [...document.querySelectorAll('[name=action]')].find(el => el.value === recovered.action);
      if (radio) radio.checked = true;
      $('persona').value = recovered.personId; $('email').value = recovered.email;
      $('referencia').value = recovered.reference || '';
      if (recovered.segments?.length) {
        const first = recovered.segments[0], last = recovered.segments[recovered.segments.length - 1];
        const type = [...document.querySelectorAll('[name=type]')].find(el => el.value === recovered.type); if (type) type.checked = true;
        $('inicio').value = first.start; $('fin').value = last.end; $('ejercicio').value = String(first.exercise);
        $('inicio').removeAttribute('min'); $('inicio').removeAttribute('max');
        $('repartir').checked = recovered.segments.length === 2;
        if (recovered.segments[1]) { $('corte').value = last.start; $('ejercicio2').value = String(last.exercise); }
      }
      $('resultado').className = 'ok'; $('resultado').textContent = 'Hay un envío sin confirmación recuperado. Reintenta sin cambiar sus datos: si ya se registró, se devolverá el mismo recibo sin duplicarlo.';
    }
    update(); $('enviar').disabled = false;
  }).catch(error => { $('resultado').className = 'error'; $('resultado').textContent = 'No se ha podido cargar el formulario: ' + error.message; });
})();
