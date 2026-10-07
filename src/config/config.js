require('dotenv').config({ quiet: true });
const { getPaperSize } = require('./paper-sizes');

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  
  // Configuración de la impresora por defecto
  printer: {
    name: process.env.PRINTER_NAME || 'Pensilpos', // Nombre de la impresora configurada en el SO
    paper: getPaperSize(process.env.PAPER_SIZE || '80mm'), // Ver src/config/paper-sizes.js
    encoding: 'utf-8',
    language: 'esc-pos' // esc-pos, star-line, star-prnt
  }
};
