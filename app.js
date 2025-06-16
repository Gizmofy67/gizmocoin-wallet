const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const SHOP = process.env.SHOP;
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;

app.get('/wallet', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const customerRes = await axios.get(`https://${SHOP}/admin/api/2023-07/customers/search.json?query=email:${email}`, {
      headers: {
        'X-Shopify-Access-Token': ADMIN_API_TOKEN
      }
    });

    const customer = customerRes.data.customers[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const metafieldsRes = await axios.get(`https://${SHOP}/admin/api/2023-07/customers/${customer.id}/metafields.json`, {
      headers: {
        'X-Shopify-Access-Token': ADMIN_API_TOKEN
      }
    });

    const walletField = metafieldsRes.data.metafields.find(f => f.namespace === 'wallet' && f.key === 'gizmocoin_balance');
    const balance = walletField ? parseFloat(walletField.value) : 0;
    res.json({ balance });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer balance', details: err.message });
  }
});

app.post('/wallet', async (req, res) => {
  const { email, amount } = req.body;
  if (!email || typeof amount !== 'number') return res.status(400).json({ error: 'Email and amount are required' });

  try {
    const customerRes = await axios.get(`https://${SHOP}/admin/api/2023-07/customers/search.json?query=email:${email}`, {
      headers: {
        'X-Shopify-Access-Token': ADMIN_API_TOKEN
      }
    });

    const customer = customerRes.data.customers[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const id = customer.id;

    const metafieldsRes = await axios.get(`https://${SHOP}/admin/api/2023-07/customers/${id}/metafields.json`, {
      headers: {
        'X-Shopify-Access-Token': ADMIN_API_TOKEN
      }
    });

    const existing = metafieldsRes.data.metafields.find(f => f.namespace === 'wallet' && f.key === 'gizmocoin_balance');
    const currentBalance = existing ? parseFloat(existing.value) : 0;
    const newBalance = currentBalance + amount;

    if (existing) {
      await axios.put(`https://${SHOP}/admin/api/2023-07/metafields/${existing.id}.json`, {
        metafield: {
          id: existing.id,
          value: newBalance.toFixed(2)
        }
      }, {
        headers: { 'X-Shopify-Access-Token': ADMIN_API_TOKEN }
      });
    } else {
      await axios.post(`https://${SHOP}/admin/api/2023-07/customers/${id}/metafields.json`, {
        metafield: {
          namespace: 'wallet',
          key: 'gizmocoin_balance',
          type: 'number_decimal',
          value: newBalance.toFixed(2)
        }
      }, {
        headers: { 'X-Shopify-Access-Token': ADMIN_API_TOKEN }
      });
    }

    res.json({ success: true, newBalance });

  } catch (err) {
    res.status(500).json({ error: 'Failed to update wallet', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GizmoCoin wallet server running on port ${PORT}`));