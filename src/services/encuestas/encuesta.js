const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const { ENCUESTAS_CHANNEL_ID } = require('@/utils/constansUtil');

// Objeto en memoria para guardar encuestas y configuraciones temporales
const encuestas = {};
const tempConfig = {};
const tempConfigTimers = {}; // Timers para limpiar datos abandonados

// Tiempo de expiración para datos temporales (10 minutos)
const TEMP_CONFIG_TIMEOUT = 10 * 60 * 1000;

/**
 * Limpia configuración temporal de un usuario
 */
function limpiarTempConfig(userId) {
    if (tempConfigTimers[userId]) {
        clearTimeout(tempConfigTimers[userId]);
        delete tempConfigTimers[userId];
    }
    delete tempConfig[userId];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("encuestacrear")
        .setDescription("Abre un formulario para crear una encuesta personalizada"),

    async execute(interaction) {
        // Validar que el comando se use en el canal correcto
        if (interaction.channelId !== ENCUESTAS_CHANNEL_ID) {
            return await interaction.reply({
                content: `❌ Este comando solo puede usarse en <#${ENCUESTAS_CHANNEL_ID}>`,
                flags: 64
            });
        }

        // Paso 1: Mostrar selector de duración
        const embed = new EmbedBuilder()
            .setTitle('📊 Crear Encuesta - Paso 1')
            .setDescription('**Selecciona la duración de la encuesta:**\n\nDespués de elegir, podrás configurar las opciones.')
            .setColor('#00AEEF');

        const selectDuracion = new StringSelectMenuBuilder()
            .setCustomId('duracion_select')
            .setPlaceholder('Elige la duración')
            .addOptions([
                { label: '1 hora', value: '1h', emoji: '⏰' },
                { label: '3 horas', value: '3h', emoji: '⏰' },
                { label: '6 horas', value: '6h', emoji: '⏰' },
                { label: '12 horas', value: '12h', emoji: '⏰' },
                { label: '1 día', value: '1d', emoji: '📅' },
                { label: '2 días', value: '2d', emoji: '📅' },
                { label: '3 días', value: '3d', emoji: '📅' },
                { label: '4 días', value: '4d', emoji: '📅' },
                { label: '5 días', value: '5d', emoji: '📅' },
                { label: '6 días', value: '6d', emoji: '📅' },
                { label: '7 días', value: '7d', emoji: '📅' },
                { label: '15 días', value: '15d', emoji: '📅' },
                { label: '30 días', value: '30d', emoji: '📅' }
            ]);

        const row = new ActionRowBuilder().addComponents(selectDuracion);
        await interaction.reply({ embeds: [embed], components: [row], flags: 64 }); // 64 = ephemeral
    },

    async handleDuracionSelect(interaction) {
        const duracion = interaction.values[0];
        const userId = interaction.user.id;
        
        // Limpiar timer anterior si existe
        if (tempConfigTimers[userId]) {
            clearTimeout(tempConfigTimers[userId]);
        }
        
        // Guardar la duración temporalmente
        tempConfig[userId] = { 
            duracion,
            opciones: [],
            estado: 'esperando_opciones',
            channelId: interaction.channelId
        };
        
        // Configurar timer para limpiar datos si el usuario no completa el flujo
        tempConfigTimers[userId] = setTimeout(() => {
            limpiarTempConfig(userId);
        }, TEMP_CONFIG_TIMEOUT);

        // Crear embed con instrucciones
        const embed = new EmbedBuilder()
            .setTitle('📊 Crear Encuesta - Paso 2')
            .setDescription('**Escribe las opciones de la encuesta en el chat:**\n\n' +
                '✨ Usa los emojis personalizados del servidor\n' +
                '📝 Escribe una opción por mensaje\n' +
                '💡 Formato: `emoji Texto de la opción`\n\n' +
                '**Ejemplo:**\n' +
                ':minecraft_heart: Me encanta\n' +
                ':minecraft_sword: Está bien\n' +
                ':minecraft_creeper: No me gusta\n\n' +
                '**Cuando termines, presiona el botón "✅ Listo"**')
            .setColor('#00AEEF')
            .setFooter({ text: 'Mínimo 2 opciones, máximo 10' });

        const botonListo = new ButtonBuilder()
            .setCustomId('encuesta_opciones_listo')
            .setLabel('✅ Listo, continuar')
            .setStyle(ButtonStyle.Success);

        const botonCancelar = new ButtonBuilder()
            .setCustomId('encuesta_cancelar')
            .setLabel('❌ Cancelar')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(botonListo, botonCancelar);

        await interaction.update({ embeds: [embed], components: [row] });
    },

    async handleOpcionesListo(interaction) {
        const config = tempConfig[interaction.user.id];
        
        if (!config || config.opciones.length < 2) {
            return interaction.reply({ 
                content: '⚠️ Debes escribir al menos 2 opciones en el chat antes de continuar.', 
                flags: 64
            });
        }

        if (config.opciones.length > 10) {
            return interaction.reply({ 
                content: '⚠️ Máximo 10 opciones permitidas.', 
                flags: 64
            });
        }

        // Cambiar estado
        config.estado = 'esperando_modal';

        // Abrir modal directamente
        const modal = new ModalBuilder()
            .setCustomId('modal_encuesta')
            .setTitle('📊 Crear Encuesta - Paso 3');

        const rows = [
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('encuesta_pregunta')
                    .setLabel('Pregunta de la encuesta')
                    .setPlaceholder('¿Cuál es tu opinión sobre el servidor?')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(256)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('encuesta_descripcion')
                    .setLabel('Descripción')
                    .setPlaceholder('Ayúdanos a mejorar con tu feedback')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(1024)
            )
        ];

        modal.addComponents(...rows);
        
        // Mostrar modal
        await interaction.showModal(modal);
    },

    async handleCancelar(interaction) {
        limpiarTempConfig(interaction.user.id);
        await interaction.update({ 
            embeds: [new EmbedBuilder()
                .setTitle('❌ Encuesta cancelada')
                .setDescription('La creación de la encuesta ha sido cancelada.')
                .setColor('#FF0000')],
            components: []
        });
    },

    async handleMensajeOpcion(message) {
        const config = tempConfig[message.author.id];
        
        if (!config || config.estado !== 'esperando_opciones') return;
        if (config.channelId !== message.channelId) return;

        try {
            // Extraer emoji y texto
            const contenido = message.content.trim();
            
            // Buscar emojis Unicode o personalizados
            const emojiMatch = contenido.match(/^(<a?:\w+:\d+>|[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])/u);
            
            let emoji = null;
            let texto = contenido;
            
            if (emojiMatch) {
                emoji = emojiMatch[0];
                texto = contenido.slice(emoji.length).trim();
            }

            if (!texto) {
                const reply = await message.reply('⚠️ La opción debe tener texto además del emoji.');
                setTimeout(() => reply.delete().catch(() => {}), 3000);
                setTimeout(() => message.delete().catch(() => {}), 100);
                return;
            }

            // Guardar opción y eliminar inmediatamente
            config.opciones.push({ emoji, texto });
            await message.delete().catch(() => {});
            
            // Si ya tiene el máximo, avisar
            if (config.opciones.length >= 10) {
                const aviso = await message.channel.send('⚠️ Has alcanzado el máximo de 10 opciones. Presiona "✅ Listo" para continuar.');
                setTimeout(() => aviso.delete().catch(() => {}), 5000);
            }
        } catch (error) {
            console.error('[Encuesta] Error guardando opción:', error);
        }
    },

    async handleModal(interaction) {
        const pregunta = interaction.fields.getTextInputValue('encuesta_pregunta');
        const descripcion = interaction.fields.getTextInputValue('encuesta_descripcion');
        
        // Obtener la configuración guardada
        const config = tempConfig[interaction.user.id];
        
        if (!config || !config.opciones || config.opciones.length < 2) {
            return interaction.reply({ 
                content: '⚠️ Error: No se encontraron las opciones guardadas.', 
                flags: 64
            });
        }

        const duracion = config.duracion;
        const opciones = config.opciones;
        
        // Limpiar configuración temporal y timer
        limpiarTempConfig(interaction.user.id);

        // Embed inicial (antes de crear la encuesta)
        const embed = new EmbedBuilder()
            .setTitle("📊 Encuesta")
            .setDescription(`**${pregunta}**\n\n${descripcion}\n\n${opciones.map(op => `${op.emoji ? op.emoji + ' ' : ''}${op.texto} (0 votos)`).join("\n")}`)
            .setColor("#00AEEF")
            .setFooter({ text: `Duración: ${duracion}` });

        // Generar ID temporal para el select menu
        const tempId = Date.now().toString();
        
        // Menú desplegable
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`encuesta_${tempId}`)
            .setPlaceholder("Elige una opción")
            .addOptions(
                opciones.map((op, index) => ({
                    label: op.texto.slice(0, 100),
                    value: `${index}`,
                    emoji: op.emoji || undefined
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        // Enviar al canal directamente (sin vincular al modal)
        const mensaje = await interaction.channel.send({ embeds: [embed], components: [row] });
        
        // Responder al modal de forma invisible
        await interaction.reply({ content: '✅ Encuesta creada correctamente.', flags: 64 });

        // Inicializar encuesta en memoria usando el ID del mensaje enviado
        const encuestaId = mensaje.id;
        encuestas[encuestaId] = {
            pregunta,
            descripcion,
            opciones,
            votos: Array(opciones.length).fill(0),
            usuarios: {},
            duracion,
            timer: null,
            messageId: mensaje.id
        };

        // Actualizar el customId del select menu con el ID real del mensaje
        const updatedSelectMenu = new StringSelectMenuBuilder()
            .setCustomId(`encuesta_${encuestaId}`)
            .setPlaceholder("Elige una opción")
            .addOptions(
                opciones.map((op, index) => ({
                    label: op.texto.slice(0, 100),
                    value: `${index}`,
                    emoji: op.emoji || undefined
                }))
            );
        
        const updatedRow = new ActionRowBuilder().addComponents(updatedSelectMenu);
        await mensaje.edit({ components: [updatedRow] });

        // Configurar timer de finalización (todas las encuestas tienen duración definida)
        let ms;
        if (duracion.endsWith("s")) ms = parseInt(duracion) * 1000;
        else if (duracion.endsWith("m")) ms = parseInt(duracion) * 60 * 1000;
        else if (duracion.endsWith("h")) ms = parseInt(duracion) * 60 * 60 * 1000;
        else if (duracion.endsWith("d")) ms = parseInt(duracion) * 24 * 60 * 60 * 1000;

        if (ms) {
            encuestas[encuestaId].timer = setTimeout(async () => {
                const encuesta = encuestas[encuestaId];
                
                if (!encuesta) return; // Por si ya fue eliminada
                
                // Deshabilitar componentes
                const disabledSelectMenu = StringSelectMenuBuilder.from(mensaje.components[0].components[0])
                    .setDisabled(true);
                
                const disabledRow = new ActionRowBuilder().addComponents(disabledSelectMenu);
                await mensaje.edit({ components: [disabledRow] }).catch(() => {});

                // Calcular ganador(es)
                const maxVotos = Math.max(...encuesta.votos);
                const ganadores = [];
                
                encuesta.opciones.forEach((op, i) => {
                    if (encuesta.votos[i] === maxVotos) {
                        ganadores.push({ opcion: op, votos: maxVotos });
                    }
                });

                // Crear embed de resultados
                let resultadoTexto;
                if (maxVotos === 0) {
                    resultadoTexto = '¡Nadie votó en esta encuesta! 😢';
                } else if (ganadores.length === 1) {
                    const ganador = ganadores[0];
                    resultadoTexto = `${ganador.opcion.emoji ? ganador.opcion.emoji + ' ' : ''}**${ganador.opcion.texto}**\n\n🏆 Ganador con ${ganador.votos} votos`;
                } else {
                    resultadoTexto = '**Empate entre:**\n\n' + ganadores.map(g => 
                        `${g.opcion.emoji ? g.opcion.emoji + ' ' : ''}${g.opcion.texto}`
                    ).join('\n') + `\n\n🏆 Cada uno con ${maxVotos} votos`;
                }

                const resultadoEmbed = new EmbedBuilder()
                    .setTitle('🏁 Encuesta Finalizada')
                    .setDescription(`**${encuesta.pregunta}**\n\n${resultadoTexto}`)
                    .setColor('#FFD700')
                    .setTimestamp();

                await mensaje.reply({ embeds: [resultadoEmbed] }).catch(() => {});
                
                // Limpiar encuesta de memoria después de finalizar
                delete encuestas[encuestaId];
            }, ms);
        }
    },

    async handleVote(interaction) {
        const encuestaId = interaction.customId.replace("encuesta_", "");
        const encuesta = encuestas[encuestaId];
        if (!encuesta) return interaction.reply({ content: "⚠️ Esta encuesta ya no es válida.", flags: 64 });

        const opcionIndex = parseInt(interaction.values[0]);
        const userId = interaction.user.id;

        if (encuesta.usuarios[userId] !== undefined) {
            encuesta.votos[encuesta.usuarios[userId]]--;
        }

        encuesta.usuarios[userId] = opcionIndex;
        encuesta.votos[opcionIndex]++;

        const total = encuesta.votos.reduce((a, b) => a + b, 0);

        let descripcion = `**${encuesta.pregunta}**\n\n${encuesta.descripcion}\n\n`;
        encuesta.opciones.forEach((op, i) => {
            const votos = encuesta.votos[i];
            descripcion += `${op.emoji ? op.emoji + ' ' : ''}${op.texto} (${votos} votos)\n`;
        });

        const embed = new EmbedBuilder()
            .setTitle("📊 Encuesta")
            .setDescription(descripcion)
            .setColor("#00AEEF")
            .setFooter({ text: `Duración: ${encuesta.duracion}` });

        await interaction.update({ embeds: [embed] });
    }
};
