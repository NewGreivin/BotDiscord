require('module-alias/register');
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const sugerencias = require('@/systems/sugerencias/sugerencia');
const { enviarInformacionSiNoExiste } = require('@/systems/informacion/informacion');
const boostSystem = require('@/systems/boosts/boost');
const bienvenidaSystem = require('@/systems/bienvenidas/bienvenida');
const encuestaSystem = require('@/systems/encuestas/encuesta');
const actualizacionesSystem = require('@/systems/actualizaciones/actualizaciones');
const sorteosSystem = require('@/systems/sorteos/sorteos');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Reaction]
});

client.once('ready', async () => {
    console.log(`✅ Bot conectado como: ${client.user.tag}`);

    await enviarInformacionSiNoExiste(client);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    await boostSystem.execute(oldMember, newMember);
});

client.on('guildMemberAdd', async (member) => {
    await bienvenidaSystem.execute(member);
});

// Handler para mensajes (opciones de encuesta)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Manejar opciones de encuesta
    await encuestaSystem.handleMensajeOpcion(message);
});

// Handler para interacciones (comandos slash, botones, modales, select menus)
client.on('interactionCreate', async (interaction) => {
    try {
        // ===== SISTEMA DE SORTEOS =====
        // Comando /sorteo
        if (interaction.isChatInputCommand() && interaction.commandName === 'sorteo') {
            return await sorteosSystem.execute(interaction);
        }
        
        // Modal de sorteo
        if (interaction.isModalSubmit() && interaction.customId === 'modal_sorteo') {
            return await sorteosSystem.handleModal(interaction);
        }
        
        // Botón de participar
        if (interaction.isButton() && interaction.customId === 'sorteo_participar') {
            return await sorteosSystem.handleParticipar(interaction);
        }

        // ===== SISTEMA DE ACTUALIZACIONES =====
        // Comando /cambios
        if (interaction.isChatInputCommand() && interaction.commandName === 'cambios') {
            return await actualizacionesSystem.execute(interaction);
        }
        
        // Select menu de tipo de cambio
        if (interaction.isStringSelectMenu() && interaction.customId === 'tipo_cambio_select') {
            return await actualizacionesSystem.handleTipoCambioSelect(interaction);
        }
        
        // Modal de cambios
        if (interaction.isModalSubmit() && interaction.customId === 'modal_cambios') {
            return await actualizacionesSystem.handleModal(interaction);
        }

        // ===== SISTEMA DE ENCUESTAS =====
        // Comando /encuestacrear
        if (interaction.isChatInputCommand() && interaction.commandName === 'encuestacrear') {
            return await encuestaSystem.execute(interaction);
        }
        
        // Select menu de duración
        if (interaction.isStringSelectMenu() && interaction.customId === 'duracion_select') {
            return await encuestaSystem.handleDuracionSelect(interaction);
        }
        
        // Botón "Listo"
        if (interaction.isButton() && interaction.customId === 'encuesta_opciones_listo') {
            return await encuestaSystem.handleOpcionesListo(interaction);
        }
        
        // Botón "Cancelar"
        if (interaction.isButton() && interaction.customId === 'encuesta_cancelar') {
            return await encuestaSystem.handleCancelar(interaction);
        }
        
        // Modal final de encuesta
        if (interaction.isModalSubmit() && interaction.customId === 'modal_encuesta') {
            return await encuestaSystem.handleModal(interaction);
        }
        
        // Select menu de votación
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('encuesta_')) {
            return await encuestaSystem.handleVote(interaction);
        }
    } catch (error) {
        console.error('[Bot] Error manejando interacción:', error);
    }
});

// Manejar errores globales para que el bot no se caiga
client.on('error', (error) => {
    console.error('[Bot] Error del cliente:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('[Bot] Promesa rechazada no manejada:', error);
});

sugerencias(client);
client.login(process.env.BOT_TOKEN);