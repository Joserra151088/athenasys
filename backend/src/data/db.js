/**
 * db.js — Adaptador MySQL con API compatible con lowdb v1
 *
 * - Lee/escribe en MySQL como base de datos primaria
 * - Mantiene caché en memoria para lecturas síncronas (misma API que lowdb)
 * - Escrituras se persisten a MySQL de forma asíncrona (fire-and-forget)
 * - NO requiere cambios en las rutas existentes
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const mysql  = require('mysql2/promise')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const fs     = require('fs')
const path   = require('path')

// ─── Campos que se almacenan como JSON string en MySQL ───────────────────────
const JSON_FIELDS = {
  documentos:   ['dispositivos'],
  plantillas:   ['versiones'],
  cotizaciones: ['items'],
  tarifas_equipo: ['incluye'],
  presupuesto_partidas: ['montos_por_mes'],
  dispositivos: ['campos_extra'],
}

// ─── Store en memoria ────────────────────────────────────────────────────────
const _data    = {}
let   _pool    = null
// Caché de columnas reales por tabla (se llena al hacer loadTable)
const _columns = {}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Columnas que MySQL espera como DATETIME / DATE
const DATETIME_COLS = new Set([
  'created_at','updated_at','fecha','fecha_asignacion','fecha_devolucion',
  'fecha_firma','fecha_retorno','fecha_estimada_retorno','valido_desde',
  'fecha_liberacion',
])
const DATE_COLS = new Set(['fecha_inicio','fecha_vencimiento'])

function toMySQLDatetime(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().slice(0, 19).replace('T', ' ')
  if (typeof val === 'string' && val.includes('T')) return val.slice(0, 19).replace('T', ' ')
  return val
}
function toMySQLDate(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'string' && val.includes('T')) return val.slice(0, 10)
  return val
}

function serialize(table, row) {
  const out = { ...row }
  for (const field of (JSON_FIELDS[table] || [])) {
    if (out[field] !== undefined && out[field] !== null) {
      out[field] = typeof out[field] === 'string' ? out[field] : JSON.stringify(out[field])
    }
  }
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'boolean') out[k] = v ? 1 : 0
    else if (DATETIME_COLS.has(k)) out[k] = toMySQLDatetime(v)
    else if (DATE_COLS.has(k))     out[k] = toMySQLDate(v)
  }
  return out
}

function deserialize(table, row) {
  if (!row) return row
  const out = { ...row }
  for (const field of (JSON_FIELDS[table] || [])) {
    if (typeof out[field] === 'string') {
      try { out[field] = JSON.parse(out[field]) } catch (_) { out[field] = [] }
    }
  }
  const boolFields = ['activo','firmado','es_paquete']
  for (const f of boolFields) {
    if (f in out) out[f] = out[f] === 1 || out[f] === true
  }
  // Convertir objetos Date de MySQL a ISO strings
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof Date) out[k] = v.toISOString()
  }
  return out
}

async function loadTable(table) {
  try {
    const [rows] = await _pool.query(`SELECT * FROM \`${table}\``)
    _data[table] = rows.map(r => deserialize(table, r))
    // Guardar columnas reales del resultado para filtrar SETs/INSERTs
    if (rows.length > 0) {
      _columns[table] = Object.keys(rows[0])
    } else {
      // Si la tabla está vacía, consultar el schema directamente
      const [cols] = await _pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION`,
        [table]
      )
      _columns[table] = cols.map(c => c.COLUMN_NAME)
    }
  } catch (_) {
    _data[table] = []
  }
}

function filterToKnownCols(table, row) {
  const known = _columns[table]
  if (!known || !known.length) return row   // sin caché → pasar todo
  return Object.fromEntries(Object.entries(row).filter(([k]) => known.includes(k)))
}

async function persistInsert(table, items) {
  if (!_pool || !items.length) return
  try {
    for (const item of items) {
      const raw  = filterToKnownCols(table, serialize(table, item))
      const cols = Object.keys(raw).map(k => `\`${k}\``).join(', ')
      const vals = Object.values(raw)
      const phs  = vals.map(() => '?').join(', ')
      await _pool.query(
        `INSERT INTO \`${table}\` (${cols}) VALUES (${phs}) ON DUPLICATE KEY UPDATE \`id\`=\`id\``,
        vals
      )
    }
  } catch (e) {
    console.error(`[DB] INSERT error [${table}]:`, e.message)
  }
}

async function persistBulkInsert(table, items) {
  if (!_pool || !items.length) return
  try {
    const sample = filterToKnownCols(table, serialize(table, items[0]))
    const cols   = Object.keys(sample).map(k => `\`${k}\``).join(', ')
    const values = items.map(item => Object.values(filterToKnownCols(table, serialize(table, item))))
    const phs    = values.map(r => `(${r.map(() => '?').join(', ')})`).join(', ')
    const flat   = values.flat()
    await _pool.query(
      `INSERT INTO \`${table}\` (${cols}) VALUES ${phs} ON DUPLICATE KEY UPDATE \`id\`=\`id\``,
      flat
    )
  } catch (e) {
    console.error(`[DB] BULK INSERT error [${table}]:`, e.message)
  }
}

async function persistUpdate(table, id, updates) {
  if (!_pool) return
  try {
    const raw  = filterToKnownCols(table, serialize(table, updates))
    // Nunca actualizar el id en un SET
    delete raw.id
    if (!Object.keys(raw).length) {
      console.warn(`[DB] UPDATE [${table}] id=${id}: sin columnas válidas — revisa que las columnas existen en MySQL`)
      return
    }
    const sets = Object.keys(raw).map(k => `\`${k}\` = ?`).join(', ')
    const vals = [...Object.values(raw), id]
    const [result] = await _pool.query(`UPDATE \`${table}\` SET ${sets} WHERE \`id\` = ?`, vals)
    if (result.affectedRows === 0) {
      console.warn(`[DB] UPDATE [${table}] id=${id}: 0 filas afectadas (¿el id existe en MySQL?)`)
    }
  } catch (e) {
    console.error(`[DB] UPDATE error [${table}] id=${id}:`, e.message, '| Columnas intentadas:', Object.keys(serialize(table, updates)).join(','))
  }
}

async function persistDelete(table, id) {
  if (!_pool) return
  try {
    await _pool.query(`DELETE FROM \`${table}\` WHERE \`id\` = ?`, [id])
  } catch (e) {
    console.error(`[DB] DELETE error [${table}]:`, e.message)
  }
}

// ─── QueryBuilder (imita la API de lowdb) ────────────────────────────────────
class QueryBuilder {
  constructor(table, items) {
    this._table   = table
    this._items   = items
    this._single  = false
    this._findCond = null
    this._pending  = null
  }

  filter(predOrObj) {
    const pred = typeof predOrObj === 'function'
      ? predOrObj
      : (item) => Object.entries(predOrObj).every(([k, v]) => item[k] === v)
    this._items = this._items.filter(pred)
    return this
  }

  find(predOrObj) {
    this._single   = true
    this._findCond = predOrObj
    const pred = typeof predOrObj === 'function'
      ? predOrObj
      : (item) => Object.entries(predOrObj).every(([k, v]) => item[k] === v)
    this._items = this._items.filter(pred)
    return this
  }

  push(...newItems) {
    if (!_data[this._table]) _data[this._table] = []   // defensive init
    for (const item of newItems) {
      _data[this._table].push(item)
    }
    this._pending = { type: 'insert', items: newItems }
    return this
  }

  remove(predOrObj) {
    const pred = typeof predOrObj === 'function'
      ? predOrObj
      : (item) => Object.entries(predOrObj).every(([k, v]) => item[k] === v)
    const toRemove = _data[this._table].filter(pred)
    _data[this._table] = _data[this._table].filter(item => !pred(item))
    this._items = []
    if (toRemove.length > 0) {
      this._pending = { type: 'delete', ids: toRemove.map(i => i.id) }
    }
    return this
  }

  assign(updates) {
    // Actualizar en memoria
    const cond = this._findCond
    if (cond) {
      const pred = typeof cond === 'function'
        ? cond
        : (item) => Object.entries(cond).every(([k, v]) => item[k] === v)

      // Capturar el id ANTES de aplicar el update en memoria.
      // Si buscamos después, el predicado puede no encontrar el registro
      // porque algún campo del update (ej. activo: false) ya no coincide
      // con la condición original (activo: true).
      const originalItem = this._items[0]

      _data[this._table] = _data[this._table].map(item =>
        pred(item) ? { ...item, ...updates } : item
      )

      if (originalItem?.id) {
        this._pending = { type: 'update', id: originalItem.id, updates }
      }
    }
    return this
  }

  write() {
    if (!this._pending) return this
    const { type, items, id, updates, ids } = this._pending
    if (type === 'insert') {
      const big = items.length > 50
      ;(big ? persistBulkInsert(this._table, items) : persistInsert(this._table, items))
        .catch(e => console.error(`[DB] INSERT [${this._table}]:`, e.message))
    } else if (type === 'update' && id) {
      persistUpdate(this._table, id, updates)
        .catch(e => console.error(`[DB] UPDATE [${this._table}]:`, e.message))
    } else if (type === 'delete' && ids?.length) {
      for (const rid of ids) {
        persistDelete(this._table, rid)
          .catch(e => console.error(`[DB] DELETE [${this._table}]:`, e.message))
      }
    }
    return this
  }

  value() {
    if (this._single) return this._items[0] ?? null
    return [...this._items]
  }

  size()       { return { value: () => this._items.length } }
  take(n)      { this._items = this._items.slice(0, n); return this }
  sort(fn)     { this._items = [...this._items].sort(fn); return this }
  map(fn)      { this._items = this._items.map(fn); return this }
}

// ─── Objeto db principal ──────────────────────────────────────────────────────
const db = {
  get(table) {
    return new QueryBuilder(table, [...(_data[table] || [])])
  },
  defaults(obj) {
    for (const [k, v] of Object.entries(obj)) {
      if (!_data[k]) _data[k] = v
    }
    return { write: () => db }
  },
}

// ─── DDL de todas las tablas ─────────────────────────────────────────────────
const DDL = [
  // ── Catálogos ──
  `CREATE TABLE IF NOT EXISTS \`catalogo_tipos_dispositivo\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`nombre\` VARCHAR(100) NOT NULL,
    \`orden\` INT DEFAULT 0,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`catalogo_tipos_licencia\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`nombre\` VARCHAR(100) NOT NULL,
    \`orden\` INT DEFAULT 0,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`catalogo_areas\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`nombre\` VARCHAR(150) NOT NULL,
    \`orden\` INT DEFAULT 0,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`catalogo_marcas\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`nombre\` VARCHAR(100) NOT NULL,
    \`orden\` INT DEFAULT 0,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`usuarios_sistema\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`username\` VARCHAR(100) UNIQUE NOT NULL,
    \`password\` VARCHAR(255) NOT NULL,
    \`nombre\` VARCHAR(200),
    \`email\` VARCHAR(200),
    \`rol\` ENUM('super_admin','agente_soporte','vista') DEFAULT 'vista',
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME,
    \`firma_base64\` MEDIUMTEXT,
    \`firma_path\` VARCHAR(500)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`dispositivos\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`tipo\` VARCHAR(100),
    \`marca\` VARCHAR(100),
    \`serie\` VARCHAR(200),
    \`modelo\` VARCHAR(200),
    \`cantidad\` INT DEFAULT 1,
    \`proveedor_id\` VARCHAR(36),
    \`proveedor_nombre\` VARCHAR(200),
    \`caracteristicas\` TEXT,
    \`costo_dia\` DECIMAL(10,2) DEFAULT 0,
    \`estado\` ENUM('activo','en_reparacion','danado','baja','stock') DEFAULT 'stock',
    \`ubicacion_tipo\` ENUM('almacen','sucursal','empleado','proveedor') DEFAULT 'almacen',
    \`ubicacion_id\` VARCHAR(36),
    \`ubicacion_nombre\` VARCHAR(200),
    \`lat\` DECIMAL(10,7),
    \`lng\` DECIMAL(10,7),
    \`creado_por\` VARCHAR(36),
    \`creado_por_nombre\` VARCHAR(200),
    \`actualizado_por\` VARCHAR(36),
    \`actualizado_por_nombre\` VARCHAR(200),
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`empleados\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`nombre_completo\` VARCHAR(200) NOT NULL,
    \`num_empleado\` VARCHAR(100) UNIQUE NOT NULL,
    \`puesto\` VARCHAR(200),
    \`area\` VARCHAR(200),
    \`centro_costos\` VARCHAR(100),
    \`centro_costo_codigo\` VARCHAR(100),
    \`centro_costo_nombre\` VARCHAR(300),
    \`jefe_inmediato\` VARCHAR(36),
    \`jefe_nombre\` VARCHAR(200),
    \`sucursal_id\` VARCHAR(36),
    \`sucursal_nombre\` VARCHAR(200),
    \`email\` VARCHAR(200),
    \`telefono\` VARCHAR(50),
    \`foto_url\` VARCHAR(500),
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`sucursales\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`nombre\` VARCHAR(200) NOT NULL,
    \`tipo\` ENUM('corporativo','sucursal') DEFAULT 'sucursal',
    \`direccion\` TEXT,
    \`estado\` VARCHAR(100),
    \`lat\` DECIMAL(10,7),
    \`lng\` DECIMAL(10,7),
    \`email\` VARCHAR(200),
    \`centro_costos\` VARCHAR(100),
    \`centro_costo_codigo\` VARCHAR(100),
    \`centro_costo_nombre\` VARCHAR(300),
    \`determinante\` INT DEFAULT NULL,
    \`foto_url\` VARCHAR(500),
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`asignaciones\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`dispositivo_id\` VARCHAR(36),
    \`dispositivo_tipo\` VARCHAR(100),
    \`dispositivo_serie\` VARCHAR(200),
    \`tipo_asignacion\` ENUM('empleado','sucursal') DEFAULT 'empleado',
    \`asignado_a_id\` VARCHAR(36),
    \`asignado_a_nombre\` VARCHAR(200),
    \`asignado_por_id\` VARCHAR(36),
    \`asignado_por_nombre\` VARCHAR(200),
    \`fecha_asignacion\` DATETIME,
    \`fecha_devolucion\` DATETIME,
    \`observaciones\` TEXT,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`documentos\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`folio\` VARCHAR(100),
    \`tipo\` ENUM('entrada','salida','responsiva'),
    \`plantilla_id\` VARCHAR(36),
    \`entidad_tipo\` VARCHAR(50),
    \`entidad_id\` VARCHAR(36),
    \`entidad_nombre\` VARCHAR(200),
    \`dispositivos\` LONGTEXT,
    \`agente_id\` VARCHAR(36),
    \`agente_nombre\` VARCHAR(200),
    \`firma_agente\` MEDIUMTEXT,
    \`receptor_id\` VARCHAR(36),
    \`receptor_nombre\` VARCHAR(200),
    \`firma_receptor\` MEDIUMTEXT,
    \`firmado\` TINYINT(1) DEFAULT 0,
    \`fecha_firma\` DATETIME,
    \`observaciones\` TEXT,
    \`pdf_path\` VARCHAR(500),
    \`created_by\` VARCHAR(36),
    \`created_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`plantillas\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`tipo\` VARCHAR(50),
    \`nombre\` VARCHAR(200),
    \`texto_legal\` LONGTEXT,
    \`version\` INT DEFAULT 1,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`creado_por\` VARCHAR(36),
    \`creado_por_nombre\` VARCHAR(200),
    \`modificado_por\` VARCHAR(36),
    \`modificado_por_nombre\` VARCHAR(200),
    \`versiones\` LONGTEXT,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`cambios\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`dispositivo_id\` VARCHAR(36),
    \`dispositivo_serie\` VARCHAR(200),
    \`dispositivo_tipo\` VARCHAR(100),
    \`tipo_cambio\` ENUM('reparacion','baja_definitiva','actualizacion'),
    \`proveedor_id\` VARCHAR(36),
    \`proveedor_nombre\` VARCHAR(200),
    \`motivo\` TEXT,
    \`descripcion\` TEXT,
    \`fecha_estimada_retorno\` DATETIME,
    \`fecha_retorno\` DATETIME,
    \`estado\` ENUM('en_proceso','completado','cancelado') DEFAULT 'en_proceso',
    \`creado_por\` VARCHAR(36),
    \`creado_por_nombre\` VARCHAR(200),
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`cotizaciones\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`folio\` VARCHAR(100),
    \`cliente\` VARCHAR(200),
    \`descripcion\` TEXT,
    \`items\` LONGTEXT,
    \`subtotal\` DECIMAL(15,2),
    \`iva\` DECIMAL(15,2),
    \`total\` DECIMAL(15,2),
    \`total_mxn\` DECIMAL(15,2),
    \`moneda\` ENUM('MXN','USD') DEFAULT 'MXN',
    \`tipo_cambio\` DECIMAL(10,4) DEFAULT 1,
    \`notas\` TEXT,
    \`estado\` ENUM('borrador','enviada','aceptada','rechazada') DEFAULT 'borrador',
    \`fecha_vencimiento\` DATE,
    \`creado_por\` VARCHAR(36),
    \`creado_por_nombre\` VARCHAR(200),
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`repositorio_cotizacion\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`nombre\` VARCHAR(200),
    \`descripcion\` TEXT,
    \`precio\` DECIMAL(15,2),
    \`moneda\` VARCHAR(10) DEFAULT 'MXN',
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`proveedores\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`nombre\` VARCHAR(200) NOT NULL,
    \`contacto\` VARCHAR(200),
    \`telefono\` VARCHAR(50),
    \`contacto_nombre\` VARCHAR(200),
    \`rfc\` VARCHAR(20),
    \`direccion\` TEXT,
    \`url_web\` VARCHAR(500),
    \`imagen\` LONGTEXT,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`proveedor_documentos\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`proveedor_id\` VARCHAR(36) NOT NULL,
    \`nombre\` VARCHAR(200) NOT NULL,
    \`tipo\` ENUM('contrato','constancia_fiscal','otro') DEFAULT 'otro',
    \`archivo\` LONGTEXT,
    \`nombre_archivo\` VARCHAR(500),
    \`created_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`catalogo_supervisores\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`nombre\` VARCHAR(200) NOT NULL,
    \`orden\` INT DEFAULT 0,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`catalogo_puestos\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`nombre\` VARCHAR(200) NOT NULL,
    \`orden\` INT DEFAULT 0,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`firma_tokens\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`token\` VARCHAR(64) UNIQUE NOT NULL,
    \`documento_id\` VARCHAR(36) NOT NULL,
    \`estado\` ENUM('pendiente','firmado','expirado','cancelado') DEFAULT 'pendiente',
    \`expires_at\` DATETIME NOT NULL,
    \`firma_receptor\` MEDIUMTEXT,
    \`firmado_at\` DATETIME,
    \`ip_firmante\` VARCHAR(100),
    \`created_at\` DATETIME,
    \`created_by\` VARCHAR(36)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`licencias\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`nombre\` VARCHAR(200),
    \`tipo\` VARCHAR(100),
    \`proveedor_id\` VARCHAR(36),
    \`proveedor_nombre\` VARCHAR(200),
    \`clave_licencia\` VARCHAR(200),
    \`version\` VARCHAR(100),
    \`descripcion\` TEXT,
    \`costo\` DECIMAL(15,4),
    \`moneda\` VARCHAR(10) DEFAULT 'MXN',
    \`tipo_costo\` ENUM('mensual','anual','unico') DEFAULT 'mensual',
    \`tipo_cambio\` DECIMAL(10,4) DEFAULT 17.15,
    \`fecha_inicio\` DATE,
    \`fecha_vencimiento\` DATE,
    \`total_asientos\` INT DEFAULT 0,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`creado_por\` VARCHAR(36),
    \`creado_por_nombre\` VARCHAR(200),
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`asignaciones_licencias\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`licencia_id\` VARCHAR(36),
    \`tipo_asignado\` VARCHAR(20) DEFAULT 'empleado',
    \`empleado_id\` VARCHAR(36),
    \`empleado_nombre\` VARCHAR(200),
    \`sucursal_id\` VARCHAR(36),
    \`sucursal_nombre\` VARCHAR(200),
    \`asignado_por\` VARCHAR(36),
    \`asignado_por_nombre\` VARCHAR(200),
    \`fecha_asignacion\` DATETIME,
    \`fecha_liberacion\` DATETIME,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`centros_costo\` (
    \`id\` VARCHAR(100) PRIMARY KEY,
    \`codigo\` VARCHAR(100),
    \`sort_code\` VARCHAR(100),
    \`nombre\` VARCHAR(300),
    \`activo\` TINYINT(1) DEFAULT 1,
    \`valido_desde\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`tarifas_equipo\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`tipo\` VARCHAR(100),
    \`nombre_display\` VARCHAR(200),
    \`costo_dia\` DECIMAL(10,2),
    \`moneda\` VARCHAR(10) DEFAULT 'MXN',
    \`es_paquete\` TINYINT(1) DEFAULT 0,
    \`incluye\` TEXT,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`auditoria\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`usuario_id\` VARCHAR(36),
    \`usuario_nombre\` VARCHAR(200),
    \`accion\` VARCHAR(100),
    \`entidad\` VARCHAR(100),
    \`entidad_id\` VARCHAR(36),
    \`datos\` LONGTEXT,
    \`ip\` VARCHAR(50),
    \`fecha\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`presupuesto_agrupadores\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`nombre\` VARCHAR(200) NOT NULL,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`presupuesto_partidas\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`empresa\` VARCHAR(100),
    \`agrupador\` VARCHAR(200),
    \`proveedor\` VARCHAR(200),
    \`concepto\` VARCHAR(500),
    \`monto_mensual\` DECIMAL(15,2) DEFAULT 0,
    \`activo\` TINYINT(1) DEFAULT 1,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`presupuesto_gastos_mes\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`partida_id\` VARCHAR(36),
    \`mes\` INT,
    \`anio\` INT,
    \`gasto_real\` DECIMAL(15,2) DEFAULT 0,
    \`factura_folio\` VARCHAR(200),
    \`ahorro_soporte\` DECIMAL(15,2) DEFAULT 0,
    \`ahorro_descripcion\` TEXT,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`presupuesto_cambios\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`partida_id\` VARCHAR(36),
    \`mes\` INT,
    \`anio\` INT,
    \`monto_anterior\` DECIMAL(15,2),
    \`monto_nuevo\` DECIMAL(15,2),
    \`evidencia_url\` VARCHAR(500),
    \`nota\` TEXT,
    \`creado_por\` VARCHAR(36),
    \`creado_por_nombre\` VARCHAR(200),
    \`created_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`configuracion\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`clave\` VARCHAR(100) UNIQUE NOT NULL,
    \`valor\` LONGTEXT,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`finanzas_detalle\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`mes\` INT,
    \`anio\` INT,
    \`nombre\` VARCHAR(300),
    \`email\` VARCHAR(200),
    \`telefono_serie\` VARCHAR(200),
    \`departamento\` VARCHAR(200),
    \`subdepartamento\` VARCHAR(200),
    \`puesto\` VARCHAR(200),
    \`contrato_vigencia\` VARCHAR(200),
    \`proveedor\` VARCHAR(200),
    \`factura_folio\` VARCHAR(200),
    \`tipo_servicio\` VARCHAR(200),
    \`moneda\` ENUM('MXN','USD') DEFAULT 'MXN',
    \`tipo_cambio\` DECIMAL(10,4) DEFAULT 1,
    \`dias_facturados\` INT DEFAULT 30,
    \`costo_dia\` DECIMAL(15,4) DEFAULT 0,
    \`subtotal\` DECIMAL(15,2) DEFAULT 0,
    \`aplica_iva\` TINYINT(1) DEFAULT 1,
    \`iva_monto\` DECIMAL(15,2) DEFAULT 0,
    \`total\` DECIMAL(15,2) DEFAULT 0,
    \`identificador\` ENUM('CAF','Administrativo') DEFAULT 'Administrativo',
    \`centro_costo_codigo\` VARCHAR(100),
    \`centro_costo_nombre\` VARCHAR(300),
    \`dispositivo_id\` VARCHAR(36),
    \`partida_id\` VARCHAR(36),
    \`empleado_id\` VARCHAR(36),
    \`total_mxn\` DECIMAL(15,2) DEFAULT NULL,
    \`created_at\` DATETIME,
    \`updated_at\` DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
]

// ─── Seed inicial ─────────────────────────────────────────────────────────────
async function runSeed() {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  // Usuarios
  const [uRows] = await _pool.query('SELECT COUNT(*) as c FROM usuarios_sistema')
  if (uRows[0].c === 0) {
    const salt = bcrypt.genSaltSync(10)
    const users = [
      { id: uuidv4(), username: 'admin',   password: bcrypt.hashSync('admin123', salt), nombre: 'Administrador General',  email: 'admin@empresa.com',   rol: 'super_admin',    activo: 1, created_at: now, updated_at: now },
      { id: uuidv4(), username: 'soporte', password: bcrypt.hashSync('admin123', salt), nombre: 'Agente de Soporte TI',   email: 'soporte@empresa.com', rol: 'agente_soporte', activo: 1, created_at: now, updated_at: now },
      { id: uuidv4(), username: 'vista',   password: bcrypt.hashSync('admin123', salt), nombre: 'Usuario Vista',          email: 'vista@empresa.com',   rol: 'vista',          activo: 1, created_at: now, updated_at: now },
    ]
    await persistBulkInsert('usuarios_sistema', users)
    _data.usuarios_sistema = users.map(u => deserialize('usuarios_sistema', u))
    console.log('✓ Usuarios seed insertados')
  }

  // Proveedores
  const [pRows] = await _pool.query('SELECT COUNT(*) as c FROM proveedores')
  if (pRows[0].c === 0) {
    const provs = [
      { id: uuidv4(), nombre: 'Dell México',    contacto: 'ventas@dell.com',    telefono: '800-900-3355', activo: 1, created_at: now },
      { id: uuidv4(), nombre: 'HP México',      contacto: 'hp-soporte@hp.com',  telefono: '800-474-6836', activo: 1, created_at: now },
      { id: uuidv4(), nombre: 'Lenovo México',  contacto: 'soporte@lenovo.com', telefono: '800-LENOVO-2', activo: 1, created_at: now },
      { id: uuidv4(), nombre: 'Syscom',         contacto: 'ventas@syscom.mx',   telefono: '800-226-3726', activo: 1, created_at: now },
    ]
    await persistBulkInsert('proveedores', provs)
    _data.proveedores = provs.map(r => deserialize('proveedores', r))
    console.log('✓ Proveedores seed insertados')
  }

  // Sucursales
  const [sRows] = await _pool.query('SELECT COUNT(*) as c FROM sucursales')
  if (sRows[0].c === 0) {
    const sucs = [
      { id: uuidv4(), nombre: 'Corporativo Central',       tipo: 'corporativo', direccion: 'Av. Insurgentes Sur 1234, CDMX',    estado: 'Ciudad de México', lat: 19.3910, lng: -99.1721, activo: 1, created_at: now },
      { id: uuidv4(), nombre: 'Sucursal Monterrey Norte',  tipo: 'sucursal',    direccion: 'Av. Constitución 500, Monterrey',   estado: 'Nuevo León',       lat: 25.6866, lng: -100.3161, activo: 1, created_at: now },
      { id: uuidv4(), nombre: 'Sucursal Guadalajara',      tipo: 'sucursal',    direccion: 'Av. Hidalgo 800, Guadalajara',      estado: 'Jalisco',          lat: 20.6597, lng: -103.3496, activo: 1, created_at: now },
      { id: uuidv4(), nombre: 'Sucursal Puebla',           tipo: 'sucursal',    direccion: 'Blvd. Héroes del 5 de Mayo 2345',   estado: 'Puebla',           lat: 19.0414, lng: -98.2063,  activo: 1, created_at: now },
      { id: uuidv4(), nombre: 'Sucursal Tijuana',          tipo: 'sucursal',    direccion: 'Blvd. Agua Caliente 10750',         estado: 'Baja California',  lat: 32.5149, lng: -117.0382, activo: 1, created_at: now },
    ]
    await persistBulkInsert('sucursales', sucs)
    _data.sucursales = sucs.map(r => deserialize('sucursales', r))
    console.log('✓ Sucursales seed insertadas')
  }

  // Empleados
  const [eRows] = await _pool.query('SELECT COUNT(*) as c FROM empleados')
  if (eRows[0].c === 0) {
    const corp = _data.sucursales[0]
    const suc1 = _data.sucursales[1]
    const emps = [
      { id: uuidv4(), nombre_completo: 'Carlos Mendoza Ruiz',  num_empleado: 'EMP-001', puesto: 'Gerente de TI',         area: 'Tecnologías de la Información', centro_costos: 'CC-TI-001', jefe_nombre: null,                   sucursal_id: corp?.id, sucursal_nombre: corp?.nombre, email: 'c.mendoza@empresa.com', telefono: '5512345678', activo: 1, created_at: now },
      { id: uuidv4(), nombre_completo: 'Laura Sánchez Torres', num_empleado: 'EMP-002', puesto: 'Analista de Soporte TI', area: 'Tecnologías de la Información', centro_costos: 'CC-TI-001', jefe_nombre: 'Carlos Mendoza Ruiz', sucursal_id: corp?.id, sucursal_nombre: corp?.nombre, email: 'l.sanchez@empresa.com', telefono: '5587654321', activo: 1, created_at: now },
      { id: uuidv4(), nombre_completo: 'Roberto García Pérez', num_empleado: 'EMP-003', puesto: 'Contador Senior',        area: 'Finanzas',                      centro_costos: 'CC-FIN-002', jefe_nombre: 'Ana López Martínez', sucursal_id: suc1?.id, sucursal_nombre: suc1?.nombre, email: 'r.garcia@empresa.com',  telefono: '8112345678', activo: 1, created_at: now },
    ]
    await persistBulkInsert('empleados', emps)
    _data.empleados = emps.map(r => deserialize('empleados', r))
    console.log('✓ Empleados seed insertados')
  }

  // Dispositivos
  const [dRows] = await _pool.query('SELECT COUNT(*) as c FROM dispositivos')
  if (dRows[0].c === 0) {
    const corp = _data.sucursales[0]
    const suc1 = _data.sucursales[1]
    const emp1 = _data.empleados[0]
    const prov = _data.proveedores
    const devs = [
      { id: uuidv4(), tipo: 'CPU',       marca: 'Dell',     serie: 'DELL-OPT7090-001', modelo: 'OptiPlex 7090',       proveedor_id: prov[0]?.id, proveedor_nombre: prov[0]?.nombre, caracteristicas: 'Intel Core i7-10700, 16GB RAM, 512GB SSD',  estado: 'activo', ubicacion_tipo: 'empleado', ubicacion_id: emp1?.id, ubicacion_nombre: emp1?.nombre_completo, lat: corp?.lat, lng: corp?.lng, activo: 1, created_at: now, updated_at: now },
      { id: uuidv4(), tipo: 'Monitor',   marca: 'Dell',     serie: 'DELL-MON27-002',   modelo: 'UltraSharp 27"',      proveedor_id: prov[0]?.id, proveedor_nombre: prov[0]?.nombre, caracteristicas: '27" IPS 4K, 60Hz, HDMI/DP',                estado: 'activo', ubicacion_tipo: 'empleado', ubicacion_id: emp1?.id, ubicacion_nombre: emp1?.nombre_completo, lat: corp?.lat, lng: corp?.lng, activo: 1, created_at: now, updated_at: now },
      { id: uuidv4(), tipo: 'Laptop',    marca: 'HP',       serie: 'HP-ELITE840-003',  modelo: 'EliteBook 840 G8',    proveedor_id: prov[1]?.id, proveedor_nombre: prov[1]?.nombre, caracteristicas: 'Intel Core i5-1135G7, 8GB RAM, 256GB SSD', estado: 'activo', ubicacion_tipo: 'sucursal', ubicacion_id: suc1?.id, ubicacion_nombre: suc1?.nombre,         lat: suc1?.lat, lng: suc1?.lng, activo: 1, created_at: now, updated_at: now },
      { id: uuidv4(), tipo: 'Impresora', marca: 'HP',       serie: 'HP-LJ400-004',     modelo: 'LaserJet Pro M404n',  proveedor_id: prov[1]?.id, proveedor_nombre: prov[1]?.nombre, caracteristicas: 'Láser monocromático, 40ppm, USB/Red',      estado: 'stock',  ubicacion_tipo: 'almacen',  ubicacion_id: null,     ubicacion_nombre: 'Almacén Central',    lat: null,      lng: null,      activo: 1, created_at: now, updated_at: now },
      { id: uuidv4(), tipo: 'Mouse',     marca: 'Logitech', serie: 'LOG-MX3-005',      modelo: 'MX Master 3',         proveedor_id: prov[3]?.id, proveedor_nombre: prov[3]?.nombre, caracteristicas: 'Inalámbrico, 4000 DPI, USB-C',             estado: 'stock',  ubicacion_tipo: 'almacen',  ubicacion_id: null,     ubicacion_nombre: 'Almacén Central',    lat: null,      lng: null,      activo: 1, created_at: now, updated_at: now },
    ]
    await persistBulkInsert('dispositivos', devs)
    _data.dispositivos = devs.map(r => deserialize('dispositivos', r))
    console.log('✓ Dispositivos seed insertados')
  }

  // Plantillas
  const [ptRows] = await _pool.query('SELECT COUNT(*) as c FROM plantillas')
  if (ptRows[0].c === 0) {
    const adminId = _data.usuarios_sistema.find(u => u.username === 'admin')?.id || 'system'
    const tmps = [
      { id: uuidv4(), tipo: 'responsiva', nombre: 'Carta Responsiva Estándar', version: 1, texto_legal: `Por medio del presente documento, yo {{receptor_nombre}}, con número de empleado {{receptor_num_empleado}}, adscrito al área {{receptor_area}} en {{sucursal_nombre}}, declaro haber recibido en préstamo los equipos de cómputo y/o dispositivos tecnológicos detallados en el presente documento, mismos que son propiedad de la empresa.\n\nMe comprometo a:\n1. Hacer uso adecuado y responsable de los equipos descritos.\n2. Reportar cualquier falla, daño o extravío de forma inmediata al área de Soporte TI.\n3. No utilizar los equipos para fines distintos a los laborales.\n4. Devolver los equipos en las mismas condiciones en que fueron entregados.`, activo: 1, creado_por: adminId, creado_por_nombre: 'Administrador General', modificado_por: null, modificado_por_nombre: null, versiones: '[]', created_at: now, updated_at: now },
      { id: uuidv4(), tipo: 'entrada',    nombre: 'Acta de Entrada de Equipo',  version: 1, texto_legal: `Mediante el presente documento se registra la entrada de los siguientes equipos al inventario de TI. El agente de soporte {{agente_nombre}} certifica que los equipos recibidos fueron verificados y se encuentran en las condiciones descritas.`, activo: 1, creado_por: adminId, creado_por_nombre: 'Administrador General', modificado_por: null, modificado_por_nombre: null, versiones: '[]', created_at: now, updated_at: now },
      { id: uuidv4(), tipo: 'salida',     nombre: 'Acta de Salida de Equipo',   version: 1, texto_legal: `Mediante el presente documento se registra la salida de los siguientes equipos del inventario de TI. Motivo de salida: {{motivo_salida}}. El agente {{agente_nombre}} certifica la entrega.`, activo: 1, creado_por: adminId, creado_por_nombre: 'Administrador General', modificado_por: null, modificado_por_nombre: null, versiones: '[]', created_at: now, updated_at: now },
    ]
    await persistBulkInsert('plantillas', tmps)
    _data.plantillas = tmps.map(r => deserialize('plantillas', r))
    console.log('✓ Plantillas seed insertadas')
  }

  // Licencias
  const [lRows] = await _pool.query('SELECT COUNT(*) as c FROM licencias')
  if (lRows[0].c === 0) {
    const adminId = _data.usuarios_sistema.find(u => u.username === 'admin')?.id || 'system'
    const lics = [
      { id: uuidv4(), nombre: 'Microsoft 365 Business Standard', tipo: 'Ofimática',       proveedor_id: null, proveedor_nombre: 'Microsoft', clave_licencia: 'MS365-XXXXX',   version: '2024',      descripcion: 'Suite Word, Excel, PowerPoint, Teams', costo: 12.50,  moneda: 'USD', tipo_costo: 'mensual', tipo_cambio: 17.15, fecha_inicio: '2024-01-01', fecha_vencimiento: '2026-12-31', total_asientos: 50,  activo: 1, creado_por: adminId, creado_por_nombre: 'Administrador General', created_at: now, updated_at: now },
      { id: uuidv4(), nombre: 'ESET Endpoint Security',          tipo: 'Seguridad',        proveedor_id: null, proveedor_nombre: 'ESET',      clave_licencia: 'ESET-ENT-XXXXX', version: '10.x',     descripcion: 'Antivirus endpoint estaciones de trabajo', costo: 1800, moneda: 'MXN', tipo_costo: 'anual',   tipo_cambio: 17.15, fecha_inicio: '2024-03-01', fecha_vencimiento: '2025-03-01', total_asientos: 100, activo: 1, creado_por: adminId, creado_por_nombre: 'Administrador General', created_at: now, updated_at: now },
      { id: uuidv4(), nombre: 'Adobe Creative Cloud',            tipo: 'Diseño',           proveedor_id: null, proveedor_nombre: 'Adobe',     clave_licencia: 'ACC-TEAM-XXXXX', version: 'CC 2024',  descripcion: 'Photoshop, Illustrator, InDesign, Premiere', costo: 84.99, moneda: 'USD', tipo_costo: 'mensual', tipo_cambio: 17.15, fecha_inicio: '2024-01-15', fecha_vencimiento: '2026-01-15', total_asientos: 5,   activo: 1, creado_por: adminId, creado_por_nombre: 'Administrador General', created_at: now, updated_at: now },
      { id: uuidv4(), nombre: 'Windows 11 Pro',                  tipo: 'Sistema Operativo', proveedor_id: null, proveedor_nombre: 'Microsoft', clave_licencia: 'WIN11-PRO-XXXXX', version: '11 Pro', descripcion: 'Licencia perpetua OS corporativo',         costo: 4500, moneda: 'MXN', tipo_costo: 'unico',   tipo_cambio: 17.15, fecha_inicio: '2023-01-01', fecha_vencimiento: null,         total_asientos: 30,  activo: 1, creado_por: adminId, creado_por_nombre: 'Administrador General', created_at: now, updated_at: now },
    ]
    await persistBulkInsert('licencias', lics)
    _data.licencias = lics.map(r => deserialize('licencias', r))
    console.log('✓ Licencias seed insertadas')
  }

  // Tarifas de equipo
  const [tRows] = await _pool.query('SELECT COUNT(*) as c FROM tarifas_equipo')
  if (tRows[0].c === 0) {
    const tarifas = [
      { id: 'tar-cpu',        tipo: 'CPU',               nombre_display: 'Paquete CPU (CPU + Monitor + Teclado + Mouse)', costo_dia: 85.00, moneda: 'MXN', es_paquete: 1, incluye: JSON.stringify(['CPU','Monitor','Teclado','Mouse']), activo: 1, updated_at: now },
      { id: 'tar-laptop',     tipo: 'Laptop',            nombre_display: 'Laptop',                costo_dia: 95.00, moneda: 'MXN', es_paquete: 0, incluye: '[]', activo: 1, updated_at: now },
      { id: 'tar-impresora',  tipo: 'Impresora',         nombre_display: 'Impresora',             costo_dia: 35.00, moneda: 'MXN', es_paquete: 0, incluye: '[]', activo: 1, updated_at: now },
      { id: 'tar-tablet',     tipo: 'Tablet',            nombre_display: 'Tablet',                costo_dia: 50.00, moneda: 'MXN', es_paquete: 0, incluye: '[]', activo: 1, updated_at: now },
      { id: 'tar-camara',     tipo: 'Cámara Web',        nombre_display: 'Cámara Web',            costo_dia: 12.00, moneda: 'MXN', es_paquete: 0, incluye: '[]', activo: 1, updated_at: now },
      { id: 'tar-diadema',    tipo: 'Diademas',          nombre_display: 'Diademas / Headset',    costo_dia: 10.00, moneda: 'MXN', es_paquete: 0, incluye: '[]', activo: 1, updated_at: now },
      { id: 'tar-biometrico', tipo: 'Biométrico',        nombre_display: 'Biométrico',            costo_dia: 18.00, moneda: 'MXN', es_paquete: 0, incluye: '[]', activo: 1, updated_at: now },
      { id: 'tar-bam',        tipo: 'BAM (M4)',           nombre_display: 'BAM (M4)',              costo_dia: 25.00, moneda: 'MXN', es_paquete: 0, incluye: '[]', activo: 1, updated_at: now },
      { id: 'tar-modem',      tipo: 'Módem de Internet', nombre_display: 'Módem de Internet',     costo_dia: 20.00, moneda: 'MXN', es_paquete: 0, incluye: '[]', activo: 1, updated_at: now },
      { id: 'tar-celular',    tipo: 'Celular',           nombre_display: 'Celular',               costo_dia: 40.00, moneda: 'MXN', es_paquete: 0, incluye: '[]', activo: 1, updated_at: now },
    ]
    await persistBulkInsert('tarifas_equipo', tarifas)
    _data.tarifas_equipo = tarifas.map(r => deserialize('tarifas_equipo', r))
    console.log('✓ Tarifas seed insertadas')
  }

  // Centros de costo (bulk desde JSON)
  const [ccRows] = await _pool.query('SELECT COUNT(*) as c FROM centros_costo')
  if (ccRows[0].c === 0) {
    const seedPath = path.join(__dirname, '../../data/centros_costo_seed.json')
    if (fs.existsSync(seedPath)) {
      const ccData = JSON.parse(fs.readFileSync(seedPath, 'utf8'))
      // Insertar en lotes de 200
      const batchSize = 200
      for (let i = 0; i < ccData.length; i += batchSize) {
        await persistBulkInsert('centros_costo', ccData.slice(i, i + batchSize))
      }
      _data.centros_costo = ccData.map(r => deserialize('centros_costo', r))
      console.log(`✓ ${ccData.length} centros de costo insertados`)
    }
  }
}

// ─── Seed de catálogos ────────────────────────────────────────────────────────
async function seedCatalogos() {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  const [td] = await _pool.query('SELECT COUNT(*) as c FROM catalogo_tipos_dispositivo')
  if (td[0].c === 0) {
    const tipos = [
      'CPU','Laptop','Monitor','Impresora','Cámara Web','Diademas','Biométrico',
      'Teclado','Mouse','Cable de Datos','Cable de Corriente','Cable VGA','Cable HDMI',
      'Tablet','Celular','Módem de Internet','BAM (M4)'
    ].map((nombre, i) => ({ id: uuidv4(), nombre, orden: (i + 1) * 10, activo: 1, created_at: now, updated_at: now }))
    await persistBulkInsert('catalogo_tipos_dispositivo', tipos)
    _data.catalogo_tipos_dispositivo = tipos.map(r => deserialize('catalogo_tipos_dispositivo', r))
    console.log('✓ Catálogo tipos de dispositivo seed insertado')
  }

  const [tl] = await _pool.query('SELECT COUNT(*) as c FROM catalogo_tipos_licencia')
  if (tl[0].c === 0) {
    const tipos = [
      'Ofimática','Seguridad','Diseño','Desarrollo','Comunicación',
      'Sistema Operativo','ERP / CRM','Virtualización','Base de Datos','Otra'
    ].map((nombre, i) => ({ id: uuidv4(), nombre, orden: (i + 1) * 10, activo: 1, created_at: now, updated_at: now }))
    await persistBulkInsert('catalogo_tipos_licencia', tipos)
    _data.catalogo_tipos_licencia = tipos.map(r => deserialize('catalogo_tipos_licencia', r))
    console.log('✓ Catálogo tipos de licencia seed insertado')
  }

  const [ar] = await _pool.query('SELECT COUNT(*) as c FROM catalogo_areas')
  if (ar[0].c === 0) {
    const areas = [
      'Tecnologías de la Información','Recursos Humanos','Finanzas','Operaciones',
      'Dirección General','Legal','Marketing','Ventas','Soporte Técnico'
    ].map((nombre, i) => ({ id: uuidv4(), nombre, orden: (i + 1) * 10, activo: 1, created_at: now, updated_at: now }))
    await persistBulkInsert('catalogo_areas', areas)
    _data.catalogo_areas = areas.map(r => deserialize('catalogo_areas', r))
    console.log('✓ Catálogo de áreas seed insertado')
  }

  const [mr] = await _pool.query('SELECT COUNT(*) as c FROM catalogo_marcas')
  if (mr[0].c === 0) {
    const marcas = [
      'Dell','HP','Lenovo','Apple','Asus','Acer','Samsung','LG','Epson','Canon',
      'Logitech','Microsoft','Cisco','Huawei','Motorola','Honeywell'
    ].map((nombre, i) => ({ id: uuidv4(), nombre, orden: (i + 1) * 10, activo: 1, created_at: now, updated_at: now }))
    await persistBulkInsert('catalogo_marcas', marcas)
    _data.catalogo_marcas = marcas.map(r => deserialize('catalogo_marcas', r))
    console.log('✓ Catálogo de marcas seed insertado')
  }
}

// ─── Lista de tablas que carga en memoria ─────────────────────────────────────
const ALL_TABLES = [
  'usuarios_sistema','dispositivos','empleados','sucursales',
  'asignaciones','documentos','plantillas','cambios',
  'cotizaciones','repositorio_cotizacion','proveedores',
  'licencias','asignaciones_licencias','centros_costo',
  'tarifas_equipo','auditoria',
  'presupuesto_agrupadores','presupuesto_partidas','presupuesto_gastos_mes',
  'presupuesto_cambios','finanzas_detalle',
  'catalogo_tipos_dispositivo','catalogo_tipos_licencia',
  'catalogo_areas','catalogo_marcas',
  'catalogo_supervisores','catalogo_puestos',
  'configuracion','proveedor_documentos',
  'firma_tokens',
]

// ─── Inicialización principal ─────────────────────────────────────────────────
async function initDB() {
  _pool = mysql.createPool({
    host:            process.env.DB_HOST            || '127.0.0.1',
    port:            parseInt(process.env.DB_PORT)  || 3306,
    database:        process.env.DB_NAME            || 'athenasys',
    user:            process.env.DB_USER            || 'root',
    password:        process.env.DB_PASSWORD        || '',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    timezone:        '+00:00',
    decimalNumbers:  true,
    charset:         'utf8mb4',          // ← UTF-8 completo (ñ, acentos, emojis)
  })

  // Test conexión y forzar utf8mb4 en la sesión
  const conn = await _pool.getConnection()
  await conn.query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'")
  await conn.query("SET CHARACTER SET utf8mb4")
  console.log(`✓ MySQL conectado (utf8mb4) → ${process.env.DB_NAME || 'athenasys'}`)
  conn.release()

  // Crear tablas
  for (const ddl of DDL) {
    await _pool.query(ddl)
  }

  // Migraciones incrementales — agregar columnas nuevas si no existen
  const db_name = process.env.DB_NAME || 'athenasys'
  const alterIfNotExists = async (table, col, definition) => {
    const [[r]] = await _pool.query(
      'SELECT COUNT(*) as c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?',
      [db_name, table, col]
    )
    if (r.c === 0) {
      await _pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${definition}`)
    }
  }
  await alterIfNotExists('dispositivos',  'costo_dia',            'DECIMAL(10,2) DEFAULT 0')
  await alterIfNotExists('dispositivos',  'cantidad',             'INT DEFAULT 1')
  await alterIfNotExists('dispositivos',  'creado_por',           'VARCHAR(36)')
  await alterIfNotExists('dispositivos',  'creado_por_nombre',    'VARCHAR(200)')
  await alterIfNotExists('dispositivos',  'actualizado_por',      'VARCHAR(36)')
  await alterIfNotExists('dispositivos',  'actualizado_por_nombre','VARCHAR(200)')
  await alterIfNotExists('empleados',     'centro_costo_codigo',  'VARCHAR(100)')
  await alterIfNotExists('empleados',     'centro_costo_nombre',  'VARCHAR(300)')
  await alterIfNotExists('empleados',     'foto_url',             'VARCHAR(500)')
  await alterIfNotExists('sucursales',    'centro_costo_codigo',  'VARCHAR(100)')
  await alterIfNotExists('sucursales',    'centro_costo_nombre',  'VARCHAR(300)')
  await alterIfNotExists('sucursales',    'foto_url',             'VARCHAR(500)')
  await alterIfNotExists('cotizaciones',  'total_mxn',            'DECIMAL(15,2)')
  await alterIfNotExists('usuarios_sistema', 'firma_base64', 'MEDIUMTEXT')
  await alterIfNotExists('usuarios_sistema', 'firma_path',   'VARCHAR(500)')
  await alterIfNotExists('documentos',   'firma_agente_path',  'VARCHAR(500)')
  await alterIfNotExists('asignaciones', 'dispositivo_marca',  'VARCHAR(200)')
  await alterIfNotExists('asignaciones', 'lat',                'DECIMAL(10,8)')
  await alterIfNotExists('asignaciones', 'lng',                'DECIMAL(11,8)')
  await alterIfNotExists('finanzas_detalle', 'modo_calculo',     "VARCHAR(10) DEFAULT 'dias'")
  await alterIfNotExists('finanzas_detalle', 'tiene_vigencia',   'TINYINT(1) DEFAULT 0')
  await alterIfNotExists('finanzas_detalle', 'total_mxn',        'DECIMAL(15,2) DEFAULT NULL')
  await alterIfNotExists('finanzas_detalle', 'es_gasto_usuario', 'TINYINT(1) DEFAULT 0')
  await alterIfNotExists('finanzas_detalle', 'empleado_nombre',  'VARCHAR(200) DEFAULT NULL')
  await alterIfNotExists('presupuesto_partidas', 'montos_por_mes', 'LONGTEXT')
  // SharePoint
  await alterIfNotExists('documentos', 'sharepoint_item_id',     'VARCHAR(500)')
  await alterIfNotExists('documentos', 'sharepoint_url',         'TEXT')
  await alterIfNotExists('documentos', 'sharepoint_uploaded_at', 'DATETIME')
  await alterIfNotExists('documentos', 'activo',                 'TINYINT(1) DEFAULT 1')
  // Proveedores nuevos campos
  await alterIfNotExists('proveedores', 'contacto_nombre', 'VARCHAR(200)')
  await alterIfNotExists('proveedores', 'rfc',             'VARCHAR(20)')
  await alterIfNotExists('proveedores', 'direccion',       'TEXT')
  await alterIfNotExists('proveedores', 'url_web',         'VARCHAR(500)')
  await alterIfNotExists('proveedores', 'imagen',          'LONGTEXT')
  await alterIfNotExists('proveedores', 'updated_at',      'DATETIME')
  // Cotizaciones nueva columna
  await alterIfNotExists('cotizaciones', 'fecha_vencimiento', 'DATE')
  // ── Columnas updated_at faltantes (causan que UPDATE no llegue a MySQL) ──
  await alterIfNotExists('empleados',  'updated_at', 'DATETIME')
  await alterIfNotExists('sucursales', 'updated_at',    'DATETIME')
  await alterIfNotExists('sucursales', 'determinante',  'INT DEFAULT NULL')
  await alterIfNotExists('sucursales', 'email',         'VARCHAR(200) DEFAULT NULL')
  await alterIfNotExists('licencias',  'updated_at',       'DATETIME')
  await alterIfNotExists('licencias',  'tipo_asignacion',  "VARCHAR(20) DEFAULT 'empleados'")
  await alterIfNotExists('asignaciones_licencias', 'sucursal_id',     'VARCHAR(36) DEFAULT NULL')
  await alterIfNotExists('asignaciones_licencias', 'sucursal_nombre', 'VARCHAR(200) DEFAULT NULL')
  await alterIfNotExists('asignaciones_licencias', 'tipo_asignado',   "VARCHAR(20) DEFAULT 'empleado'")
  // ── Columnas faltantes en documentos ──────────────────────────────────────
  // El DDL original no tenía estas columnas; sin ellas el firma-route
  // no puede persistir local_pdf_path, firmas, datos del empleado, etc.
  await alterIfNotExists('documentos', 'updated_at',           'DATETIME')
  await alterIfNotExists('documentos', 'firma_agente_path',    'VARCHAR(500)')
  await alterIfNotExists('documentos', 'firma_receptor_path',  'VARCHAR(500)')
  await alterIfNotExists('documentos', 'local_pdf_path',       'VARCHAR(500)')
  await alterIfNotExists('documentos', 'pdf_pendiente_path',   'VARCHAR(500)')
  await alterIfNotExists('documentos', 'entidad_num_empleado', 'VARCHAR(100)')
  await alterIfNotExists('documentos', 'entidad_area',         'VARCHAR(200)')
  await alterIfNotExists('documentos', 'entidad_puesto',       'VARCHAR(200)')
  await alterIfNotExists('documentos', 'entidad_email',        'VARCHAR(200)')
  await alterIfNotExists('documentos', 'entidad_departamento', 'VARCHAR(200)')
  // ── Firma online (envío de link al receptor) ──────────────────────────────
  await alterIfNotExists('documentos', 'firma_online_estado', "VARCHAR(20) DEFAULT NULL")
  await alterIfNotExists('documentos', 'firma_online_token',  'VARCHAR(64) DEFAULT NULL')
  // ── Campos adicionales por tipo de dispositivo ────────────────────────────
  await alterIfNotExists('dispositivos', 'campos_extra', 'LONGTEXT')
  await alterIfNotExists('dispositivos', 'costo_tipo',   "VARCHAR(20) DEFAULT 'mensual'")
  await alterIfNotExists('dispositivos', 'doc_pendiente_id',    'VARCHAR(36) DEFAULT NULL')
  await alterIfNotExists('dispositivos', 'doc_pendiente_folio', 'VARCHAR(100) DEFAULT NULL')
  // ── Asegurar utf8mb4 en tablas principales ────────────────────────────────
  for (const tbl of ['empleados','sucursales','dispositivos','documentos','plantillas','configuracion']) {
    try {
      await _pool.query(`ALTER TABLE \`${tbl}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    } catch (_) { /* ya está en utf8mb4 */ }
  }

  // ── FOREIGN KEY constraints ───────────────────────────────────────────────
  // Agrega FKs reales para relaciones no-polimórficas.
  // Las relaciones polimórficas (asignaciones.asignado_a_id, dispositivos.ubicacion_id,
  // documentos.receptor_id) NO pueden tener FK en MySQL porque un mismo campo
  // referencia tablas distintas según el campo "tipo".
  const addFKIfNotExists = async (table, fkName, col, refTable, refCol, onDelete = 'SET NULL') => {
    try {
      const [[r]] = await _pool.query(
        `SELECT COUNT(*) as c FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND CONSTRAINT_NAME=? AND CONSTRAINT_TYPE='FOREIGN KEY'`,
        [db_name, table, fkName]
      )
      if (r.c > 0) return // Ya existe

      // Limpiar registros huérfanos antes de crear la constraint
      if (onDelete === 'SET NULL') {
        await _pool.query(
          `UPDATE \`${table}\` SET \`${col}\` = NULL
           WHERE \`${col}\` IS NOT NULL
             AND \`${col}\` NOT IN (SELECT \`${refCol}\` FROM \`${refTable}\`)`
        )
      } else {
        // CASCADE o RESTRICT → eliminar huérfanos
        await _pool.query(
          `DELETE FROM \`${table}\`
           WHERE \`${col}\` IS NOT NULL
             AND \`${col}\` NOT IN (SELECT \`${refCol}\` FROM \`${refTable}\`)`
        )
      }

      await _pool.query(
        `ALTER TABLE \`${table}\`
         ADD CONSTRAINT \`${fkName}\`
         FOREIGN KEY (\`${col}\`) REFERENCES \`${refTable}\`(\`${refCol}\`)
         ON DELETE ${onDelete} ON UPDATE CASCADE`
      )
      console.log(`  ✓ FK ${fkName}`)
    } catch (e) {
      console.warn(`  ⚠ FK ${fkName} omitida: ${e.message}`)
    }
  }

  console.log('Aplicando FOREIGN KEYS...')
  // empleados → sucursales
  await addFKIfNotExists('empleados',              'fk_emp_sucursal',         'sucursal_id',    'sucursales',             'id', 'SET NULL')
  // dispositivos → proveedores
  await addFKIfNotExists('dispositivos',           'fk_disp_proveedor',       'proveedor_id',   'proveedores',            'id', 'SET NULL')
  // asignaciones → dispositivos  (RESTRICT: asignación sin dispositivo no tiene sentido)
  await addFKIfNotExists('asignaciones',           'fk_asig_dispositivo',     'dispositivo_id', 'dispositivos',           'id', 'RESTRICT')
  // asignaciones_licencias → licencias
  await addFKIfNotExists('asignaciones_licencias', 'fk_aslic_licencia',       'licencia_id',    'licencias',              'id', 'CASCADE')
  // asignaciones_licencias → empleados
  await addFKIfNotExists('asignaciones_licencias', 'fk_aslic_empleado',       'empleado_id',    'empleados',              'id', 'SET NULL')
  // asignaciones_licencias → sucursales
  await addFKIfNotExists('asignaciones_licencias', 'fk_aslic_sucursal',       'sucursal_id',    'sucursales',             'id', 'SET NULL')
  // firma_tokens → documentos
  await addFKIfNotExists('firma_tokens',           'fk_firmatoken_doc',       'documento_id',   'documentos',             'id', 'CASCADE')
  // proveedor_documentos → proveedores
  await addFKIfNotExists('proveedor_documentos',   'fk_provdoc_proveedor',    'proveedor_id',   'proveedores',            'id', 'CASCADE')
  // licencias → proveedores
  await addFKIfNotExists('licencias',              'fk_lic_proveedor',        'proveedor_id',   'proveedores',            'id', 'SET NULL')
  // cambios → dispositivos
  await addFKIfNotExists('cambios',                'fk_cambio_dispositivo',   'dispositivo_id', 'dispositivos',           'id', 'RESTRICT')
  // cambios → proveedores
  await addFKIfNotExists('cambios',                'fk_cambio_proveedor',     'proveedor_id',   'proveedores',            'id', 'SET NULL')
  // documentos → plantillas
  await addFKIfNotExists('documentos',             'fk_doc_plantilla',        'plantilla_id',   'plantillas',             'id', 'SET NULL')
  // presupuesto_gastos_mes → presupuesto_partidas
  await addFKIfNotExists('presupuesto_gastos_mes', 'fk_gastos_partida',       'partida_id',     'presupuesto_partidas',   'id', 'CASCADE')
  // presupuesto_cambios → presupuesto_partidas
  await addFKIfNotExists('presupuesto_cambios',    'fk_presucambio_partida',  'partida_id',     'presupuesto_partidas',   'id', 'CASCADE')
  // finanzas_detalle → dispositivos
  await addFKIfNotExists('finanzas_detalle',       'fk_finanzas_dispositivo', 'dispositivo_id', 'dispositivos',           'id', 'SET NULL')
  // finanzas_detalle → empleados
  await addFKIfNotExists('finanzas_detalle',       'fk_finanzas_empleado',    'empleado_id',    'empleados',              'id', 'SET NULL')
  // finanzas_detalle → presupuesto_partidas
  await addFKIfNotExists('finanzas_detalle',       'fk_finanzas_partida',     'partida_id',     'presupuesto_partidas',   'id', 'SET NULL')

  console.log('✓ Tablas verificadas/creadas')

  // Cargar datos en memoria
  for (const t of ALL_TABLES) await loadTable(t)

  // Seed si está vacío
  await runSeed()
  await seedCatalogos()

  // Sincronizar catálogos de puestos y supervisores desde datos existentes de empleados
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

    const [puestosRows] = await _pool.query(
      "SELECT DISTINCT puesto FROM empleados WHERE puesto IS NOT NULL AND puesto != '' AND activo = 1"
    )
    for (const row of puestosRows) {
      const nombre = (row.puesto || '').trim()
      if (!nombre) continue
      const [ex] = await _pool.query('SELECT id FROM catalogo_puestos WHERE nombre = ? AND activo = 1', [nombre])
      if (!ex.length) {
        await _pool.query(
          'INSERT INTO catalogo_puestos (id, nombre, orden, activo, created_at, updated_at) VALUES (UUID(), ?, 0, 1, ?, ?)',
          [nombre, now, now]
        )
      }
    }

    const [supRows] = await _pool.query(
      "SELECT DISTINCT jefe_nombre FROM empleados WHERE jefe_nombre IS NOT NULL AND jefe_nombre != '' AND activo = 1"
    )
    for (const row of supRows) {
      const nombre = (row.jefe_nombre || '').trim()
      if (!nombre) continue
      const [ex] = await _pool.query('SELECT id FROM catalogo_supervisores WHERE nombre = ? AND activo = 1', [nombre])
      if (!ex.length) {
        await _pool.query(
          'INSERT INTO catalogo_supervisores (id, nombre, orden, activo, created_at, updated_at) VALUES (UUID(), ?, 0, 1, ?, ?)',
          [nombre, now, now]
        )
      }
    }

    await loadTable('catalogo_puestos')
    await loadTable('catalogo_supervisores')
    console.log(`✓ Catálogos de puestos (${puestosRows.length}) y supervisores (${supRows.length}) sincronizados desde empleados`)
  } catch (e) {
    console.warn('[DB] No se pudo sincronizar catálogos desde empleados:', e.message)
  }

  // Recargar tablas que pudo haber llenado el seed
  for (const t of ['usuarios_sistema','proveedores','sucursales','empleados',
                    'dispositivos','plantillas','licencias','tarifas_equipo','centros_costo']) {
    await loadTable(t)
  }

  console.log(`✓ DB lista en memoria (${Object.entries(_data).map(([k,v])=>`${k}:${Array.isArray(v)?v.length:0}`).join(', ')})`)

  // ── Auto-recarga periódica desde MySQL cada 5 minutos ────────────────────
  // Esto garantiza que cambios directos en la BD se reflejen sin reiniciar.
  setInterval(async () => {
    try {
      for (const t of ALL_TABLES) await loadTable(t)
      console.log(`[DB] ♻ Caché recargado desde MySQL (${new Date().toLocaleTimeString('es-MX')})`)
    } catch (e) {
      console.error('[DB] Error en auto-recarga:', e.message)
    }
  }, 5 * 60 * 1000) // cada 5 minutos

  return db
}

// ── Método para recargar manualmente una o todas las tablas ───────────────────
db.reload = async (table) => {
  if (table) {
    await loadTable(table)
  } else {
    for (const t of ALL_TABLES) await loadTable(t)
  }
}

module.exports = db
module.exports.initDB = initDB
