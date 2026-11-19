const { PAPER_SIZES, getPaperSize } = require('../../src/config/paper-sizes');

describe('getPaperSize', () => {
    it('devuelve el perfil de 80mm con su nombre', () => {
        const paper = getPaperSize('80mm');

        expect(paper.name).toBe('80mm');
        expect(paper.columns).toBe(48);
        expect(paper.productsTable).toHaveLength(4);
    });

    it('lanza un error si el tamaño no está soportado', () => {
        expect(() => getPaperSize('58mm')).toThrow('Tamaño de papel "58mm" no soportado. Opciones: 80mm');
    });

    it('lanza un error si la tabla de productos no suma las columnas del papel', () => {
        PAPER_SIZES.broken = { columns: 32, productsTable: [{ width: 10, align: 'left' }] };

        try {
            expect(() => getPaperSize('broken')).toThrow('la tabla de productos suma 10 columnas y debe sumar 32');
        } finally {
            delete PAPER_SIZES.broken;
        }
    });

    it.each(Object.keys(PAPER_SIZES))('el perfil "%s" es consistente', (name) => {
        expect(() => getPaperSize(name)).not.toThrow();
    });

    // --- Auditoría adversarial ---

    it('también rechaza una tabla de productos más ancha que el papel', () => {
        PAPER_SIZES.wide = { columns: 32, productsTable: [{ width: 20, align: 'left' }, { width: 13, align: 'right' }] };

        try {
            expect(() => getPaperSize('wide')).toThrow('la tabla de productos suma 33 columnas y debe sumar 32');
        } finally {
            delete PAPER_SIZES.wide;
        }
    });

    it('el perfil de 80mm reparte las 48 columnas en nombre, cantidad, precio unitario y total', () => {
        expect(getPaperSize('80mm')).toEqual({
            name: '80mm',
            columns: 48,
            productsTable: [
                { width: 22, align: 'left' },
                { width: 3, align: 'center' },
                { width: 11, align: 'right' },
                { width: 12, align: 'right' },
            ],
        });
    });

    it.each(['', undefined, '80MM', ' 80mm'])('no adivina el tamaño: %p no está soportado', (name) => {
        expect(() => getPaperSize(name)).toThrow('no soportado');
    });

    // BUG-AUDIT: el perfil se busca con PAPER_SIZES[name], así que un nombre heredado de Object.prototype
    // ("constructor", "toString") pasa el primer control y falla después con un TypeError que no dice qué pasó.
    it.failing('un nombre heredado del prototipo ("constructor") se reporta como tamaño no soportado', () => {
        expect(() => getPaperSize('constructor')).toThrow('Tamaño de papel "constructor" no soportado');
    });
});
