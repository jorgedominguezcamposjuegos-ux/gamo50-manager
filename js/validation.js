/**
 * Funciones de validación para Gamo 50 Manager
 * Convertidas desde Python a JavaScript para Firebase Firestore
 */

// ================= UTILIDADES DE FECHA =================

/**
 * Convierte una string de fecha YYYY-MM-DD a objeto Date
 */
function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Verifica si dos rangos de fechas se solapan
 */
function datesOverlap(start1, end1, start2, end2) {
  return Math.max(start1, start2) <= Math.min(end1, end2);
}

/**
 * Genera un UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ================= VALIDACIÓN DE AGENTES =================

/**
 * Filtra las bajas definitivas a partir de las fechas indicadas
 * @param {string} agentName - Nombre del agente
 * @param {Date} targetDate - Fecha objetivo
 * @returns {boolean} - true si el agente está activo
 */
function isAgentActiveOnDate(agentName, targetDate) {
  const date2026_07_05 = new Date(2026, 6, 5); // Julio es mes 6 en JS (0-indexed)
  const date2026_07_11 = new Date(2026, 6, 11);
  
  // Solo marcar como baja si el nombre coincide exactamente con los agentes específicos
  // Usamos coincidencia más específica para evitar falsos positivos
  const bajaAgents = [
    'Torres', // Solo si el nombre es exactamente "Torres" o contiene específicamente este apellido en contexto de baja
  ];
  
  const excludedNames = ['Buenaventura', 'Castillo', 'Padilla', 'Valero'];
  
  // Verificar si es uno de los agentes específicos con baja
  for (const bajaName of bajaAgents) {
    // Solo marcar si el nombre contiene el apellido Y no es parte de un nombre compuesto válido
    if (agentName.includes(bajaName) && targetDate >= date2026_07_05) {
      // Verificar que no sea un caso falso positivo (ej: "Manuel Salvador Torres" no debería ser marcado)
      // Solo marcar si el apellido está al final o es el único apellido
      const parts = agentName.split(' ');
      const lastName = parts[parts.length - 1];
      if (lastName === bajaName) {
        return false;
      }
    }
  }
  
  const isExcluded = excludedNames.some(name => agentName.includes(name));
  
  if (isExcluded && targetDate >= date2026_07_11) {
    return false;
  }
  
  return true;
}

// ================= VALIDACIÓN DE PERMISOS =================

/**
 * Verifica las cuotas de permisos antes de guardar
 * @param {Object} data - Datos completos (efectivos, permisos)
 * @param {Object} permiso - Permiso a validar
 * @returns {Object|null} - Retorna warning object si hay advertencias, null si está ok
 */
