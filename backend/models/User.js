const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: String,
  phone: String,
  password: String,
  orders: [String],
  cart: [
    {
      productId: Number,
      title: String,
      price: Number,
      thumbnail: String,
      quantity: { type: Number, default: 1 }
    }
  ],
  wishlist: [
    {
      productId: Number,
      title: String,
      price: Number,
      thumbnail: String
    }
  ]
});

module.exports = mongoose.model('User', userSchema);
