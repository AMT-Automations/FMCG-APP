from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, date
import hashlib
import jwt
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'mzansi-distribution-secret-key-2025')
JWT_ALGORITHM = "HS256"

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'mzansi_distribution')]

# Create the main app
app = FastAPI(title="Mzansi Distribution Tracker API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Helper function for ObjectId
def str_id(doc: dict) -> dict:
    if doc and '_id' in doc:
        doc['id'] = str(doc['_id'])
        del doc['_id']
    return doc

# ==================== MODELS ====================

class UserCreate(BaseModel):
    name: str
    phone: str
    pin: str  # 4-digit PIN
    role: str = "driver"  # admin, driver, conductor

class UserResponse(BaseModel):
    id: str
    name: str
    phone: str
    role: str
    created_at: datetime

class LoginRequest(BaseModel):
    phone: str
    pin: str

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

class ProductCreate(BaseModel):
    name: str
    category: str
    unit_type: str  # units, crates, liters
    price: float

class ProductResponse(BaseModel):
    id: str
    name: str
    category: str
    unit_type: str
    price: float

class CustomerCreate(BaseModel):
    name: str
    contact: Optional[str] = None
    location: Optional[str] = None
    payment_terms: str = "cash"  # cash, credit, mixed
    route_id: Optional[str] = None

class CustomerResponse(BaseModel):
    id: str
    name: str
    contact: Optional[str]
    location: Optional[str]
    payment_terms: str
    route_id: Optional[str]

class RouteCreate(BaseModel):
    name: str
    description: Optional[str] = None

class RouteResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    customer_count: int = 0
    assigned_driver_id: Optional[str] = None
    assigned_driver_name: Optional[str] = None

class SaleItemCreate(BaseModel):
    product_id: str
    product_name: str
    quantity_delivered: int
    quantity_returned: int = 0
    damages: int = 0
    unit_price: float

class SaleCreate(BaseModel):
    route_id: str
    customer_id: str
    customer_name: str
    items: List[SaleItemCreate]
    cash_collected: float
    payment_type: str = "cash"  # cash, card, mobile
    notes: Optional[str] = None

class SaleResponse(BaseModel):
    id: str
    route_id: str
    customer_id: str
    customer_name: str
    driver_id: str
    driver_name: str
    items: List[dict]
    total_amount: float
    cash_collected: float
    payment_type: str
    notes: Optional[str]
    created_at: datetime

class DailyRouteStart(BaseModel):
    route_id: str
    opening_km: float
    crates_out: int
    vehicle_check: Optional[Dict[str, Any]] = None

class DailyRouteEnd(BaseModel):
    closing_km: float
    crates_in: int
    damages_count: int = 0
    fuel_used: Optional[float] = None
    notes: Optional[str] = None

class DailyRouteResponse(BaseModel):
    id: str
    route_id: str
    route_name: str
    driver_id: str
    driver_name: str
    date: str
    opening_km: float
    closing_km: Optional[float]
    km_traveled: Optional[float]
    crates_out: int
    crates_in: Optional[int]
    damages_count: int
    status: str  # active, completed
    sales_count: int
    total_collected: float

# ==================== AUTH HELPERS ====================

def hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.encode()).hexdigest()

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.utcnow().timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["user_id"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return str_id(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=UserResponse)
async def register_user(user: UserCreate):
    # Check if phone already exists
    existing = await db.users.find_one({"phone": user.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    user_doc = {
        "name": user.name,
        "phone": user.phone,
        "pin_hash": hash_pin(user.pin),
        "role": user.role,
        "created_at": datetime.utcnow()
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return str_id(user_doc)

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"phone": req.phone})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user["pin_hash"] != hash_pin(req.pin):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(str(user["_id"]), user["role"])
    return {
        "token": token,
        "user": str_id(user)
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ==================== PRODUCT ENDPOINTS ====================

@api_router.get("/products", response_model=List[ProductResponse])
async def get_products():
    products = await db.products.find().to_list(100)
    return [str_id(p) for p in products]

@api_router.post("/products", response_model=ProductResponse)
async def create_product(product: ProductCreate):
    product_doc = product.dict()
    result = await db.products.insert_one(product_doc)
    product_doc["_id"] = result.inserted_id
    return str_id(product_doc)

@api_router.post("/products/seed")
async def seed_products():
    """Seed default products"""
    default_products = [
        {"name": "White Bread", "category": "Bread", "unit_type": "units", "price": 18.00},
        {"name": "Brown Bread", "category": "Bread", "unit_type": "units", "price": 20.00},
        {"name": "Maas (500ml)", "category": "Dairy", "unit_type": "units", "price": 15.00},
        {"name": "Maas (1L)", "category": "Dairy", "unit_type": "units", "price": 25.00},
        {"name": "Mahewu (500ml)", "category": "Dairy", "unit_type": "units", "price": 12.00},
        {"name": "Mahewu (1L)", "category": "Dairy", "unit_type": "units", "price": 20.00},
        {"name": "Eggs (6 pack)", "category": "Eggs", "unit_type": "packs", "price": 35.00},
        {"name": "Eggs (12 pack)", "category": "Eggs", "unit_type": "packs", "price": 65.00},
        {"name": "Eggs (30 tray)", "category": "Eggs", "unit_type": "trays", "price": 150.00},
    ]
    
    # Clear existing and insert new
    await db.products.delete_many({})
    result = await db.products.insert_many(default_products)
    return {"message": f"Seeded {len(result.inserted_ids)} products"}

# ==================== CUSTOMER ENDPOINTS ====================

@api_router.get("/customers", response_model=List[CustomerResponse])
async def get_customers(route_id: Optional[str] = None):
    query = {}
    if route_id:
        query["route_id"] = route_id
    customers = await db.customers.find(query).to_list(500)
    return [str_id(c) for c in customers]

@api_router.post("/customers", response_model=CustomerResponse)
async def create_customer(customer: CustomerCreate):
    customer_doc = customer.dict()
    result = await db.customers.insert_one(customer_doc)
    customer_doc["_id"] = result.inserted_id
    return str_id(customer_doc)

@api_router.post("/customers/seed")
async def seed_customers():
    """Seed sample customers"""
    # First get routes
    routes = await db.routes.find().to_list(10)
    if not routes:
        return {"message": "Please seed routes first"}
    
    sample_customers = [
        {"name": "Shoprite Soweto", "contact": "011-555-0101", "location": "Soweto Mall", "payment_terms": "credit"},
        {"name": "Pick n Pay Diepkloof", "contact": "011-555-0102", "location": "Diepkloof Square", "payment_terms": "credit"},
        {"name": "Spaza Shop - Mama Joy", "contact": "078-555-0103", "location": "Orlando West", "payment_terms": "cash"},
        {"name": "Corner Cafe Meadowlands", "contact": "079-555-0104", "location": "Meadowlands Zone 1", "payment_terms": "cash"},
        {"name": "Spar Alexandra", "contact": "011-555-0105", "location": "Alex Mall", "payment_terms": "credit"},
        {"name": "Tuckshop - Mr Dlamini", "contact": "082-555-0106", "location": "Tembisa", "payment_terms": "cash"},
        {"name": "OK Foods Randburg", "contact": "011-555-0107", "location": "Randburg CBD", "payment_terms": "credit"},
        {"name": "Kasi Superette", "contact": "083-555-0108", "location": "Katlehong", "payment_terms": "mixed"},
    ]
    
    # Distribute customers across routes
    for i, customer in enumerate(sample_customers):
        customer["route_id"] = str(routes[i % len(routes)]["_id"])
    
    await db.customers.delete_many({})
    result = await db.customers.insert_many(sample_customers)
    return {"message": f"Seeded {len(result.inserted_ids)} customers"}

# ==================== ROUTE ENDPOINTS ====================

@api_router.get("/routes", response_model=List[RouteResponse])
async def get_routes(current_user: dict = Depends(get_current_user)):
    routes = await db.routes.find().to_list(50)
    result = []
    for route in routes:
        route = str_id(route)
        # Count customers
        customer_count = await db.customers.count_documents({"route_id": route["id"]})
        route["customer_count"] = customer_count
        result.append(route)
    return result

@api_router.post("/routes", response_model=RouteResponse)
async def create_route(route: RouteCreate):
    route_doc = route.dict()
    route_doc["assigned_driver_id"] = None
    route_doc["assigned_driver_name"] = None
    result = await db.routes.insert_one(route_doc)
    route_doc["_id"] = result.inserted_id
    route_doc["customer_count"] = 0
    return str_id(route_doc)

@api_router.post("/routes/seed")
async def seed_routes():
    """Seed sample routes"""
    sample_routes = [
        {"name": "Soweto North", "description": "Covers Meadowlands, Orlando, Diepkloof areas"},
        {"name": "Soweto South", "description": "Covers Dobsonville, Protea Glen, Lenasia areas"},
        {"name": "Alexandra Route", "description": "Alexandra township and surrounds"},
        {"name": "East Rand", "description": "Tembisa, Katlehong, Vosloorus areas"},
    ]
    
    for route in sample_routes:
        route["assigned_driver_id"] = None
        route["assigned_driver_name"] = None
    
    await db.routes.delete_many({})
    result = await db.routes.insert_many(sample_routes)
    return {"message": f"Seeded {len(result.inserted_ids)} routes"}

@api_router.get("/routes/{route_id}/customers", response_model=List[CustomerResponse])
async def get_route_customers(route_id: str):
    customers = await db.customers.find({"route_id": route_id}).to_list(500)
    return [str_id(c) for c in customers]

# ==================== SALES ENDPOINTS ====================

@api_router.post("/sales", response_model=SaleResponse)
async def create_sale(sale: SaleCreate, current_user: dict = Depends(get_current_user)):
    # Calculate total
    total = sum(
        (item.quantity_delivered - item.quantity_returned) * item.unit_price 
        for item in sale.items
    )
    
    sale_doc = {
        "route_id": sale.route_id,
        "customer_id": sale.customer_id,
        "customer_name": sale.customer_name,
        "driver_id": current_user["id"],
        "driver_name": current_user["name"],
        "items": [item.dict() for item in sale.items],
        "total_amount": total,
        "cash_collected": sale.cash_collected,
        "payment_type": sale.payment_type,
        "notes": sale.notes,
        "created_at": datetime.utcnow()
    }
    
    result = await db.sales.insert_one(sale_doc)
    sale_doc["_id"] = result.inserted_id
    
    # Update daily route totals
    today = datetime.utcnow().strftime("%Y-%m-%d")
    await db.daily_routes.update_one(
        {"driver_id": current_user["id"], "date": today, "status": "active"},
        {"$inc": {"sales_count": 1, "total_collected": sale.cash_collected}}
    )
    
    return str_id(sale_doc)

@api_router.get("/sales", response_model=List[SaleResponse])
async def get_sales(
    route_id: Optional[str] = None,
    date_str: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if current_user["role"] == "driver":
        query["driver_id"] = current_user["id"]
    if route_id:
        query["route_id"] = route_id
    if date_str:
        start = datetime.strptime(date_str, "%Y-%m-%d")
        end = datetime.strptime(date_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        query["created_at"] = {"$gte": start, "$lte": end}
    
    sales = await db.sales.find(query).sort("created_at", -1).to_list(500)
    return [str_id(s) for s in sales]

@api_router.get("/sales/customer/{customer_id}")
async def get_customer_sales(customer_id: str):
    """Get sales history for a specific customer"""
    sales = await db.sales.find({"customer_id": customer_id}).sort("created_at", -1).to_list(100)
    return [str_id(s) for s in sales]

# ==================== DAILY ROUTE ENDPOINTS ====================

@api_router.post("/daily-routes/start", response_model=DailyRouteResponse)
async def start_daily_route(data: DailyRouteStart, current_user: dict = Depends(get_current_user)):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Check if already started today
    existing = await db.daily_routes.find_one({
        "driver_id": current_user["id"],
        "date": today,
        "status": "active"
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active route today")
    
    # Get route name
    route = await db.routes.find_one({"_id": ObjectId(data.route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    daily_route = {
        "route_id": data.route_id,
        "route_name": route["name"],
        "driver_id": current_user["id"],
        "driver_name": current_user["name"],
        "date": today,
        "opening_km": data.opening_km,
        "closing_km": None,
        "km_traveled": None,
        "crates_out": data.crates_out,
        "crates_in": None,
        "damages_count": 0,
        "fuel_used": None,
        "vehicle_check": data.vehicle_check,
        "status": "active",
        "sales_count": 0,
        "total_collected": 0.0,
        "started_at": datetime.utcnow()
    }
    
    result = await db.daily_routes.insert_one(daily_route)
    daily_route["_id"] = result.inserted_id
    return str_id(daily_route)

@api_router.put("/daily-routes/{route_id}/end", response_model=DailyRouteResponse)
async def end_daily_route(route_id: str, data: DailyRouteEnd, current_user: dict = Depends(get_current_user)):
    daily_route = await db.daily_routes.find_one({"_id": ObjectId(route_id)})
    if not daily_route:
        raise HTTPException(status_code=404, detail="Daily route not found")
    
    if daily_route["driver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your route")
    
    km_traveled = data.closing_km - daily_route["opening_km"]
    
    update_data = {
        "closing_km": data.closing_km,
        "km_traveled": km_traveled,
        "crates_in": data.crates_in,
        "damages_count": data.damages_count,
        "fuel_used": data.fuel_used,
        "notes": data.notes,
        "status": "completed",
        "ended_at": datetime.utcnow()
    }
    
    await db.daily_routes.update_one({"_id": ObjectId(route_id)}, {"$set": update_data})
    
    daily_route.update(update_data)
    return str_id(daily_route)

@api_router.get("/daily-routes/active", response_model=Optional[DailyRouteResponse])
async def get_active_daily_route(current_user: dict = Depends(get_current_user)):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    daily_route = await db.daily_routes.find_one({
        "driver_id": current_user["id"],
        "date": today,
        "status": "active"
    })
    if daily_route:
        return str_id(daily_route)
    return None

@api_router.get("/daily-routes/history", response_model=List[DailyRouteResponse])
async def get_daily_route_history(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] == "driver":
        query["driver_id"] = current_user["id"]
    
    routes = await db.daily_routes.find(query).sort("date", -1).to_list(100)
    return [str_id(r) for r in routes]

# ==================== REPORTS ENDPOINTS ====================

@api_router.get("/reports/daily-summary")
async def get_daily_summary(date_str: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if not date_str:
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    query = {"date": date_str}
    if current_user["role"] == "driver":
        query["driver_id"] = current_user["id"]
    
    daily_routes = await db.daily_routes.find(query).to_list(100)
    
    # Get sales for the day
    start = datetime.strptime(date_str, "%Y-%m-%d")
    end = start.replace(hour=23, minute=59, second=59)
    
    sales_query = {"created_at": {"$gte": start, "$lte": end}}
    if current_user["role"] == "driver":
        sales_query["driver_id"] = current_user["id"]
    
    sales = await db.sales.find(sales_query).to_list(1000)
    
    # Aggregate product sales
    product_totals = {}
    for sale in sales:
        for item in sale.get("items", []):
            prod_name = item.get("product_name", "Unknown")
            if prod_name not in product_totals:
                product_totals[prod_name] = {"delivered": 0, "returned": 0, "damages": 0, "revenue": 0}
            product_totals[prod_name]["delivered"] += item.get("quantity_delivered", 0)
            product_totals[prod_name]["returned"] += item.get("quantity_returned", 0)
            product_totals[prod_name]["damages"] += item.get("damages", 0)
            product_totals[prod_name]["revenue"] += (item.get("quantity_delivered", 0) - item.get("quantity_returned", 0)) * item.get("unit_price", 0)
    
    total_collected = sum(s.get("cash_collected", 0) for s in sales)
    total_expected = sum(s.get("total_amount", 0) for s in sales)
    total_km = sum(dr.get("km_traveled", 0) or 0 for dr in daily_routes)
    
    return {
        "date": date_str,
        "routes_completed": len([dr for dr in daily_routes if dr.get("status") == "completed"]),
        "routes_active": len([dr for dr in daily_routes if dr.get("status") == "active"]),
        "total_sales": len(sales),
        "total_collected": total_collected,
        "total_expected": total_expected,
        "collection_rate": (total_collected / total_expected * 100) if total_expected > 0 else 0,
        "total_km_traveled": total_km,
        "product_breakdown": product_totals,
        "daily_routes": [str_id(dr) for dr in daily_routes]
    }

@api_router.get("/reports/route-performance/{route_id}")
async def get_route_performance(route_id: str, days: int = 7):
    """Get performance metrics for a route over the past N days"""
    from datetime import timedelta
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    daily_routes = await db.daily_routes.find({
        "route_id": route_id,
        "started_at": {"$gte": start_date, "$lte": end_date}
    }).to_list(100)
    
    return {
        "route_id": route_id,
        "period_days": days,
        "total_trips": len(daily_routes),
        "total_sales": sum(dr.get("sales_count", 0) for dr in daily_routes),
        "total_collected": sum(dr.get("total_collected", 0) for dr in daily_routes),
        "total_km": sum(dr.get("km_traveled", 0) or 0 for dr in daily_routes),
        "avg_sales_per_trip": sum(dr.get("sales_count", 0) for dr in daily_routes) / len(daily_routes) if daily_routes else 0,
        "daily_breakdown": [str_id(dr) for dr in daily_routes]
    }

# ==================== SEED ALL DATA ====================

@api_router.post("/seed-all")
async def seed_all_data():
    """Seed all sample data for testing"""
    # Seed routes first
    routes_result = await seed_routes()
    
    # Seed products
    products_result = await seed_products()
    
    # Seed customers
    customers_result = await seed_customers()
    
    # Create demo driver
    existing_driver = await db.users.find_one({"phone": "0812345678"})
    if not existing_driver:
        demo_driver = {
            "name": "Demo Driver",
            "phone": "0812345678",
            "pin_hash": hash_pin("1234"),
            "role": "driver",
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(demo_driver)
    
    return {
        "message": "All data seeded successfully",
        "demo_login": {"phone": "0812345678", "pin": "1234"}
    }

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
