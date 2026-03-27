require('dotenv').config({ path: './.env' })
const mysql = require('mysql2/promise')

async function run() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port: 3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD
  })
  await conn.query('CREATE SCHEMA IF NOT EXISTS athenasys CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
  console.log('✓ Schema athenasys creado')

  const [tables] = await conn.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='aion'"
  )
  for (const row of tables) {
    const t = row.TABLE_NAME
    try {
      await conn.query('CREATE TABLE athenasys.`' + t + '` LIKE aion.`' + t + '`')
      await conn.query('INSERT INTO athenasys.`' + t + '` SELECT * FROM aion.`' + t + '`')
      console.log('✓ Copiado:', t)
    } catch(e) {
      console.log('⚠ Skip', t, '-', e.message.slice(0, 60))
    }
  }
  await conn.end()
  console.log('✅ Migración completa: aion → athenasys')
}

run().catch(e => { console.error('❌', e.message); process.exit(1) })
