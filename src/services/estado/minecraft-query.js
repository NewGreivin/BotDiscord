/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Consulta de Jugadores en Servidor Minecraft
 * ═══════════════════════════════════════════════════════════════════════════
 * Para usar este módulo, instala:
 *   npm install minecraft-server-util
 */

let ultimoConteo = 0;
let ultimoMaximo = 0;
let ultimaActualizacion = null;
let intervaloConsultas = null;

async function obtenerJugadoresOnline(host = 'flowmc.us', port = 25565) {
    try {
        const util = require('minecraft-server-util');
        
        const response = await util.status(host, port, {
            timeout: 5000,
            enableSRV: true
        });
        ultimoConteo = response.players.online || 0;
        ultimoMaximo = response.players.max || 0;
        ultimaActualizacion = new Date();
        
        return { online: ultimoConteo, max: ultimoMaximo };
        
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            console.warn('[Minecraft Query] minecraft-server-util no está instalado');
            console.warn('[Minecraft Query] Ejecuta: npm install minecraft-server-util');
            return '?';
        }
        console.error('[Minecraft Query] Error al consultar servidor:', error.message);
        
        return ultimoConteo;
    }
}

function obtenerUltimoConteo() {
    return ultimoConteo;
}

function iniciarConsultasPeriodicas(client, intervalo = 60000) {
    if (intervaloConsultas) {
        detenerConsultasPeriodicas();
    }
    
    obtenerJugadoresOnline().then(datos => {
        client.minecraftPlayers = datos.online;
        client.minecraftPlayersMax = datos.max;
    });
    
    intervaloConsultas = setInterval(async () => {
        const datos = await obtenerJugadoresOnline();
        client.minecraftPlayers = datos.online;
        client.minecraftPlayersMax = datos.max;
    }, intervalo);
}

function detenerConsultasPeriodicas() {
    if (intervaloConsultas) {
        clearInterval(intervaloConsultas);
        intervaloConsultas = null;
    }
}

async function obtenerInfoServidor(host = 'flowmc.us', port = 25565) {
    try {
        const util = require('minecraft-server-util');
        const response = await util.status(host, port, {
            timeout: 5000,
            enableSRV: true
        });
        return {
            version: response.version.name,
            protocol: response.version.protocol,
            jugadoresOnline: response.players.online,
            jugadoresMaximos: response.players.max,
            gamemode: response.gamemode,
            serverId: response.serverId,
            latencia: response.roundTripLatency
        };
        
    } catch (error) {
        console.error('[Minecraft Query] Error al obtener info del servidor:', error.message);
        return null;
    }
}

module.exports = {
    obtenerJugadoresOnline,
    obtenerUltimoConteo,
    iniciarConsultasPeriodicas,
    detenerConsultasPeriodicas,
    obtenerInfoServidor
};