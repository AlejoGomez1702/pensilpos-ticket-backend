const { validateTicketData } = require('../../src/middlewares/validate-ticket-data');

const createReq = (body) => ({ body, ticket: { printer: { name: 'Pensilpos' } } });

describe('validateTicketData', () => {
    it('transforma el body de la venta al formato del ticket', () => {
        const req = createReq({
            establishment_name: 'El Sultan',
            establishment_nit: '123-4',
            establishment_phone: '3001234567',
            establishment_email: 'caja@sultan.com',
            establishment_address: 'Cali',
            waiter_name: 'Luis',
            sale_data: {
                products: [
                    { product_name: 'Perro', count: 2, sale_price: 15000, total_item_value: 30000, product_note: 'sin cebolla' },
                    { product_name: 'Gaseosa', count: 1, sale_price: 4000, total_item_value: 4000 },
                ],
                notes: 'Mesa del fondo',
                total: 34000,
                delivery_cost: 5000,
                client: { name: 'Ana' },
            },
        });
        const next = jest.fn();

        validateTicketData(req, {}, next);

        expect(req.ticket.printer).toEqual({ name: 'Pensilpos' });
        expect(req.ticket.establishment).toEqual({
            name: 'El Sultan', nit: '123-4', phone: '3001234567', email: 'caja@sultan.com', address: 'Cali',
        });
        expect(req.ticket.products).toEqual([
            { name: 'Perro', quantity: 2, unitPrice: 15000, total: 30000, note: 'sin cebolla' },
            { name: 'Gaseosa', quantity: 1, unitPrice: 4000, total: 4000, note: null },
        ]);
        expect(req.ticket.metadata).toEqual(expect.objectContaining({
            waiter: 'Luis', observations: 'Mesa del fondo', totalArticles: 3, clientName: 'Ana',
        }));
        expect(req.ticket.total).toBe(34000);
        expect(req.ticket.deliveryCost).toBe(5000);
        expect(req.ticket.billiard).toBeNull();
        expect(next).toHaveBeenCalled();
    });

    it('aplica valores por defecto a los datos opcionales del establecimiento', () => {
        const req = createReq({ establishment_name: 'El Sultan', waiter_name: 'Luis', sale_data: { products: [], total: 0 } });

        validateTicketData(req, {}, jest.fn());

        expect(req.ticket.establishment).toEqual({
            name: 'El Sultan', nit: 'xxx.xxx.xxx-x', phone: '3xx-xxx-xxxx', email: null, address: 'Colombia',
        });
        expect(req.ticket.metadata.clientName).toBeNull();
        expect(req.ticket.deliveryCost).toBeNull();
    });

    it('calcula el costo de una venta de billar a partir de la tarifa y los minutos', () => {
        const req = createReq({
            establishment_name: 'El Sultan',
            waiter_name: 'Luis',
            sale_data: {
                total: 15000,
                billiard_sale: { table_name: 'Mesa 3', elapsed_minutes: 90, hourly_rate: 10000 },
            },
        });

        validateTicketData(req, {}, jest.fn());

        expect(req.ticket.products).toEqual([]);
        expect(req.ticket.metadata.totalArticles).toBe(0);
        expect(req.ticket.billiard).toEqual({ tableName: 'Mesa 3', elapsedMinutes: 90, hourlyRate: 10000, cost: 15000 });
    });
});

describe('validateTicketData: productos por peso (SPEC-051)', () => {
    it('marca la línea por peso y la cuenta como un artículo', () => {
        const req = createReq({
            establishment_name: 'Mi Fruver',
            sale_data: {
                products: [
                    { product_name: 'Manzana Roja', count: 1250, sale_unit: 'WEIGHT', sale_price: 9800, total_item_value: 12250 },
                    { product_name: 'Pulpa De Mora', count: 2, sale_price: 5500, total_item_value: 11000 },
                ],
                total: 23250,
            },
        });

        validateTicketData(req, {}, jest.fn());

        expect(req.ticket.products).toEqual([
            { name: 'Manzana Roja', quantity: 1250, saleUnit: 'WEIGHT', unitPrice: 9800, total: 12250, note: null },
            { name: 'Pulpa De Mora', quantity: 2, unitPrice: 5500, total: 11000, note: null },
        ]);
        expect(req.ticket.metadata.totalArticles).toBe(3);
    });
});

