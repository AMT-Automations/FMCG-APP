import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type Section = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  content: { heading: string; body: string }[];
};

const SECTIONS: Section[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'rocket-outline',
    color: '#3B82F6',
    content: [
      {
        heading: 'Welcome to Mzansi FMCG Tracker',
        body: 'Mzansi FMCG Tracker is a complete distribution management platform. It connects distributors, drivers, and retail customers in one seamless marketplace.\n\nDistributors manage products, routes, and orders. Drivers handle deliveries with GPS tracking. Customers browse suppliers, place orders, and track deliveries in real time.',
      },
      {
        heading: 'Logging In',
        body: '1. Open the app and enter your Phone Number\n2. Enter your 4-digit PIN\n3. Tap "Sign In"\n\nYou will be directed to the correct dashboard based on your role (Admin/Driver or Customer).',
      },
      {
        heading: 'New Customer? Register',
        body: '1. On the login screen, tap "Register as Customer"\n2. Fill in your Name, Phone Number, and create a 4-digit PIN\n3. Select your Province, District, and Area\n4. Tap "Register"\n\nYou will automatically be matched with suppliers who deliver to your area.',
      },
    ],
  },
  {
    id: 'customer-guide',
    title: 'Customer Guide',
    icon: 'storefront-outline',
    color: '#10B981',
    content: [
      {
        heading: 'Browsing the Marketplace (Shop Tab)',
        body: 'The Shop tab shows all suppliers who deliver to your area.\n\n1. Tap on a supplier card to see their products\n2. You\'ll see a delivery banner at the top showing:\n   - Next delivery day and date\n   - Time remaining until orders close (cut-off)\n   - "CLOSING SOON" badge when less than 2 hours remain\n3. Browse products by category',
      },
      {
        heading: 'Placing an Order',
        body: '1. Tap "+" on any product to add it to your cart\n2. Adjust quantities using "+" and "-" buttons\n3. Review your cart at the bottom of the screen\n4. Tap "Place Order" to submit\n5. You\'ll see a confirmation with your order number and delivery date\n\nNote: Orders cannot be placed after the cut-off time. The banner will show when ordering is closed.',
      },
      {
        heading: 'Tracking Orders (My Orders Tab)',
        body: 'The "My Orders" tab shows all your orders.\n\n- Each order shows: order number, status, items, total amount, and delivery date\n- Active orders have a blue "Track Order" button\n- Tap "Track Order" to see:\n  * Full status timeline (Placed → Confirmed → Packed → Out for Delivery → Delivered)\n  * Driver information and vehicle details\n  * Delivery progress (stops completed vs remaining)\n  * Real-time updates when the driver is on the way\n- Delivered orders show a green "Delivered" badge\n- Pull down to refresh for latest status',
      },
      {
        heading: 'Your Profile (Profile Tab)',
        body: 'View and manage your account details:\n- Name, phone number\n- Location (Province, District, Area)\n- Tap "Logout" to sign out',
      },
    ],
  },
  {
    id: 'admin-guide',
    title: 'Admin / Manager Guide',
    icon: 'settings-outline',
    color: '#6366F1',
    content: [
      {
        heading: 'Home Dashboard',
        body: 'The Home tab gives you an overview of:\n- Active routes with driver and vehicle info\n- Quick action buttons: Admin Panel, Products, Stock, Orders\n- Active routes show "Continue Route" and "Deliveries" buttons',
      },
      {
        heading: 'Admin Panel',
        body: 'Access from Home → Admin Panel (gear icon). Four tabs:\n\n• Users — Add/edit staff accounts (admin, manager, driver, salesperson)\n• Vehicles — Register delivery vehicles with capacity\n• Routes — Create delivery routes with location-based coverage\n• Customers — View and manage customer accounts',
      },
      {
        heading: 'Managing Routes',
        body: '1. Go to Admin Panel → Routes tab\n2. Tap "+" to add a new route\n3. Fill in:\n   - Route name\n   - Province, District, Areas (cascading dropdowns)\n   - Delivery days (select which days of the week)\n   - Cut-off time (when orders close for the next delivery)\n4. Tap "Create Route"\n\nRoutes automatically match customers in those areas to your company.',
      },
      {
        heading: 'Order Cut-Off System',
        body: 'Each route has a delivery schedule with cut-off times:\n\n- Cut-off time determines when customers must place orders by\n- Example: Cut-off at 16:00 on Tuesday for Wednesday delivery\n- After cut-off, orders are blocked until the next delivery window\n- Customers see a countdown timer on the Shop screen\n- The system shows "CLOSING SOON" when under 2 hours remain',
      },
      {
        heading: 'Managing Products',
        body: '1. From Home, tap "Products"\n2. Add products with name, SKU, category, price, and unit\n3. Products are available to all customers in your delivery areas\n4. Edit or update prices anytime',
      },
      {
        heading: 'Stock Management',
        body: '1. From Home, tap "Stock"\n2. View current stock levels for all products\n3. Record stock movements (additions, adjustments)\n4. Track stock in/out over time',
      },
      {
        heading: 'Orders Management',
        body: '1. From Home, tap "Orders"\n2. View orders by status: Pending, Confirmed, Packed, Out for Delivery\n3. Update order statuses individually or in batch\n4. View order details including customer info and items',
      },
      {
        heading: 'Reports',
        body: 'The Reports tab (bar chart icon) provides:\n- Daily sales summary\n- Route performance reports\n- Export reports to PDF or Excel\n- Filter by date range',
      },
    ],
  },
  {
    id: 'driver-guide',
    title: 'Driver Guide',
    icon: 'car-outline',
    color: '#F97316',
    content: [
      {
        heading: 'Starting a Route',
        body: '1. From Home, tap "Start Route" on an available route card\n2. Select your vehicle from the dropdown\n3. Confirm the route details\n4. Tap "Start Route" to begin your delivery run\n\nThe route will appear as "Active" on your Home screen.',
      },
      {
        heading: 'Managing Deliveries',
        body: '1. Tap "Deliveries" on your active route card\n2. You\'ll see all orders for today\'s route with a summary:\n   - Total orders, En Route, Delivered, Packed counts\n3. Each order card shows: customer name, items, and amount\n4. Tap "Mark Delivered" on individual orders as you complete them\n5. Use "All Out for Delivery" to batch-update all orders at once',
      },
      {
        heading: 'GPS Location Tracking',
        body: '1. On the Deliveries screen, tap "Start GPS"\n2. Allow location permission when prompted\n3. Your location updates every 60 seconds automatically\n4. Customers can see your approximate location when their order is "Out for Delivery"\n5. The button shows "Tracking ON" in green when active\n6. Tap again to stop tracking when your route is complete',
      },
      {
        heading: 'Ending a Route',
        body: '1. From your active route, tap "Continue Route"\n2. Complete all remaining deliveries\n3. Record any final sales\n4. Tap "End Route" to complete your delivery run\n5. A summary of the day\'s deliveries will be shown',
      },
    ],
  },
  {
    id: 'order-statuses',
    title: 'Order Status Guide',
    icon: 'git-branch-outline',
    color: '#EC4899',
    content: [
      {
        heading: 'Order Lifecycle',
        body: 'Every order goes through these stages:\n\n1. 🟡 PENDING — Order placed, awaiting confirmation\n2. 🟢 CONFIRMED — Distributor confirmed the order\n3. 🔵 ADJUSTED — Order modified by distributor (quantities/items changed)\n4. 🟣 PACKED — Order packed and ready for delivery\n5. 🟠 OUT FOR DELIVERY — Driver is on the way\n6. ✅ DELIVERED — Successfully delivered to customer\n7. 🔴 CANCELLED — Order was cancelled',
      },
      {
        heading: 'For Customers',
        body: '- You\'ll see the current status on your "My Orders" tab\n- Use "Track Order" for detailed timeline and driver info\n- Orders auto-refresh every 30 seconds when "Out for Delivery"\n- Pull down to manually refresh anytime',
      },
      {
        heading: 'For Drivers/Admin',
        body: '- Update statuses from Orders Management or Route Deliveries\n- Use batch update to mark multiple orders at once\n- Each status change is recorded with timestamp in the order history',
      },
    ],
  },
  {
    id: 'tips',
    title: 'Tips & Troubleshooting',
    icon: 'bulb-outline',
    color: '#F59E0B',
    content: [
      {
        heading: 'Best Practices',
        body: '• Place orders before the cut-off time to ensure next-day delivery\n• Drivers should enable GPS tracking before leaving the warehouse\n• Admins should confirm orders promptly so customers see updated status\n• Use pull-to-refresh on any screen to get the latest data\n• Check the Reports tab regularly for business insights',
      },
      {
        heading: 'Common Issues',
        body: '• "Ordering Closed" — The cut-off time has passed. Wait for the next delivery window.\n• Can\'t see any suppliers — Make sure your registered area matches a route.\n• Order not updating — Pull down to refresh. The status may take a moment to sync.\n• Login failed — Double-check your phone number and PIN. Contact your admin if locked out.',
      },
      {
        heading: 'Need Help?',
        body: 'Contact your distributor\'s admin for:\n- Account issues (password reset, profile updates)\n- Order inquiries or disputes\n- Adding new delivery areas',
      },
    ],
  },
];

