/* POST /checkout  (deduct GZM and simulate order) */
app.post("/checkout", (req, res) => {
  const email = (req.body.email || "").trim();
  const total = Number(req.body.total);

  if (!email || isNaN(total) || total <= 0)
    return res.status(400).json({ error: "Invalid email or total amount" });

  if (!wallet[email]) wallet[email] = { balance: 0 };

  if (wallet[email].balance < total)
    return res.status(402).json({ error: "Insufficient balance" });

  // Deduct GizmoCoin
  wallet[email].balance -= total;

  // Simulate order confirmation
  res.json({
    message: "Checkout successful",
    remaining: wallet[email].balance,
    cart: req.body.cart || []
  });
});


/* POST /convert  { email, usd }  →  add GZM */
app.post("/convert", (req, res) => {
  const email = (req.body.email || "").trim();
  const usd   = Number(req.body.usd);
  const RATE  = 1 / 25;               // 25 USD → 1 GZM

  if (!email || isNaN(usd))
    return res.status(400).json({ success: false, message: "Missing or invalid email/USD" });

  const addGZM = +(usd * RATE).toFixed(4);
  if (!wallet[email]) wallet[email] = { balance: 0 };
  wallet[email].balance += addGZM;

  res.json({ success: true, gizmo: addGZM, balance: wallet[email].balance });
});

/*─────────────────────────────────────────────────────────────*/
/*  POST /create-discount  { amount }  →  GZM-$$ discount code */
/*─────────────────────────────────────────────────────────────*/
app.post("/create-discount", async (req, res) => {
  console.log("🔥  /create-discount hit:", req.body);

  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    console.log("❌ Invalid amount:", amount);
    return res.status(400).send("Bad amount");
  }

  const STORE = process.env.SHOPIFY_STORE;      // e.g. mystore.myshopify.com
  const TOKEN = process.env.SHOPIFY_TOKEN;      // Admin API access token
  if (!STORE || !TOKEN) {
    console.log("❌ Missing Shopify env vars:", { STORE, TOKEN: !!TOKEN });
    return res.status(500).send("Shopify env vars missing");
  }

  const API_VER = "2024-04";
  const ADMIN   = `https://${STORE}/admin/api/${API_VER}`;

  try {
    const code = `GZM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const now  = new Date();
    const ends = new Date(now.getTime() + 10 * 60 * 1000);   // +10 min

    /* 1️⃣  Create price rule */
    const prRes = await axios.post(
      `${ADMIN}/price_rules.json`,
      {
        price_rule: {
          title:              code,
          target_type:        "line_item",
          target_selection:   "all",
          allocation_method:  "across",
          value_type:         "fixed_amount",
          value:              `-${amount.toFixed(2)}`,  // Shopify expects string!
          customer_selection: "all",
          starts_at:          now.toISOString(),
          ends_at:            ends.toISOString(),
          once_per_customer:  true
        }
      },
      { headers: { "X-Shopify-Access-Token": TOKEN } }
    );

    /* 2️⃣  Attach discount code to that rule */
    await axios.post(
      `${ADMIN}/price_rules/${prRes.data.price_rule.id}/discount_codes.json`,
      { discount_code: { code } },
      { headers: { "X-Shopify-Access-Token": TOKEN } }
    );

    console.log("✅ Discount code created:", code);
    res.send(code);
  } catch (err) {
    /* Full diagnostic logging */
    console.error("🔥 ERROR in /create-discount");
    console.error("Message :", err.message);
    console.error("Status  :", err.response?.status);
    console.error("Data    :", err.response?.data);
    res.status(500).send("ERR");
  }
});

/* Start server */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🪙 GizmoCoin wallet server running on port ${PORT}`);
});





