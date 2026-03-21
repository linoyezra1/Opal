/** Backend base URL. In dev, set VITE_API_URL=http://localhost:3001 in .env so API calls hit the Node server (Vite default is :5173). */
export const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;
