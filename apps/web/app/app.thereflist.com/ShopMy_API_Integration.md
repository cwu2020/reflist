ShopMy API Integration — Agent Summary (Revised)
1. Authentication & Proxy Pattern
Secret token:
Store your creator token (c-GgF8yQA) in an environment variable (SHOPMY_CREATOR_TOKEN).

Client → Your Server:
Frontend calls your own endpoints (/api/shopmy-data, /api/create-pin)—no direct ShopMy calls from browser.

Server → ShopMy API:
Your server injects the x-authorization-hash header plus the same headers the bookmarklet uses, then proxies the request to https://api.shopmy.us/....

2. Key Endpoints & Updated Payloads
a) Get Merchant Data
yaml
Copy
POST https://api.shopmy.us/api/Pins/get_merchant_data
Headers:
  x-authorization-hash: <YOUR_TOKEN>
  Accept: application/json, text/plain, */*
  Content-Type: application/json
  Cache-Control: no-cache
  x-apicache-bypass: true
  Origin: https://shopmy.us
  Referer: https://shopmy.us/
Body:
  { "url": "<PRODUCT_PAGE_URL>" }
Updated Response Shape:

json
Copy
{
  "data": {
    "<domain>": {
      "id": 10471281,
      "domain": "larroude.com",
      "name": "Larroudé",
      "logo": "...",
      "source": "shopmyshelf",
      "fullPayout": 20,
      "payoutType": "cpa",
      "rateType": "percentage",
      "isSMSWinner": 1,
      "raw": "{…}",              // JSON string of raw network data
      "updatedAt": "2025-04-28T…",
      "Brand_id": 400,
      "brand": { /* nested brand object with id, name, logo, description, etc. */ }
    }
  }
}
How to extract:

js
Copy
const apiData = apiRes.data.data;
const domainKey = Object.keys(apiData)[0];
const merchantInfo = apiData[domainKey];
// merchantInfo.name, merchantInfo.fullPayout, merchantInfo.rateType, merchantInfo.brand.logo, etc.
b) Create a New Pin
arduino
Copy
POST https://api.shopmy.us/api/Pins
Headers:
  x-authorization-hash: <YOUR_TOKEN>
  (same headers as above)
Body:
  { title, description, image, link, /* … */ }
Response 201:

json
Copy
{
  "pin": {
    "id": 16986008,
    "link": "https://…",
    /* other pin fields */
  }
}
Short URL construction:

js
Copy
const pinId = resp.data.pin.id;
const shortUrl = `https://go.shopmy.us/p-${pinId}`;
3. Example Server‐Side Proxy (Express + Axios)
js
Copy
// server/routes/shopmy.js
const express = require('express');
const axios   = require('axios');
const router  = express.Router();
const SHOPMY_TOKEN = process.env.SHOPMY_CREATOR_TOKEN;

// GET merchant data proxy
router.post('/shopmy-data', async (req, res) => {
  const { url } = req.body;
  try {
    const apiRes = await axios.post(
      'https://api.shopmy.us/api/Pins/get_merchant_data',
      { url },
      { headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-apicache-bypass': 'true',
          'x-authorization-hash': SHOPMY_TOKEN,
          'Origin': 'https://shopmy.us',
          'Referer': 'https://shopmy.us/'
      }}
    );

    // Normalize to a single merchant object
    const dataWrapper = apiRes.data.data;
    const domainKey   = Object.keys(dataWrapper)[0];
    const merchant    = dataWrapper[domainKey];

    res.json({ merchant });
  } catch (err) {
    res.status(502).json({ error: 'ShopMy data fetch failed' });
  }
});

// CREATE pin proxy
router.post('/create-pin', async (req, res) => {
  try {
    const apiRes = await axios.post(
      'https://api.shopmy.us/api/Pins',
      req.body,  // { title, description, image, link, … }
      { headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-apicache-bypass': 'true',
          'x-authorization-hash': SHOPMY_TOKEN,
          'Origin': 'https://shopmy.us',
          'Referer': 'https://shopmy.us/'
      }}
    );

    const pin      = apiRes.data.pin;
    const shortUrl = `https://go.shopmy.us/p-${pin.id}`;
    res.status(201).json({ pin, shortUrl });
  } catch (err) {
    res.status(502).json({ error: 'Pin creation failed' });
  }
});

module.exports = router;
4. Frontend Usage
js
Copy
// 1) Fetch merchant data
const { merchant } = await fetch('/api/shopmy-data', {
  method: 'POST',
  headers: { 'Content-Type':'application/json' },
  body: JSON.stringify({ url: window.location.href })
}).then(r => r.json());

// merchant.name, merchant.fullPayout, merchant.rateType, merchant.brand.logo…

// 2) On “Create Link”
const { shortUrl } = await fetch('/api/create-pin', {
  method: 'POST',
  headers: { 'Content-Type':'application/json' },
  body: JSON.stringify({
    title: merchant.brand.name,
    description: editableDescription,
    image: merchant.logo,
    link: window.location.href
  })
}).then(r => r.json());

// Display & copy `shortUrl` (e.g. https://go.shopmy.us/p-16986008)
With this context, an AI coding agent can immediately scaffold the proxy routes, parse the new data‐wrapped response, and integrate the ShopMy calls into your existing app—securely and without CORS issues.