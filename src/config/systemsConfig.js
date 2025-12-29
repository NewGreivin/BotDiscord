const fs = require('fs');
const path = require('path');

/**
 * Clase para gestionar la configuración de sistemas del bot
 * Permite activar/desactivar sistemas sin reiniciar el bot
 */
class SystemsConfig {
    constructor() {
        this.configPath = path.join(__dirname, 'systems.json');
        this.config = this.loadConfig();
        this.systemsCache = {};
    }

    /**
     * Carga la configuración desde el archivo JSON
     * Si no existe, crea uno con valores por defecto
     */
    loadConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                this.createDefaultConfig();
            }
            const data = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('[SystemsConfig] Error al cargar configuración:', error);
            return this.getDefaultConfig();
        }
    }

    /**
     * Obtiene la configuración por defecto
     */
    getDefaultConfig() {
        return {
            systems: {
                sugerencias: {
                    enabled: true,
                    description: 'Sistema de sugerencias de usuarios'
                },
                boosts: {
                    enabled: true,
                    description: 'Sistema de notificaciones de boosts'
                },
                bienvenidas: {
                    enabled: true,
                    description: 'Sistema de mensajes de bienvenida'
                },
                encuestas: {
                    enabled: true,
                    description: 'Sistema de creación de encuestas'
                },
                actualizaciones: {
                    enabled: true,
                    description: 'Sistema de anuncios de cambios'
                },
                sorteos: {
                    enabled: true,
                    description: 'Sistema de sorteos'
                },
                tienda: {
                    enabled: false,
                    description: 'Sistema de alertas de tienda'
                }
            },
            lastUpdate: new Date().toISOString(),
            version: '1.0.0'
        };
    }

    /**
     * Crea el archivo de configuración por defecto
     */
    createDefaultConfig() {
        try {
            const defaultConfig = this.getDefaultConfig();
            fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 4), 'utf8');
            console.log('[SystemsConfig] ✅ Archivo de configuración creado en:', this.configPath);
        } catch (error) {
            console.error('[SystemsConfig] ❌ Error al crear archivo de configuración:', error);
        }
    }

    /**
     * Recarga la configuración desde el archivo
     */
    reload() {
        try {
            this.config = this.loadConfig();
            this.systemsCache = {}; // Limpiar caché
            console.log('[SystemsConfig] ✅ Configuración recargada correctamente');
            return true;
        } catch (error) {
            console.error('[SystemsConfig] ❌ Error al recargar configuración:', error);
            return false;
        }
    }

    /**
     * Verifica si un sistema está habilitado
     * @param {string} systemName - Nombre del sistema
     * @returns {boolean}
     */
    isEnabled(systemName) {
        // Siempre leer desde el archivo para obtener el valor más actualizado
        try {
            const data = fs.readFileSync(this.configPath, 'utf8');
            const config = JSON.parse(data);
            
            if (!config.systems[systemName]) {
                console.warn(`[SystemsConfig] ⚠️ Sistema "${systemName}" no encontrado en configuración`);
                return false;
            }
            return config.systems[systemName].enabled;
        } catch (error) {
            console.error('[SystemsConfig] Error al leer configuración:', error);
            // Fallback a la config en memoria
            if (!this.config.systems[systemName]) {
                return false;
            }
            return this.config.systems[systemName].enabled;
        }
    }

    /**
     * Activa o desactiva un sistema
     * @param {string} systemName - Nombre del sistema
     * @param {boolean} enabled - true para activar, false para desactivar
     */
    setEnabled(systemName, enabled) {
        if (!this.config.systems[systemName]) {
            throw new Error(`Sistema "${systemName}" no existe`);
        }
        
        this.config.systems[systemName].enabled = enabled;
        this.config.lastUpdate = new Date().toISOString();
        this.saveConfig();
    }

    /**
     * Guarda la configuración en el archivo
     */
    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 4), 'utf8');
            console.log('[SystemsConfig] ✅ Configuración guardada');
        } catch (error) {
            console.error('[SystemsConfig] ❌ Error al guardar configuración:', error);
            throw error;
        }
    }

    /**
     * Obtiene todos los sistemas y su estado
     */
    getAllSystems() {
        return this.config.systems;
    }

    /**
     * Obtiene información completa de la configuración
     */
    getInfo() {
        const systems = this.config.systems;
        const enabled = Object.keys(systems).filter(key => systems[key].enabled);
        const disabled = Object.keys(systems).filter(key => !systems[key].enabled);

        return {
            totalSystems: Object.keys(systems).length,
            enabledCount: enabled.length,
            disabledCount: disabled.length,
            enabled,
            disabled,
            lastUpdate: this.config.lastUpdate,
            version: this.config.version,
            systems
        };
    }

    /**
     * Carga un sistema dinámicamente si está habilitado
     * @param {string} systemName - Nombre del sistema
     * @param {string} modulePath - Ruta del módulo del sistema
     */
    loadSystem(systemName, modulePath) {
        if (!this.isEnabled(systemName)) {
            console.log(`[SystemsConfig] ⏸️ Sistema "${systemName}" desactivado`);
            return null;
        }

        try {
            // Si ya está en caché, devolverlo
            if (this.systemsCache[systemName]) {
                return this.systemsCache[systemName];
            }

            // Cargar el módulo
            const system = require(modulePath);
            this.systemsCache[systemName] = system;
            console.log(`[SystemsConfig] ✅ Sistema "${systemName}" cargado`);
            return system;
        } catch (error) {
            console.error(`[SystemsConfig] ❌ Error al cargar sistema "${systemName}":`, error);
            return null;
        }
    }

    /**
     * Recarga un sistema específico (borra caché y lo vuelve a cargar)
     * @param {string} systemName - Nombre del sistema
     * @param {string} modulePath - Ruta del módulo del sistema
     */
    reloadSystem(systemName, modulePath) {
        try {
            // Limpiar caché del require
            const resolvedPath = require.resolve(modulePath);
            delete require.cache[resolvedPath];
            delete this.systemsCache[systemName];

            // Recargar si está habilitado
            return this.loadSystem(systemName, modulePath);
        } catch (error) {
            console.error(`[SystemsConfig] ❌ Error al recargar sistema "${systemName}":`, error);
            return null;
        }
    }
}

// Exportar instancia única (Singleton)
module.exports = new SystemsConfig();
