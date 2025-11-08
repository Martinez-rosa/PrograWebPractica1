const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

/**
 * Configuración de la base de datos
 */
const dbConfig = {
    // URI de conexión a MongoDB
    mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/productos',
    
    // Opciones de conexión
    options: {
        serverSelectionTimeoutMS: 5000, // Timeout después de 5s en lugar de 30s
        socketTimeoutMS: 45000, // Cerrar sockets después de 45s de inactividad
        maxPoolSize: 10, // Mantener hasta 10 conexiones de socket
        heartbeatFrequencyMS: 10000, // Cada cuánto tiempo enviar un heartbeat
    }
};

/**
 * Función para conectar a MongoDB
 * @returns {Promise} Promesa de conexión
 */
const connectDB = async () => {
    try {
        console.log('🔄 Intentando conectar a MongoDB...');
        console.log('📍 URI:', dbConfig.mongoURI.replace(/\/\/.*@/, '//***:***@')); // Ocultar credenciales en logs
        
        const conn = await mongoose.connect(dbConfig.mongoURI, dbConfig.options);
        
        console.log('✅ Conectado a MongoDB exitosamente');
        console.log(`🏠 Host: ${conn.connection.host}`);
        console.log(`📊 Base de datos: ${conn.connection.name}`);
        
        return conn;
    } catch (error) {
        console.error('❌ Error al conectar a MongoDB:', error.message);
        
        // Mostrar información adicional del error
        if (error.code) {
            console.error(`🔢 Código de error: ${error.code}`);
        }
        
        // Reintentar conexión después de 5 segundos
        console.log('🔄 Reintentando conexión en 5 segundos...');
        setTimeout(connectDB, 5000);
        
        throw error;
    }
};

/**
 * Función para desconectar de MongoDB
 * @returns {Promise} Promesa de desconexión
 */
const disconnectDB = async () => {
    try {
        await mongoose.connection.close();
        console.log('🔌 Desconectado de MongoDB');
    } catch (error) {
        console.error('❌ Error al desconectar de MongoDB:', error.message);
        throw error;
    }
};

/**
 * Eventos de conexión de MongoDB
 */
const setupDBEvents = () => {
    // Cuando la conexión se abre
    mongoose.connection.on('connected', () => {
        console.log('🟢 Mongoose conectado a MongoDB');
    });

    // Si la conexión arroja un error
    mongoose.connection.on('error', (err) => {
        console.error('🔴 Error de conexión de Mongoose:', err);
    });

    // Cuando la conexión se desconecta
    mongoose.connection.on('disconnected', () => {
        console.log('🟡 Mongoose desconectado de MongoDB');
    });

    // Si la aplicación Node se termina, cerrar la conexión de Mongoose
    process.on('SIGINT', async () => {
        try {
            await mongoose.connection.close();
            console.log('🔌 Conexión de Mongoose cerrada debido a la terminación de la aplicación');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error al cerrar la conexión:', error);
            process.exit(1);
        }
    });
};

/**
 * Función para verificar el estado de la conexión
 * @returns {string} Estado de la conexión
 */
const getConnectionStatus = () => {
    const states = {
        0: 'desconectado',
        1: 'conectado',
        2: 'conectando',
        3: 'desconectando'
    };
    
    return states[mongoose.connection.readyState] || 'desconocido';
};

/**
 * Configuración del entorno
 */
const envConfig = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3000,
    JWT_SECRET: process.env.JWT_SECRET || 'tu_jwt_secret_aqui',
    
    // Configuraciones específicas por entorno
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test'
};

module.exports = {
    dbConfig,
    connectDB,
    disconnectDB,
    setupDBEvents,
    getConnectionStatus,
    envConfig
};