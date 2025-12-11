import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: username, // bisa juga username kalau kamu pakai custom table
    password,
  });

  if (error) return res.status(400).json({ error: error.message });

  res.status(200).json({ token: data.session.access_token });
}
