// Netlify Function: recent-orders.js
// Fetches last 10 orders from BigCommerce and returns sanitized data

export const handler = async (event, context) => {  // Use ESM export if "type": "module"; otherwise keep as exports.handler
  // ============================================
  // CONFIGURATION - You'll set these in Netlify Dashboard
  // ============================================
  const STORE_HASH = process.env.BC_STORE_HASH;
  const ACCESS_TOKEN = process.env.BC_ACCESS_TOKEN;

  // CORS headers - allows your storefront to call this function
  // Restrict origin to your domain for better security
  const headers = {
    'Access-Control-Allow-Origin': '*',  // Change to 'https://your-site.netlify.app' in production
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
    console.log('Fetching orders from BigCommerce...');

    // Allow configurable status_id via query param (default: 2 for Awaiting Fulfillment)
    const statusId = event.queryStringParameters?.status_id || '2';

    // Fetch last 10 orders
    const ordersResponse = await fetch(
      `https://api.bigcommerce.com/stores/${STORE_HASH}/v2/orders?limit=10&sort=date_created:desc&status_id=${statusId}`,
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

    // Transform orders into widget format (parallelize for performance)
    const socialProofPromises = orders.map(async (order) => {
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
        return null;
      }

      const products = await productsResponse.json();
      if (products.length === 0) return null;

      // Take first product from order
      const product = products[0];

      // Get city from billing_address or shipping_addresses
      const city = order.billing_address?.city ||
        order.shipping_addresses?.[0]?.city ||
        'Unknown Location';

      // Get product image and URL from catalog (V3 API)
      let productImage = 'https://via.placeholder.com/200x200/CCCCCC/ffffff?text=No+Image';
      let productUrl = '#';

      if (product.product_id) {
        try {
          const catalogResponse = await fetch(
            `https://api.bigcommerce.com/stores/${STORE_HASH}/v3/catalog/products/${product.product_id}?include=images`,
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
            if (catalogData.data?.custom_url?.url) {
              productUrl = catalogData.data.custom_url.url;
            }
          }
        } catch (err) {
          console.error('Error fetching catalog data:', err);
        }
      }

      return {
        city: city,
        productName: product.name,
        productImage: productImage,
        productUrl: productUrl,
        productId: product.product_id
      };
    });

    const socialProofData = (await Promise.all(socialProofPromises)).filter(Boolean).slice(0, 10);

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