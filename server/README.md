# Opal Backend – Cardcom + Google Sheets

## 1. Environment

Copy `.env.example` to `.env` and set:

- **CARDCOM_TERMINAL** – Terminal ID (e.g. `1000` for test)
- **CARDCOM_USER** – API name (username)
- **CARDCOM_PASS** – API password
- **GOOGLE_SHEET_ID** – ID of the Google Sheet (from the sheet URL)
- **BASE_URL** – Public URL of this server (for redirects and webhook). For local test use an ngrok URL so Cardcom can call the webhook.

Optional:

- **GOOGLE_APPLICATION_CREDENTIALS** – Path to `service-account.json` (default: `server/service-account.json`)
- **PORT** – Server port (default `3001`)

## 2. Google Sheet

- Create a sheet (tab) named exactly: **טבלת שליטה ראשית**.
- Row 1 must be headers (exact Hebrew):
  - A: חודש ההסכם  
  - G: סטטוס עסקה  
  - J: מס' הזמנה  
  - M: סטטוס לקוח  
  - N: סוג חבילה  
  - P: מחיר  
  - Q: שם פרטי  
  - R: משפחה  
  - S: ת.ז  
  - U: אימייל  
- Share the sheet with the **service account email** (Editor).
- Put `service-account.json` in the `server` folder (or set `GOOGLE_APPLICATION_CREDENTIALS`).

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
  On success, the server writes the payer + beneficiaries to the sheet and sets the payer row to yellow.

- **Test sheet only (no Cardcom):**  
  `node sendToSheet.js`  
  Uses test payload and `GOOGLE_SHEET_ID` from `.env`.

## 4. Local test with Cardcom

1. Run the server: `npm start`.
2. Expose it with ngrok: `ngrok http 3001`.
3. In `.env` set `BASE_URL=https://your-ngrok-url.ngrok.io`.
4. Restart the server.
5. From the frontend, call `POST /api/create-checkout-session` with `formState`, then redirect the user to the returned `url`.
6. After payment, Cardcom calls `BASE_URL/api/cardcom-webhook`; the server then updates the sheet.

## 5. Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/create-checkout-session | Create Cardcom payment link; body: `{ formState }` |
| POST/GET | /api/cardcom-webhook | Cardcom callback (LowProfileCode in query or body) |
| GET | /api/health | Health and config check |
