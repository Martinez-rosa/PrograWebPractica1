const express = require('express');
const router = express.Router();
const multer = require('multer');
const Producto = require('../models/products');
const { authenticate, authorize } = require('../middleware/auth');

// Almacenamiento en memoria para guardar en DB
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido'));
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });


// Ruta para productos
router.get('/productos', async (req, res, next) => {
  try {
    const productos = await Producto.find().sort({ createdAt: -1 });
    res.json(productos);
  } catch (error) {
    next(error);
  }
});

router.post('/productos', authenticate, authorize(['admin']), upload.single('foto'), async (req, res) => {

  try {
    const body = req.body || {};
    const nombre = (body.nombre || '').toString().trim();
    const descripcion = (body.descripcion || '').toString().trim();
    const precioRaw = body.precio;
    const precio = precioRaw !== undefined && precioRaw !== null ? Number(precioRaw) : undefined;

    if (!nombre || !descripcion || precio === undefined || Number.isNaN(precio)) {
      return res.status(400).json({ error: 'Campos requeridos: nombre, descripcion, precio' });
    }

    const doc = { nombre, descripcion, precio };
    const nuevoProducto = new Producto(doc);
    if (req.file) {
      nuevoProducto.image = { data: req.file.buffer, contentType: req.file.mimetype };
    }
    const productoGuardado = await nuevoProducto.save();
    if (req.file) {
      productoGuardado.imageUrl = `/productos/${productoGuardado._id}/foto`;
      await productoGuardado.save();
    }
    res.status(201).json(productoGuardado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Editar un producto
router.put('/productos/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const producto = await Producto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(producto);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar un producto
router.delete('/productos/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const producto = await Producto.findByIdAndDelete(req.params.id);
    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ mensaje: "Producto eliminado" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Subir imagen de producto (solo admin)
router.post('/productos/:id/foto', authenticate, authorize(['admin']), upload.single('foto'), async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo de imagen' });
    producto.image = { data: req.file.buffer, contentType: req.file.mimetype };
    producto.imageUrl = `/productos/${req.params.id}/foto`;
    const actualizado = await producto.save();
    return res.json({ mensaje: 'Imagen subida', producto: actualizado });
  } catch (error) {
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
});

// Servir imagen desde la base de datos
router.get('/productos/:id/foto', async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id).select('image');
    if (!producto || !producto.image || !producto.image.data) {
      return res.status(404).send('Imagen no encontrada');
    }
    res.set('Content-Type', producto.image.contentType || 'image/jpeg');
    return res.send(producto.image.data);
  } catch (error) {
    return res.status(400).send('Error obteniendo imagen');
  }
});

module.exports = router;