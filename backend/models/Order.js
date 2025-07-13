const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  productName: String,
  status: String,
  price: Number,
  date: String,
  deliveryDate: String,
  returnRequested: { type: Boolean, default: false },
  returnInfo: {
    status: String,
    pickupDate: String,
    courier: String
  }
});

module.exports = mongoose.model('Order', orderSchema);
