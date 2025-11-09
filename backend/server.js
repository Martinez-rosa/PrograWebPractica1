const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const User = require('./models/user');
const ChatMessage = require('./models/chatMessage');

// Importar configuración
const { connectDB, setupDBEvents, envConfig } = require('./config');

// Importar middleware de autenticación
const { authenticate, authenticatePage } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware de autenticación para Socket.IO
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token
      ? socket.handshake.auth.token
      : (socket.handshake.headers['authorization'] || '').replace('Bearer ', '');
    if (!token) {
      return next(new Error('Unauthorized: token missing'));
    }
    const payload = jwt.verify(token, envConfig.JWT_SECRET);
    // Adjuntar datos del usuario al socket
    socket.authUser = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(new Error('Unauthorized: invalid token'));
  }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
// Servir archivos subidos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas API
const productosRouter = require('./routes/productos');
app.use('/', productosRouter);

// Rutas de autenticación
const authRouter = require('./routes/auth');
app.use('/auth', authRouter);


app.use(express.static(path.join(__dirname, '../frontend')));

// Ruta para la página principal (sirve el HTML)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Router de chat (protegido)
const chatRouter = require('./routes/chatroutes');
app.use('/', chatRouter);

let connectedUsers = new Set();
// Usuarios escribiendo actualmente (username => timeout)
let typingUsers = new Map();

// Configuración de Socket.IO
io.on('connection', async (socket) => {
  console.log('Nuevo cliente conectado al chat');
  
  // Almacenar el username asociado a este socket
  let currentUsername = null;
  
  // Resolver el nombre de usuario desde la BD usando el token
  try {
    if (socket.authUser && socket.authUser.id) {
      const dbUser = await User.findById(socket.authUser.id).select('email');
      if (dbUser && dbUser.email) {
        currentUsername = dbUser.email.split('@')[0];
      }
    }
  } catch (e) {
    console.error('Error obteniendo usuario para el socket:', e.message);
  }
  
  // Enviar historial de mensajes al nuevo cliente (últimos 50 desde MongoDB)
  try {
    const recent = await ChatMessage.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const ordered = recent.reverse().map((m) => ({
      username: m.username,
      message: m.message,
      timestamp: new Date(m.createdAt).toISOString(),
      userColor: m.userColor,
    }));
    socket.emit('chat history', ordered);
  } catch (err) {
    console.error('Error cargando historial de chat:', err.message);
    socket.emit('chat history', []);
  }
  
  // Si tenemos username, anunciar unión y actualizar contador
  if (currentUsername) {
    connectedUsers.add(currentUsername);
    io.emit('user count', connectedUsers.size);
    io.emit('user joined', currentUsername);
  }
  
  socket.on('user joined', (usernameFromClient) => {
  
    if (currentUsername) return;
    const effectiveUsername = usernameFromClient || 'Usuario';
    console.log(effectiveUsername + ' se ha unido al chat (cliente)');
    currentUsername = effectiveUsername;
    if (!connectedUsers.has(effectiveUsername)) {
      connectedUsers.add(effectiveUsername);
    }
    io.emit('user count', connectedUsers.size);
    io.emit('user joined', effectiveUsername);
  });

  //Monstrar historial
  socket.on('get history', async () => {
    try {
      const recent = await ChatMessage.find({})
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      const ordered = recent.reverse().map((m) => ({
        username: m.username,
        message: m.message,
        timestamp: new Date(m.createdAt).toISOString(),
        userColor: m.userColor,
      }));
      socket.emit('chat history data', ordered);
    } catch (err) {
      console.error('Error obteniendo historial bajo demanda:', err.message);
      socket.emit('chat history data', []);
    }
  });
  
  // Indicador de escritura: actualizar lista y difundir
  socket.on('typing', () => {
    const effectiveUsername = currentUsername || 'Usuario';
    // Reiniciar timeout para este usuario
    if (typingUsers.has(effectiveUsername)) {
      clearTimeout(typingUsers.get(effectiveUsername));
    }
    const timeoutId = setTimeout(() => {
      typingUsers.delete(effectiveUsername);
      io.emit('typing update', Array.from(typingUsers.keys()));
    }, 3000); // expira después de 3s sin actividad
    typingUsers.set(effectiveUsername, timeoutId);
    io.emit('typing update', Array.from(typingUsers.keys()));
  });

  socket.on('stop typing', () => {
    const effectiveUsername = currentUsername;
    if (!effectiveUsername) return;
    if (typingUsers.has(effectiveUsername)) {
      clearTimeout(typingUsers.get(effectiveUsername));
      typingUsers.delete(effectiveUsername);
      io.emit('typing update', Array.from(typingUsers.keys()));
    }
  });
  
  socket.on('chat message', async (data) => {
    console.log('Mensaje recibido de ' + data.username + ': ' + data.message);
    
    // Crear objeto de mensaje con timestamp
    try {
      const doc = await ChatMessage.create({
        username: currentUsername || data.username,
        message: data.message,
        userColor: data.userColor || getRandomColor(),
      });
      const payload = {
        username: doc.username,
        message: doc.message,
        timestamp: new Date(doc.createdAt).toISOString(),
        userColor: doc.userColor,
      };
      // Enviar mensaje a todos los clientes
      io.emit('chat message', payload);
    } catch (err) {
      console.error('Error guardando mensaje de chat:', err.message);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Usuario desconectado del chat');
    
    // Remover usuario de la lista de conectados si sabemos cuál es
    if (currentUsername) {
      connectedUsers.delete(currentUsername);
      console.log(currentUsername + ' ha sido removido de usuarios conectados');
      // Limpiar si estaba en escribiendo
      if (typingUsers.has(currentUsername)) {
        clearTimeout(typingUsers.get(currentUsername));
        typingUsers.delete(currentUsername);
        io.emit('typing update', Array.from(typingUsers.keys()));
      }
    }
    
    // Enviar contador actualizado a todos los clientes
    io.emit('user count', connectedUsers.size);
    
    // Notificar salida del usuario
    if (currentUsername) {
      io.emit('user left', currentUsername);
    }
  });
});

// Función para generar colores aleatorios
function getRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA5A5', '#A3D39C', 
    '#7D70BA', '#5B8C85', '#E84855', '#3185FC', '#F9C80E',
    '#FF6F61', '#6A0572', '#AB83A1', '#5C80BC', '#F45B69',
    '#2EC4B6', '#E71D36', '#FF9F1C', '#011627', '#2A9D8F'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Función principal para iniciar el servidor
const startServer = async () => {
  try {
    // Configurar eventos de la base de datos
    setupDBEvents();
    
    // Conectar a MongoDB
    await connectDB();
    
    // Iniciar servidor con Socket.IO
    const PORT = envConfig.PORT;
    server.listen(PORT, () => {
      console.log(`Servidor iniciado en http://localhost:${PORT}`);
      console.log(`Entorno: ${envConfig.NODE_ENV}`);
      console.log(`Base de datos: Conectada`);
      console.log(`Chat Socket.IO: Habilitado`);
    });
    
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Iniciar el servidor
startServer();

module.exports = app;
