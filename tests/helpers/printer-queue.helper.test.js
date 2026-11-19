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

    // --- Auditoría adversarial: el nombre de la impresora dentro del comando de PowerShell ---
    describe('nombre de la impresora en el comando', () => {
        beforeEach(() => mockExecResult(null, '0'));

        it('clearPrintQueue ejecuta exactamente un comando, con el nombre entre comillas simples', async () => {
            await clearPrintQueue('Caja 2 (EPSON TM-T20)');

            expect(exec).toHaveBeenCalledTimes(1);
            expect(exec.mock.calls[0][0]).toBe(
                `powershell -Command "Get-PrintJob -PrinterName 'Caja 2 (EPSON TM-T20)' -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue"`
            );
        });

        it('getPendingJobs consulta solo la impresora indicada', async () => {
            await getPendingJobs('Caja 2');

            expect(exec.mock.calls[0][0]).toBe(`powershell -Command "(Get-PrintJob -PrinterName 'Caja 2').Count"`);
        });

        // Dentro de comillas simples PowerShell no expande variables ni subexpresiones.
        it('un nombre con $ o punto y coma queda dentro de las comillas simples', async () => {
            await clearPrintQueue('Caja; $(calc)');

            expect(exec.mock.calls[0][0]).toContain(`-PrinterName 'Caja; $(calc)' -ErrorAction`);
        });

        // BUG-AUDIT: el nombre se interpola sin escapar. Una impresora llamada "Caja de O'Brien" cierra la comilla
        // antes de tiempo: el comando queda mal formado (la cola nunca se limpia, y el error se silencia) y el resto
        // del nombre se interpreta como PowerShell. Hoy el nombre solo sale de PRINTER_NAME (.env).
        it.failing('una comilla simple en el nombre no cierra la cadena del comando', async () => {
            await clearPrintQueue("Caja de O'Brien");

            const command = exec.mock.calls[0]?.[0] ?? '';
            expect(command).not.toContain("'Caja de O'Brien'");
        });

        // BUG-AUDIT: lo mismo con una comilla doble, que cierra el argumento de -Command.
        it.failing('una comilla doble en el nombre no cierra el argumento -Command', async () => {
            await clearPrintQueue('Caja "principal"');

            const command = exec.mock.calls[0]?.[0] ?? '';
            expect(command).not.toContain(`'Caja "principal"'`);
        });
    });
});
