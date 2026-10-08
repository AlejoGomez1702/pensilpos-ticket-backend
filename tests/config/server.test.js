// Las rutas reales arrastran el driver de impresora y canvas; acá solo importa que se monten.
jest.mock('../../src/routes/printer.routes', () => jest.requireActual('express').Router());

const Server = require('../../src/config/server');
const config = require('../../src/config/config');

describe('Server', () => {
    it('el constructor toma el puerto de la config y registra middlewares y rutas', () => {
        const middlewaresSpy = jest.spyOn(Server.prototype, 'startMiddlewares');
        const routesSpy = jest.spyOn(Server.prototype, 'startRoutes');

        const server = new Server();

        expect(server.port).toBe(config.port);
        expect(middlewaresSpy).toHaveBeenCalledTimes(1);
        expect(routesSpy).toHaveBeenCalledTimes(1);
    });

    it('startMiddlewares registra cors y express.json sobre this.app', () => {
        const server = new Server();
        const useSpy = jest.spyOn(server.app, 'use').mockImplementation(() => {});

        server.startMiddlewares();

        expect(useSpy).toHaveBeenCalledTimes(2);
    });

    it('startRoutes monta las rutas de impresora en /api/printer', () => {
        const server = new Server();
        const useSpy = jest.spyOn(server.app, 'use').mockImplementation(() => {});

        server.startRoutes();

        expect(useSpy).toHaveBeenCalledWith('/api/printer', expect.any(Function));
    });

    it('listen escucha en el puerto configurado e imprime el resumen de arranque', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const server = new Server();
        const listenSpy = jest.spyOn(server.app, 'listen').mockImplementation((port, callback) => callback());

        server.listen();

        expect(listenSpy).toHaveBeenCalledWith(config.port, expect.any(Function));
        expect(logSpy).toHaveBeenCalledWith(`🖨️  Printer: ${config.printer.name}`);
        expect(logSpy).toHaveBeenCalledWith(`📄 Paper: ${config.printer.paper.name}`);
    });
});
