exports.handler = async (event, context) => {

const STORE_HASH = process.env.BC_STORE_HASH;
const ACCESS_TOKEN = process.env.BC_ACCESS_TOKEN;

const headers = {
'Access-Control-Allow-Origin': '*',
'Access-Control-Allow-Headers': 'Content-Type',
'Access-Control-Allow-Methods': 'GET, OPTIONS',
'Content-Type': 'application/json'
};

if (event.httpMethod === 'OPTIONS') {
return { statusCode: 200, headers, body: '' };
}

if (event.httpMethod !== 'GET') {
return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
}

if (!STORE_HASH || !ACCESS_TOKEN) {
return {
statusCode: 500,
headers,
body: JSON.stringify({ error: 'Missing credentials' })
};
}

try {
const fetch = require('node-fetch');

const url1 = 'https://api.bigcommerce.com/stores/' + STORE_HASH + '/v2/orders?limit=10&sort=date_created:desc&status_id=2';

const ordersResponse = await fetch(url1, {
headers: {
'X-Auth-Token': ACCESS_TOKEN,
'Content-Type': 'application/json',
'Accept': 'application/json'
}
});

if (!ordersResponse.ok) {
throw new Error('API error');
}

const orders = await ordersResponse.json();
const socialProofData = [];

for (const order of orders) {
const url2 = 'https://api.bigcommerce.com/stores/' + STORE_HASH + '/v2/orders/' + order.id + '/products';

const productsResponse = await fetch(url2, {
headers: {
'X-Auth-Token': ACCESS_TOKEN,
'Content-Type': 'application/json',
'Accept': 'application/json'
}
});

if (!productsResponse.ok) continue;

const products = await productsResponse.json();
if (products.length === 0) continue;

const product = products[0];

let city = 'Unknown Location';
if (order.billing_address && order.billing_address.city) {
city = order.billing_address.city;
} else if (order.shipping_addresses && order.shipping_addresses[0] && order.shipping_addresses[0].city) {
city = order.shipping_addresses[0].city;
}

let productImage = 'https://via.placeholder.com/200x200/CCCCCC/ffffff?text=No+Image';

if (product.image_url) {
productImage = product.image_url;
} else if (product.product_id) {
try {
const url3 = 'https://api.bigcommerce.com/stores/' + STORE_HASH + '/v3/catalog/products/' + product.product_id;

const catalogResponse = await fetch(url3, {
headers: {
'X-Auth-Token': ACCESS_TOKEN,
'Content-Type': 'application/json',
'Accept': 'application/json'
}
});

if (catalogResponse.ok) {
const catalogData = await catalogResponse.json();
if (catalogData.data && catalogData.data.images && catalogData.data.images[0] && catalogData.data.images[0].url_thumbnail) {
productImage = catalogData.data.images[0].url_thumbnail;
}
}
} catch (err) {
// Ignore error
}
}

let productUrl = '#';
if (product.product_id) {
productUrl = '/products/' + product.product_id + '/';
}

socialProofData.push({
city: city,
productName: product.name,
productImage: productImage,
productUrl: productUrl,
productId: product.product_id
});

if (socialProofData.length >= 10) break;
}

return {
statusCode: 200,
headers,
body: JSON.stringify(socialProofData)
};

} catch (error) {
return {
statusCode: 500,
headers,
body: JSON.stringify({ error: 'Function error', message: error.message })
};
}
};