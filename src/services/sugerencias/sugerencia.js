const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    codeBlock
} = require('discord.js');
const { TROFEO, TORRE_DE_REGALOS, AVEJA } = require('@/utils/emojiUtil');
const { crearEmbed } = require('@/utils/embedUtil');
const { loadCounter, saveCounter } = require('@/utils/counterUtil');
const {
    SUGERENCIAS_CHANNEL_ID,
    APROBACION_CHANNEL_ID,
    APROBADAS_CHANNEL_ID,
    DENEGADAS_CHANNEL_ID,
    ADMIN_ROLE_ID
} = require('@/utils/constansUtil');
const systemsConfig = require('@/config/systemsConfig');

// Objeto separado para almacenar votos (no contamina objetos Message de Discord.js)
const votosDeUsuarios = {}; // { messageId: { userId: 'like' | 'dislike' } }

// L\u00edmite de sugerencias en memoria (previene crecimiento indefinido)
const MAX_SUGERENCIAS_EN_MEMORIA = 100;

/**
 * Limpia votos antiguos si se excede el l\u00edmite
 */
function limpiarVotosAntiguos() {
    const messageIds = Object.keys(votosDeUsuarios);
    if (messageIds.length > MAX_SUGERENCIAS_EN_MEMORIA) {
        // Eliminar las m\u00e1s antiguas (primeras en el objeto)
        const aEliminar = messageIds.length - MAX_SUGERENCIAS_EN_MEMORIA;
        for (let i = 0; i < aEliminar; i++) {
            delete votosDeUsuarios[messageIds[i]];
        }
    }
}

