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

  async updateProduct(productId: string, data: { name: string; category: string; unit_type: string; price: number }) {
    const response = await this.client.put(`/products/${productId}`, data);
    return response.data;
  }

  async deleteProduct(productId: string) {
    const response = await this.client.delete(`/products/${productId}`);
    return response.data;
  }

  // Users (Admin only)
  async getUsers() {
    const response = await this.client.get('/users');
    return response.data;
  }

  async createUser(data: { name: string; phone: string; pin: string; role: string }) {
    const response = await this.client.post('/users', data);
    return response.data;
  }

  async updateUser(userId: string, data: { name?: string; phone?: string; role?: string; is_active?: boolean }) {
    const response = await this.client.put(`/users/${userId}`, data);
    return response.data;
  }

  async deactivateUser(userId: string) {
    const response = await this.client.delete(`/users/${userId}`);
    return response.data;
  }

  async resetUserPin(userId: string, newPin: string) {
    const response = await this.client.put(`/users/${userId}/reset-pin?new_pin=${newPin}`);
    return response.data;
  }

  // Customers
  async getCustomers(routeId?: string) {
    const params = routeId ? { route_id: routeId } : {};
    const response = await this.client.get('/customers', { params });
    return response.data;
  }

  async getCustomer(customerId: string) {
    const response = await this.client.get(`/customers/${customerId}`);
    return response.data;
  }

  async createCustomer(data: { name: string; contact?: string; location?: string; payment_terms?: string; credit_limit?: number; route_id?: string }) {
    const response = await this.client.post('/customers', data);
    return response.data;
  }

  async updateCustomer(customerId: string, data: { name?: string; contact?: string; location?: string; payment_terms?: string; credit_limit?: number; route_id?: string; is_active?: boolean }) {
    const response = await this.client.put(`/customers/${customerId}`, data);
    return response.data;
  }

  async deactivateCustomer(customerId: string) {
    const response = await this.client.delete(`/customers/${customerId}`);
    return response.data;
  }

  async getCustomerHistory(customerId: string, days: number = 30) {
    const response = await this.client.get(`/customers/${customerId}/history`, { params: { days } });
    return response.data;
  }

  // Routes
  async getRoutes() {
    const response = await this.client.get('/routes');
    return response.data;
  }

  async createRoute(data: { name: string; description?: string }) {
    const response = await this.client.post('/routes', data);
    return response.data;
  }

  async updateRoute(routeId: string, data: { name?: string; description?: string; assigned_driver_id?: string }) {
    const response = await this.client.put(`/routes/${routeId}`, data);
    return response.data;
  }

  async deleteRoute(routeId: string) {
    const response = await this.client.delete(`/routes/${routeId}`);
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
    crates_dropped?: number;
    crates_collected?: number;
    cash_collected: number;
    payment_type?: string;
    notes?: string;
    delivery_status?: string;
  }) {
    const response = await this.client.post('/sales', data);
    return response.data;
  }

  async getSales(routeId?: string, dateStr?: string, customerId?: string) {
    const params: any = {};
    if (routeId) params.route_id = routeId;
    if (dateStr) params.date_str = dateStr;
    if (customerId) params.customer_id = customerId;
    const response = await this.client.get('/sales', { params });
    return response.data;
  }

  async getSale(saleId: string) {
    const response = await this.client.get(`/sales/${saleId}`);
    return response.data;
  }

  async updateSale(saleId: string, data: any) {
    const response = await this.client.put(`/sales/${saleId}`, data);
    return response.data;
  }

  async voidSale(saleId: string, reason: string) {
    const response = await this.client.post(`/sales/${saleId}/void?reason=${encodeURIComponent(reason)}`);
    return response.data;
  }

  async getCustomerSales(customerId: string) {
    const response = await this.client.get(`/sales/customer/${customerId}`);
    return response.data;
  }

  // Daily Routes
  async startDailyRoute(data: { route_id: string; vehicle_id: string; opening_km: number; crates_out: number; vehicle_check?: any }) {
    const response = await this.client.post('/daily-routes/start', data);
    return response.data;
  }

  async updateDailyRoute(routeId: string, data: any) {
    const response = await this.client.put(`/daily-routes/${routeId}`, data);
    return response.data;
  }

  async endDailyRoute(routeId: string, data: { closing_km: number; crates_in: number; damages_count?: number; fuel_used?: number; notes?: string }) {
    const response = await this.client.put(`/daily-routes/${routeId}/end`, data);
    return response.data;
  }

  async getActiveDailyRoutes() {
    const response = await this.client.get('/daily-routes/active');
    return response.data;
  }

  async getActiveDailyRoute() {
    // Get the first active route for the current driver
    const routes = await this.getActiveDailyRoutes();
    return routes.length > 0 ? routes[0] : null;
  }

  async getAllActiveRoutes() {
    const response = await this.client.get('/daily-routes/active/all');
    return response.data;
  }

  async getDailyRouteHistory(driverId?: string) {
    const params = driverId ? { driver_id: driverId } : {};
    const response = await this.client.get('/daily-routes/history', { params });
    return response.data;
  }

  // Permissions
  async getPermissions() {
    const response = await this.client.get('/permissions');
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

  getExportExcelUrl(dateStr?: string, routeId?: string) {
    const token = this.token;
    let url = `${this.client.defaults.baseURL}/reports/export/excel?`;
    if (dateStr) url += `date_str=${dateStr}&`;
    if (routeId) url += `route_id=${routeId}&`;
    return url;
  }

  // Vehicles
  async getVehicles(includeInactive: boolean = false) {
    const params = includeInactive ? { include_inactive: true } : {};
    const response = await this.client.get('/vehicles', { params });
    return response.data;
  }

  async getAvailableVehicles() {
    const response = await this.client.get('/vehicles/available');
    return response.data;
  }

  async createVehicle(data: { registration: string; name: string; vehicle_type?: string; capacity_crates?: number }) {
    const response = await this.client.post('/vehicles', data);
    return response.data;
  }

  async updateVehicle(vehicleId: string, data: { registration?: string; name?: string; vehicle_type?: string; capacity_crates?: number; is_active?: boolean }) {
    const response = await this.client.put(`/vehicles/${vehicleId}`, data);
    return response.data;
  }

  async deactivateVehicle(vehicleId: string) {
    const response = await this.client.delete(`/vehicles/${vehicleId}`);
    return response.data;
  }

  async seedVehicles() {
    const response = await this.client.post('/vehicles/seed');
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
