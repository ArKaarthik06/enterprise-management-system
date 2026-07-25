const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  category: {
    type: String,
    required: true,
    index: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  lowStockThreshold: {
    type: Number,
    default: 5,
  },
  lowStockAlerted: {
    type: Boolean,
    default: false,
  },
  images: [{
    type: String,
  }],
  avgRating: {
    type: Number,
    default: 0,
  }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
