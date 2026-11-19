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

describe('ticket-builder.helper: productos por peso (SPEC-051 CA-17)', () => {
    const apple = { name: 'Manzana Roja', quantity: 1250, saleUnit: 'WEIGHT', unitPrice: 9800, total: 12250, note: null };

    it('imprime el peso en kg, el precio por kg y el total de la línea', () => {
        const text = toText(buildTicket(createTicketData({ products: [apple], total: 12250 })));

        expect(text).toContain('Manzana Roja');
        expect(text).toContain('1,250 kg x $9.800/kg');
        expect(text).toContain('$12.250');
    });

    it('la fila de un producto por peso no pone cantidad ni precio unitario en sus columnas', () => {
        const encoder = new ReceiptPrinterEncoder({ columns: config.printer.paper.columns });
        const tableSpy = jest.spyOn(encoder, 'table');

        buildProductsSection(encoder, [apple]);

        expect(tableSpy).toHaveBeenCalledWith(config.printer.paper.productsTable, [
            ['Manzana Roja', '', '', '$12.250'],
        ]);
    });
});

// ---------------------------------------------------------------------------------------------
// Auditoría adversarial: lo que de verdad queda impreso, línea por línea (tests/support/escpos.js).
// ---------------------------------------------------------------------------------------------
const { parseTicket, printedLines, printedTexts, cp437, FONT_COLUMNS } = require('../support/escpos');

const RULE = cp437('─').repeat(48);

