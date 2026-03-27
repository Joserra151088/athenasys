export const DEVICE_TYPES = [
  'CPU',
  'Monitor',
  'Impresora',
  'Cámara Web',
  'Diademas',
  'Biométrico',
  'Teclado',
  'Mouse',
  'Cable de Datos',
  'Cable de Corriente',
  'Cable VGA',
  'Cable HDMI',
  'Tablet',
  'Celular',
  'Módem de Internet',
  'BAM (M4)'
]

export const DEVICE_STATUS = {
  activo: { label: 'Activo', color: 'bg-emerald-100 text-emerald-700' },
  en_reparacion: { label: 'En Reparación', color: 'bg-yellow-100 text-yellow-700' },
  danado: { label: 'Dañado', color: 'bg-red-100 text-red-700' },
  baja: { label: 'Dado de Baja', color: 'bg-gray-100 text-gray-600' },
  stock: { label: 'En Stock', color: 'bg-blue-100 text-blue-700' }
}

export const LOCATION_TYPES = {
  almacen: { label: 'Almacén', color: 'bg-blue-100 text-blue-700' },
  sucursal: { label: 'Sucursal', color: 'bg-purple-100 text-purple-700' },
  empleado: { label: 'Empleado', color: 'bg-orange-100 text-orange-700' },
  proveedor: { label: 'En Proveedor', color: 'bg-yellow-100 text-yellow-700' }
}

export const DOCUMENT_TYPES = {
  entrada: { label: 'Entrada', color: 'bg-emerald-100 text-emerald-700', desc: 'Registro de ingreso de equipos al inventario' },
  salida: { label: 'Salida', color: 'bg-red-100 text-red-700', desc: 'Registro de salida de equipos del inventario' },
  responsiva: { label: 'Responsiva', color: 'bg-blue-100 text-blue-700', desc: 'Carta responsiva de entrega a usuario/sucursal' }
}

export const USER_ROLES = {
  super_admin: { label: 'Super Administrador', color: 'bg-purple-100 text-purple-700' },
  agente_soporte: { label: 'Agente de Soporte TI', color: 'bg-blue-100 text-blue-700' },
  vista: { label: 'Solo Vista', color: 'bg-gray-100 text-gray-600' }
}

export const CHANGE_TYPES = {
  reparacion: { label: 'Reparación', color: 'bg-yellow-100 text-yellow-700' },
  baja_definitiva: { label: 'Baja Definitiva', color: 'bg-red-100 text-red-700' },
  actualizacion: { label: 'Actualización de Datos', color: 'bg-blue-100 text-blue-700' }
}

export const RECORD_TYPES = {
  corporativo: { label: 'Corporativo', color: 'bg-indigo-100 text-indigo-700' },
  sucursal: { label: 'Sucursal', color: 'bg-teal-100 text-teal-700' }
}

export const LICENSE_TYPES = [
  'Ofimática',
  'Seguridad',
  'Diseño',
  'Desarrollo',
  'Comunicación',
  'Sistema Operativo',
  'ERP / CRM',
  'Virtualización',
  'Base de Datos',
  'Otra'
]

export const LICENSE_COST_TYPES = {
  mensual: { label: 'Mensual', color: 'bg-blue-100 text-blue-700' },
  anual: { label: 'Anual', color: 'bg-purple-100 text-purple-700' },
  unico: { label: 'Pago único', color: 'bg-gray-100 text-gray-600' }
}

export const LICENSE_STATUS = {
  activa: { label: 'Activa', color: 'bg-emerald-100 text-emerald-700' },
  por_vencer: { label: 'Por vencer', color: 'bg-yellow-100 text-yellow-700' },
  vencida: { label: 'Vencida', color: 'bg-red-100 text-red-700' }
}

// ── Tarifas de renta diaria por tipo de dispositivo ──────────────────────────
// CPU: paquete (incluye Monitor + Teclado + Mouse en el mismo costo)
// Monitor/Teclado/Mouse: costo 0 porque van incluidos en el paquete CPU
// Cables: accesorios sin costo de renta
export const DEVICE_DAILY_RATES = {
  'CPU':               { costo: 85,  tipo: 'paquete',   nota: 'Paquete — incluye Monitor, Teclado y Mouse' },
  'Laptop':            { costo: 95,  tipo: 'unitario',  nota: 'Costo unitario' },
  'Impresora':         { costo: 35,  tipo: 'unitario',  nota: 'Costo unitario' },
  'Tablet':            { costo: 50,  tipo: 'unitario',  nota: 'Costo unitario' },
  'Cámara Web':        { costo: 12,  tipo: 'unitario',  nota: 'Costo unitario' },
  'Diademas':          { costo: 10,  tipo: 'unitario',  nota: 'Costo unitario' },
  'Biométrico':        { costo: 18,  tipo: 'unitario',  nota: 'Costo unitario' },
  'BAM (M4)':          { costo: 25,  tipo: 'unitario',  nota: 'Costo unitario' },
  'Módem de Internet': { costo: 20,  tipo: 'unitario',  nota: 'Costo unitario' },
  'Celular':           { costo: 40,  tipo: 'unitario',  nota: 'Costo unitario' },
  'Monitor':           { costo: 0,   tipo: 'incluido',  nota: 'Incluido en paquete CPU' },
  'Teclado':           { costo: 0,   tipo: 'incluido',  nota: 'Incluido en paquete CPU' },
  'Mouse':             { costo: 0,   tipo: 'incluido',  nota: 'Incluido en paquete CPU' },
  'Cable de Datos':    { costo: 0,   tipo: 'accesorio', nota: 'Accesorio sin costo de renta' },
  'Cable de Corriente':{ costo: 0,   tipo: 'accesorio', nota: 'Accesorio sin costo de renta' },
  'Cable VGA':         { costo: 0,   tipo: 'accesorio', nota: 'Accesorio sin costo de renta' },
  'Cable HDMI':        { costo: 0,   tipo: 'accesorio', nota: 'Accesorio sin costo de renta' },
}

export const IVA_RATE = 0.16

export const API_URL = '/api'
