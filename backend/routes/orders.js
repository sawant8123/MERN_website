const express = require('express');
const jwt = require('jsonwebtoken');
const Order = require('../models/Order');
const router = express.Router();

function verifyToken(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ msg: 'No token' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ msg: 'Invalid token' });
    req.userId = decoded.userId;
    next();
  });
}

router.get('/', verifyToken, async (req, res) => {
  const orders = await Order.find({ userId: req.userId });
  res.json(orders);
});

router.post('/action', verifyToken, async (req, res) => {
  const { orderId, action } = req.body;
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ msg: 'Order not found' });

  switch (action) {
    case 'escalate':
      console.log('Issue escalated for:', orderId);
      break;
    case 'cancel':
      order.status = 'Cancelled';
      break;
    case 'return':
      order.status = 'Return Requested';
      break;
  }
  await order.save();
  res.json({ msg: `Action ${action} completed.` });
});

// Request a return for a delivered order
router.post('/:orderId/return', verifyToken, async (req, res) => {
  const { orderId } = req.params;
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ msg: 'Order not found' });
  if (order.status !== 'Delivered') return res.status(400).json({ msg: 'Return only allowed for delivered orders' });
  if (order.returnRequested) return res.status(400).json({ msg: 'Return already requested' });

  // Simulate reverse pickup
  function simulateReversePickup(orderId) {
    return {
      courier: 'Delhivery',
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: 'Pickup Scheduled'
    };
  }
  const pickup = simulateReversePickup(orderId);
  order.returnRequested = true;
  order.returnInfo = {
    status: pickup.status,
    pickupDate: pickup.scheduledDate.toISOString().slice(0, 10),
    courier: pickup.courier
  };
  await order.save();
  res.json({ msg: 'Return requested', order, pickup });
});

module.exports = router;
