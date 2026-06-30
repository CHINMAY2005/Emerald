/**
 * Emerald Network API Communication Layer
 * 
 * Provides unified integration hooks connecting the HTML/JavaScript client
 * interface directly to live Express/PostgreSQL backend services.
 */

// 1. Base Configuration
const API_BASE = '/api/v1/emerald';

/**
 * Helper to fetch authorization header populated with token from local storage
 * @returns {Object} Request headers including Authorization if present
 */
function getHeaders(customHeaders = {}) {
  const token = localStorage.getItem('emerald_token');
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * Reusable fetch wrapper that handles authentication, JSON parsing, error wrapping, and alerts
 * @param {string} endpoint API endpoint path (e.g. '/auth/login')
 * @param {Object} options Standard fetch option overrides
 * @returns {Promise<any>} Response body promise
 */
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const requestOptions = {
    ...options,
    headers: getHeaders(options.headers)
  };

  try {
    const response = await fetch(url, requestOptions);
    const data = await response.json();

    if (!response.ok) {
      // Gather error message from standard validation schema formats or root errors
      const errorMsg = data.error || (data.details && data.details[0] && data.details[0].message) || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (error) {
    // Graceful toast alert wrapper instead of silent network crashes
    showToast(error.message, 'error');
    throw error;
  }
}

// 2. Driver Flow Requests

/**
 * Fetches available charging nodes near coordinates to render on dynamic maps
 * @param {number} lat Latitude
 * @param {number} lng Longitude
 * @param {number} radiusKm Search radius in kilometers
 * @returns {Promise<Array>} List of chargers near location
 */
async function fetchNearbyChargers(lat, lng, radiusKm = 10) {
  try {
    const data = await apiCall(`/chargers?lat=${lat}&lng=${lng}&radius=${radiusKm}`, {
      method: 'GET'
    });
    return data.chargers || [];
  } catch (error) {
    console.error('[EMERALD-API] Fetch chargers query failed:', error);
    throw error;
  }
}

/**
 * Sends booking request to confirm reservation slot. Handles overlap conflict blocks
 * @param {string} chargerId UUID of target charger node
 * @param {string} startTime ISO string start datetime
 * @param {string} endTime ISO string end datetime
 * @param {number} totalKwh Allocation requirement quantity
 * @returns {Promise<Object>} Created booking session data
 */
async function createNewBooking(chargerId, startTime, endTime, totalKwh = 30) {
  try {
    const data = await apiCall('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        charger_id: chargerId,
        start_time: startTime,
        end_time: endTime,
        total_kwh: totalKwh
      })
    });
    
    showToast('Booking reserved successfully!', 'success');
    return data.booking;
  } catch (error) {
    console.error('[EMERALD-API] Create booking session failed:', error);
    throw error;
  }
}

// 3. Host Dashboard Tracking & Onboarding

/**
 * Collects host metrics (earnings metrics and active bookings list) in parallel
 * @returns {Promise<Object>} Aggregated metrics object
 */
async function fetchHostMetrics() {
  try {
    const [earningsData, bookingsData] = await Promise.all([
      apiCall('/hosts/earnings'),
      apiCall('/bookings')
    ]);

    return {
      summary: earningsData.summary,
      monthlyBreakdown: earningsData.monthly_breakdown,
      bookingsCount: bookingsData.count,
      bookings: bookingsData.bookings
    };
  } catch (error) {
    console.error('[EMERALD-API] Fetch host dashboard tracking failed:', error);
    throw error;
  }
}

/**
 * Begins host onboarding flow by requesting connecting account link and redirecting host
 */
async function initializeStripeOnboarding() {
  try {
    showToast('Initializing secure onboarding link...', 'info');
    
    const data = await apiCall('/payments/connect-account', {
      method: 'POST'
    });

    if (data && data.url) {
      // Redirect host user directly to Stripe onboarding portal
      window.location.href = data.url;
    } else {
      throw new Error('Onboarding redirection portal link was not returned.');
    }
  } catch (error) {
    console.error('[EMERALD-API] Stripe Connect initialization failed:', error);
    throw error;
  }
}

// 4. UI State Binding & Toast Notification Utility

/**
 * Branded layout notification modal injector
 * @param {string} message Error or status text
 * @param {'error'|'success'|'info'} type Theme color select
 */
function showToast(message, type = 'error') {
  let container = document.getElementById('emerald-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'emerald-toast-container';
    container.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    min-width: 300px;
    max-width: 450px;
    background: ${type === 'error' ? 'rgba(239, 68, 68, 0.95)' : type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(59, 130, 246, 0.95)'};
    color: #ffffff;
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    font-weight: 500;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transform: translateX(100px);
    opacity: 0;
    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: auto;
  `;
  toast.innerText = message;

  container.appendChild(toast);

  // Trigger Slide-in Animation
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  }, 10);

  // Dismiss Toast
  setTimeout(() => {
    toast.style.transform = 'translateX(100px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}

/**
 * Boilerplate helper demonstrating DOM mapping hooks for Booking data
 * @param {Object} booking returned booking object
 */
function updateBookingUI(booking) {
  if (!booking) return;

  // Expected HTML mapping containers:
  // <span id="val-booking-id"></span>
  // <span id="val-status"></span>
  // <span id="val-cost"></span>
  // <span id="val-kwh"></span>

  const elements = {
    id: document.getElementById('val-booking-id'),
    status: document.getElementById('val-status'),
    cost: document.getElementById('val-cost'),
    kwh: document.getElementById('val-kwh')
  };

  if (elements.id) elements.id.innerText = booking.id;
  if (elements.status) elements.status.innerText = booking.status;
  if (elements.cost) elements.cost.innerText = `$${Number(booking.total_price).toFixed(2)}`;
  if (elements.kwh) elements.kwh.innerText = `${Number(booking.total_kwh).toFixed(1)} kWh`;
}

/**
 * Boilerplate helper demonstrating DOM mapping hooks for Host earnings
 * @param {Object} metrics aggregated metric counts
 */
function updateHostDashboardUI(metrics) {
  if (!metrics || !metrics.summary) return;

  // Expected HTML mapping containers:
  // <div id="val-earnings-total"></div>
  // <div id="val-bookings-count"></div>
  // <div id="val-kwh-delivered"></div>

  const elements = {
    revenue: document.getElementById('val-earnings-total'),
    bookings: document.getElementById('val-bookings-count'),
    kwh: document.getElementById('val-kwh-delivered')
  };

  if (elements.revenue) elements.revenue.innerText = `$${Number(metrics.summary.lifetime_revenue).toFixed(2)}`;
  if (elements.bookings) elements.bookings.innerText = metrics.summary.lifetime_bookings;
  if (elements.kwh) elements.kwh.innerText = `${Number(metrics.summary.lifetime_kwh_delivered).toFixed(1)} kWh`;
}
