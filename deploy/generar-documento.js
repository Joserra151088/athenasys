const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageNumber, Header, Footer, VerticalAlign, PageBreak, LevelFormat
} = require('docx');
const fs = require('fs');

const BLUE  = "1F4E79";
const LBLUE = "2E75B6";
const LLBLUE = "D6E4F0";
const GRAY  = "F2F2F2";
const WHITE = "FFFFFF";
const DARK  = "1A1A2E";

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, bold: true, size: 32, color: BLUE, font: "Arial" })]
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, bold: true, size: 26, color: LBLUE, font: "Arial" })]
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 22, font: "Arial", ...opts })]
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: "Arial" })]
  });
}

function code(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: 720 },
    children: [new TextRun({ text, size: 18, font: "Courier New", color: "2D2D2D" })]
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun("")] });
}

function sectionLine() {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LBLUE, space: 1 } },
    children: [new TextRun("")]
  });
}

function tableHeader(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: LBLUE, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 160, right: 160 },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 20, color: WHITE, font: "Arial" })]
    })]
  });
}

function tableCell(text, width, shade = false) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: shade ? GRAY : WHITE, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 160, right: 160 },
    children: [new Paragraph({
      children: [new TextRun({ text, size: 20, font: "Arial" })]
    })]
  });
}

function tableCellBold(text, width, shade = false) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: shade ? LLBLUE : WHITE, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 160, right: 160 },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 20, font: "Arial", color: BLUE })]
    })]
  });
}

// ─── DIAGRAM TABLE (text-based architecture) ───────────────────────────────
function diagramBox(text, fill) {
  return new TableCell({
    borders,
    width: { size: 9360, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 200, right: 200 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 22, font: "Arial", color: WHITE })]
    })]
  });
}

function arrowRow() {
  return new TableRow({
    children: [new TableCell({
      borders: noBorders,
      width: { size: 9360, type: WidthType.DXA },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "▼", size: 28, font: "Arial", color: LBLUE })]
      })]
    })]
  });
}

const architectureDiagram = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [9360],
  rows: [
    new TableRow({ children: [diagramBox("INTERNET  (Usuarios / Navegador Web)", "2E75B6")] }),
    arrowRow(),
    new TableRow({ children: [diagramBox("EC2  t2.micro — Ubuntu 22.04  |  IP: 3.140.107.137  |  Puerto 80 (HTTP)", "1F4E79")] }),
    arrowRow(),
    new TableRow({ children: [
      new TableCell({
        borders,
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill: LLBLUE, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 200, right: 200 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Nginx (Reverse Proxy)", bold: true, size: 22, font: "Arial", color: BLUE })]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "  /        → Frontend React (archivos estáticos en /var/www/athenasys)", size: 20, font: "Arial", color: DARK })]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "  /api/    → Backend Node.js (proxy a localhost:3002)", size: 20, font: "Arial", color: DARK })]
          }),
        ]
      })
    ] }),
    arrowRow(),
    new TableRow({ children: [diagramBox("Node.js + Express  (PM2)  |  Puerto 3002  |  23 rutas API", "1F4E79")] }),
    arrowRow(),
    new TableRow({ children: [diagramBox("RDS MySQL 8.0  |  db.t3.micro  |  athenasys-db.chioa482k7r3.us-east-2.rds.amazonaws.com", "2E75B6")] }),
  ]
});

