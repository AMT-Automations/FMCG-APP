import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/api$/, '');

class ApiService {
  private token: string | null = null;
  public client = { defaults: { baseURL: `${BASE_URL}/api` } };

  private async getToken(): Promise<string | null> {
    if (this.token) return this.token;
    try {
      const stored = await AsyncStorage.getItem('auth_token');
      if (stored) this.token = stored;
    } catch (_) {}
    return this.token;
  }

  private async req<T = any>(method: string, path: string, body?: any, params?: Record<string, any>, responseType?: string): Promise<T> {
    const token = await this.getToken();
    let url = `${BASE_URL}/api${path}`;
    if (params) {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (qs) url += `?${qs}`;
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && path !== '/auth/login') {
      this.token = null;
      try {
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('auth_user');
      } catch (_) {}
    }

    if (!res.ok) {
      let detail = res.statusText;
      try { detail = (await res.json()).detail ?? detail; } catch (_) {}
      throw Object.assign(new Error(detail), { response: { status: res.status, data: { detail } } });
    }

    if (responseType === 'blob') return res.blob() as any;
    const text = await res.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  private get http() {
    return {
      get: (path: string, cfg?: { params?: any; responseType?: string }) =>
        this.req('GET', path, undefined, cfg?.params, cfg?.responseType).then(data => ({ data })),
      post: (path: string, body?: any, cfg?: { params?: any }) =>
        this.req('POST', path, body, cfg?.params).then(data => ({ data })),
      put: (path: string, body?: any, cfg?: { params?: any }) =>
        this.req('PUT', path, body, cfg?.params).then(data => ({ data })),
      delete: (path: string) =>
        this.req('DELETE', path).then(data => ({ data })),
    };
  }

  setToken(token: string | null) {
    this.token = token;
  }

  // Auth
  async login(phone: string, pin: string) {
    const response = await this.http.post('/auth/login', { phone, pin });
    return response.data;
  }

  async register(name: string, phone: string, pin: string, role: string) {
    const response = await this.http.post('/auth/register', { name, phone, pin, role });
    return response.data;
  }

  async getMe() {
    const response = await this.http.get('/auth/me');
    return response.data;
  }

  // Products
  async getProducts() {
    const response = await this.http.get('/products');
    return response.data;
  }

  async createProduct(data: { name: string; category: string; unit_type: string; price: number }) {
    const response = await this.http.post('/products', data);
    return response.data;
  }

  async updateProduct(productId: string, data: { name: string; category: string; unit_type: string; price: number }) {
    const response = await this.http.put(`/products/${productId}`, data);
    return response.data;
  }

  async deleteProduct(productId: string) {
    const response = await this.http.delete(`/products/${productId}`);
    return response.data;
  }

  // Users (Admin only)
  async getUsers() {
    const response = await this.http.get('/users');
    return response.data;
  }

  async createUser(data: { name: string; phone: string; pin: string; role: string }) {
    const response = await this.http.post('/users', data);
    return response.data;
  }

  async updateUser(userId: string, data: { name?: string; phone?: string; role?: string; is_active?: boolean }) {
    const response = await this.http.put(`/users/${userId}`, data);
    return response.data;
  }

  async deactivateUser(userId: string) {
    const response = await this.http.delete(`/users/${userId}`);
    return response.data;
  }

  async resetUserPin(userId: string, newPin: string) {
    const response = await this.http.put(`/users/${userId}/reset-pin?new_pin=${newPin}`);
    return response.data;
  }

  // Customers
  async getCustomers(routeId?: string) {
    const params = routeId ? { route_id: routeId } : {};
    const response = await this.http.get('/customers', { params });
    return response.data;
  }

  async getCustomer(customerId: string) {
    const response = await this.http.get(`/customers/${customerId}`);
    return response.data;
  }

  async createCustomer(data: { name: string; contact?: string; location?: string; payment_terms?: string; credit_limit?: number; route_id?: string }) {
    const response = await this.http.post('/customers', data);
    return response.data;
  }

  async updateCustomer(customerId: string, data: { name?: string; contact?: string; location?: string; payment_terms?: string; credit_limit?: number; route_id?: string; is_active?: boolean }) {
    const response = await this.http.put(`/customers/${customerId}`, data);
    return response.data;
  }

  async deactivateCustomer(customerId: string) {
    const response = await this.http.delete(`/customers/${customerId}`);
    return response.data;
  }

  async getCustomerHistory(customerId: string, days: number = 30) {
    const response = await this.http.get(`/customers/${customerId}/history`, { params: { days } });
    return response.data;
  }

  // Routes
  async getRoutes() {
    const response = await this.http.get('/routes');
    return response.data;
  }

  async createRoute(data: { name: string; description?: string }) {
    const response = await this.http.post('/routes', data);
    return response.data;
  }

  async updateRoute(routeId: string, data: { name?: string; description?: string; assigned_driver_id?: string }) {
    const response = await this.http.put(`/routes/${routeId}`, data);
    return response.data;
  }

  async deleteRoute(routeId: string) {
    const response = await this.http.delete(`/routes/${routeId}`);
    return response.data;
  }

  async getRouteCustomers(routeId: string) {
    const response = await this.http.get(`/routes/${routeId}/customers`);
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
    split_payments?: { method: string; amount: number; reference?: string }[];
    notes?: string;
    delivery_status?: string;
  }) {
    const response = await this.http.post('/sales', data);
    return response.data;
  }

