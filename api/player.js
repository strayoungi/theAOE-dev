import express from 'express';
import jwt from 'jsonwebtoken';

export default function playerRoutes(supabase) {
  const router = express.Router();

  // ✅ Middleware untuk verifikasi JWT
  function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ error: 'Invalid token' });
      req.user = user;
      next();
    });
  }

  // ✅ Route khusus untuk "me"
  router.get('/me', verifyToken, async (req, res) => {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  // ✅ Route umum: /api/player/:id
  router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  return router;
}
