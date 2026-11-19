/**
 * Doble de @point-of-sale/system-receipt-printer: reemplaza la impresora física.
 * Guarda los trabajos enviados para poder inspeccionarlos y emite 'printed'
 * de forma asíncrona, como lo haría el driver real.
 */
class FakeReceiptPrinter {
    static printers = [{ name: 'Pensilpos' }];
    static jobs = [];
    static failNextPrint = false;
    // La próxima impresión no emite ni 'printed' ni 'error' (impresora que no confirma).
    static silentNextPrint = false;
    // Milisegundos que tarda cada impresión en confirmar; con > 0 se puede ver si dos se solapan.
    static printDelayMs = 0;
    static printing = 0;
    static maxSimultaneousPrints = 0;

    static getPrinters() {
        return FakeReceiptPrinter.printers;
    }

    static reset() {
        FakeReceiptPrinter.printers = [{ name: 'Pensilpos' }];
        FakeReceiptPrinter.jobs = [];
        FakeReceiptPrinter.failNextPrint = false;
        FakeReceiptPrinter.silentNextPrint = false;
        FakeReceiptPrinter.printDelayMs = 0;
        FakeReceiptPrinter.printing = 0;
        FakeReceiptPrinter.maxSimultaneousPrints = 0;
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
        if (FakeReceiptPrinter.silentNextPrint) {
            FakeReceiptPrinter.silentNextPrint = false;
            return;
        }
        FakeReceiptPrinter.printing += 1;
        FakeReceiptPrinter.maxSimultaneousPrints = Math.max(FakeReceiptPrinter.maxSimultaneousPrints, FakeReceiptPrinter.printing);
        const confirm = () => {
            FakeReceiptPrinter.printing -= 1;
            this.listeners.printed?.();
        };
        if (FakeReceiptPrinter.printDelayMs > 0) {
            setTimeout(confirm, FakeReceiptPrinter.printDelayMs);
        } else {
            setImmediate(confirm);
        }
    }
}

module.exports = { FakeReceiptPrinter };
