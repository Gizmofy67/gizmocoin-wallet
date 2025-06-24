app.post("/create-discount", async (req, res) => {
  console.log("🔥 /create-discount hit with:", req.body);

  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      console.log("❌ Invalid amount:", amount);
      return res.status(400).send("Bad amount");
    }

    const STORE = process.env.SHOPIFY_STORE;
    const TOKEN = process.env.SHOPIFY_TOKEN;
    if (!STORE || !TOKEN) {
      console.log("❌ Missing Shopify env vars:", { STORE, TOKEN });
      return res.status(500).send("Shopify env vars missing");
    }

    const ADMIN = `https://${TOKEN}@${STORE}/admin/api/2024-04`;
    const code = `GZM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    // Create price rule
    const pr = await axios.post(`${ADMIN}/price_rules.json`, {
      price_rule: {
        title: code,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "fixed_amount",
        value: -amount,
        customer_selection: "all",
        starts_at: now,
        ends_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        once_per_customer: true
      }
    });

    // Attach code
    await axios.post(
      `${ADMIN}/price_rules/${pr.data.price_rule.id}/discount_codes.json`,
      { discount_code: { code } }
    );

    console.log("✅ Discount code created:", code);
    res.send(code);

  } catch (err) {
    console.error("🔥 ERROR in /create-discount:", err.response?.data || err.message || err);
    res.status(500).send("ERR");
  }
});



