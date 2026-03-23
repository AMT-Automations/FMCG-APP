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
        heading: 'What is Mzansi FMCG Tracker?',
        body: 'Mzansi FMCG Tracker is a distribution management platform built for the South African FMCG (Fast-Moving Consumer Goods) industry. It is a marketplace that connects three types of users:\n\n1. Distributors (Admin/Manager) — Companies that sell and deliver products to retail customers.\n2. Drivers — Staff members who physically deliver products on assigned routes.\n3. Retail Customers — Shop owners, tuck shop owners, or spaza shops who order products for resale.\n\nThe app handles everything from product catalog management, order placement, delivery scheduling, route planning, stock tracking, GPS-based delivery tracking, and sales reporting — all in one place.',
      },
      {
        heading: 'How to Log In',
        body: 'Step 1: Open the app. You will see the login screen with the Mzansi FMCG Tracker logo at the top.\n\nStep 2: In the first field labelled "Phone Number", type your registered phone number. For example: 0831001001.\n\nStep 3: In the second field labelled "4-digit PIN", type your 4-digit numeric PIN. For example: 1111.\n\nStep 4: Tap the blue "Sign In" button.\n\nStep 5: The app will verify your credentials. If correct, you will be taken to your dashboard:\n- If you are an Admin, Manager, Driver, or Salesperson, you go to the Staff Dashboard with tabs for Home, Route, Reports, and Profile.\n- If you are a Customer, you go to the Customer Dashboard with tabs for Shop, My Orders, and Profile.\n\nIf your phone number or PIN is wrong, the app will show an error message. Double-check your details and try again.',
      },
      {
        heading: 'How to Register as a New Customer',
        body: 'If you are a retail shop owner and do not have an account yet, follow these steps:\n\nStep 1: On the login screen, scroll down and tap the green text that says "Register as Customer".\n\nStep 2: You will see the Customer Registration screen. The process has 4 steps:\n\nSTEP 1 OF 4 — SELECT YOUR LOCATION:\n- You will see a list of Provinces (e.g., Gauteng, Western Cape, KwaZulu-Natal). Tap on your province.\n- After selecting a province, a list of Districts will appear. Tap on your district.\n- After selecting a district, a list of Areas will appear. Tap on your specific area.\n- If you make a mistake, tap the blue chip at the top showing your selection to go back and change it.\n\nSTEP 2 OF 4 — SELECT A SUPPLIER (OPTIONAL):\n- The app will show you all distribution companies that deliver to your selected area.\n- Tap on a company to link with them, OR tap "Skip — Browse all later" if you want to explore the marketplace first.\n\nSTEP 3 OF 4 — YOUR DETAILS:\n- Business Name: Type the name of your shop (e.g., "Sipho\'s Tuck Shop").\n- Contact Person: Type your full name (e.g., "Sipho Mthembu").\n- Phone Number: Type your mobile number (e.g., "0831234567"). This will be your login username.\n- Delivery Address: Type your street address where deliveries should be made.\n- Create PIN: Choose a 4-digit number you will remember. This is your login password.\n- Confirm PIN: Type the same 4-digit number again to confirm.\n\nStep 3: Tap the green "Complete Registration" button.\n\nStep 4: If successful, you will see a success message. Tap "Start Shopping" to go to the marketplace.\n\nYou can now log in anytime using your phone number and PIN.',
      },
      {
        heading: 'How to Register a New Company (Distributor)',
        body: 'If you are a distributor and want to set up your company on the platform:\n\nStep 1: On the login screen, tap "Register a New Company".\n\nStep 2: Fill in the Company Setup form:\n- Company Name: The official name of your distribution business.\n- Contact Person: Name of the primary admin.\n- Phone Number: The admin\'s phone number (this becomes the admin login).\n- Email: Company email address.\n- Province: Select your operating province.\n- District: Select your district.\n- Area: Select your area.\n\nStep 3: Create a 4-digit PIN for admin login.\n\nStep 4: Tap "Register Company". Once registered, you can log in as admin and start adding products, routes, vehicles, and staff.',
      },
      {
        heading: 'Loading Demo Data (For Testing)',
        body: 'If you are trying the app for the first time and want to see how it works with sample data:\n\nStep 1: On the login screen, scroll to the very bottom.\n\nStep 2: Tap the "Load Demo Data" button.\n\nStep 3: Wait a few seconds while the database is seeded with sample companies, products, customers, routes, and vehicles.\n\nStep 4: Once complete, you can log in with these demo accounts:\n- Admin: Phone 0767862760, PIN 1984\n- Customer: Phone 0831001001, PIN 1111\n\nNote: Loading demo data will reset the database. Only use this for testing purposes.',
      },
    ],
  },
  {
    id: 'customer-shop',
    title: 'Customer: Shopping & Ordering',
    icon: 'cart-outline',
    color: '#10B981',
    content: [
      {
        heading: 'Browsing the Marketplace (Shop Tab)',
        body: 'After logging in as a customer, you will land on the Shop tab. This is your marketplace.\n\nWHAT YOU SEE:\n- A list of supplier cards. Each card shows the company name, a brief description, the number of products available, and a delivery day badge (e.g., "Mon, Wed, Fri").\n- Only suppliers who deliver to YOUR registered area are shown. If no suppliers appear, it means no distributor has a route covering your area yet.\n\nHOW TO BROWSE PRODUCTS:\nStep 1: Tap on any supplier card (e.g., "Mzansi Distribution").\n\nStep 2: The screen will load that supplier\'s product catalog. At the top you will see:\n- A green delivery banner if ordering is OPEN, showing:\n  - "Delivery: [Day] ([Date])" — The next delivery day.\n  - "Xh Ym until cut-off ([Day] [Date], [Time])" — How much time you have left to place your order.\n  - A red "CLOSING SOON" badge appears when less than 2 hours remain before cut-off.\n- A red banner if ordering is CLOSED, showing when the next ordering window opens.\n\nStep 3: Below the banner, you see product categories (e.g., Beverages, Snacks, Dairy). Tap a category to filter.\n\nStep 4: Each product card shows: Product Name, SKU code, Price per unit, and the unit type (e.g., per case, per pack).\n\nStep 5: To go back to the supplier list, tap the back arrow at the top left.',
      },
      {
        heading: 'Adding Products to Your Cart',
        body: 'While browsing a supplier\'s products:\n\nStep 1: Find the product you want to order.\n\nStep 2: Tap the blue "+" button on the right side of the product card. The quantity will change from 0 to 1.\n\nStep 3: To add more of the same product, tap "+" again. The number increases: 1, 2, 3, etc.\n\nStep 4: To reduce the quantity, tap the "-" button. If you reduce to 0, the product is removed from your cart.\n\nStep 5: As you add products, a cart summary bar appears at the bottom of the screen showing:\n- Total number of items in your cart.\n- Total amount in Rands (e.g., "R 1,250.00").\n- A "Place Order" button.\n\nYou can continue browsing and adding products from different categories before placing your order.',
      },
      {
        heading: 'Placing Your Order',
        body: 'Once you have added all the products you want:\n\nStep 1: Review the cart summary at the bottom. Make sure the item count and total amount look correct.\n\nStep 2: Tap the green "Place Order" button.\n\nStep 3: The app will check:\n- Is the ordering window still open? If the cut-off time has passed while you were browsing, you will see an error: "Orders for the next delivery are closed." You will need to wait for the next delivery window.\n- Are all products still available?\n\nStep 4: If everything is good, your order is submitted. You will see an Order Confirmation screen showing:\n- Your unique Order Number (e.g., "ORD-0001").\n- The delivery day and date.\n- A list of items you ordered with quantities and prices.\n- The total amount.\n\nStep 5: Tap "Back to Shop" to continue browsing, or go to the "My Orders" tab to see your order.\n\nIMPORTANT: Once an order is placed, you cannot edit it. Contact your supplier if you need changes.',
      },
      {
        heading: 'Understanding the Order Cut-Off System',
        body: 'The Order Cut-Off System ensures distributors have enough time to prepare your delivery.\n\nHOW IT WORKS:\n- Each delivery route has specific delivery days (e.g., Monday, Wednesday, Friday).\n- Each route also has a cut-off time (e.g., 16:00 the day before delivery).\n- You must place your order BEFORE the cut-off time.\n\nEXAMPLE:\n- Route delivers on Wednesday.\n- Cut-off is Tuesday at 16:00.\n- If you place your order on Tuesday at 15:30, it will be delivered on Wednesday. (Order accepted)\n- If you try to place your order on Tuesday at 16:30, it will be rejected. (Cut-off passed)\n- You would then need to wait for the next delivery window (e.g., Friday, with a Thursday cut-off).\n\nWHAT YOU SEE ON THE SHOP SCREEN:\n- Green banner: "21h 47m until cut-off (Tuesday 24 Mar, 16:00)" — You still have time.\n- Red "CLOSING SOON" badge: Less than 2 hours remain. Order quickly!\n- Red banner: "Ordering closed for this delivery" — You missed the cut-off. Wait for the next one.',
      },
    ],
  },
  {
    id: 'customer-tracking',
    title: 'Customer: Order Tracking',
    icon: 'navigate-outline',
    color: '#6366F1',
    content: [
      {
        heading: 'Viewing Your Orders (My Orders Tab)',
        body: 'Step 1: Tap the "My Orders" tab at the bottom of the screen (the receipt icon).\n\nStep 2: You will see a list of all your orders, sorted by most recent first. Each order card shows:\n- Order Number (e.g., "ORD-0005")\n- Status badge (colored label showing current status like "PENDING", "OUT FOR DELIVERY", etc.)\n- Number of items and order date\n- Delivery day and date\n- Total amount in Rands\n\nStep 3: For active orders (not yet delivered), you will see a blue "Track Order" button at the bottom of the card.\n\nStep 4: For delivered orders, you will see a green "Delivered" badge with a checkmark.\n\nStep 5: Pull down on the screen to refresh and get the latest order statuses.',
      },
      {
        heading: 'Tracking a Specific Order',
        body: 'To see detailed tracking information for an order:\n\nStep 1: On the "My Orders" tab, find the order you want to track.\n\nStep 2: Tap the blue "Track Order" button on that order card.\n\nStep 3: The Order Tracking screen opens. Here you will see:\n\nSECTION 1 — ORDER HEADER:\n- Your order number and current status badge.\n- The supplier name.\n- Delivery date.\n- Total amount.\n\nSECTION 2 — DELIVERY PROGRESS TIMELINE:\n- A visual timeline showing 5 stages:\n  1. Order Placed (yellow) — Your order has been received.\n  2. Confirmed (green) — The distributor has confirmed your order.\n  3. Packed (purple) — Your order has been packed and is ready for dispatch.\n  4. Out for Delivery (orange) — The driver has left with your order.\n  5. Delivered (green checkmark) — Your order has been delivered to you.\n- Completed stages show a green circle with a checkmark.\n- The current stage shows a blue pulsing circle.\n- Future stages show grey circles.\n- If a status change was recorded, the date and time appear below the stage name.\n\nSECTION 3 — ROUTE PROGRESS (only when Out for Delivery):\n- A progress bar showing how many delivery stops the driver has completed.\n- Example: "5 of 12 stops completed — 7 remaining".\n\nSECTION 4 — DRIVER INFORMATION (only when Out for Delivery):\n- Driver\'s name.\n- Vehicle name and registration number.\n- Last location update time.\n- A green "Driver is on the way" banner with a pulsing dot.\n\nSECTION 5 — ORDER ITEMS:\n- A list of every product you ordered with quantity and price.\n- The total at the bottom.\n\nIMPORTANT: When your order status is "Out for Delivery", the tracking screen automatically refreshes every 30 seconds to show you the latest info. You can also pull down to manually refresh at any time.',
      },
      {
        heading: 'Understanding Order Statuses',
        body: 'Your order goes through these stages in order:\n\n1. PENDING (Yellow)\nYour order has been placed and is waiting for the distributor to review it. No action needed from you.\n\n2. CONFIRMED (Green)\nThe distributor has reviewed and accepted your order. They are preparing it for delivery.\n\n3. ADJUSTED (Blue) — Optional\nThe distributor has modified your order. This could mean a product was out of stock and the quantity was changed. Check your order details to see what changed.\n\n4. PACKED (Purple)\nYour order has been packed into crates or boxes and is ready to be loaded onto the delivery vehicle.\n\n5. OUT FOR DELIVERY (Orange)\nThe driver has started the delivery route and your order is on the vehicle. You can now see driver information and delivery progress on the tracking screen.\n\n6. DELIVERED (Green with double checkmark)\nYour order has been delivered to your location. The driver marked it as complete.\n\n7. CANCELLED (Red) — Only if something went wrong\nThe order was cancelled. This could be due to stock issues, payment problems, or a request from you. Contact your supplier for details.',
      },
    ],
  },
  {
    id: 'customer-profile',
    title: 'Customer: Your Profile',
    icon: 'person-outline',
    color: '#F59E0B',
    content: [
      {
        heading: 'Viewing Your Profile',
        body: 'Step 1: Tap the "Profile" tab at the bottom of the screen (the person icon).\n\nStep 2: Your profile screen shows:\n- Your name and phone number at the top.\n- Your location details: Province, District, and Area.\n- Your role: "customer".\n\nThis information determines which suppliers appear in your marketplace. If you move to a different area, contact your admin to update your location.',
      },
      {
        heading: 'Accessing the User Manual',
        body: 'Step 1: On the Profile tab, scroll down.\n\nStep 2: Tap the blue "User Manual & Help" button.\n\nStep 3: The manual opens (this is what you are reading right now). Tap any section title to expand or collapse it. Tap the back arrow at the top to return to your profile.',
      },
      {
        heading: 'Logging Out',
        body: 'Step 1: On the Profile tab, scroll to the bottom.\n\nStep 2: Tap the red "Logout" button.\n\nStep 3: A confirmation popup will appear asking "Are you sure you want to logout?".\n\nStep 4: Tap "Logout" to confirm, or "Cancel" to stay logged in.\n\nAfter logging out, you will be taken back to the login screen. You will need to enter your phone number and PIN to log in again.',
      },
    ],
  },
  {
    id: 'admin-dashboard',
    title: 'Admin: Home Dashboard',
    icon: 'grid-outline',
    color: '#3B82F6',
    content: [
      {
        heading: 'Understanding the Home Screen',
        body: 'After logging in as an Admin, Manager, Driver, or Salesperson, you land on the Home tab.\n\nWHAT YOU SEE:\n\nTOP SECTION — GREETING:\n- "Good morning/afternoon/evening, [Your Name]" with your company name below.\n\nQUICK ACTION BUTTONS (4 large cards):\n1. Admin Panel (gear icon) — Manage users, vehicles, routes, and customers.\n2. Products (cube icon) — Manage your product catalog with prices.\n3. Stock (layers icon) — Track stock levels and movements.\n4. Orders (receipt icon) — View and manage customer orders.\n\nACTIVE ROUTES SECTION:\n- If there are active delivery routes currently running, they appear here.\n- Each active route card shows: Route name, driver name, vehicle name, registration number, and status.\n- Two buttons on each active route:\n  - "Continue Route" (blue) — Takes you back into the route to record sales.\n  - "Deliveries" (orange) — Opens the delivery management screen to mark orders as delivered.',
      },
      {
        heading: 'Navigating the Bottom Tabs',
        body: 'The staff dashboard has 4 bottom tabs:\n\n1. HOME (house icon) — Your main dashboard with quick actions and active routes. This is where you start.\n\n2. ROUTE (map icon) — View all available routes and start a new delivery route. Shows route cards with delivery schedules.\n\n3. REPORTS (bar chart icon) — View business reports, daily sales summaries, and export data to PDF or Excel.\n\n4. PROFILE (person icon) — View your account details, access company setup, email settings, database admin, and the user manual. Also where you log out.',
      },
    ],
  },
  {
    id: 'admin-panel',
    title: 'Admin: Admin Panel',
    icon: 'settings-outline',
    color: '#6366F1',
    content: [
      {
        heading: 'Opening the Admin Panel',
        body: 'Step 1: From the Home tab, tap the "Admin Panel" card (the gear icon card).\n\nStep 2: The Admin Panel opens with 4 tabs at the top: Users, Vehicles, Routes, Customers.\n\nNote: Only Admin users can see the Users tab. Managers can see Vehicles, Routes, and Customers.',
      },
      {
        heading: 'Managing Users (Users Tab)',
        body: 'The Users tab lets you create and manage staff accounts.\n\nTO VIEW EXISTING USERS:\n- You see a list of all staff members with their name, phone number, and role badge (admin, manager, driver, salesperson).\n\nTO ADD A NEW USER:\nStep 1: Tap the blue "+" button in the top right corner.\n\nStep 2: A form slides up from the bottom. Fill in:\n- Name: The person\'s full name (e.g., "John Dlamini").\n- Phone Number: Their mobile number (e.g., "0821234567"). This becomes their login username.\n- Role: Tap the dropdown and select one of: admin, manager, driver, salesperson.\n  - Admin: Full access to everything.\n  - Manager: Can manage routes, vehicles, products, stock, and customers but cannot create other admins.\n  - Driver: Can start routes, manage deliveries, and record sales.\n  - Salesperson: Can record sales during routes.\n- PIN: Create a 4-digit PIN for them (e.g., "1234"). This is their login password.\n\nStep 3: Tap "Create User".\n\nStep 4: The new user appears in the list and can now log in with their phone number and PIN.',
      },
      {
        heading: 'Managing Vehicles (Vehicles Tab)',
        body: 'The Vehicles tab lets you register delivery vehicles.\n\nTO VIEW EXISTING VEHICLES:\n- Each vehicle card shows: Registration number, vehicle name, type (truck/van/bakkie), and capacity in crates.\n\nTO ADD A NEW VEHICLE:\nStep 1: Tap the "+" button.\n\nStep 2: Fill in the form:\n- Registration Number: The vehicle\'s license plate (e.g., "GP 123-456").\n- Vehicle Name: A friendly name (e.g., "Blue Toyota Hilux").\n- Vehicle Type: Select truck, van, or bakkie.\n- Capacity (Crates): How many crates the vehicle can carry (e.g., 50).\n\nStep 3: Tap "Add Vehicle".\n\nThe vehicle is now available for selection when starting delivery routes.',
      },
      {
        heading: 'Managing Routes (Routes Tab)',
        body: 'Routes define WHERE and WHEN you deliver to customers.\n\nTO VIEW EXISTING ROUTES:\n- Each route card shows: Route name, covered areas, and delivery days.\n\nTO CREATE A NEW ROUTE:\nStep 1: Tap the "+" button.\n\nStep 2: Fill in the route form:\n- Route Name: A descriptive name (e.g., "Soweto Monday Route").\n- Province: Select from the dropdown (e.g., "Gauteng").\n- District: Select from the dropdown (e.g., "Johannesburg South").\n- Areas: Select one or more areas this route covers. Tap each area to add it. Selected areas appear as blue chips. Tap the X on a chip to remove it.\n- Delivery Days: Tap each day of the week this route delivers. Selected days turn blue. (e.g., tap Monday, Wednesday, Friday).\n- Cut-off Time: Set the time when orders must be placed by. Format is HH:MM (e.g., "16:00" means customers must order by 4 PM the day before delivery).\n- Cut-off Hours Before: How many hours before delivery the cut-off applies (e.g., 16 hours).\n\nStep 3: Tap "Create Route".\n\nIMPORTANT: The areas you select in the route determine which customers see your company in the marketplace. If a customer is registered in "Soweto" and your route covers "Soweto", they will see your company and products.',
      },
      {
        heading: 'Managing Customers (Customers Tab)',
        body: 'The Customers tab shows all retail customers linked to your company.\n\nTO VIEW CUSTOMERS:\n- Each customer card shows: Business name, contact person, phone number, and location (area).\n\nCustomers register themselves through the app. You can view their details here but cannot edit them directly. If a customer needs changes, they should contact you and you can work with the database admin tools.',
      },
    ],
  },
  {
    id: 'admin-products',
    title: 'Admin: Products & Stock',
    icon: 'cube-outline',
    color: '#10B981',
    content: [
      {
        heading: 'Managing Products',
        body: 'TO OPEN THE PRODUCTS SCREEN:\nStep 1: From Home, tap the "Products" card (the cube icon).\n\nTO VIEW YOUR PRODUCTS:\n- You see a list of all your products grouped by category.\n- Each product card shows: Product name, SKU code, category, price, and unit type.\n\nTO ADD A NEW PRODUCT:\nStep 1: Tap the "+" button.\n\nStep 2: Fill in the product form:\n- Product Name: The name as customers will see it (e.g., "Coca-Cola 2L x6").\n- SKU Code: A unique code for inventory tracking (e.g., "BEV-CC-2L6").\n- Category: Select or type a category (e.g., "Beverages", "Snacks", "Dairy", "Household").\n- Price: The selling price per unit in Rands (e.g., "89.99").\n- Unit: What one "unit" means (e.g., "case", "pack", "each", "crate").\n\nStep 3: Tap "Add Product".\n\nThe product is immediately available in the marketplace for customers in your delivery areas.\n\nTO EDIT A PRODUCT:\n- Tap on an existing product card to edit its details.\n- Change the price, name, or category.\n- Tap "Save" to update.',
      },
      {
        heading: 'Stock Management',
        body: 'TO OPEN THE STOCK SCREEN:\nStep 1: From Home, tap the "Stock" card (the layers icon).\n\nWHAT YOU SEE:\n- A list of all your products with their current stock levels.\n- Stock levels show: Current quantity, unit type, and last updated date.\n\nTO RECORD A STOCK MOVEMENT:\nStep 1: Find the product you want to update.\n\nStep 2: Tap on the product card.\n\nStep 3: Enter the stock adjustment:\n- Quantity: How many units to add or remove.\n- Type: "Stock In" (received new stock) or "Stock Out" (used/damaged/returned).\n- Notes: Optional description (e.g., "Received delivery from warehouse").\n\nStep 4: Tap "Record Movement".\n\nThe stock level updates immediately. Stock movements are recorded with timestamps for audit purposes.',
      },
    ],
  },
  {
    id: 'admin-orders',
    title: 'Admin: Managing Orders',
    icon: 'receipt-outline',
    color: '#EC4899',
    content: [
      {
        heading: 'Viewing and Processing Orders',
        body: 'TO OPEN THE ORDERS SCREEN:\nStep 1: From Home, tap the "Orders" card (the receipt icon).\n\nWHAT YOU SEE:\n- A list of all customer orders sorted by date.\n- Each order shows: Order number, customer name, status, items count, and total amount.\n- Orders are color-coded by status:\n  - Yellow: Pending (needs your attention)\n  - Green: Confirmed\n  - Blue: Adjusted\n  - Purple: Packed\n  - Orange: Out for Delivery\n  - Green with checkmark: Delivered\n  - Red: Cancelled\n\nTO CHANGE AN ORDER\'S STATUS:\nStep 1: Tap on an order card to see its full details.\n\nStep 2: Review the items, quantities, and customer information.\n\nStep 3: Update the status:\n- Pending → Confirmed: You have reviewed and accepted the order.\n- Confirmed → Packed: The order has been packed and is ready for the vehicle.\n- Packed → Out for Delivery: The driver has picked up the order (usually done by the driver from the delivery screen).\n- Out for Delivery → Delivered: The order has been delivered (usually done by the driver).\n\nEach status change is recorded with a timestamp in the order\'s history.',
      },
    ],
  },
  {
    id: 'driver-routes',
    title: 'Driver: Routes & Delivery',
    icon: 'car-outline',
    color: '#F97316',
    content: [
      {
        heading: 'Starting a Delivery Route',
        body: 'TO START A ROUTE:\n\nStep 1: From the Home tab, tap the "Route" tab at the bottom (the map icon). OR tap "Start Route" on an available route card on the Home screen.\n\nStep 2: On the Route screen, you see all available routes with their names, delivery days, and covered areas.\n\nStep 3: Tap on the route you want to start (it should match today\'s delivery day).\n\nStep 4: The Start Route screen opens. Here you will see:\n- Route name and details.\n- A dropdown to select your Vehicle. Tap it and choose the vehicle you are driving today.\n- A list of customers on this route.\n\nStep 5: Review everything is correct.\n\nStep 6: Tap the green "Start Route" button.\n\nStep 7: The route is now ACTIVE. You will see it on the Home screen under "Active Routes".\n\nIMPORTANT: Only one route can be active at a time per driver. You must end the current route before starting another one.',
      },
      {
        heading: 'Managing Deliveries During a Route',
        body: 'Once your route is active, you can manage individual deliveries:\n\nStep 1: On the Home screen, find your active route card.\n\nStep 2: Tap the orange "Deliveries" button on the card.\n\nStep 3: The Route Deliveries screen opens. You will see:\n\nTOP SECTION — SUMMARY BAR:\n- Total: Total number of orders on this route.\n- En Route: Orders currently marked as "out for delivery".\n- Delivered: Orders you have already delivered.\n- Packed: Orders still waiting to be loaded.\n\nACTION BUTTONS:\n- "Start GPS" button (blue): Tap this to start sending your location. See the GPS Tracking section below for details.\n- "All Out for Delivery" button (orange): Tap this to mark ALL pending/confirmed/packed orders as "out for delivery" at once. A confirmation popup will appear. This is useful when you are leaving the warehouse with all orders loaded.\n\nORDER CARDS:\n- Each order is listed as a card showing:\n  - Customer name and order number.\n  - Status chip (colored badge).\n  - List of items with quantities.\n  - Total amount.\n  - A green "Mark Delivered" button.\n\nTO MARK AN ORDER AS DELIVERED:\nStep 1: Drive to the customer\'s location.\n\nStep 2: Hand over the products.\n\nStep 3: On the Deliveries screen, find that customer\'s order card.\n\nStep 4: Tap the green "Mark Delivered" button.\n\nStep 5: A confirmation popup appears: "Mark this order as delivered?". Tap "Delivered" to confirm.\n\nStep 6: The order card fades slightly and shows a green "Delivered" badge. The summary numbers at the top update.\n\nStep 7: Repeat for each customer on your route.\n\nPull down on the screen at any time to refresh the order list.',
      },
      {
        heading: 'GPS Location Tracking',
        body: 'The GPS tracking feature lets customers see that you are on the way.\n\nTO START GPS TRACKING:\nStep 1: On the Route Deliveries screen, tap the "Start GPS" button.\n\nStep 2: Your phone will ask for permission to access your location. Tap "Allow" or "While Using the App".\n\nStep 3: The button changes to "Tracking ON" with a green icon. Your location is now being sent to the server every 60 seconds.\n\nStep 4: Customers whose orders are "Out for Delivery" can now see:\n- Your name and vehicle details.\n- When your location was last updated.\n- A "Driver is on the way" banner.\n\nTO STOP GPS TRACKING:\nStep 1: Tap the "Tracking ON" button.\n\nStep 2: Tracking stops immediately. The button changes back to "Start GPS".\n\nIMPORTANT NOTES:\n- GPS tracking only works while the app is open in the foreground.\n- Location accuracy depends on your phone\'s GPS signal.\n- Tracking automatically stops if you navigate away from the screen.\n- Your location history is stored (last 100 points) for route analysis.',
      },
      {
        heading: 'Recording Sales During a Route',
        body: 'While on an active route, you can record direct sales to customers:\n\nStep 1: On the Home screen, tap "Continue Route" on your active route card.\n\nStep 2: You will see the route screen with customer stops.\n\nStep 3: Tap on a customer to open the sales screen.\n\nStep 4: Add products and quantities for the sale.\n\nStep 5: Record the sale. The stock levels and sales totals update automatically.\n\nSales recorded during routes appear in the daily Reports tab.',
      },
      {
        heading: 'Ending a Route',
        body: 'When all deliveries are complete:\n\nStep 1: From the active route, tap the option to end the route.\n\nStep 2: You will see a summary of:\n- Total orders delivered.\n- Total sales amount.\n- Route duration.\n- Stock summary.\n\nStep 3: Confirm to end the route.\n\nStep 4: The route is marked as "completed" and removed from the Active Routes section.\n\nYou can now start a new route if needed.',
      },
    ],
  },
  {
    id: 'admin-reports',
    title: 'Admin: Reports & Settings',
    icon: 'bar-chart-outline',
    color: '#8B5CF6',
    content: [
      {
        heading: 'Viewing Reports (Reports Tab)',
        body: 'Step 1: Tap the "Reports" tab at the bottom of the screen (the bar chart icon).\n\nStep 2: Select a date range using the date picker at the top.\n\nStep 3: View the report which shows:\n- Daily sales summary.\n- Route performance (orders per route, delivery times).\n- Product breakdown (which products are selling most).\n- Total revenue.\n\nTO EXPORT A REPORT:\n- Tap the "Export PDF" button to download a PDF version.\n- Tap the "Export Excel" button to download an Excel spreadsheet.\n- The file will be saved to your device\'s downloads folder.',
      },
      {
        heading: 'Profile Settings',
        body: 'On the Profile tab (for admin/manager), you have access to:\n\n1. COMPANY SETUP:\n- Tap "Company Setup" to view or edit your company details.\n- Update company name, contact info, and location.\n\n2. EMAIL SETTINGS / SMTP:\n- Configure email sending for order confirmations and invoices.\n- Set your SMTP server, port, username, and password.\n\n3. DATABASE ADMIN:\n- Advanced tool for managing the database.\n- Reset and reseed data if needed.\n- View collection statistics.\n- USE WITH CAUTION: This can delete all data.\n\n4. USER MANUAL & HELP:\n- Opens this help guide (what you are reading now).\n\n5. LOGOUT:\n- Signs you out of the app.',
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
        heading: 'Best Practices for Customers',
        body: '1. Place your orders as early as possible. Do not wait until the last minute before cut-off.\n2. Check the "My Orders" tab regularly to see if your order status has changed.\n3. When your order is "Out for Delivery", keep your phone nearby to receive the delivery.\n4. If you ordered the wrong items, contact your supplier immediately by phone — do not place a second order.\n5. Pull down on any screen to refresh and see the latest data.',
      },
      {
        heading: 'Best Practices for Admins',
        body: '1. Confirm orders promptly so customers can see the updated status.\n2. Pack orders the evening before delivery day and mark them as "Packed".\n3. Create clear route names that include the area and day (e.g., "Soweto Monday Route").\n4. Keep your product catalog up to date — remove discontinued items and update prices.\n5. Check Reports weekly to identify trends and plan stock purchases.\n6. Ensure all drivers have their login details before the delivery day.',
      },
      {
        heading: 'Best Practices for Drivers',
        body: '1. Start GPS tracking before leaving the warehouse.\n2. Use "All Out for Delivery" to batch-update orders when you leave.\n3. Mark each order as "Delivered" immediately after handing it over.\n4. Keep the app open while driving to maintain GPS tracking.\n5. End your route at the end of the day so the system records it properly.',
      },
      {
        heading: 'Common Problems and Solutions',
        body: 'PROBLEM: "I cannot see any suppliers in the marketplace."\nSOLUTION: Your registered area does not match any delivery route. Contact a distributor to check if they deliver to your area, or ask an admin to extend a route to cover your location.\n\nPROBLEM: "Orders for the next delivery are closed."\nSOLUTION: You tried to order after the cut-off time. Wait for the next delivery window. Check the delivery banner for the next available date.\n\nPROBLEM: "My order status has not changed in a long time."\nSOLUTION: Pull down to refresh. If the status still shows "Pending" after 24 hours, contact your supplier by phone.\n\nPROBLEM: "I cannot log in."\nSOLUTION: Double-check your phone number and PIN. Make sure you are using the exact phone number you registered with. If you forgot your PIN, contact your distributor\'s admin.\n\nPROBLEM: "The app is showing old data."\nSOLUTION: Pull down on any screen to refresh. If the problem persists, close the app completely and reopen it.\n\nPROBLEM: "GPS tracking is not working."\nSOLUTION: Make sure you granted location permission. Go to your phone\'s Settings → Apps → Mzansi FMCG Tracker → Permissions → Location → Allow.',
      },
      {
        heading: 'Need More Help?',
        body: 'If you have a problem not covered in this manual:\n\n1. Contact your distributor\'s admin for account issues.\n2. For order problems, call the supplier\'s phone number directly.\n3. For technical issues with the app, try closing and reopening it.\n4. If the problem continues, clear the app cache in your phone settings.',
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
            <Text style={styles.bannerTitle}>Mzansi FMCG Tracker Help Center</Text>
            <Text style={styles.bannerSub}>
              Complete step-by-step guide for every feature. Tap a section to expand.
            </Text>
          </View>
        </View>

        {/* Table of Contents */}
        <View style={styles.tocCard}>
          <Text style={styles.tocTitle}>Contents</Text>
          {SECTIONS.map((s, idx) => (
            <TouchableOpacity key={s.id} style={styles.tocItem} onPress={() => {
              setExpandedSection(s.id);
            }}>
              <Text style={styles.tocNumber}>{idx + 1}.</Text>
              <Ionicons name={s.icon} size={16} color={s.color} />
              <Text style={[styles.tocText, { color: s.color }]}>{s.title}</Text>
            </TouchableOpacity>
          ))}
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

        <Text style={styles.version}>Mzansi FMCG Tracker v1.0 — User Manual</Text>
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
  tocCard: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginTop: 12,
    borderWidth: 1, borderColor: '#334155',
  },
  tocTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  tocItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  tocNumber: { color: '#64748B', fontSize: 14, fontWeight: '700', width: 24 },
  tocText: { fontSize: 14, fontWeight: '600' },
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
  contentHeading: { color: '#E2E8F0', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  contentBody: { color: '#CBD5E1', fontSize: 14, lineHeight: 24 },
  version: { color: '#475569', textAlign: 'center', fontSize: 12, marginTop: 24, marginBottom: 8 },
});
