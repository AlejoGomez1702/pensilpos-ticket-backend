const SystemReceiptPrinter = require('@point-of-sale/system-receipt-printer');
const { request, response } = require('express');
const { sendToPrinter } = require('../helpers/printer.helper');
const { buildTicket } = require('../helpers/ticket-builder.helper');
const { buildKitchenTicket } = require('../helpers/kitchen-ticket-builder.helper');
const { clearPrintQueue } = require('../helpers/printer-queue.helper');

// Semáforo simple para evitar impresiones concurrentes
let printLock = Promise.resolve();

/**
 * Ejecuta la tarea cuando terminen las impresiones anteriores
 * @param {Function} task - Tarea de impresión
 * @returns {Promise} Resultado de la tarea (rechaza si la tarea falla)
 */
const withPrintLock = (task) => {
    const run = printLock.then(task);
    // La cola sigue encadenada aunque esta impresión falle: el error solo lo recibe
    // quien pidió esta impresión, no las siguientes.
    printLock = run.catch(() => {});
    return run;
};

const printTicket = async( req = request, res = response ) => {

    const { printer } = req.ticket;

    try {
        // [1] Construir ticket (no requiere lock)
        const data = buildTicket(req.ticket);
        console.log(`📄 Datos generados: ${data.length} bytes`);

        // [2] Esperar turno y ejecutar impresión de forma secuencial
        await withPrintLock(async () => {
            // [2.1] Inicializar impresora
            const receiptPrinter = new SystemReceiptPrinter({ name: printer.name });

            // [2.2] Imprimir ticket
            await sendToPrinter(receiptPrinter, data);

            // [2.3] Limpiar cola en background (sin await) para prevenir acumulación futura
            clearPrintQueue(printer.name).catch(err => 
                console.warn('Error limpiando cola:', err.message)
            );
        });

        return res.json({
            ok: true,
            msg: 'Ticket impreso correctamente',
            printer: printer.name,
            bytes: data.length
        });

    } catch (error) {
        console.error('✗ Error al imprimir ticket:', error);
        console.error('✗ Stack trace:', error.stack);
        
        return res.status(500).json({
            ok: false,
            msg: 'Error al imprimir el ticket',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

const printKitchenTicket = async( req = request, res = response ) => {

    const { printer } = req.ticket;

    try {
        // [1] Construir ticket de cocina (no requiere lock)
        const data = buildKitchenTicket(req.ticket);
        console.log(`🍳 Ticket de cocina generado: ${data.length} bytes`);

        // [2] Esperar turno y ejecutar impresión de forma secuencial
        await withPrintLock(async () => {
            // [2.1] Inicializar impresora
            const receiptPrinter = new SystemReceiptPrinter({ name: printer.name });

            // [2.2] Imprimir ticket de cocina
            await sendToPrinter(receiptPrinter, data);

            // [2.3] Limpiar cola en background (sin await) para prevenir acumulación futura
            clearPrintQueue(printer.name).catch(err => 
                console.warn('Error limpiando cola:', err.message)
            );
        });

        return res.json({
            ok: true,
            msg: 'Ticket de cocina impreso correctamente',
            printer: printer.name,
            bytes: data.length
        });

    } catch (error) {
        console.error('✗ Error al imprimir ticket de cocina:', error);
        console.error('✗ Stack trace:', error.stack);
        
        return res.status(500).json({
            ok: false,
            msg: 'Error al imprimir el ticket de cocina',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

module.exports = {
    printTicket,
    printKitchenTicket
};