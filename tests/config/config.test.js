describe('config', () => {
    const originalEnv = process.env;

    // Carga config.js aislado, sin leer el .env local, con las variables indicadas.
    const loadConfig = (env) => {
        process.env = { ...originalEnv, PORT: '', NODE_ENV: '', PRINTER_NAME: '', PAPER_SIZE: '', ...env };
        let config;
        jest.isolateModules(() => {
            jest.doMock('dotenv', () => ({ config: jest.fn() }));
            config = require('../../src/config/config');
        });
        return config;
    };

    afterEach(() => {
        process.env = originalEnv;
    });

    it('usa los valores por defecto cuando no hay variables de entorno', () => {
        const config = loadConfig({});

        expect(config.port).toBe(3000);
        expect(config.env).toBe('development');
        expect(config.printer.name).toBe('Pensilpos');
        expect(config.printer.paper.name).toBe('80mm');
    });

    it('toma los valores de las variables de entorno', () => {
        const config = loadConfig({ PORT: '4000', NODE_ENV: 'production', PRINTER_NAME: 'Caja 2', PAPER_SIZE: '80mm' });

        expect(config.port).toBe('4000');
        expect(config.env).toBe('production');
        expect(config.printer.name).toBe('Caja 2');
        expect(config.printer.paper.name).toBe('80mm');
    });

    it('falla al cargar si PAPER_SIZE no es un tamaño soportado', () => {
        expect(() => loadConfig({ PAPER_SIZE: 'A4' })).toThrow('Tamaño de papel "A4" no soportado');
    });
});
