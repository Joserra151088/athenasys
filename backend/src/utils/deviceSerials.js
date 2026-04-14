const SERIE_ESTADOS = {
  CAPTURADA: 'capturada',
  SIN_NUMERO: 'sin_numero',
  NO_VISIBLE: 'no_visible',
}

const SPECIAL_SERIAL_PREFIX = {
  [SERIE_ESTADOS.SIN_NUMERO]: 'SIN NUMERO DE SERIE :: ',
  [SERIE_ESTADOS.NO_VISIBLE]: 'SERIE NO VISIBLE :: ',
}

const MISSING_SERIAL_VALUES = new Set([
  '',
  'N/A',
  'NA',
  'S/N',
  'SN',
  'SIN SERIE',
  'SIN NUMERO',
  'SIN NUMERO DE SERIE',
  'SIN NÚMERO',
  'SIN NÚMERO DE SERIE',
  'NO VISIBLE',
  'SERIE NO VISIBLE',
])

const TYPE_PREFIX_OVERRIDES = {
  'Mouse': 'MS',
  'Teclado': 'TEC',
  'CPU': 'CPU',
  'Laptop': 'LAP',
  'Monitor': 'MON',
  'Impresora': 'IMP',
  'Cámara Web': 'CAM',
  'Camara Web': 'CAM',
  'Diademas': 'DIA',
  'Diadema': 'DIA',
  'Biométrico': 'BIO',
  'Biometrico': 'BIO',
  'Tablet': 'TAB',
  'Celular': 'CEL',
  'Módem de Internet': 'MOD',
  'Modem de Internet': 'MOD',
  'BAM (M4)': 'BAM',
  'Cable de Datos': 'CBD',
  'Cable de Corriente': 'CBC',
  'Cable VGA': 'VGA',
  'Cable HDMI': 'HDMI',
}

function normalizeText(value = '') {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function normalizeUpper(value = '') {
  return normalizeText(value).toUpperCase()
}

function getDeviceSerialPrefix(tipo = '') {
  if (TYPE_PREFIX_OVERRIDES[tipo]) return TYPE_PREFIX_OVERRIDES[tipo]

  const normalizedType = normalizeText(tipo)
  const overrideKey = Object.keys(TYPE_PREFIX_OVERRIDES)
    .find(key => normalizeText(key).toUpperCase() === normalizedType.toUpperCase())
  if (overrideKey) return TYPE_PREFIX_OVERRIDES[overrideKey]

  const words = normalizedType
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (words.length >= 2) return words.map(word => word[0]).join('').slice(0, 4)

  const compact = words[0] || 'DIS'
  return compact.slice(0, 4)
}

function parseGeneratedSequence(serie = '', prefix = '') {
  const safePrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(serie || '').trim().match(new RegExp(`^${safePrefix}-(\\d{5,})$`, 'i'))
  return match ? parseInt(match[1], 10) : null
}

function isMissingSerial(serie = '') {
  const raw = String(serie ?? '').trim()
  const normalized = normalizeUpper(raw)
  if (!raw) return true
  if (MISSING_SERIAL_VALUES.has(raw.toUpperCase()) || MISSING_SERIAL_VALUES.has(normalized)) return true
  return Object.values(SPECIAL_SERIAL_PREFIX).some(prefix => normalized.startsWith(normalizeUpper(prefix)))
}

function inferMissingSerialEstado(serie = '') {
  const normalized = normalizeUpper(serie)
  if (normalized.startsWith(normalizeUpper(SPECIAL_SERIAL_PREFIX[SERIE_ESTADOS.NO_VISIBLE])) || normalized.includes('NO VISIBLE')) {
    return SERIE_ESTADOS.NO_VISIBLE
  }
  return SERIE_ESTADOS.SIN_NUMERO
}

function normalizeSerieEstado(value, fallback = SERIE_ESTADOS.CAPTURADA) {
  return Object.values(SERIE_ESTADOS).includes(value) ? value : fallback
}

function nextGeneratedSerial(tipo, dispositivos = [], reserved = new Set()) {
  const prefix = getDeviceSerialPrefix(tipo)
  let max = 0
  const serials = new Set()

  for (const dispositivo of dispositivos) {
    const serie = String(dispositivo?.serie || '').trim()
    if (!serie) continue
    serials.add(serie.toUpperCase())
    const sequence = parseGeneratedSequence(serie, prefix)
    if (sequence && sequence > max) max = sequence
  }

  for (const serie of reserved) {
    serials.add(String(serie || '').toUpperCase())
    const sequence = parseGeneratedSequence(serie, prefix)
    if (sequence && sequence > max) max = sequence
  }

  let next = max + 1
  let generated = `${prefix}-${String(next).padStart(5, '0')}`
  while (serials.has(generated.toUpperCase())) {
    next += 1
    generated = `${prefix}-${String(next).padStart(5, '0')}`
  }
  reserved.add(generated)
  return generated
}

module.exports = {
  SERIE_ESTADOS,
  SPECIAL_SERIAL_PREFIX,
  getDeviceSerialPrefix,
  inferMissingSerialEstado,
  isMissingSerial,
  nextGeneratedSerial,
  normalizeSerieEstado,
}
