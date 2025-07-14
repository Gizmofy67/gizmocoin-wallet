import express from "express";
// ... other imports ...

const app = express();  // <-- THIS must be before any app.post()

// ... middlewares, pool, other routes ...

// === CHECKOUT ROUTE ===
app.post("/checkout", async (req, res) => {
  const { email, items } = req.body;

  if (!email || !items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: "Invalid request" });
  }

  const totalUSD = items.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0);
  const totalGZM = parseFloat((totalUSD / 25).toFixed(4));

  try {
    const result = await pool.query("SELECT balance FROM wallets WHERE email = $1", [email]);
    const balance = result.rows[0]?.balance || 0;

    if (balance < totalGZM) {
      return res.status(402).json({ success: false, message: "Insufficient GizmoCoin balance." });
    }

    await pool.query("UPDATE wallets SET balance = balance - $1 WHERE email = $2", [totalGZM, email]);

    return res.status(200).json({ success: true, message: "Checkout successful." });
  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({ success: false, message: "Server error during checkout." });
  }
});

// === START SERVER ===
app.listen(port, () => {
  console.log(`🪙 GizmoCoin wallet running on port ${port}`);
});

