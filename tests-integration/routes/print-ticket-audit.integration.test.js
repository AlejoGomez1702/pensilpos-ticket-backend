// Auditoría adversarial del endpoint de venta: validación campo por campo, lo que queda impreso
// con la cadena real (ruta → middlewares → builder) y la cola de impresión con peticiones a la vez.
const request = require('supertest');

jest.mock('@point-of-sale/system-receipt-printer', () => require('../helpers/fake-receipt-printer').FakeReceiptPrinter);
jest.mock('../../src/helpers/printer-queue.helper', () => ({
    clearPrintQueue: jest.fn().mockResolvedValue({ success: true }),
}));

const { buildTestApp } = require('../helpers/build-test-app');
const { FakeReceiptPrinter } = require('../helpers/fake-receipt-printer');
const { clearPrintQueue } = require('../../src/helpers/printer-queue.helper');
const { printedLines, printedTexts } = require('../../tests/support/escpos');

const validSale = () => ({
    establishment_name: 'El Sultan',
    waiter_name: 'Luis Alejandro',
    sale_data: {
        products: [
            { product_name: 'Perro Ranchero', count: 2, sale_price: 15000, total_item_value: 30000 },
        ],
        total: 30000,
    },
});

const billiardSale = (overrides = {}) => ({ table_name: 'Mesa 3', elapsed_minutes: 90, hourly_rate: 10000, ...overrides });