  async getSales(routeId?: string, dateStr?: string, customerId?: string) {
    const params: any = {};
    if (routeId) params.route_id = routeId;
    if (dateStr) params.date_str = dateStr;
    if (customerId) params.customer_id = customerId;
    const response = await this.http.get('/sales', { params });
    return response.data;
  }

  async getSale(saleId: string) {
    const response = await this.http.get(`/sales/${saleId}`);
    return response.data;
  }

  async updateSale(saleId: string, data: any) {
    const response = await this.http.put(`/sales/${saleId}`, data);
    return response.data;
  }

  async voidSale(saleId: string, reason: string) {
    const response = await this.http.post(`/sales/${saleId}/void?reason=${encodeURIComponent(reason)}`);
    return response.data;
  }

  async getCustomerSales(customerId: string) {
    const response = await this.http.get(`/sales/customer/${customerId}`);
    return response.data;
  }

  // Daily Routes
  async startDailyRoute(data: { route_id: string; vehicle_id: string; opening_km: number; crates_out: number; vehicle_check?: any }) {
    const response = await this.http.post('/daily-routes/start', data);
    return response.data;
  }

  async updateDailyRoute(routeId: string, data: any) {
    const response = await this.http.put(`/daily-routes/${routeId}`, data);
    return response.data;
  }

  async endDailyRoute(routeId: string, data: { closing_km: number; crates_in: number; damages_count?: number; fuel_used?: number; notes?: string }) {
    const response = await this.http.put(`/daily-routes/${routeId}/end`, data);
    return response.data;
  }

  async getActiveDailyRoutes() {
    const response = await this.http.get('/daily-routes/active');
    return response.data;
  }

  async getActiveDailyRoute() {
    const routes = await this.getActiveDailyRoutes();
    return routes.length > 0 ? routes[0] : null;
  }

  async getAllActiveRoutes() {
    const response = await this.http.get('/daily-routes/active/all');
    return response.data;
  }

  async getDailyRouteHistory(driverId?: string) {
    const params = driverId ? { driver_id: driverId } : {};
    const response = await this.http.get('/daily-routes/history', { params });
    return response.data;
  }

  // Permissions
  async getPermissions() {
    const response = await this.http.get('/permissions');
    return response.data;
  }

  // Reports
  async getDailySummary(dateStr?: string) {
    const params = dateStr ? { date_str: dateStr } : {};
    const response = await this.http.get('/reports/daily-summary', { params });
    return response.data;
  }

