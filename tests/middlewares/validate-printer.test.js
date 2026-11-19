jest.mock('@point-of-sale/system-receipt-printer', () => ({ getPrinters: jest.fn() }));

const SystemReceiptPrinter = require('@point-of-sale/system-receipt-printer');
const { validatePrinter } = require('../../src/middlewares/validate-printer');
const config = require('../../src/config/config');

const createRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
};

describe('validatePrinter', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('guarda en req.ticket la impresora configurada y continúa', async () => {
        const printer = { name: config.printer.name };
        SystemReceiptPrinter.getPrinters.mockReturnValue([{ name: 'Otra' }, printer]);
        const req = {};
        const next = jest.fn();

        await validatePrinter(req, createRes(), next);

        expect(req.ticket.printer).toBe(printer);
        expect(next).toHaveBeenCalled();
    });

    it('responde 500 con las impresoras disponibles si la configurada no existe', async () => {
        SystemReceiptPrinter.getPrinters.mockReturnValue([{ name: 'Otra' }]);
        const res = createRes();
        const next = jest.fn();

        await validatePrinter({}, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            ok: false,
            msg: `Impresora "${config.printer.name}" no configurada`,
            availablePrinters: ['Otra'],
        }));
    });

    it('responde 500 si falla la consulta de impresoras del sistema', async () => {
        SystemReceiptPrinter.getPrinters.mockImplementation(() => {
            throw new Error('Spooler detenido');
        });
        const res = createRes();

        await validatePrinter({}, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            ok: false,
            msg: 'Error al buscar impresora',
            error: 'Spooler detenido',
        });
    });

    // --- Auditoría adversarial ---

    it('la respuesta de impresora no configurada explica qué hacer y no deja seguir a la impresión', async () => {
        SystemReceiptPrinter.getPrinters.mockReturnValue([]);
        const res = createRes();
        const req = {};

        await validatePrinter(req, res, jest.fn());

        expect(res.json).toHaveBeenCalledWith({
            ok: false,
            msg: `Impresora "${config.printer.name}" no configurada`,
            error: `Por favor, configure una impresora con el nombre "${config.printer.name}" en su sistema operativo`,
            availablePrinters: [],
        });
        expect(req.ticket.printer).toBeUndefined();
    });

    // La impresora del ticket sale solo de PRINTER_NAME: nada que traiga la petición puede elegirla
    // (su nombre termina en un comando de PowerShell al limpiar la cola).
    it('descarta cualquier req.ticket previo: la impresora siempre es la configurada', async () => {
        const printer = { name: config.printer.name };
        SystemReceiptPrinter.getPrinters.mockReturnValue([printer]);
        const req = { ticket: { printer: { name: "x'; Remove-Item C:\\ -Recurse; '" }, total: 1 }, body: { ticket: { printer: { name: 'Otra' } } } };

        await validatePrinter(req, createRes(), jest.fn());

        expect(req.ticket).toEqual({ printer });
    });
});
