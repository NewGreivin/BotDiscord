const fs = require('fs');
const COUNTER_FILE = './data/counters.json'

/**
 * Carga el valor actual del contador desde counter.json
 * @returns {number}
 */
function loadCounter() {
    if (fs.existsSync(COUNTER_FILE)) {
        const data = fs.readFileSync(COUNTER_FILE, 'utf8');
        try {
            return JSON.parse(data).counter || 0;
        } catch (e) {
            console.error('Error al leer counter.json, se reinicia a 0');
            return 0;
        }
    }
    return 0;
}

/**
 * Guarda el valor del contador en counter.json
 * @param {number} counter
 */
function saveCounter(counter) {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify({ counter }, null, 2));
}

module.exports = { loadCounter, saveCounter };