module.exports = (client) => {
    let suggestionCounter = loadCounter();

    client.on('messageCreate', async (message) => {
        // Ignorar mensajes de bots
        if (message.author.bot) return;
        
        // Solo procesar mensajes del canal de sugerencias
        if (message.channel.id !== SUGERENCIAS_CHANNEL_ID) return;
        
        // Verificar si el sistema está habilitado
        if (!systemsConfig.isEnabled('sugerencias')) {
            await message.delete().catch(() => {});
            return;
        }

        suggestionCounter++;
        saveCounter(suggestionCounter);

        // Embed inicial (utilizamos util)
        const embedSugerenciaUsuario = crearEmbed(
            `🚀 NUEVA SUGERENCIA - #${suggestionCounter}`,
            `Bienvenido al canal de <#${SUGERENCIAS_CHANNEL_ID}>.\n Escribe tu sugerencia para que todos puedan votar.\n👤 ¡Gracias por tu sugerencia <@${message.author.id}>!`,
            0xA259FF
        ).addFields({ name: '💡 Sugerencia:', value: codeBlock(message.content) });

        // Botones de votos
        const actionRowSugerencias = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('like')
                .setLabel(`Like (0)`)
                .setStyle(ButtonStyle.Success)
                .setEmoji(TROFEO),
            new ButtonBuilder()
                .setCustomId('dislike')
                .setLabel(`Dislike (0)`)
                .setStyle(ButtonStyle.Danger)
                .setEmoji(TORRE_DE_REGALOS),
            new ButtonBuilder()
                .setCustomId('ver_votantes')
                .setLabel('¿Quién ha votado?')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(AVEJA)
        );

        const sentMessage = await message.channel.send({
            embeds: [embedSugerenciaUsuario],
            components: [actionRowSugerencias]
        });
        
        // Inicializar votos para esta sugerencia
        votosDeUsuarios[sentMessage.id] = {};
        limpiarVotosAntiguos();

        await sentMessage.startThread({
            name: `Sugerencia #${suggestionCounter}`,
            autoArchiveDuration: 1440
        });

        await message.delete();

        // Embed de aprobación
        const embedAprobacion = crearEmbed(
            `🚀 NUEVA SUGERENCIA - #${suggestionCounter}`,
            `¡Sugerencia enviada por <@${message.author.id}>!`,
            0xA259FF
        ).addFields({ name: '💡 Sugerencia:', value: codeBlock(message.content) });

        const actionRowAprobacion = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`aprobar_${suggestionCounter}`)
                .setLabel('Aprobar')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`denegar_${suggestionCounter}`)
                .setLabel('Denegar')
                .setStyle(ButtonStyle.Danger)
        );

        const aprobacionChannel = client.channels.cache.get(APROBACION_CHANNEL_ID);
        if (aprobacionChannel) {
            await aprobacionChannel.send({
                embeds: [embedAprobacion],
                components: [actionRowAprobacion]
            });
        }
    });

    // Evento unificado: Interacciones (botones y modals)
    client.on('interactionCreate', async (interaction) => {
        // Verificar si el sistema está habilitado
        if (!systemsConfig.isEnabled('sugerencias')) return;

        // ===== MANEJO DE BOTONES =====
        if (interaction.isButton()) {
            const [action, id] = interaction.customId.split('_');
            const userId = interaction.user.id;
            const message = interaction.message;
            const messageId = message.id;

            // Inicializar votos para este mensaje si no existen
            if (!votosDeUsuarios[messageId]) {
                votosDeUsuarios[messageId] = {};
            }

            // ---- Like/Dislike ----
            if (action === 'like' || action === 'dislike') {
                const userVote = votosDeUsuarios[messageId][userId];

                if (action === 'like') {
                    if (userVote === 'like') delete votosDeUsuarios[messageId][userId];
                    else votosDeUsuarios[messageId][userId] = 'like';
                } else {
                    if (userVote === 'dislike') delete votosDeUsuarios[messageId][userId];
                    else votosDeUsuarios[messageId][userId] = 'dislike';
                }

                const likeCount = Object.values(votosDeUsuarios[messageId]).filter(v => v === 'like').length;
                const dislikeCount = Object.values(votosDeUsuarios[messageId]).filter(v => v === 'dislike').length;

                const updatedRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('like')
                        .setLabel(`Like (${likeCount})`)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(TROFEO),
                    new ButtonBuilder()
                        .setCustomId('dislike')
                        .setLabel(`Dislike (${dislikeCount})`)
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji(TORRE_DE_REGALOS),
                    new ButtonBuilder()
                        .setCustomId('ver_votantes')
                        .setLabel('¿Quién ha votado?')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(AVEJA)
                );

                await interaction.update({ components: [updatedRow] });
                return;
            }

            // ---- Aprobar/Denegar ----
            if (action === 'aprobar' || action === 'denegar') {
                const member = await interaction.guild.members.fetch(userId);
                if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
                    await interaction.reply({ content: '❌ No tienes permisos suficientes.', flags: 64 });
                    return;
                }

                // Crear modal para solicitar motivo
                const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
                
                const modal = new ModalBuilder()
                    .setCustomId(`${action}_modal_${id}`)
                    .setTitle(action === 'aprobar' ? 'Aprobar Sugerencia' : 'Denegar Sugerencia');

                const motivoInput = new TextInputBuilder()
                    .setCustomId('motivo')
                    .setLabel('Motivo')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder(action === 'aprobar' ? 'Ingresa el motivo de la aprobación...' : 'Ingresa el motivo de la denegación...')
                    .setRequired(true)
                    .setMinLength(5)
                    .setMaxLength(500);

                const row = new ActionRowBuilder().addComponents(motivoInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
                return;
            }

            // ---- Ver votantes ----
            if (interaction.customId === 'ver_votantes') {
                const messageId = message.id;
                const votos = votosDeUsuarios[messageId] || {};
                
                const votantesLike = Object.keys(votos)
                    .filter(uid => votos[uid] === 'like')
                    .map(uid => `<@${uid}>`)
                    .join(', ') || 'Nadie';

                const votantesDislike = Object.keys(votos)
                    .filter(uid => votos[uid] === 'dislike')
                    .map(uid => `<@${uid}>`)
                    .join(', ') || 'Nadie';

                const respuesta = `**Votantes de Like:**\n${votantesLike}\n\n**Votantes de Dislike:**\n${votantesDislike}`;

                if (!interaction.replied) {
                    await interaction.reply({ content: respuesta, flags: 64 });
                }
                return;
            }
        }

        // ===== MANEJO DE MODALS =====
        if (interaction.isModalSubmit()) {
            const customId = interaction.customId;
            if (!customId.includes('_modal_')) return;

            const [action, , id] = customId.split('_');
            if (action !== 'aprobar' && action !== 'denegar') return;

            try {
                const motivo = interaction.fields.getTextInputValue('motivo');
                
                const color = action === 'aprobar' ? 0x00FF00 : 0xFF0000;
                const title = action === 'aprobar' ? '✅ Sugerencia Aprobada' : '❌ Sugerencia Denegada';
                const description = action === 'aprobar'
                    ? `¡Sugerencia aceptada por <@${interaction.user.id}>!`
                    : `¡Sugerencia denegada por <@${interaction.user.id}>!`;

                const embed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor(color)
                    .setTitle(title)
                    .setDescription(description)
                    .addFields({ name: '📝 Motivo:', value: codeBlock(motivo) });

                const targetChannelId = action === 'aprobar' ? APROBADAS_CHANNEL_ID : DENEGADAS_CHANNEL_ID;
                const targetChannel = client.channels.cache.get(targetChannelId);

                if (!targetChannel) {
                    await interaction.reply({ 
                        content: `❌ Error: No se encontró el canal de destino.`, 
                        flags: 64 
                    });
                    return;
                }

                await targetChannel.send({ embeds: [embed] });
                await interaction.message.delete();
                await interaction.reply({ 
                    content: `✅ Sugerencia #${id} ${action === 'aprobar' ? 'aprobada' : 'denegada'}.`, 
                    flags: 64 
                });
            } catch (error) {
                console.error('[Sugerencias] Error al procesar modal:', error);
                if (!interaction.replied) {
                    await interaction.reply({ 
                        content: `❌ Error al procesar la sugerencia: ${error.message}`, 
                        flags: 64 
                    });
                }
            }
        }
    });
};