const {
    SlashCommandBuilder,
    ActionRowBuilder,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
} = require("discord.js");
const { ADMIN_ROLE_ID, SORTEOS_CHANNEL_ID } = require("@/utils/constansUtil");

// Objeto en memoria para guardar sorteos activos
const sorteos = {};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sorteo")
        .setDescription("Crea un nuevo sorteo en el servidor")
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

            // Crear el modal para capturar datos del sorteo
            const modal = new ModalBuilder()
                .setCustomId('modal_sorteo')
                .setTitle('🎉 Crear Sorteo');

            const tituloInput = new TextInputBuilder()
                .setCustomId('sorteo_titulo')
                .setLabel('Título del sorteo')
                .setPlaceholder('Ejemplo: x1 REY - x1 KHOR - x1 DONPA+')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(256);

            const descripcionInput = new TextInputBuilder()
                .setCustomId('sorteo_descripcion')
                .setLabel('Descripción (opcional)')
                .setPlaceholder('Información adicional sobre el sorteo...')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(1024);

            const ganadoresInput = new TextInputBuilder()
                .setCustomId('sorteo_ganadores')
                .setLabel('Cantidad de ganadores')
                .setPlaceholder('Ejemplo: 3')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(2);

            const fechaInput = new TextInputBuilder()
                .setCustomId('sorteo_fecha')
                .setLabel('Fecha de finalización')
                .setPlaceholder('Formato: DD/MM/YYYY (Ej: 28/12/2025)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(10);

            const row1 = new ActionRowBuilder().addComponents(tituloInput);
            const row2 = new ActionRowBuilder().addComponents(descripcionInput);
            const row3 = new ActionRowBuilder().addComponents(ganadoresInput);
            const row4 = new ActionRowBuilder().addComponents(fechaInput);

            modal.addComponents(row1, row2, row3, row4);

            await interaction.showModal(modal);
        } catch (error) {
            console.error('[Sorteos] Error en comando /sorteo:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocurrió un error al procesar el comando.',
                    flags: 64
                }).catch(() => {});
            }
        }
    },

    async handleModal(interaction) {
        try {
            // Obtener valores del modal
            const titulo = interaction.fields.getTextInputValue('sorteo_titulo');
            const descripcion = interaction.fields.getTextInputValue('sorteo_descripcion') || null;
            const ganadoresStr = interaction.fields.getTextInputValue('sorteo_ganadores');
            const fechaStr = interaction.fields.getTextInputValue('sorteo_fecha');

            // Validar cantidad de ganadores
            const ganadores = parseInt(ganadoresStr);
            if (isNaN(ganadores) || ganadores < 1 || ganadores > 99) {
                return await interaction.reply({
                    content: '❌ La cantidad de ganadores debe ser un número entre 1 y 99.',
                    flags: 64
                });
            }

            // Parsear fecha (formato: DD/MM/YYYY) y usar hora actual
            const fechaMatch = fechaStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!fechaMatch) {
                return await interaction.reply({
                    content: '❌ Formato de fecha inválido. Use: DD/MM/YYYY (Ejemplo: 28/12/2025)',
                    flags: 64
                });
            }

            const [, dia, mes, anio] = fechaMatch;
            const ahora = new Date();
            const fechaFinalizacion = new Date(anio, mes - 1, dia, ahora.getHours(), ahora.getMinutes(), ahora.getSeconds());

            // Validar que la fecha sea futura
            if (fechaFinalizacion <= new Date()) {
                return await interaction.reply({
                    content: '❌ La fecha de finalización debe ser en el futuro.',
                    flags: 64
                });
            }

            // Formatear fecha para mostrar
            const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
            const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            
            const diaSemana = diasSemana[fechaFinalizacion.getDay()];
            const diaNum = fechaFinalizacion.getDate();
            const mesNombre = meses[fechaFinalizacion.getMonth()];
            const anioNum = fechaFinalizacion.getFullYear();
            const horaFormato = String(fechaFinalizacion.getHours()).padStart(2, '0');
            const minutoFormato = String(fechaFinalizacion.getMinutes()).padStart(2, '0');

            const fechaTexto = `${diaSemana}, ${diaNum} de ${mesNombre} de ${anioNum}, ${horaFormato}:${minutoFormato}`;

            // Calcular tiempo restante en días
            const diferenciaMilisegundos = fechaFinalizacion - ahora;
            const diferenciaDias = Math.ceil(diferenciaMilisegundos / (1000 * 60 * 60 * 24));

            // Crear el embed del sorteo
            let embedDescripcion = `🎊 **Hosteado por:** ${interaction.user}\n`;
            embedDescripcion += `⏰ **Termina:** ${fechaTexto} ( en ${diferenciaDias} días )\n`;
            embedDescripcion += `🏆 **Ganadores:** ${ganadores}\n`;
            embedDescripcion += `👥 **Participantes:** 0\n`;
            
            if (descripcion) {
                embedDescripcion += `\n${descripcion}\n`;
            }
            
            embedDescripcion += `\n**¡Participa ya!**`;

            const embed = new EmbedBuilder()
                .setTitle(titulo)
                .setDescription(embedDescripcion)
                .setColor('#00FF00')
                .setFooter({
                    text: interaction.guild.name,
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            // Botón de participar
            const botonParticipar = new ButtonBuilder()
                .setCustomId('sorteo_participar')
                .setLabel('Participar 🎉')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(botonParticipar);

            // Obtener el canal de sorteos
            const canal = await interaction.guild.channels.fetch(SORTEOS_CHANNEL_ID);
            
            if (!canal) {
                return await interaction.reply({
                    content: '❌ Error: No se pudo encontrar el canal de sorteos. Verifica la configuración.',
                    flags: 64
                });
            }

            // Enviar el embed al canal
            const mensaje = await canal.send({ embeds: [embed], components: [row] });

            // Guardar el sorteo en memoria
            const sorteoId = mensaje.id;
            sorteos[sorteoId] = {
                titulo,
                descripcion,
                ganadores,
                fechaFinalizacion,
                fechaTexto,
                diferenciaDias,
                participantes: new Set(),
                messageId: mensaje.id,
                channelId: canal.id,
                guildId: interaction.guild.id,
                creadorId: interaction.user.id,
                finalizado: false,
                timer: null
            };

            // Configurar timer para finalizar automáticamente
            const tiempoRestante = fechaFinalizacion - new Date();
            sorteos[sorteoId].timer = setTimeout(async () => {
                await this.finalizarSorteo(sorteoId, interaction.client);
            }, tiempoRestante);

            // Responder de forma invisible
            await interaction.deferUpdate();

        } catch (error) {
            console.error('[Sorteos] Error en handleModal:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocurrió un error al crear el sorteo.',
                    flags: 64
                }).catch(() => {});
            }
        }
    },

    async handleParticipar(interaction) {
        try {
            const sorteoId = interaction.message.id;
            const sorteo = sorteos[sorteoId];

            if (!sorteo) {
                return await interaction.reply({
                    content: '⚠️ Este sorteo ya no es válido o ha finalizado.',
                    flags: 64
                });
            }

            if (sorteo.finalizado) {
                return await interaction.reply({
                    content: '⚠️ Este sorteo ya ha finalizado.',
                    flags: 64
                });
            }

            const userId = interaction.user.id;

            // Verificar si ya está participando
            if (sorteo.participantes.has(userId)) {
                return await interaction.reply({
                    content: '⚠️ Ya estás participando en este sorteo.',
                    flags: 64
                });
            }

            // Agregar participante
            sorteo.participantes.add(userId);

            // Actualizar el embed
            let embedDescripcion = `🎊 **Hosteado por:** <@${sorteo.creadorId}>\n`;
            embedDescripcion += `⏰ **Termina:** ${sorteo.fechaTexto} ( en ${sorteo.diferenciaDias} días )\n`;
            embedDescripcion += `🏆 **Ganadores:** ${sorteo.ganadores}\n`;
            embedDescripcion += `👥 **Participantes:** ${sorteo.participantes.size}\n`;
            
            if (sorteo.descripcion) {
                embedDescripcion += `\n${sorteo.descripcion}\n`;
            }
            
            embedDescripcion += `\n**¡Participa ya!**`;

            const embedActualizado = EmbedBuilder.from(interaction.message.embeds[0])
                .setDescription(embedDescripcion);

            // Primero responder al usuario
            await interaction.reply({
                content: '✅ **¡Ya quedaste participando en el sorteo!**',
                flags: 64
            });

            // Luego actualizar el embed
            await interaction.message.edit({ embeds: [embedActualizado] });

        } catch (error) {
            console.error('[Sorteos] Error en handleParticipar:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Ocurrió un error al registrarte en el sorteo.',
                    flags: 64
                }).catch(() => {});
            }
        }
    },

    async finalizarSorteo(sorteoId, client) {
        try {
            const sorteo = sorteos[sorteoId];
            if (!sorteo || sorteo.finalizado) return;

            sorteo.finalizado = true;

            // Obtener el canal y el mensaje
            const canal = await client.channels.fetch(sorteo.channelId);
            if (!canal) return;

            const mensaje = await canal.messages.fetch(sorteo.messageId);
            if (!mensaje) return;

            // Deshabilitar el botón
            const botonDeshabilitado = ButtonBuilder.from(mensaje.components[0].components[0])
                .setDisabled(true);

            const rowDeshabilitado = new ActionRowBuilder().addComponents(botonDeshabilitado);

            // Seleccionar ganadores aleatorios
            const participantesArray = Array.from(sorteo.participantes);
            let ganadores = [];

            if (participantesArray.length === 0) {
                // Sin participantes
                const embedFinal = EmbedBuilder.from(mensaje.embeds[0])
                    .setColor('#FF0000')
                    .setDescription(`${mensaje.embeds[0].description}\n\n**❌ El sorteo ha finalizado sin participantes.**`);

                await mensaje.edit({ embeds: [embedFinal], components: [rowDeshabilitado] });
                await mensaje.reply('😢 **El sorteo ha finalizado sin participantes.**');

            } else if (participantesArray.length <= sorteo.ganadores) {
                // Todos ganan
                ganadores = participantesArray;

                const embedFinal = EmbedBuilder.from(mensaje.embeds[0])
                    .setColor('#FFD700');

                await mensaje.edit({ embeds: [embedFinal], components: [rowDeshabilitado] });

                const ganadoresMenciones = ganadores.map(id => `<@${id}>`).join(', ');
                await mensaje.reply(`🎊 **¡Sorteo finalizado!**\n\n🏆 **Ganadores:** ${ganadoresMenciones}\n\n¡Felicidades a todos los participantes! 🎉`);

            } else {
                // Sorteo normal
                const shuffled = participantesArray.sort(() => 0.5 - Math.random());
                ganadores = shuffled.slice(0, sorteo.ganadores);

                const embedFinal = EmbedBuilder.from(mensaje.embeds[0])
                    .setColor('#FFD700');

                await mensaje.edit({ embeds: [embedFinal], components: [rowDeshabilitado] });

                const ganadoresMenciones = ganadores.map(id => `<@${id}>`).join(', ');
                await mensaje.reply(`🎊 **¡Sorteo finalizado!**\n\n🏆 **Ganador(es):** ${ganadoresMenciones}\n\n¡Felicidades! 🎉`);
            }

            // Limpiar de memoria
            delete sorteos[sorteoId];

        } catch (error) {
            console.error('[Sorteos] Error finalizando sorteo:', error);
        }
    }
};