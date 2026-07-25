const Product = require('../../catalog/models/Product');
const InventoryLog = require('../models/InventoryLog');
const { publishEvent } = require('../../../config/kafka');

// @desc    Update stock for a product
// @route   POST /api/inventory/:productId
exports.updateStock = async (req, res) => {
  try {
    const { change, reason } = req.body;
    const productId = req.params.productId;

    // The product is already prefetched and ownership checked via middleware
    const product = req.resource;

    if (product.stock + change < 0) {
      return res.status(400).json({ message: 'Stock cannot go below 0' });
    }

    product.stock += change;

    // Reset low stock alert if it was alerted and now stock is above threshold
    if (product.stock > product.lowStockThreshold) {
      product.lowStockAlerted = false;
    } else if (product.stock <= product.lowStockThreshold && !product.lowStockAlerted) {
      // It just crossed the threshold, fire event
      product.lowStockAlerted = true;
      // We will actually emit the event after saving
      req.fireLowStockEvent = true; 
    }

    await product.save();

    await InventoryLog.create({
      productId,
      change,
      reason
    });

    if (req.fireLowStockEvent) {
      await publishEvent('inventory.low-stock', product._id, {
        productId: product._id,
        productName: product.name,
        stock: product.stock,
        ownerId: product.ownerId
      });
    }

    await publishEvent('inventory.updated', product._id, {
      productId: product._id,
      stock: product.stock
    });

    res.json({ message: 'Stock updated', stock: product.stock });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get low-stock products
// @route   GET /api/inventory/low-stock
exports.getLowStock = async (req, res) => {
  try {
    const userRole = req.user.role;
    
    // Using aggregation to dynamically check $lte threshold
    const matchStage = {
      $expr: { $lte: ['$stock', '$lowStockThreshold'] }
    };

    if (userRole === 'product_owner') {
      matchStage.ownerId = req.user._id;
    } else if (userRole !== 'root_admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const lowStockProducts = await Product.aggregate([
      { $match: matchStage },
      { $sort: { stock: 1 } }
    ]);

    res.json(lowStockProducts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
