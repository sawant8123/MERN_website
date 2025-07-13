const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Order = require('../models/Order');

const router = express.Router();
const SECRET = process.env.JWT_SECRET;

// Sign Up (Registration) route
router.post('/signup', async (req, res) => {
  const { email, phone, password } = req.body;
  if (!email || !phone || !password) {
    return res.status(400).json({ msg: 'All fields are required' });
  }
  // Check if user already exists
  const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
  if (existingUser) {
    return res.status(409).json({ msg: 'User already exists' });
  }
  // Hash password
  const hashedPassword = bcrypt.hashSync(password, 10);
  // Create user
  const user = await User.create({ email, phone, password: hashedPassword, orders: [] });
  // Generate JWT
  const token = jwt.sign({ userId: user._id }, SECRET);
  res.status(201).json({ token });
});

// Login by Email/Phone + Password or Order ID
router.post('/login', async (req, res) => {
  // Extract identifier, password, and orderId from request body
  const { identifier, password, orderId } = req.body;

  // Find user by email or phone
  const user = await User.findOne({
    $or: [{ email: identifier }, { phone: identifier }]
  });

  // If user not found, return 404
  if (!user) return res.status(404).json({ msg: 'User not found' });

  // If password is provided and matches, login succeeds
  if (password && bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ userId: user._id }, SECRET);
    return res.json({ token });
  }

  // If orderId is provided and is in user's orders, login succeeds
  if (orderId && user.orders.includes(orderId)) {
    const token = jwt.sign({ userId: user._id }, SECRET);
    return res.json({ token });
  }

  // If neither is valid, return 400
  return res.status(400).json({ msg: 'Invalid credentials' });
});

// Debug route: List all users and their order IDs (for local testing only)
router.get('/users', async (req, res) => {
  const users = await User.find({}, 'email phone orders');
  res.json(users);
});

// Middleware to verify JWT
function verifyToken(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ msg: 'No token' });
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ msg: 'Invalid token' });
    req.userId = decoded.id || decoded.userId;
    next();
  });
}

// Add to Cart
router.post('/cart', verifyToken, async (req, res) => {
  const { productId, title, price, thumbnail, quantity } = req.body;
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ msg: 'User not found' });
  // Check if product already in cart
  const existing = user.cart.find(item => item.productId === productId);
  if (existing) {
    existing.quantity += quantity || 1;
  } else {
    user.cart.push({ productId, title, price, thumbnail, quantity: quantity || 1 });
  }
  await user.save();
  res.json({ msg: 'Added to cart', cart: user.cart });
});

// Remove from Cart
router.delete('/cart/:productId', verifyToken, async (req, res) => {
  const { productId } = req.params;
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ msg: 'User not found' });
  const idx = user.cart.findIndex(item => String(item.productId) === String(productId));
  if (idx === -1) return res.status(404).json({ msg: 'Product not in cart' });
  user.cart.splice(idx, 1);
  await user.save();
  res.json({ msg: 'Removed from cart', cart: user.cart });
});

// Add to Wishlist
router.post('/wishlist', verifyToken, async (req, res) => {
  const { productId, title, price, thumbnail } = req.body;
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ msg: 'User not found' });
  if (!user.wishlist.find(item => item.productId === productId)) {
    user.wishlist.push({ productId, title, price, thumbnail });
    await user.save();
  }
  res.json({ msg: 'Added to wishlist', wishlist: user.wishlist });
});

// Get Cart
router.get('/cart', verifyToken, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ msg: 'User not found' });
  res.json(user.cart);
});

// Get Wishlist
router.get('/wishlist', verifyToken, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ msg: 'User not found' });
  res.json(user.wishlist);
});

// Checkout: Move all cart items to orders and clear cart
router.post('/checkout', verifyToken, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ msg: 'User not found' });
  if (!user.cart || user.cart.length === 0) return res.status(400).json({ msg: 'Cart is empty' });
  const newOrders = [];
  for (const item of user.cart) {
    const order = await Order.create({
      userId: user._id,
      productName: item.title,
      status: 'Placed',
      price: item.price * (item.quantity || 1),
      date: new Date().toISOString().slice(0, 10),
      deliveryDate: null
    });
    console.log('Order created:', order); // Debug log
    user.orders.push(order._id.toString());
    newOrders.push(order);
  }
  user.cart = [];
  await user.save();
  res.json({ msg: 'Checkout successful', orders: newOrders });
});

// Single Product Checkout
router.post('/checkout/:productId', verifyToken, async (req, res) => {
  const { productId } = req.params;
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ msg: 'User not found' });
  const cartItemIdx = user.cart.findIndex(item => String(item.productId) === String(productId));
  if (cartItemIdx === -1) return res.status(404).json({ msg: 'Product not in cart' });
  const item = user.cart[cartItemIdx];
  // Remove from cart
  user.cart.splice(cartItemIdx, 1);
  // Create order
  const today = new Date();
  const order = await Order.create({
    userId: user._id,
    productName: item.title,
    status: 'Placed', // Always start as Placed
    price: item.price * (item.quantity || 1),
    date: today.toISOString().slice(0, 10),
    deliveryDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  });
  console.log('Single product order created:', order); // Debug log
  user.orders.push(order._id.toString());
  await user.save();
  res.json({ msg: 'Order placed', order });
});

// Get current user info
router.get('/me', verifyToken, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ msg: 'User not found' });
  res.json({ email: user.email, phone: user.phone });
});

module.exports = router;
