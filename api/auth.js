import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

export default (supabase) => {
  // REGISTER
  router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    const { error } = await supabase.from('players').insert([{ username, password: hashed }]);
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'User registered successfully' });
  });

  // LOGIN
  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) return res.status(400).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, data.password);
    if (!match) return res.status(400).json({ error: 'Invalid password' });

    // Buat JWT token
    const token = jwt.sign({ id: data.id, username: data.username }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({ token });
  });

  return router;
};
