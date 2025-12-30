require('module-alias/register');
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

// Importar configuración de sistemas
const systemsConfig = require('@/config/systemsConfig');

// Cargar sistemas solo si están habilitados
const sugerencias = systemsConfig.loadSystem('sugerencias', '@/services/sugerencias/sugerencia');
const boostSystem = systemsConfig.loadSystem('boosts', '@/services/boosts/boost');
const bienvenidaSystem = systemsConfig.loadSystem('bienvenidas', '@/services/bienvenidas/bienvenida');
const encuestaSystem = systemsConfig.loadSystem('encuestas', '@/services/encuestas/encuesta');
const actualizacionesSystem = systemsConfig.loadSystem('actualizaciones', '@/services/actualizaciones/actualizaciones');
const sorteosSystem = systemsConfig.loadSystem('sorteos', '@/services/sorteos/sorteos');
const tiendaSystem = systemsConfig.loadSystem('tienda', '@/services/tienda/tienda_Alertas');
const { iniciarEstados, detenerEstados } = require('@/services/estado/estado');

// Importar comandos simples
const tiendaCommand = require('@/commands/tienda');
const ipCommand = require('@/commands/ip');

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

// Variable global para guardar referencia de tienda
let tiendaAlertasInstance = null;

client.once('clientReady', async () => {
    console.log(`✅ Bot conectado como: ${client.user.tag}`);
    
    // Mostrar info de sistemas
    const info = systemsConfig.getInfo();
    console.log(`[SystemsConfig] 📊 Sistemas activos: ${info.enabledCount}/${info.totalSystems}`);
    console.log(`[SystemsConfig] ✅ Activos: ${info.enabled.join(', ')}`);
    if (info.disabled.length > 0) {
        console.log(`[SystemsConfig] ⏸️ Desactivados: ${info.disabled.join(', ')}`);
    }
    
    // Sistema de tienda (si está habilitado)
    if (systemsConfig.isEnabled('tienda') && tiendaSystem) {
        const TiendaAlertas = tiendaSystem;
        tiendaAlertasInstance = new TiendaAlertas(client);
        tiendaAlertasInstance.start();
    }

    // Sistema de sorteos - inicializar y restaurar sorteos activos
    if (systemsConfig.isEnabled('sorteos') && sorteosSystem) {
        await sorteosSystem.inicializarSorteos(client);
    }

    // Sistema de estados rotativos
    iniciarEstados(client);
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

// Handler para mensajes (opciones de encuesta y comandos con prefijo)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Manejar opciones de encuesta
    if (systemsConfig.isEnabled('encuestas') && encuestaSystem) {
        await encuestaSystem.handleMensajeOpcion(message);
    }

    // Manejar comandos con prefijo !
    if (message.content.startsWith('!')) {
        const args = message.content.slice(1).trim().split(/ +/);
        const commandName = args[0].toLowerCase();

        try {
            // Comando !tienda
            if (commandName === 'tienda') {
                const embed = await tiendaCommand.execute(null, true);
                if (embed) {
                    await message.reply({ embeds: [embed] });
                }
                return;
            }

            // Comando !ip
            if (commandName === 'ip') {
                const embed = await ipCommand.execute(null, true);
                if (embed) {
                    await message.reply({ embeds: [embed] });
                }
                return;
            }
        } catch (error) {
            console.error('[Bot] Error ejecutando comando con prefijo:', error);
            await message.reply('❌ Ocurrió un error al ejecutar el comando.').catch(() => {});
        }
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

        // ===== COMANDOS SIMPLES =====
        // Comando /tienda
        if (interaction.isChatInputCommand() && interaction.commandName === 'tienda') {
            return await tiendaCommand.execute(interaction);
        }

        // Comando /ip
        if (interaction.isChatInputCommand() && interaction.commandName === 'ip') {
            return await ipCommand.execute(interaction);
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

// Manejar cierre graceful del bot
async function cerrarBot(signal) {
    console.log(`\n[Bot] Señal ${signal} recibida. Cerrando aplicación...`);
    
    try {
        // Detener estados rotativos
        detenerEstados();
        
        // Cerrar servidor de webhooks si está activo
        if (tiendaAlertasInstance) {
            await tiendaAlertasInstance.stop();
        }
        
        // Desconectar cliente de Discord
        await client.destroy();
        
        console.log('[Bot] Aplicación cerrada correctamente');
        process.exit(0);
    } catch (error) {
        console.error('[Bot] Error al cerrar aplicación:', error);
        process.exit(1);
    }
}

// Capturar señales de cierre
process.on('SIGINT', () => cerrarBot('SIGINT'));  // Ctrl+C
process.on('SIGTERM', () => cerrarBot('SIGTERM')); // Kill
process.on('SIGHUP', () => cerrarBot('SIGHUP'));   // Terminal cerrada

// Inicializar sistema de sugerencias (siempre se carga, pero se verifica estado en runtime)
if (sugerencias) {
    sugerencias(client);
}

client.login(process.env.BOT_TOKEN);