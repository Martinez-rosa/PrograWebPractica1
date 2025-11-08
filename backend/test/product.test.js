const request = require('supertest');
const app = require('../server'); // Importamos la app de Express

describe('API de productos', () => {
  it('GET /api/productos debería devolver lista de productos', async () => {
    const res = await request(app).get('/api/productos');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/productos debería añadir un producto', async () => {
    const nuevoProducto = { nombre: 'Camiseta', precio: 19.99 };
    const res = await request(app).post('/api/productos').send(nuevoProducto);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('nombre', 'Camiseta');
    expect(res.body).toHaveProperty('precio', 19.99);
  });
});