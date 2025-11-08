// ===== VARIABLES GLOBALES =====
let allProducts = [];
let currentPage = 1;
const PRODUCTS_PER_PAGE = 4;
let filteredProducts = [];
let currentUser = null;

// ===== AUTENTICACIÓN =====
class AuthManager {
  constructor() {
    this.token = localStorage.getItem('token');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
  }

  async register(email, password, role = 'user') {
    try {
      const response = await fetch('http://localhost:3000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });
      
      const data = await response.json();
      if (response.ok) {
        this.setAuth(data.token, data.user);
        return { success: true, message: 'Cuenta creada exitosamente' };
      } else {
        return { success: false, message: data.message || 'Error al crear cuenta' };
      }
    } catch (error) {
      return { success: false, message: 'Error de conexión' };
    }
  }

  async login(email, password) {
    try {
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      if (response.ok) {
        this.setAuth(data.token, data.user);
        return { success: true, message: 'Inicio de sesión exitoso' };
      } else {
        return { success: false, message: data.message || 'Credenciales incorrectas' };
      }
    } catch (error) {
      return { success: false, message: 'Error de conexión' };
    }
  }

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    currentUser = user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Guardar token en cookie para proteger rutas HTML como /chat
    document.cookie = `auth_token=${token}; path=/; SameSite=Lax`;
  }

  logout() {
    this.token = null;
    this.user = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Eliminar cookie de autenticación
    document.cookie = 'auth_token=; Max-Age=0; path=/; SameSite=Lax';
  }

  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  isAdmin() {
    return this.user && this.user.role === 'admin';
  }

  getAuthHeaders() {
    return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
  }
}

const auth = new AuthManager();

// ===== FUNCIONES DE UI =====
function showAuthSection() {
  document.getElementById('authSection').style.display = 'block';
  document.getElementById('appContent').style.display = 'none';
}

function showAppContent() {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('appContent').style.display = 'block';
  
  // Actualizar info del usuario
  document.getElementById('userEmail').textContent = currentUser.email;
  const roleElement = document.getElementById('userRole');
  roleElement.textContent = currentUser.role.toUpperCase();
  roleElement.className = `role-badge ${currentUser.role}`;
  
  // Mostrar/ocultar secciones según rol
  const createSection = document.getElementById('createProductSection');
  if (auth.isAdmin()) {
    createSection.style.display = 'block';
  } else {
    createSection.style.display = 'none';
  }
  
  // Cargar productos automáticamente
  loadProducts();
}

function switchToRegister() {
  document.getElementById('loginCard').style.display = 'none';
  document.getElementById('registerCard').style.display = 'block';
}

function switchToLogin() {
  document.getElementById('registerCard').style.display = 'none';
  document.getElementById('loginCard').style.display = 'block';
}

function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.className = isError ? 'message error' : 'message success';
  setTimeout(() => {
    element.textContent = '';
    element.className = 'message';
  }, 5000);
}

// ===== PRODUCTOS =====
function normalizeText(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function applyFilter() {
  const searchTerm = normalizeText(document.getElementById('search').value);
  
  if (searchTerm === '') {
    filteredProducts = [...allProducts];
  } else {
    filteredProducts = allProducts.filter(product => {
      const name = normalizeText(product.nombre);
      const description = normalizeText(product.descripcion);
      return name.includes(searchTerm) || description.includes(searchTerm);
    });
  }
  
  currentPage = 1;
  renderProducts(filteredProducts);
}

function renderProducts(productsToRender) {
  const tbody = document.querySelector('#productsTable tbody');
  tbody.innerHTML = '';

  const totalPages = Math.ceil(productsToRender.length / PRODUCTS_PER_PAGE);
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const endIndex = startIndex + PRODUCTS_PER_PAGE;
  const productsToShow = productsToRender.slice(startIndex, endIndex);

  productsToShow.forEach(product => {
    const row = document.createElement('tr');
    
    const actionsHtml = auth.isAdmin() 
      ? `<button class="btn-edit" onclick="editProduct('${product._id}')">Editar</button>
         <button class="btn-delete" onclick="deleteProduct('${product._id}')">Eliminar</button>`
      : '<span class="no-actions">Solo lectura</span>';

    row.innerHTML = `
      <td>${product.imageUrl ? `<img src="http://localhost:3000${product.imageUrl}" alt="${product.nombre}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;" />` : '<span class="no-image">Sin imagen</span>'}</td>
      <td>${product.nombre}</td>
      <td>$${product.precio}</td>
      <td>${product.descripcion}</td>
      <td>${actionsHtml}</td>
    `;
    tbody.appendChild(row);
  });

  updatePaginationControls(totalPages);
}

function updatePaginationControls(totalPages) {
  let paginationDiv = document.getElementById('pagination');
  if (!paginationDiv) {
    paginationDiv = document.createElement('div');
    paginationDiv.id = 'pagination';
    paginationDiv.style.textAlign = 'center';
    paginationDiv.style.margin = '20px 0';
    document.getElementById('productsTable').after(paginationDiv);
  }
  paginationDiv.innerHTML = '';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Anterior';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = function() {
    if (currentPage > 1) {
      currentPage--;
      renderProducts(filteredProducts);
    }
  };
  paginationDiv.appendChild(prevBtn);

  const pageInfo = document.createElement('span');
  pageInfo.textContent = ` Página ${currentPage} de ${totalPages} `;
  paginationDiv.appendChild(pageInfo);

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Siguiente';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = function() {
    if (currentPage < totalPages) {
      currentPage++;
      renderProducts(filteredProducts);
    }
  };
  paginationDiv.appendChild(nextBtn);
}