// ---------------------------------------------------------------------------------------------
// Auditoría adversarial
// ---------------------------------------------------------------------------------------------
describe('validateTicketData: fecha y hora del ticket', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    const ticketAt = (now) => {
        jest.useFakeTimers({ now });
        const req = createReq({ establishment_name: 'El Sultan', waiter_name: 'Luis', sale_data: { products: [], total: 0 } });
        validateTicketData(req, {}, jest.fn());
        return req.ticket.metadata;
    };

    // Las horas se construyen en hora local para que el test no dependa de la zona horaria del equipo.
    // \s: según la versión de Node/ICU el espacio de "p. m." puede ser normal o de no separación.
    it('usa día/mes/año y hora de 12 horas en formato colombiano', () => {
        const metadata = ticketAt(new Date(2026, 9, 7, 13, 5));

        expect(metadata.date).toBe('07/10/2026');
        expect(metadata.time).toMatch(/^01:05\sp\.\sm\.$/);
    });

    it('la medianoche es 12 a. m. del día que empieza', () => {
        const metadata = ticketAt(new Date(2026, 0, 1, 0, 0));

        expect(metadata.date).toBe('01/01/2026');
        expect(metadata.time).toMatch(/^12:00\sa\.\sm\.$/);
    });
});

describe('validateTicketData: los montos llegan calculados y no se recalculan', () => {
    it('conserva el total de cada línea y el de la venta aunque no cuadren con cantidad x precio', () => {
        const req = createReq({
            establishment_name: 'El Sultan',
            waiter_name: 'Luis',
            sale_data: {
                products: [
                    // Segundo precio en parte de las unidades: 3 x 5.000 no da 13.000.
                    { product_name: 'Cerveza', count: 3, sale_price: 5000, second_sale_price: 4000, is_second_price: true, count_second_price: 2, total_item_value: 13000 },
                ],
                // Con rebaja (backend SPEC-060) el total es menor que la suma de las líneas.
                discount: 3000,
                total: 10000,
            },
        });

        validateTicketData(req, {}, jest.fn());

        expect(req.ticket.products).toEqual([{ name: 'Cerveza', quantity: 3, unitPrice: 5000, total: 13000, note: null }]);
        expect(req.ticket.total).toBe(10000);
    });

    it('un cliente que llega como id (venta sin poblar) no se toma como nombre', () => {
        const req = createReq({
            establishment_name: 'El Sultan',
            waiter_name: 'Luis',
            sale_data: { products: [], total: 0, client: '68924196d6915a68c51bb072' },
        });

        validateTicketData(req, {}, jest.fn());

        expect(req.ticket.metadata.clientName).toBeNull();
    });
});

describe('validateTicketData: venta de billar, casos límite', () => {
    const billiardCost = (elapsed_minutes, hourly_rate) => {
        const req = createReq({
            establishment_name: 'El Sultan',
            waiter_name: 'Luis',
            sale_data: { total: 0, billiard_sale: { table_name: 'Mesa 3', elapsed_minutes, hourly_rate } },
        });
        validateTicketData(req, {}, jest.fn());
        return req.ticket.billiard.cost;
    };

    it.each([
        [1, 6000, 100],
        [30, 10000, 5000],
        [60, 10000, 10000],
        [600, 12000, 120000],
    ])('%i min a $%i la hora cuestan $%i', (minutes, rate, expected) => {
        expect(billiardCost(minutes, rate)).toBe(expected);
    });

    // BUG-AUDIT: el backend cobra Math.ceil(minutos / 60 * tarifa) (sales/domain/billiard-charge.js); aquí
    // no se redondea y 50 min a $10.000/h salen como $8.333,333 en el ticket (el backend cobró $8.334).
    it.failing('el subtotal de la mesa se redondea hacia arriba al peso, como lo cobra el backend', () => {
        expect(billiardCost(50, 10000)).toBe(8334);
    });
});

describe('validateTicketData: unidad de venta', () => {
    it('una línea con sale_unit "UNIT" es por unidad: sin marca de peso y cuenta sus unidades', () => {
        const req = createReq({
            establishment_name: 'Mi Fruver',
            waiter_name: 'Luis',
            sale_data: {
                products: [{ product_name: 'Pulpa De Mora', count: 4, sale_unit: 'UNIT', sale_price: 5500, total_item_value: 22000 }],
                total: 22000,
            },
        });

        validateTicketData(req, {}, jest.fn());

        expect(req.ticket.products).toEqual([{ name: 'Pulpa De Mora', quantity: 4, unitPrice: 5500, total: 22000, note: null }]);
        expect(req.ticket.metadata.totalArticles).toBe(4);
    });
});
