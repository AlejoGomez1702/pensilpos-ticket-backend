# Pensilpos Ticket Backend

Servicio local para impresión de recibos en impresoras ESC/POS.

## 🚀 Tecnologías

- Node.js + Express
- ReceiptPrinterEncoder (ESC/POS)
- Electron (desktop app)

## 📦 Instalación

\`\`\`bash
npm install
\`\`\`

## 🔧 Desarrollo

\`\`\`bash
npm run dev
\`\`\`

## 🏃 Producción

\`\`\`bash
npm start
\`\`\`

## 📡 API Endpoints

- `GET /health` - Health check
- `POST /api/printer/print` - Imprimir recibo
- `GET /api/printer/list` - Listar impresoras disponibles

## 📝 Configuración

Crear archivo `.env` a partir de `.env.example`:

\`\`\`env
PORT=3000
NODE_ENV=development
PRINTER_NAME=Pensilpos   # Nombre de la impresora en el SO (default: Pensilpos)
\`\`\`

## 📄 Licencia

ISC