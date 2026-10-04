const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Servir los archivos del frontend estáticamente
app.use(express.static(path.join(__dirname)));

// Conectar a la Base de Datos SQLite (creará el archivo alertas.db localmente)
const db = new sqlite3.Database('./alertas.db', (err) => {
  if (err) console.error("Error al abrir DB:", err.message);
  else console.log('Conectado a la Base de Datos Local (SQLite).');
});

// Inicializar la tabla y poblarla con datos de prueba si está vacía
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS alertas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL,
    lng REAL,
    titulo TEXT,
    descripcion TEXT,
    plataforma TEXT,
    nivel TEXT,
    confirmaciones INTEGER,
    alcance TEXT,
    mensaje_repetido TEXT,
    victima_url TEXT
  )`);

  db.get("SELECT COUNT(*) as count FROM alertas", (err, row) => {
    if (row && row.count === 0) {
      console.log("Poblando base de datos por primera vez...");
      const stmt = db.prepare("INSERT INTO alertas (lat, lng, titulo, descripcion, plataforma, nivel, confirmaciones, alcance, mensaje_repetido, victima_url) VALUES (?,?,?,?,?,?,?,?,?,?)");
      
      // Muestra de datos reales
      stmt.run(-16.5, -68.1, "Estafa Masiva WhatsApp", "Bots enviando enlaces fraudulentos ofreciendo 'trabajo remoto'.", "WhatsApp", "peligro", 142, "zona", "Gana $100 diarios. Clic aquí: http://phishing.com", "https://whatsapp.com");
      stmt.run(40.7, -74.0, "Manipulación de Mercado (NY)", "Ataque coordinado en foros de Reddit para inflar una acción.", "Reddit", "peligro", 5400, "mundo", "BUY $FAKE STOCK NOW! 🚀🚀", "https://reddit.com/r/wallstreetbets");
      stmt.run(-17.38, -66.15, "Acoso Cibernético Coordinado", "Cuentas sin foto atacando un perfil.", "Facebook", "advertencia", 35, "departamento", "Insulto automatizado #89", "https://facebook.com/perfil-falso");
      
      stmt.finalize();
    }
  });
});

// === RUTAS DE LA API (BACKEND) ===

// 1. Obtener todas las alertas
app.get('/api/alertas', (req, res) => {
  db.all("SELECT * FROM alertas", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 2. Crear una nueva alerta (Denuncia)
app.post('/api/alertas', (req, res) => {
  const { lat, lng, titulo, descripcion, plataforma, nivel, alcance, mensaje_repetido, victima_url } = req.body;
  const sql = `INSERT INTO alertas (lat, lng, titulo, descripcion, plataforma, nivel, confirmaciones, alcance, mensaje_repetido, victima_url) VALUES (?,?,?,?,?,?,?,?,?,?)`;
  
  db.run(sql, [lat, lng, titulo, descripcion, plataforma, nivel, 1, alcance, mensaje_repetido, victima_url], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, success: true });
  });
});

// 3. Confirmar/Validar un ataque (Incrementar contador)
app.post('/api/alertas/:id/confirmar', (req, res) => {
  db.run("UPDATE alertas SET confirmaciones = confirmaciones + 1 WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, confirmaciones_actualizadas: this.changes });
  });
});

// Iniciar Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 SERVIDOR BACKEND ACTIVO EN EL PUERTO: ${PORT}`);
  console.log(`======================================================`);
});
