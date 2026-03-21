# Opal Backend – Cardcom + MongoDB

## 1. Environment

Copy `.env.example` to `.env` and set:

- **CARDCOM_TERMINAL** – Terminal ID (e.g. `1000` for test)
- **CARDCOM_USER** – API name (username)
- **CARDCOM_PASS** – API password
- **BASE_URL** – Public URL of this server (for redirects and webhook). For local test use an ngrok URL so Cardcom can call the webhook.

Optional:

- **MONGO_URL** – MongoDB connection string (required in production)
- **MONGO_DB_NAME** – DB name (default: `opal`)
- **ADMIN_USERNAME** / **ADMIN_PASSWORD** – Temporary login for `/admin`
- **PORT** – Server port (default `3001`)

## 2. MongoDB

- Provision MongoDB in Railway.
- Set `MONGO_URL` (and optional `MONGO_DB_NAME`).
- Deals are stored in collection **deals**.
- Contact forms are stored in **contactLeads**.
- Organization forms are stored in **organizationLeads**.
- **products** – catalog (`productName`, unique `sku`, `createdAt`).
- **vendors** – supplier profile + `productLinks[]` (`productId`, `sku`, `vendorCost`).
- **pricing_entries** – price-list rows (`pricingName`, `vendorId`, `productId`, optional `orgName`, `retailPrice`, `vendorCost`, `profit`).
- **sales_agents** – agents for checkout (`agentName`, `idNum`, bank details, etc.); deals store `agentId` for sales counts.
- **org_pricing_policies** – legacy org bulk price lists (`relatedProducts[]`).
- **deals** – subscribers / payments; includes **`agentId`** when resolved from checkout.
- **checkout_drafts** – anonymous checkout progress for abandoned-cart tracking.

## 3. How to run

```bash
cd server
npm install
npm start
```

- **Create payment link:**  
  `POST /api/create-checkout-session`  
  Body: `{ "formState": { ... } }` (frontend form state).  
  Response: `{ "url": "https://..." }` – redirect the user to `url`.

- **Webhook (called by Cardcom):**
  `POST /api/cardcom-webhook` or `GET /api/cardcom-webhook?LowProfileCode=...`  
  On success, the server writes the full deal payload to MongoDB.

## 4. Local test with Cardcom

1. Run the server: `npm start`.
2. Expose it with ngrok: `ngrok http 3001`.
3. In `.env` set `BASE_URL=https://your-ngrok-url.ngrok.io`.
4. Restart the server.
5. From the frontend, call `POST /api/create-checkout-session` with `formState`, then redirect the user to the returned `url`.
6. After payment, Cardcom calls `BASE_URL/api/cardcom-webhook`; the server then updates MongoDB.

## 5. Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/create-checkout-session | Create Cardcom payment link; body: `{ formState }` |
| POST/GET | /api/cardcom-webhook | Cardcom callback (LowProfileCode in query or body) |
| POST | /api/admin/login | Admin login (temporary username/password) |
| GET | /api/admin/deals | Get deals for dashboard (requires Bearer token) |
| GET/POST | /api/admin/products | Product catalog (admin) |
| GET/POST | /api/admin/vendors | Vendors + product cost links |
| GET | /api/admin/vendor-cost | Query `vendorId` + `productId` → auto `vendorCost` / `sku` |
| GET/POST | /api/admin/pricing-entries | Price-list rows (retail, vendor cost, profit) |
| GET | /api/public/agents | Agents list for checkout dropdown (`id`, `agentName`) |
| GET/POST | /api/admin/org-pricing | Legacy organization pricing policies |
| GET | /api/admin/control-panel | Aggregated: abandoned carts, payment issues, leads, registered org pricings |
| GET | /api/pricing-context?pricingId= | **Public** – resolve product names + prices for a landing page (Mongo `_id` of org pricing policy) |
| POST | /api/checkout-draft | Save anonymous checkout draft (`sessionKey`, `formSnapshot`, `completed`) |
| GET | /api/health | Health and config check |
