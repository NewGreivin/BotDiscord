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
            '🚀 NUEVA SUGERENCIA',
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

        await sentMessage.startThread({
            name: `Sugerencia #${suggestionCounter}`,
            autoArchiveDuration: 1440
        });

        await message.delete();

        // Embed de aprobación
        const embedAprobacion = crearEmbed(
            '🚀 NUEVA SUGERENCIA',
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

    // Evento: Interacciones de botones
    client.on('interactionCreate', async (interaction) => {
        // Verificar si el sistema está habilitado
        if (!systemsConfig.isEnabled('sugerencias')) return;
        if (!interaction.isButton()) return;

        const [action, id] = interaction.customId.split('_');
        const userId = interaction.user.id;
        const message = interaction.message;

        if (!message.userVotes) {
            message.userVotes = {};
        }

        // ---- Like/Dislike ----
        if (action === 'like' || action === 'dislike') {
            const userVote = message.userVotes[userId];

            if (action === 'like') {
                if (userVote === 'like') delete message.userVotes[userId];
                else message.userVotes[userId] = 'like';
            } else {
                if (userVote === 'dislike') delete message.userVotes[userId];
                else message.userVotes[userId] = 'dislike';
            }

            const likeCount = Object.values(message.userVotes).filter(v => v === 'like').length;
            const dislikeCount = Object.values(message.userVotes).filter(v => v === 'dislike').length;

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
                await interaction.reply({ content: '❌ No tienes permisos suficientes.', ephemeral: true });
                return;
            }

            try {
                const color = action === 'aprobar' ? 0x00FF00 : 0xFF0000;
                const title = action === 'aprobar' ? '✅ Sugerencia Aprobada' : '❌ Sugerencia Denegada';
                const description = action === 'aprobar'
                    ? `¡Sugerencia aceptada por <@${interaction.user.id}>!`
                    : `¡Sugerencia denegada por <@${interaction.user.id}>!`;

                const embed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor(color)
                    .setTitle(title)
                    .setDescription(description);

                const targetChannelId = action === 'aprobar' ? APROBADAS_CHANNEL_ID : DENEGADAS_CHANNEL_ID;
                const targetChannel = client.channels.cache.get(targetChannelId);

                if (!targetChannel) {
                    await interaction.reply({ 
                        content: `❌ Error: No se encontró el canal de destino.`, 
                        ephemeral: true 
                    });
                    return;
                }

                await targetChannel.send({ embeds: [embed] });
                await interaction.message.delete();
                await interaction.reply({ 
                    content: `✅ Sugerencia #${id} ${action === 'aprobar' ? 'aprobada' : 'denegada'}.`, 
                    ephemeral: true 
                });
            } catch (error) {
                console.error('[Sugerencias] Error al aprobar/denegar:', error);
                await interaction.reply({ 
                    content: `❌ Error al procesar la sugerencia: ${error.message}`, 
                    ephemeral: true 
                });
            }
        }

        // ---- Ver votantes ----
        if (interaction.customId === 'ver_votantes') {
            const votantesLike = Object.keys(message.userVotes)
                .filter(uid => message.userVotes[uid] === 'like')
                .map(uid => `<@${uid}>`)
                .join(', ') || 'Nadie';

            const votantesDislike = Object.keys(message.userVotes)
                .filter(uid => message.userVotes[uid] === 'dislike')
                .map(uid => `<@${uid}>`)
                .join(', ') || 'Nadie';

            const respuesta = `**Votantes de Like:**\n${votantesLike}\n\n**Votantes de Dislike:**\n${votantesDislike}`;

            if (!interaction.replied) {
                await interaction.reply({ content: respuesta, ephemeral: true });
            }
        }
    });
};