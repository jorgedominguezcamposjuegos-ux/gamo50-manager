# Altas, bajas y cambios de distribución

Registro de aprendizaje del 17/10/2026. Esta guía es un procedimiento, no una
copia de los datos personales de quienes han causado baja. Leerla antes de
modificar la plantilla y comprobar el estado actual en cada intervención.

## Arquitectura y fuentes de datos

- La aplicación carga el listado operativo desde Firestore: `efectivos`,
  `permisos` y `comisiones`. El proyecto es `gamoweb-86915`.
- `data.json` es una copia versionada, no la fuente en tiempo real. Puede tener
  permisos, comisiones y datos distintos de Firebase. No migrarlo íntegramente
  sobre producción para ejecutar un cambio individual.
- `index.html` calcula listas, escalas y totales desde los registros cargados.
- `js/validation.js` calcula disponibilidad y elegibilidad para comisiones.
- `js/control-salida.js` genera el Control de salida a partir del listado
  actual y `templates/control-salida.xlsx`.
- La plantilla Excel tiene 50 plazas del grupo; esa capacidad NO es el censo.
- Los servicios de bloque indican necesidades numéricas, no asignan personas:
  no reducir sus necesidades automáticamente cuando cambia la plantilla.

## Lo que ocurrió en la última baja

Se identificó al integrante por su ID estable y se eliminó, en un lote de
Firestore, su registro, el permiso asociado y una referencia en
`excluidos_manuales`. Se verificó que esas referencias habían desaparecido.
La copia local se limpió además de referencias históricas en
`quitan_de_comision`, y se publicó únicamente el cambio de datos autorizado.

La copia local pasó de 40 a 39 integrantes, el SO 51 de 12 a 11 y Gamo 52
de 5 a 4. Son datos de esa operación, NO constantes para próximos cambios.
Confirmar siempre los numéricos actuales de Firebase de forma independiente.

Los problemas posteriores del Excel procedían de la plantilla y del generador.
No se deben resolver volviendo a añadir a una persona que haya causado baja ni
cambiando manualmente los totales para que coincidan con una cifra esperada.

## Procedimiento para una baja

1. Comprobar el estado Git, los cambios locales y la identidad exacta mediante
   ID de documento, ID de integrante, nombre, SO y equipo. No borrar por una
   coincidencia parcial de nombre. Los IDs de documentos de permiso pueden ser
   distintos del campo `id` almacenado dentro de ellos.
2. Registrar recuentos previos y comparar la distribución del resto de personas.
   Si la petición es baja definitiva con borrado asociado, eliminar esos datos.
   Si pide conservar historia o una baja con fecha futura, resolver primero ese
   alcance: el borrado físico elimina su presencia al consultar periodos pasados.
3. Localizar sus permisos y referencias en comisiones. Revisar
   `excluidos_manuales`, `quitan_de_comision`, `agregados`,
   `agregan_temporales` y otros campos realmente presentes. No asumir que el
   esquema actual cubre todos los documentos históricos.
4. Aplicar el cambio remoto acotado mediante lote o transacción cuando esté
   autorizado. No sustituir documentos completos de otras personas o comisiones.
5. Limpiar la copia local y buscar referencias por ID y nombre. Si se pide
   eliminar todos los datos, revisar también datos fuente de los Excel, hojas
   auxiliares, anotaciones y archivos versionados, no solo el texto visible.
6. Releer Firebase desde servidor, sin dar por válida una respuesta vacía de la
   caché ante un fallo de conexión. Verificar la ausencia de los registros y
   referencias objetivo y comparar los demás registros con el estado previo.
7. Actualizar la aplicación y verificar integrantes, gestión en base, comisiones,
   consulta individual, resumen de bloque y todos los documentos generados.

Eliminar del estado actual de Git no purga su historial. Reescribir el historial
o eliminar archivos de usuario requiere alcance explícito; no hacerlo como
consecuencia automática de una baja. Los Excel ya descargados tampoco cambian:
hay que generar documentos nuevos.

## Procedimiento para un alta o traslado interno

- Crear un ID único y estable. No reutilizar el ID de alguien que haya causado
  baja ni copiar sus permisos o exclusiones.
- Registrar nombre completo, categoría, función, SO, equipo y el campo
  `en_funciones` según los datos aportados. Conservar la distribución existente.
- Para el Control de salida revisar también `apellidos`, `nombre_pila`, `dni`,
  `cp` y, si existe asignación fija, `control_salida_fila`. Mantener DNI y CP como
  identificadores de texto, con sus ceros iniciales.
- `control_salida_fila` debe ser un entero único entre 10 y 59. Un hueco libre
  es válido; no desplazar a todos los demás para cerrar un hueco.
- Preservar el orden orgánico: EM/Gamo 50 primero, después SO 51, 54 y 57;
  dentro, equipo, categoría y el criterio existente. No renumerar equipos por
  haber eliminado o añadido una persona.
