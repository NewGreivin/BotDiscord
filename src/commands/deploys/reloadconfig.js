const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const systemsConfig = require('@/config/systemsConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reloadconfig')
        .setDescription('Recarga la configuración de sistemas del bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('reload')
                .setDescription('Recarga la configuración desde el archivo')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Muestra información de los sistemas y su estado')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Activa o desactiva un sistema')
                .addStringOption(option =>
                    option
                        .setName('sistema')
                        .setDescription('Nombre del sistema a modificar')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Sugerencias', value: 'sugerencias' },
                            { name: 'Información', value: 'informacion' },
                            { name: 'Boosts', value: 'boosts' },
                            { name: 'Bienvenidas', value: 'bienvenidas' },
                            { name: 'Encuestas', value: 'encuestas' },
                            { name: 'Actualizaciones', value: 'actualizaciones' },
                            { name: 'Sorteos', value: 'sorteos' },
                            { name: 'Tienda', value: 'tienda' }
                        )
                )
                .addBooleanOption(option =>
                    option
                        .setName('activar')
                        .setDescription('true = activar, false = desactivar')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'reload':
                    await this.handleReload(interaction);
                    break;
                case 'info':
                    await this.handleInfo(interaction);
                    break;
                case 'toggle':
                    await this.handleToggle(interaction);
                    break;
            }
        } catch (error) {
            console.error('[ReloadConfig] Error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription('Ocurrió un error al ejecutar el comando')
                .setTimestamp();

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    async handleReload(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const success = systemsConfig.reload();
        const info = systemsConfig.getInfo();

        const embed = new EmbedBuilder()
            .setColor(success ? '#00ff00' : '#ff0000')
            .setTitle(success ? '✅ Configuración Recargada' : '❌ Error al Recargar')
            .setDescription(
                success 
                    ? '✅ La configuración se ha recargado en memoria.\n\n' +
                      '⚡ **Nota:** Los cambios se aplican instantáneamente gracias a que cada sistema verifica su estado en tiempo real leyendo el archivo directamente.\n\n' +
                      '💡 **Esto significa:** Puedes activar/desactivar sistemas con `/reloadconfig toggle` y los cambios son inmediatos, sin necesidad de este comando.'
                    : '❌ No se pudo recargar la configuración. Revisa los logs.'
            )
            .addFields(
                { name: '📊 Total de Sistemas', value: `${info.totalSystems}`, inline: true },
                { name: '✅ Activados', value: `${info.enabledCount}`, inline: true },
                { name: '⏸️ Desactivados', value: `${info.disabledCount}`, inline: true },
                { name: '🕐 Última Actualización', value: `<t:${Math.floor(new Date(info.lastUpdate).getTime() / 1000)}:R>`, inline: false }
            )
            .setFooter({ text: `Versión: ${info.version} | Cambios instantáneos sin reiniciar` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleInfo(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const info = systemsConfig.getInfo();
        const systems = info.systems;

        // Crear lista de sistemas con su estado
        let systemsList = '';
        for (const [name, data] of Object.entries(systems)) {
            const icon = data.enabled ? '✅' : '⏸️';
            const status = data.enabled ? 'Activo' : 'Desactivado';
            systemsList += `${icon} **${name.charAt(0).toUpperCase() + name.slice(1)}**: ${status}\n`;
            systemsList += `   └ ${data.description}\n\n`;
        }

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('⚙️ Configuración de Sistemas')
            .setDescription(systemsList || 'No hay sistemas configurados')
            .addFields(
                { name: '📊 Estadísticas', value: `Total: ${info.totalSystems} | Activos: ${info.enabledCount} | Desactivados: ${info.disabledCount}`, inline: false },
                { name: '🕐 Última Actualización', value: `<t:${Math.floor(new Date(info.lastUpdate).getTime() / 1000)}:R>`, inline: true },
                { name: '📦 Versión', value: info.version, inline: true }
            )
            .setFooter({ text: 'Usa /reloadconfig toggle para cambiar el estado de un sistema' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleToggle(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const systemName = interaction.options.getString('sistema');
        const enable = interaction.options.getBoolean('activar');

        try {
            systemsConfig.setEnabled(systemName, enable);

            const embed = new EmbedBuilder()
                .setColor(enable ? '#00ff00' : '#ffa500')
                .setTitle(enable ? '✅ Sistema Activado' : '⏸️ Sistema Desactivado')
                .setDescription(
                    `El sistema **${systemName}** ha sido ${enable ? '**activado**' : '**desactivado**'}.\n\n` +
                    `${enable 
                        ? '✅ El sistema está activo y responderá a eventos **inmediatamente**.' 
                        : '⏸️ El sistema está desactivado y NO responderá a eventos **desde ya**.'
                    }\n\n` +
                    `⚡ **Los cambios son instantáneos** - No es necesario hacer reload ni reiniciar el bot.`
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription(`No se pudo modificar el sistema: ${error.message}`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }
};