  async getRoutePerformance(routeId: string, days: number = 7) {
    const response = await this.http.get(`/reports/route-performance/${routeId}`, { params: { days } });
    return response.data;
  }

  getExportExcelUrl(dateStr?: string, routeId?: string) {
    let url = `${BASE_URL}/api/reports/export/excel?`;
    if (dateStr) url += `date_str=${dateStr}&`;
    if (routeId) url += `route_id=${routeId}&`;
    return url;
  }

  // Email Reports
  async sendEmailReport(data: { report_type: string; recipient_emails: string[]; date_str?: string; include_excel?: boolean }) {
    const response = await this.http.post('/reports/email', data);
    return response.data;
  }

  async getEmailLogs() {
    const response = await this.http.get('/reports/email-logs');
    return response.data;
  }

  async saveEmailSettings(config: { smtp_server?: string; smtp_port?: number; sender_email: string; sender_password: string; recipient_emails: string[] }) {
    const response = await this.http.post('/settings/email', config);
    return response.data;
  }

  async getEmailSettings() {
    const response = await this.http.get('/settings/email');
    return response.data;
  }

  // Customer Pricing
  async getCustomerPrices(customerId: string) {
    const response = await this.http.get(`/customers/${customerId}/prices`);
    return response.data;
  }

  async updateCustomerPrices(customerId: string, prices: Record<string, number>) {
    const response = await this.http.put(`/customers/${customerId}/prices`, prices);
    return response.data;
  }

  // Daily Route specific
  async getDailyRouteById(routeId: string) {
    const response = await this.http.get(`/daily-routes/${routeId}`);
    return response.data;
  }

  async deleteDailyRoute(routeId: string) {
    const response = await this.http.delete(`/daily-routes/${routeId}`);
    return response.data;
  }

  // Vehicles
  async getVehicles(includeInactive: boolean = false) {
    const params = includeInactive ? { include_inactive: true } : {};
    const response = await this.http.get('/vehicles', { params });
    return response.data;
  }

  async getAvailableVehicles() {
    const response = await this.http.get('/vehicles/available');
    return response.data;
  }

  async createVehicle(data: { registration: string; name: string; vehicle_type?: string; capacity_crates?: number }) {
    const response = await this.http.post('/vehicles', data);
    return response.data;
  }

  async updateVehicle(vehicleId: string, data: { registration?: string; name?: string; vehicle_type?: string; capacity_crates?: number; is_active?: boolean }) {
    const response = await this.http.put(`/vehicles/${vehicleId}`, data);
    return response.data;
  }

  async deactivateVehicle(vehicleId: string) {
    const response = await this.http.delete(`/vehicles/${vehicleId}`);
    return response.data;
  }

  async seedVehicles() {
    const response = await this.http.post('/vehicles/seed');
    return response.data;
  }

  // Stock Management
  async getStockLevels() {
    const response = await this.http.get('/stock/levels');
    return response.data;
  }

  async receiveStock(data: {
    product_id: string;
    product_name: string;
    quantity: number;
    supplier?: string;
    batch_reference?: string;
    damages_in_transit?: number;
    rejected_stock?: number;
    spoilt_from_factory?: number;
    crates_received?: number;
    crates_returned?: number;
    notes?: string
  }) {
    const response = await this.http.post('/stock/receive', data);
    return response.data;
  }

  async adjustStock(data: { product_id: string; product_name: string; adjustment_quantity: number; reason: string; notes?: string }) {
    const response = await this.http.post('/stock/adjustment', data);
    return response.data;
  }

  async recordStockTake(data: { product_id: string; product_name: string; system_quantity: number; physical_count: number; variance_reason?: string }) {
    const response = await this.http.post('/stock/take', data);
    return response.data;
  }

  async getStockMovements(productId?: string, movementType?: string, days: number = 30) {
    const params: any = { days };
    if (productId) params.product_id = productId;
    if (movementType) params.movement_type = movementType;
    const response = await this.http.get('/stock/movements', { params });
    return response.data;
  }

