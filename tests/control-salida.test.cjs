const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.JSZip = require('../js/jszip.min.js');
require('../js/control-salida.js');
const { plan, build } = global.ControlSalida;
const commission = { localidad:'Destino de prueba', fecha_inicio:'2026-11-02', fecha_fin:'2026-11-18', excluidos_manuales:['manual'], agregados:[{id:'external',nombre:'Persona externa',apellidos:'EXTERNA',nombre_pila:'Persona',categoria:'Policía',origen:'EOMA',dni:'PRUEBA',cp:'000'}] };
const person = (id,category,surname) => ({id,nombre:`Nombre ${surname}`,apellidos:surname,nombre_pila:'Nombre',categoria:category,equipo:'50',dni:'PRUEBA',cp:'000'});
const data = {efectivos:[person('officer','Oficial','ZETA'),person('police','Policía','ALFA'),person('manual','Inspector','MANUAL'),person('available','Subinspector','LIBRE')],permisos:[{policia_id:'officer',tipo:'AP',fecha_inicio:'2026-11-18',fecha_fin:'2026-11-20'},{policia_id:'police',tipo:'PT',fecha_inicio:'2026-11-01',fecha_fin:'2026-11-02'}]};
const details={motivo:'Prueba',hotel:'Hotel',localidadHotel:'Destino',horaInicio:'08:30',horaFin:''};
async function test(){
 const p=plan(data,commission,details);assert.equal(p.total,2);assert.deepEqual(p.base.map(x=>x.id),['manual','officer','police']);assert.equal(p.base.find(x=>x.id==='manual').reason,'OTROS');assert.equal(p.base.find(x=>x.id==='police').reason,'P');
 const many=structuredClone(data);many.permisos.push({policia_id:'officer',tipo:'BJ',fecha_inicio:'2026-11-02',fecha_fin:'2026-11-02'});assert.equal(plan(many,commission,details).base.find(x=>x.id==='officer').reason,'BJ');
 const nonOverlap=structuredClone(data);nonOverlap.permisos.push({policia_id:'available',tipo:'VA',fecha_inicio:'2026-11-19',fecha_fin:'2026-11-20'});assert.equal(plan(nonOverlap,commission,details).total,2);
 assert.throws(()=>plan(data,{...commission,fecha_fin:'2026-11-01'},details),/posterior/);assert.throws(()=>plan(data,{...commission,fecha_fin:'2026-12-01'},details),/27 días/);
 assert.throws(()=>plan({...data,efectivos:Array.from({length:51},(_,i)=>person('id'+i,'Policía','APELLIDO'+i))},commission,details),/50 integrantes/);
 assert.throws(()=>plan(data,{...commission,agregados:Array(11).fill(commission.agregados[0])},details),/10 agregados/);
 const template=fs.readFileSync(path.join(__dirname,'../templates/control-salida.xlsx'));
 const output=await build(template,data,commission,details,new Date('2026-10-15T23:30:00Z'));const zip=await JSZip.loadAsync(output.bytes);const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/Granada, a/);assert.match(xml,/Origen: EOMA/);assert.match(xml,/r="I79"[^>]*>[\s\S]*?<[^>]*v>2<\//);assert.equal(output.plan.generated,46311);
 assert(!xml.includes('<ns0:sheetData><ns0:sheetData>'));
 const source=await JSZip.loadAsync(template);for(const key of Object.keys(source.files).filter(k=>k.startsWith('xl/media/')))assert.equal(await source.file(key).async('base64'),await zip.file(key).async('base64'));
 // Excel requires each cell address to occur only once. Empty template cells
 // must not swallow neighbouring cells when their formulas are replaced.
 for(const sheet of ['sheet1','sheet2','sheet10']){
  const text=await zip.file(`xl/worksheets/${sheet}.xml`).async('string');
  const addresses=[...text.matchAll(/<(?:\w+:)?c\b[^>]*\br="([A-Z]+\d+)"/g)].map(m=>m[1]);
  assert.equal(new Set(addresses).size,addresses.length,`Duplicate cells in ${sheet}`);
 }
 for(const address of ['B10','C10','F10','H10','J10','O63']){
  const cell=xml.match(new RegExp(`<(?:\\w+:)?c\\b[^>]*\\br="${address}"[^>]*?(?:/>|>[\\s\\S]*?</(?:\\w+:)?c>)`))?.[0];
  assert(cell,`Missing ${address}`);assert(!cell.includes('t="shared"'),`Old shared formula in ${address}`);
 }
 // All fifty slots must guard the source, including unoccupied ones: an Excel
 // reference to a truly empty cell evaluates to zero and inflates the census.
 for(let row=10;row<=59;row++){
  for(const column of ['B','C','F','H','J']){
   const address=`${column}${row}`,source=`${column}${row+490}`;
   const cell=xml.match(new RegExp(`<(?:\\w+:)?c\\b[^>]*\\br="${address}"[^>]*>[\\s\\S]*?</(?:\\w+:)?c>`))?.[0];
   assert(cell?.includes(`${source}&lt;&gt;&quot;&quot;`),`Missing empty-source guard in ${address}`);
  }
 }
 const workbook=await zip.file('xl/workbook.xml').async('string');
 assert.equal((workbook.match(/<(?:\w+:)?calcPr\b/g)||[]).length,1);
 assert(workbook.indexOf('<calcPr')<workbook.indexOf('<extLst'),'calcPr must precede extLst');
 assert.equal(zip.file('xl/calcChain.xml'),null);
 assert(!(await zip.file('xl/_rels/workbook.xml.rels').async('string')).includes('/calcChain'));
 assert(!(await zip.file('[Content_Types].xml').async('string')).includes('/xl/calcChain.xml'));
 // XML parsers accept undeclared prefixes inside attribute values, but Excel
 // rejects them under the OOXML markup-compatibility rules.
 for(const name of Object.keys(zip.files).filter(name=>name.endsWith('.xml'))){
  const text=await zip.file(name).async('string');
  const root=text.match(/<[^!?/][^>]*>/)?.[0]||'';
  const ignored=root.match(/\b[\w]+:Ignorable="([^"]*)"/)?.[1]||'';
  for(const prefix of ignored.trim().split(/\s+/).filter(Boolean)){
   assert(root.includes(`xmlns:${prefix}=`),`Undeclared compatibility prefix ${prefix} in ${name}`);
  }
 }
 console.log('Control de salida: pruebas superadas.');
}
test().catch(e=>{console.error(e);process.exitCode=1;});
