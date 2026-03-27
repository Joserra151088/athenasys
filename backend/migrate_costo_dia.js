require('dotenv').config({ path: './.env' })
const mysql = require('mysql2/promise')

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'aion',
  })

  // Verificar si la columna ya existe antes de agregarla
  const [cols] = await pool.query(
    'SELECT COUNT(*) as c FROM information_schema.columns WHERE table_schema=? AND table_name="dispositivos" AND column_name="costo_dia"',
    [process.env.DB_NAME || 'aion']
  )
  if (cols[0].c === 0) {
    await pool.query('ALTER TABLE dispositivos ADD COLUMN costo_dia DECIMAL(10,2) DEFAULT 0 AFTER caracteristicas')
    console.log('✓ Columna costo_dia agregada')
  } else {
    console.log('✓ Columna costo_dia ya existía')
  }

  const rates = {
    'CPU': 85, 'Laptop': 95, 'Impresora': 35, 'Tablet': 50,
    'Cámara Web': 12, 'Diademas': 10, 'Biométrico': 18,
    'BAM (M4)': 25, 'Celular': 40
  }
  // Módem de Internet necesita literal para evitar encoding issues
  await pool.query('UPDATE dispositivos SET costo_dia=20 WHERE tipo=?', ['Módem de Internet'])

  for (const [tipo, costo] of Object.entries(rates)) {
    const [r] = await pool.query('UPDATE dispositivos SET costo_dia=? WHERE tipo=?', [costo, tipo])
    console.log(tipo.padEnd(22), '→ $' + costo + '/día', r.affectedRows ? `(${r.affectedRows} filas)` : '')
  }

  const [devs] = await pool.query('SELECT tipo, serie, costo_dia FROM dispositivos ORDER BY tipo')
  console.log('\n--- Dispositivos actualizados ---')
  devs.forEach(d => console.log(d.tipo.padEnd(12), d.serie.padEnd(20), '$' + d.costo_dia + '/día'))

  await pool.end()
  console.log('\n✓ Migración completada')
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
