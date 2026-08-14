const { publishEvent } = require('../../../config/kafka');

/**
 * Checks a product's stock against its lowStockThreshold and updates lowStockAlerted if needed.
 * Emits a Kafka event if it crosses the threshold.
 * 
 * @param {Object} product - The mongoose Product document
 * @returns {Promise<boolean>} True if the product document was modified and needs to be saved
 */
const checkAndFireLowStock = async (product) => {
  let needsSave = false;

  if (product.stock > product.lowStockThreshold && product.lowStockAlerted) {
    product.lowStockAlerted = false;
    needsSave = true;
  } else if (product.stock <= product.lowStockThreshold && !product.lowStockAlerted) {
    product.lowStockAlerted = true;
    needsSave = true;
    
    // Fire event
    await publishEvent('inventory.low-stock', product._id.toString(), {
      productId: product._id,
      productName: product.name,
      stock: product.stock,
      ownerId: product.ownerId
    });
  }

  return needsSave;
};

module.exports = { checkAndFireLowStock };
