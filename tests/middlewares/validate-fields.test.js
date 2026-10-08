jest.mock('express-validator', () => ({ validationResult: jest.fn() }));

const { validationResult } = require('express-validator');
const { validateFields } = require('../../src/middlewares/validate-fields');

const createRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
};

describe('validateFields', () => {
    it('continúa si no hay errores de validación', () => {
        validationResult.mockReturnValue({ isEmpty: () => true });
        const next = jest.fn();

        validateFields({}, createRes(), next);

        expect(next).toHaveBeenCalled();
    });

    it('responde 400 con los errores si la validación falla', () => {
        const errors = { waiter_name: { msg: 'Invalid value' } };
        validationResult.mockReturnValue({ isEmpty: () => false, mapped: () => errors });
        const res = createRes();
        const next = jest.fn();

        validateFields({}, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            ok: false,
            message: 'Errores de validación en los campos enviados.',
            errors,
        });
    });
});
