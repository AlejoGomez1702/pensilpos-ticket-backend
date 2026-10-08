/**
 * Doble de @point-of-sale/system-receipt-printer: reemplaza la impresora física.
 * Guarda los trabajos enviados para poder inspeccionarlos y emite 'printed'
 * de forma asíncrona, como lo haría el driver real.
 */
class FakeReceiptPrinter {
    static printers = [{ name: 'Pensilpos' }];
    static jobs = [];
    static failNextPrint = false;

    static getPrinters() {
        return FakeReceiptPrinter.printers;
    }

    static reset() {
        FakeReceiptPrinter.printers = [{ name: 'Pensilpos' }];
        FakeReceiptPrinter.jobs = [];
        FakeReceiptPrinter.failNextPrint = false;
    }

    constructor({ name }) {
        this.name = name;
        this.listeners = {};
    }

    addEventListener(event, handler) {
        this.listeners[event] = handler;
    }

    print(data) {
        if (FakeReceiptPrinter.failNextPrint) {
            FakeReceiptPrinter.failNextPrint = false;
            setImmediate(() => this.listeners.error?.(new Error('Papel atascado')));
            return;
        }
        FakeReceiptPrinter.jobs.push({ printer: this.name, data });
        setImmediate(() => this.listeners.printed?.());
    }
}

module.exports = { FakeReceiptPrinter };
