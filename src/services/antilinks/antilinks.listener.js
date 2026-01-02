/**
 * ════════════════════════════════════════════════════════════════════════════
 * ANTILINKS LISTENER - Event Handler para messageCreate
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Escuchar el evento messageCreate
 * - Aplicar validaciones en orden lógico
 * - Decidir si se debe tomar acción
 * - Delegar acciones al handler centralizado
 * - Mantener el código limpio y modular
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

const { Events } = require('discord.js');
const { analyzeMessage } = require('./antilinks.detector');
const { recordLinkAttempt } = require('./antilinks.cache');
const { executeAntiLinkAction, notifySpamAttempt } = require('./antilinks.handler');

/**
 * Crea y configura el listener del evento messageCreate
 * 
 * @param {Client} client - Cliente de Discord
 * @param {Object} config - Configuración del antilinks
 * @returns {Object} - Objeto con información del listener
 */
function createAntiLinksListener(client, config) {
    
    /**
     * Handler principal del evento messageCreate
     */
    const messageHandler = async (message) => {
        try {
            // ═══════════════════════════════════════════════════════════
            // VALIDACIÓN 1: Ignorar bots
            // ═══════════════════════════════════════════════════════════
            if (message.author.bot) {
                return;
            }

            // ═══════════════════════════════════════════════════════════
            // VALIDACIÓN 2: Verificar si el sistema está habilitado
            // ═══════════════════════════════════════════════════════════
            if (!config.antilinks.enabled) {
                return;
            }

            // ═══════════════════════════════════════════════════════════
            // VALIDACIÓN 3: Solo procesar mensajes de servidores
            // ═══════════════════════════════════════════════════════════
            if (!message.guild) {
                return;
            }

            // ═══════════════════════════════════════════════════════════
            // VALIDACIÓN 4: Verificar excepciones por rol
            // ═══════════════════════════════════════════════════════════
            if (hasAllowedRole(message.member, config.antilinks.allowedRoles)) {
                return;
            }

            // ═══════════════════════════════════════════════════════════
            // VALIDACIÓN 5: Analizar el mensaje para detectar enlaces
            // ═══════════════════════════════════════════════════════════
            const analysis = analyzeMessage(
                message.content, 
                config.antilinks.blockedDomains,
                config.antilinks.allowedDomains || []
            );

            // Si no hay enlaces, no hacer nada
            if (!analysis.hasLinks) {
                return;
            }
            
            // Si todos los enlaces están en la whitelist, permitirlos
            if (analysis.allowedLinks.length > 0 && !analysis.hasBlockedLinks) {
                return;
            }

            // ═══════════════════════════════════════════════════════════
            // VALIDACIÓN 6: Verificar configuración de canales
            // ═══════════════════════════════════════════════════════════
            const channelValidation = validateChannel(
                message.channel.id,
                config.antilinks.allowedChannels,
                config.antilinks.blockedChannels
            );

            // Si el canal está permitido, no tomar acción
            if (channelValidation.allowed) {
                return;
            }

            // Si el canal no está ni permitido ni bloqueado, no actuar
            if (!channelValidation.shouldAct) {
                return;
            }

            // ═══════════════════════════════════════════════════════════
            // VALIDACIÓN 7: Verificar si hay dominios bloqueados
            // ═══════════════════════════════════════════════════════════
            if (!analysis.hasBlockedLinks) {
                // Hay enlaces pero no son de dominios bloqueados
                // Aún así, verificar spam
                const isSpam = recordLinkAttempt(message.author.id);
                
                if (isSpam) {
                    // Es spam por repetición
                    await executeAntiLinkAction({
                        message,
                        config: config.antilinks,
                        analysis,
                        isSpam: true,
                        client
                    });
                    
                    // Notificar en el canal (opcional)
                    await notifySpamAttempt(message.channel, message.author);
                }
                
                return;
            }

            // ═══════════════════════════════════════════════════════════
            // ACCIÓN: Dominio bloqueado detectado
            // ═══════════════════════════════════════════════════════════
            
            // Registrar intento para anti-spam
            const isSpam = recordLinkAttempt(message.author.id);

            // Ejecutar acción centralizada
            await executeAntiLinkAction({
                message,
                config: config.antilinks,
                analysis,
                isSpam: isSpam,
                client
            });

            console.log(
                `[AntiLinks] Acción ejecutada | Usuario: ${message.author.tag} | ` +
                `Canal: ${message.channel.name} | Dominios: ${analysis.blockedLinks.map(bl => bl.domain).join(', ')}`
            );

        } catch (error) {
            console.error('[AntiLinks Listener] Error procesando mensaje:', error);
        }
    };

    // Registrar el listener
    client.on(Events.MessageCreate, messageHandler);

    console.log('[AntiLinks] Listener registrado exitosamente');

    return {
        event: Events.MessageCreate,
        handler: messageHandler
    };
}

/**
 * Verifica si un miembro tiene algún rol permitido (excepción)
 * 
 * @param {GuildMember} member - Miembro a verificar
 * @param {Array<string>} allowedRoles - IDs de roles permitidos
 * @returns {boolean} - true si tiene rol permitido, false si no
 */
function hasAllowedRole(member, allowedRoles) {
    if (!member || !Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        return false;
    }

    // Verificar si el miembro tiene alguno de los roles permitidos
    return allowedRoles.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Valida si se debe actuar en un canal específico
 * 
 * Lógica:
 * - Si está en allowedChannels: NO actuar (permitir enlaces)
 * - Si está en blockedChannels: SÍ actuar (bloquear enlaces)
 * - Si no está en ninguna lista: NO actuar (comportamiento por defecto)
 * 
 * @param {string} channelId - ID del canal
 * @param {Array<string>} allowedChannels - Canales donde se permiten enlaces
 * @param {Array<string>} blockedChannels - Canales donde se bloquean enlaces
 * @returns {Object} - Objeto con información de validación
 */
function validateChannel(channelId, allowedChannels = [], blockedChannels = []) {
    // Verificar si está en canales permitidos
    if (allowedChannels.includes(channelId)) {
        return {
            allowed: true,
            shouldAct: false,
            reason: 'Canal en lista de permitidos'
        };
    }

    // Verificar si está en canales bloqueados
    if (blockedChannels.includes(channelId)) {
        return {
            allowed: false,
            shouldAct: true,
            reason: 'Canal en lista de bloqueados'
        };
    }

    // No está en ninguna lista
    return {
        allowed: false,
        shouldAct: false,
        reason: 'Canal no configurado'
    };
}

/**
 * Remueve el listener (útil para recargas en caliente)
 * 
 * @param {Client} client - Cliente de Discord
 * @param {Function} handler - Handler a remover
 */
function removeAntiLinksListener(client, handler) {
    if (handler) {
        client.removeListener(Events.MessageCreate, handler);
        console.log('[AntiLinks] Listener removido');
    }
}

/**
 * Exportación de funciones públicas
 */
module.exports = {
    createAntiLinksListener,
    removeAntiLinksListener,
    hasAllowedRole,
    validateChannel
};
