<div style="font-family:'Orbitron',sans-serif; color:#00E5FF; background:#000; padding:40px; max-width:700px; margin:auto;">
  <h2 style="text-align:center;">🔐 GizmoCoin Wallet</h2>
  <p><strong>Your GizmoCoin Balance:</strong> <span id="wallet-balance">Loading...</span></p>

  <form id="gizmocoin-form">
    <label for="usd-amount">Enter amount in USD:</label><br>
    <input type="number" id="usd-amount" min="1" placeholder="e.g. 50" required />
    <button type="submit">Convert to GizmoCoin</button>
  </form>

  <p style="margin-top:20px;">Exchange rate: <strong>$25 = 1 GizmoCoin</strong></p>
</div>

<script>
  const apiBase = "https://gizmocoin-wallet.onrender.com"; // Your deployed wallet URL

  // Replace this with the logged-in customer email if you're pulling dynamically from Shopify
  const customerEmail = Shopify?.customer?.email || "demo@example.com";

  async function updateBalance() {
    try {
      const res = await fetch(`${apiBase}/wallet?email=${encodeURIComponent(customerEmail)}`);
      const data = await res.json();
      document.getElementById("wallet-balance").textContent = data.balance || 0;
    } catch (err) {
      document.getElementById("wallet-balance").textContent = "Unavailable";
    }
  }

  document.getElementById("gizmocoin-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const usd = parseFloat(document.getElementById("usd-amount").value);
    if (!usd || usd <= 0) return;

    const gizmoAmount = usd / 25;
    alert(`You will receive ${gizmoAmount.toFixed(2)} GizmoCoin(s).`);

    // Optional: You could also call a backend here to "process" the conversion
    // This would require a POST request to your wallet server
  });

  updateBalance();
</script>
