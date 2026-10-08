const ReceiptPrinterEncoder = require('@point-of-sale/receipt-printer-encoder');
const { buildTicket, buildProductsTableHeader, buildProductsSection } = require('../../src/helpers/ticket-builder.helper');
const config = require('../../src/config/config');

// Los textos ASCII viajan tal cual dentro de los bytes ESC/POS.
const toText = (data) => Buffer.from(data).toString('latin1');

const createTicketData = (overrides = {}) => ({
    establishment: { name: 'El Sultan', nit: '123-4', phone: '3001234567', email: null, address: 'Cali' },
    metadata: { date: '07/10/2026', time: '10:30 a. m.', waiter: 'Luis', clientName: null },
    products: [{ name: 'Perro Ranchero', quantity: 2, unitPrice: 15000, total: 30000, note: null }],
    billiard: null,
    total: 30000,
    deliveryCost: null,
    ...overrides,
});

describe('ticket-builder.helper', () => {
    describe('buildTicket', () => {
        it('genera los bytes ESC/POS con la información de la venta', () => {
            const text = toText(buildTicket(createTicketData()));

            expect(text).toContain('El Sultan');
            expect(text).toContain('NIT: 123-4');
            expect(text).toContain('Atendido por: Luis');
            expect(text).toContain('Perro Ranchero');
            expect(text).toContain('TOTAL: $30.000');
            expect(text).toContain('pensildevs.com');
        });

        it('incluye las secciones opcionales cuando vienen en los datos', () => {
            const text = toText(buildTicket(createTicketData({
                establishment: { name: 'El Sultan', nit: '1', phone: '1', email: 'caja@sultan.com', address: 'Cali' },
                metadata: { date: 'd', time: 't', waiter: 'Luis', clientName: 'Ana' },
                products: [{ name: 'Perro', quantity: 1, unitPrice: 15000, total: 15000, note: 'sin cebolla' }],
                billiard: { tableName: 'Mesa 3', elapsedMinutes: 90, hourlyRate: 10000, cost: 15000 },
                deliveryCost: 5000,
            })));

            expect(text).toContain('caja@sultan.com');
            expect(text).toContain('Cliente: Ana');
            expect(text).toContain('> sin cebolla');
            expect(text).toContain('Mesa: Mesa 3');
            expect(text).toContain('Tiempo: 90 min ($10.000/h)');
            expect(text).toContain('Costo Domicilio: $5.000');
        });

        it('omite la tabla de productos en una venta de solo tiempo', () => {
            const text = toText(buildTicket(createTicketData({
                products: [],
                billiard: { tableName: 'Mesa 3', elapsedMinutes: 60, hourlyRate: 10000, cost: 10000 },
                total: 10000,
            })));

            expect(text).not.toContain('Producto');
            expect(text).toContain('Mesa: Mesa 3');
        });
    });

    describe('tabla de productos', () => {
        it('usa las columnas del perfil de papel configurado en encabezado y filas', () => {
            const encoder = new ReceiptPrinterEncoder({ columns: config.printer.paper.columns });
            const tableSpy = jest.spyOn(encoder, 'table');

            buildProductsTableHeader(encoder);
            buildProductsSection(encoder, createTicketData().products);

            expect(tableSpy).toHaveBeenCalledTimes(2);
            tableSpy.mock.calls.forEach(([columns]) => {
                expect(columns).toBe(config.printer.paper.productsTable);
            });
        });
    });
});