  async getStockReport() {
    const response = await this.http.get('/stock/report');
    return response.data;
  }

  async seedStock() {
    const response = await this.http.post('/stock/seed');
    return response.data;
  }

  // PDF Export
  async exportReportPDF(params: { date_str?: string; route_id?: string; driver_id?: string; customer_id?: string }) {
    const response = await this.http.get('/reports/export/pdf', { params, responseType: 'blob' });
    return response.data;
  }

  // Email Recipients Management
  async getEmailRecipients() {
    const response = await this.http.get('/admin/email-recipients');
    return response.data;
  }

  async addEmailRecipient(data: { email: string; name?: string; report_types: string[] }) {
    const response = await this.http.post('/admin/email-recipients', data);
    return response.data;
  }

  async updateEmailRecipient(recipientId: string, data: { email: string; name?: string; report_types: string[] }) {
    const response = await this.http.put(`/admin/email-recipients/${recipientId}`, data);
    return response.data;
  }

  async deleteEmailRecipient(recipientId: string) {
    const response = await this.http.delete(`/admin/email-recipients/${recipientId}`);
    return response.data;
  }

  async toggleEmailRecipient(recipientId: string) {
    const response = await this.http.post(`/admin/email-recipients/${recipientId}/toggle`);
    return response.data;
  }

  async sendReport(reportType: string, dateStr?: string) {
    const response = await this.http.post('/admin/send-report', null, {
      params: { report_type: reportType, date_str: dateStr }
    });
    return response.data;
  }

  // SMTP Settings
  async getSmtpSettings() {
    const response = await this.http.get('/admin/settings/email');
    return response.data;
  }

  async saveSmtpSettings(data: { sender_email: string; sender_password: string; smtp_server: string; smtp_port: number }) {
    const response = await this.http.post('/admin/settings/email', data);
    return response.data;
  }

  // Seed data
  async seedAll() {
    const response = await this.http.post('/seed-all');
    return response.data;
  }

  // Health check
  async healthCheck() {
    const response = await this.http.get('/health');
    return response.data;
  }

  // Company Setup
  async setupCompany(data: {
    company: { name: string; contact_person: string; phone: string; email?: string; address?: string };
    admin_name: string;
    admin_phone: string;
    admin_pin: string;
  }) {
    const response = await this.http.post('/companies/setup', data);
    return response.data;
  }

  async getMyCompany() {
    const response = await this.http.get('/companies/mine');
    return response.data;
  }

  async request(method: string, path: string, data?: any) {
    return this.req(method, path, data);
  }

  async updateMyCompany(data: { name: string; contact_person: string; phone: string; email?: string; address?: string }) {
    const response = await this.http.put('/companies/mine', data);
    return response.data;
  }

  // Location Data
  async getProvinces() {
    const response = await this.http.get('/locations/provinces');
    return response.data;
  }

  async getDistricts(province: string) {
    const response = await this.http.get(`/locations/districts/${encodeURIComponent(province)}`);
    return response.data;
  }

  async getAreas(province: string, district: string) {
    const response = await this.http.get(`/locations/areas/${encodeURIComponent(province)}/${encodeURIComponent(district)}`);
    return response.data;
  }

  // Ordering System
  async listCompanies() {
    const response = await this.http.get('/companies/list');
    return response.data;
  }

  async listCompanyRoutes(companyId: string) {
    const response = await this.http.get(`/companies/${companyId}/routes`);
    return response.data;
  }

  async listCompanyProducts(companyId: string) {
    const response = await this.http.get(`/companies/${companyId}/products`);
    return response.data;
  }

  async registerCustomer(data: {
    business_name: string;
    contact_person: string;
    phone: string;
    pin: string;
    delivery_address?: string;
    province?: string;
    district?: string;
    city?: string;
    company_id?: string;
    route_id?: string;
  }) {
    const response = await this.http.post('/auth/register-customer', data);
    return response.data;
  }

  async getAvailableCompanies() {
    const response = await this.http.get('/customer/available-companies');
    return response.data;
  }

