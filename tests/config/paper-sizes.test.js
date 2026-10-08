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
});
