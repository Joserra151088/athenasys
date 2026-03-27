---
name: inventario_ti_context
description: Contexto del proyecto KronOS TI - Sistema de inventario de dispositivos
type: project
---

Sistema KronOS TI creado en C:/jestrada/Proyectos/inventario-ti

**Why:** Gestión de inventario de dispositivos TI para área de soporte, con asignaciones, documentos firmados, expedientes y cotizaciones.

**How to apply:** Al continuar trabajo en este proyecto, este es el contexto completo.

## Stack
- Frontend: React + Vite (puerto 5174) en /frontend
- Backend: Node.js + Express (puerto 3002) en /backend
- DB: lowdb JSON en /backend/data/db.json (preparado para MySQL)
- PDF: jsPDF + html2canvas
- Mapa: react-leaflet + OpenStreetMap
- Firmas: react-signature-canvas

## Módulos implementados
- Dashboard con estadísticas y tabla paginada
- Dispositivos CRUD (16 tipos: CPU, Monitor, Impresora, Cámara Web, Diademas, Biométrico, Teclado, Mouse, Cables, Tablet, Celular, Módem, BAM)
- Empleados CRUD (nombre, num_empleado, puesto, área, CC, jefe_inmediato, sucursal)
- Sucursales CRUD (corporativo/sucursal, lat/lng para mapa)
- Asignaciones (empleado/sucursal, multi-dispositivo, auto-actualiza ubicación)
- Documentos (entrada/salida/responsiva, firma digital con canvas, export PDF)
- Plantillas con versionamiento (tags dinámicos: {{receptor_nombre}}, etc.)
- Expedientes (historial completo por empleado o sucursal)
- Cambios de equipo (reparación/baja definitiva/actualización, proveedor)
- Cotizaciones (USD/MXN, IVA 16%, repositorio de productos, export PDF)
- Mapa interactivo República Mexicana (sucursales + empleados)
- Usuarios del sistema (super_admin / agente_soporte / vista)
- Auditoría automática de todas las acciones
- Proveedores CRUD

## Credenciales demo
- admin / admin123 → Super Admin
- soporte / admin123 → Agente Soporte TI
- vista / admin123 → Solo Vista

## Iniciar proyecto
```
cd C:/jestrada/Proyectos/inventario-ti
npm run dev  (inicia frontend en :5174 y backend en :3002)
```

## Para migrar a MySQL
Ver comentarios al final de /backend/src/data/db.js con todos los schemas listos.
Almacenamiento de firmas/PDFs en /backend/uploads/ (preparado para S3).
Tipo de cambio USD/MXN en /backend/src/routes/exchange.routes.js (conectar a API Banxico).
