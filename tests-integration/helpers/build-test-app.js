const Server = require('../../src/config/server');

/**
 * Arma la app de Express real (rutas + middlewares reales) sin bindear puerto.
 * El constructor de Server ya registra middlewares y rutas; no se llama a listen().
 */
const buildTestApp = () => new Server().app;

module.exports = { buildTestApp };
