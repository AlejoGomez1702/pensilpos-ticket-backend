// Corre antes de que cualquier test file cargue src/config/config.js, que lee estas
// variables a nivel de módulo. Se fijan explícitamente para que un .env local no
// cambie el resultado de los tests.
process.env.NODE_ENV = 'test';
process.env.PRINTER_NAME = 'Pensilpos';
process.env.PAPER_SIZE = '80mm';
