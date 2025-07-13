// Import dependencies
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Order = require('../models/Order');

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/flo_db');

// Seed function to populate the database with initial data
async function seed() {
  // Remove all existing users and orders
  await User.deleteMany();
  await Order.deleteMany();

  // Hash the password before saving the user
  const passwordHash = bcrypt.hashSync('123456', 10);
  // Create a test user
  const user = await User.create({
    email: 'test@example.com',
    phone: '9999999999',
    password: passwordHash, // Store hashed password
    orders: []
  });

  // Create a sample order for the user
  const order1 = await Order.create({
    userId: user._id,
    productName: 'Flo Mattress',
    status: 'Shipped',
    price: 10000,
    date: '2025-07-10',
    deliveryDate: '2025-07-15'
  });

  // Link the order to the user
  user.orders.push(order1._id.toString());
  await user.save();
  console.log('Seeded');
  process.exit();
}

// Run the seed function
seed();