// ─── DOCUMENT ──────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
    }]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: LBLUE },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LBLUE, space: 1 } },
          children: [
            new TextRun({ text: "AthenaSys — Arquitectura AWS", bold: true, size: 20, font: "Arial", color: BLUE }),
            new TextRun({ text: "   |   Documento Técnico", size: 20, font: "Arial", color: "888888" }),
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: LBLUE, space: 1 } },
          children: [
            new TextRun({ text: "Página ", size: 18, font: "Arial", color: "888888" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "888888" }),
            new TextRun({ text: "  |  Confidencial — Uso Interno", size: 18, font: "Arial", color: "888888" }),
          ]
        })]
      })
    },
    children: [

      // ── PORTADA ─────────────────────────────────────────────────────────
      spacer(), spacer(), spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 120 },
        children: [new TextRun({ text: "AthenaSys", bold: true, size: 72, font: "Arial", color: BLUE })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 240 },
        children: [new TextRun({ text: "Documento de Arquitectura AWS", size: 36, font: "Arial", color: LBLUE })]
      }),
      sectionLine(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 60 },
        children: [new TextRun({ text: "Sistema de Inventario de Dispositivos TI", size: 24, font: "Arial", color: "555555" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 480 },
        children: [new TextRun({ text: "Versión 1.0  |  Abril 2026", size: 22, font: "Arial", color: "888888" })]
      }),
      spacer(), spacer(), spacer(),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 1. RESUMEN EJECUTIVO ─────────────────────────────────────────────
      heading1("1. Resumen Ejecutivo"),
      sectionLine(),
      body("AthenaSys es un sistema web de inventario de dispositivos TI desplegado en la infraestructura de Amazon Web Services (AWS). La aplicación cuenta con un frontend en React, un backend en Node.js/Express y una base de datos MySQL gestionada en Amazon RDS."),
      spacer(),
      body("El despliegue actual utiliza el plan gratuito de AWS (Free Tier) y no requiere dominio personalizado, siendo accesible mediante una IP pública fija (Elastic IP)."),
      spacer(),

      // ── 2. INFORMACIÓN DE ACCESO ──────────────────────────────────────────
      heading2("Información de Acceso"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3000, 6360],
        rows: [
          new TableRow({ children: [tableHeader("Dato", 3000), tableHeader("Valor", 6360)] }),
          new TableRow({ children: [tableCellBold("URL de la aplicación", 3000, true), tableCell("http://3.140.107.137", 6360, true)] }),
          new TableRow({ children: [tableCellBold("IP Pública (Elastic IP)", 3000), tableCell("3.140.107.137", 6360)] }),
          new TableRow({ children: [tableCellBold("Región AWS", 3000, true), tableCell("us-east-2 (Ohio)", 6360, true)] }),
          new TableRow({ children: [tableCellBold("Usuario SSH", 3000), tableCell("ubuntu", 6360)] }),
          new TableRow({ children: [tableCellBold("Clave SSH", 3000, true), tableCell("athenasys-key.pem", 6360, true)] }),
        ]
      }),
      spacer(),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 2. ARQUITECTURA ───────────────────────────────────────────────────
      heading1("2. Diagrama de Arquitectura"),
      sectionLine(),
      body("El siguiente diagrama muestra el flujo de la solicitud desde el usuario hasta la base de datos:"),
      spacer(),
      architectureDiagram,
      spacer(),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 3. COMPONENTES ────────────────────────────────────────────────────
      heading1("3. Componentes de la Infraestructura"),
      sectionLine(),

      heading2("3.1 Amazon EC2 — Servidor de Aplicación"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3000, 6360],
        rows: [
          new TableRow({ children: [tableHeader("Propiedad", 3000), tableHeader("Valor", 6360)] }),
          new TableRow({ children: [tableCellBold("Tipo de instancia", 3000, true), tableCell("t2.micro (Free Tier)", 6360, true)] }),
          new TableRow({ children: [tableCellBold("Sistema operativo", 3000), tableCell("Ubuntu Server 22.04 LTS", 6360)] }),
          new TableRow({ children: [tableCellBold("IP pública", 3000, true), tableCell("3.140.107.137 (Elastic IP)", 6360, true)] }),
          new TableRow({ children: [tableCellBold("Puertos abiertos", 3000), tableCell("22 (SSH), 80 (HTTP)", 6360)] }),
          new TableRow({ children: [tableCellBold("Almacenamiento", 3000, true), tableCell("8 GB SSD (gp2)", 6360, true)] }),
          new TableRow({ children: [tableCellBold("Región", 3000), tableCell("us-east-2 (Ohio)", 6360)] }),
        ]
      }),
      spacer(),

      heading2("3.2 Amazon RDS — Base de Datos"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3000, 6360],
        rows: [
          new TableRow({ children: [tableHeader("Propiedad", 3000), tableHeader("Valor", 6360)] }),
          new TableRow({ children: [tableCellBold("Motor", 3000, true), tableCell("MySQL 8.0", 6360, true)] }),
          new TableRow({ children: [tableCellBold("Tipo de instancia", 3000), tableCell("db.t3.micro (Free Tier)", 6360)] }),
          new TableRow({ children: [tableCellBold("Almacenamiento", 3000, true), tableCell("20 GB SSD", 6360, true)] }),
          new TableRow({ children: [tableCellBold("Base de datos", 3000), tableCell("athenasys", 6360)] }),
          new TableRow({ children: [tableCellBold("Usuario", 3000, true), tableCell("admin", 6360, true)] }),
          new TableRow({ children: [tableCellBold("Endpoint", 3000), tableCell("athenasys-db.chioa482k7r3.us-east-2.rds.amazonaws.com", 6360)] }),
          new TableRow({ children: [tableCellBold("Acceso público", 3000, true), tableCell("No (solo desde EC2 via Security Group)", 6360, true)] }),
          new TableRow({ children: [tableCellBold("Tablas", 3000), tableCell("33 tablas migradas", 6360)] }),
        ]
      }),
      spacer(),

      heading2("3.3 Software en el Servidor EC2"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2500, 2000, 4860],
        rows: [
          new TableRow({ children: [tableHeader("Software", 2500), tableHeader("Versión", 2000), tableHeader("Función", 4860)] }),
          new TableRow({ children: [tableCellBold("Node.js", 2500, true), tableCell("20.x", 2000, true), tableCell("Runtime del backend", 4860, true)] }),
          new TableRow({ children: [tableCellBold("Nginx", 2500), tableCell("1.24", 2000), tableCell("Servidor web / reverse proxy", 4860)] }),
          new TableRow({ children: [tableCellBold("PM2", 2500, true), tableCell("Latest", 2000, true), tableCell("Gestor de procesos Node.js", 4860, true)] }),
          new TableRow({ children: [tableCellBold("Express.js", 2500), tableCell("4.18", 2000), tableCell("Framework API REST", 4860)] }),
          new TableRow({ children: [tableCellBold("React", 2500, true), tableCell("18.2", 2000, true), tableCell("Framework frontend (SPA)", 4860, true)] }),
          new TableRow({ children: [tableCellBold("Vite", 2500), tableCell("5.1", 2000), tableCell("Bundler del frontend", 4860)] }),
        ]
      }),
      spacer(),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 4. RUTAS Y SERVICIOS ──────────────────────────────────────────────
      heading1("4. Rutas de la API"),
      sectionLine(),
      body("El backend expone 23 endpoints bajo el prefijo /api/:"),
      spacer(),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3500, 5860],
        rows: [
          new TableRow({ children: [tableHeader("Ruta", 3500), tableHeader("Descripción", 5860)] }),
          ...[
            ["/api/auth", "Autenticación (login / verificación JWT)"],
            ["/api/dispositivos", "Gestión de dispositivos TI"],
            ["/api/empleados", "Registro de empleados"],
            ["/api/asignaciones", "Asignación de dispositivos"],
            ["/api/documentos", "Gestión de documentos"],
            ["/api/expedientes", "Expedientes de casos"],
            ["/api/cotizaciones", "Cotizaciones y presupuestos"],
            ["/api/proveedores", "Gestión de proveedores"],
            ["/api/licencias", "Licencias de software"],
            ["/api/finanzas", "Módulo financiero"],
            ["/api/presupuesto", "Control de presupuesto"],
            ["/api/reportes", "Generación de reportes"],
            ["/api/auditoria", "Registro de auditoría"],
            ["/api/usuarios-sistema", "Usuarios del sistema"],
            ["/api/config", "Configuración general"],
            ["/api/firma-online", "Firmas digitales"],
            ["/api/health", "Estado del servidor"],
          ].map(([ruta, desc], i) => new TableRow({
            children: [tableCellBold(ruta, 3500, i % 2 === 0), tableCell(desc, 5860, i % 2 === 0)]
          }))
        ]
      }),
      spacer(),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 5. COSTOS ─────────────────────────────────────────────────────────
      heading1("5. Costos Estimados"),
      sectionLine(),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3000, 2000, 2180, 2180],
        rows: [
          new TableRow({ children: [
            tableHeader("Servicio", 3000),
            tableHeader("Tipo", 2000),
            tableHeader("Free Tier (12 meses)", 2180),
            tableHeader("Costo después", 2180),
          ]}),
          new TableRow({ children: [
            tableCellBold("EC2", 3000, true), tableCell("t2.micro", 2000, true),
            tableCell("$0 USD/mes", 2180, true), tableCell("~$8 USD/mes", 2180, true),
          ]}),
          new TableRow({ children: [
            tableCellBold("RDS MySQL", 3000), tableCell("db.t3.micro", 2000),
            tableCell("$0 USD/mes", 2180), tableCell("~$13 USD/mes", 2180),
          ]}),
          new TableRow({ children: [
            tableCellBold("Elastic IP", 3000, true), tableCell("—", 2000, true),
            tableCell("$0 USD/mes", 2180, true), tableCell("$0 USD/mes", 2180, true),
          ]}),
          new TableRow({ children: [
            tableCellBold("TOTAL", 3000), tableCell("—", 2000),
            new TableCell({
              borders,
              width: { size: 2180, type: WidthType.DXA },
              shading: { fill: "D5F5E3", type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 160, right: 160 },
              children: [new Paragraph({ children: [new TextRun({ text: "$0 USD/mes", bold: true, size: 20, font: "Arial", color: "1E8449" })] })]
            }),
            new TableCell({
              borders,
              width: { size: 2180, type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 160, right: 160 },
              children: [new Paragraph({ children: [new TextRun({ text: "~$21 USD/mes", bold: true, size: 20, font: "Arial" })] })]
            }),
          ]}),
        ]
      }),
      spacer(),
      body("Equivalente en MXN (aprox. $20 MXN/USD): $0 durante los primeros 12 meses, ~$420 MXN/mes después.", { color: "555555" }),
      spacer(),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 6. MANTENIMIENTO ──────────────────────────────────────────────────
      heading1("6. Guía de Mantenimiento"),
      sectionLine(),

      heading2("6.1 Conectarse al servidor"),
      code('ssh -i "C:\\Users\\DELL\\Downloads\\athenasys-key.pem" ubuntu@3.140.107.137'),
      spacer(),

      heading2("6.2 Comandos del backend (PM2)"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4500, 4860],
        rows: [
          new TableRow({ children: [tableHeader("Comando", 4500), tableHeader("Acción", 4860)] }),
          new TableRow({ children: [tableCellBold("pm2 status", 4500, true), tableCell("Ver estado del backend", 4860, true)] }),
          new TableRow({ children: [tableCellBold("pm2 logs athenasys-backend", 4500), tableCell("Ver logs en tiempo real", 4860)] }),
          new TableRow({ children: [tableCellBold("pm2 restart athenasys-backend", 4500, true), tableCell("Reiniciar el backend", 4860, true)] }),
          new TableRow({ children: [tableCellBold("pm2 stop athenasys-backend", 4500), tableCell("Detener el backend", 4860)] }),
        ]
      }),
      spacer(),

      heading2("6.3 Comandos de Nginx"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4500, 4860],
        rows: [
          new TableRow({ children: [tableHeader("Comando", 4500), tableHeader("Acción", 4860)] }),
          new TableRow({ children: [tableCellBold("sudo systemctl status nginx", 4500, true), tableCell("Ver estado de Nginx", 4860, true)] }),
          new TableRow({ children: [tableCellBold("sudo systemctl reload nginx", 4500), tableCell("Recargar configuración", 4860)] }),
          new TableRow({ children: [tableCellBold("sudo systemctl restart nginx", 4500, true), tableCell("Reiniciar Nginx", 4860, true)] }),
          new TableRow({ children: [tableCellBold("sudo tail -f /var/log/nginx/error.log", 4500), tableCell("Ver errores de Nginx", 4860)] }),
        ]
      }),
      spacer(),

      heading2("6.4 Actualizar la aplicación"),
      body("Cuando haya cambios en el backend:", { bold: true }),
      code("cd ~/athenasys && git pull && pm2 restart athenasys-backend"),
      spacer(),
      body("Cuando haya cambios en el frontend (ejecutar en tu PC):", { bold: true }),
      code("cd C:\\jestrada\\Proyectos\\athenasys\\frontend && npm run build"),
      code('scp -i C:\\Users\\DELL\\Downloads\\athenasys-key.pem -r dist\\* ubuntu@3.140.107.137:/var/www/athenasys/'),
      spacer(),

      heading2("6.5 Conectar a la base de datos con DBeaver"),
      body("Usa los siguientes datos con un tunel SSH:"),
      spacer(),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3000, 6360],
        rows: [
          new TableRow({ children: [tableHeader("Parámetro", 3000), tableHeader("Valor", 6360)] }),
          new TableRow({ children: [tableCellBold("Host (BD)", 3000, true), tableCell("athenasys-db.chioa482k7r3.us-east-2.rds.amazonaws.com", 6360, true)] }),
          new TableRow({ children: [tableCellBold("Puerto (BD)", 3000), tableCell("3306", 6360)] }),
          new TableRow({ children: [tableCellBold("Base de datos", 3000, true), tableCell("athenasys", 6360, true)] }),
          new TableRow({ children: [tableCellBold("Usuario", 3000), tableCell("admin", 6360)] }),
          new TableRow({ children: [tableCellBold("SSH Host", 3000, true), tableCell("3.140.107.137", 6360, true)] }),
          new TableRow({ children: [tableCellBold("SSH Puerto", 3000), tableCell("22", 6360)] }),
          new TableRow({ children: [tableCellBold("SSH Usuario", 3000, true), tableCell("ubuntu", 6360, true)] }),
          new TableRow({ children: [tableCellBold("SSH Auth", 3000), tableCell("Public Key — athenasys-key.pem", 6360)] }),
        ]
      }),
      spacer(),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 7. PRÓXIMOS PASOS ─────────────────────────────────────────────────
      heading1("7. Próximos Pasos Recomendados"),
      sectionLine(),
      bullet("Adquirir un dominio personalizado y apuntarlo a la IP 3.140.107.137"),
      bullet("Instalar certificado SSL gratuito con Let's Encrypt (HTTPS)"),
      bullet("Configurar backups automáticos de RDS"),
      bullet("Habilitar CloudWatch para monitoreo y alertas"),
      bullet("Escalar a t3.small si el uso aumenta ($15 USD/mes)"),
      spacer(),

    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  const outputPath = "C:\\Users\\DELL\\Downloads\\AthenaSys-Arquitectura-AWS.docx";
  fs.writeFileSync(outputPath, buffer);
  console.log("Documento generado:", outputPath);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
