/**
 * ════════════════════════════════════════════════════════════════════════════
 * ANTILINKS SYSTEM - Punto de Entrada Principal
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Este archivo actúa como el punto de entrada único del sistema AntiLinks.
 * Se integra con el sistema de configuración del bot.
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const { Events } = require('discord.js');
const { analyzeMessage } = require('./antilinks.detector');
const { recordLinkAttempt } = require('./antilinks.cache');
const { executeAntiLinkAction } = require('./antilinks.handler');
const { initAutoCleanup, clearAllCache } = require('./antilinks.cache');
const systemsConfig = require('../../config/systemsConfig');

// Variable para almacenar la configuración
let antiLinksConfig = null;

// Variable para almacenar el intervalo de limpieza
let cleanupInterval = null;

// Variable para saber si el sistema está inicializado
let initialized = false;

/**
 * Carga la configuración desde el archivo JSON
 * 
 * @returns {Object} - Configuración cargada
 */
function loadConfig() {
    try {
        const configPath = path.join(__dirname, 'antilinks.config.json');
        const configData = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configData);
        
        if (!config.antilinks) {
            throw new Error('Configuración inválida: falta el objeto "antilinks"');
        }
        
        return config;
        
    } catch (error) {
        console.error('[AntiLinks] Error al cargar configuración:', error.message);
        
        // Devolver configuración por defecto
        return {
            antilinks: {
                allowedChannels: [],
                blockedChannels: [],
                allowedRoles: [],
                allowedDomains: [
                    "youtube.com",
                    "youtu.be",
                    "twitch.tv",
                    "twitter.com",
                    "github.com"
                ],
                blockedDomains: [
                    "instagram.com",
                    "roblox.com",
                    "bit.ly",
                    "tinyurl.com",
                    "discord.gg"
                ],
                blockedFileTypes: [
                    ".gif"
                ],
                deleteMessage: true,
                warnUser: true
            }
        };
    }
}

/**
 * Guarda la configuración actual en el archivo JSON
 * 
 * @param {Object} config - Configuración a guardar
 * @returns {boolean} - true si se guardó exitosamente
 */
function saveConfig(config) {
    try {
        const configPath = path.join(__dirname, 'antilinks.config.json');
        const configData = JSON.stringify(config, null, 2);
        fs.writeFileSync(configPath, configData, 'utf-8');
        return true;
    } catch (error) {
        console.error('[AntiLinks] Error al guardar configuración:', error.message);
        return false;
    }
}

/**
 * Verifica si un miembro tiene algún rol permitido (excepción)
 */