async function loadProducts() {
  try {
    const response = await fetch('http://localhost:3000/productos');
    if (response.ok) {
      allProducts = await response.json();
      filteredProducts = [...allProducts];
      renderProducts(filteredProducts);
    } else {
      console.error('Error al cargar productos');
    }
  } catch (error) {
    console.error('Error de conexión:', error);
  }
}

async function createProduct(productData) {
  try {
    const response = await fetch('http://localhost:3000/productos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...auth.getAuthHeaders()
      },
      body: JSON.stringify(productData)
    });

    if (response.ok) {
      loadProducts();
      return { success: true, message: 'Producto creado exitosamente' };
    } else {
      const error = await response.json();
      return { success: false, message: error.message || 'Error al crear producto' };
    }
  } catch (error) {
    return { success: false, message: 'Error de conexión' };
  }
}

async function updateProduct(id, productData) {
  try {
    const response = await fetch(`http://localhost:3000/productos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...auth.getAuthHeaders()
      },
      body: JSON.stringify(productData)
    });

    if (response.ok) {
      loadProducts();
      return { success: true, message: 'Producto actualizado exitosamente' };
    } else {
      const error = await response.json();
      return { success: false, message: error.message || 'Error al actualizar producto' };
    }
  } catch (error) {
    return { success: false, message: 'Error de conexión' };
  }
}

async function deleteProduct(id) {
  if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) {
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/productos/${id}`, {
      method: 'DELETE',
      headers: auth.getAuthHeaders()
    });

    if (response.ok) {
      loadProducts();
      alert('Producto eliminado exitosamente');
    } else {
      const error = await response.json();
      alert(error.message || 'Error al eliminar producto');
    }
  } catch (error) {
    alert('Error de conexión');
  }
}

function editProduct(id) {
  const product = allProducts.find(p => p._id === id);
  if (!product) return;

  document.getElementById('editId').value = product._id;
  document.getElementById('editName').value = product.nombre;
  document.getElementById('editPrice').value = product.precio;
  document.getElementById('editDescription').value = product.descripcion;
  // Reset previsualización y nombre de archivo
  const editPreview = document.getElementById('editImagePreview');
  const editFileName = document.getElementById('editFileName');
  if (editPreview) { editPreview.src = ''; editPreview.style.display = 'none'; }
  if (editFileName) { editFileName.textContent = 'Ningún archivo seleccionado'; }

  document.getElementById('editModal').style.display = 'block';
}

