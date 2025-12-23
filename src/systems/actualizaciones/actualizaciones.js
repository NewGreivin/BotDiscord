const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
} = require("discord.js");
const { ADMIN_ROLE_ID, ACTUALIZACIONES_CHANNEL_ID } = require("@/utils/constansUtil");
const { ARROW_EMOJI } = require("@/utils/emojiUtil");

// Objeto temporal para guardar el tipo de cambio seleccionado por usuario
const tempData = {};

// Mapeo de colores según tipo de cambio
const TIPO_COLORES = {
    'nuevo': '#00FF00',           // Verde
    'actualizacion': '#FFFF00',   // Amarillo
    'mejora': '#00BFFF',          // Celeste
    'eliminacion': '#FF0000',     // Rojo
    'solucion': '#FF69B4'         // Rosado
};

// Mapeo de labels para mostrar en el embed
const TIPO_LABELS = {
    'nuevo': 'Nuevo',
    'actualizacion': 'Actualización',
    'mejora': 'Mejora',
    'eliminacion': 'Eliminación',
    'solucion': 'Solución de Errores'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("cambios")
        .setDescription("Publica un registro de cambios en el canal de actualizaciones")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Validar que el usuario tenga el rol de administrador
            const member = interaction.member;
            if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
                return await interaction.reply({
                    content: '❌ No tienes permisos para ejecutar este comando. Se requiere el rol de administrador.',
                    flags: 64 // ephemeral
                });
            }

            // Crear el select menu con tipos de cambio
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('tipo_cambio_select')
                .setPlaceholder('Selecciona el tipo de cambio')
                .addOptions([
                    {
                        label: 'Nuevo',
                        value: 'nuevo',
                        emoji: '🆕',
                        description: 'Nueva característica o contenido'
                    },
                    {
                        label: 'Actualización',
                        value: 'actualizacion',
                        emoji: '🔄',
                        description: 'Actualización de contenido existente'
                    },
                    {
                        label: 'Mejora',
                        value: 'mejora',
                        emoji: '⬆️',
                        description: 'Mejora o optimización'
                    },
                    {
                        label: 'Eliminación',
                        value: 'eliminacion',
                        emoji: '🗑️',
                        description: 'Eliminación de contenido'
                    },
                    {
                        label: 'Solución de Errores',
                        value: 'solucion',
                        emoji: '🔧',
                        description: 'Corrección de bugs o errores'
                    }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('📝 Registro de Cambios - Paso 1')
                .setDescription('**Selecciona el tipo de cambio que deseas registrar:**\n\n' +
                    '🆕 **Nuevo** - Nueva característica o contenido\n' +
                    '🔄 **Actualización** - Actualización de contenido existente\n' +
                    '⬆️ **Mejora** - Mejora u optimización\n' +
                    '🗑️ **Eliminación** - Eliminación de contenido\n' +
                    '🔧 **Solución de Errores** - Corrección de bugs')
                .setColor('#5865F2');

            // Enviar mensaje ephemeral (solo visible para el usuario)
            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: 64 // ephemeral
            });
        } catch (error) {
            console.error('[Actualizaciones] Error en comando /cambios:', error);
            
            // Intentar responder con error
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocurrió un error al procesar el comando.',
                    flags: 64
                }).catch(() => {});
            }
        }
    },

    async handleTipoCambioSelect(interaction) {
        try {
            const tipoCambio = interaction.values[0];
            const userId = interaction.user.id;

            // Guardar el tipo de cambio seleccionado temporalmente
            tempData[userId] = { tipo: tipoCambio };

            // Crear y mostrar el modal
            const modal = new ModalBuilder()
                .setCustomId('modal_cambios')
                .setTitle('📝 Registro de Cambios - Paso 2');

            const modalidadInput = new TextInputBuilder()
                .setCustomId('cambios_modalidad')
                .setLabel('Modalidad')
                .setPlaceholder('Ejemplo: Survival, SkyBlock, Global, Network...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100);

            const descripcionInput = new TextInputBuilder()
                .setCustomId('cambios_descripcion')
                .setLabel('Descripción de cambios')
                .setPlaceholder('Formato:\n- Cambio #1\n- Cambio #2\n- Cambio #3')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(4000);

            const row1 = new ActionRowBuilder().addComponents(modalidadInput);
            const row2 = new ActionRowBuilder().addComponents(descripcionInput);

            modal.addComponents(row1, row2);

            await interaction.showModal(modal);
        } catch (error) {
            console.error('[Actualizaciones] Error en handleTipoCambioSelect:', error);
        }
    },

    async handleModal(interaction) {
        try {
            const userId = interaction.user.id;
            const tempUserData = tempData[userId];

            if (!tempUserData) {
                return await interaction.reply({
                    content: '❌ Error: No se encontró la información temporal. Por favor, intenta nuevamente.',
                    flags: 64
                });
            }

            // Obtener valores del modal
            const modalidad = interaction.fields.getTextInputValue('cambios_modalidad');
            const descripcionRaw = interaction.fields.getTextInputValue('cambios_descripcion');

            // Procesar la descripción: reemplazar "-" al inicio de línea por el emoji personalizado
            const descripcionProcesada = descripcionRaw
                .split('\n')
                .map(linea => {
                    const lineaTrim = linea.trim();
                    if (lineaTrim.startsWith('-')) {
                        return lineaTrim.replace(/^-\s*/, `${ARROW_EMOJI} `);
                    }
                    return lineaTrim;
                })
                .filter(linea => linea.length > 0)
                .join('\n');

            const tipoCambio = tempUserData.tipo;
            const colorEmbed = TIPO_COLORES[tipoCambio];
            const labelTipo = TIPO_LABELS[tipoCambio];

            // Obtener la fecha y hora actual
            const ahora = new Date();
            const dia = String(ahora.getDate()).padStart(2, '0');
            const mes = String(ahora.getMonth() + 1).padStart(2, '0');
            const anio = ahora.getFullYear();
            const hora = String(ahora.getHours()).padStart(2, '0');
            const minutos = String(ahora.getMinutes()).padStart(2, '0');
            const fechaHora = `${dia}/${mes}/${anio} ${hora}:${minutos}`;

            // Crear el embed de actualizaciones
            const embedActualizacion = new EmbedBuilder()
                .setTitle('📊 Registro de Cambio')
                .setDescription(`**Modalidad:** ${modalidad} [${labelTipo}]\n\n${descripcionProcesada}`)
                .setColor(colorEmbed)
                .setFooter({
                    text: `${interaction.guild.name} - ${fechaHora}`,
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                });

            // Obtener el canal de actualizaciones
            const canal = await interaction.guild.channels.fetch(ACTUALIZACIONES_CHANNEL_ID);
            
            if (!canal) {
                delete tempData[userId];
                return await interaction.reply({
                    content: '❌ Error: No se pudo encontrar el canal de actualizaciones. Verifica la configuración.',
                    flags: 64
                });
            }

            // Enviar el embed al canal de actualizaciones
            await canal.send({ embeds: [embedActualizacion] });

            // Limpiar datos temporales
            delete tempData[userId];

            // Responder al modal de forma silenciosa
            await interaction.deferUpdate();

        } catch (error) {
            console.error('[Actualizaciones] Error en handleModal:', error);
            
            // Limpiar datos temporales en caso de error
            if (interaction.user) {
                delete tempData[interaction.user.id];
            }

            // Intentar responder con error
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocurrió un error al publicar el registro de cambios.',
                    flags: 64
                }).catch(() => {});
            }
        }
    }
};
