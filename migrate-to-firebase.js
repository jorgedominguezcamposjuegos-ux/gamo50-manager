/**
 * Script para migrar datos desde gamo50_db.json a Firebase Firestore
 * 
 * USO:
 * 1. Configura Firebase en js/firebase-config.js (ya configurado con proyecto Gamoweb)
 * 2. Ejecuta este script con Node.js: node migrate-to-firebase.js
 */

const fs = require('fs');
const path = require('path');

// Configuración Firebase del proyecto Gamoweb
const firebaseConfig = {
  apiKey: "AIzaSyBrZuIRv8-A2-GGXvL4nljh1i4TLGUObfo",
  authDomain: "gamoweb-86915.firebaseapp.com",
  projectId: "gamoweb-86915",
  storageBucket: "gamoweb-86915.firebasestorage.app",
  messagingSenderId: "1066187142301",
  appId: "1:1066187142301:web:d5ed56008e3d1d1170d074"
};

// Importar Firebase (requiere: npm install firebase)
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, setDoc } = require('firebase/firestore');

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Cargar datos JSON
const dataPath = path.join(__dirname, '..', 'data', 'gamo50_db.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

async function migrateData() {
  console.log('🚀 Iniciando migración a Firebase Firestore...\n');
  console.log('📊 Proyecto: gamoweb-86915\n');

  try {
    // Migrar efectivos
    console.log('📦 Migrando efectivos...');
    const efectivosRef = collection(db, 'efectivos');
    for (const efectivo of data.efectivos) {
      await setDoc(doc(efectivosRef, efectivo.id), efectivo);
    }
    console.log(`✅ ${data.efectivos.length} efectivos migrados`);

    // Migrar permisos
    console.log('📦 Migrando permisos...');
    const permisosRef = collection(db, 'permisos');
    for (const permiso of data.permisos) {
      await addDoc(permisosRef, permiso);
    }
    console.log(`✅ ${data.permisos.length} permisos migrados`);

    // Migrar comisiones
    console.log('📦 Migrando comisiones...');
    const comisionesRef = collection(db, 'comisiones');
    for (const comision of data.comisiones_servicio) {
      await addDoc(comisionesRef, comision);
    }
    console.log(`✅ ${data.comisiones_servicio.length} comisiones migrados`);

    console.log('\n✨ Migración completada con éxito!');
    console.log('📝 Ahora puedes abrir index.html en tu navegador.');
    console.log('🔗 URL local: file://' + path.join(__dirname, 'index.html'));

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

migrateData();
