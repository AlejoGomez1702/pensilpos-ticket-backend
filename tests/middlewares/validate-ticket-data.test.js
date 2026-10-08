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
