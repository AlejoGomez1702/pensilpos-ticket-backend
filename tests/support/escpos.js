/**
 * Lector mínimo de los bytes ESC/POS que generan los builders, para poder afirmar sobre lo que
 * de verdad sale impreso: cada línea con su texto (sin comandos), la fuente y el ancho que ocupa.
 *
 * Solo conoce los comandos que hoy emite el encoder. Ante uno desconocido falla a propósito:
 * si el ticket empieza a usar otro comando, hay que enseñárselo aquí antes de confiar en las líneas.
 */

const ESC = 0x1b;
const FS = 0x1c;
const GS = 0x1d;
const LF = 0x0a;
const CR = 0x0d;

// Columnas del papel de 80 mm por fuente (A: 12 puntos por carácter, B: 9).
const FONT_COLUMNS = { A: 48, B: 64 };

// Lo que el ticket usa de la página de códigos 437 (la que elige el encoder para español).
const CP437 = { á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5, '¡': 0xad, '¿': 0xa8, ü: 0x81, '─': 0xc4 };

/** Texto tal como queda en los bytes del ticket (latin1) cuando el encoder lo codifica en CP437. */
const cp437 = (text) => [...text].map((char) => String.fromCharCode(CP437[char] ?? char.charCodeAt(0))).join('');

/**
 * @param {Uint8Array} data - Bytes del ticket
 * @returns {{ lines: Array<{ text: string, font: string, width: number }>, commands: string[] }}
 *   `width` son las columnas que ocupa la línea en su fuente (un carácter a doble ancho ocupa 2).
 */
const parseTicket = (data) => {
    const bytes = Buffer.from(data);
    const lines = [];
    const commands = [];
    let font = 'A';
    let widthMultiplier = 1;
    let line = { text: '', font, width: 0 };

    const endLine = () => {
        lines.push(line);
        line = { text: '', font, width: 0 };
    };

    for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        const next = bytes[i + 1];
        const arg = bytes[i + 2];

        if (byte === ESC && next === 0x40) { commands.push('initialize'); i += 1; }
        else if (byte === FS && next === 0x2e) { commands.push('cancel-kanji'); i += 1; }
        else if (byte === ESC && next === 0x4d) { font = arg === 1 ? 'B' : 'A'; commands.push(`font-${font}`); i += 2; }
        else if (byte === ESC && next === 0x45) { commands.push(`bold-${arg}`); i += 2; }
        else if (byte === ESC && next === 0x74) { commands.push(`codepage-${arg}`); i += 2; }
        else if (byte === GS && next === 0x21) { widthMultiplier = (arg >> 4) + 1; commands.push(`size-${arg}`); i += 2; }
        else if (byte === GS && next === 0x56) { commands.push('cut'); i += 2; }
        else if (byte === ESC || byte === GS || byte === FS) {
            throw new Error(`Comando ESC/POS desconocido en el byte ${i}: 0x${byte.toString(16)} 0x${(next ?? 0).toString(16)}`);
        }
        else if (byte === LF) { endLine(); }
        else if (byte === CR) { /* el encoder termina cada línea con LF CR */ }
        else {
            if (line.text === '') line.font = font;
            line.text += String.fromCharCode(byte);
            line.width += widthMultiplier;
        }
    }

    return { lines, commands };
};

// No se usa trim(): la "á" en CP437 es el byte 0xA0, que JavaScript trata como espacio.
/** Los textos de las líneas sin el relleno de espacios a la derecha */
const printedLines = (data) => parseTicket(data).lines.map((line) => line.text.replace(/ +$/, ''));

/** Los textos de las líneas sin relleno a ningún lado (para no depender del centrado) */
const printedTexts = (data) => printedLines(data).map((text) => text.replace(/^ +/, ''));

module.exports = { parseTicket, printedLines, printedTexts, cp437, FONT_COLUMNS };
