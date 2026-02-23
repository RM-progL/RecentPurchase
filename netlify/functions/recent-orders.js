javascript
// Netlify Function: recent-orders.js
// Fetches last 10 orders from BigCommerce and returns sanitized data

exports.handler = async (event, context) => {

// ============================================
// CONFIGURATION - You'll set these in Netlify Dashboard
// ============================================
const STORE_HASH = process.env.BC_STORE_HASH;
const ACCESS_TOKEN = process.env.BC_ACCESS_TOKEN;

// CORS headers - allows your storefront to call this function
const headers = {
'Access-Control-Allow-Origin': '*',
'Access-Control-Allow-Headers': 'Content-Type',
'Access-Control-Allow-Methods': 'GET, OPTIONS',
'Content-Type': 'application/json'
};

// Handle preflight requests
if (event.httpMethod === 'OPTIONS') {
return {
statusCode: 200,
headers,
body: ''
};
}

// Only allow GET requests
if (event.httpMethod !== 'GET') {
return {
statusCode: 405,
headers,
body: JSON.stringify({ error: 'Method not allowed' })
};
}

// Check if credentials are configured
if (!STORE_HASH || !ACCESS_TOKEN) {
console.error('Missing environment variables');
return {
statusCode: 500,
headers,
body: JSON.stringify({
error: 'Server configuration error',
message: 'Missing BC_STORE_HASH or BC_ACCESS_TOKEN environment variables'
})
};
}

try {
// Import fetch for Node.js
const fetch = require('node-fetch');

console.log('Fetching orders from BigCommerce...');

// Fetch last 10 orders with status "Awaiting Fulfillment" (status_id=2)
// Change to status_id=10 for "Completed" orders
const ordersResponse = await fetch(
`https://api.bigcommerce.com/stores/${STORE_HASH}/v2/orders?limit=10&sort=date_created:desc&status_id=2`,
{
headers: {
'X-Auth-Token': ACCESS_TOKEN,
'Content-Type': 'application/json',
'Accept': 'application/json'
}
}
);

if (!ordersResponse.ok) {
const errorText = await ordersResponse.text();
console.error('BigCommerce API error:', ordersResponse.status, errorText);
throw new Error(`BigCommerce API error: ${ordersResponse.status}`);
}

const orders = await ordersResponse.json();
console.log(`Found ${orders.length} orders`);

// Transform orders into widget format
const socialProofData = [];

for (const order of orders) {
// Get products in this order
const productsResponse = await fetch(
`https://api.bigcommerce.com/stores/${STORE_HASH}/v2/orders/${order.id}/products`,
{
headers: {
'X-Auth-Token': ACCESS_TOKEN,
'Content-Type': 'application/json',
'Accept': 'application/json'
}
}
);

if (!productsResponse.ok) {
console.error(`Error fetching products for order ${order.id}`);
continue;
}

const products = await productsResponse.json();
if (products.length === 0) continue;

// Take first product from order
const product = products[0];

// Get city from billing_address or shipping_addresses
const city = order.billing_address?.city ||
order.shipping_addresses?.[0]?.city ||
'Unknown Location';

// Get product image
let productImage = 'https://via.placeholder.com/200x200/CCCCCC/ffffff?text=No+Image';

// Try to get image from order product first
if (product.image_url) {
productImage = product.image_url;
} else if (product.product_id) {
// Fetch from catalog if not in order
try {
const catalogResponse = await fetch(
`https://api.bigcommerce.com/stores/${STORE_HASH}/v3/catalog/products/${product.product_id}`,
{
headers: {
'X-Auth-Token': ACCESS_TOKEN,
'Content-Type': 'application/json',
'Accept': 'application/json'
}
}
);

if (catalogResponse.ok) {
const catalogData = await catalogResponse.json();
if (catalogData.data?.images?.[0]?.url_thumbnail) {
productImage = catalogData.data.images[0].url_thumbnail;
}
}
} catch (err) {
console.error('Error fetching catalog image:', err);
}
}

// Build product URL
let productUrl = '#';
if (product.product_id) {
productUrl = `/products/${product.product_id}/`;
}

socialProofData.push({
city: city,
productName: product.name,
productImage: productImage,
productUrl: productUrl,
productId: product.product_id
});

// Stop at 10 items
if (socialProofData.length >= 10) break;
}

console.log(`Returning ${socialProofData.length} items`);

return {
statusCode: 200,
headers,
body: JSON.stringify(socialProofData)
};

} catch (error) {
console.error('Function error:', error);
return {
statusCode: 500,
headers,
body: JSON.stringify({
error: 'Failed to fetch orders',
message: error.message
})
};
}
};