  async getCompanyProducts(companyId: string) {
    const response = await this.http.get(`/customer/company/${companyId}/products`);
    return response.data;
  }

  async getCustomerProducts() {
    const response = await this.http.get('/customer/products');
    return response.data;
  }

  async getCustomerDeliveryInfo() {
    const response = await this.http.get('/customer/delivery-info');
    return response.data;
  }

  async createOrder(data: {
    company_id: string;
    items: { product_id: string; product_name: string; quantity: number; unit_price: number }[];
    notes?: string;
  }) {
    const response = await this.http.post('/orders', data);
    return response.data;
  }

  async getOrders(params?: { status?: string; route_id?: string; date_str?: string }) {
    const response = await this.http.get('/orders', { params });
    return response.data;
  }

  async getOrder(orderId: string) {
    const response = await this.http.get(`/orders/${orderId}`);
    return response.data;
  }

  async updateOrderStatus(orderId: string, status: string) {
    const response = await this.http.put(`/orders/${orderId}/status`, { status });
    return response.data;
  }

  async adjustOrder(orderId: string, data: {
    items: { product_id: string; product_name: string; original_quantity: number; adjusted_quantity: number; unit_price: number; reason?: string }[];
    adjustment_reason?: string;
  }) {
    const response = await this.http.put(`/orders/${orderId}/adjust`, data);
    return response.data;
  }

  async getOrderDashboard() {
    const response = await this.http.get('/orders/dashboard/summary');
    return response.data;
  }

  async getRoutePacking(routeId: string) {
    const response = await this.http.get(`/orders/packing/${routeId}`);
    return response.data;
  }

  async updateRouteSchedule(routeId: string, data: { delivery_days: string[]; cut_off_hours_before?: number; cut_off_time?: string }) {
    const response = await this.http.put(`/routes/${routeId}/schedule`, data);
    return response.data;
  }

  async getRouteSchedule(routeId: string) {
    const response = await this.http.get(`/routes/${routeId}/schedule`);
    return response.data;
  }

  // Delivery Tracking
  async updateDriverLocation(dailyRouteId: string, data: { latitude: number; longitude: number; accuracy?: number; speed?: number; heading?: number }) {
    const response = await this.http.post(`/daily-routes/${dailyRouteId}/location`, data);
    return response.data;
  }

  async getDriverLocation(dailyRouteId: string) {
    const response = await this.http.get(`/daily-routes/${dailyRouteId}/location`);
    return response.data;
  }

  async getOrderTracking(orderId: string) {
    const response = await this.http.get(`/orders/${orderId}/tracking`);
    return response.data;
  }

  async batchUpdateOrderStatus(orderIds: string[], status: string) {
    const response = await this.http.put('/orders/batch-status', { order_ids: orderIds, status });
    return response.data;
  }

  async getRouteDeliveries(dailyRouteId: string) {
    const response = await this.http.get(`/daily-routes/${dailyRouteId}/deliveries`);
    return response.data;
  }

  // Vehicle Stock Dispatch
  async dispatchVehicleStock(data: {
    daily_route_id: string;
    items: { product_id: string; product_name: string; quantity: number }[];
    notes?: string;
  }) {
    const response = await this.http.post('/vehicle-stock/dispatch', data);
    return response.data;
  }

  async returnVehicleStock(data: {
    daily_route_id: string;
    items: { product_id: string; product_name: string; quantity: number }[];
    notes?: string;
  }) {
    const response = await this.http.post('/vehicle-stock/return', data);
    return response.data;
  }

  async getVehicleStock(dailyRouteId: string) {
    const response = await this.http.get(`/vehicle-stock/${dailyRouteId}`);
    return response.data;
  }

  async getMyVehicleStock() {
    const response = await this.http.get('/vehicle-stock/driver/my-stock');
    return response.data;
  }

  async getSupportInfo() {
    const response = await this.http.get('/support-info');
    return response.data;
  }
}

export const api = new ApiService();
