const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../modules/auth/models/User');
const Product = require('../modules/catalog/models/Product');
const Review = require('../modules/catalog/models/Review');
const Order = require('../modules/orders/models/Order');

const CITIES = [
  { city: 'New York', state: 'NY', country: 'USA', zip: '10001', street: '350 5th Avenue' },
  { city: 'Los Angeles', state: 'CA', country: 'USA', zip: '90028', street: '6801 Hollywood Boulevard' },
  { city: 'Chicago', state: 'IL', country: 'USA', zip: '60606', street: '233 S Wacker Drive' },
  { city: 'San Francisco', state: 'CA', country: 'USA', zip: '94105', street: '1 Market Street' },
  { city: 'Seattle', state: 'WA', country: 'USA', zip: '98101', street: '400 Pine Street' },
  { city: 'Austin', state: 'TX', country: 'USA', zip: '78701', street: '1100 Congress Avenue' },
  { city: 'Miami', state: 'FL', country: 'USA', zip: '33131', street: '100 Biscayne Boulevard' },
  { city: 'London', state: 'Greater London', country: 'UK', zip: 'SW1A 2AA', street: '10 Downing Street' },
  { city: 'New Delhi', state: 'Delhi', country: 'India', zip: '110001', street: '33/1212 Gandhi Street' },
  { city: 'Dubai', state: 'Dubai', country: 'UAE', zip: '00000', street: 'Sheikh Zayed Road' },
];

