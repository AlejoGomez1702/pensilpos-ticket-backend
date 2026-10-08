// Constantes
const PRINT_TIMEOUT_MS = 2000;

/**
 * Envía los datos codificados a la impresora
 * @param {SystemReceiptPrinter} printer - Instancia de la impresora
 * @param {Uint8Array} data - Datos codificados del ticket
 * @returns {Promise<{success: boolean, assumed?: boolean}>}
 */
const sendToPrinter = (printer, data) => {
    return new Promise((resolve, reject) => {
        let resolved = false;
        let timeoutId = null;

        const handlePrinted = () => {
            if (!resolved) {
                console.log('✓ Impresión completada');
                resolved = true;
                clearTimeout(timeoutId);
                resolve({ success: true });
            }
        };

        const handleError = (error) => {
            if (!resolved) {
                console.error('✗ Error durante impresión:', error);
                resolved = true;
                clearTimeout(timeoutId);
                reject(new Error(`Error de impresora: ${error.message || error}`));
            }
        };

        // Registrar listeners
        printer.addEventListener('printed', handlePrinted);
        printer.addEventListener('error', handleError);

        // Enviar a imprimir
        try {
            printer.print(data);
            console.log('🖨️  Comando de impresión enviado');
            
            // Timeout de seguridad: algunas impresoras no emiten evento 'printed'
            timeoutId = setTimeout(() => {
                if (!resolved) {
                    console.log('✓ Impresión completada (sin confirmación explícita)');
                    resolved = true;
                    resolve({ success: true, assumed: true });
                }
            }, PRINT_TIMEOUT_MS);
            
        } catch (printError) {
            console.error('✗ Error al enviar comando:', printError);
            resolved = true;
            reject(printError);
        }
    });
};

module.exports = {
    sendToPrinter
};