function checkPermisoQuotas(data, permiso) {
  const policia = data.efectivos.find(p => p.id === permiso.policia_id);
  
  if (!policia) {
    throw new Error('Policía no encontrado');
  }

  // Tipos de permiso que no cuentan para las cuotas
  const exemptTypes = ['AFG', 'BJ', 'CU', 'PT'];
  
  if (!exemptTypes.includes(permiso.tipo)) {
    const fechaIni = parseDate(permiso.fecha_inicio);
    const fechaFin = parseDate(permiso.fecha_fin);
    
    // Buscar permisos solapados (excepto los exentos)
    const permisosSolapados = data.permisos.filter(p => {
      if (exemptTypes.includes(p.tipo)) return false;
      
      const pIni = parseDate(p.fecha_inicio);
      const pFin = parseDate(p.fecha_fin);
      
      return datesOverlap(fechaIni, fechaFin, pIni, pFin);
    });
    
    const idsSolapados = permisosSolapados.map(p => p.policia_id);
    const agentesSolapados = data.efectivos.filter(e => idsSolapados.includes(e.id));
    
    if (!permiso.force) {
      const warnings = [];
      
      // Límite global de 6 permisos en el Gamo 50
      const countGlobal = agentesSolapados.filter(a => 
        a.categoria === 'Policía' || a.en_funciones
      ).length;
      
      if (countGlobal >= 6) {
        warnings.push('Se superaría el límite global de 6 permisos en el Gamo 50.');
      }
      
      // Límite de 2 permisos por SO
      const countSO = agentesSolapados.filter(a => 
        a.so === policia.so && (a.categoria === 'Policía' || a.en_funciones)
      ).length;
      
      if (countSO >= 2) {
        const ahora = new Date();
        const fechaIniDt = new Date(fechaIni);
        fechaIniDt.setHours(0, 0, 0, 0);
        
        const horasParaPermiso = (fechaIniDt - ahora) / (1000 * 60 * 60);
        
        if (horasParaPermiso < 72) {
          warnings.push('Si en un SO se piden más de 2 permisos dos policías dentro del mismo SO y quedan menos de 72 horas para que llegue el día del permiso, se atenderá solo al cupo grupal y se aceptara y reducirá el cupo de los otros SOs');
        } else {
          warnings.push(`El Subgrupo ${policia.so} ya tiene ${countSO} permisos concedidos.`);
        }
      }
      
      // Validación de mandos
      if ((policia.funcion === 'JSO' || policia.funcion === 'JEO') && !policia.en_funciones) {
        const mandosSOSolapados = agentesSolapados.filter(a => 
          a.so === policia.so && 
          (a.funcion === 'JSO' || a.funcion === 'JEO') && 
          !a.en_funciones
        );
        
        if (mandosSOSolapados.length > 0) {
          const nombres = mandosSOSolapados.map(m => m.nombre).join(', ');
          warnings.push(`No pueden coincidir mandos. Ya está de permiso: ${nombres}`);
        }
      }
      
      if (warnings.length > 0) {
        return {
          warning: true,
          message: 'ATENCIÓN:\n' + warnings.map(w => `- ${w}`).join('\n') + '\n\n¿Deseas grabar el permiso de todas formas?',
          needsForce: true
        };
      }
    }
  }
  
  return null;
}

// ================= VALIDACIÓN DE COMISIONES =================

/**
 * Verifica si un agente es elegible para comisión
 * @param {string} agentId - ID del agente
 * @param {Date} cIni - Fecha inicio de comisión
 * @param {Date} cFin - Fecha fin de comisión
 * @param {Array} permisos - Lista de permisos
 * @param {Array} excluidos - Lista de IDs excluidos manualmente
 * @returns {boolean}
 */
function isAgentElegibleForComision(agentId, cIni, cFin, permisos, excluidos) {
  if (excluidos.includes(agentId)) {
    return false;
  }
  
  for (const p of permisos) {
    if (p.policia_id === agentId) {
      const pIni = parseDate(p.fecha_inicio);
      const pFin = parseDate(p.fecha_fin);
      
      if (datesOverlap(cIni, cFin, pIni, pFin)) {
        return false;
      }
    }
  }
  
  return true;
}

// ================= CÁLCULO DE DISPONIBILIDAD =================

/**
 * Calcula la disponibilidad de efectivos en un rango de fechas
 * @param {Object} data - Datos completos
 * @param {string} fechaInicio - Fecha inicio YYYY-MM-DD
 * @param {string} fechaFin - Fecha fin YYYY-MM-DD
 * @returns {Object} - { disponibles: [], reporte: string }
 */
