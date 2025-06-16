const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

app.get('/wallet', (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Replace this with your real DB check
  const dummyDB = {
    'arthurskinney@yahoo.com': 150,
    'test@example.com': 0
  };

  const balance = dummyDB[email];

  if (balance === undefined) {
    return res.json({ balance: 0 }); // Return 0 instead of 404
  }

  res.json({ balance });
});

app.listen(PORT, () => {
  console.log(`GizmoCoin wallet server running on port ${PORT}`);
});
