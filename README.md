# Emerald Network | Peer-to-Peer EV Charging Marketplace

Emerald is a production-ready, next-generation peer-to-peer EV charging marketplace that connects electric vehicle drivers with private charging hosts in real-time. It features secure payments routing, dynamic pricing schedules, and real-time charging telemetry.

## 🚀 Key Features

* **Interactive Explore Map:** Built on Leaflet.js, displaying nearby charger pins with automatic distance sorting and detail popups.
* **Driver Booking & Checkout:** Scheduled reservations checking for time-slot conflicts, integrated with mock Stripe Connect split payments (routing platform fees and host payouts).
* **Live Telemetry Sensor Console:** Real-time charging battery dashboard simulating vehicle telemetry heartbeats (kW power, kWh energy delivered, pro-rated early disconnects, and transaction settlement).
* **Host Metrics & Analytics:** Beautiful monthly revenue analytics and energy volumetrics charts utilizing Chart.js.
* **Stripe Connect Express Onboarding:** Secure host merchant onboarding with self-verifying connection status updates.
* **Dynamic Pricing Engine:** Hourly segment calculator charging standard or peak rates depending on the booking window.
* **Resilient Startup Fallback:** Seamless in-memory database fallback. If a local PostgreSQL instance is unavailable, the application starts with pre-populated dummy chargers so the entire marketplace is immediately testable.

---

## 🛠️ Tech Stack

* **Frontend:** Single Page Application (SPA), Tailwind CSS, Leaflet.js maps, Chart.js analytics.
* **Backend:** Node.js, Express, Zod (validation schemas), Helmet & CORS (security), Express Rate Limit (DOS prevention).
* **Database:** PostgreSQL (with spatial points, indices, and transactional locking).
* **Payments:** Stripe SDK (Connect split payments layout).

---

## 💻 Getting Started

### 1. Installation
Navigate to the `backend/` directory and install the Node dependencies:
```bash
cd backend
npm install
```

### 2. Environment Configuration
Copy the env example template and customize configurations (port, secret keys, etc.):
```bash
cp .env.example .env
```
Default keys are provided for Stripe and Telemetry to enable mock modes automatically.

### 3. Running the Server
Launch the development server:
```bash
npm run dev
```
If PostgreSQL is not running locally, the server logs a warning and automatically falls back to the in-memory database. 
Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🧪 Testing & Verification

Emerald includes both unit and mock-database integration test suites.

### Run Unit Tests (Jest)
Validates overlaps, pricing algorithms, webhooks, and controllers:
```bash
npm run test:unit
```

### Run Integration Verification
Tests the entire routing pipeline, API endpoints, transactions, and SPA static redirects:
```bash
node test/verify.js
```