describe('ticket-builder.helper: líneas impresas', () => {
    it('la fila de un producto por unidad lleva cantidad, precio unitario y total en sus columnas', () => {
        const lines = printedLines(buildTicket(createTicketData()));

        // Columnas del papel de 80mm: nombre (22, izq.), CT (3, centro), Unit (11, der.), Total (12, der.).
        expect(lines).toContain('Producto              CT        Unit       Total');
        expect(lines).toContain('Perro Ranchero        x2     $15.000     $30.000');
    });

    it('el total de la línea es el que llega, aunque no sea cantidad x precio (segundo precio)', () => {
        const lines = printedLines(buildTicket(createTicketData({
            products: [{ name: 'Cerveza', quantity: 3, unitPrice: 5000, total: 13000, note: null }],
        })));

        expect(lines).toContain('Cerveza               x3      $5.000     $13.000');
    });

    it('imprime los datos del negocio, la fecha con la hora y quién atendió', () => {
        const lines = printedTexts(buildTicket(createTicketData()));

        expect(lines).toEqual(expect.arrayContaining([
            'El Sultan',
            'NIT: 123-4',
            'CEL/WhatsApp: 3001234567',
            'Cali',
            '07/10/2026 - 10:30 a. m.',
            'Atendido por: Luis',
        ]));
    });

    it('no imprime las secciones opcionales que no vienen', () => {
        const text = printedLines(buildTicket(createTicketData())).join('\n');

        expect(text).not.toContain('Cliente:');
        expect(text).not.toContain('>');
        expect(text).not.toContain('Mesa:');
        expect(text).not.toContain('Costo Domicilio');
        expect(text).not.toContain('null');
        expect(text).not.toContain('undefined');
    });

    it('ordena las secciones: negocio, atención, productos, mesa de billar, domicilio, total y pie', () => {
        const text = printedLines(buildTicket(createTicketData({
            metadata: { date: 'd', time: 't', waiter: 'Luis', clientName: 'Ana' },
            billiard: { tableName: 'Mesa 3', elapsedMinutes: 90, hourlyRate: 10000, cost: 15000 },
            total: 50000,
            deliveryCost: 5000,
        }))).join('\n');

        const positions = [
            'El Sultan',
            'Atendido por: Luis',
            'Cliente: Ana',
            'Producto',
            'Perro Ranchero',
            'Mesa: Mesa 3',
            'Subtotal mesa: $15.000',
            'Costo Domicilio: $5.000',
            'TOTAL: $50.000',
            cp437('¡Gracias por su compra!'),
            'Desarrollado por: Pensil Devs | pensildevs.com',
        ].map((fragment) => text.indexOf(fragment));

        expect(positions).not.toContain(-1);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    // Regresión documentada en buildTicket: si ESC @ no sale antes del primer relleno de centrado,
    // la impresora lo descarta y el nombre del negocio queda pegado a la izquierda.
    it('empieza inicializando la impresora, antes de cualquier espacio de centrado', () => {
        const data = buildTicket(createTicketData());

        expect([...data.slice(0, 2)]).toEqual([0x1b, 0x40]);
        expect(parseTicket(data).lines[1].text).toMatch(/^ +El Sultan$/);
    });

    it('termina cortando el papel después de dejar avance', () => {
        const { lines, commands } = parseTicket(buildTicket(createTicketData()));

        expect(commands.at(-1)).toBe('cut');
        expect(commands.filter((command) => command === 'cut')).toHaveLength(1);
        // feedBeforeCut: el pie no queda debajo de la cuchilla.
        expect(lines.slice(-4).every((line) => line.text === '')).toBe(true);
    });
});

describe('ticket-builder.helper: textos largos y caracteres especiales', () => {
    const longTicket = () => buildTicket(createTicketData({
        establishment: {
            name: 'Restaurante La Esquina De Pepe',  // 30: el máximo que deja pasar la ruta
            nit: '9'.repeat(20),
            phone: '3'.repeat(15),
            email: 'administracion.principal@restaurante-la-esquina.com.co',
            address: 'Calle 123 # 45-67 Local 8 Barrio San Fernando Viejo, Cali VAC',
        },
        metadata: { date: '07/10/2026', time: '10:30 a. m.', waiter: 'W'.repeat(50), clientName: 'C'.repeat(150) },
        products: [
            { name: 'Hamburguesa Doble Carne Con Queso Tocineta Y Papas A La Francesa Grandes', quantity: 12, unitPrice: 1250000, total: 15000000, note: 'n'.repeat(200) },
            { name: 'Supercalifragilisticoespialidoso'.repeat(3), quantity: 1, unitPrice: 500, total: 500, note: null },
            { name: 'Manzana Roja Importada De Primera Calidad', quantity: 1250, saleUnit: 'WEIGHT', unitPrice: 9800, total: 12250, note: 'madura' },
        ],
        billiard: { tableName: 'M'.repeat(30), elapsedMinutes: 600, hourlyRate: 100000, cost: 1000000 },
        total: 999999999,
        deliveryCost: 1000000,
    }));

    it('ninguna línea se sale del ancho del papel, ni con los textos más largos que acepta la ruta', () => {
        const { lines } = parseTicket(longTicket());

        lines.forEach((line) => {
            expect({ text: line.text, fits: line.width <= FONT_COLUMNS[line.font] }).toEqual({ text: line.text, fits: true });
        });
        // Las reglas ocupan exactamente el ancho del papel configurado.
        expect(lines.filter((line) => line.text === RULE)).toHaveLength(4);
    });

    it('parte los nombres largos sin perder caracteres y deja los valores en la primera fila', () => {
        const lines = printedLines(longTicket());
        const row = lines.findIndex((line) => line.startsWith('Hamburguesa Doble'));

        expect(lines.slice(row, row + 4)).toEqual([
            'Hamburguesa Doble     x12 $1.250.000 $15.000.000',
            'Carne Con Queso',
            'Tocineta Y Papas A La',
            'Francesa Grandes',
        ]);
        // Una palabra más larga que la columna se corta en trozos de 22, sin truncarse.
        const word = 'Supercalifragilisticoespialidoso'.repeat(3);
        const wordRow = lines.findIndex((line) => line.startsWith(word.slice(0, 22)));
        const printedWord = lines.slice(wordRow, wordRow + 5).map((line) => line.slice(0, 22).trim()).join('');
        expect(printedWord).toBe(word);
    });

    it('el nombre del negocio de 30 caracteres (doble ancho) se parte en dos líneas centradas', () => {
        const { lines } = parseTicket(longTicket());

        // 22 caracteres a doble ancho son 44 columnas: quedan 2 de margen a la izquierda.
        expect(lines[1]).toEqual({ text: '  Restaurante La Esquina', font: 'A', width: 46 });
        expect(lines[2]).toEqual({ text: `${' '.repeat(17)}De Pepe`, font: 'A', width: 31 });
    });

    it('codifica tildes, ñ y signos de apertura en la página de códigos 437', () => {
        const data = buildTicket(createTicketData({
            establishment: { name: 'Fruver Ñandú', nit: '1', phone: '1', email: null, address: 'Bogotá' },
            metadata: { date: 'd', time: 't', waiter: 'Iñaki Pérez', clientName: 'María Güiza' },
            products: [{ name: 'Piña Colada', quantity: 1, unitPrice: 9000, total: 9000, note: '¿sin azúcar?' }],
        }));
        const lines = printedTexts(data);

        expect(lines).toEqual(expect.arrayContaining([
            cp437('Fruver Ñandú'),
            cp437('Bogotá'),
            cp437('Atendido por: Iñaki Pérez'),
            cp437('Cliente: María Güiza'),
            cp437('> ¿sin azúcar?'),
            cp437('¡Gracias por su compra!'),
        ]));
        expect(lines.find((line) => line.startsWith(cp437('Piña Colada')))).toBeDefined();
        expect(parseTicket(data).commands).toContain('codepage-0');
    });

    it('una mayúscula con tilde (no existe en CP437) se imprime cambiando de página de códigos, no como "?"', () => {
        const data = buildTicket(createTicketData({
            establishment: { name: 'CAFÉ ÁNGEL', nit: '1', phone: '1', email: null, address: 'Cali' },
        }));
        const { lines, commands } = parseTicket(data);

        expect(lines[1].text).not.toContain('?');
        expect(lines[1].text.replace(/^ +/, '')).toHaveLength('CAFÉ ÁNGEL'.length);
        // CP850 (ESC t 2) sí tiene la Á.
        expect(commands).toContain('codepage-2');
    });

    it('un emoji no rompe el ticket: sale como "?" y el resto de la línea se conserva', () => {
        const lines = printedLines(buildTicket(createTicketData({
            products: [{ name: 'Perro', quantity: 1, unitPrice: 1000, total: 1000, note: 'sin cebolla 🙂 gracias' }],
        })));

        expect(lines).toContain('> sin cebolla ?? gracias');
    });
});

describe('ticket-builder.helper: cantidades y montos límite', () => {
    const rowOf = (product) => printedLines(buildTicket(createTicketData({ products: [product] })))
        .filter((line) => line.startsWith(product.name));

    it('una cantidad de dos cifras cabe en la columna CT', () => {
        expect(rowOf({ name: 'Empanada', quantity: 99, unitPrice: 2500, total: 247500, note: null }))
            .toEqual(['Empanada              x99     $2.500    $247.500']);
    });

    // BUG-AUDIT: la columna CT mide 3 y "x100" mide 4: el encoder lo parte y la fila se lee "x10" (el 0 cae en la línea de abajo).
    it.failing('una cantidad de tres cifras (x100) se imprime completa en la fila del producto', () => {
        const lines = printedLines(buildTicket(createTicketData({
            products: [{ name: 'Empanada', quantity: 100, unitPrice: 2500, total: 250000, note: null }],
        })));
        const row = lines.find((line) => line.startsWith('Empanada'));

        expect(row).toContain('x100');
    });

    it('un producto en $0 y con cantidad 0 se imprime sin fallar', () => {
        expect(rowOf({ name: 'Cortesia', quantity: 0, unitPrice: 0, total: 0, note: null }))
            .toEqual(['Cortesia              x0          $0          $0']);
    });

    it('los montos usan punto de miles (es-CO), también en valores de cientos de millones', () => {
        const lines = printedLines(buildTicket(createTicketData({
            products: [{ name: 'Lote', quantity: 1, unitPrice: 10000000, total: 100000000, note: null }],
            total: 123456789012,
            deliveryCost: 1000000,
        })));

        // Sin espacio entre columnas, pero cada valor completo y en su fila.
        expect(lines).toContain('Lote                  x1 $10.000.000$100.000.000');
        expect(lines).toContain(`${' '.repeat(21)}Costo Domicilio: $1.000.000`);
        expect(lines).toContain('  TOTAL: $123.456.789.012');
    });

    it('el total queda alineado a la derecha del papel (doble ancho)', () => {
        const { lines } = parseTicket(buildTicket(createTicketData()));
        const total = lines.find((line) => line.text.includes('TOTAL:'));

        expect(total.text).toBe(`${' '.repeat(20)}TOTAL: $30.000`);
        expect(total.width).toBe(48);
    });

    it('la mesa de billar imprime el subtotal que recibe, a la derecha', () => {
        const lines = printedLines(buildTicket(createTicketData({
            products: [],
            billiard: { tableName: 'Mesa 3', elapsedMinutes: 0, hourlyRate: 10000, cost: 0 },
            total: 0,
        })));

        expect(lines).toContain('Tiempo: 0 min ($10.000/h)');
        expect(lines).toContain(`${' '.repeat(31)}Subtotal mesa: $0`);
        expect(lines).toContain(`${' '.repeat(30)}TOTAL: $0`);
    });
});

describe('ticket-builder.helper: productos por peso, casos límite (SPEC-051)', () => {
    const weighed = (grams, overrides = {}) => ({
        name: 'Manzana Roja', quantity: grams, saleUnit: 'WEIGHT', unitPrice: 9800, total: 12250, note: null, ...overrides,
    });

    it.each([
        [0, '0,000 kg x $9.800/kg'],
        [1, '0,001 kg x $9.800/kg'],
        [999, '0,999 kg x $9.800/kg'],
        [1000, '1,000 kg x $9.800/kg'],
        [1250, '1,250 kg x $9.800/kg'],
        [12050, '12,050 kg x $9.800/kg'],
        [1234567, '1.234,567 kg x $9.800/kg'],
    ])('%i g se imprimen como kg con tres decimales', (grams, expected) => {
        const lines = printedLines(buildTicket(createTicketData({ products: [weighed(grams)] })));

        expect(lines).toContain(expected);
    });

    it('la fila lleva solo el nombre y el total; debajo el detalle del peso y después la nota', () => {
        const lines = printedLines(buildTicket(createTicketData({ products: [weighed(1250, { note: 'madura' })] })));
        const row = lines.indexOf(`Manzana Roja${' '.repeat(29)}$12.250`);

        expect(row).toBeGreaterThan(-1);
        expect(lines.slice(row + 1, row + 4)).toEqual(['1,250 kg x $9.800/kg', '> madura', '']);
    });

    it('el detalle del peso y la nota van en la fuente pequeña y la fila siguiente vuelve a la normal', () => {
        const { lines } = parseTicket(buildTicket(createTicketData({
            products: [weighed(1250, { note: 'madura' }), { name: 'Gaseosa', quantity: 1, unitPrice: 4000, total: 4000, note: null }],
        })));
        const fontOf = (start) => lines.find((line) => line.text.startsWith(start)).font;

        expect(fontOf('1,250 kg')).toBe('B');
        expect(fontOf('> madura')).toBe('B');
        expect(fontOf('Gaseosa')).toBe('A');
        expect(lines.find((line) => line.text.includes('TOTAL:')).font).toBe('A');
    });

    it('solo "WEIGHT" es por peso: cualquier otra unidad se imprime como fila por unidad', () => {
        const lines = printedLines(buildTicket(createTicketData({
            products: [{ name: 'Gaseosa', quantity: 3, saleUnit: 'UNIT', unitPrice: 4000, total: 12000, note: null }],
        })));

        expect(lines).toContain('Gaseosa               x3      $4.000     $12.000');
        expect(lines.join('\n')).not.toContain('kg');
    });
});
