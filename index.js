require('module-alias/register');
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

// Importar configuración de sistemas
const systemsConfig = require('@/config/systemsConfig');

// Cargar sistemas solo si están habilitados
const sugerencias = systemsConfig.loadSystem('sugerencias', '@/systems/sugerencias/sugerencia');
const informacionSystem = systemsConfig.loadSystem('informacion', '@/systems/informacion/informacion');
const boostSystem = systemsConfig.loadSystem('boosts', '@/systems/boosts/boost');
const bienvenidaSystem = systemsConfig.loadSystem('bienvenidas', '@/systems/bienvenidas/bienvenida');
const encuestaSystem = systemsConfig.loadSystem('encuestas', '@/systems/encuestas/encuesta');
const actualizacionesSystem = systemsConfig.loadSystem('actualizaciones', '@/systems/actualizaciones/actualizaciones');
const sorteosSystem = systemsConfig.loadSystem('sorteos', '@/systems/sorteos/sorteos');
const tiendaSystem = systemsConfig.loadSystem('tienda', '@/systems/tienda/tienda_Alertas');

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

client.once('clientReady', async () => {
    console.log(`✅ Bot conectado como: ${client.user.tag}`);
    
    // Mostrar info de sistemas
    const info = systemsConfig.getInfo();
    console.log(`[SystemsConfig] 📊 Sistemas activos: ${info.enabledCount}/${info.totalSystems}`);
    console.log(`[SystemsConfig] ✅ Activos: ${info.enabled.join(', ')}`);
    if (info.disabled.length > 0) {
        console.log(`[SystemsConfig] ⏸️ Desactivados: ${info.disabled.join(', ')}`);
    }

    // Sistema de información
    if (systemsConfig.isEnabled('informacion') && informacionSystem?.enviarInformacionSiNoExiste) {
        await informacionSystem.enviarInformacionSiNoExiste(client);
    }
    
    // Sistema de tienda (si está habilitado)
    if (systemsConfig.isEnabled('tienda') && tiendaSystem) {
        const TiendaAlertas = tiendaSystem;
        const tiendaAlertas = new TiendaAlertas(client);
        tiendaAlertas.start();
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (systemsConfig.isEnabled('boosts') && boostSystem) {
        await boostSystem.execute(oldMember, newMember);
    }
});

client.on('guildMemberAdd', async (member) => {
    if (systemsConfig.isEnabled('bienvenidas') && bienvenidaSystem) {
        await bienvenidaSystem.execute(member);
    }
});

// Handler para mensajes (opciones de encuesta)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Manejar opciones de encuesta
    if (systemsConfig.isEnabled('encuestas') && encuestaSystem) {
        await encuestaSystem.handleMensajeOpcion(message);
    }
});

// Handler para interacciones (comandos slash, botones, modales, select menus)
client.on('interactionCreate', async (interaction) => {
    try {
        // ===== SISTEMA DE SORTEOS =====
        if (systemsConfig.isEnabled('sorteos') && sorteosSystem) {
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
        }

        // ===== SISTEMA DE ACTUALIZACIONES =====
        if (systemsConfig.isEnabled('actualizaciones') && actualizacionesSystem) {
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
        }

        // ===== SISTEMA DE ENCUESTAS =====
        if (systemsConfig.isEnabled('encuestas') && encuestaSystem) {
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
        }

        // ===== COMANDO DE RELOADCONFIG =====
        // Este comando siempre está activo para permitir gestión
        if (interaction.isChatInputCommand() && interaction.commandName === 'reloadconfig') {
            const reloadConfigCommand = require('@/commands/deploys/reloadconfig');
            return await reloadConfigCommand.execute(interaction);
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

// Inicializar sistema de sugerencias (siempre se carga, pero se verifica estado en runtime)
if (sugerencias) {
    sugerencias(client);
}

client.login(process.env.BOT_TOKEN);