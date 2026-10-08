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
});
