const PATTERN = /_\d{6}@/;

const STORE_HASH = process.env.BC_STORE_HASH;
const TOKEN = process.env.BC_ACCESS_TOKEN;

const headers = {
  "X-Auth-Token": TOKEN,
  "Content-Type": "application/json",
  Accept: "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const id = payload && payload.data && payload.data.id;
  if (!id) {
    return { statusCode: 200, body: "Ignored" };
  }

  const getRes = await fetch(
    `https://api.bigcommerce.com/stores/${STORE_HASH}/v3/customers?id:in=${id}`,
    { headers }
  );
  const getJson = await getRes.json();
  const customer = getJson.data && getJson.data[0];

  if (!customer) {
    return { statusCode: 200, body: "No customer" };
  }

  const email = String(customer.email || "").toLowerCase();
  if (!PATTERN.test(email)) {
    return { statusCode: 200, body: "Kept" };
  }

  const ordersRes = await fetch(
    `https://api.bigcommerce.com/stores/${STORE_HASH}/v2/orders?customer_id=${id}&limit=1`,
    { headers }
  );
  const orders = await ordersRes.json();
  if (Array.isArray(orders) && orders.length > 0) {
    return { statusCode: 200, body: "Has orders, kept" };
  }

  await fetch(
    `https://api.bigcommerce.com/stores/${STORE_HASH}/v3/customers?id:in=${id}`,
    { method: "DELETE", headers }
  );

  return { statusCode: 200, body: `Deleted ${email}` };
};
