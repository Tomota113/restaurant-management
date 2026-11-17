import {
  User,
  Category,
  MenuItem,
  Table,
  Reservation,
  Order,
  Ingredient,
  RecipeItem,
  DashboardSummary,
  PopularDish,
  TableTurnover,
  OrderTrends
} from '../types';

const API_BASE = '/api';

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    let body: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        body = await res.json();
      } catch {
        body = null;
      }
    } else {
      body = await res.text();
    }

    if (!res.ok) {
      const errorMsg = body?.error || body?.message || `HTTP Error ${res.status}`;
      throw new Error(errorMsg);
    }

    return body as T;
  }

  // Auth
  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    return this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  // Staff
  async getStaff(): Promise<User[]> {
    return this.request<User[]>('/staff');
  }

  async createStaff(data: Partial<User> & { password: string }): Promise<User> {
    return this.request<User>('/staff', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateStaff(id: string, data: Partial<User> & { password?: string }): Promise<User> {
    return this.request<User>(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async toggleStaffStatus(id: string, is_active: boolean): Promise<User> {
    return this.request<User>(`/staff/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active })
    });
  }

  async deleteStaff(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/staff/${id}`, {
      method: 'DELETE'
    });
  }

  // Menu
  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/menu/categories');
  }

  async createCategory(data: { name: string; display_order?: number; description?: string }): Promise<Category> {
    return this.request<Category>('/menu/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category> {
    return this.request<Category>(`/menu/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteCategory(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/menu/categories/${id}`, {
      method: 'DELETE'
    });
  }

  async getMenuItems(params: { category_id?: string; available_only?: boolean } = {}): Promise<MenuItem[]> {
    const query = new URLSearchParams();
    if (params.category_id) query.append('category_id', params.category_id);
    if (params.available_only !== undefined) query.append('available_only', String(params.available_only));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<MenuItem[]>(`/menu/items${qs}`);
  }

  async createMenuItem(data: Partial<MenuItem>): Promise<MenuItem> {
    return this.request<MenuItem>('/menu/items', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateMenuItem(id: string, data: Partial<MenuItem>): Promise<MenuItem> {
    return this.request<MenuItem>(`/menu/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async toggleMenuItemAvailability(id: string, is_available: boolean): Promise<MenuItem> {
    return this.request<MenuItem>(`/menu/items/${id}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ is_available })
    });
  }

  async deleteMenuItem(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/menu/items/${id}`, {
      method: 'DELETE'
    });
  }

  // Tables
  async getTables(): Promise<Table[]> {
    return this.request<Table[]>('/tables');
  }

  async createTable(data: Partial<Table>): Promise<Table> {
    return this.request<Table>('/tables', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateTable(id: string, data: Partial<Table>): Promise<Table> {
    return this.request<Table>(`/tables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteTable(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/tables/${id}`, {
      method: 'DELETE'
    });
  }

  // Reservations
  async getReservations(params: { date?: string; table_id?: string; status?: string } = {}): Promise<Reservation[]> {
    const query = new URLSearchParams();
    if (params.date) query.append('date', params.date);
    if (params.table_id) query.append('table_id', params.table_id);
    if (params.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<Reservation[]>(`/reservations${qs}`);
  }

  async createReservation(data: Partial<Reservation>): Promise<Reservation> {
    return this.request<Reservation>('/reservations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateReservation(id: string, data: Partial<Reservation>): Promise<Reservation> {
    return this.request<Reservation>(`/reservations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async cancelReservation(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/reservations/${id}`, {
      method: 'DELETE'
    });
  }

  // Orders & Kitchen
  async getOrders(params: { status?: string; table_id?: string } = {}): Promise<Order[]> {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.table_id) query.append('table_id', params.table_id);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<Order[]>(`/orders${qs}`);
  }

  async getOrder(id: string): Promise<Order> {
    return this.request<Order>(`/orders/${id}`);
  }

  async createOrder(data: { table_id: string; items: Array<{ menu_item_id: string; quantity: number; special_instructions?: string }>; notes?: string }): Promise<Order> {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateOrderItems(id: string, items: Array<{ menu_item_id: string; quantity: number; special_instructions?: string }>): Promise<Order> {
    return this.request<Order>(`/orders/${id}/items`, {
      method: 'PUT',
      body: JSON.stringify({ items })
    });
  }

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    return this.request<Order>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  async closeOrder(id: string, data: { payment_method?: string; tip?: number } = {}): Promise<Order> {
    return this.request<Order>(`/orders/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getKitchenOrders(): Promise<Order[]> {
    return this.request<Order[]>('/kitchen/orders');
  }

  // Inventory & Recipes
  async getIngredients(): Promise<Ingredient[]> {
    return this.request<Ingredient[]>('/inventory/ingredients');
  }

  async createIngredient(data: Partial<Ingredient>): Promise<Ingredient> {
    return this.request<Ingredient>('/inventory/ingredients', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateIngredient(id: string, data: Partial<Ingredient>): Promise<Ingredient> {
    return this.request<Ingredient>(`/inventory/ingredients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async adjustStock(data: { ingredient_id: string; adjustment_type: 'delivery' | 'waste' | 'manual'; quantity_delta: number; reason: string }): Promise<{ message: string; ingredient: Ingredient }> {
    return this.request<{ message: string; ingredient: Ingredient }>('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getAlerts(): Promise<Ingredient[]> {
    return this.request<Ingredient[]>('/inventory/alerts');
  }

  async getRecipes(menuItemId: string): Promise<RecipeItem[]> {
    return this.request<RecipeItem[]>(`/inventory/recipes/${menuItemId}`);
  }

  async saveRecipes(menu_item_id: string, ingredients: Array<{ ingredient_id: string; quantity_required: number }>): Promise<RecipeItem[]> {
    return this.request<RecipeItem[]>('/inventory/recipes', {
      method: 'POST',
      body: JSON.stringify({ menu_item_id, ingredients })
    });
  }

  // Dashboard
  async getDashboardSummary(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>('/dashboard/summary');
  }

  async getPopularDishes(limit: number = 10): Promise<PopularDish[]> {
    return this.request<PopularDish[]>(`/dashboard/popular-dishes?limit=${limit}`);
  }

  async getTableTurnover(): Promise<TableTurnover> {
    return this.request<TableTurnover>('/dashboard/table-turnover');
  }

  async getOrderTrends(days: number = 7): Promise<OrderTrends> {
    return this.request<OrderTrends>(`/dashboard/order-trends?days=${days}`);
  }
}

export const api = new ApiService();
export default api;