const REVIEW_TEMPLATES = {
  Household: {
    positive: [
      { rating: 5, comment: 'Outstanding suction power! Cleans pet hair from carpets and rugs effortlessly.' },
      { rating: 5, comment: 'Very lightweight and the battery easily lasts through our entire home.' },
      { rating: 4, comment: 'Great build quality, accessories snap on cleanly and wall mount is super convenient.' },
      { rating: 5, comment: 'Noticeable difference in air freshness within an hour. Allergy symptoms improved dramatically.' },
      { rating: 4, comment: 'Super quiet in sleep mode and the smart sensor accurately displays air quality.' },
      { rating: 5, comment: 'Sleek design, fits modern decor nicely, and very intuitive to operate.' },
    ],
    mixed: [
      { rating: 3, comment: 'Good unit overall, but the dustbin fills up rather quickly.' },
      { rating: 3, comment: 'Decent performance, but replacement filters are somewhat pricey.' },
    ],
    critical: [
      { rating: 2, comment: 'Battery life degraded noticeably after 3 months of heavy daily use.' },
      { rating: 2, comment: 'Quite noisy on high speed mode and filters are often out of stock.' },
    ],
  },
  Kitchen: {
    positive: [
      { rating: 5, comment: 'Pulling cafe-quality espresso shots at home! The crema is thick and velvety.' },
      { rating: 5, comment: 'Heats up in seconds and the steam wand creates silky microfoam for latte art.' },
      { rating: 4, comment: 'Solid stainless steel body, feels very premium and durable on the counter.' },
      { rating: 5, comment: 'Blends frozen fruits and leafy greens completely smooth in under 30 seconds.' },
      { rating: 5, comment: 'Crushes ice like powder! Perfect for daily smoothies and protein shakes.' },
      { rating: 4, comment: 'The retro pastel color is gorgeous and it kneads heavy dough effortlessly.' },
      { rating: 5, comment: 'Planetary mixing action reaches every edge of the bowl. Baking is a joy with this.' },
    ],
    mixed: [
      { rating: 3, comment: 'Makes good coffee but the drip tray is small and needs frequent emptying.' },
      { rating: 3, comment: 'Blender is very loud at maximum speed, though it gets the job done.' },
    ],
    critical: [
      { rating: 2, comment: 'The motor gets noticeably warm during continuous blending sessions.' },
      { rating: 2, comment: 'Slight learning curve and the grinder attachment jammed on oily beans.' },
    ],
  },
};

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/enterprise_marketplace';
    console.log(`Connecting to MongoDB at: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // 1. Preserve ark123's existing passwordHash if present
    const existingArk = await User.findOne({ email: 'ark123@gmail.com' });
    const arkPasswordHash = existingArk ? existingArk.passwordHash : null;

    // Clean existing users, reviews, orders (we'll re-seed products cleanly)
    console.log('Cleaning existing collections...');
    await User.deleteMany({});
    await Review.deleteMany({});
    await Order.deleteMany({});
    await Product.deleteMany({});

    // 2. Seed Users
    console.log('Seeding Users...');
    // Root Admin
    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@market.com',
      passwordHash: 'password123',
      role: 'root_admin',
      status: 'active',
      phone: '+1-555-0100',
      defaultAddress: {
        street: '100 Enterprise Way',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA',
      },
    });

    // 5 Product Owners
    const owners = [];
    for (let i = 1; i <= 5; i++) {
      const owner = await User.create({
        name: `Owner ${i}`,
        email: `owner${i}@market.com`,
        passwordHash: 'password123',
        role: 'product_owner',
        status: 'active',
        businessName: `Owner ${i} Appliances & Electronics`,
        businessDescription: `Official marketplace partner store for Owner ${i}`,
        phone: `+1-555-020${i}`,
        defaultAddress: CITIES[(i - 1) % CITIES.length],
      });
      owners.push(owner);
    }

    // Default Customer
    const customer = await User.create({
      name: 'John Customer',
      email: 'customer@market.com',
      passwordHash: 'password123',
      role: 'customer',
      status: 'active',
      phone: '+1-555-0147',
      defaultAddress: {
        street: '742 Evergreen Terrace',
        city: 'Springfield',
        state: 'OR',
        zip: '97477',
        country: 'USA',
      },
    });

    // User's testing customer account: ark123@gmail.com
    let ark;
    if (arkPasswordHash) {
      // Re-create with exact existing password hash without re-hashing
      ark = new User({
        name: 'ark',
        email: 'ark123@gmail.com',
        passwordHash: 'temp',
        role: 'customer',
        status: 'active',
        phone: '+91-9876543210',
        defaultAddress: {
          street: '33/1212 Gandhi Street',
          city: 'New Delhi',
          state: 'Delhi',
          zip: '110001',
          country: 'India',
        },
      });
      // Bypass pre-save hashing so original user password remains valid
      ark.passwordHash = arkPasswordHash;
      await ark.save({ validateBeforeSave: false });
    } else {
      ark = await User.create({
        name: 'ark',
        email: 'ark123@gmail.com',
        passwordHash: 'password123',
        role: 'customer',
        status: 'active',
        phone: '+91-9876543210',
        defaultAddress: {
          street: '33/1212 Gandhi Street',
          city: 'New Delhi',
          state: 'Delhi',
          zip: '110001',
          country: 'India',
        },
      });
    }

    // 8 Additional Customers for rich multi-user interaction
    const additionalCustomerSpecs = [
      { name: 'Alice Smith', email: 'alice.smith@example.com', phone: '+1-212-555-0111', cityIdx: 0 },
      { name: 'Bob Jones', email: 'bob.jones@example.com', phone: '+1-310-555-0122', cityIdx: 1 },
      { name: 'Clara Oswald', email: 'clara.oswald@example.com', phone: '+44-20-7946-0133', cityIdx: 7 },
      { name: 'David Miller', email: 'david.miller@example.com', phone: '+1-312-555-0144', cityIdx: 2 },
      { name: 'Emma Watson', email: 'emma.watson@example.com', phone: '+1-415-555-0155', cityIdx: 3 },
      { name: 'Frank Castle', email: 'frank.castle@example.com', phone: '+1-512-555-0166', cityIdx: 5 },
      { name: 'Grace Hopper', email: 'grace.hopper@example.com', phone: '+1-206-555-0177', cityIdx: 4 },
      { name: 'Hassan Ali', email: 'hassan.ali@example.com', phone: '+971-4-555-0188', cityIdx: 9 },
    ];

    const extraCustomers = [];
    for (const spec of additionalCustomerSpecs) {
      const cityData = CITIES[spec.cityIdx];
      const c = await User.create({
        name: spec.name,
        email: spec.email,
        passwordHash: 'password123',
        role: 'customer',
        status: 'active',
        phone: spec.phone,
        defaultAddress: {
          street: cityData.street,
          city: cityData.city,
          state: cityData.state,
          zip: cityData.zip,
          country: cityData.country,
        },
      });
      extraCustomers.push(c);
    }

    const allCustomers = [customer, ark, ...extraCustomers];
    console.log(`✓ Seeded ${1 + owners.length + allCustomers.length} total users (1 Admin, ${owners.length} Owners, ${allCustomers.length} Customers)`);

    // 3. Seed Products
    console.log('Seeding 25 Products...');
    const baseProducts = [
      { name: 'Cordless Vacuum Cleaner', description: 'Powerful and sleek cordless vacuum with HEPA filtration for all floor types.', category: 'Household', price: 299, image: '/images/vacuum_cleaner.png', lowStockThreshold: 5 },
      { name: 'Premium Espresso Maker', description: '15-bar Italian pump stainless steel coffee maker for barista-level espresso and lattes.', category: 'Kitchen', price: 499, image: '/images/coffee_maker.png', lowStockThreshold: 5 },
      { name: 'High-Speed Blender', description: 'High-torque 1400W blender with durable tempered glass pitcher for smoothies, soups and ice.', category: 'Kitchen', price: 150, image: '/images/blender.png', lowStockThreshold: 5 },
      { name: 'Retro Stand Mixer', description: 'Classic die-cast stand mixer with 10-speed planetary action for all your baking and dough needs.', category: 'Kitchen', price: 350, image: '/images/stand_mixer.png', lowStockThreshold: 5 },
      { name: 'Smart Air Purifier', description: 'Minimalist true-HEPA air purifier with laser particle sensor, app monitoring and silent sleep mode.', category: 'Household', price: 199, image: '/images/air_purifier.png', lowStockThreshold: 5 }
    ];

    const products = [];
    for (let i = 0; i < 25; i++) {
      const baseProduct = baseProducts[i % 5];
      const owner = owners[i % 5];
      const version = Math.floor(i / 5) + 1;
      
      // Stock levels: introduce a couple of low-stock items so get_low_stock_items has data
      let stock = 15 + ((i * 7) % 35);
      if (i === 2) stock = 3;  // High-Speed Blender V1 (low stock!)
      if (i === 7) stock = 4;  // Smart Air Purifier V2 (low stock!)
      if (i === 11) stock = 2; // Retro Stand Mixer V3 (low stock!)

      const p = await Product.create({
        ownerId: owner._id,
        name: `${baseProduct.name} V${version}`,
        description: baseProduct.description,
        category: baseProduct.category,
        price: baseProduct.price + (Math.floor(i / 5) * 10),
        stock,
        lowStockThreshold: baseProduct.lowStockThreshold,
        lowStockAlerted: stock <= baseProduct.lowStockThreshold,
        images: [baseProduct.image],
        avgRating: 0,
        reviews: [],
      });
      products.push(p);
    }
    console.log(`✓ Seeded ${products.length} products`);

    // 4. Seed Ratings & Reviews
    console.log('Seeding Ratings and Reviews across products...');
    let totalReviewsCount = 0;

    for (let pIdx = 0; pIdx < products.length; pIdx++) {
      const product = products[pIdx];
      const isNegativeSpotlight = (pIdx === 2 || pIdx === 7); // High-Speed Blender V1 and Smart Air Purifier V2
      const reviewCount = 2 + (pIdx % 3); // 2 to 4 reviews per product

      // Shuffle customers to pick unique reviewers
      const shuffledCustomers = [...allCustomers].sort(() => 0.5 - Math.random()).slice(0, reviewCount);
      const catTemplates = REVIEW_TEMPLATES[product.category];
      const embeddedReviews = [];
      let ratingSum = 0;

      for (let rIdx = 0; rIdx < shuffledCustomers.length; rIdx++) {
        const reviewer = shuffledCustomers[rIdx];
        let chosen;

        if (isNegativeSpotlight && rIdx === 0) {
          chosen = catTemplates.critical[pIdx % catTemplates.critical.length];
        } else if (isNegativeSpotlight && rIdx === 1) {
          chosen = catTemplates.mixed[pIdx % catTemplates.mixed.length];
        } else if (rIdx % 4 === 3) {
          chosen = catTemplates.mixed[rIdx % catTemplates.mixed.length];
        } else {
          chosen = catTemplates.positive[(pIdx + rIdx) % catTemplates.positive.length];
        }

        const daysAgo = 5 + ((pIdx * 3 + rIdx * 7) % 50);
        const reviewDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

        // Save to Review collection
        await Review.create({
          productId: product._id,
          userId: reviewer._id,
          rating: chosen.rating,
          comment: chosen.comment,
          createdAt: reviewDate,
          updatedAt: reviewDate,
        });

        // Add to embedded array
        embeddedReviews.push({
          userId: reviewer._id,
          rating: chosen.rating,
          comment: chosen.comment,
          createdAt: reviewDate,
        });

        ratingSum += chosen.rating;
        totalReviewsCount++;
      }

      product.reviews = embeddedReviews;
      product.avgRating = Number((ratingSum / embeddedReviews.length).toFixed(1));
      await product.save();
    }
    console.log(`✓ Seeded ${totalReviewsCount} reviews; updated avgRating on all 25 products`);

    // 5. Seed 50 Orders
    console.log('Seeding 50 Orders...');
    // We want 50 realistic orders:
    // 25 orders in the last 30 days (current period for getSalesInsights)
    // 25 orders 31 to 60 days ago (previous period for getSalesInsights comparison)
    //
    // Status distribution:
    // delivered: 26
    // confirmed: 12
    // shipped: 5
    // pending: 4 (test cancel_order)
    // cancelled: 2
    // failed: 1
    // Total = 50

    // Assign specific orders for ark123@gmail.com and customer@market.com so they can test their own orders
    // ark: 6 orders (Order 0..5)
    // customer: 6 orders (Order 6..11)
    // extraCustomers (8 users): remaining 38 orders (~4-5 each)

    const buyerAssignments = [];
    // 6 for ark
    for (let k = 0; k < 6; k++) buyerAssignments.push(ark);
    // 6 for customer
    for (let k = 0; k < 6; k++) buyerAssignments.push(customer);
    // 38 for the remaining 8 customers
    for (let k = 0; k < 38; k++) {
      buyerAssignments.push(extraCustomers[k % extraCustomers.length]);
    }

    const orderStatuses = [
      // 0..5 (ark's orders)
      'delivered', 'confirmed', 'pending', 'shipped', 'delivered', 'delivered',
      // 6..11 (customer's orders)
      'pending', 'confirmed', 'cancelled', 'delivered', 'delivered', 'delivered',
      // 12..49 (other customers)
      'delivered', 'confirmed', 'delivered', 'shipped', 'delivered',
      'confirmed', 'delivered', 'delivered', 'pending', 'delivered',
      'confirmed', 'delivered', 'shipped', 'delivered', 'confirmed',
      'delivered', 'delivered', 'failed', 'confirmed', 'delivered',
      'shipped', 'delivered', 'confirmed', 'delivered', 'delivered',
      'delivered', 'confirmed', 'delivered', 'cancelled', 'delivered',
      'confirmed', 'delivered', 'delivered', 'pending', 'delivered',
      'confirmed', 'delivered', 'delivered'
    ];

    // Ensure we have exactly 50 status entries
    while (orderStatuses.length < 50) orderStatuses.push('delivered');
    orderStatuses.length = 50;

    const ordersToInsert = [];
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      const buyer = buyerAssignments[i];
      const status = orderStatuses[i];

      // Time distribution:
      // Orders 0..24: recent (1 to 29 days ago)
      // Orders 25..49: older (31 to 59 days ago)
      let daysAgo;
      if (i < 25) {
        // Recent: 1 to 29 days ago
        daysAgo = 1 + Math.floor((i / 24) * 28);
      } else {
        // Previous period: 31 to 59 days ago
        daysAgo = 31 + Math.floor(((i - 25) / 24) * 28);
      }

      // If pending or confirmed, make sure it's recent (1 to 5 days ago)
      if (status === 'pending') {
        daysAgo = 1 + (i % 3); // 1 to 3 days ago
      } else if (status === 'confirmed' && daysAgo > 25) {
        daysAgo = 2 + (i % 8); // 2 to 9 days ago
      }

      const orderDate = new Date(now - daysAgo * DAY_MS - (i * 37 * 60 * 1000));

      // Pick 1 to 3 items
      const itemCount = (i % 3 === 0) ? 2 : (i % 7 === 0 ? 3 : 1);
      const items = [];
      const usedProducts = new Set();

      for (let itemIdx = 0; itemIdx < itemCount; itemIdx++) {
        const productIndex = (i * 3 + itemIdx * 7) % products.length;
        if (usedProducts.has(productIndex)) continue;
        usedProducts.add(productIndex);

        const prod = products[productIndex];
        const quantity = 1 + (itemIdx % 2); // 1 or 2 units

        items.push({
          productId: prod._id,
          quantity,
          priceAtPurchase: prod.price,
        });
      }

      // Address: from buyer's default or a city variant
      const addrCity = CITIES[(i * 3) % CITIES.length];
      const deliveryAddress = buyer.defaultAddress && buyer.defaultAddress.city
        ? {
            line1: buyer.defaultAddress.street || addrCity.street,
            city: buyer.defaultAddress.city,
            state: buyer.defaultAddress.state || addrCity.state,
            zip: buyer.defaultAddress.zip || addrCity.zip,
            country: buyer.defaultAddress.country || addrCity.country,
          }
        : {
            line1: addrCity.street,
            city: addrCity.city,
            state: addrCity.state,
            zip: addrCity.zip,
            country: addrCity.country,
          };

      const failureReason = status === 'failed'
        ? 'Payment authorization declined by card issuer: insufficient funds.'
        : null;

      const orderDoc = new Order({
        buyerId: buyer._id,
        items,
        status,
        failureReason,
        idempotencyKey: `seed-order-${i + 1}-${buyer._id.toString().slice(-4)}`,
        deliveryAddress,
        createdAt: orderDate,
        updatedAt: orderDate,
      });

      ordersToInsert.push(orderDoc);
    }

    // Save all 50 orders
    for (const order of ordersToInsert) {
      await order.save();
    }
    console.log(`✓ Seeded ${ordersToInsert.length} orders successfully!`);

    // 6. Summary Statistics
    const finalUserCount = await User.countDocuments();
    const finalProductCount = await Product.countDocuments();
    const finalReviewCount = await Review.countDocuments();
    const finalOrderCount = await Order.countDocuments();

    const ordersByStatus = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const arkOrdersCount = await Order.countDocuments({ buyerId: ark._id });
    const customerOrdersCount = await Order.countDocuments({ buyerId: customer._id });

    console.log('\n================ DATABASE SEED SUMMARY ================');
    console.log(`Total Users:    ${finalUserCount}`);
    console.log(`Total Products: ${finalProductCount}`);
    console.log(`Total Reviews:  ${finalReviewCount}`);
    console.log(`Total Orders:   ${finalOrderCount}`);
    console.log('Orders by Status:', ordersByStatus.map(s => `${s._id}: ${s.count}`).join(', '));
    console.log(`Orders for ark123@gmail.com:    ${arkOrdersCount}`);
    console.log(`Orders for customer@market.com: ${customerOrdersCount}`);
    console.log('-------------------------------------------------------');
    console.log('CREDENTIALS:');
    console.log('Root Admin:      admin@market.com / password123');
    console.log('Product Owners:  owner1@market.com through owner5@market.com / password123');
    console.log('Customer:        customer@market.com / password123');
    console.log('User Account:    ark123@gmail.com (original password preserved)');
    console.log('Extra Customers: alice.smith@example.com, etc. / password123');
    console.log('=======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedData();
