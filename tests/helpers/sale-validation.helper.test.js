const { hasProductsOrBilliardSale } = require('../../src/helpers/sale-validation.helper');

describe('hasProductsOrBilliardSale', () => {
    it('es válido si la venta tiene productos', () => {
        expect(hasProductsOrBilliardSale({ products: [{ product_name: 'Perro' }] })).toBe(true);
    });

    it('es válido si la venta tiene venta de billar aunque no tenga productos', () => {
        expect(hasProductsOrBilliardSale({ products: [], billiard_sale: { table_name: 'Mesa 1' } })).toBe(true);
    });

    it.each([
        ['sin productos ni billar', { products: [] }],
        ['products no es un arreglo', { products: 'Perro' }],
        ['venta vacía', {}],
        ['venta indefinida', undefined],
    ])('no es válido: %s', (_, saleData) => {
        expect(hasProductsOrBilliardSale(saleData)).toBe(false);
    });
});
