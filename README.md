# 📦 API de Productos + Chat en Tiempo Real

## Resumen

Aplicación con backend en Express + MongoDB, autenticación JWT y un chat en tiempo real con Socket.IO. El chat está protegido: solo usuarios autenticados pueden acceder y enviar mensajes. La UI del chat imita la lógica visual de WhatsApp (burbujas propias a la derecha, ajenas a la izquierda) e incluye historial de los últimos 50 mensajes.

## Cambios y decisiones clave (últimos ajustes)

- Separación de responsabilidades en el frontend:
  - Moví la lógica del chat desde `chat.html` a `frontend/main.js` mediante un inicializador específico `initChatPage()` que solo corre cuando detecta la página del chat.
  - Extraje los estilos del chat a `frontend/chat.css` y eliminé el `<style>` inline de `chat.html`.
  - Mantuve `socket.io` como script dedicado en `chat.html` y luego cargo `main.js` para inicializar.
- Indicador de escritura (“typing”) en el chat:
  - Cliente emite `typing` con throttling (cada ~800 ms máximo) y programa `stop typing` tras 1500 ms de inactividad.
  - Servidor mantiene un mapa de usuarios escribiendo con timeouts por `socket.id` y difunde `typing update` con la lista de usernames activos.
  - UI muestra “X está escribiendo…” y oculta al quedar vacío.
- Corrección de duplicados en “alguien se unió al chat”:
  - Eliminé la emisión `user joined` desde el cliente; el servidor anuncia un único evento basado en el JWT del handshake.
  - Añadí guardas en el servidor para evitar anunciar dos veces si el mismo usuario intenta emitir manualmente.
- Edición de productos con imagen:
  - En `frontend/index.html` añadí selector de imagen estilizado y previsualización en el modal de edición.
  - En `frontend/main.js` reseteo preview/filename al abrir el modal; al guardar, si hay imagen seleccionada, la subo con `FormData` a `POST /productos/:id/foto` usando el token en `Authorization` y luego refresco la lista.
- Seguridad y autenticación:
  - Validación JWT en HTTP (middleware `authenticate`) y WebSocket (`io.use`), usando `socket.handshake.auth.token`.
  - El frontend guarda el token en `localStorage` y cookie `auth_token` para poder proteger rutas HTML como `/chat` desde el backend.


## Estructura

ProgaWeb1/
├── backend/
│   ├── .env                 # Variables de entorno
│   ├── config.js            # Configuración de DB y entorno
│   ├── middleware/
│   │   └── auth.js          # JWT, authorize y authenticatePage
│   ├── models/
│   │   ├── user.js          # Modelo de usuario
│   │   └── products.js      # Modelo de productos
│   ├── routes/
│   │   ├── auth.js          # Registro/Login
│   │   └── productos.js     # CRUD de productos
│   │   └── chatroutes.js    # Ruta HTML protegida para /chat
│   └── server.js            # Servidor + Socket.IO + chat
├── frontend/
│   ├── index.html           # Home + login/registro + productos
│   ├── main.js              # Lógica de UI y autenticación
│   ├── chat.html            # Chat protegido
│   └── styles.css           # Estilos
└── README.md

## Variables de entorno (`backend/.env`)

- `PORT=3000` (puerto del servidor)
- `NODE_ENV=development`
- `MONGODB_URI=mongodb://localhost:27017/productos`
- `JWT_SECRET=<clave_secreta>`
- `JWT_EXPIRES_IN=1h`

## Autenticación

- API: `Authorization: Bearer <token>` con `authenticate` y `authorize` (roles `admin`/`user`).
- Rutas HTML protegidas: `authenticatePage` protege `/chat` leyendo el token desde:
  - Cookie `auth_token` (preferido), o
  - Query string `?token=...` (alternativa).
- Frontend guarda el token en `localStorage` y también en cookie (`auth_token`) al hacer login; lo elimina al logout.
- Socket.IO exige token en el handshake (`io({ auth: { token } })`). El servidor valida el JWT en `io.use(...)`.
- El servidor deriva el username desde la BD (correo del usuario → parte antes de `@`) y no confía en nombres enviados por el cliente.

## Chat en tiempo real

- Diferenciación visual estilo WhatsApp:
  - Propios: burbuja verde a la derecha (`own`).
  - Otros: burbuja blanca a la izquierda (`other`).
