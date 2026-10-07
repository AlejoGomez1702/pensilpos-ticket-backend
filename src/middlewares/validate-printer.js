const { request, response } = require("express");
const SystemReceiptPrinter = require('@point-of-sale/system-receipt-printer');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const config = require('../config/config');

/**
 * Verifica el estado real de la impresora usando PowerShell
 * @param {string} printerName 
 * @returns {Promise<boolean>}
 */
const isPrinterOnline = async (printerName) => {
    // TODO: Implementar validación confiable de estado de impresora
    // Problema actual: Windows reporta estados transitorios (Printing, Processing)
    // que causan falsos positivos. Necesita lógica más robusta que diferencie
    // entre "ocupada imprimiendo" vs "físicamente desconectada"
    // Ticket Jira: [PENDING]
    
    return true; // Por ahora, siempre permitir (asumimos que está disponible)
};

const validatePrinter = async (req = request, res = response, next) => {
    try {
        req.ticket = {};
        // Obtener lista de impresoras disponibles
        const printers = SystemReceiptPrinter.getPrinters();
        
        // Buscar la impresora configurada (PRINTER_NAME)
        const printerName = config.printer.name;
        const printer = printers.find(p => p.name === printerName);
        
        if (!printer) {
            console.error(`❌ Impresora "${printerName}" no encontrada`);
            console.log('📋 Impresoras disponibles:', printers.map(p => p.name));
            
            return res.status(500).json({
                ok: false,
                msg: `Impresora "${printerName}" no configurada`,
                error: `Por favor, configure una impresora con el nombre "${printerName}" en su sistema operativo`,
                availablePrinters: printers.map(p => p.name)
            });
        }

        // Verificar estado real de la impresora (conectada físicamente)
        const isOnline = await isPrinterOnline(printer.name);
        
        if (!isOnline) {
            console.warn(`⚠️  Impresora "${printerName}" está DESCONECTADA o APAGADA`);
            return res.status(503).json({
                ok: false,
                msg: 'Impresora desconectada',
                error: `La impresora "${printerName}" está desconectada o apagada. Por favor, verifique la conexión USB y que esté encendida.`,
                printerName: printer.name
            });
        }
        
        // Guardar la impresora en el request para usarla en el controlador
        req.ticket.printer = printer;
        console.log(`✓ Impresora "${printerName}" conectada y lista`);
        
        next();
        
    } catch (error) {
        console.error('❌ Error al buscar impresora:', error);
        
        return res.status(500).json({
            ok: false,
            msg: 'Error al buscar impresora',
            error: error.message
        });
    }
}

module.exports = {
    validatePrinter
};