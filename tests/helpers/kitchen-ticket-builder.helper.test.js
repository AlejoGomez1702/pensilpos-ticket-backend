const { buildKitchenTicket } = require('../../src/helpers/kitchen-ticket-builder.helper');

// Los textos ASCII viajan tal cual dentro de los bytes ESC/POS.
const toText = (data) => Buffer.from(data).toString('latin1');

const createKitchenData = (overrides = {}) => ({
    orderType: 'TABLE',
    tableName: 'Mesa 1',
    customerName: null,
    deliveryCost: null,
    products: [
        { name: 'Perro Ranchero', quantity: 2, note: null },
        { name: 'Gaseosa', quantity: 1, note: null },
    ],
    notes: null,
    ...overrides,
});

describe('kitchen-ticket-builder.helper', () => {
    describe('buildKitchenTicket', () => {
        it('genera los bytes ESC/POS con los productos y el total de artículos', () => {
            const text = toText(buildKitchenTicket(createKitchenData()));

            expect(text).toContain('MESA 1');
            expect(text).toContain('x2 Perro Ranchero');
            expect(text).toContain('x1 Gaseosa');
            expect(text).toContain('Total Art');
            expect(text).toContain(': 3');
        });

        it.each([
            ['TABLE sin nombre de mesa', { orderType: 'TABLE', tableName: null }, 'MESA'],
            ['DELIVERY', { orderType: 'DELIVERY' }, 'DOMICILIO'],
            ['FAST', { orderType: 'FAST' }, 'VENTA R'],
            // A tamaño 4x4 "PEDIDO COCINA" no cabe en una línea y el encoder lo parte.
            ['tipo desconocido', { orderType: 'OTRO' }, 'PEDIDO'],
        ])('el encabezado refleja el tipo de orden: %s', (_, overrides, expected) => {
            const text = toText(buildKitchenTicket(createKitchenData(overrides)));

            expect(text).toContain(expected);
        });

        it('incluye las secciones opcionales cuando vienen en los datos', () => {
            const text = toText(buildKitchenTicket(createKitchenData({
                orderType: 'DELIVERY',
                customerName: 'Ana',
                deliveryCost: 5000,
                products: [{ name: 'Perro', quantity: 1, note: 'sin cebolla' }],
                notes: 'Tocar el timbre',
            })));

            expect(text).toContain('Ana');
            expect(text).toContain('> sin cebolla');
            expect(text).toContain('Costo Domicilio: $5.000');
            expect(text).toContain('OBSERVACIONES:');
            expect(text).toContain('Tocar el timbre');
        });
    });
});
