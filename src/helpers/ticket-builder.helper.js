const ReceiptPrinterEncoder = require('@point-of-sale/receipt-printer-encoder');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const config = require('../config/config');

/**
 * Construye la sección del encabezado del establecimiento
 * @param {Object} encoder - Instancia del encoder
 * @param {Object} establishment - Información del establecimiento
 * @returns {Object} encoder actualizado
 */
const buildEstablishmentSection = (encoder, establishment) => {
    let ticketEncoder = encoder
        .align('center')
        .font('A')
        .bold(true)
        .size(2, 2)
        .line(establishment.name)
        .size(1, 1)
        .bold(false)
        .line(`NIT: ${establishment.nit}`)
        .line(`CEL/WhatsApp: ${establishment.phone}`);
    
    // Solo agregar email si existe
    if (establishment.email) {
        ticketEncoder = ticketEncoder.line(establishment.email);
    }
    
    return ticketEncoder.line(establishment.address);
};

/**
 * Construye la sección de metadatos (fecha, usuario, artículos)
 * @param {Object} encoder - Instancia del encoder
 * @param {Object} metadata - Metadatos del ticket
 * @returns {Object} encoder actualizado
 */
const buildMetadataSection = (encoder, metadata) => {
    let ticketEncoder = encoder
        .align('left')
        .rule()
        .line(`${metadata.date} - ${metadata.time}`)
        .line(`Atendido por: ${metadata.waiter}`);
    
    // Solo mostrar cliente si existe
    if (metadata.clientName) {
        ticketEncoder = ticketEncoder.line(`Cliente: ${metadata.clientName}`);
    }

    return ticketEncoder.newline();
};

/**
 * Construye el encabezado de la tabla de productos
 * @param {Object} encoder - Instancia del encoder
 * @returns {Object} encoder actualizado
 */
const buildProductsTableHeader = (encoder) => {
    return encoder
        .align('left')
        .table(
            config.printer.paper.productsTable,
            [
                [
                    (encoder) => encoder.bold(true).text('Producto').bold(false),
                    (encoder) => encoder.bold(true).text('CT').bold(false),
                    (encoder) => encoder.bold(true).text('Unit').bold(false),
                    (encoder) => encoder.bold(true).text('Total').bold(false)
                ],
                [
                    (encoder) => encoder.rule(),
                    (encoder) => encoder.rule(),
                    (encoder) => encoder.rule(),
                    (encoder) => encoder.rule()
                ]
            ]
        );
};

/**
 * Construye la sección de productos
 * @param {Object} encoder - Instancia del encoder
 * @param {Array} products - Lista de productos
 * @returns {Object} encoder actualizado
 */
const buildProductsSection = (encoder, products) => {
    let ticketEncoder = encoder;
    
    products.forEach(product => {
        // Formatear valores
        const quantity = `x${product.quantity}`;
        const unitPrice = `$${product.unitPrice.toLocaleString('es-CO')}`;
        const total = `$${product.total.toLocaleString('es-CO')}`;

        // Tabla con información del producto
        ticketEncoder = ticketEncoder
            .table(
                config.printer.paper.productsTable,
                [
                    [ product.name, quantity, unitPrice, total ]
                ]
            );

        // Solo mostrar nota si existe
        if (product.note) {
            ticketEncoder = ticketEncoder
                .font('B')
                .line(`> ${product.note}`)
                .font('A');
        }

        ticketEncoder = ticketEncoder.newline();
    });
    
    return ticketEncoder;
};

/**
 * Construye la sección de la venta de mesa de billar (opcional)
 * @param {Object} encoder - Instancia del encoder
 * @param {Object} billiard - Datos de la venta de mesa
 * @returns {Object} encoder actualizado
 */
const buildBilliardSection = (encoder, billiard) => {
    const formattedCost = `$${billiard.cost.toLocaleString('es-CO')}`;

    return encoder
        .align('left')
        .rule()
        .line(`Mesa: ${billiard.tableName}`)
        .line(`Tiempo: ${billiard.elapsedMinutes} min ($${billiard.hourlyRate.toLocaleString('es-CO')}/h)`)
        .align('right')
        .line(`Subtotal mesa: ${formattedCost}`)
        .newline();
};

