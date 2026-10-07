/**
 * Perfiles de tamaño de papel soportados.
 *
 * Cada perfil define las medidas (en columnas de la fuente A) que usan los
 * generadores de tickets. Para soportar un nuevo tamaño basta con agregar
 * un perfil aquí y seleccionarlo con la variable de entorno PAPER_SIZE.
 *
 * Reglas de un perfil:
 * - columns: caracteres por línea con fuente A (ej. 48 para 80mm).
 * - productsTable: columnas de la tabla de productos del ticket de venta
 *   (Producto, CT, Unit, Total). La suma de los anchos debe ser igual a columns.
 */
const PAPER_SIZES = {
    '80mm': {
        columns: 48,
        productsTable: [
            { width: 22, align: 'left' },
            { width: 3,  align: 'center' },
            { width: 11, align: 'right' },
            { width: 12, align: 'right' }
        ]
    }
};

/**
 * Obtiene el perfil de un tamaño de papel, validando que exista y sea consistente
 * @param {string} name - Nombre del tamaño (ej. '80mm')
 * @returns {Object} Perfil del tamaño de papel
 */
const getPaperSize = (name) => {
    const paper = PAPER_SIZES[name];

    if (!paper) {
        throw new Error(`Tamaño de papel "${name}" no soportado. Opciones: ${Object.keys(PAPER_SIZES).join(', ')}`);
    }

    const tableWidth = paper.productsTable.reduce((sum, column) => sum + column.width, 0);
    if (tableWidth !== paper.columns) {
        throw new Error(`Tamaño de papel "${name}": la tabla de productos suma ${tableWidth} columnas y debe sumar ${paper.columns}`);
    }

    return { name, ...paper };
};

module.exports = {
    PAPER_SIZES,
    getPaperSize
};