describe('POST /api/printer/print-ticket (auditoría)', () => {
    let app;
    const print = (body) => request(app).post('/api/printer/print-ticket').send(body);

    beforeAll(() => {
        app = buildTestApp();
    });

    beforeEach(() => {
        FakeReceiptPrinter.reset();
        clearPrintQueue.mockClear();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('validación', () => {
        it('el 400 tiene la forma { ok, message, errors } con un error por campo', async () => {
            const body = validSale();
            body.establishment_email = 'nope';

            const res = await print(body);

            expect(res.status).toBe(400);
            expect(res.body).toEqual({
                ok: false,
                message: 'Errores de validación en los campos enviados.',
                errors: {
                    establishment_email: { type: 'field', value: 'nope', msg: 'El email no es válido', path: 'establishment_email', location: 'body' },
                },
            });
            expect(FakeReceiptPrinter.jobs).toHaveLength(0);
        });

        it.each([
            ['sin sale_data', (b) => { delete b.sale_data; }, 'sale_data', 'Los datos de la venta son obligatorios'],
            ['sale_data nulo', (b) => { b.sale_data = null; }, 'sale_data', 'La venta debe tener productos o una venta de tiempo (billar)'],
            ['nombre del negocio de 31 caracteres', (b) => { b.establishment_name = 'x'.repeat(31); }, 'establishment_name', 'El nombre del negocio es incorrecto'],
            ['nombre del negocio solo con espacios', (b) => { b.establishment_name = '   '; }, 'establishment_name', 'El nombre del negocio es incorrecto'],
            ['productos que no son un arreglo, aunque haya billar', (b) => { b.sale_data.products = 'Perro'; b.sale_data.billiard_sale = billiardSale(); }, 'sale_data.products', 'La lista de productos debe ser un arreglo'],
            ['costo de domicilio que no es número', (b) => { b.sale_data.delivery_cost = 'abc'; }, 'sale_data.delivery_cost', 'El costo de domicilio debe ser un número'],
            ['billar sin nombre de mesa', (b) => { b.sale_data.billiard_sale = billiardSale({ table_name: '' }); }, 'sale_data.billiard_sale.table_name', 'El nombre de la mesa es obligatorio'],
            ['billar con minutos que no son número', (b) => { b.sale_data.billiard_sale = billiardSale({ elapsed_minutes: 'abc' }); }, 'sale_data.billiard_sale.elapsed_minutes', 'Los minutos transcurridos deben ser un número'],
            ['billar sin tarifa', (b) => { b.sale_data.billiard_sale = billiardSale({ hourly_rate: undefined }); }, 'sale_data.billiard_sale.hourly_rate', 'La tarifa por hora debe ser un número'],
        ])('responde 400 con su mensaje y no imprime: %s', async (_, mutate, field, msg) => {
            const body = validSale();
            mutate(body);

            const res = await print(body);

            expect(res.status).toBe(400);
            expect(res.body.errors[field].msg).toBe(msg);
            expect(FakeReceiptPrinter.jobs).toHaveLength(0);
        });

        // Los límites están documentados en PrintTicketRequest.ts del frontend.
        const tooLong = [
            ['NIT de 21', (b) => { b.establishment_nit = '9'.repeat(21); }, 'establishment_nit'],
            ['teléfono de 16', (b) => { b.establishment_phone = '3'.repeat(16); }, 'establishment_phone'],
            ['dirección de 61', (b) => { b.establishment_address = 'a'.repeat(61); }, 'establishment_address'],
            ['mesero de 51', (b) => { b.waiter_name = 'a'.repeat(51); }, 'waiter_name'],
            ['notas de 201', (b) => { b.sale_data.notes = 'n'.repeat(201); }, 'sale_data.notes'],
            ['billar que no es un objeto', (b) => { b.sale_data.billiard_sale = 'Mesa 3'; }, 'sale_data.billiard_sale'],
        ];

        it.each(tooLong)('responde 400 y no imprime: %s', async (_, mutate, field) => {
            const body = validSale();
            mutate(body);

            const res = await print(body);

            expect(res.status).toBe(400);
            expect(res.body.errors).toHaveProperty([field]);
            expect(FakeReceiptPrinter.jobs).toHaveLength(0);
        });

        it('mesa de billar de 31 caracteres: responde 400', async () => {
            const body = validSale();
            body.sale_data.billiard_sale = billiardSale({ table_name: 'M'.repeat(31) });

            const res = await print(body);

            expect(res.status).toBe(400);
            expect(res.body.errors).toHaveProperty(['sale_data.billiard_sale.table_name']);
        });

        // BUG-AUDIT: estos campos no tienen withMessage y responden "Invalid value" (en inglés); CLAUDE.md pide los mensajes en español.
        it.failing.each(tooLong)('el mensaje de validación está en español: %s', async (_, mutate, field) => {
            const body = validSale();
            mutate(body);

            const res = await print(body);

            expect(res.body.errors[field].msg).not.toBe('Invalid value');
        });

        it('acepta cada campo en su longitud máxima (los espacios de los extremos no cuentan) y lo imprime completo', async () => {
            const res = await print({
                establishment_name: `  ${'N'.repeat(30)}  `,
                establishment_nit: '9'.repeat(20),
                establishment_phone: '3'.repeat(15),
                establishment_email: 'caja@sultan.com',
                establishment_address: 'a'.repeat(60),
                waiter_name: 'w'.repeat(50),
                sale_data: {
                    products: [],
                    notes: 'n'.repeat(200),
                    total: 15000,
                    billiard_sale: billiardSale({ table_name: 'M'.repeat(30) }),
                },
            });

            expect(res.status).toBe(200);
            const texts = printedTexts(FakeReceiptPrinter.jobs[0].data);
            expect(texts.slice(1, 3)).toEqual(['N'.repeat(24), 'N'.repeat(6)]);
            expect(texts).toEqual(expect.arrayContaining([
                `NIT: ${'9'.repeat(20)}`,
                `CEL/WhatsApp: ${'3'.repeat(15)}`,
                'caja@sultan.com',
                `Mesa: ${'M'.repeat(30)}`,
            ]));
        });

        // BUG-AUDIT: la ruta no valida los montos; un producto sin total_item_value/sale_price o una venta sin total
        // revientan con un TypeError al formatear ("Cannot read properties of undefined") y responden 500, y un producto
        // nulo responde 500 en HTML con el stack. Deberían ser un 400 de validación como los demás campos.
        it.failing.each([
            ['un producto nulo', (b) => { b.sale_data.products = [null]; }],
            ['un producto sin total de línea', (b) => { delete b.sale_data.products[0].total_item_value; }],
            ['un producto sin precio', (b) => { delete b.sale_data.products[0].sale_price; }],
            ['una venta sin total', (b) => { delete b.sale_data.total; }],
        ])('responde 400 y no 500 ante %s', async (_, mutate) => {
            const body = validSale();
            mutate(body);

            const res = await print(body);

            expect(res.status).toBe(400);
        });
    });

    describe('lo que queda impreso', () => {
        it('una venta con línea por peso, cliente y domicilio', async () => {
            const res = await print({
                ...validSale(),
                sale_data: {
                    products: [
                        { product_name: 'Manzana Roja', sale_unit: 'WEIGHT', count: 1250, sale_price: 9800, total_item_value: 12250, product_note: 'madura' },
                        { product_name: 'Pulpa De Mora', count: 2, sale_price: 5500, total_item_value: 11000 },
                    ],
                    client: { id: 'c1', name: 'Ana' },
                    delivery_cost: 5000,
                    total: 28250,
                },
            });

            expect(res.status).toBe(200);
            const lines = printedLines(FakeReceiptPrinter.jobs[0].data);
            expect(lines).toEqual(expect.arrayContaining([
                'Atendido por: Luis Alejandro',
                'Cliente: Ana',
                `Manzana Roja${' '.repeat(29)}$12.250`,
                '1,250 kg x $9.800/kg',
                '> madura',
                'Pulpa De Mora         x2      $5.500     $11.000',
                `${' '.repeat(25)}Costo Domicilio: $5.000`,
                `${' '.repeat(20)}TOTAL: $28.250`,
            ]));
        });

        it('un domicilio en $0 no imprime la línea de domicilio', async () => {
            const body = validSale();
            body.sale_data.delivery_cost = 0;

            await print(body);

            expect(printedLines(FakeReceiptPrinter.jobs[0].data).join('\n')).not.toContain('Costo Domicilio');
        });

        it('los campos que el servicio no conoce (lo demás de la venta) no cambian el ticket', async () => {
            const plain = await print(validSale());
            const body = validSale();
            Object.assign(body.sale_data, { id: 's1', discount: 0, total_investment: 2000, utility: 28000, payment_methods: [{ method: 'CASH', amount: 30000 }], created_at: '2025-12-07T15:49:54.766Z', user: { id: 'u1', name: 'Otro' } });
            Object.assign(body.sale_data.products[0], { product: 'p1', purchase_price: 1000, second_sale_price: 14000, is_second_price: false, count_second_price: 0 });

            const full = await print(body);

            const withoutClock = (job) => printedLines(job.data).filter((line) => !/^\d{2}\/\d{2}\/\d{4} - /.test(line));
            expect(full.body.bytes).toBe(plain.body.bytes);
            expect(withoutClock(FakeReceiptPrinter.jobs[1])).toEqual(withoutClock(FakeReceiptPrinter.jobs[0]));
        });
    });

    describe('la petición no puede elegir la impresora', () => {
        it('ignora cualquier impresora que venga en el cuerpo: imprime y limpia la cola de la configurada', async () => {
            const body = validSale();
            const evil = "x'; Remove-Item C:\\ -Recurse; '";
            Object.assign(body, { printer: { name: evil }, printer_name: evil, printerName: evil, ticket: { printer: { name: evil } } });

            const res = await print(body);

            expect(res.status).toBe(200);
            expect(res.body.printer).toBe('Pensilpos');
            expect(FakeReceiptPrinter.jobs[0].printer).toBe('Pensilpos');
            expect(clearPrintQueue.mock.calls).toEqual([['Pensilpos']]);
        });
    });

    describe('errores de impresión', () => {
        it('el 500 lleva msg en español y no filtra el stack fuera de desarrollo', async () => {
            FakeReceiptPrinter.failNextPrint = true;

            const res = await print(validSale());

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ ok: false, msg: 'Error al imprimir el ticket', error: 'Error de impresora: Papel atascado' });
            expect(clearPrintQueue).not.toHaveBeenCalled();
        });

        // Comportamiento actual, documentado en printer.helper: sin confirmación en 2 s se asume impreso.
        // La respuesta no distingue este caso de una impresión confirmada.
        it('si la impresora no confirma, responde 200 tras esperar 2 segundos', async () => {
            FakeReceiptPrinter.silentNextPrint = true;
            const startedAt = Date.now();

            const res = await print(validSale());

            expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1900);
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ ok: true, msg: 'Ticket impreso correctamente', printer: 'Pensilpos', bytes: FakeReceiptPrinter.jobs[0].data.length });
        });
    });

    describe('peticiones simultáneas', () => {
        it('imprime de a un ticket aunque lleguen cinco a la vez', async () => {
            FakeReceiptPrinter.printDelayMs = 20;

            const responses = await Promise.all([1, 2, 3, 4, 5].map(() => print(validSale())));

            expect(responses.map((res) => res.status)).toEqual([200, 200, 200, 200, 200]);
            expect(FakeReceiptPrinter.jobs).toHaveLength(5);
            expect(FakeReceiptPrinter.maxSimultaneousPrints).toBe(1);
        });

        it('si una falla entre varias, solo esa petición recibe el error', async () => {
            FakeReceiptPrinter.printDelayMs = 10;
            FakeReceiptPrinter.failNextPrint = true;

            const responses = await Promise.all([1, 2, 3, 4].map(() => print(validSale())));

            expect(responses.map((res) => res.status).sort()).toEqual([200, 200, 200, 500]);
            expect(FakeReceiptPrinter.jobs).toHaveLength(3);
        });
    });
});
