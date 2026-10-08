const request = require('supertest');

// Frontera externa (impresora física y spooler de Windows): se reemplazan por dobles.
jest.mock('@point-of-sale/system-receipt-printer', () => require('../helpers/fake-receipt-printer').FakeReceiptPrinter);
jest.mock('../../src/helpers/printer-queue.helper', () => ({
    clearPrintQueue: jest.fn().mockResolvedValue({ success: true }),
}));

const { buildTestApp } = require('../helpers/build-test-app');
const { FakeReceiptPrinter } = require('../helpers/fake-receipt-printer');

const toText = (data) => Buffer.from(data).toString('latin1');

const validOrder = () => ({
    order_data: { order_type: 'TABLE', table_name: 'Mesa 1' },
    sale_data: {
        products: [
            { product_name: 'Perro Ranchero', count: 2, note: 'sin cebolla' },
            { product_name: 'Gaseosa', count: 1 },
        ],
        notes: 'Servir juntos',
    },
});

describe('POST /api/printer/print-kitchen-ticket', () => {
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

    it('imprime la comanda de cocina en la impresora configurada', async () => {
        const res = await request(app).post('/api/printer/print-kitchen-ticket').send(validOrder());

        expect(res.status).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ ok: true, msg: 'Ticket de cocina impreso correctamente', printer: 'Pensilpos' }));
        expect(FakeReceiptPrinter.jobs).toHaveLength(1);

        const text = toText(FakeReceiptPrinter.jobs[0].data);
        expect(text).toContain('MESA 1');
        expect(text).toContain('x2 Perro Ranchero');
        expect(text).toContain('> sin cebolla');
        expect(text).toContain('Servir juntos');
    });

    it('imprime una comanda de domicilio con el costo de envío', async () => {
        const body = validOrder();
        body.order_data = { order_type: 'DELIVERY', customer_name: 'Ana', delivery_cost: 5000 };

        const res = await request(app).post('/api/printer/print-kitchen-ticket').send(body);

        expect(res.status).toBe(200);
        const text = toText(FakeReceiptPrinter.jobs[0].data);
        expect(text).toContain('DOMICILIO');
        expect(text).toContain('Ana');
        expect(text).toContain('Costo Domicilio: $5.000');
    });

    it.each([
        ['tipo de orden inválido', (body) => { body.order_data.order_type = 'PICKUP'; }, 'order_data.order_type'],
        ['sin productos', (body) => { body.sale_data.products = []; }, 'sale_data.products'],
        ['sin datos de la orden', (body) => { delete body.order_data; }, 'order_data'],
    ])('responde 400 y no imprime: %s', async (_, mutate, field) => {
        const body = validOrder();
        mutate(body);

        const res = await request(app).post('/api/printer/print-kitchen-ticket').send(body);

        expect(res.status).toBe(400);
        expect(res.body.errors).toHaveProperty([field]);
        expect(FakeReceiptPrinter.jobs).toHaveLength(0);
    });
});
