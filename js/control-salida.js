(function (global) {
  'use strict';
  const codes = { PT: 'P', CSA: 'CS', OT: 'OTROS' };
  const priority = { BJ: 0, VA: 1, AP: 2, CH: 3 };
  const categories = { Inspector: 0, Subinspector: 1, Oficial: 2, 'Policía': 3, Policia: 3 };
  const serial = text => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text || '')) throw new Error('La comisión necesita fechas válidas.');
    const n = Date.parse(text + 'T00:00:00Z');
    if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== text) throw new Error('La comisión contiene una fecha inválida.');
    return (n - Date.UTC(1899, 11, 30)) / 86400000;
  };
  const generationDate = date => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Ceuta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const codeOrder = (a, b) => (priority[a] ?? 4) - (priority[b] ?? 4) || a.localeCompare(b, 'es');
  const personName = e => e.apellidos && e.nombre_pila ? `${e.apellidos}, ${e.nombre_pila}` : e.nombre || '';
  const alphabet = (a, b) => personName(a).localeCompare(personName(b), 'es');
  function plan(data, commission, details, now = new Date()) {
    if (!commission) throw new Error('Selecciona una comisión.');
    const start = serial(commission.fecha_inicio), end = serial(commission.fecha_fin);
    if (end <= start) throw new Error('La vuelta debe ser posterior al inicio de la comisión.');
    if (end - start + 1 > 27) throw new Error('Esta plantilla admite hasta 27 días. Amplía la plantilla antes de generar esta comisión.');
    const people = data.efectivos.filter(e => !global.isAgentActiveOnDate || (global.isAgentActiveOnDate(e.nombre, new Date(commission.fecha_inicio + 'T12:00:00')) && global.isAgentActiveOnDate(e.nombre, new Date(commission.fecha_fin + 'T12:00:00'))));
    const aggregate = commission.agregados || [];
    if (people.length > 50 || aggregate.length > 10) throw new Error('La plantilla admite 50 integrantes del grupo y 10 agregados.');
    const used = new Set();
    const records = [...people].sort((a,b) => Number(a.equipo) - Number(b.equipo) || (categories[a.categoria] ?? 4) - (categories[b.categoria] ?? 4) || alphabet(a,b)).map(e => {
      let row = Number(e.control_salida_fila);
      if (row < 10 || row > 59 || !Number.isInteger(row) || used.has(row)) row = null;
      if (row) used.add(row);
      const permissions = (data.permisos || []).filter(p => p.policia_id === e.id && p.fecha_inicio <= commission.fecha_fin && p.fecha_fin >= commission.fecha_inicio);
      const types = [...new Set(permissions.map(p => p.tipo))].sort(codeOrder);
      const reason = types.length ? (codes[types[0]] || types[0]) : ((commission.excluidos_manuales || []).includes(e.id) ? 'OTROS' : '');
      const allowed = ['CH','BJ','AP','APA','VA','AFG','INAS','P','CU','CS','LS','JU','OTROS'];
      if (reason && !allowed.includes(reason)) throw new Error(`El permiso ${reason} necesita una equivalencia para el Excel.`);
      return { ...e, row, permissions, reason };
    });
    for (const e of records) if (!e.row) { e.row = Array.from({length:50},(_,i)=>10+i).find(r=>!used.has(r)); used.add(e.row); }
    const base = records.filter(e => e.reason).sort((a,b) => (categories[a.categoria] ?? 4) - (categories[b.categoria] ?? 4) || alphabet(a,b));
    if (base.length > 19) throw new Error('Hay más de 19 personas en base. Amplía la plantilla antes de generar el archivo.');
    const missing = [...records,...aggregate].filter(e => !e.dni || !e.cp || !e.apellidos || !e.nombre_pila).map(e=>e.nombre);
    return { records, aggregate, base, start, end, details, commission, generated: serial(generationDate(now)), missing, total: records.length - base.length + aggregate.length };
  }
  const escape = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const column = n => { let a=''; for (;n;n=Math.floor((n-1)/26)) a=String.fromCharCode(65+(n-1)%26)+a; return a; };
  // The prepared template renamed XML prefixes but retained the original
  // mc:Ignorable values. Those prefixes must remain declared even if they
  // occur only inside that attribute; Excel web rejects unbound references.
  function restoreCompatibilityNamespaces(xml) {
    const namespaces = {
      x14ac: 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac',
      x16r2: 'http://schemas.microsoft.com/office/spreadsheetml/2015/02/main',
      xr: 'http://schemas.microsoft.com/office/spreadsheetml/2014/revision',
      xr2: 'http://schemas.microsoft.com/office/spreadsheetml/2015/revision2',
      xr3: 'http://schemas.microsoft.com/office/spreadsheetml/2016/revision3'
    };
    return xml.replace(/<[^!?/][^>]*>/, root => {
      const ignorable = root.match(/\b[\w]+:Ignorable="([^"]*)"/);
      if (!ignorable) return root;
      let declarations = '';
      for (const prefix of new Set(ignorable[1].trim().split(/\s+/))) {
        if (root.includes(`xmlns:${prefix}=`)) continue;
        if (!namespaces[prefix]) throw new Error(`La plantilla contiene una extensión Excel no declarada: ${prefix}`);
        declarations += ` xmlns:${prefix}="${namespaces[prefix]}"`;
      }
      return root.replace(/>$/, declarations + '>');
    });
  }
  class Sheet {
    constructor(xml) {
      this.xml=xml;this.prefix=xml.match(/<([\w]+:)?worksheet\b/)[1]||'';this.rows=new Map();
      const data=xml.match(/<(?:\w+:)?sheetData\b[^>]*>([\s\S]*?)<\/(?:\w+:)?sheetData>/)[1];
      for(const m of data.matchAll(/<(?:\w+:)?row\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:\w+:)?row>)/g)){
        const header=m[0].match(/^<[^>]+>/)[0],n=Number(header.match(/\br="(\d+)"/)[1]);const cells=new Map();
        // Stop at self-closing cells: otherwise an empty cell consumes its
        // neighbour and leaves old formulas or duplicate cell addresses behind.
        for(const c of m[0].matchAll(/<(?:\w+:)?c\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:\w+:)?c>)/g))cells.set(c[0].match(/\br="([A-Z]+\d+)"/)[1],c[0]);
        this.rows.set(n,{header:header.replace(/\/>$/,'>'),cells});
      }
    }
    set(addr,value,formula=null){
      const n=Number(addr.match(/\d+/)[0]);if(!this.rows.has(n))this.rows.set(n,{header:`<${this.prefix}row r="${n}">`,cells:new Map()});
      const row=this.rows.get(n),old=row.cells.get(addr)||'',style=old.match(/\bs="(\d+)"/),p=this.prefix;
      let body='',type='';
      if(formula){body=`<${p}f>${escape(formula.replace(/^=/,''))}</${p}f>`;if(typeof value==='string')type=' t="str"';if(value!==null&&value!==undefined)body+=`<${p}v>${escape(value)}</${p}v>`;}
      else if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('Valor numérico inválido.');body=`<${p}v>${value}</${p}v>`;}
      else if(value!==null&&value!==undefined&&value!==''){type=' t="inlineStr"';body=`<${p}is><${p}t xml:space="preserve">${escape(value)}</${p}t></${p}is>`;}
      row.cells.set(addr,`<${p}c r="${addr}"${style?` s="${style[1]}"`:''}${type}>${body}</${p}c>`);
    }
    toXML(){
      const col=a=>[...a.match(/^[A-Z]+/)[0]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
      const data=[...this.rows].sort((a,b)=>a[0]-b[0]).map(([,r])=>r.header+[...r.cells].sort((a,b)=>col(a[0])-col(b[0])).map(x=>x[1]).join('')+`</${this.prefix}row>`).join('');
      return this.xml.replace(/(<(?:\w+:)?sheetData\b[^>]*>)[\s\S]*?(<\/(?:\w+:)?sheetData>)/,(_,open,close)=>open+data+close);
    }
  }
  async function build(template, data, commission, details, now) {
    const p=plan(data,commission,details,now),zip=await global.JSZip.loadAsync(template);
    const s=new Sheet(await zip.file('xl/worksheets/sheet1.xml').async('string')),b=new Sheet(await zip.file('xl/worksheets/sheet2.xml').async('string')),d=new Sheet(await zip.file('xl/worksheets/sheet10.xml').async('string'));
    const f=(sh,a,v,formula)=>sh.set(a,v,formula),v=(sh,a,x)=>sh.set(a,x),name=e=>e.apellidos||e.nombre||'',first=e=>e.nombre_pila||'';
    const byrow=new Map(p.records.map(e=>[e.row,e]));
    for(let r=10;r<=59;r++){
      const e=byrow.get(r);v(s,`A${r}`,e&&e.equipo?`GAMO-${e.equipo}`:'');
      for(const[c,key]of [['B','categoria'],['C','apellidos'],['F','nombre_pila'],['H','dni'],['J','cp']]){
        const value=e?(key==='apellidos'?name(e):e[key]||''):'';
        // Excel coerces a reference to an empty source cell to numeric zero.
        // Guard the source explicitly so unused template rows stay empty and
        // are not counted as additional members when Excel recalculates.
        const source=`${c}${r+490}`;
        v(s,source,value);f(s,`${c}${r}`,value,`IF(AND($E$4="5º",${source}<>""),${source},"")`);
      }
      v(s,`K${r}`,e?.reason||'');v(s,`M${r}`,'');
      const full=e?`${name(e)}, ${first(e)}`:'';
      f(s,`O${r}`,full,`IF(C${r}="","",CONCATENATE(C${r},", ",F${r}))`);
      f(s,`P${r}`,e&&!e.reason?1:0,`IF(AND(C${r}<>"",K${r}=""),1,0)`);
      f(s,`Q${r}`,e&&e.reason?1:0,`IF(AND(C${r}<>"",K${r}<>""),1,0)`);
    }
    for(let r=63;r<=72;r++){
      const e=p.aggregate[r-63];for(const[c,value]of Object.entries({B:e?.categoria,C:e?name(e):'',F:e?first(e):'',H:e?.dni,J:e?.cp,K:e?.origen?`Origen: ${e.origen}`:''}))v(s,`${c}${r}`,value||'');
      f(s,`O${r}`,e?`${name(e)}, ${first(e)}`:'',`IF(C${r}="","",CONCATENATE(C${r},", ",F${r}))`);f(s,`P${r}`,e?1:0,`IF(C${r}="",0,1)`);
    }
    for(const[a,x]of Object.entries({E4:'5º',H4:p.start,H5:p.end,K4:details.horaInicio?time(details.horaInicio):null,K5:details.horaFin?time(details.horaFin):null,D6:commission.localidad,D7:details.hotel,D8:details.localidadHotel,I7:details.motivo,F81:'Granada, a',I81:p.generated,I77:0}))v(s,a,x);
    f(s,'F4',5,'IF(E4="","",VLOOKUP(E4,A106:B112,2,0))');
    const counts={};for(const e of p.base)counts[e.reason]=(counts[e.reason]||0)+1;
    const list=['CH','BJ','AP','APA','VA','AFG','INAS','P','CU','CS','LS','JU','OTROS'];
    list.forEach((c,i)=>f(s,`C${74+i}`,counts[c]||0,`COUNTIF($K$10:$L$59,"${c}")`));
    for(const[a,x,formula]of [['I75',p.records.length,'IF(E4="","",SUM(P10:P59)+SUM(C74:C86))'],['I76',p.base.length,'SUM(C74:C86)'],['I78',p.aggregate.length,'SUM(P63:P72)'],['I79',p.total,'IF(I75="","",I75+I78-I77-I76)'],['K79',0,'COUNTIF(M10:M59,"SI, ACEPTA VOLUNTARIAMENTE (*)")'],['K80',0,'COUNTIF(M10:M59,"NO")']])f(s,a,x,formula);
    const ordered=[...p.records].sort(alphabet);
    for(let i=0;i<50;i++){
      const r=265+i,e=ordered[i],full=e?`${name(e)}, ${first(e)}`:'';
      for(const[c,value]of Object.entries({L:e?.categoria,M:e?name(e):'',P:e?first(e):'',R:e?.dni,T:e?.cp}))v(d,`${c}${r}`,value||'');
      f(d,`X${r}`,full,`IF(M${r}="","",CONCATENATE(M${r},", ",P${r}))`);
      f(d,`Z${r}`,e?(e.reason?0:1):'',`IF(X${r}="","",IFERROR(VLOOKUP(X${r},Salida!$O$10:$P$59,2,FALSE),""))`);
      f(d,`AB${r}`,e?.reason?e.categoria:'',`IF(Z${r}=0,L${r},"")`);f(d,`AC${r}`,e?.reason?full:'',`IF(Z${r}=0,X${r},"")`);
      for(const[c,source]of [['AE','AB'],['AF','AC']])f(d,`${c}${r}`,e?.reason?1:0,`IF(${source}${r}="",0,1)`);
    }
    for(let r=13;r<=31;r++){
      const e=p.base[r-13],source=e?265+ordered.findIndex(x=>x.id===e.id):null;
      if(e){f(b,`B${r}`,e.categoria,`Datos!AB${source}`);f(b,`C${r}`,`${name(e)}, ${first(e)}`,`Datos!AC${source}`);}else{v(b,`B${r}`,'');v(b,`C${r}`,'');}
      v(b,`D${r}`,'');
      for(let c=5;c<=31;c++){
        let text='';const date=new Date(Date.UTC(1899,11,30)+(p.start+c-5)*86400000).toISOString().slice(0,10);
        if(e&&c-5<=p.end-p.start){const types=[...new Set(e.permissions.filter(x=>x.fecha_inicio<=date&&x.fecha_fin>=date).map(x=>x.tipo))].sort(codeOrder);text=types.map(t=>codes[t]||t).join(' / ');}
        v(b,`${column(c)}${r}`,text);
      }
    }
    for(const[a,x,formula]of [['C5','GAMO-50','Salida!A10'],['I5',commission.localidad,'Salida!D6'],['I7',p.start,'Salida!H4'],['I8',p.end,'Salida!H5'],['S7',p.start,'I7'],['S8',p.end,'I8']])f(b,a,x,formula);
    v(b,'P7','0 DÍAS ANTES');v(b,'P8','');
    for(let c=5;c<=31;c++){
      const value=p.start+c-5,on=value<=p.end,weekday=((value+5)%7)+1,day=['L','M','X','J','V','S','D'][weekday-1];
      if(on){f(b,`${column(c)}12`,value,c===5?'$I$7':`${column(c-1)}12+1`);f(b,`${column(c)}11`,day,`CHOOSE(WEEKDAY(${column(c)}12,2),"L","M","X","J","V","S","D")`);f(b,`${column(c)}10`,(weekday%7)+1,`WEEKDAY(${column(c)}12)`);}else for(const r of [10,11,12])v(b,`${column(c)}${r}`,'');
    }
    zip.file('xl/worksheets/sheet1.xml',s.toXML());zip.file('xl/worksheets/sheet2.xml',b.toXML());zip.file('xl/worksheets/sheet10.xml',d.toXML());
    let workbook=await zip.file('xl/workbook.xml').async('string');
    const pref=workbook.match(/<([\w]+:)?workbook\b/)[1]||'';
    const calculation=`<${pref}calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>`;
    // Keep calcPr in its schema position, before extLst. Excel rebuilds the
    // calculation chain because this export replaces formulas from the template.
    const calcPattern=/<(?:\w+:)?calcPr\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:\w+:)?calcPr>)/;
    if(calcPattern.test(workbook))workbook=workbook.replace(calcPattern,()=>calculation);
    else workbook=workbook.replace(/<(?:\w+:)?(?:oleSize|customWorkbookViews|pivotCaches|smartTagPr|smartTagTypes|webPublishing|fileRecoveryPr|webPublishObjects|extLst)\b|<\/(?:\w+:)?workbook>/,match=>calculation+match);
    zip.file('xl/workbook.xml',workbook);
    zip.remove('xl/calcChain.xml');
    const relsPath='xl/_rels/workbook.xml.rels';
    zip.file(relsPath,(await zip.file(relsPath).async('string')).replace(/<(?:\w+:)?Relationship\b(?=[^>]*\bType="[^"]*\/calcChain")[^>]*\/>/g,''));
    const typesPath='[Content_Types].xml';
    zip.file(typesPath,(await zip.file(typesPath).async('string')).replace(/<(?:\w+:)?Override\b(?=[^>]*\bPartName="\/xl\/calcChain.xml")[^>]*\/>/g,''));
    for (const name of Object.keys(zip.files).filter(name => name.endsWith('.xml'))) {
      const original = await zip.file(name).async('string');
      const compatible = restoreCompatibilityNamespaces(original);
      if (compatible !== original) zip.file(name, compatible);
    }
    // The template's hour cells inherit General; use a true numeric Excel time format.
    const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
    return {bytes,plan:p,filename:`Control de salida ${commission.localidad} ${commission.fecha_inicio} al ${commission.fecha_fin}.xlsx`};
  }
  function time(t){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))throw new Error('Hora inválida.');const[h,m]=t.split(':').map(Number);return(h*60+m)/1440;}
  async function download(data,commission,details){
    const response=await fetch('templates/control-salida.xlsx');if(!response.ok)throw new Error('No se pudo cargar la plantilla del Control de salida.');
    const result=await build(await response.arrayBuffer(),data,commission,details);
    const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const a=document.createElement('a');a.href=url;a.download=result.filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    return result.plan;
  }
  global.ControlSalida={plan,build,download};
})(typeof window!=='undefined'?window:globalThis);