- Usuario y color:
  - Cada usuario tiene un color (20 colores predefinidos) persistente durante la sesión.
  - El nombre se muestra con el color y se acompaña de hora/timestamp.
- Contador de usuarios conectados en tiempo real.
- Historial:
  - Persistencia en MongoDB con Mongoose (`ChatMessage`).
  - Al entrar al chat se cargan los últimos 50 mensajes (orden cronológico).
  - Botón “Historial” abre un modal que muestra esos 50 últimos.
- Notificaciones del navegador para mensajes de otros.

## Endpoints principales

- `GET /productos` – Lista productos.
- `POST /productos` – Crea producto (requiere rol `admin`).
- `PUT /productos/:id` – Actualiza (requiere rol `admin`).
- `DELETE /productos/:id` – Elimina (requiere rol `admin`).
- `POST /auth/register` – Registro.
- `POST /auth/login` – Login; retorna `{ token, user }`.

## Decisiones técnicas

- Token en cookie y `localStorage`:
  - Cookie facilita proteger rutas HTML (`/chat`) desde el servidor.
  - `localStorage` permite al frontend enviar el token en el handshake del socket y validar acceso rápido.
- Username autoritativo del servidor:
  - Evita suplantación; el servidor usa el email del usuario autenticado para etiquetar mensajes y eventos (`user joined/left`).
- Límite de historial en memoria (50):
  - Simple y rápido; no persiste tras reinicio. Se puede migrar a MongoDB.
- Emisión de mensajes:
  - `io.emit('chat message', ...)` envía a todos (incluye remitente) y el frontend decide el estilo `own/other`.

### Diseño del chat y UX

- Inicialización por página:
  - `main.js` detecta `.chat-container` para correr la lógica del chat sin afectar la página de productos.
- Previsualización de imagen en productos:
  - Detecta cambios en el input de archivo, muestra/oculta preview y actualiza el nombre del archivo.
- Historial y notificaciones:
  - El historial de los últimos 50 mensajes se muestra en un modal accesible con el botón “Historial”.
  - Se solicitan permisos de notificaciones y se muestran solo para mensajes de otros usuarios.

### Razonamiento de seguridad

- Autoridad de identidad del servidor:
  - El servidor infiere el `username` desde el usuario validado por JWT (correo → parte antes de `@`). No se confía en nombres enviados por el cliente.
- Protección contra duplicados:
  - Los eventos sensibles (`user joined`) solo se originan en el servidor, previniendo spam/duplicaciones.
- Gestión del token:
  - Cookie `auth_token` para proteger vistas HTML y `Authorization: Bearer` para API/sockets.

## Validación y pruebas manuales

- Chat:
  - Abrir dos ventanas con cuentas distintas; escribir en una y verificar el indicador “está escribiendo…”.
  - Enviar mensajes y comprobar burbujas propias vs. ajenas, contador de usuarios y que “se ha unido al chat” se muestre una sola vez.
  - Abrir el historial; deben verse los últimos 50 mensajes con formato completo.
- Productos:
  - Crear/editar producto con imagen; verificar previsualización y subida de la imagen a `POST /productos/:id/foto`.
  - Confirmar refresco de la lista tras guardar y manejo de errores.

## Cómo ejecutar

1. Instala dependencias: `npm install` (opcional si ya están).
2. Configura `backend/.env` (ver sección de variables).
3. Arranca: `node backend/server.js`.
4. Abre `http://localhost:3000/` para login y productos.
5. Accede al chat: botón “Chat” o `http://localhost:3000/chat`.
   - Si no estás autenticado, el servidor redirige a `/`.

## Uso del chat

- Inicia sesión desde la página principal.
- Entra al chat; escribe y envía mensajes.
- Abre el “📋 Historial” para ver los últimos 50 mensajes.

## Limitaciones y próximos pasos

- El historial ahora persiste en MongoDB. Se podrían añadir paginación y limpieza programada.
- El contador de usuarios puede desalinearse en desconexiones no limpias; se mitiga llevando `socket → username` y removiendo en `disconnect`.
- Cookie de token no es HttpOnly (la gesiona el frontend). Se recomienda mover el `Set-Cookie` al backend para aumentar seguridad.
- No hay salas/rooms; todo es chat global.


---
