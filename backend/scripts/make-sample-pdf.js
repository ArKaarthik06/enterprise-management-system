// Creates a sample PDF (product warranty guide) so you can see PDF ingestion working.
// Run once:  node scripts/make-sample-pdf.js
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit'); // dev dependency

const out = path.join(__dirname, '../modules/ai/rag/documents/product-warranty-guide.pdf');
const doc = new PDFDocument({ margin: 60, compress: false });
doc.pipe(fs.createWriteStream(out));

doc.fontSize(20).text('Product Warranty Guide');
doc.moveDown();
const sections = [
  ['What the warranty covers', 'Every new product sold on Enterprise Marketplace comes with a manufacturer warranty against defects in materials and workmanship. Standard warranty periods: Kitchen appliances 2 years, Household appliances 2 years, batteries and rechargeable parts 1 year, small accessories 6 months.'],
  ['What the warranty does not cover', 'Normal wear and tear, damage caused by drops or water, use with the wrong voltage, unapproved repairs, cosmetic scratches and consumables such as filters and gaskets.'],
  ['How to claim', 'Keep your order confirmation as proof of purchase. Open My Orders, choose the order and select Warranty claim. Describe the problem and add photos. A claim decision is made within 3 business days. Approved claims are repaired or replaced; if neither is possible you receive a refund of the price you paid.'],
  ['Extended warranty', 'An extended warranty of one extra year can be bought within 30 days of delivery for 10% of the product price. It cannot be added later and is not refundable after 14 days.'],
  ['Registering your product', 'Registering is not required for the standard warranty. Registering lets us notify you about safety recalls.'],
];
sections.forEach(([h, body]) => {
  doc.fontSize(14).text(h).moveDown(0.3);
  doc.fontSize(11).text(body).moveDown();
});
doc.end();
console.log('Created', out);
