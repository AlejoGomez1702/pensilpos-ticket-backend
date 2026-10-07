# Pensilpos Ticket Backend

Servicio local para impresión de tickets en impresoras térmicas ESC/POS.

## 🚀 Tecnologías

- Node.js + Express
- ReceiptPrinterEncoder (ESC/POS)
- node-windows (servicio de Windows)

## 📦 Instalación

```bash
npm install
cp .env.example .env
```

## 📝 Configuración

Variables del archivo `.env` (ver `.env.example`):

| Variable       | Descripción                                   | Default       |
|----------------|-----------------------------------------------|---------------|
| `PORT`         | Puerto del servidor                           | `3000`        |
| `NODE_ENV`     | `development` \| `production`                 | `development` |
| `PRINTER_NAME` | Nombre de la impresora en el sistema operativo | `Pensilpos`   |

La impresora debe estar instalada en el sistema operativo con el nombre indicado en `PRINTER_NAME`.

## 🔧 Desarrollo

```bash
npm run dev
```

## 🏃 Producción

Ejecutar directamente:

```bash
npm start
```

O instalarlo como servicio de Windows ("Pensilpos Ticket Service"), ejecutando la terminal como Administrador:

```bash
node node-service.js --install     # Instala e inicia el servicio
node node-service.js --uninstall   # Detiene y desinstala el servicio
```

## 📡 API Endpoints

- `POST /api/printer/print-ticket` - Imprimir ticket de venta
- `POST /api/printer/print-kitchen-ticket` - Imprimir comanda de cocina

Ver ejemplos de peticiones en `rest-client.http`.

## 📄 Licencia

ISC
