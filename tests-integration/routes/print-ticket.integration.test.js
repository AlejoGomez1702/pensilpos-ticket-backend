const request = require('supertest');

// Frontera externa (impresora física y spooler de Windows): se reemplazan por dobles.
jest.mock('@point-of-sale/system-receipt-printer', () => require('../helpers/fake-receipt-printer').FakeReceiptPrinter);
jest.mock('../../src/helpers/printer-queue.helper', () => ({
    clearPrintQueue: jest.fn().mockResolvedValue({ success: true }),
}));

const { buildTestApp } = require('../helpers/build-test-app');
const { FakeReceiptPrinter } = require('../helpers/fake-receipt-printer');

const toText = (data) => Buffer.from(data).toString('latin1');

const validSale = () => ({
    establishment_name: 'El Sultan',
    establishment_nit: '123.456.789-0',
    establishment_phone: '3217816922',
    establishment_address: 'Cali, Valle del Cauca',
    waiter_name: 'Luis Alejandro',
    sale_data: {
        products: [
            { product_name: 'Perro Ranchero', product_note: 'sin cebolla', count: 2, sale_price: 15000, total_item_value: 30000 },
            { product_name: 'Sandwich De Pollo', count: 1, sale_price: 8500, total_item_value: 8500 },
        ],
        notes: 'Nota general',
        total: 38500,
    },
});

describe('POST /api/printer/print-ticket', () => {
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

    it('imprime el ticket de venta en la impresora configurada', async () => {
        const res = await request(app).post('/api/printer/print-ticket').send(validSale());

        expect(res.status).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ ok: true, msg: 'Ticket impreso correctamente', printer: 'Pensilpos' }));
        expect(FakeReceiptPrinter.jobs).toHaveLength(1);
        expect(res.body.bytes).toBe(FakeReceiptPrinter.jobs[0].data.length);

        const text = toText(FakeReceiptPrinter.jobs[0].data);
        expect(text).toContain('El Sultan');
        expect(text).toContain('Perro Ranchero');
        expect(text).toContain('> sin cebolla');
        expect(text).toContain('TOTAL: $38.500');
    });

    it('imprime una venta de solo tiempo de billar', async () => {
        const body = validSale();
        body.sale_data = {
            products: [],
            total: 15000,
            billiard_sale: { table_name: 'Mesa 3', elapsed_minutes: 90, hourly_rate: 10000 },
        };

        const res = await request(app).post('/api/printer/print-ticket').send(body);

        expect(res.status).toBe(200);
        const text = toText(FakeReceiptPrinter.jobs[0].data);
        expect(text).toContain('Mesa: Mesa 3');
        expect(text).toContain('Subtotal mesa: $15.000');
    });

    it('responde 400 y no imprime si faltan campos obligatorios', async () => {
        const body = validSale();
        delete body.establishment_name;
        delete body.waiter_name;

        const res = await request(app).post('/api/printer/print-ticket').send(body);

        expect(res.status).toBe(400);
        expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['establishment_name', 'waiter_name']));
        expect(FakeReceiptPrinter.jobs).toHaveLength(0);
    });

    it('responde 400 si la venta no tiene productos ni venta de billar', async () => {
        const body = validSale();
        body.sale_data.products = [];

        const res = await request(app).post('/api/printer/print-ticket').send(body);

        expect(res.status).toBe(400);
        expect(res.body.errors.sale_data.msg).toBe('La venta debe tener productos o una venta de tiempo (billar)');
    });

    it('responde 500 con las impresoras disponibles si la configurada no está instalada', async () => {
        FakeReceiptPrinter.printers = [{ name: 'Microsoft Print to PDF' }];

        const res = await request(app).post('/api/printer/print-ticket').send(validSale());

        expect(res.status).toBe(500);
        expect(res.body).toEqual(expect.objectContaining({
            msg: 'Impresora "Pensilpos" no configurada',
            availablePrinters: ['Microsoft Print to PDF'],
        }));
    });

    it('responde 500 si la impresora falla y la siguiente impresión funciona', async () => {
        FakeReceiptPrinter.failNextPrint = true;

        const failed = await request(app).post('/api/printer/print-ticket').send(validSale());
        const next = await request(app).post('/api/printer/print-ticket').send(validSale());

        expect(failed.status).toBe(500);
        expect(failed.body.error).toBe('Error de impresora: Papel atascado');
        expect(next.status).toBe(200);
        expect(FakeReceiptPrinter.jobs).toHaveLength(1);
    });
});