/**
 * Construye la sección del total
 * @param {Object} encoder - Instancia del encoder
 * @param {Number} total - Total de la venta
 * @param {Number} deliveryCost - Costo de domicilio (opcional)
 * @returns {Object} encoder actualizado
 */
const buildTotalSection = (encoder, total, deliveryCost = null) => {
    const formattedTotal = `$${total.toLocaleString('es-CO')}`;
    
    let ticketEncoder = encoder
        .rule()
        .align('right');
    
    // Mostrar costo de domicilio si existe (antes del total)
    if (deliveryCost) {
        const formattedDeliveryCost = `$${deliveryCost.toLocaleString('es-CO')}`;
        ticketEncoder = ticketEncoder
            .line(`Costo Domicilio: ${formattedDeliveryCost}`)
            .newline();
    }
    
    ticketEncoder = ticketEncoder
        .bold(true)
        .size(2, 2)
        .line(`TOTAL: ${formattedTotal}`)
        .size(1, 1)
        .bold(false);
    
    return ticketEncoder.newline();
};

/**
 * Construye la sección del footer (agradecimiento y créditos)
 * @param {Object} encoder - Instancia del encoder
 * @returns {Object} encoder actualizado
 */
const buildFooterSection = (encoder) => {
    return encoder
        .align('center')
        .size(1, 2)
        .line('¡Gracias por su compra!')
        .size(1, 1)
        .newline()
        .align('center')
        .font('A')
        .bold(true)
        .line('Desarrollado por: Pensil Devs | pensildevs.com')
        .bold(false);
};

/**
 * Construye el ticket completo
 * @param {Object} ticketData - Datos del ticket desde req.ticket
 * @returns {Uint8Array} Datos codificados del ticket
 */
const buildTicket = (ticketData) => {
    const encoder = new ReceiptPrinterEncoder({
        language: 'esc-pos',
        columns: config.printer.paper.columns,
        feedBeforeCut: 4,
        createCanvas: createCanvas
    });

    let ticketEncoder = encoder
        .initialize()
        .codepage('auto')
        // Fuerza el envío de initialize()/codepage() antes de imprimir cualquier
        // línea. Sin esto, esos comandos quedan pendientes junto con el primer
        // .align('center'), y al llegar ESC@ a la impresora esta limpia su buffer
        // y descarta el padding de centrado, dejando el nombre del establecimiento
        // pegado a la izquierda.
        .newline();

    // [1] Imagen (comentada por ahora)
    // const imagePath = path.join(__dirname, '..', '..', 'assets', 'images', 'sultan-icon.png');
    // const image = await loadImage(imagePath);
    // ticketEncoder = ticketEncoder.align('center').image(image, 240, 200);

    // [2] Información del establecimiento
    ticketEncoder = buildEstablishmentSection(ticketEncoder, ticketData.establishment);

    // [3] Metadatos (fecha, usuario, artículos)
    ticketEncoder = buildMetadataSection(ticketEncoder, ticketData.metadata);

    // [4] Productos (opcional, puede ser una venta de solo tiempo)
    if (ticketData.products.length > 0) {
        ticketEncoder = buildProductsTableHeader(ticketEncoder);
        ticketEncoder = buildProductsSection(ticketEncoder, ticketData.products);
    }

    // [5] Venta de mesa de billar (opcional)
    if (ticketData.billiard) {
        ticketEncoder = buildBilliardSection(ticketEncoder, ticketData.billiard);
    }

    // [6] Total
    ticketEncoder = buildTotalSection(ticketEncoder, ticketData.total, ticketData.deliveryCost);

    // [7] Footer (agradecimiento y créditos)
    ticketEncoder = buildFooterSection(ticketEncoder);

    // [8] Finalizar y codificar
    return ticketEncoder.cut().encode();
};

module.exports = {
    buildTicket,
    buildEstablishmentSection,
    buildMetadataSection,
    buildProductsTableHeader,
    buildProductsSection,
    buildBilliardSection,
    buildTotalSection,
    buildFooterSection
};
