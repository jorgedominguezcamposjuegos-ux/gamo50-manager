/* Generado por integracion-permisos/preparar-web.cjs. Editar las fuentes, no este paquete. */
/* Motor puro de simulación: no red, credenciales, Gmail, Firebase ni almacenamiento. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const clone = value => JSON.parse(JSON.stringify(value));
  const normalizar = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  function dia(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) throw new Error('Fecha no válida.');
    const value = Date.parse(iso + 'T00:00:00Z');
    if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== iso) throw new Error('La fecha no existe.');
    return value / DAY;
  }
  const isoDia = number => new Date(number * DAY).toISOString().slice(0, 10);
  const sumarDias = (iso, amount) => isoDia(dia(iso) + amount);
  function fechas(start, end) {
    const a = dia(start), b = dia(end);
    if (b < a) throw new Error('La fecha final es anterior a la inicial.');
    return Array.from({ length: b - a + 1 }, (_, i) => isoDia(a + i));
  }
  function formato(iso) { return iso ? iso.split('-').reverse().join('/') : '—'; }
  function leerFecha(text) {
    const m = String(text || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) throw new Error('Usa fechas DD/MM/AAAA, con cuatro cifras de año.');
    const iso = `${m[3]}-${m[2]}-${m[1]}`;
    dia(iso);
    return iso;
  }
  function instante(value) {
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(String(value || '')) || !Number.isFinite(Date.parse(value))) throw new Error('La recepción necesita una fecha y hora con zona horaria.');
    return Date.parse(value);
  }
  function partesPeninsula(value) {
    const stamp = typeof value === 'number' ? value : instante(value);
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(stamp)).map(p => [p.type, p.value]));
    return { fecha: `${parts.year}-${parts.month}-${parts.day}`, hora: `${parts.hour}:${parts.minute}` };
  }
  function horaPeninsula(local) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local || '')) throw new Error('Indica fecha y hora de España peninsular.');
    const [date, time] = local.split('T'); dia(date);
    const target = Date.parse(local + ':00Z');
    let stamp = target;
    for (let i = 0; i < 3; i++) {
      const p = partesPeninsula(stamp);
      stamp += target - Date.parse(`${p.fecha}T${p.hora}:00Z`);
    }
    const p = partesPeninsula(stamp);
    if (`${p.fecha}T${p.hora}` !== local) throw new Error('Esa hora de España peninsular no existe por el cambio de horario.');
    return new Date(stamp).toISOString();
  }
  function dosMeses(iso) {
    const [year, month, day] = iso.split('-').map(Number);
    const first = new Date(Date.UTC(year, month - 1 + 2, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
  }
  const habil = (date, config) => ![0, 6].includes(new Date(dia(date) * DAY).getUTCDay()) && !config.festivos.includes(date);
  function fallo(code, message, details = []) { const error = new Error(message); error.code = code; error.details = details; throw error; }

  function leerCorreo(body) {
    const fields = {}, segments = [];
    let current = null;
    const general = { ACCION: 'action', 'NOMBRE Y APELLIDOS': 'nombre', INDICATIVO: 'indicativo', REFERENCIA: 'reference', 'TIPO DE PERMISO': 'type', 'TIPO DE PERMISO SOLICITADO': 'type' };
    const tramo = { 'EJERCICIO DE CARGO': 'exercise', 'FECHA DE INICIO': 'start', 'FECHA DE FIN': 'end' };
    for (const raw of String(body || '').split(/\r?\n/)) {
      const line = raw.trim();
      const header = line.match(/^Tramo\s+(\d+)\s*:\s*$/i);
      if (header) {
        if (Number(header[1]) !== segments.length + 1) fallo('DATOS', 'Numera los tramos consecutivamente desde Tramo 1.');
        current = {}; segments.push(current); continue;
      }
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (!match) continue; // Una explicación libre no sustituye campos estructurados.
      const key = normalizar(match[1]), value = match[2].trim();
      if (general[key]) {
        const name = general[key];
        if (fields[name] !== undefined) fallo('DATOS', `El campo «${match[1]}» está repetido.`);
        fields[name] = value;
      } else if (tramo[key]) {
        if (!current) fallo('DATOS', 'Escribe Tramo 1 antes del ejercicio y las fechas.');
        const name = tramo[key];
        if (current[name] !== undefined) fallo('DATOS', `Hay un campo repetido en el tramo: ${match[1]}.`);
        current[name] = value;
      }
    }
    for (const key of ['action', 'nombre', 'indicativo']) if (!fields[key]) fallo('DATOS', `Falta ${key === 'action' ? 'Acción' : key === 'nombre' ? 'Nombre y apellidos' : 'Indicativo'}.`);
    fields.action = normalizar(fields.action);
    if (!['SOLICITAR', 'MODIFICAR', 'CANCELAR'].includes(fields.action)) fallo('DATOS', 'Acción debe ser SOLICITAR, MODIFICAR o CANCELAR.');
    const indicative = normalizar(fields.indicativo).match(/^(?:GAMO[ -]*)?(5\d)$/);
    if (!indicative) fallo('DATOS', 'El indicativo debe ser el Gamo: por ejemplo 52, 56 o 51 para el JSO.');
    fields.indicativo = indicative[1];
    if (fields.action !== 'SOLICITAR' && !fields.reference) fallo('DATOS', 'Falta la referencia de la solicitud o permiso.');
    if (fields.action === 'CANCELAR') {
      if (segments.length || fields.type) fallo('DATOS', 'La cancelación solo necesita referencia, nombre e indicativo; retira los tramos y el tipo.');
      return fields;
    }
    fields.type = normalizar(fields.type);
    if (!['AP', 'VA'].includes(fields.type)) fallo('DATOS', 'Solo se admiten AP y VA. El resto se gestiona manualmente.');
    if (!segments.length) fallo('DATOS', 'Faltan los tramos con ejercicio, inicio y fin.');
    fields.segments = segments.map((s, i) => {
      if (s.exercise && !/^\d{4}$/.test(s.exercise)) fallo('DATOS', `El ejercicio de cargo del tramo ${i + 1} necesita cuatro cifras.`);
      try { return { exercise: s.exercise ? Number(s.exercise) : null, start: leerFecha(s.start), end: leerFecha(s.end) }; }
      catch (error) { fallo('DATOS', `Tramo ${i + 1}: ${error.message}`); }
    });
    return fields;
  }

  function crearEstado(seed) {
    const state = clone(seed);
    state.requests = state.requests || [];
    state.processed = state.processed || [];
    state.sequence = state.sequence || 1;
    state.history = state.history || [];
    state.config = { festivos: [], calendarioAnos: [], caducidades: { 2026: '2027-03-03' }, inicioContadores: '2027-01-01', ...state.config };
    for (const p of state.permits) {
      // Solo las concesiones previas del conjunto de prueba se migran así.
      // No se alteran las fechas ni el estado de una concesión existente.
      if (p.previo2027 && !p.segments) p.segments = [{ exercise: 2026, start: p.start, end: p.end }];
      p.coverageStart = p.coverageStart || p.start;
      p.coverageEnd = p.coverageEnd || p.end;
    }
    return state;
  }
  function persona(fields, state) {
    const matches = state.people.filter(p => normalizar(p.nombre) === normalizar(fields.nombre));
    if (matches.length !== 1) fallo('DATOS', matches.length ? 'El nombre es ambiguo; no identifica a un único integrante.' : 'El nombre y apellidos no coinciden con un integrante de la plantilla.');
    const person = matches[0];
    if (String(person.indicativo) !== fields.indicativo) fallo('DATOS', 'El indicativo no coincide con el del integrante. Corrige el correo.');
    if (person.so === 'EM' || String(person.indicativo) === '50') fallo('EM', 'El Equipo de Mando se gestiona manualmente y no solicita por correo.');
    return person;
  }
  function comprobarCalendario(start, end, config) {
    for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year++) {
      if (!config.calendarioAnos.includes(year)) fallo('CALENDARIO', `Falta configurar el calendario de Granada de ${year}; no se adivinan los festivos.`);
    }
  }
  function preparar(fields, message, state) {
    const person = persona(fields, state);
    return prepararPeriodo(fields, message, state, person, false);
  }
  function prepararManual(fields, personId, state, now) {
    const person = state.people.find(p => p.id === personId);
    if (!person) fallo('DATOS', 'El integrante no existe en la plantilla actual.');
    if (!['AP', 'VA'].includes(fields.type) || !Array.isArray(fields.segments) || !fields.segments.length || fields.segments.length > 2) fallo('DATOS', 'Selecciona AP/VA y uno o dos tramos.');
    for (const segment of fields.segments) {
      dia(segment.start); dia(segment.end);
      if (!Number.isInteger(segment.exercise) || segment.exercise < 2000 || segment.exercise > 2100) fallo('DATOS', 'Selecciona el ejercicio de cargo de cada tramo.');
    }
    // El acceso manual mantiene sus fechas de gestión, incluso históricas.
    // No falsifica la recepción para eludir la antelación del canal automático.
    return prepararPeriodo({ ...clone(fields), action: 'SOLICITAR', nombre: person.nombre, indicativo: person.indicativo }, { id: 'manual', receivedAt: now, from: null }, state, person, true);
  }
  function prepararPeriodo(fields, message, state, person, manual) {
    const received = partesPeninsula(message.receivedAt).fecha;
    const candidate = { ...clone(fields), personId: person.id, messageId: message.id, from: message.from, receivedAt: message.receivedAt };
    if (fields.action === 'CANCELAR') return candidate;
    const segments = clone(fields.segments);
    candidate.segments = segments;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (!s.exercise) {
        const receiptYear = Number(received.slice(0, 4));
        const carryOpen = Object.entries(state.config.caducidades).some(([year, expiry]) => Number(year) <= receiptYear && received <= expiry);
        if (carryOpen) fallo('DATOS', `Indica el ejercicio de cargo del tramo ${i + 1}; todavía pueden coexistir ejercicios.`);
        if (receiptYear > 2027 && !state.config.caducidades[receiptYear - 1]) fallo('EJERCICIO', 'Falta configurar la caducidad del ejercicio anterior antes de asignar el cargo por defecto.');
        s.exercise = receiptYear;
      }
      if (s.end < s.start) fallo('FECHAS', 'La fecha de fin no puede ser anterior a la de inicio.');
      if (i && sumarDias(segments[i - 1].end, 1) !== s.start) fallo('DATOS', 'Los tramos deben ser consecutivos y sin solaparse. Para periodos separados, envía correos separados.');
      if (s.exercise > Number(s.start.slice(0, 4))) fallo('EJERCICIO', 'No se pueden cargar días a un ejercicio futuro respecto a su disfrute.');
      if (s.exercise < Number(s.end.slice(0, 4)) && !state.config.caducidades[s.exercise]) fallo('EJERCICIO', `Falta indicar la caducidad del ejercicio ${s.exercise}.`);
      const expiry = state.config.caducidades[s.exercise];
      if (expiry && s.end > expiry) fallo('CADUCIDAD', `El ejercicio ${s.exercise} solo permite disfrutar hasta el ${formato(expiry)}. Se rechaza el periodo completo.`);
    }
    candidate.start = segments[0].start;
    candidate.end = segments[segments.length - 1].end;
    if (!manual && candidate.start <= received) fallo('ANTELACION', 'No se puede solicitar para el mismo día de recepción ni para un día pasado.');
    if (!manual && candidate.start > dosMeses(received)) fallo('ANTELACION', `El inicio supera los dos meses naturales desde la recepción: límite ${formato(dosMeses(received))}.`);
    candidate.coverageStart = candidate.start;
    candidate.coverageEnd = candidate.end;
    candidate.singleVacation = candidate.type === 'VA' && candidate.start === candidate.end;
    if (candidate.type === 'VA' && !candidate.singleVacation) {
      comprobarCalendario(candidate.start, candidate.end, state.config);
      if (!habil(candidate.start, state.config) || !habil(candidate.end, state.config)) fallo('HABILES', 'Las VA de varios días deben comenzar y terminar en día hábil.');
      let next = sumarDias(candidate.end, 1);
      comprobarCalendario(next, next, state.config);
      while (!habil(next, state.config)) {
        candidate.coverageEnd = next;
        next = sumarDias(next, 1);
        comprobarCalendario(next, next, state.config);
      }
      const last = segments[segments.length - 1], expiry = state.config.caducidades[last.exercise];
      if (expiry && candidate.coverageEnd > expiry) fallo('CADUCIDAD', `La cobertura añadida supera la caducidad del ejercicio ${last.exercise} (${formato(expiry)}).`);
    }
    candidate.charges = segments.map(s => ({ exercise: s.exercise, dates: fechas(s.start, s.end).filter(date => candidate.type === 'AP' || candidate.singleVacation || habil(date, state.config)) }));
    return candidate;
  }
  const cruza = (aStart, aEnd, bStart, bEnd) => aStart <= bEnd && aEnd >= bStart;
  const esCuota = permit => ['AP', 'VA'].includes(permit.type);
  function cargos(permit, state) {
    if (!esCuota(permit)) return [];
    const cutoff = state.config.inicioContadores;
    if (permit.end < cutoff) return [];
    if (permit.charges) return permit.charges;
    const single = permit.type === 'VA' && permit.start === permit.end;
    const segments = permit.segments || [];
    if (permit.type === 'VA' && !single) comprobarCalendario(permit.start < cutoff ? cutoff : permit.start, permit.end, state.config);
    return segments.map(s => ({ exercise: s.exercise, dates: s.end < cutoff ? [] : fechas(s.start < cutoff ? cutoff : s.start, s.end).filter(date => permit.type === 'AP' || single || habil(date, state.config)) }));
  }
  function contadores(state) {
    const rows = new Map();
    for (const permit of state.permits) {
      for (const charge of cargos(permit, state)) {
        const days = charge.dates.filter(date => date >= state.config.inicioContadores).length;
        if (!days) continue;
        const key = `${permit.personId}:${charge.exercise}`;
        if (!rows.has(key)) rows.set(key, { personId: permit.personId, exercise: charge.exercise, AP: 0, VA: 0, sueltas: 0 });
        const row = rows.get(key);
        row[permit.type] += days;
        if (permit.type === 'VA' && permit.start === permit.end) row.sueltas += days;
      }
    }
    return [...rows.values()].sort((a, b) => a.personId.localeCompare(b.personId) || a.exercise - b.exercise);
  }
  function evaluar(candidate, state, original) {
    const other = state.permits.filter(p => !original || p.id !== original.id);
    const overlaps = other.filter(p => p.personId === candidate.personId && cruza(candidate.coverageStart, candidate.coverageEnd, p.coverageStart, p.coverageEnd));
    if (overlaps.length) return { kind: 'rejected', code: 'SOLAPAMIENTO', reason: 'Existe un permiso o situación administrativa de esta persona que se solapa con la cobertura solicitada.', details: overlaps.map(p => `${p.type}: ${formato(p.coverageStart)}–${formato(p.coverageEnd)}`) };
    if (candidate.singleVacation) {
      const exercise = candidate.segments[0].exercise;
      const count = other.filter(p => p.personId === candidate.personId && p.type === 'VA' && p.start === p.end && p.segments?.some(s => s.exercise === exercise)).length;
      if (exercise >= 2027 && count >= 5) return { kind: 'rejected', code: 'VA_SUELTAS', reason: `Ya tiene ${count} VA sueltas concedidas con cargo a ${exercise}. El máximo es 5; no pasa a espera.`, details: [] };
    }
    const person = state.people.find(p => p.id === candidate.personId);
    const reasons = new Set(), details = [];
    for (const date of fechas(candidate.coverageStart, candidate.coverageEnd)) {
      const absentIds = new Set(other.filter(p => esCuota(p) && p.coverageStart <= date && p.coverageEnd >= date).map(p => p.personId));
      absentIds.add(candidate.personId);
      const absent = state.people.filter(p => absentIds.has(p.id) && p.so !== 'EM' && String(p.indicativo) !== '50');
      const global = absent.filter(p => p.funcion !== 'JSO').length;
      const subgroup = absent.filter(p => p.so === person.so && p.funcion !== 'JSO').length;
      const mandoLibre = state.people.some(p => p.so === person.so && ['JSO', 'JEO'].includes(p.funcion) && !absentIds.has(p.id));
      const dayReasons = [];
      if (global > 6) { reasons.add('cupo global de 6 componentes'); dayReasons.push('cupo GO'); }
      if (subgroup > 2) { reasons.add(`cupo de 2 componentes del SO ${person.so}`); dayReasons.push(`cupo SO ${person.so}`); }
      if (!mandoLibre) { reasons.add(`dejar al SO ${person.so} sin JSO o JEO libre de AP/VA`); dayReasons.push('disponibilidad de mandos'); }
      if (dayReasons.length) details.push(`${formato(date)}: ${dayReasons.join(', ')}`);
    }
    return reasons.size ? { kind: 'waiting', code: 'CUPO_MANDO', reason: `En espera por ${[...reasons].join('; ')}. No se concede ningún día parcialmente.`, details } : { kind: 'granted', code: 'OK', reason: 'Cumple las reglas en todo el periodo y su cobertura.', details: [] };
  }
  function preview(candidate) {
    if (!candidate || !candidate.start) return null;
    return { type: candidate.type, start: candidate.start, end: candidate.end, coverageStart: candidate.coverageStart, coverageEnd: candidate.coverageEnd, charges: (candidate.charges || []).map(c => ({ exercise: c.exercise, days: c.dates.length })), singleVacation: candidate.singleVacation };
  }
  function mensajeRespuesta(event) {
    const labels = { granted: 'CONCEDIDA', modified: 'MODIFICACIÓN CONCEDIDA', waiting: 'EN LISTA DE ESPERA', rejected: 'RECHAZADA', incomplete: 'DATOS POR CORREGIR', cancelled: 'CANCELADA', expired: 'CADUCADA' };
    const lines = [`${labels[event.status] || event.status} · ${event.reference || 'Sin referencia'}`, event.reason];
    if (event.preview) {
      const p = event.preview;
      lines.push(`Permiso: ${p.type} · ${formato(p.start)} al ${formato(p.end)}`, `Cobertura: ${formato(p.coverageStart)} al ${formato(p.coverageEnd)}`);
      lines.push(...p.charges.map(c => `Ejercicio ${c.exercise}: ${c.days} día(s) de ${p.type}.`));
    }
    if (event.details?.length) lines.push('Detalle:', ...event.details);
    if (event.status === 'waiting') lines.push('Todavía no tienes el permiso concedido. Se conserva la prioridad de recepción y se revisará en las próximas tandas.');
    if (event.status === 'incomplete') lines.push('Envía un correo nuevo con todos los campos correctos. Su prioridad será la recepción del correo corregido.');
    if (['waiting', 'rejected', 'expired'].includes(event.status) && event.modification) lines.push('El permiso original conserva su concesión, fechas y cómputo.');
    if (['granted', 'modified', 'waiting'].includes(event.status)) lines.push('Para modificar o cancelar por correo, indica la referencia, tu nombre completo y tu indicativo.');
    return lines.join('\n');
  }
  function revisar(previous, mails, now) {
    instante(now);
    const state = clone(previous), events = [], skipped = [];
    const today = partesPeninsula(now).fecha;
    const notify = event => {
      const e = { at: now, ...event };
      e.response = mensajeRespuesta(e);
      events.push(e); state.history.push(e);
    };
    const reference = () => `G50-${String(state.sequence++).padStart(5, '0')}`;
    const rootFor = candidate => {
      const request = state.requests.find(r => r.reference === candidate.reference);
      const permit = state.permits.find(p => p.reference === candidate.reference);
      if (permit?.origin === 'manual') fallo('MANUAL', 'Los permisos grabados manualmente solo se modifican o cancelan en la app.');
      if (!request || request.personId !== candidate.personId || permit && permit.personId !== candidate.personId) fallo('REFERENCIA', 'La referencia no existe o no corresponde a esa persona.');
      if (['cancelled', 'rejected', 'expired'].includes(request.status) && !permit) fallo('REFERENCIA', 'La solicitud ya está cerrada. Envía una nueva solicitud si procede.');
      const start = permit?.start || request.pending?.start;
      if (start && start <= partesPeninsula(candidate.receivedAt).fecha) fallo('INICIADO', 'El permiso ya había comenzado cuando se recibió el correo.');
      return { request, permit };
    };
    const accepted = [], seen = new Set(state.processed);
    for (const mail of [...mails].sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt))) {
      if (!mail.id || seen.has(mail.id)) { skipped.push({ id: mail.id, reason: 'Correo ya procesado o identificador repetido; sin otra respuesta.' }); continue; }
      try {
        const stamp = instante(mail.receivedAt);
        if (stamp > instante(now)) { skipped.push({ id: mail.id, reason: 'Todavía no ha llegado a esta revisión.' }); continue; }
        seen.add(mail.id); state.processed.push(mail.id);
        const fields = leerCorreo(mail.body);
        if (fields.action === 'SOLICITAR' && fields.reference) fallo('DATOS', 'Una solicitud nueva no debe incluir una referencia previa.');
        accepted.push({ mail, fields, person: persona(fields, state) });
      } catch (error) {
        if (!seen.has(mail.id)) { seen.add(mail.id); state.processed.push(mail.id); }
        notify({ messageId: mail.id, to: mail.from, status: ['DATOS', 'REFERENCIA'].includes(error.code) ? 'incomplete' : 'rejected', reason: error.message, details: error.details || [] });
      }
    }
    // Las cancelaciones liberan primero sus reservas, con independencia de la
    // posición de las solicitudes nuevas en el lote.
    for (const input of accepted.filter(x => x.fields.action === 'CANCELAR')) {
      const { mail, fields, person } = input;
      try {
        const c = { ...fields, personId: person.id, receivedAt: mail.receivedAt };
        const { request } = rootFor(c);
        state.permits = state.permits.filter(p => p.reference !== request.reference);
        request.pending = null; request.status = 'cancelled';
        notify({ messageId: mail.id, to: mail.from, personId: person.id, reference: request.reference, status: 'cancelled', reason: 'Cancelada la solicitud o permiso y todas sus modificaciones pendientes. Los contadores se han recalculado.' });
      } catch (error) { notify({ messageId: mail.id, to: mail.from, status: 'rejected', reference: fields.reference, reason: error.message, details: [] }); }
    }
    for (const input of accepted.filter(x => x.fields.action !== 'CANCELAR')) {
      const { mail, fields, person } = input;
      let ref = fields.reference;
      try {
        const candidate = preparar(fields, mail, state);
        candidate.queued = false;
        if (candidate.action === 'SOLICITAR') {
          ref = reference();
          state.requests.push({ reference: ref, personId: person.id, status: 'pending', pending: candidate });
        } else {
          const { request } = rootFor(candidate);
          if (request.pending && instante(request.pending.receivedAt) > instante(mail.receivedAt)) fallo('ANTIGUA', 'Ya existe una modificación posterior a este correo.');
          request.pending = candidate; // Solo la última propuesta pendiente.
        }
      } catch (error) { notify({ messageId: mail.id, to: mail.from, personId: person.id, reference: ref, status: error.code === 'DATOS' ? 'incomplete' : 'rejected', modification: fields.action === 'MODIFICAR' && state.permits.some(p => p.reference === ref), reason: error.message, details: error.details || [] }); }
    }
    const queue = state.requests.filter(r => r.pending).sort((a, b) => instante(a.pending.receivedAt) - instante(b.pending.receivedAt));
    for (const request of queue) {
      const c = request.pending;
      const original = state.permits.find(p => p.reference === request.reference);
      const modification = Boolean(original);
      const expires = original && original.start < c.start ? original.start : c.start;
      const base = { messageId: c.messageId, to: c.from, personId: c.personId, reference: request.reference, modification, preview: preview(c) };
      if (c.queued && today >= expires) {
        request.pending = null; request.status = original ? 'granted' : 'expired';
        notify({ ...base, status: 'expired', reason: `La espera caducó a las 00:00 del ${formato(expires)}, en horario de España peninsular.`, details: [] }); continue;
      }
      const result = evaluar(c, state, original);
      if (result.kind === 'waiting' && today >= expires) {
        request.pending = null; request.status = original ? 'granted' : 'expired';
        notify({ ...base, status: 'expired', reason: 'No hay disponibilidad y ya se ha alcanzado el comienzo del periodo; no puede quedar en espera.', details: result.details });
      } else if (result.kind === 'waiting') {
        if (!c.queued) notify({ ...base, status: 'waiting', reason: result.reason, details: result.details });
        c.queued = true; request.status = original ? 'granted' : 'waiting';
      } else if (result.kind === 'rejected') {
        request.pending = null; request.status = original ? 'granted' : 'rejected';
        notify({ ...base, status: 'rejected', reason: result.reason, details: result.details });
      } else {
        const permit = { ...clone(c), id: original?.id || `permiso-${request.reference}`, reference: request.reference, origin: 'email' };
        delete permit.queued;
        state.permits = state.permits.filter(p => p.reference !== request.reference);
        state.permits.push(permit);
        request.pending = null; request.status = 'granted';
        notify({ ...base, status: original ? 'modified' : 'granted', reason: original ? 'Modificación aceptada. Sustituye al original y actualiza sus contadores.' : result.reason, details: [] });
      }
    }
    const counts = contadores(state);
    const summary = { to: 'eomagamo50@gmail.com', at: now, counts: Object.fromEntries(['granted', 'modified', 'waiting', 'rejected', 'incomplete', 'cancelled', 'expired'].map(status => [status, events.filter(e => e.status === status).length])), waiting: state.requests.filter(r => r.pending?.queued).length, emails: events.length, skipped: skipped.length };
    return { state, events, skipped, counters: counts, summary };
  }
  const api = { crearEstado, leerCorreo, preparar, prepararManual, evaluar, revisar, contadores, fechas, sumarDias, formato, dia, dosMeses, partesPeninsula, horaPeninsula, normalizar, preview };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PermisosSim = api;
})(typeof globalThis === 'undefined' ? this : globalThis);


/* Calendario laboral: fuentes oficiales, sin calendario escolar ni festivos ficticios. */
(function (root) {
  'use strict';
  const years = {
    2026: {
      fechas: ['01-01', '01-02', '01-06', '02-28', '04-02', '04-03', '05-01', '06-04', '08-15', '10-12', '11-02', '12-07', '12-08', '12-25'],
      fuentes: ['https://www.juntadeandalucia.es/sites/default/files/inline-files/2026/01/Calendario%20fiestas%20laborales%202026.pdf']
    },
    2027: {
      fechas: ['01-01', '01-06', '03-01', '03-25', '03-26', '05-01', '05-03', '05-27', '08-16', '10-12', '11-01', '12-06', '12-08', '12-25'],
      fuentes: ['https://www.juntadeandalucia.es/boja/2026/84/1', 'https://videoactas.granada.org/pmweb/es/ws/downloadAnnex?fName=Acta_Pleno_Ordinario_de_26_de_junio_de_2026.pdf&videoRelated=video_202606261000000000_FH.mp4'],
      acuerdoLocal: 'Pleno 26/06/2026, punto 9, expediente 2026/19837A, página 43. CSV 16343747155726252254. Cruz 03/05 y Corpus 27/05. Acuerdo municipal; no se afirma publicación posterior en BOJA.'
    }
  };
  function configuracion() {
    return { calendarioAnos: Object.keys(years).map(Number), festivos: Object.entries(years).flatMap(([year, data]) => data.fechas.map(date => `${year}-${date}`)), caducidades: { 2026: '2027-03-03' }, inicioContadores: '2027-01-01' };
  }
  const api = { configuracion, fuentes: () => JSON.parse(JSON.stringify(years)) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PermisosCalendario = api;
})(typeof globalThis === 'undefined' ? this : globalThis);


/* Metadatos comunes: fechas solicitadas, cobertura y ejercicios, sin saldos. */
(function (root) {
  'use strict';
  const m = typeof module !== 'undefined' && module.exports ? require('../prototipo-permisos/motor.js') : root.PermisosSim;
  function validar(meta, type) {
    if (!meta || meta.schema !== 1 || !['manual', 'email'].includes(meta.origin) || !Array.isArray(meta.segments) || meta.segments.length > 2 || typeof meta.exception !== 'boolean') throw new Error('Metadatos de permiso no válidos.');
    for (const date of [meta.start, meta.end, meta.coverageStart, meta.coverageEnd]) m.dia(date);
    if (meta.start > meta.end || meta.coverageStart !== meta.start || meta.coverageEnd < meta.end) throw new Error('Fechas solicitadas y cobertura no coinciden.');
    if (meta.reference !== null && (typeof meta.reference !== 'string' || !/^G50-\d{5,}$/.test(meta.reference))) throw new Error('Referencia de permiso no válida.');
    if (meta.origin === 'email' && (!['AP', 'VA'].includes(type) || !meta.reference)) throw new Error('El canal automático solo puede originar AP/VA con referencia.');
    if (['AP', 'VA'].includes(type)) {
      if (!meta.segments.length) throw new Error('Falta el ejercicio de cargo.');
      for (const [i, segment] of meta.segments.entries()) {
        m.dia(segment.start); m.dia(segment.end);
        if (!Number.isInteger(segment.exercise) || segment.exercise < 2000 || segment.exercise > 2100 || segment.start > segment.end || segment.start < meta.start || segment.end > meta.end || i && m.sumarDias(meta.segments[i - 1].end, 1) !== segment.start) throw new Error('Tramos o ejercicios no válidos.');
      }
      if (meta.segments[0].start !== meta.start || meta.segments.at(-1).end !== meta.end) throw new Error('Los tramos deben cubrir todo el permiso solicitado.');
    } else if (meta.segments.length || meta.coverageEnd !== meta.end) throw new Error('Esta situación administrativa no admite cargos ni extensión automática.');
    if ((type !== 'VA' || meta.start === meta.end) && meta.coverageEnd !== meta.end) throw new Error('Solo una VA de varios días puede tener cobertura posterior.');
    return meta;
  }
  function crear(candidate, options) {
    if (!candidate || typeof candidate.personId !== 'string' || !candidate.personId || typeof candidate.type !== 'string' || !candidate.type) throw new Error('Falta integrante o tipo de permiso.');
    const meta = validar({ schema: 1, origin: options?.origin, reference: options?.reference || null, exception: options?.exception === true,
      start: candidate.start, end: candidate.end, coverageStart: candidate.coverageStart || candidate.start, coverageEnd: candidate.coverageEnd || candidate.end,
      segments: (candidate.segments || []).map(s => ({ exercise: s.exercise, start: s.start, end: s.end })) }, candidate.type);
    return { policia_id: candidate.personId, tipo: candidate.type, fecha_inicio: meta.coverageStart, fecha_fin: meta.coverageEnd, g50: JSON.stringify(meta) };
  }
  function leer(document) {
    if (typeof document.g50 !== 'string' || document.g50.length > 8000) throw new Error('Metadatos ausentes o demasiado grandes.');
    const meta = validar(JSON.parse(document.g50), document.tipo);
    if (meta.coverageStart !== document.fecha_inicio || meta.coverageEnd !== document.fecha_fin) throw new Error('Cobertura guardada incoherente con los metadatos.');
    // No confiar en cargos precalculados del cliente. El contador usa segmentos
    // y el calendario común vigente, no cifras copiadas de un formulario.
    return { id: document.id, personId: document.policia_id, type: document.tipo, origin: meta.origin, reference: meta.reference,
      start: meta.start, end: meta.end, coverageStart: meta.coverageStart, coverageEnd: meta.coverageEnd,
      segments: meta.segments, singleVacation: document.tipo === 'VA' && meta.start === meta.end, exception: meta.exception };
  }
  const api = { crear, leer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PermisosFormato = api;
})(typeof globalThis === 'undefined' ? this : globalThis);


(function (root) {
'use strict';
// Adaptación de lectura. No abre Firebase, no escribe ni convierte el almacén de pruebas.
const motor = typeof module !== 'undefined' && module.exports ? require('../prototipo-permisos/motor.js') : root.PermisosSim;
const formato = typeof module !== 'undefined' && module.exports ? require('./formato-permiso.js') : root.PermisosFormato;
const clone = value => JSON.parse(JSON.stringify(value));
const cuota = tipo => ['AP', 'VA'].includes(tipo);
const grupos = { 50: 'EM', 51: '51', 52: '51', 53: '51', 54: '54', 55: '54', 56: '54', 57: '57', 58: '57', 59: '57' };

function documentos(rows, collection) {
  if (!Array.isArray(rows)) throw new Error(`Falta la colección ${collection}.`);
  const seen = new Set();
  return rows.map(row => {
    if (!row || typeof row.id !== 'string' || !row.id || seen.has(row.id) || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
      throw new Error(`Documento sin identificador válido o duplicado en ${collection}.`);
    }
    seen.add(row.id);
    // El ID de Firestore manda, aunque exista un campo id antiguo dentro del documento.
    return { ...clone(row.data), id: row.id };
  });
}

function leer(snapshot, options = {}) {
  const efectivos = documentos(snapshot.efectivos, 'efectivos');
  const permisos = documentos(snapshot.permisos, 'permisos');
  const anteriores = new Set(options.previos2027 || []);
  const incidents = [];
  const warnings = [];
  const issue = (collection, id, code) => incidents.push({ collection, id, code });
  const people = efectivos.map(p => {
    const equipo = String(p.equipo || ''), so = String(p.so || '');
    if (!p.nombre || typeof p.nombre !== 'string' || grupos[equipo] !== so || !['Mando', 'JSO', 'JEO', 'Componente'].includes(p.funcion)) {
      issue('efectivos', p.id, 'DISTRIBUCION_NO_VALIDADA');
    }
    return { id: p.id, nombre: p.nombre, indicativo: equipo, so, funcion: p.funcion, categoria: p.categoria || '' };
  }).sort((a, b) => {
    const orden = v => ['EM', '50'].includes(String(v)) ? 0 : Number(v) || 9999;
    const categorias = { Inspector: 0, Subinspector: 1, Oficial: 2, 'Policía': 3 };
    return orden(a.so) - orden(b.so) || orden(a.indicativo) - orden(b.indicativo)
      || (categorias[a.categoria] ?? 99) - (categorias[b.categoria] ?? 99)
      || a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
  });
  const ids = new Set(people.map(p => p.id));
  const permits = permisos.flatMap(p => {
    const item = { id: p.id, personId: p.policia_id, type: p.tipo, start: p.fecha_inicio, end: p.fecha_fin, coverageStart: p.fecha_inicio, coverageEnd: p.fecha_fin, origin: 'manual' };
    if (!ids.has(p.policia_id)) issue('permisos', p.id, 'PERSONA_NO_ENCONTRADA');
    if (typeof p.tipo !== 'string' || !p.tipo.trim()) issue('permisos', p.id, 'TIPO_AUSENTE');
    if (p.g50 !== undefined) {
      try { return [formato.leer(p)]; }
      catch (_) { issue('permisos', p.id, 'METADATOS_INCOHERENTES'); return [item]; }
    }
    try {
      motor.dia(p.fecha_inicio); motor.dia(p.fecha_fin);
      if (p.fecha_fin < p.fecha_inicio) throw new Error('Orden de fechas');
    } catch (_) {
      // Única excepción histórica identificada y aclarada por el titular.
      // Se conserva el documento original. No se adivinan fechas, no se amplía
      // esta excepción a otros permisos/personas ni a periodos actuales.
      if (options.aislarHistoricoMudarra === true && p.policia_id === 'alejandro_mudarra' && p.tipo === 'VA' && p.fecha_inicio === '2026-09-16' && p.fecha_fin === '2026-07-22' && options.desde >= '2026-10-19') {
        warnings.push({ collection: 'permisos', id: p.id, code: 'HISTORICO_AISLADO_SIN_MODIFICAR' });
        return [];
      }
      issue('permisos', p.id, 'FECHAS_INVALIDAS'); return [item];
    }
    if (!cuota(p.tipo)) return [item]; // BJ/OT/etc. también bloquean solapamientos personales.
    const startYear = Number(p.fecha_inicio.slice(0, 4));
    const endYear = Number(p.fecha_fin.slice(0, 4));
    // Aplicar la decisión de cargo 2026 solo a IDs de una instantánea previa
    // confirmada, nunca a cualquier permiso futuro por estar fechado en 2027.
    const exercise = startYear === 2027 && endYear === 2027 && anteriores.has(p.id) ? 2026 : endYear <= 2026 && startYear === endYear ? startYear : null;
    if (exercise === null) issue('permisos', p.id, 'EJERCICIO_PENDIENTE');
    else item.segments = [{ exercise, start: item.start, end: item.end }];
    // Concesiones previas conservan exactamente su cobertura. No extender VA
    // históricas ni revocarlas por las nuevas reglas durante esta lectura.
    return [item];
  });
  for (const id of anteriores) {
    if (!permisos.some(p => p.id === id)) issue('permisos', id, 'ID_PREVIO_NO_ENCONTRADO');
  }
  return { ready: incidents.length === 0, incidents, warnings, people, permits, counts: { efectivos: people.length, permisos: permisos.length }, evaluados: permits.length, readOnly: true };
}

function estadoParaComparar(read, config) {
  if (!read.readOnly || !read.ready || read.incidents.length) throw new Error('Hay datos pendientes de revisar; no se prepara una evaluación parcial.');
  // Sin cola, correos ni referencias ficticias; solo evaluación en memoria.
  return motor.crearEstado({ people: read.people, permits: read.permits, config: clone(config) });
}

const api = { leer, estadoParaComparar };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.PermisosAdaptadorG50 = api;
})(typeof globalThis === 'undefined' ? this : globalThis);


/* Protocolo común de escritura. Sin credenciales, correo ni acceso implícito a Firebase. */
(function (root) {
  'use strict';
  const CONTROL = 'control_permisos/version';
  const clone = value => JSON.parse(JSON.stringify(value));
  function conflicto(message) { const error = new Error(message); error.code = 'G50_CONFLICTO'; return error; }
  function version(document) {
    if (!document || !Number.isSafeInteger(document.version) || document.version < 0) throw new Error('Control de permisos no inicializado. No se guarda parcialmente.');
    return document.version;
  }
  function validarOperaciones(operations) {
    if (!Array.isArray(operations) || !operations.length || operations.length > 450) throw new Error('Lote de permisos no válido.');
    const ids = new Set();
    return operations.map(op => {
      if (!op || !['crear', 'modificar', 'eliminar'].includes(op.action) || typeof op.id !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(op.id) || ids.has(op.id)) throw new Error('Operación o identificador de permiso no válido o repetido.');
      ids.add(op.id);
      if (op.action !== 'eliminar' && (!op.data || typeof op.data !== 'object' || Array.isArray(op.data))) throw new Error('Faltan los datos del permiso.');
      if (op.data && Object.keys(op.data).some(k => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(k) || ['constructor', 'prototype'].includes(k))) throw new Error('Campo de permiso no válido. No se permiten rutas de actualización arbitrarias.');
      return clone(op);
    });
  }
  function preparar(snapshot, operations, now, validate) {
    const v = version(snapshot.control);
    if (typeof now !== 'string' || !Number.isFinite(Date.parse(now))) throw new Error('Falta la hora del servidor.');
    const ops = validarOperaciones(operations), permits = clone(snapshot.permisos);
    if (!Array.isArray(permits)) throw new Error('Lectura de permisos incompleta.');
    for (const op of ops) {
      const existing = permits.find(p => p.id === op.id);
      if (op.action === 'crear' && existing) throw conflicto('El permiso ya existe. No se duplica.');
      if (op.action !== 'crear' && !existing) throw conflicto('El permiso ya no existe. Actualiza la pantalla; no se vuelve a crear.');
      if (op.expectedRevision !== undefined && (existing?.data.revision_g50 || 0) !== op.expectedRevision) throw conflicto('Otra operación ha cambiado este permiso. Actualiza antes de modificarlo.');
      if (op.action === 'eliminar') permits.splice(permits.indexOf(existing), 1);
      else {
        const data = { ...(existing?.data || {}), ...op.data, revision_g50: (existing?.data.revision_g50 || 0) + 1 };
        if (existing) existing.data = data;
        else permits.push({ id: op.id, data });
        // La propuesta ve el documento completo; la escritura solo lleva los
        // campos cambiados. No convertir un Timestamp u otro campo desconocido
        // a un mapa JSON al guardar una edición.
        op.data = { ...op.data, revision_g50: data.revision_g50 };
      }
    }
    // La misma validación recibe la instantánea completa y la propuesta. Puede
    // exigir confirmación manual o bloquear automáticamente, pero nunca enviar.
    if (typeof validate !== 'function') throw new Error('Falta la validación común del lote.');
    validate({ efectivos: clone(snapshot.efectivos), permisos: permits }, clone(snapshot));
    if (!Number.isSafeInteger(v + 1)) throw new Error('El control de versión necesita revisión administrativa.');
    return { expectedVersion: v, nextVersion: v + 1, at: now, operations: ops };
  }
  async function ejecutar(repository, operations, options = {}) {
    const construir = typeof operations === 'function' ? operations : () => validarOperaciones(operations);
    if (!repository || typeof repository.snapshot !== 'function' || typeof repository.commit !== 'function' || typeof options.validate !== 'function') throw new Error('Falta el repositorio coordinado o su validación.');
    const attempts = options.attempts === undefined ? 5 : options.attempts;
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) throw new Error('Número de reintentos no válido.');
    for (let n = 0; n < attempts; n++) {
      try {
        const snapshot = await repository.snapshot();
        const ops = validarOperaciones(construir(snapshot));
        const plan = preparar(snapshot, ops, options.now || new Date().toISOString(), options.validate);
        await repository.commit(plan);
        return { version: plan.nextVersion, ids: ops.map(op => op.id) };
      } catch (error) {
        // Releer y recalcular, nunca reutilizar un cupo o una aprobación obsoletos.
        if (error.code !== 'G50_CONFLICTO' || n === attempts - 1) throw error;
      } finally {
        if (repository.rollback) await repository.rollback();
      }
    }
  }
  function repositorioWeb(db, serverTimestamp) {
    if (!db || typeof serverTimestamp !== 'function') throw new Error('Falta Firebase o su fecha de servidor.');
    const control = db.doc(CONTROL);
    return {
      async snapshot() {
        // Cercado de la consulta: todas las escrituras del protocolo modifican
        // este mismo documento. Si cambia, se descarta toda la lectura.
        for (let i = 0; i < 5; i++) {
          const before = await control.get({ source: 'server' });
          const v = version(before.exists ? before.data() : null);
          const [efectivos, permisos] = await Promise.all([db.collection('efectivos').get({ source: 'server' }), db.collection('permisos').get({ source: 'server' })]);
          const after = await control.get({ source: 'server' });
          if (version(after.exists ? after.data() : null) === v) return { control: { version: v }, efectivos: efectivos.docs.map(d => ({ id: d.id, data: d.data() })), permisos: permisos.docs.map(d => ({ id: d.id, data: d.data() })) };
        }
        throw conflicto('Los permisos están cambiando. Reintenta la operación.');
      },
      async commit(plan) {
        return db.runTransaction(async transaction => {
          const current = await transaction.get(control);
          if (version(current.exists ? current.data() : null) !== plan.expectedVersion) throw conflicto('Ha cambiado la disponibilidad. Se vuelve a comprobar.');
          const docs = [];
          // Todas las lecturas antes de la primera escritura, como exige Firestore.
          for (const op of plan.operations) docs.push(await transaction.get(db.collection('permisos').doc(op.id)));
          for (const [i, op] of plan.operations.entries()) {
            const document = docs[i];
            if (op.action === 'crear' ? document.exists : !document.exists) throw conflicto('El permiso ha cambiado durante el guardado.');
            const ref = db.collection('permisos').doc(op.id);
            const data = { ...op.data }; delete data.createdAt; delete data.updatedAt;
            if (op.action === 'eliminar') transaction.delete(ref);
            else if (op.action === 'crear') transaction.set(ref, { ...data, createdAt: serverTimestamp() });
            else transaction.update(ref, { ...data, updatedAt: serverTimestamp() });
          }
          transaction.update(control, { version: plan.nextVersion, actualizado: serverTimestamp() });
        });
      }
    };
  }
  function ejecutarSincrono(repository, operations, options = {}) {
    const ops = validarOperaciones(operations), attempts = options.attempts === undefined ? 5 : options.attempts;
    if (typeof options.validate !== 'function' || !Number.isInteger(attempts) || attempts < 1 || attempts > 10) throw new Error('Falta la validación o el límite de reintentos.');
    for (let n = 0; n < attempts; n++) {
      try {
        const snapshot = repository.snapshot();
        if (snapshot?.then) throw new Error('Este acceso requiere repositorio síncrono de servidor.');
        const plan = preparar(snapshot, ops, options.now || new Date().toISOString(), options.validate);
        const result = repository.commit(plan);
        if (result?.then) throw new Error('El repositorio debe confirmar el guardado de forma síncrona.');
        return { version: plan.nextVersion, ids: ops.map(op => op.id) };
      } catch (error) {
        if (error.code !== 'G50_CONFLICTO' || n === attempts - 1) throw error;
      } finally { if (repository.rollback) repository.rollback(); }
    }
  }
  const api = { CONTROL, version, preparar, ejecutar, ejecutarSincrono, conflicto, repositorioWeb };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PermisosCoordinacion = api;
})(typeof globalThis === 'undefined' ? this : globalThis);


/* Puente de las tres pantallas a la misma validación y transacción. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const m = node ? require('../prototipo-permisos/motor.js') : root.PermisosSim;
  const a = node ? require('./adaptador-g50.cjs') : root.PermisosAdaptadorG50;
  const f = node ? require('./formato-permiso.js') : root.PermisosFormato;
  const c = node ? require('./coordinacion.js') : root.PermisosCoordinacion;
  const cal = node ? require('./calendario-granada.js') : root.PermisosCalendario;
  function edicion(p) {
    const result = { ...p, ejercicio: '', repartir: false, ejercicio2: '', corte: '' };
    if (p.g50 !== undefined) {
      const meta = f.leer(p);
      result.fecha_inicio = meta.start; result.fecha_fin = meta.end;
      result.ejercicio = meta.segments[0]?.exercise || '';
      if (meta.segments.length === 2) Object.assign(result, { repartir: true, ejercicio2: meta.segments[1].exercise, corte: meta.segments[1].start });
    } else if (p.fecha_fin?.slice(0, 4) <= '2026') result.ejercicio = Number(p.fecha_fin.slice(0, 4));
    return result;
  }
  function tramos(form) {
    const start = form.fecha_inicio, end = form.fecha_fin;
    m.dia(start); m.dia(end);
    if (start > end) throw new Error('La fecha final es anterior al inicio.');
    const year = Number(form.ejercicio);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Selecciona el año de cargo del permiso.');
    const segments = [{ exercise: year, start, end }];
    if (form.repartir) {
      m.dia(form.corte); const next = Number(form.ejercicio2);
      if (form.corte <= start || form.corte > end || !Number.isInteger(next) || next < 2000 || next > 2100 || next === year) throw new Error('Comprueba el segundo año y la fecha de corte.');
      segments[0].end = m.sumarDias(form.corte, -1);
      segments.push({ exercise: next, start: form.corte, end });
    }
    return segments;
  }
  function estado(snapshot, now) {
    const read = a.leer(snapshot, { aislarHistoricoMudarra: true, desde: m.partesPeninsula(now).fecha });
    if (!read.ready) throw new Error('Hay datos de permisos pendientes de revisar. No se guarda parcialmente.');
    return a.estadoParaComparar(read, cal.configuracion());
  }
  function preparar(snapshot, form, id, force, now) {
    if (!['AP', 'VA', 'AFG', 'CH', 'CU', 'BJ', 'PT', 'CSA', 'OT'].includes(form.tipo)) throw new Error('Selecciona un tipo de permiso válido.');
    const state = estado(snapshot, now);
    const original = state.permits.find(p => p.id === form.id);
    if (form.id && (!original || original.personId !== form.policia_id)) throw c.conflicto('El permiso ha cambiado o ya no existe. Actualiza la pantalla.');
    const start = form.fecha_inicio, end = form.fecha_fin;
    m.dia(start); m.dia(end);
    if (start > end) throw new Error('La fecha final es anterior al inicio.');
    if (!state.people.some(p => p.id === form.policia_id)) throw new Error('Integrante no encontrado.');
    let candidate;
    if (['AP', 'VA'].includes(form.tipo)) {
      const segments = tramos(form);
      if (original && original.type === form.tipo && original.start === start && original.end === end) {
        // Una reclasificación de cargo no cambia ni normaliza la cobertura de
        // una concesión previa, incluso si acababa en domingo.
        candidate = { personId: form.policia_id, type: form.tipo, start, end, coverageStart: original.coverageStart, coverageEnd: original.coverageEnd, segments, singleVacation: form.tipo === 'VA' && start === end };
      } else candidate = m.prepararManual({ type: form.tipo, segments }, form.policia_id, state, now);
      const person = state.people.find(p => p.id === candidate.personId);
      const result = person.so === 'EM' ? { kind: 'granted' } : m.evaluar(candidate, state, original);
      if (result.kind !== 'granted' && !force) {
        const error = new Error(result.reason + '\n\n¿Deseas grabar el permiso manualmente de todas formas?'); error.code = 'G50_AVISO'; throw error;
      }
    } else {
      candidate = { personId: form.policia_id, type: form.tipo, start, end, coverageStart: start, coverageEnd: end, segments: [] };
    }
    const document = f.crear(candidate, { origin: 'manual', reference: original?.reference || null, exception: force });
    return [{ action: form.id ? 'modificar' : 'crear', id, ...(form.id ? { expectedRevision: form.revision_g50 || 0 } : {}), data: document }];
  }
  async function guardar(db, form, force = false, repository) {
    const id = form.id || db.collection('permisos').doc().id;
    const now = new Date().toISOString();
    return c.ejecutar(repository || c.repositorioWeb(db, () => root.firebase.firestore.FieldValue.serverTimestamp()), snapshot => preparar(snapshot, form, id, force, now), {
      now, validate(proposal) { estado(proposal, now); }
    });
  }
  async function eliminar(db, permiso, repository) {
    const now = new Date().toISOString();
    return c.ejecutar(repository || c.repositorioWeb(db, () => root.firebase.firestore.FieldValue.serverTimestamp()), [{ action: 'eliminar', id: permiso.id, expectedRevision: permiso.revision_g50 || 0 }], {
      now, validate(proposal) { estado(proposal, now); }
    });
  }
  const api = { edicion, tramos, preparar, guardar, eliminar };
  if (node) module.exports = api; else root.PermisosManual = api;
})(typeof globalThis === 'undefined' ? this : globalThis);


/* Lectura en vivo: una concesión de Google aparece sin recargar la app. */
(function (root) {
  'use strict';
  function escuchar(db, changed, failed) {
    if (typeof changed !== 'function' || typeof failed !== 'function') throw new Error('Faltan los receptores de sincronización.');
    const collection = db?.collection('permisos');
    if (typeof collection?.onSnapshot !== 'function') return () => {};
    return collection.onSnapshot({ includeMetadataChanges: true }, snapshot => {
      // No reemplazar datos confirmados por un estado pendiente/offline.
      if (snapshot.metadata?.fromCache || snapshot.metadata?.hasPendingWrites) return;
      changed(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, failed);
  }
  const api = { escuchar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PermisosSincronizacion = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
