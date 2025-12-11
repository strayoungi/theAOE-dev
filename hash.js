import bcrypt from 'bcryptjs';

const password = '2111'; // ganti sesuai password yang kamu mau

const run = async () => {
  const hashed = await bcrypt.hash(password, 10);
  console.log('Password hash:', hashed);
};

run();