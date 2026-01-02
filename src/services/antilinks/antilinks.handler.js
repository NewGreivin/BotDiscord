/**
 * ════════════════════════════════════════════════════════════════════════════
 * ANTILINKS HANDLER - Manejo Simplificado de Acciones
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Eliminar mensajes con enlaces no permitidos
 * - Enviar advertencia por DM al usuario
 * - Registrar actividad en logs (opcional)
 * - NO aplicar sanciones (baneos, timeouts, etc.)
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

const { EmbedBuilder } = require('discord.js');

/**
 * Ejecuta las acciones cuando se detecta un enlace no permitido
 * 
 * ACCIONES:
 * 1. Eliminar el mensaje
 * 2. Enviar advertencia al usuario por DM
 * 3. Registrar en logs (opcional)
 * 
 * NO SE APLICAN SANCIONES (ban, timeout, etc.)
 * 
 * @param {Object} params - Parámetros de la acción
 * @param {Message} params.message - Mensaje que contiene el enlace
 * @param {Object} params.config - Configuración del antilinks
 * @param {Object} params.analysis - Análisis del mensaje (de detector)
 * @param {boolean} [params.isSpam=false] - Si la detección fue por spam
 * @param {Client} params.client - Cliente de Discord
 */
async function executeAntiLinkAction({ message, config, analysis, isSpam = false, client }) {
    try {
        const { author, guild, channel } = message;
        
        // Información para logs
        const actionInfo = {
            userId: author.id,
            userName: author.tag,
            channelId: channel.id,
            channelName: channel.name,
            guildId: guild.id,
            guildName: guild.name,
            messageContent: message.content.substring(0, 100), // Primeros 100 caracteres
            detectedLinks: analysis.links || [],
            blockedDomains: analysis.blockedLinks?.map(bl => bl.domain) || [],
            isSpam: isSpam,
            hasIPs: analysis.hasIPs || false,
            hasObfuscation: analysis.hasObfuscation || false,
            isBlockedFile: analysis.isBlockedFile || false,
            blockedFile: analysis.blockedFile || null,
            timestamp: new Date().toISOString()
        };

        // 1. ELIMINAR EL MENSAJE (si está configurado)
        if (config.deleteMessage) {
            await deleteMessage(message, actionInfo);
        }

        // 2. ADVERTIR AL USUARIO POR DM (si está configurado)
        if (config.warnUser) {
            await warnUser(author, actionInfo, isSpam);
        }

        return { success: true, actionInfo };

    } catch (error) {
        console.error('[AntiLinks Handler] Error ejecutando acción:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Elimina el mensaje que contiene enlaces no permitidos
 * 
 * @param {Message} message - Mensaje a eliminar
 * @param {Object} actionInfo - Información de la acción
 */
async function deleteMessage(message, actionInfo) {
    try {
        await message.delete();
    } catch (error) {
        // El mensaje puede haber sido eliminado ya, o faltan permisos
        if (error.code === 10008) {
            console.log('[AntiLinks] El mensaje ya no existe');
        } else if (error.code === 50013) {
            console.error('[AntiLinks] Sin permisos para eliminar mensajes en:', actionInfo.channelName);
        } else {
            console.error('[AntiLinks] Error al eliminar mensaje:', error);
        }
    }
}

/**
 * Envía una advertencia al usuario por DM
 * 
 * @param {User} user - Usuario a advertir
 * @param {Object} actionInfo - Información de la acción
 * @param {boolean} isSpam - Si fue detectado como spam
 */
async function warnUser(user, actionInfo, isSpam) {
    try {
        // Preparar información sobre el tipo de enlace detectado
        let detectionType = '🔗 Enlaces no permitidos';
        let detectionDetails = [];
        
        if (actionInfo.isBlockedFile) {
            detectionType = '📎 Archivo Bloqueado';
            detectionDetails.push(`**Tipo de archivo no permitido:** \`${actionInfo.blockedFile?.name || 'archivo'}\``);
            detectionDetails.push('**Razón:** Los archivos GIF no están permitidos en este servidor');
        } else if (actionInfo.blockedDomains.length > 0) {
            detectionDetails.push(`**Dominios bloqueados:** ${actionInfo.blockedDomains.map(d => `\`${d}\``).join(', ')}`);
        }
        
        if (actionInfo.hasIPs) {
            detectionDetails.push('**Dirección IP detectada**');
        }
        
        if (actionInfo.hasObfuscation) {
            detectionDetails.push('**Enlaces ofuscados detectados** (espacios, caracteres especiales)');
        }
        
        if (isSpam) {
            detectionType = '⚠️ Spam de enlaces detectado';
            detectionDetails.push('**Múltiples enlaces enviados en poco tiempo**');
        }
        
        // Crear embed de advertencia
        const warnEmbed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('⚠️ Advertencia - Sistema AntiLinks')
            .setDescription(
                actionInfo.isBlockedFile
                    ? `Tu mensaje ha sido **eliminado automáticamente** por contener un archivo no permitido.`
                    : `Tu mensaje ha sido **eliminado automáticamente** por contener enlaces no permitidos.`
            )
            .addFields(
                { 
                    name: '📍 Servidor', 
                    value: actionInfo.guildName, 
                    inline: true 
                },
                { 
                    name: '💬 Canal', 
                    value: `#${actionInfo.channelName}`, 
                    inline: true 
                },
                {
                    name: detectionType,
                    value: detectionDetails.join('\n') || 'Contenido detectado en tu mensaje',
                    inline: false
                },
                {
                    name: 'ℹ️ Información',
                    value: '• Esta es solo una **advertencia**\n' +
                           '• No recibirás sanciones adicionales\n' +
                           (actionInfo.isBlockedFile 
                               ? '• Evita enviar archivos GIF en este servidor\n'
                               : '• Evita enviar enlaces no permitidos\n') +
                           '• Si tienes dudas, contacta a un moderador',
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Sistema de Protección AntiLinks' });

        // Enviar DM al usuario
        await user.send({ embeds: [warnEmbed] });

    } catch (error) {
        // El usuario puede tener DMs desactivados - error silencioso
        if (error.code !== 50007) {
            console.error('[AntiLinks] Error al enviar advertencia:', error);
        }
    }
}

/**
 * Registra la acción en el canal de logs
 * 
 * @param {Client} client - Cliente de Discord
 * @param {Guild} guild - Servidor donde ocurrió
 * @param {string} logChannelId - ID del canal de logs
 * @param {Object} actionInfo - Información de la acción
 * @param {boolean} isSpam - Si fue spam
 */
async function logAction(client, guild, logChannelId, actionInfo, isSpam) {
    try {
        // Obtener el canal de logs
        const logChannel = await guild.channels.fetch(logChannelId);
        
        if (!logChannel || !logChannel.isTextBased()) {
            console.error('[AntiLinks] Canal de logs no válido:', logChannelId);
            return;
        }

        // Determinar color y tipo de detección
        let embedColor = '#FFA500';
        let detectionType = '🔗 Enlaces Bloqueados';
        
        if (actionInfo.isBlockedFile) {
            embedColor = '#FF1744';
            detectionType = '📎 Archivo Bloqueado (.gif)';
        } else if (isSpam) {
            embedColor = '#FF4444';
            detectionType = '⚠️ Spam de Enlaces';
        } else if (actionInfo.hasIPs) {
            embedColor = '#FF0000';
            detectionType = '🚫 Dirección IP Detectada';
        } else if (actionInfo.hasObfuscation) {
            embedColor = '#FF6600';
            detectionType = '🔍 Enlaces Ofuscados';
        }

        // Crear embed de log
        const logEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle('🛡️ AntiLinks - Mensaje Eliminado')
            .setDescription(`**${detectionType}**`)
            .addFields(
                { 
                    name: '👤 Usuario', 
                    value: `<@${actionInfo.userId}> (${actionInfo.userName})`, 
                    inline: true 
                },
                { 
                    name: '💬 Canal', 
                    value: `<#${actionInfo.channelId}>`, 
                    inline: true 
                },
                { 
                    name: '🕒 Hora', 
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`, 
                    inline: true 
                },
                {
                    name: '📝 Contenido del mensaje',
                    value: `\`\`\`${actionInfo.messageContent}${actionInfo.messageContent.length >= 100 ? '...' : ''}\`\`\``,
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({ text: `ID Usuario: ${actionInfo.userId}` });

        // Agregar información de enlaces detectados
        if (actionInfo.detectedLinks.length > 0) {
            const linksText = actionInfo.detectedLinks
                .slice(0, 5) // Máximo 5 enlaces
                .map(link => `• \`${link.substring(0, 50)}${link.length > 50 ? '...' : ''}\``)
                .join('\n');
            
            logEmbed.addFields({
                name: '🔗 Enlaces Detectados',
                value: linksText + (actionInfo.detectedLinks.length > 5 ? `\n...y ${actionInfo.detectedLinks.length - 5} más` : ''),
                inline: false
            });
        }

        // Agregar dominios bloqueados
        if (actionInfo.blockedDomains.length > 0) {
            logEmbed.addFields({
                name: '🚫 Dominios Bloqueados',
                value: actionInfo.blockedDomains.map(d => `\`${d}\``).join(', '),
                inline: false
            });
        }

        // Agregar badges especiales
        const badges = [];
        if (actionInfo.isBlockedFile) badges.push('📎 Archivo GIF');
        if (actionInfo.hasIPs) badges.push('🌐 IP');
        if (actionInfo.hasObfuscation) badges.push('🔍 Ofuscado');
        if (isSpam) badges.push('⚡ Spam');
        
        if (badges.length > 0) {
            logEmbed.addFields({
                name: '🏷️ Tipos de Detección',
                value: badges.join(' • '),
                inline: false
            });
        }
        
        // Agregar información del archivo si fue bloqueado
        if (actionInfo.isBlockedFile && actionInfo.blockedFile) {
            logEmbed.addFields({
                name: '📎 Archivo Bloqueado',
                value: `**Nombre:** \`${actionInfo.blockedFile.name}\`\n` +
                       `**Tipo:** \`${actionInfo.blockedFile.type || 'desconocido'}\`\n` +
                       `**Tamaño:** \`${(actionInfo.blockedFile.size / 1024).toFixed(2)} KB\``,
                inline: false
            });
        }

        // Enviar log
        await logChannel.send({ embeds: [logEmbed] });
        console.log(`[AntiLinks] ✅ Log registrado en canal: ${logChannel.name}`);

    } catch (error) {
        console.error('[AntiLinks] ❌ Error al enviar log:', error);
    }
}

/**
 * Envía una notificación cuando un usuario intenta enviar enlaces repetidamente
 * (función auxiliar para casos especiales)
 * 
 * @param {Channel} channel - Canal donde enviar la notificación
 * @param {User} user - Usuario que hizo spam
 */
async function notifySpamAttempt(channel, user) {
    try {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setDescription(`⚠️ ${user} ha sido detectado enviando múltiples enlaces. Mensaje eliminado.`)
            .setTimestamp();

        const notification = await channel.send({ embeds: [embed] });
        
        // Auto-eliminar la notificación después de 10 segundos
        setTimeout(async () => {
            try {
                await notification.delete();
            } catch (err) {
                // Ignorar errores si el mensaje ya no existe
            }
        }, 10000);

    } catch (error) {
        console.error('[AntiLinks] Error al enviar notificación de spam:', error);
    }
}

/**
 * Exportación de funciones públicas
 */
module.exports = {
    executeAntiLinkAction,
    notifySpamAttempt
};