function hasAllowedRole(member, allowedRoles) {
    if (!member || !Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        return false;
    }
    return allowedRoles.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Valida si se debe actuar en un canal específico
 */
function validateChannel(channelId, allowedChannels = [], blockedChannels = []) {
    if (allowedChannels.includes(channelId)) {
        return { allowed: true, shouldAct: false };
    }
    if (blockedChannels.includes(channelId)) {
        return { allowed: false, shouldAct: true };
    }
    return { allowed: false, shouldAct: false };
}

/**
 * Handler principal del evento messageCreate
 * Esta función será llamada por el index.js principal
 */
async function handleMessage(message, client) {
    try {
        // Validaciones básicas
        if (message.author.bot) return;
        if (!message.guild) return;
        
        // Verificar si el sistema está habilitado usando systemsConfig
        if (!systemsConfig.isEnabled('antilinks')) {
            return;
        }
        
        if (!antiLinksConfig) return;

        // Verificar excepción por rol
        if (hasAllowedRole(message.member, antiLinksConfig.antilinks.allowedRoles)) {
            return;
        }

        // ═══════════════════════════════════════════════════════════
        // NUEVA VALIDACIÓN: Detectar archivos bloqueados
        // ═══════════════════════════════════════════════════════════
        if (message.attachments.size > 0 && antiLinksConfig.antilinks.blockedFileTypes) {
            const blockedFileTypes = antiLinksConfig.antilinks.blockedFileTypes;
            
            for (const attachment of message.attachments.values()) {
                const fileName = attachment.name.toLowerCase();
                
                // Verificar si el archivo tiene una extensión bloqueada
                const hasBlockedExtension = blockedFileTypes.some(ext => 
                    fileName.endsWith(ext.toLowerCase())
                );
                
                if (hasBlockedExtension) {
                    // Crear análisis simple para archivos
                    const fileAnalysis = {
                        hasLinks: false,
                        linksCount: 0,
                        links: [],
                        domains: [],
                        hasBlockedLinks: false,
                        blockedLinks: [],
                        allowedLinks: [],
                        detectedIPs: [],
                        hasIPs: false,
                        obfuscatedLinks: [],
                        hasObfuscation: false,
                        isBlockedFile: true,
                        blockedFile: {
                            name: attachment.name,
                            type: attachment.contentType,
                            size: attachment.size,
                            url: attachment.url
                        }
                    };
                    
                    await executeAntiLinkAction({
                        message,
                        config: antiLinksConfig.antilinks,
                        analysis: fileAnalysis,
                        isSpam: false,
                        client
                    });
                    
                    return; // Salir después de detectar archivo bloqueado
                }
            }
        }

        // Analizar el mensaje para detectar enlaces (con whitelist)
        const analysis = analyzeMessage(
            message.content,
            antiLinksConfig.antilinks.blockedDomains,
            antiLinksConfig.antilinks.allowedDomains || []
        );

        // Si no hay enlaces, no hacer nada
        if (!analysis.hasLinks) return;
        
        // Si todos los enlaces están en la whitelist, permitirlos
        if (analysis.allowedLinks.length > 0 && !analysis.hasBlockedLinks) {
            return;
        }

        // Validar configuración de canales
        const channelValidation = validateChannel(
            message.channel.id,
            antiLinksConfig.antilinks.allowedChannels,
            antiLinksConfig.antilinks.blockedChannels
        );

        // Si el canal está permitido o no debe actuar, salir
        if (channelValidation.allowed || !channelValidation.shouldAct) {
            return;
        }

        // Si hay enlaces pero no son de dominios bloqueados, verificar spam
        if (!analysis.hasBlockedLinks) {
            const isSpam = recordLinkAttempt(message.author.id);
            
            if (isSpam) {
                await executeAntiLinkAction({
                    message,
                    config: antiLinksConfig.antilinks,
                    analysis,
                    isSpam: true,
                    client
                });
            }
            return;
        }

        // Dominio bloqueado detectado - ejecutar acción
        const isSpam = recordLinkAttempt(message.author.id);

        await executeAntiLinkAction({
            message,
            config: antiLinksConfig.antilinks,
            analysis,
            isSpam: isSpam,
            client
        });

    } catch (error) {
        console.error('[AntiLinks] Error procesando mensaje:', error);
    }
}

/**
 * Inicializa el sistema AntiLinks
 * 
 * @param {Client} client - Cliente de Discord
 */
function initAntiLinks(client) {
    try {
        if (initialized) {
            console.log('[AntiLinks] Sistema ya inicializado');
            return;
        }

        // Verificar si el sistema está habilitado en systemsConfig
        if (!systemsConfig.isEnabled('antilinks')) {
            console.log('[AntiLinks] ⏸️ Sistema desactivado en systemsConfig');
            return;
        }

        // Cargar configuración
        antiLinksConfig = loadConfig();

        // Iniciar sistema de limpieza automática del caché
        cleanupInterval = initAutoCleanup();

        initialized = true;
        console.log('[AntiLinks] Sistema inicializado correctamente');

    } catch (error) {
        console.error('[AntiLinks] Error fatal al inicializar:', error);
    }
}

/**
 * Detiene el sistema AntiLinks
 */
function stopAntiLinks() {
    try {
        // Limpiar el intervalo de limpieza
        if (cleanupInterval) {
            clearInterval(cleanupInterval);
            cleanupInterval = null;
        }
        
        // Limpiar el caché completamente
        clearAllCache();
        
        // Resetear estado
        initialized = false;
        antiLinksConfig = null;
        
        console.log('[AntiLinks] Sistema detenido correctamente');
        return true;
    } catch (error) {
        console.error('[AntiLinks] Error al detener sistema:', error);
        return false;
    }
}

/**
 * Recarga la configuración del sistema
 */
function reloadConfig() {
    try {
        antiLinksConfig = loadConfig();
        console.log('[AntiLinks] Configuración recargada');
        return true;
    } catch (error) {
        console.error('[AntiLinks] Error al recargar configuración:', error);
        return false;
    }
}

/**
 * Obtiene la configuración actual
 */
function getConfig() {
    return antiLinksConfig;
}

/**
 * Actualiza la configuración
 */
function updateConfig(newConfig) {
    try {
        if (!antiLinksConfig) {
            throw new Error('Sistema no inicializado');
        }

        antiLinksConfig.antilinks = {
            ...antiLinksConfig.antilinks,
            ...newConfig
        };

        return saveConfig(antiLinksConfig);
    } catch (error) {
        console.error('[AntiLinks] Error al actualizar configuración:', error);
        return false;
    }
}

/**
 * Exportación de funciones públicas
 */
module.exports = {
    initAntiLinks,
    stopAntiLinks,
    handleMessage,
    reloadConfig,
    getConfig,
    updateConfig,
    loadConfig,
    saveConfig
};