export default function UserManualScreen() {
  const router = useRouter();
  const [expandedSection, setExpandedSection] = useState<string | null>('getting-started');

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Manual</Text>
        <Ionicons name="book-outline" size={24} color="#3B82F6" />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Welcome Banner */}
        <View style={styles.banner}>
          <Ionicons name="help-circle" size={32} color="#3B82F6" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.bannerTitle}>Welcome to the Help Center</Text>
            <Text style={styles.bannerSub}>
              Tap any section below to learn how to use the app
            </Text>
          </View>
        </View>

        {/* Sections */}
        {SECTIONS.map((section) => {
          const isExpanded = expandedSection === section.id;
          return (
            <View key={section.id} style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(section.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.sectionIcon, { backgroundColor: section.color + '20' }]}>
                  <Ionicons name={section.icon} size={22} color={section.color} />
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.sectionBody}>
                  {section.content.map((item, idx) => (
                    <View key={idx} style={[styles.contentBlock, idx > 0 && styles.contentDivider]}>
                      <Text style={styles.contentHeading}>{item.heading}</Text>
                      <Text style={styles.contentBody}>{item.body}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* Quick Reference */}
        <View style={styles.quickRef}>
          <Text style={styles.quickRefTitle}>Quick Reference</Text>
          <View style={styles.quickRefRow}>
            <View style={styles.quickRefItem}>
              <View style={[styles.quickRefDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.quickRefText}>Customer tabs: Shop, My Orders, Profile</Text>
            </View>
            <View style={styles.quickRefItem}>
              <View style={[styles.quickRefDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.quickRefText}>Admin tabs: Home, Route, Reports, Profile</Text>
            </View>
            <View style={styles.quickRefItem}>
              <View style={[styles.quickRefDot, { backgroundColor: '#F97316' }]} />
              <Text style={styles.quickRefText}>Driver: Same as Admin + Deliveries panel</Text>
            </View>
          </View>
        </View>

        <Text style={styles.version}>Mzansi FMCG Tracker v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155', gap: 8,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  banner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E3A5F',
    borderRadius: 12, padding: 16, marginTop: 16, marginBottom: 8,
    borderWidth: 1, borderColor: '#3B82F6',
  },
  bannerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bannerSub: { color: '#94A3B8', fontSize: 13, marginTop: 4 },
  sectionCard: {
    backgroundColor: '#1E293B', borderRadius: 12, marginTop: 12,
    borderWidth: 1, borderColor: '#334155', overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12,
  },
  sectionIcon: {
    width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16 },
  contentBlock: { marginTop: 12 },
  contentDivider: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
  contentHeading: { color: '#E2E8F0', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  contentBody: { color: '#94A3B8', fontSize: 14, lineHeight: 22 },
  quickRef: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  quickRefTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  quickRefRow: { gap: 10 },
  quickRefItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickRefDot: { width: 10, height: 10, borderRadius: 5 },
  quickRefText: { color: '#CBD5E1', fontSize: 13 },
  version: { color: '#475569', textAlign: 'center', fontSize: 12, marginTop: 24 },
});
