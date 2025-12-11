import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// load env
dotenv.config();

// ⛔ Tambahkan validasi env di sini
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase environment variables. Check your .env file.");
  process.exit(1); // hentikan server agar tidak berjalan dalam kondisi error
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// inisialisasi supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// route modular
import authRoutes from './api/auth.js';
import playerRoutes from './api/player.js';

// inject supabase ke tiap router
app.use('/api/auth', authRoutes(supabase));
app.use('/api/player', playerRoutes(supabase));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
