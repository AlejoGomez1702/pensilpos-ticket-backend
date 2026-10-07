const ReceiptPrinterEncoder = require('@point-of-sale/receipt-printer-encoder');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const config = require('../config/config');

/**
 * Construye la sección del encabezado del ticket de cocina
 */
const buildKitchenHeaderSection = (encoder, ticketData) => {
    let headerText = 'PEDIDO COCINA';
    
    if (ticketData.orderType === 'TABLE') {
        headerText = ticketData.tableName ? ticketData.tableName.toUpperCase() : 'MESA';
    } else if (ticketData.orderType === 'DELIVERY') {
        headerText = 'DOMICILIO';
    } else if (ticketData.orderType === 'FAST') {
        headerText = 'VENTA RÁPIDA';
    }
    
    return encoder
        .align('center')
        .font('A')
        .bold(true)
        .size(4, 4)
        .line(headerText)
        .size(2, 2)
        .bold(false);
};

/**
 * Construye la sección de metadatos del ticket de cocina
 */
const buildKitchenMetadataSection = (encoder, ticketData) => {
    // Obtener hora actual
    const now = new Date();
    const time = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    let ticketEncoder = encoder
        .align('center')
        .line(time);
    
    // Mostrar nombre del cliente si existe
    if (ticketData.customerName) {
        ticketEncoder = ticketEncoder.line(ticketData.customerName);
    }
    
    return ticketEncoder;
};

/**
 * Construye la sección de productos para cocina
 */
const buildKitchenProductsSection = (encoder, products) => {
    let ticketEncoder = encoder
        .size(1, 1)
        .rule()
        .align('left');
    
    products.forEach(product => {
        // Cantidad y nombre del producto en grande
        ticketEncoder = ticketEncoder
            .bold(true)
            .size(2, 3)
            .line(`x${product.quantity} ${product.name}`)
            .size(2, 2)
            .bold(false);

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
 * Construye la sección del footer del ticket de cocina
 * @param {Object} encoder - Instancia del encoder
 * @param {Array} products - Lista de productos
 * @param {Object} ticketData - Datos del ticket
 * @returns {Object} encoder actualizado
 */
const buildKitchenFooterSection = (encoder, products, ticketData) => {
    // Calcular total de artículos
    const totalArticles = products.reduce((sum, product) => sum + product.quantity, 0);
    
    let ticketEncoder = encoder
        .size(1, 1)
        .rule()
        .align('center')
        .bold(true)
        .size(1, 2)
        .line(`Total Artículos: ${totalArticles}`);
    
    // Mostrar costo de delivery si existe
    if (ticketData.deliveryCost) {
        const formattedDeliveryCost = `$${ticketData.deliveryCost.toLocaleString('es-CO')}`;
        ticketEncoder = ticketEncoder.line(`Costo Domicilio: ${formattedDeliveryCost}`);
    }
    
    ticketEncoder = ticketEncoder.bold(false);
    
    // Solo mostrar observaciones generales si existen
    if (ticketData.notes) {
        ticketEncoder = ticketEncoder
            .newline()
            .align('left')
            .bold(true)
            .line('OBSERVACIONES:')
            .bold(false)
            .line(ticketData.notes);
    }
    
    return ticketEncoder;
};

/**
 * Construye el ticket de cocina completo
 * @param {Object} kitchenTicketData - Datos del ticket de cocina desde req.ticket
 * @returns {Uint8Array} Datos codificados del ticket
 */
const buildKitchenTicket = (kitchenTicketData) => {
    const encoder = new ReceiptPrinterEncoder({
        language: 'esc-pos',
        columns: config.printer.paper.columns,
        feedBeforeCut: 4,
        createCanvas: createCanvas
    });

    let ticketEncoder = encoder
        .initialize()
        .codepage('auto');

    // [1] Encabezado del ticket de cocina
    ticketEncoder = buildKitchenHeaderSection(ticketEncoder, kitchenTicketData);

    // [2] Metadatos (tipo de orden, mesa/cliente, fecha, observaciones)
    ticketEncoder = buildKitchenMetadataSection(ticketEncoder, kitchenTicketData);

    // [3] Lista de productos (cantidad y nombre en grande)
    ticketEncoder = buildKitchenProductsSection(ticketEncoder, kitchenTicketData.products);

    // [4] Footer (total de artículos y observaciones)
    ticketEncoder = buildKitchenFooterSection(ticketEncoder, kitchenTicketData.products, kitchenTicketData);

    // [5] Finalizar y codificar
    return ticketEncoder.cut().encode();
};

module.exports = {
    buildKitchenTicket,
    buildKitchenHeaderSection,
    buildKitchenMetadataSection,
    buildKitchenProductsSection,
    buildKitchenFooterSection
};
