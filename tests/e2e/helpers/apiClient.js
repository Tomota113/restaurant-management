/**
 * Unified API Client for E2E Test Automation
 * Interacts with backend via standard HTTP REST requests.
 */

const FIXTURES = require('./fixtures');

class ApiClient {
  constructor(baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001', token = null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.currentUser = null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(method, path, body = null, customHeaders = {}) {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...customHeaders
    };

    if (this.token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const options = {
      method,
      headers
    };

    if (body !== null && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      let responseBody = null;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          responseBody = await response.json();
        } catch {
          responseBody = null;
        }
      } else {
        responseBody = await response.text();
      }

      return {
        status: response.status,
        headers: response.headers,
        body: responseBody,
        ok: response.ok
      };
    } catch (err) {
      return {
        status: 0,
        headers: new Headers(),
        body: { error: err.message, connectionRefused: true },
        ok: false
      };
    }
  }

  get(path, headers = {}) {
    return this.request('GET', path, null, headers);
  }

  post(path, body, headers = {}) {
    return this.request('POST', path, body, headers);
  }

  put(path, body, headers = {}) {
    return this.request('PUT', path, body, headers);
  }

  patch(path, body, headers = {}) {
    return this.request('PATCH', path, body, headers);
  }

  delete(path, body = null, headers = {}) {
    return this.request('DELETE', path, body, headers);
  }

  // --- Auth Methods ---
  async login(username, password) {
    const res = await this.post('/api/auth/login', { username, password });
    if (res.ok && res.body) {
      this.token = res.body.token || res.body.accessToken;
      this.currentUser = res.body.user;
    }
    return res;
  }

  async getMe() {
    return this.get('/api/auth/me');
  }

  // --- Staff Management ---
  async getStaff() {
    return this.get('/api/staff');
  }

  async createStaff(data) {
    return this.post('/api/staff', data);
  }

  async updateStaff(id, data) {
    return this.put(`/api/staff/${id}`, data);
  }

  async toggleStaffStatus(id, isActive) {
    return this.patch(`/api/staff/${id}/status`, { is_active: isActive });
  }

  // --- Menu Management ---
  async getCategories() {
    return this.get('/api/menu/categories');
  }

  async createCategory(data) {
    return this.post('/api/menu/categories', data);
  }

  async updateCategory(id, data) {
    return this.put(`/api/menu/categories/${id}`, data);
  }

  async deleteCategory(id) {
    return this.delete(`/api/menu/categories/${id}`);
  }

  async getMenuItems(params = {}) {
    const query = new URLSearchParams();
    if (params.category_id) query.append('category_id', params.category_id);
    if (params.available_only !== undefined) query.append('available_only', params.available_only);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.get(`/api/menu/items${qs}`);
  }

  async createMenuItem(data) {
    return this.post('/api/menu/items', data);
  }

  async updateMenuItem(id, data) {
    return this.put(`/api/menu/items/${id}`, data);
  }

  async toggleItemAvailability(id, isAvailable) {
    return this.patch(`/api/menu/items/${id}/availability`, { is_available: isAvailable });
  }

  async deleteMenuItem(id) {
    return this.delete(`/api/menu/items/${id}`);
  }

  // --- Table & Reservation Management ---
  async getTables() {
    return this.get('/api/tables');
  }

  async createTable(data) {
    return this.post('/api/tables', data);
  }

  async updateTable(id, data) {
    return this.put(`/api/tables/${id}`, data);
  }

  async deleteTable(id) {
    return this.delete(`/api/tables/${id}`);
  }

  async getReservations(params = {}) {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return this.get(`/api/reservations${qs}`);
  }

  async createReservation(data) {
    return this.post('/api/reservations', data);
  }

  async updateReservation(id, data) {
    return this.put(`/api/reservations/${id}`, data);
  }

  async cancelReservation(id) {
    return this.delete(`/api/reservations/${id}`);
  }

  // --- Order & Kitchen Management ---
  async getOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return this.get(`/api/orders${qs}`);
  }

  async createOrder(data) {
    return this.post('/api/orders', data);
  }

  async getOrder(id) {
    return this.get(`/api/orders/${id}`);
  }

  async updateOrderItems(id, items) {
    return this.put(`/api/orders/${id}/items`, { items });
  }

  async updateOrderStatus(id, status) {
    return this.patch(`/api/orders/${id}/status`, { status });
  }

  async closeOrder(id, paymentDetails = {}) {
    return this.post(`/api/orders/${id}/close`, paymentDetails);
  }

  async getKitchenOrders() {
    return this.get('/api/kitchen/orders');
  }

  // --- Inventory & Recipe Management ---
  async getIngredients() {
    return this.get('/api/inventory/ingredients');
  }

  async createIngredient(data) {
    return this.post('/api/inventory/ingredients', data);
  }

  async updateIngredient(id, data) {
    return this.put(`/api/inventory/ingredients/${id}`, data);
  }

  async adjustStock(data) {
    return this.post('/api/inventory/adjust', data);
  }

  async getAlerts() {
    return this.get('/api/inventory/alerts');
  }

  async getRecipes(menuItemId) {
    return this.get(`/api/inventory/recipes/${menuItemId}`);
  }

  async createRecipe(data) {
    return this.post('/api/inventory/recipes', data);
  }

  // --- Dashboard & Analytics ---
  async getDashboardSummary() {
    return this.get('/api/dashboard/summary');
  }

  async getPopularDishes(params = {}) {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return this.get(`/api/dashboard/popular-dishes${qs}`);
  }

  async getTableTurnover(params = {}) {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return this.get(`/api/dashboard/table-turnover${qs}`);
  }

  async getOrderTrends(params = {}) {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return this.get(`/api/dashboard/order-trends${qs}`);
  }
}

/**
 * Factory functions to obtain role-authenticated clients
 */
async function getManagerClient(baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001') {
  const client = new ApiClient(baseUrl);
  const loginRes = await client.login(FIXTURES.users.manager.username, FIXTURES.users.manager.password);
  return { client, loginRes };
}

async function getWaiterClient(baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001') {
  const client = new ApiClient(baseUrl);
  const loginRes = await client.login(FIXTURES.users.waiter1.username, FIXTURES.users.waiter1.password);
  return { client, loginRes };
}

async function getKitchenClient(baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001') {
  const client = new ApiClient(baseUrl);
  const loginRes = await client.login(FIXTURES.users.kitchen.username, FIXTURES.users.kitchen.password);
  return { client, loginRes };
}

function getUnauthenticatedClient(baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001') {
  return new ApiClient(baseUrl);
}

module.exports = {
  ApiClient,
  getManagerClient,
  getWaiterClient,
  getKitchenClient,
  getUnauthenticatedClient
};