function getDisponibilidad(data, fechaInicio, fechaFin) {
  const targetStart = parseDate(fechaInicio);
  const targetEnd = parseDate(fechaFin);
  
  // Generar array de fechas en el rango
  const targetDates = [];
  const current = new Date(targetStart);
  
  while (current <= targetEnd) {
    targetDates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  const disponibles = [];
  
  for (const efectivo of data.efectivos) {
    let disponibleRango = true;
    
    for (const targetDate of targetDates) {
      let diaDisponible = true;
      
      // Verificar si el agente está activo en esta fecha
      if (!isAgentActiveOnDate(efectivo.nombre, targetDate)) {
        diaDisponible = false;
      }
      
      // Verificar permisos
      if (diaDisponible) {
        for (const p of data.permisos) {
          if (p.policia_id === efectivo.id) {
            const pIni = parseDate(p.fecha_inicio);
            const pFin = parseDate(p.fecha_fin);
            
            if (pIni <= targetDate && targetDate <= pFin) {
              diaDisponible = false;
              break;
            }
          }
        }
      }
      
      // Verificar comisiones
      if (diaDisponible) {
        for (const c of data.comisiones_servicio || []) {
          const cIni = parseDate(c.fecha_inicio);
          const cFin = parseDate(c.fecha_fin);
          
          if (cIni <= targetDate && targetDate <= cFin) {
            const excluidos = c.excluidos_manuales || [];
            
            if (isAgentElegibleForComision(efectivo.id, cIni, cFin, data.permisos, excluidos)) {
              diaDisponible = false;
              break;
            }
          }
        }
      }
      
      if (!diaDisponible) {
        disponibleRango = false;
        break;
      }
    }
    
    if (disponibleRango) {
      disponibles.push(efectivo);
    }
  }
  
  // Calcular resumen global
  const ii = disponibles.filter(e => e.categoria === 'Inspector').length;
  const ss = disponibles.filter(e => e.categoria === 'Subinspector').length;
  const oo = disponibles.filter(e => e.categoria === 'Oficial').length;
  const pp = disponibles.filter(e => e.categoria === 'Policía').length;
  
  const resumenGlobal = `${String(ii).padStart(2, '0')} ${String(ss).padStart(2, '0')} ${String(oo).padStart(2, '0')} ${String(pp).padStart(2, '0')}`;
  
  // Calcular desglose por SO
  const desglose = {};
  
  for (const e of disponibles) {
    const so = e.so;
    if (so === 'EM') continue;
    
    const equipo = e.equipo || so;
    
    if (!desglose[so]) {
      desglose[so] = {};
    }
    if (!desglose[so][equipo]) {
      desglose[so][equipo] = 0;
    }
    desglose[so][equipo]++;
  }
  
  // Generar reporte de texto
  let resultadoTexto = `${resumenGlobal}\n`;
  
  const sortedSOs = Object.keys(desglose).sort();
  
  for (const so of sortedSOs) {
    const totalSO = Object.values(desglose[so]).reduce((sum, count) => sum + count, 0);
    resultadoTexto += `\nGamo ${so} (total SO ${totalSO}):\n`;
    resultadoTexto += '• Total por equipos:\n';
    
    const sortedEqs = Object.keys(desglose[so]).sort();
    for (const eq of sortedEqs) {
      resultadoTexto += `  ◦ G${eq}: ${desglose[so][eq]}\n`;
    }
  }
  
  return {
    disponibles,
    reporte: resultadoTexto
  };
}

// ================= FUNCIONES PARA COMISIONES =================

/**
 * Obtiene los efectivos elegibles para una comisión
 * @param {Object} data - Datos completos
 * @param {Object} comision - Comisión a evaluar
 * @returns {Object} - { elegibles: [], agregados: [], excluidos_manuales: [] }
 */
function getComisionEfectivos(data, comision) {
  const cIni = parseDate(comision.fecha_inicio);
  const cFin = parseDate(comision.fecha_fin);
  const excluidos = comision.excluidos_manuales || [];
  
  // Generar fechas en el rango
  const targetDates = [];
  const current = new Date(cIni);
  
  while (current <= cFin) {
    targetDates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  const elegibles = [];
  
  for (const e of data.efectivos) {
    // Verificar que el agente está activo en todo el rango
    const activoRango = targetDates.every(td => isAgentActiveOnDate(e.nombre, td));
    
    if (!activoRango) continue;
    
    if (isAgentElegibleForComision(e.id, cIni, cFin, data.permisos, excluidos)) {
      elegibles.push(e);
    }
  }
  
  return {
    elegibles,
    agregados: comision.agregados || [],
    excluidos_manuales: excluidos
  };
}

// Exportar funciones para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isAgentActiveOnDate,
    checkPermisoQuotas,
    isAgentElegibleForComision,
    getDisponibilidad,
    getComisionEfectivos,
    parseDate,
    generateUUID
  };
}
