const jwt = require('jsonwebtoken');

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
    .reduce((acc, cur) => {
      const idx = cur.indexOf('=');
      if (idx > -1) {
        const k = decodeURIComponent(cur.slice(0, idx));
        const v = decodeURIComponent(cur.slice(idx + 1));
        acc[k] = v;
      }
      return acc;
    }, {});
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Middleware para proteger páginas HTML (ej. /chat) usando cookie o query
function authenticatePage(req, res, next) {
  let token = null;
  const cookies = parseCookies(req);
  if (req.query && req.query.token) token = req.query.token;
  if (!token && cookies && cookies.auth_token) token = cookies.auth_token;

  if (!token) {
    // Redirigir al inicio si no hay token
    return res.redirect(302, '/');
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    return res.redirect(302, '/');
  }
}

function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    next();
  };
}

module.exports = { authenticate, authorize, authenticatePage };