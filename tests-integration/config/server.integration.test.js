// Auditoría adversarial de la app de Express (src/config/server.js): CORS, límite del cuerpo,
// JSON mal formado y rutas que no existen.
const request = require('supertest');

jest.mock('@point-of-sale/system-receipt-printer', () => require('../helpers/fake-receipt-printer').FakeReceiptPrinter);
jest.mock('../../src/helpers/printer-queue.helper', () => ({
    clearPrintQueue: jest.fn().mockResolvedValue({ success: true }),
}));

const { buildTestApp } = require('../helpers/build-test-app');
const { FakeReceiptPrinter } = require('../helpers/fake-receipt-printer');

const validSale = () => ({
    establishment_name: 'El Sultan',
    waiter_name: 'Luis Alejandro',
    sale_data: {
        products: [{ product_name: 'Perro Ranchero', count: 2, sale_price: 15000, total_item_value: 30000 }],
        total: 30000,
    },
});

describe('app de Express', () => {
    let app;

    beforeAll(() => {
        app = buildTestApp();
    });

    beforeEach(() => {
        FakeReceiptPrinter.reset();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // El frontend (otro origen: Firebase Hosting o localhost:4200) envía JSON, así que el navegador
    // hace antes un preflight; sin esta respuesta no podría imprimir.
    it('responde el preflight CORS del frontend para POST con JSON', async () => {
        const res = await request(app)
            .options('/api/printer/print-ticket')
            .set('Origin', 'https://app.pensilpos.example')
            .set('Access-Control-Request-Method', 'POST')
            .set('Access-Control-Request-Headers', 'content-type');

        expect(res.status).toBe(204);
        expect(res.headers['access-control-allow-origin']).toBeDefined();
        expect(res.headers['access-control-allow-methods']).toContain('POST');
        expect(res.headers['access-control-allow-headers']).toBe('content-type');
    });

    it('la respuesta de impresión lleva la cabecera CORS para que el navegador se la entregue al frontend', async () => {
        const res = await request(app).post('/api/printer/print-ticket').set('Origin', 'https://app.pensilpos.example').send(validSale());

        expect(res.status).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBeDefined();
    });

    it('acepta un cuerpo mayor al límite por defecto de Express (100 kb)', async () => {
        const body = validSale();
        body.sale_data.extra = 'x'.repeat(300 * 1024);

        const res = await request(app).post('/api/printer/print-ticket').send(body);

        expect(res.status).toBe(200);
    });

    it('rechaza con 413 un cuerpo de más de 20 mb y no imprime', async () => {
        const body = validSale();
        body.sale_data.extra = 'x'.repeat(21 * 1024 * 1024);

        const res = await request(app).post('/api/printer/print-ticket').send(body);

        expect(res.status).toBe(413);
        expect(FakeReceiptPrinter.jobs).toHaveLength(0);
    });

    it('un JSON mal formado responde 400 y no imprime', async () => {
        const res = await request(app).post('/api/printer/print-ticket').set('Content-Type', 'application/json').send('{"sale_data":');

        expect(res.status).toBe(400);
        expect(FakeReceiptPrinter.jobs).toHaveLength(0);
    });

    // BUG-AUDIT: no hay manejador de errores propio. Un JSON mal formado (o un cuerpo de más de 20 mb) lo responde
    // Express en HTML y, fuera de producción, con el stack y las rutas del disco; el contrato es JSON { ok: false, ... }.
    it.failing('un JSON mal formado responde en JSON con ok: false, sin stack', async () => {
        const res = await request(app).post('/api/printer/print-ticket').set('Content-Type', 'application/json').send('{"sale_data":');

        expect(res.type).toBe('application/json');
        expect(res.body.ok).toBe(false);
        expect(res.text).not.toContain('node_modules');
    });

    it('sin cuerpo o con otro Content-Type responde el 400 de validación, no un 500', async () => {
        const empty = await request(app).post('/api/printer/print-ticket');
        const text = await request(app).post('/api/printer/print-ticket').set('Content-Type', 'text/plain').send('hola');

        expect(empty.status).toBe(400);
        expect(empty.body.message).toBe('Errores de validación en los campos enviados.');
        expect(text.status).toBe(400);
        expect(text.body.ok).toBe(false);
    });

    it.each([
        ['POST', '/api/printer/otra-cosa'],
        ['GET', '/api/printer/print-ticket'],
        ['POST', '/printer/print-ticket'],
    ])('%s %s no existe: 404 y no imprime', async (method, path) => {
        const res = await request(app)[method.toLowerCase()](path).send(validSale());

        expect(res.status).toBe(404);
        expect(FakeReceiptPrinter.jobs).toHaveLength(0);
    });
});
