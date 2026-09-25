const PATTERN = /_\d{6}@/;

const STORE_HASH = process.env.BC_STORE_HASH;
const TOKEN = process.env.BC_CUSTOMERS_TOKEN;

const headers = {
  "X-Auth-Token": TOKEN,
  "Content-Type": "application/json",
  Accept: "application/json",
};

exports.handler = async (event) => {
  console.log("method", event.httpMethod);
  console.log("body", event.body);
  console.log("hasStoreHash", Boolean(STORE_HASH));
  console.log("hasToken", Boolean(TOKEN));

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    console.log("bad json");
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const id = payload && payload.data && payload.data.id;
  console.log("customer id", id);
  if (!id) {
    return { statusCode: 200, body: "Ignored" };
  }

  const getRes = await fetch(
    `https://api.bigcommerce.com/stores/${STORE_HASH}/v3/customers?id:in=${id}`,
    { headers }
  );
  const getJson = await getRes.json();
  console.log("get status", getRes.status);
  console.log("get json", JSON.stringify(getJson));

  const customer = getJson.data && getJson.data[0];
  if (!customer) {
    return { statusCode: 200, body: "No customer" };
  }

  const email = String(customer.email || "").toLowerCase();
  console.log("email", email);

  if (!PATTERN.test(email)) {
    console.log("Kept");
    return { statusCode: 200, body: "Kept" };
  }

  const ordersRes = await fetch(
    `https://api.bigcommerce.com/stores/${STORE_HASH}/v2/orders?customer_id=${id}&limit=1`,
    { headers }
  );
  const orders = await ordersRes.json();
  console.log("orders status", ordersRes.status);

  if (Array.isArray(orders) && orders.length > 0) {
    console.log("Has orders, kept");
    return { statusCode: 200, body: "Has orders, kept" };
  }

  const delRes = await fetch(
    `https://api.bigcommerce.com/stores/${STORE_HASH}/v3/customers?id:in=${id}`,
    { method: "DELETE", headers }
  );
  console.log("delete status", delRes.status);
  console.log("Deleted", email);

  return { statusCode: 200, body: `Deleted ${email}` };
};
