const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../modules/auth/models/User');
const Product = require('../modules/catalog/models/Product');
require('dotenv').config({ path: '../.env' });

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/enterprise_marketplace');
    console.log('DB Connected for Seeding');

    await User.deleteMany();
    await Product.deleteMany();

    // 1 Root Admin
    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@market.com',
      passwordHash: 'password123', 
      role: 'root_admin',
      status: 'active'
    });

    // 5 Product Owners
    const owners = [];
    for (let i = 1; i <= 5; i++) {
      const owner = await User.create({
        name: `Owner ${i}`,
        email: `owner${i}@market.com`,
        passwordHash: 'password123', 
        role: 'product_owner',
        status: 'approved'
      });
      owners.push(owner);
    }

    // 1 Customer
    const customer = await User.create({
      name: 'John Customer',
      email: 'customer@market.com',
      passwordHash: 'password123',
      role: 'customer'
    });

    // 25 Household Products
    const baseProducts = [
      { name: 'Cordless Vacuum Cleaner', description: 'Powerful and sleek cordless vacuum for all floors.', category: 'Household', price: 299, image: '/images/vacuum_cleaner.png' },
      { name: 'Premium Espresso Maker', description: 'Stainless steel coffee maker for barista-level espresso.', category: 'Kitchen', price: 499, image: '/images/coffee_maker.png' },
      { name: 'High-Speed Blender', description: 'Blend smoothies and soups with a durable glass pitcher.', category: 'Kitchen', price: 150, image: '/images/blender.png' },
      { name: 'Retro Stand Mixer', description: 'Pastel blue stand mixer for all your baking needs.', category: 'Kitchen', price: 350, image: '/images/stand_mixer.png' },
      { name: 'Smart Air Purifier', description: 'Minimalist white air purifier with HEPA filter.', category: 'Household', price: 199, image: '/images/air_purifier.png' }
    ];

    const allProducts = [];
    let idCounter = 1;
    for (let i = 0; i < 25; i++) {
      const baseProduct = baseProducts[i % 5];
      const owner = owners[i % 5]; // distribute among 5 owners
      allProducts.push({
        ownerId: owner._id,
        name: `${baseProduct.name} V${Math.floor(i / 5) + 1}`,
        description: baseProduct.description,
        category: baseProduct.category,
        price: baseProduct.price + (Math.floor(i / 5) * 10), // slight price variation
        stock: Math.floor(Math.random() * 50) + 1, // 1 to 50
        lowStockThreshold: 5,
        images: [baseProduct.image],
        avgRating: 0
      });
    }

    await Product.create(allProducts);

    console.log('Data seeded successfully!');
    console.log('--- CREDENTIALS ---');
    console.log('Root Admin: admin@market.com / password123');
    for (let i = 1; i <= 5; i++) {
      console.log(`Product Owner ${i}: owner${i}@market.com / password123`);
    }
    console.log('Customer: customer@market.com / password123');
    
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedData();
