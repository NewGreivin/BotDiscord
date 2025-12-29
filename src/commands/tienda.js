const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { SHOP_URL } = require('@/utils/constansUtil');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tienda')
        .setDescription('Muestra información sobre la tienda oficial del servidor'),

    async execute(interaction, returnEmbed = false) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🛒 INFORMACIÓN TIENDA')
                .setDescription(
                    `Llena una barra al **100%**\n` +
                    `**para realizar un evento especial**\n` +
                    `y también un **keyall**, donde daremos\n` +
                    `las mejores llaves y recompensas\n` +
                    `en el servidor.\n\n` +
                    `• **ENLACE:** ${SHOP_URL || 'https://tienda.minegold.us/'}`
                )
                .setTimestamp()
                .setFooter({ 
                    text: 'MineGold Network',
                    iconURL: interaction ? interaction.client.user.displayAvatarURL() : undefined
                });

            // Si se llama desde comando con prefijo, retornar el embed
            if (returnEmbed) {
                return embed;
            }

            // Si es slash command, responder normalmente
            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[Comando Tienda] Error:', error);
            
            if (interaction && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocurrió un error al mostrar la información de la tienda.',
                    flags: 64
                }).catch(() => {});
            }
            
            if (returnEmbed) {
                throw error;
            }
        }
    }
};
