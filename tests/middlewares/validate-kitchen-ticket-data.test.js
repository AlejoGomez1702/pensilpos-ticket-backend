const { validateKitchenTicketData } = require('../../src/middlewares/validate-kitchen-ticket-data');

describe('validateKitchenTicketData', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('conserva la impresora y transforma el body de la orden al formato del ticket', () => {
        const req = {
            ticket: { printer: { name: 'Pensilpos' } },
            body: {
                order_data: { order_type: 'DELIVERY', customer_name: 'Ana', delivery_cost: 5000 },
                sale_data: {
                    products: [{ product_name: 'Perro', count: 2, note: 'sin cebolla' }],
                    notes: 'Tocar el timbre',
                },
            },
        };
        const next = jest.fn();

        validateKitchenTicketData(req, {}, next);

        expect(req.ticket).toEqual({
            printer: { name: 'Pensilpos' },
            orderType: 'DELIVERY',
            tableName: null,
            customerName: 'Ana',
            deliveryCost: 5000,
            products: [{ name: 'Perro', quantity: 2, note: 'sin cebolla' }],
            notes: 'Tocar el timbre',
        });
        expect(next).toHaveBeenCalled();
    });

    it('deja en null los datos opcionales que no vienen', () => {
        const req = {
            ticket: {},
            body: {
                order_data: { order_type: 'TABLE', table_name: 'Mesa 1' },
                sale_data: { products: [{ product_name: 'Gaseosa', count: 1 }] },
            },
        };

        validateKitchenTicketData(req, {}, jest.fn());

        expect(req.ticket).toEqual(expect.objectContaining({
            tableName: 'Mesa 1', customerName: null, deliveryCost: null, notes: null,
        }));
        expect(req.ticket.products).toEqual([{ name: 'Gaseosa', quantity: 1, note: null }]);
    });
});
