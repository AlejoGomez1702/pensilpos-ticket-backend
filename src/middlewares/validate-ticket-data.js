
const validateTicketData = ( req, res, next ) => {
    
    const {
        establishment_name,
        establishment_nit,
        establishment_phone,
        establishment_email,
        establishment_address,
        waiter_name,
        sale_data
    } = req.body;

    // [1] Información del establecimiento
    req.ticket.establishment = {
        name: establishment_name,
        nit: establishment_nit || 'xxx.xxx.xxx-x',
        phone: establishment_phone || '3xx-xxx-xxxx',
        email: establishment_email || null,
        address: establishment_address || 'Colombia'
    };

    // [2] Metadatos del ticket (fecha, hora, usuario, observaciones)
    const now = new Date();
    const date = now.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    // [3] Productos de la venta (opcional, puede ser una venta de solo tiempo)
    const products = sale_data.products || [];
    // Una línea por peso (SPEC-051) trae `sale_unit: 'WEIGHT'`: su cantidad son gramos y su
    // precio, por kg. Las demás no traen la unidad.
    const isWeighed = (product) => product.sale_unit === 'WEIGHT';
    req.ticket.products = products.map(product => ({
        name: product.product_name,
        quantity: product.count,
        ...(isWeighed(product) && { saleUnit: 'WEIGHT' }),
        unitPrice: product.sale_price,
        total: product.total_item_value,
        note: product.product_note || null
    }));

    // Calcular total de artículos entregados (una línea por peso es un artículo, no sus gramos)
    const totalArticles = products.reduce(
        (sum, product) => sum + (isWeighed(product) ? 1 : product.count),
        0
    );
    
    req.ticket.metadata = {
        date: date,
        time: time,
        waiter: waiter_name || null,
        observations: sale_data.notes || null,
        totalArticles: totalArticles,
        clientName: sale_data.client?.name || null
    };

    // [4] Total de la venta
    req.ticket.total = sale_data.total;

    // [5] Costo de domicilio (opcional)
    req.ticket.deliveryCost = sale_data.delivery_cost || null;

    // [6] Venta de mesa de billar (opcional)
    const { billiard_sale } = sale_data;
    req.ticket.billiard = billiard_sale ? {
        tableName: billiard_sale.table_name,
        elapsedMinutes: billiard_sale.elapsed_minutes,
        hourlyRate: billiard_sale.hourly_rate,
        cost: billiard_sale.hourly_rate * billiard_sale.elapsed_minutes / 60
    } : null;

    next();
};

module.exports = {
    validateTicketData
};