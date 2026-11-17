export type UserRole = 'manager' | 'waiter' | 'kitchen';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  display_order: number;
  description?: string;
  created_at?: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  category_name?: string;
  name: string;
  description?: string;
  price: number;
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
}

export type TableStatus = 'free' | 'occupied' | 'reserved';

export interface Table {
  id: string;
  table_number: string;
  capacity: number;
  section: string;
  position_x: number;
  position_y: number;
  status: TableStatus;
  created_at?: string;
  updated_at?: string;
}

export interface Reservation {
  id: string;
  table_id: string;
  table_number?: string;
  customer_name: string;
  customer_phone?: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  notes?: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  created_at?: string;
  updated_at?: string;
}

export type OrderStatus = 'pending' | 'in_preparation' | 'ready' | 'served' | 'closed' | 'cancelled';

export interface OrderItem {
  id?: string;
  menu_item_id: string;
  name?: string;
  category_name?: string;
  quantity: number;
  unit_price?: number;
  special_instructions?: string;
  subtotal?: number;
}

export interface Order {
  id: string;
  table_id: string;
  table_number?: string;
  table_section?: string;
  user_id?: string;
  staff_name?: string;
  status: OrderStatus;
  total_amount: number;
  payment_method?: string;
  tip?: number;
  notes?: string;
  items: OrderItem[];
  created_at: string;
  closed_at?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  low_stock_threshold: number;
  cost_per_unit: number;
  created_at?: string;
  updated_at?: string;
}

export interface RecipeItem {
  id?: string;
  menu_item_id?: string;
  ingredient_id: string;
  name?: string;
  unit?: string;
  quantity_required: number;
  cost_per_unit?: number;
}

export interface DashboardSummary {
  today_revenue: number;
  week_revenue: number;
  month_revenue: number;
  today_orders: number;
  active_orders: number;
  low_stock_alerts_count: number;
}

export interface PopularDish {
  id: string;
  menu_item_id: string;
  name: string;
  category_name?: string;
  price: number;
  total_orders: number;
  quantity_sold: number;
  total_revenue: number;
}

export interface TableTurnover {
  avg_turnover_minutes: number;
  total_completed_tables: number;
}

export interface OrderTrendPoint {
  date?: string;
  hour?: string;
  order_count: number;
  revenue: number;
}

export interface OrderTrends {
  daily: OrderTrendPoint[];
  hourly: OrderTrendPoint[];
}
