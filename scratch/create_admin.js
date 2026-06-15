require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

async function createAdmin() {
  await connectDB();
  try {
    // Delete any existing admin to prevent duplicates
    await User.deleteMany({ email: 'admin@vandedigital.com' });
    
    const admin = await User.create({
      name: 'Vande Admin',
      email: 'admin@vandedigital.com',
      password: 'password123',
      role: 'admin',
      phone: '9999999999',
      status: 'active'
    });
    console.log('✅ Admin profile created successfully:', admin.email);
  } catch (err) {
    console.error('❌ Error creating Admin profile:', err.message);
  } finally {
    mongoose.connection.close();
  }
}

createAdmin();
