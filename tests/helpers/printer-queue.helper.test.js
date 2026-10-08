jest.mock('child_process', () => ({ exec: jest.fn() }));

const { exec } = require('child_process');
const { clearPrintQueue, getPendingJobs } = require('../../src/helpers/printer-queue.helper');

// util.promisify(exec) resuelve con el segundo argumento del callback.
const mockExecResult = (error, stdout = '') => {
    exec.mockImplementation((command, callback) => callback(error, { stdout, stderr: '' }));
};

describe('printer-queue.helper', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    describe('clearPrintQueue', () => {
        it('ejecuta el comando de PowerShell que elimina los trabajos de la impresora', async () => {
            mockExecResult(null);

            const result = await clearPrintQueue('Pensilpos');

            const command = exec.mock.calls[0][0];
            expect(command).toContain("Get-PrintJob -PrinterName 'Pensilpos'");
            expect(command).toContain('Remove-PrintJob');
            expect(result).toEqual({ success: true, message: 'Cola de impresión limpiada correctamente' });
        });

        it('no falla si el comando produce un error', async () => {
            mockExecResult(new Error('Access denied'));

            await expect(clearPrintQueue('Pensilpos')).resolves.toEqual({ success: true, message: 'Cola verificada' });
        });
    });

    describe('getPendingJobs', () => {
        it('devuelve la cantidad de trabajos pendientes', async () => {
            mockExecResult(null, '3\r\n');

            await expect(getPendingJobs('Pensilpos')).resolves.toBe(3);
        });

        it('devuelve 0 si la salida no es un número', async () => {
            mockExecResult(null, '');

            await expect(getPendingJobs('Pensilpos')).resolves.toBe(0);
        });

        it('devuelve 0 si el comando falla', async () => {
            mockExecResult(new Error('Printer not found'));

            await expect(getPendingJobs('Pensilpos')).resolves.toBe(0);
        });
    });
});