// ===== INICIALIZACIÓN =====
function initChatPage() {
  // Verificar autenticación antes de entrar al chat
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  if (!token || !storedUser) {
    window.location.href = '/';
    return;
  }

  // Conectar con Socket.IO enviando el token en el handshake
  const socket = io({ auth: { token } });
  const messages = document.getElementById('messages');
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const userCount = document.getElementById('userCount');
  const typingIndicator = document.getElementById('typingIndicator');

  // Obtener el nombre del usuario desde el correo electrónico en localStorage
  let username = 'Usuario';
  try {
    const user = JSON.parse(storedUser);
    if (user && user.email) {
      username = user.email.split('@')[0];
    }
  } catch (error) {
    console.error('Error al obtener datos del usuario:', error);
  }

  // Generar color aleatorio para el usuario
  const userColor = getRandomColorForChat();

  // Formatear hora
  function formatTime(date) {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  // Crear elemento de mensaje con formato completo y color
  function createMessageElement(usernameArg, message, timestamp, isOwn = false, color = null) {
    const item = document.createElement('li');
    item.className = `message ${isOwn ? 'own' : 'other'}`;
    const time = timestamp ? formatTime(new Date(timestamp)) : formatTime(new Date());
    const usernameStyle = color ? `style="color: ${color}; font-weight: bold;"` : '';
    item.innerHTML = `
      <div class="message-header">
        <span class="message-username" ${usernameStyle}>${usernameArg}:</span>
        <span class="message-time">${time}</span>
      </div>
      <div class="message-content">${message}</div>
    `;
    return item;
  }

  // Agregar mensaje al chat (compatibilidad para joined/left)
  function appendMessage(msg, isOwn = false) {
    const item = document.createElement('li');
    item.className = `message ${isOwn ? 'own' : 'other'}`;
    const time = formatTime(new Date());
    item.innerHTML = `
      <div>${msg}</div>
      <div class="message-time">${time}</div>
    `;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  // Enviar mensaje
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    socket.emit('chat message', { username, message, userColor });
    input.value = '';
    socket.emit('stop typing');
  });

  // Recibir mensajes
  socket.on('chat message', function(data) {
    const isOwn = data.username === username;
    const el = createMessageElement(data.username, data.message, data.timestamp, isOwn, data.userColor);
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    if (!isOwn) showNotification(`Nuevo mensaje de ${data.username}: ${data.message}`);
  });

  // Historial en lista principal
  socket.on('chat history', function(historyMessages) {
    messages.innerHTML = '';
    historyMessages.forEach(data => {
      const isOwn = data.username === username;
      const el = createMessageElement(data.username, data.message, data.timestamp, isOwn, data.userColor);
      messages.appendChild(el);
    });
    messages.scrollTop = messages.scrollHeight;
  });

  // Usuario conectado/desconectado
  socket.on('user joined', function(name) {
    appendMessage(`🔵 ${name} se ha unido al chat`, false);
  });
  socket.on('user left', function(name) {
    appendMessage(`🔴 ${name} ha abandonado el chat`, false);
  });

  // Contador
  socket.on('user count', function(count) {
    userCount.textContent = `Usuarios conectados: ${count}`;
  });

  // Notificaciones
  function showNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Chat App', { body: message });
    }
  }
  if ('Notification' in window) {
    Notification.requestPermission();
  }

  // Historial modal
  const historyBtn = document.getElementById('historyBtn');
  const historyModal = document.getElementById('historyModal');
  const closeHistory = document.getElementById('closeHistory');
  const historyList = document.getElementById('historyList');

  historyBtn.addEventListener('click', function() {
    historyModal.style.display = 'block';
    socket.emit('get history');
  });
  closeHistory.addEventListener('click', function() {
    historyModal.style.display = 'none';
  });
  window.addEventListener('click', function(event) {
    if (event.target === historyModal) historyModal.style.display = 'none';
  });
  socket.on('chat history data', function(historyMessages) {
    historyList.innerHTML = '';
    historyMessages.forEach(data => {
      const isOwn = data.username === username;
      const el = createMessageElement(data.username, data.message, data.timestamp, isOwn, data.userColor);
      historyList.appendChild(el);
    });
  });

  window.addEventListener('load', function() { input.focus(); });

  // Tecla Enter
  input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });

  // Indicador de escritura con throttling
  let lastTypingEmit = 0;
  let stopTypingTimeout = null;
  input.addEventListener('input', function() {
    const now = Date.now();
    const hasText = input.value.trim().length > 0;
    if (hasText && now - lastTypingEmit > 800) {
      socket.emit('typing');
      lastTypingEmit = now;
    }
    if (stopTypingTimeout) clearTimeout(stopTypingTimeout);
    stopTypingTimeout = setTimeout(() => { socket.emit('stop typing'); }, 1500);
    if (!hasText) { socket.emit('stop typing'); }
  });
  input.addEventListener('blur', function() { socket.emit('stop typing'); });

  socket.on('typing update', function(usernames) {
    const others = (usernames || []).filter(u => u !== username);
    if (others.length === 0) {
      typingIndicator.style.display = 'none';
      typingIndicator.textContent = '';
      return;
    }
    typingIndicator.style.display = 'block';
    typingIndicator.textContent = others.length === 1
      ? `${others[0]} está escribiendo...`
      : `${others.join(', ')} están escribiendo...`;
  });

  // Colores para usuarios
  function getRandomColorForChat() {
    const colors = ['#FF6B6B','#4ECDC4','#45B7D1','#FFA5A5','#A3D39C','#7D70BA','#5B8C85','#E84855','#3185FC','#F9C80E','#FF6F61','#6A0572','#AB83A1','#5C80BC','#F45B69','#2EC4B6','#E71D36','#FF9F1C','#011627','#2A9D8F'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const isChatPage = !!document.querySelector('.chat-container');
  if (isChatPage) {
    initChatPage();
    return;
  }

  // PÁGINA DE APP (productos/auth)
  // Verificar que existen elementos esperados antes de correr lógica de app
  const authSection = document.getElementById('authSection');
  const appContent = document.getElementById('appContent');
  if (!authSection && !appContent) {
    // Nada que inicializar en esta página
    return;
  }

  // Verificar autenticación al cargar
  if (auth.isAuthenticated()) {
    currentUser = auth.user;
    showAppContent();
  } else {
    showAuthSection();
  }

  // Event listeners para autenticación
  document.getElementById('showRegister').addEventListener('click', (e) => {
    e.preventDefault();
    switchToRegister();
  });

  document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    switchToLogin();
  });

  // Formulario de login
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const result = await auth.login(email, password);
    if (result.success) {
      showAppContent();
    } else {
      showMessage('loginMessage', result.message, true);
    }
  });

  // Formulario de registro
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
      showMessage('registerMessage', 'Las contraseñas no coinciden', true);
      return;
    }
    
    const result = await auth.register(email, password);
    if (result.success) {
      showAppContent();
    } else {
      showMessage('registerMessage', result.message, true);
    }
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    auth.logout();
    showAuthSection();
  });

  // Chat
  document.getElementById('chatBtn').addEventListener('click', () => {
    window.location.href = '/chat';
  });

  // Acceso al chat eliminado

  // Formulario de crear producto
  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('nombre', document.getElementById('name').value);
    formData.append('precio', document.getElementById('price').value);
    formData.append('descripcion', document.getElementById('description').value);
    const fileInput = document.getElementById('productImage');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      formData.append('foto', fileInput.files[0]);
    }

    try {
      const response = await fetch('http://localhost:3000/productos', {
        method: 'POST',
        headers: {
          ...auth.getAuthHeaders()
          // No establecer Content-Type para permitir multipart/form-data automático
        },
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        document.getElementById('productForm').reset();
        // Reset preview y nombre de archivo
        const preview = document.getElementById('imagePreview');
        const fileName = document.getElementById('fileName');
        if (preview) {
          preview.src = '';
          preview.style.display = 'none';
        }
        if (fileName) fileName.textContent = 'Ningún archivo seleccionado';
        alert('Producto creado exitosamente');
        loadProducts();
      } else {
        alert(data.error || 'Error al crear producto');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  });

  // Previsualización de imagen y nombre de archivo
  const fileInput = document.getElementById('productImage');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      const preview = document.getElementById('imagePreview');
      const fileName = document.getElementById('fileName');
      if (fileName) fileName.textContent = file ? file.name : 'Ningún archivo seleccionado';
      if (file) {
        const url = URL.createObjectURL(file);
        if (preview) {
          preview.src = url;
          preview.style.display = 'block';
        }
      } else if (preview) {
        preview.src = '';
        preview.style.display = 'none';
      }
    });
  }

  // Previsualización en modal de edición
  const editInput = document.getElementById('editImage');
  if (editInput) {
    editInput.addEventListener('change', () => {
      const file = editInput.files && editInput.files[0];
      const preview = document.getElementById('editImagePreview');
      const fileName = document.getElementById('editFileName');
      if (fileName) fileName.textContent = file ? file.name : 'Ningún archivo seleccionado';
      if (file) {
        const url = URL.createObjectURL(file);
        if (preview) {
          preview.src = url;
          preview.style.display = 'block';
        }
      } else if (preview) {
        preview.src = '';
        preview.style.display = 'none';
      }
    });
  }

  // Formulario de editar producto
  document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const productData = {
      nombre: document.getElementById('editName').value,
      precio: parseFloat(document.getElementById('editPrice').value),
      descripcion: document.getElementById('editDescription').value
    };
    
    const result = await updateProduct(id, productData);
    if (result.success) {
      // Subir imagen si se seleccionó
      const editInput = document.getElementById('editImage');
      const file = editInput && editInput.files && editInput.files[0] ? editInput.files[0] : null;
      if (file) {
        const fd = new FormData();
        fd.append('foto', file);
        try {
          const resp = await fetch(`http://localhost:3000/productos/${id}/foto`, {
            method: 'POST',
            headers: { ...auth.getAuthHeaders() },
            body: fd
          });
          const data = await resp.json();
          if (!resp.ok) {
            alert(data.error || 'Error al actualizar la imagen');
          }
        } catch (err) {
          alert('Error de conexión al subir la imagen');
        }
      }
      document.getElementById('editModal').style.display = 'none';
      alert(result.message);
      loadProducts();
    } else {
      alert(result.message);
    }
  });

  // Cerrar modal
  document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('editModal').style.display = 'none';
  });

  // Búsqueda
  document.getElementById('search').addEventListener('input', applyFilter);

  // Cargar productos manualmente
  document.getElementById('loadProductsBtn').addEventListener('click', loadProducts);
});