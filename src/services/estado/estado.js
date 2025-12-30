/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sistema de Estados Rotativos del Bot
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este sistema gestiona los estados/actividades que muestra el bot.
 * Los estados rotan automáticamente cada 30 segundos (configurable).
 * 
 * Uso:
 *   const { iniciarEstados } = require('./src/services/estado/estado');
 *   iniciarEstados(client);
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { iniciarConsultasPeriodicas, detenerConsultasPeriodicas } = require('./minecraft-query');

/**
 * Configuración de estados del bot
 * 
 * Tipos disponibles:
 * - Playing: "Jugando a..."
 * - Watching: "Viendo..."
 * - Listening: "Escuchando..."
 * - Competing: "Compitiendo en..."
 * - Streaming: "Transmitiendo..." (requiere URL)
 */
const ESTADOS = [
    { type: 'Playing', text: '🎮 FlowMC | flowmc.us' },
    { type: 'Watching', text: '👥 {usuarios} usuarios en DC' },
    { type: 'Playing', text: '🎮 {jugadores}/{maxjugadores} jugando en MC' },
    { type: 'Watching', text: '🌐 www.flowmc.us' },
    { type: 'Playing', text: '🛒 tienda.flowmc.us' },
    { type: 'Playing', text: '📍 IP: flowmc.us / 19132' }
];

const INTERVALO_ROTACION = 20000; //Tiempo: 20s
const STATUS = 'online';
let intervaloEstados = null;
let estadoActual = 0;

const ACTIVITY_TYPES = {
    'Playing': 0,
    'Streaming': 1,
    'Listening': 2,
    'Watching': 3,
    'Competing': 5
};

function procesarTexto(text, client) {
    if (text.includes('{usuarios}')) {
        const totalUsuarios = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        text = text.replace('{usuarios}', totalUsuarios.toLocaleString());
    }
    
    if (text.includes('{jugadores}')) {
        const jugadoresOnline = client.minecraftPlayers || '...';
        text = text.replace('{jugadores}', jugadoresOnline);
    }
    
    if (text.includes('{maxjugadores}')) {
        const jugadoresMaximos = client.minecraftPlayersMax || '...';
        text = text.replace('{maxjugadores}', jugadoresMaximos);
    }
    
    return text;
}

function actualizarEstado(client) {
    try {
        const estado = ESTADOS[estadoActual];
        const textoFinal = procesarTexto(estado.text, client);
        const activityType = ACTIVITY_TYPES[estado.type] || 0;

        client.user.setPresence({
            activities: [{
                name: textoFinal,
                type: activityType
            }],
            status: STATUS
        });
        
        estadoActual = (estadoActual + 1) % ESTADOS.length;
        
    } catch (error) {
        console.error('[Estados] Error al actualizar estado:', error);
    }
}

function iniciarEstados(client) {
    try {
        if (!client.user) {
            console.error('[Estados] Error: El cliente no está listo');
            return;
        }
        
        if (intervaloEstados) {
            detenerEstados();
        }
        
        iniciarConsultasPeriodicas(client, 60000);
        
        actualizarEstado(client);

        intervaloEstados = setInterval(() => {
            actualizarEstado(client);
        }, INTERVALO_ROTACION);
        
    } catch (error) {
        console.error('[Estados] Error al iniciar sistema:', error);
    }
}

function detenerEstados() {
    if (intervaloEstados) {
        clearInterval(intervaloEstados);
        intervaloEstados = null;
        estadoActual = 0;
    }
    
    detenerConsultasPeriodicas();
}

function establecerEstadoManual(client, type, text) {
    try {
        const activityType = ACTIVITY_TYPES[type] || 0;
        
        client.user.setPresence({
            activities: [{
                name: text,
                type: activityType
            }],
            status: STATUS
        });
        
    } catch (error) {
        console.error('[Estados] Error al establecer estado manual:', error);
    }
}

function getConfiguracion() {
    return {
        estados: ESTADOS,
        intervalo: INTERVALO_ROTACION,
        status: STATUS,
        estadoActualIndex: estadoActual,
        activo: intervaloEstados !== null
    };
}

module.exports = {iniciarEstados,detenerEstados,establecerEstadoManual,getConfiguracion};