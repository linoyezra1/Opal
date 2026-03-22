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
- **pricing_entries** – legacy single-row price lines (`pricingName`, `vendorId`, `productId`, …).
- **price_lists** – מחירון רב-מוצרי לדפי נחיתה (`listName`, `orgName`, `lines[]` עם `retailPrice`, `vendorCost`, `defaultAgentCommission`).
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
| PUT | /api/admin/deals/:id | Update deal — merges `formState`, optional `payerAmount`, `paymentStatus` (admin) |
| DELETE | /api/admin/deals/:id | Delete deal document (admin) |
| GET/POST | /api/admin/products | Product catalog (admin) |
| PUT/DELETE | /api/admin/products/:id | Update or delete product (delete cascades links & pricing rows) |
| GET/POST | /api/admin/vendors | Vendors + product cost links |
| PUT/DELETE | /api/admin/vendors/:id | Update or delete vendor |
| GET | /api/admin/vendor-cost | Query `vendorId` + `productId` → auto `vendorCost` / `sku` |
| GET | /api/vendor-products/:vendorId/:productId | Same as above (path params; requires admin Bearer) |
| GET/POST | /api/admin/pricing-entries | Legacy single-row pricing entries |
| PUT/DELETE | /api/admin/pricing-entries/:id | Update or delete a pricing entry |
| GET/POST | /api/admin/price-lists | Multi-product price lists (landing pages) |
| GET/PUT/DELETE | /api/admin/price-lists/:id | Get / update / delete a price list |
| GET | /api/public/price-list/:id | **Public** – product names, descriptions, retail only (no vendor/agent internals) |
| GET | /api/admin/subscribers-dashboard | Same filters as legacy sales-dashboard + `productNameSearch`, `agentNameSearch`; includes `totalNetProfit` |
| GET/POST | /api/admin/agents | List / create sales agents |
| PUT/DELETE | /api/admin/agents/:id | Update or delete agent (delete blocked if deals reference agent) |
| GET | /api/public/agents | Agents list for checkout dropdown (`id`, `agentName`) |
| GET/POST | /api/admin/org-pricing | Legacy organization pricing policies |
| GET | /api/admin/control-panel | Aggregated: abandoned carts, payment issues, leads, registered org pricings, plus **`overview`** (Mongo: revenue, net profit, counts, 14-day chart series, new leads 7d) |
| GET | /api/pricing-context?pricingId= | **Public** – resolve product names + prices for a landing page (Mongo `_id` of org pricing policy) |
| POST | /api/checkout-draft | Save anonymous checkout draft (`sessionKey`, `formSnapshot`, `completed`) |
| GET | /api/health | Health and config check |
