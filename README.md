# Gamo 50 Manager - Firebase Web App

Aplicación web estática para gestionar permisos y comisiones del Gamo 50, utilizando Firebase Firestore como backend. Convertida desde la API Python original para permitir acceso remoto desde cualquier terminal.

**✅ Ya configurado con el proyecto Firebase Gamoweb existente.**

## 📁 Estructura del Proyecto

```
webapp/
├── index.html              # Aplicación web principal
├── js/
│   ├── validation.js       # Funciones de validación (convertidas de Python)
│   └── firebase-config.js  # Configuración Firebase (proyecto Gamoweb)
├── migrate-to-firebase.js  # Script para migrar datos a Firestore
├── package.json            # Dependencias para el script de migración
├── firestore.rules         # Reglas de seguridad para Firestore
└── README.md              # Este archivo
```

## 🚀 Configuración Inicial

### 1. Verificar Firestore Database

El proyecto usa el proyecto Firebase **gamoweb-86915**. Asegúrate de que:

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona el proyecto **gamoweb-86915**
3. Ve a **Build** → **Firestore Database**
4. Si no está creada, haz clic en **Create Database**
5. Selecciona una ubicación (recomendado: eur3 para Europa)
6. Elige **Start in Test Mode**

### 2. Configurar Reglas de Seguridad

1. En Firestore Database, ve a la pestaña **Rules**
2. Copia el contenido de `firestore.rules` y pégalo en el editor
3. Haz clic en **Publish**

### 3. Instalar Dependencias

Para ejecutar el script de migración, necesitas Node.js:

```bash
cd webapp
npm install
```

## 📤 Migrar Datos Existentes

El proyecto incluye un script para migrar los datos desde `data/gamo50_db.json` a Firebase Firestore:

```bash
node migrate-to-firebase.js
```

Este script creará las siguientes colecciones en Firestore:
- `efectivos`: Todos los efectivos del Gamo 50
- `permisos`: Todos los permisos registrados
- `comisiones`: Todas las comisiones de servicio

## 🌐 Despliegue

### Opción 1: Abrir Localmente (Más Rápido)

Simplemente abre el archivo `index.html` en tu navegador:

```bash
# En macOS
open webapp/index.html

# En Windows
start webapp/index.html

# En Linux
xdg-open webapp/index.html
```

### Opción 2: GitHub Pages (Recomendado para acceso remoto)

1. Sube el contenido de la carpeta `webapp/` a un repositorio de GitHub
2. Ve a **Settings** → **Pages**
3. En **Source**, selecciona la rama `main` (o `master`)
4. La aplicación estará disponible en `https://tu-usuario.github.io/tu-repo`

### Opción 3: Firebase Hosting

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login en Firebase
firebase login

# Inicializar hosting
firebase init hosting

# Desplegar
firebase deploy
```

### Opción 4: Cualquier Hosting Estático

Puedes desplegar la carpeta `webapp/` en cualquier servicio de hosting estático:
- Netlify
- Vercel
- AWS S3 + CloudFront
- Tu propio servidor web

## 🔧 Funcionalidades

La aplicación incluye todas las funcionalidades de la API Python original:

### Gestión de Permisos
- Registrar nuevos permisos con validación de cuotas
- Validación de reglas (límite global, límite por SO, mandos)
- Eliminar permisos
- Modificar permisos desde el calendario

### Gestión de Comisiones de Servicio
- Crear nuevas comisiones
- Añadir agregados temporales
- Excluir efectivos manualmente
- Ver distribución por equipos
- Generar cuadrantes en PDF

### Consulta de Disponibilidad
- Consultar disponibilidad por rango de fechas
- Ver reporte oficial con formato estándar
- Filtrar por SO y equipo

### Calendario Individual
- Vista calendario por agente
- Añadir/modificar permisos directamente
- Visualización de comisiones

## 📝 Funciones de Validación

Las funciones JavaScript en `js/validation.js` son equivalentes a las funciones Python originales:

- `isAgentActiveOnDate(agentName, targetDate)` - Verifica si un agente está activo en una fecha
- `checkPermisoQuotas(data, permiso)` - Valida cuotas de permisos antes de guardar
- `isAgentElegibleForComision(agentId, cIni, cFin, permisos, excluidos)` - Verifica elegibilidad para comisión
- `getDisponibilidad(data, fechaInicio, fechaFin)` - Calcula disponibilidad de efectivos
- `getComisionEfectivos(data, comision)` - Obtiene efectivos elegibles para una comisión

## 🔒 Seguridad

Las reglas de Firestore (`firestore.rules`) controlan el acceso a los datos. Por defecto, están configuradas para modo desarrollo. Para producción:

1. Implementa autenticación Firebase
2. Actualiza las reglas para verificar el usuario autenticado
3. Considera usar Cloud Functions para operaciones complejas

## 🐛 Solución de Problemas

### Error: "firebase-config.js no encontrado"
- Asegúrate de haber configurado `js/firebase-config.js` con tus credenciales

### Error: "Error cargando datos"
- Verifica que Firestore Database esté habilitado
- Comprueba que las reglas de Firestore permitan lectura/escritura
- Revisa la consola del navegador para más detalles

### Error: "Error conectando a Firebase"
- Verifica tu conexión a internet
- Confirma que las credenciales en `firebase-config.js` son correctas
- Asegúrate de que el proyecto Firebase existe

## 📚 Estructura de Datos en Firestore

### Colección: efectivos
```
{
  id: string,
  nombre: string,
  categoria: "Inspector" | "Subinspector" | "Oficial" | "Policía",
  so: string,
  equipo: string,
  funcion: "JSO" | "JEO" | "Componente" | "Mando",
  en_funciones: boolean
}
```

### Colección: permisos
```
{
  policia_id: string,
  tipo: "AP" | "VA" | "AFG" | "CH" | "CU" | "BJ" | "PT",
  fecha_inicio: string (YYYY-MM-DD),
  fecha_fin: string (YYYY-MM-DD),
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Colección: comisiones
```
{
  localidad: string,
  fecha_inicio: string (YYYY-MM-DD),
  fecha_fin: string (YYYY-MM-DD),
  agregados: array,
  excluidos_manuales: array,
  observaciones: string,
  createdAt: timestamp
}
```

## 🤝 Contribuciones

Este proyecto es una conversión de la API Python original a una aplicación web estática con Firebase. Las mejoras son bienvenidas.

## 📄 Licencia

Este proyecto es para uso interno del Gamo 50.