- Una persona del grupo y un agregado externo son registros distintos. Un
  agregado lleva origen y destino dentro de una comisión.
- Revisar `isAgentActiveOnDate`: actualmente contiene excepciones históricas
  basadas en nombres. No copiar ni ampliar estas excepciones por similitud.
- Comprobar la fecha efectiva del alta o traslado y su efecto sobre comisiones
  ya creadas. La elegibilidad se recalcula desde el listado actual; no existe
  un historial general de pertenencia que garantice por sí solo que una nueva
  alta quede fuera de todas las comisiones anteriores. Si se necesita ese
  comportamiento, requiere una solución específica antes de darlo por resuelto.

## Reconciliación de numéricos

Calcular desde personas reales, sin cifras fijas: total GO, totales por SO,
totales por equipo y desglose Inspector/Subinspector/Oficial/Policía.
La suma de los equipos debe coincidir con sus SO y la suma de los SO con el GO,
incluyendo EM una sola vez. Un traslado interno no cambia el total del GO.

En comisión, separar integrantes elegibles y agregados. Una situación que se
solape con cualquier parte del periodo impide participar en toda la comisión;
las exclusiones manuales también cuentan. En el Control de salida:

`total comisión = integrantes del grupo incluidos − personal en base + agregados`

La comprobación anterior del caso de prueba dio 39 integrantes, 13 en base,
5 agregados y 31 en comisión. Es una reconciliación fechada, no un valor fijo.

## Fallos del Excel que no deben reaparecer

1. El lector de XML consumía una celda vecina después de una celda autocerrada.
   Esto dejaba celdas duplicadas y fórmulas antiguas. Mantener el reconocimiento
   correcto de celdas y filas autocerradas y la prueba de direcciones únicas.
2. `calcPr` se insertaba después de `extLst`, fuera de su posición en el esquema.
   Conservar su posición correcta y una única configuración de recálculo.
3. Se conservaba la cadena de cálculo de la plantilla tras modificar fórmulas.
   Eliminar `calcChain.xml` y sus referencias de relaciones y tipos de contenido;
   Excel debe reconstruirla.
4. La plantilla conservaba `mc:Ignorable` con prefijos sin declarar tras una
   conversión XML. Restaurar sus declaraciones en todas las hojas y estilos.
   Un XML bien formado puede incumplir estas reglas y ser rechazado por Excel web.
5. `IF($E$4="5º",C500,"")` devolvía cero cuando C500 estaba realmente vacía.
   El recuento trataba ese cero como un nombre y convertía 39 en 50 al recalcular.
   Mantener la comprobación explícita del origen:
   `IF(AND($E$4="5º",C500<>""),C500,"")`, también en los demás campos fuente.
6. Un valor almacenado correcto no prueba que la fórmula sea correcta. El archivo
   guardaba 39 y podía mostrar 50 tras abrirse. Verificar ambos estados.
7. Cambiar la versión de carga de `js/control-salida.js` en `index.html` cuando
   cambie el generador, para evitar probar JavaScript antiguo de la caché.

## Verificación antes de entregar

- Ejecutar `npm run test:control-salida` y `git diff --check`.
- Comprobar totales y exclusión/inclusión del integrante afectado usando datos
  actuales; los datos de ejemplo no sustituyen esa comprobación.
- Validar ZIP, XML, compatibilidad de prefijos, celdas únicas y preservación de
  estilos e imágenes. No considerar que abrir con una biblioteca XML demuestra
  compatibilidad con Excel web.
- Probar huecos intermedios y finales, una plantilla parcialmente ocupada y los
  límites de capacidad. Se comprobó el recálculo de 1, 39 y 50 integrantes con un
  motor independiente, incluidas base y agregados.
- Generar un archivo nuevo y abrirlo en Excel web. El usuario confirmó el
  17/10/2026 que ya abre y que el numérico corregido es correcto. Para cambios
  futuros, verificar apertura y totales después de recalcular, no solo al descargar.
- Verificar que no cambian los SO, equipos, categorías, permisos ni destinos del
  resto de componentes. No usar migraciones globales para un cambio puntual.
- La plantilla actual admite 50 integrantes, 10 agregados, 19 personas en base
  y 27 días. No ampliar esos límites silenciosamente ni confundirlos con el censo.

## Estado al cerrar esta revisión

La baja de datos está publicada en GitHub y aplicada en Firebase. El usuario
confirmó que las correcciones del Excel funcionan en local y posteriormente
autorizó su publicación con «Deja la app lista para usar en la web».
Comprobar el estado Git y la versión servida por Hosting antes de la siguiente
operación. Esa autorización corresponde a esta entrega y no implica permiso
para publicar automáticamente futuros cambios del grupo.
