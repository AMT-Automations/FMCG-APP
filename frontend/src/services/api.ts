import axios from 'axios';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

class ApiService {
  private token: string | null = null;
  private client = axios.create({
    baseURL: `${BASE_URL}/api`,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  constructor() {
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  setToken(token: string | null) {
    this.token = token;
  }

  // Auth
  async login(phone: string, pin: string) {
    const response = await this.client.post('/auth/login', { phone, pin });
    return response.data;
  }

  async register(name: string, phone: string, pin: string, role: string) {
    const response = await this.client.post('/auth/register', { name, phone, pin, role });
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Products
  async getProducts() {
    const response = await this.client.get('/products');
    return response.data;
  }

  async createProduct(data: { name: string; category: string; unit_type: string; price: number }) {
    const response = await this.client.post('/products', data);
    return response.data;
  }

  // Customers
  async getCustomers(routeId?: string) {
    const params = routeId ? { route_id: routeId } : {};
    const response = await this.client.get('/customers', { params });
    return response.data;
  }

  async createCustomer(data: { name: string; contact?: string; location?: string; payment_terms?: string; route_id?: string }) {
    const response = await this.client.post('/customers', data);
    return response.data;
  }

  // Routes
  async getRoutes() {
    const response = await this.client.get('/routes');
    return response.data;
  }

  async getRouteCustomers(routeId: string) {
    const response = await this.client.get(`/routes/${routeId}/customers`);
    return response.data;
  }

  // Sales
  async createSale(data: {
    route_id: string;
    customer_id: string;
    customer_name: string;
    items: Array<{
      product_id: string;
      product_name: string;
      quantity_delivered: number;
      quantity_returned?: number;
      damages?: number;
      unit_price: number;
    }>;
    cash_collected: number;
    payment_type?: string;
    notes?: string;
  }) {
    const response = await this.client.post('/sales', data);
    return response.data;
  }

  async getSales(routeId?: string, dateStr?: string) {
    const params: any = {};
    if (routeId) params.route_id = routeId;
    if (dateStr) params.date_str = dateStr;
    const response = await this.client.get('/sales', { params });
    return response.data;
  }

  async getCustomerSales(customerId: string) {
    const response = await this.client.get(`/sales/customer/${customerId}`);
    return response.data;
  }

  // Daily Routes
  async startDailyRoute(data: { route_id: string; opening_km: number; crates_out: number; vehicle_check?: any }) {
    const response = await this.client.post('/daily-routes/start', data);
    return response.data;
  }

  async endDailyRoute(routeId: string, data: { closing_km: number; crates_in: number; damages_count?: number; fuel_used?: number; notes?: string }) {
    const response = await this.client.put(`/daily-routes/${routeId}/end`, data);
    return response.data;
  }

  async getActiveDailyRoute() {
    const response = await this.client.get('/daily-routes/active');
    return response.data;
  }

  async getDailyRouteHistory() {
    const response = await this.client.get('/daily-routes/history');
    return response.data;
  }

  // Reports
  async getDailySummary(dateStr?: string) {
    const params = dateStr ? { date_str: dateStr } : {};
    const response = await this.client.get('/reports/daily-summary', { params });
    return response.data;
  }

  async getRoutePerformance(routeId: string, days: number = 7) {
    const response = await this.client.get(`/reports/route-performance/${routeId}`, { params: { days } });
    return response.data;
  }

  // Seed data
  async seedAll() {
    const response = await this.client.post('/seed-all');
    return response.data;
  }

  // Health check
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export const api = new ApiService();
