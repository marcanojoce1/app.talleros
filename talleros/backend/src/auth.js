// Autenticación y autorización
require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const EXPIRES = process.env.JWT_EXPIRES || '7d';

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
function checkPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
function signToken(user) {
  return jwt.sign(
    { id: user.id, rol: user.rol, nombre: user.nombre, usuario: user.usuario },
    SECRET,
    { expiresIn: EXPIRES }
  );
}

// Middleware: exige un token válido
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Middleware: exige uno de los roles dados
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No autorizado para esta acción' });
    }
    next();
  };
}

module.exports = { hashPassword, checkPassword, signToken, auth, requireRole };
