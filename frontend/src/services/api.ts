import axios from 'axios';

// Get backend URL from environment - required for production
const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
if (!BASE_URL) {
  console.warn('EXPO_PUBLIC_BACKEND_URL not set, using relative URL');
}

class ApiService {
  private token: string | null = null;
  private client = axios.create({
    baseURL: `${BASE_URL || ''}/api`,
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
    split_payments?: { method: string; amount: number; reference?: string }[];
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

  // Email Reports
  async sendEmailReport(data: { report_type: string; recipient_emails: string[]; date_str?: string; include_excel?: boolean }) {
    const response = await this.client.post('/reports/email', data);
    return response.data;
  }

  async getEmailLogs() {
    const response = await this.client.get('/reports/email-logs');
    return response.data;
  }

  async saveEmailSettings(config: { smtp_server?: string; smtp_port?: number; sender_email: string; sender_password: string; recipient_emails: string[] }) {
    const response = await this.client.post('/settings/email', config);
    return response.data;
  }

  async getEmailSettings() {
    const response = await this.client.get('/settings/email');
    return response.data;
  }

  // Customer Pricing
  async getCustomerPrices(customerId: string) {
    const response = await this.client.get(`/customers/${customerId}/prices`);
    return response.data;
  }

  async updateCustomerPrices(customerId: string, prices: Record<string, number>) {
    const response = await this.client.put(`/customers/${customerId}/prices`, prices);
    return response.data;
  }

  // Daily Route specific
  async getDailyRouteById(routeId: string) {
    const response = await this.client.get(`/daily-routes/${routeId}`);
    return response.data;
  }

  async deleteDailyRoute(routeId: string) {
    const response = await this.client.delete(`/daily-routes/${routeId}`);
    return response.data;
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

  // Stock Management
  async getStockLevels() {
    const response = await this.client.get('/stock/levels');
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
    const response = await this.client.post('/stock/receive', data);
    return response.data;
  }

  async adjustStock(data: { product_id: string; product_name: string; adjustment_quantity: number; reason: string; notes?: string }) {
    const response = await this.client.post('/stock/adjustment', data);
    return response.data;
  }

  async recordStockTake(data: { product_id: string; product_name: string; system_quantity: number; physical_count: number; variance_reason?: string }) {
    const response = await this.client.post('/stock/take', data);
    return response.data;
  }

  async getStockMovements(productId?: string, movementType?: string, days: number = 30) {
    const params: any = { days };
    if (productId) params.product_id = productId;
    if (movementType) params.movement_type = movementType;
    const response = await this.client.get('/stock/movements', { params });
    return response.data;
  }

  async getStockReport() {
    const response = await this.client.get('/stock/report');
    return response.data;
  }

  async seedStock() {
    const response = await this.client.post('/stock/seed');
    return response.data;
  }

  // PDF Export
  async exportReportPDF(params: { date_str?: string; route_id?: string; driver_id?: string; customer_id?: string }) {
    const response = await this.client.get('/reports/export/pdf', { 
      params,
      responseType: 'blob' 
    });
    return response.data;
  }

  // Email Recipients Management
  async getEmailRecipients() {
    const response = await this.client.get('/admin/email-recipients');
    return response.data;
  }

  async addEmailRecipient(data: { email: string; name?: string; report_types: string[] }) {
    const response = await this.client.post('/admin/email-recipients', data);
    return response.data;
  }

  async updateEmailRecipient(recipientId: string, data: { email: string; name?: string; report_types: string[] }) {
    const response = await this.client.put(`/admin/email-recipients/${recipientId}`, data);
    return response.data;
  }

  async deleteEmailRecipient(recipientId: string) {
    const response = await this.client.delete(`/admin/email-recipients/${recipientId}`);
    return response.data;
  }

  async toggleEmailRecipient(recipientId: string) {
    const response = await this.client.post(`/admin/email-recipients/${recipientId}/toggle`);
    return response.data;
  }

  async sendReport(reportType: string, dateStr?: string) {
    const response = await this.client.post('/admin/send-report', null, { 
      params: { report_type: reportType, date_str: dateStr } 
    });
    return response.data;
  }

  // SMTP Settings
  async getSmtpSettings() {
    const response = await this.client.get('/admin/settings/email');
    return response.data;
  }

  async saveSmtpSettings(data: { sender_email: string; sender_password: string; smtp_server: string; smtp_port: number }) {
    const response = await this.client.post('/admin/settings/email', data);
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

  // Company Setup
  async setupCompany(data: {
    company: { name: string; contact_person: string; phone: string; email?: string; address?: string };
    admin_name: string;
    admin_phone: string;
    admin_pin: string;
  }) {
    const response = await this.client.post('/companies/setup', data);
    return response.data;
  }

  async getMyCompany() {
    const response = await this.client.get('/companies/mine');
    return response.data;
  }

  // Generic request method for admin operations
  async request(method: string, path: string, data?: any) {
    const config: any = { method: method.toLowerCase(), url: path };
    if (data) config.data = data;
    const response = await this.client(config);
    return response.data;
  }

  async updateMyCompany(data: { name: string; contact_person: string; phone: string; email?: string; address?: string }) {
    const response = await this.client.put('/companies/mine', data);
    return response.data;
  }

  // ==================== ORDERING SYSTEM ====================

  // Public: List companies for customer registration
  async listCompanies() {
    const response = await this.client.get('/companies/list');
    return response.data;
  }

  // Public: List routes for a company
  async listCompanyRoutes(companyId: string) {
    const response = await this.client.get(`/companies/${companyId}/routes`);
    return response.data;
  }

  // Public: List products for a company
  async listCompanyProducts(companyId: string) {
    const response = await this.client.get(`/companies/${companyId}/products`);
    return response.data;
  }

  // Customer registration
  async registerCustomer(data: {
    business_name: string;
    contact_person: string;
    phone: string;
    pin: string;
    delivery_address?: string;
    company_id: string;
    route_id: string;
  }) {
    const response = await this.client.post('/auth/register-customer', data);
    return response.data;
  }

  // Customer: Get products from assigned distributor
  async getCustomerProducts() {
    const response = await this.client.get('/customer/products');
    return response.data;
  }

  // Customer: Get delivery info
  async getCustomerDeliveryInfo() {
    const response = await this.client.get('/customer/delivery-info');
    return response.data;
  }

  // Create order
  async createOrder(data: {
    company_id: string;
    items: { product_id: string; product_name: string; quantity: number; unit_price: number }[];
    notes?: string;
  }) {
    const response = await this.client.post('/orders', data);
    return response.data;
  }

  // Get orders (filtered by role automatically)
  async getOrders(params?: { status?: string; route_id?: string; date_str?: string }) {
    const response = await this.client.get('/orders', { params });
    return response.data;
  }

  // Get single order
  async getOrder(orderId: string) {
    const response = await this.client.get(`/orders/${orderId}`);
    return response.data;
  }

  // Update order status
  async updateOrderStatus(orderId: string, status: string) {
    const response = await this.client.put(`/orders/${orderId}/status`, { status });
    return response.data;
  }

  // Adjust order (distributor)
  async adjustOrder(orderId: string, data: {
    items: { product_id: string; product_name: string; original_quantity: number; adjusted_quantity: number; unit_price: number; reason?: string }[];
    adjustment_reason?: string;
  }) {
    const response = await this.client.put(`/orders/${orderId}/adjust`, data);
    return response.data;
  }

  // Get order dashboard summary (distributor)
  async getOrderDashboard() {
    const response = await this.client.get('/orders/dashboard/summary');
    return response.data;
  }

  // Get route packing summary
  async getRoutePacking(routeId: string) {
    const response = await this.client.get(`/orders/packing/${routeId}`);
    return response.data;
  }

  // Update route delivery schedule
  async updateRouteSchedule(routeId: string, data: { delivery_days: string[]; cut_off_hours_before?: number; cut_off_time?: string }) {
    const response = await this.client.put(`/routes/${routeId}/schedule`, data);
    return response.data;
  }

  // Get route delivery schedule
  async getRouteSchedule(routeId: string) {
    const response = await this.client.get(`/routes/${routeId}/schedule`);
    return response.data;
  }
}

export const api = new ApiService();
