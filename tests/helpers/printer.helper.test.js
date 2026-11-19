const { sendToPrinter } = require('../../src/helpers/printer.helper');

const createPrinter = () => {
    const listeners = {};
    return {
        listeners,
        addEventListener: jest.fn((event, handler) => {
            listeners[event] = handler;
        }),
        print: jest.fn(),
    };
};

describe('sendToPrinter', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('envía los datos a la impresora y resuelve cuando emite "printed"', async () => {
        const printer = createPrinter();
        const data = new Uint8Array([1, 2, 3]);

        const promise = sendToPrinter(printer, data);
        printer.listeners.printed();

        await expect(promise).resolves.toEqual({ success: true });
        expect(printer.print).toHaveBeenCalledWith(data);
        // El timeout de seguridad se cancela al recibir la confirmación.
        expect(jest.getTimerCount()).toBe(0);
    });

    it('rechaza con un error de impresora cuando emite "error"', async () => {
        const printer = createPrinter();

        const promise = sendToPrinter(printer, new Uint8Array());
        printer.listeners.error(new Error('Sin papel'));

        await expect(promise).rejects.toThrow('Error de impresora: Sin papel');
        expect(jest.getTimerCount()).toBe(0);
    });

    it('asume la impresión como exitosa si no hay confirmación tras el timeout', async () => {
        const printer = createPrinter();

        const promise = sendToPrinter(printer, new Uint8Array());
        jest.advanceTimersByTime(2000);

        await expect(promise).resolves.toEqual({ success: true, assumed: true });
    });

    it('ignora eventos posteriores a la primera respuesta', async () => {
        const printer = createPrinter();

        const promise = sendToPrinter(printer, new Uint8Array());
        printer.listeners.printed();
        printer.listeners.error(new Error('tarde'));
        jest.advanceTimersByTime(2000);

        await expect(promise).resolves.toEqual({ success: true });
    });

    it('rechaza si print lanza una excepción al enviar el comando', async () => {
        const printer = createPrinter();
        printer.print.mockImplementation(() => {
            throw new Error('Puerto cerrado');
        });

        await expect(sendToPrinter(printer, new Uint8Array())).rejects.toThrow('Puerto cerrado');
    });

    // --- Auditoría adversarial ---

    it('espera los 2 segundos completos antes de asumir la impresión', async () => {
        const printer = createPrinter();
        const settled = jest.fn();

        sendToPrinter(printer, new Uint8Array()).then(settled, settled);
        await jest.advanceTimersByTimeAsync(1999);

        expect(settled).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1);

        expect(settled).toHaveBeenCalledWith({ success: true, assumed: true });
    });

    it('conserva el detalle cuando el driver emite el error como texto y no como Error', async () => {
        const printer = createPrinter();

        const promise = sendToPrinter(printer, new Uint8Array());
        printer.listeners.error('Tapa abierta');

        await expect(promise).rejects.toThrow('Error de impresora: Tapa abierta');
    });

    it('escucha los eventos antes de imprimir: no pierde una confirmación o un error inmediatos', async () => {
        const confirming = createPrinter();
        confirming.print.mockImplementation(() => confirming.listeners.printed());
        const failing = createPrinter();
        failing.print.mockImplementation(() => failing.listeners.error(new Error('Sin papel')));

        await expect(sendToPrinter(confirming, new Uint8Array())).resolves.toEqual({ success: true });
        await expect(sendToPrinter(failing, new Uint8Array())).rejects.toThrow('Error de impresora: Sin papel');
    });

    it('un error que llega después de haber asumido la impresión ya no cambia el resultado', async () => {
        const printer = createPrinter();

        const promise = sendToPrinter(printer, new Uint8Array());
        jest.advanceTimersByTime(2000);
        printer.listeners.error(new Error('Sin papel'));

        await expect(promise).resolves.toEqual({ success: true, assumed: true });
    });
});
