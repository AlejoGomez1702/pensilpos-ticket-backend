jest.mock('@point-of-sale/system-receipt-printer', () => jest.fn());
jest.mock('../../src/helpers/printer.helper', () => ({ sendToPrinter: jest.fn() }));
jest.mock('../../src/helpers/ticket-builder.helper', () => ({ buildTicket: jest.fn() }));
jest.mock('../../src/helpers/kitchen-ticket-builder.helper', () => ({ buildKitchenTicket: jest.fn() }));
jest.mock('../../src/helpers/printer-queue.helper', () => ({ clearPrintQueue: jest.fn() }));

const SystemReceiptPrinter = require('@point-of-sale/system-receipt-printer');
const { sendToPrinter } = require('../../src/helpers/printer.helper');
const { buildTicket } = require('../../src/helpers/ticket-builder.helper');
const { buildKitchenTicket } = require('../../src/helpers/kitchen-ticket-builder.helper');
const { clearPrintQueue } = require('../../src/helpers/printer-queue.helper');
const { printTicket, printKitchenTicket } = require('../../src/controllers/printer.controller');

const createRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
};

// Ambos endpoints comparten el mismo flujo; solo cambian el builder y los mensajes.
describe.each([
    ['printTicket', printTicket, buildTicket, 'Ticket impreso correctamente', 'Error al imprimir el ticket'],
    ['printKitchenTicket', printKitchenTicket, buildKitchenTicket, 'Ticket de cocina impreso correctamente', 'Error al imprimir el ticket de cocina'],
])('%s', (_, controller, builder, successMsg, errorMsg) => {
    const data = new Uint8Array([1, 2, 3]);
    const req = () => ({ ticket: { printer: { name: 'Pensilpos' } } });

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        builder.mockReturnValue(data);
        sendToPrinter.mockResolvedValue({ success: true });
        clearPrintQueue.mockResolvedValue({ success: true });
    });

    it('construye el ticket, lo envía a la impresora y limpia la cola', async () => {
        const res = createRes();

        await controller(req(), res);

        expect(SystemReceiptPrinter).toHaveBeenCalledWith({ name: 'Pensilpos' });
        expect(sendToPrinter).toHaveBeenCalledWith(expect.any(SystemReceiptPrinter), data);
        expect(clearPrintQueue).toHaveBeenCalledWith('Pensilpos');
        expect(res.json).toHaveBeenCalledWith({ ok: true, msg: successMsg, printer: 'Pensilpos', bytes: 3 });
    });

    it('responde bien aunque falle la limpieza de la cola en segundo plano', async () => {
        clearPrintQueue.mockRejectedValue(new Error('Sin permisos'));
        const res = createRes();

        await controller(req(), res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('responde 500 si la impresora falla', async () => {
        sendToPrinter.mockRejectedValue(new Error('Error de impresora: Sin papel'));
        const res = createRes();

        await controller(req(), res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            ok: false, msg: errorMsg, error: 'Error de impresora: Sin papel',
        }));
    });

    it('imprime de a un ticket: el segundo espera a que termine el primero', async () => {
        let finishFirst;
        sendToPrinter.mockImplementationOnce(() => new Promise((resolve) => {
            finishFirst = resolve;
        }));

        const first = controller(req(), createRes());
        const second = controller(req(), createRes());
        await new Promise(setImmediate);

        expect(sendToPrinter).toHaveBeenCalledTimes(1);

        finishFirst({ success: true });
        await Promise.all([first, second]);

        expect(sendToPrinter).toHaveBeenCalledTimes(2);
    });

    // Regresión: antes, un fallo dejaba el semáforo rechazado y todas las impresiones
    // siguientes fallaban sin llegar a la impresora hasta reiniciar el servicio.
    it('sigue imprimiendo después de un fallo previo', async () => {
        sendToPrinter.mockRejectedValueOnce(new Error('Sin papel'));
        await controller(req(), createRes());
        const res = createRes();

        await controller(req(), res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('responde 500 si falla la construcción del ticket', async () => {
        builder.mockImplementation(() => {
            throw new Error('Datos inválidos');
        });
        const res = createRes();

        await controller(req(), res);

        expect(sendToPrinter).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
