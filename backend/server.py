from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, date, timedelta
import hashlib
import jwt
from bson import ObjectId
import xlsxwriter

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable must be set")
JWT_ALGORITHM = "HS256"

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db_name = os.environ.get('DB_NAME')
if not db_name:
    raise RuntimeError("DB_NAME environment variable must be set")
db = client[db_name]

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

# ==================== ROLE PERMISSIONS ====================
# admin: Full access to everything
# manager: Products, customers, routes, sales corrections (no user management)
# driver: Own routes, record sales, add customers, edit same-day entries
# conductor: View only, assist with delivery confirmation

ROLE_HIERARCHY = {
    'admin': 4,
    'manager': 3,
    'driver': 2,
    'conductor': 1
}

def check_role(user: dict, required_roles: List[str]) -> bool:
    """Check if user has one of the required roles"""
    return user.get('role') in required_roles

def is_admin_or_manager(user: dict) -> bool:
    return user.get('role') in ['admin', 'manager']

def is_admin(user: dict) -> bool:
    return user.get('role') == 'admin'

# ==================== MODELS ====================

class UserCreate(BaseModel):
    name: str
    phone: str
    pin: str  # 4-digit PIN
    role: str = "driver"  # admin, manager, driver, conductor

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    id: str
    name: str
    phone: str
    role: str
    is_active: bool = True
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
    credit_limit: Optional[float] = None
    route_id: Optional[str] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    location: Optional[str] = None
    payment_terms: Optional[str] = None
    credit_limit: Optional[float] = None
    route_id: Optional[str] = None
    is_active: Optional[bool] = None

class CustomerResponse(BaseModel):
    id: str
    name: str
    contact: Optional[str]
    location: Optional[str]
    payment_terms: str
    credit_limit: Optional[float] = None
    route_id: Optional[str]
    is_active: bool = True
    balance: float = 0.0

class VehicleCreate(BaseModel):
    registration: str  # License plate
    name: str  # e.g., "Truck 1", "Van A"
    vehicle_type: str = "truck"  # truck, van, bakkie
    capacity_crates: int = 100

class VehicleUpdate(BaseModel):
    registration: Optional[str] = None
    name: Optional[str] = None
    vehicle_type: Optional[str] = None
    capacity_crates: Optional[int] = None
    is_active: Optional[bool] = None

class VehicleResponse(BaseModel):
    id: str
    registration: str
    name: str
    vehicle_type: str
    capacity_crates: int
    is_active: bool = True

class RouteCreate(BaseModel):
    name: str
    description: Optional[str] = None

class RouteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    assigned_driver_id: Optional[str] = None

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
    crates_dropped: int = 0  # Crates left with customer
    crates_collected: int = 0  # Crates collected back (empties)
    cash_collected: float
    payment_type: str = "cash"  # cash, card, mobile
    notes: Optional[str] = None
    delivery_status: str = "delivered"  # delivered, partial, skipped

class SaleUpdate(BaseModel):
    items: Optional[List[SaleItemCreate]] = None
    cash_collected: Optional[float] = None
    payment_type: Optional[str] = None
    notes: Optional[str] = None
    delivery_status: Optional[str] = None
    void_reason: Optional[str] = None

class SaleResponse(BaseModel):
    id: str
    route_id: str
    customer_id: str
    customer_name: str
    driver_id: str
    driver_name: str
    items: List[dict]
    total_amount: float
    crates_dropped: int = 0
    crates_collected: int = 0
    cash_collected: float
    payment_type: str
    delivery_status: str = "delivered"
    notes: Optional[str]
    is_voided: bool = False
    void_reason: Optional[str] = None
    created_at: datetime

class DailyRouteStart(BaseModel):
    route_id: str
    vehicle_id: str  # Required - which vehicle is being used
    opening_km: float
    crates_out: int
    vehicle_check: Optional[Dict[str, Any]] = None

class DailyRouteUpdate(BaseModel):
    opening_km: Optional[float] = None
    closing_km: Optional[float] = None
    crates_out: Optional[int] = None
    crates_in: Optional[int] = None
    damages_count: Optional[int] = None
    fuel_used: Optional[float] = None
    notes: Optional[str] = None

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
    vehicle_id: Optional[str] = None
    vehicle_name: Optional[str] = None
    vehicle_registration: Optional[str] = None
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
        if not user.get("is_active", True):
            raise HTTPException(status_code=401, detail="User account is deactivated")
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
        "is_active": True,
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
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
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

# ==================== USER MANAGEMENT (Admin Only) ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Exclude sensitive fields from user list
    users = await db.users.find({}, {'pin_hash': 0}).to_list(500)
    return [str_id(u) for u in users]

@api_router.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate, current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.users.find_one({"phone": user.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    user_doc = {
        "name": user.name,
        "phone": user.phone,
        "pin_hash": hash_pin(user.pin),
        "role": user.role,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return str_id(user_doc)

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, update: UserUpdate, current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    
    updated = await db.users.find_one({"_id": ObjectId(user_id)})
    return str_id(updated)

@api_router.put("/users/{user_id}/reset-pin")
async def reset_user_pin(user_id: str, new_pin: str, current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)}, 
        {"$set": {"pin_hash": hash_pin(new_pin)}}
    )
    return {"message": "PIN reset successfully"}

@api_router.delete("/users/{user_id}")
async def deactivate_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_active": False}})
    return {"message": "User deactivated successfully"}

# ==================== PRODUCT ENDPOINTS ====================

@api_router.get("/products", response_model=List[ProductResponse])
async def get_products():
    products = await db.products.find().to_list(100)
    return [str_id(p) for p in products]

@api_router.post("/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, current_user: dict = Depends(get_current_user)):
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    product_doc = product.dict()
    result = await db.products.insert_one(product_doc)
    product_doc["_id"] = result.inserted_id
    return str_id(product_doc)

@api_router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, product: ProductCreate, current_user: dict = Depends(get_current_user)):
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    existing = await db.products.find_one({"_id": ObjectId(product_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product.dict()
    await db.products.update_one({"_id": ObjectId(product_id)}, {"$set": update_data})
    
    updated = await db.products.find_one({"_id": ObjectId(product_id)})
    return str_id(updated)

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: dict = Depends(get_current_user)):
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    existing = await db.products.find_one({"_id": ObjectId(product_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await db.products.delete_one({"_id": ObjectId(product_id)})
    return {"message": "Product deleted successfully"}

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
    
    await db.products.delete_many({})
    result = await db.products.insert_many(default_products)
    return {"message": f"Seeded {len(result.inserted_ids)} products"}

# ==================== VEHICLE ENDPOINTS ====================

@api_router.get("/vehicles", response_model=List[VehicleResponse])
async def get_vehicles(include_inactive: bool = False):
    query = {} if include_inactive else {"is_active": {"$ne": False}}
    vehicles = await db.vehicles.find(query).to_list(100)
    return [str_id(v) for v in vehicles]

@api_router.get("/vehicles/available")
async def get_available_vehicles():
    """Get vehicles not currently in use on an active route"""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Get all vehicles
    all_vehicles = await db.vehicles.find({"is_active": {"$ne": False}}).to_list(100)
    
    # Get vehicles currently in use
    active_routes = await db.daily_routes.find({
        "date": today,
        "status": "active"
    }).to_list(100)
    
    in_use_vehicle_ids = {r.get("vehicle_id") for r in active_routes if r.get("vehicle_id")}
    
    available = []
    for v in all_vehicles:
        v = str_id(v)
        v["in_use"] = v["id"] in in_use_vehicle_ids
        available.append(v)
    
    return available

@api_router.post("/vehicles", response_model=VehicleResponse)
async def create_vehicle(vehicle: VehicleCreate, current_user: dict = Depends(get_current_user)):
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    # Check if registration already exists
    existing = await db.vehicles.find_one({"registration": vehicle.registration})
    if existing:
        raise HTTPException(status_code=400, detail="Vehicle with this registration already exists")
    
    vehicle_doc = vehicle.dict()
    vehicle_doc["is_active"] = True
    vehicle_doc["created_at"] = datetime.utcnow()
    
    result = await db.vehicles.insert_one(vehicle_doc)
    vehicle_doc["_id"] = result.inserted_id
    return str_id(vehicle_doc)

@api_router.put("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(vehicle_id: str, update: VehicleUpdate, current_user: dict = Depends(get_current_user)):
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    vehicle = await db.vehicles.find_one({"_id": ObjectId(vehicle_id)})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        await db.vehicles.update_one({"_id": ObjectId(vehicle_id)}, {"$set": update_data})
    
    updated = await db.vehicles.find_one({"_id": ObjectId(vehicle_id)})
    return str_id(updated)

@api_router.delete("/vehicles/{vehicle_id}")
async def deactivate_vehicle(vehicle_id: str, current_user: dict = Depends(get_current_user)):
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    vehicle = await db.vehicles.find_one({"_id": ObjectId(vehicle_id)})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    await db.vehicles.update_one({"_id": ObjectId(vehicle_id)}, {"$set": {"is_active": False}})
    return {"message": "Vehicle deactivated successfully"}

@api_router.post("/vehicles/seed")
async def seed_vehicles():
    """Seed sample vehicles"""
    sample_vehicles = [
        {"registration": "CA 123-456", "name": "Truck 1", "vehicle_type": "truck", "capacity_crates": 150},
        {"registration": "CA 234-567", "name": "Truck 2", "vehicle_type": "truck", "capacity_crates": 150},
        {"registration": "CA 345-678", "name": "Van A", "vehicle_type": "van", "capacity_crates": 80},
        {"registration": "CA 456-789", "name": "Bakkie 1", "vehicle_type": "bakkie", "capacity_crates": 50},
    ]
    
    for v in sample_vehicles:
        v["is_active"] = True
        v["created_at"] = datetime.utcnow()
    
    await db.vehicles.delete_many({})
    result = await db.vehicles.insert_many(sample_vehicles)
    return {"message": f"Seeded {len(result.inserted_ids)} vehicles"}

# ==================== CUSTOMER ENDPOINTS ====================

@api_router.get("/customers", response_model=List[CustomerResponse])
async def get_customers(route_id: Optional[str] = None, include_inactive: bool = False):
    query = {}
    if route_id:
        query["route_id"] = route_id
    if not include_inactive:
        query["is_active"] = {"$ne": False}
    customers = await db.customers.find(query).to_list(500)
    return [str_id(c) for c in customers]

@api_router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str):
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return str_id(customer)

@api_router.post("/customers", response_model=CustomerResponse)
async def create_customer(customer: CustomerCreate, current_user: dict = Depends(get_current_user)):
    # Drivers can add customers on the fly
    customer_doc = customer.dict()
    customer_doc["is_active"] = True
    customer_doc["balance"] = 0.0
    customer_doc["created_by"] = current_user["id"]
    customer_doc["created_at"] = datetime.utcnow()
    
    result = await db.customers.insert_one(customer_doc)
    customer_doc["_id"] = result.inserted_id
    return str_id(customer_doc)

@api_router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: str, update: CustomerUpdate, current_user: dict = Depends(get_current_user)):
    # Only admin/manager can update customer details (except drivers can't change payment terms or credit limit)
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    # Drivers can only update basic info, not payment terms or credit
    if not is_admin_or_manager(current_user):
        restricted_fields = ['payment_terms', 'credit_limit', 'is_active', 'route_id']
        for field in restricted_fields:
            if field in update_data:
                raise HTTPException(status_code=403, detail=f"Cannot update {field} - Admin/Manager access required")
    
    if update_data:
        update_data["updated_by"] = current_user["id"]
        update_data["updated_at"] = datetime.utcnow()
        await db.customers.update_one({"_id": ObjectId(customer_id)}, {"$set": update_data})
    
    updated = await db.customers.find_one({"_id": ObjectId(customer_id)})
    return str_id(updated)

@api_router.delete("/customers/{customer_id}")
async def deactivate_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    await db.customers.update_one({"_id": ObjectId(customer_id)}, {"$set": {"is_active": False}})
    return {"message": "Customer deactivated successfully"}

@api_router.get("/customers/{customer_id}/history")
async def get_customer_history(customer_id: str, days: int = 30):
    """Get customer purchase history"""
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    start_date = datetime.utcnow() - timedelta(days=days)
    sales = await db.sales.find({
        "customer_id": customer_id,
        "created_at": {"$gte": start_date},
        "is_voided": {"$ne": True}
    }).sort("created_at", -1).to_list(100)
    
    total_purchases = sum(s.get("total_amount", 0) for s in sales)
    total_paid = sum(s.get("cash_collected", 0) for s in sales)
    
    return {
        "customer": str_id(customer),
        "period_days": days,
        "total_purchases": total_purchases,
        "total_paid": total_paid,
        "balance": total_purchases - total_paid,
        "transaction_count": len(sales),
        "transactions": [str_id(s) for s in sales]
    }

@api_router.post("/customers/seed")
async def seed_customers():
    """Seed sample customers"""
    routes = await db.routes.find().to_list(10)
    if not routes:
        return {"message": "Please seed routes first"}
    
    sample_customers = [
        {"name": "Shoprite Soweto", "contact": "011-555-0101", "location": "Soweto Mall", "payment_terms": "credit", "credit_limit": 5000},
        {"name": "Pick n Pay Diepkloof", "contact": "011-555-0102", "location": "Diepkloof Square", "payment_terms": "credit", "credit_limit": 10000},
        {"name": "Spaza Shop - Mama Joy", "contact": "078-555-0103", "location": "Orlando West", "payment_terms": "cash"},
        {"name": "Corner Cafe Meadowlands", "contact": "079-555-0104", "location": "Meadowlands Zone 1", "payment_terms": "cash"},
        {"name": "Spar Alexandra", "contact": "011-555-0105", "location": "Alex Mall", "payment_terms": "credit", "credit_limit": 8000},
        {"name": "Tuckshop - Mr Dlamini", "contact": "082-555-0106", "location": "Tembisa", "payment_terms": "cash"},
        {"name": "OK Foods Randburg", "contact": "011-555-0107", "location": "Randburg CBD", "payment_terms": "credit", "credit_limit": 15000},
        {"name": "Kasi Superette", "contact": "083-555-0108", "location": "Katlehong", "payment_terms": "mixed", "credit_limit": 3000},
    ]
    
    for i, customer in enumerate(sample_customers):
        customer["route_id"] = str(routes[i % len(routes)]["_id"])
        customer["is_active"] = True
        customer["balance"] = 0.0
        customer["created_at"] = datetime.utcnow()
    
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
        customer_count = await db.customers.count_documents({"route_id": route["id"], "is_active": {"$ne": False}})
        route["customer_count"] = customer_count
        result.append(route)
    return result

@api_router.post("/routes", response_model=RouteResponse)
async def create_route(route: RouteCreate, current_user: dict = Depends(get_current_user)):
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    route_doc = route.dict()
    route_doc["assigned_driver_id"] = None
    route_doc["assigned_driver_name"] = None
    route_doc["created_at"] = datetime.utcnow()
    
    result = await db.routes.insert_one(route_doc)
    route_doc["_id"] = result.inserted_id
    route_doc["customer_count"] = 0
    return str_id(route_doc)

@api_router.put("/routes/{route_id}", response_model=RouteResponse)
async def update_route(route_id: str, update: RouteUpdate, current_user: dict = Depends(get_current_user)):
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    route = await db.routes.find_one({"_id": ObjectId(route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    # If assigning a driver, get their name
    if "assigned_driver_id" in update_data and update_data["assigned_driver_id"]:
        driver = await db.users.find_one({"_id": ObjectId(update_data["assigned_driver_id"])})
        if driver:
            update_data["assigned_driver_name"] = driver["name"]
    
    if update_data:
        await db.routes.update_one({"_id": ObjectId(route_id)}, {"$set": update_data})
    
    updated = await db.routes.find_one({"_id": ObjectId(route_id)})
    updated = str_id(updated)
    updated["customer_count"] = await db.customers.count_documents({"route_id": route_id, "is_active": {"$ne": False}})
    return updated

@api_router.delete("/routes/{route_id}")
async def delete_route(route_id: str, current_user: dict = Depends(get_current_user)):
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    route = await db.routes.find_one({"_id": ObjectId(route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Check if route has customers
    customer_count = await db.customers.count_documents({"route_id": route_id})
    if customer_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete route with {customer_count} customers. Reassign customers first.")
    
    await db.routes.delete_one({"_id": ObjectId(route_id)})
    return {"message": "Route deleted successfully"}

@api_router.get("/routes/{route_id}/customers", response_model=List[CustomerResponse])
async def get_route_customers(route_id: str):
    customers = await db.customers.find({"route_id": route_id, "is_active": {"$ne": False}}).to_list(500)
    return [str_id(c) for c in customers]

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
        route["created_at"] = datetime.utcnow()
    
    await db.routes.delete_many({})
    result = await db.routes.insert_many(sample_routes)
    return {"message": f"Seeded {len(result.inserted_ids)} routes"}

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
        "crates_dropped": sale.crates_dropped,
        "crates_collected": sale.crates_collected,
        "cash_collected": sale.cash_collected,
        "payment_type": sale.payment_type,
        "delivery_status": sale.delivery_status,
        "notes": sale.notes,
        "is_voided": False,
        "created_at": datetime.utcnow()
    }
    
    result = await db.sales.insert_one(sale_doc)
    sale_doc["_id"] = result.inserted_id
    
    # Update daily route totals including crates
    today = datetime.utcnow().strftime("%Y-%m-%d")
    await db.daily_routes.update_one(
        {"driver_id": current_user["id"], "date": today, "status": "active"},
        {"$inc": {
            "sales_count": 1, 
            "total_collected": sale.cash_collected,
            "total_crates_dropped": sale.crates_dropped,
            "total_crates_collected": sale.crates_collected
        }}
    )
    
    # Update customer balance if credit
    if sale.payment_type in ["credit", "mixed"]:
        balance_change = total - sale.cash_collected
        if balance_change > 0:
            await db.customers.update_one(
                {"_id": ObjectId(sale.customer_id)},
                {"$inc": {"balance": balance_change}}
            )
    
    return str_id(sale_doc)

@api_router.get("/sales", response_model=List[SaleResponse])
async def get_sales(
    route_id: Optional[str] = None,
    date_str: Optional[str] = None,
    customer_id: Optional[str] = None,
    include_voided: bool = False,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if current_user["role"] == "driver":
        query["driver_id"] = current_user["id"]
    if route_id:
        query["route_id"] = route_id
    if customer_id:
        query["customer_id"] = customer_id
    if date_str:
        start = datetime.strptime(date_str, "%Y-%m-%d")
        end = datetime.strptime(date_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        query["created_at"] = {"$gte": start, "$lte": end}
    if not include_voided:
        query["is_voided"] = {"$ne": True}
    
    sales = await db.sales.find(query).sort("created_at", -1).to_list(500)
    return [str_id(s) for s in sales]

@api_router.get("/sales/{sale_id}", response_model=SaleResponse)
async def get_sale(sale_id: str, current_user: dict = Depends(get_current_user)):
    sale = await db.sales.find_one({"_id": ObjectId(sale_id)})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # Drivers can only view their own sales
    if current_user["role"] == "driver" and sale["driver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return str_id(sale)

@api_router.put("/sales/{sale_id}", response_model=SaleResponse)
async def update_sale(sale_id: str, update: SaleUpdate, current_user: dict = Depends(get_current_user)):
    sale = await db.sales.find_one({"_id": ObjectId(sale_id)})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # Check permissions
    is_same_day = sale["created_at"].date() == datetime.utcnow().date()
    is_own_sale = sale["driver_id"] == current_user["id"]
    
    # Drivers can only edit their own same-day sales
    if current_user["role"] == "driver":
        if not is_own_sale:
            raise HTTPException(status_code=403, detail="Cannot edit other driver's sales")
        if not is_same_day:
            raise HTTPException(status_code=403, detail="Cannot edit past sales - contact manager")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    # Recalculate total if items changed
    if "items" in update_data:
        total = sum(
            (item["quantity_delivered"] - item.get("quantity_returned", 0)) * item["unit_price"]
            for item in update_data["items"]
        )
        update_data["total_amount"] = total
    
    update_data["updated_by"] = current_user["id"]
    update_data["updated_at"] = datetime.utcnow()
    
    await db.sales.update_one({"_id": ObjectId(sale_id)}, {"$set": update_data})
    
    updated = await db.sales.find_one({"_id": ObjectId(sale_id)})
    return str_id(updated)

@api_router.post("/sales/{sale_id}/void")
async def void_sale(sale_id: str, reason: str, current_user: dict = Depends(get_current_user)):
    sale = await db.sales.find_one({"_id": ObjectId(sale_id)})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    if sale.get("is_voided"):
        raise HTTPException(status_code=400, detail="Sale is already voided")
    
    # Check permissions
    is_same_day = sale["created_at"].date() == datetime.utcnow().date()
    is_own_sale = sale["driver_id"] == current_user["id"]
    
    # Drivers can only void their own same-day sales
    if current_user["role"] == "driver":
        if not is_own_sale:
            raise HTTPException(status_code=403, detail="Cannot void other driver's sales")
        if not is_same_day:
            raise HTTPException(status_code=403, detail="Cannot void past sales - contact manager")
    
    await db.sales.update_one(
        {"_id": ObjectId(sale_id)},
        {"$set": {
            "is_voided": True,
            "void_reason": reason,
            "voided_by": current_user["id"],
            "voided_at": datetime.utcnow()
        }}
    )
    
    # Reverse customer balance if was credit
    if sale.get("payment_type") in ["credit", "mixed"]:
        balance_change = sale["total_amount"] - sale["cash_collected"]
        if balance_change > 0:
            await db.customers.update_one(
                {"_id": ObjectId(sale["customer_id"])},
                {"$inc": {"balance": -balance_change}}
            )
    
    return {"message": "Sale voided successfully"}

@api_router.get("/sales/customer/{customer_id}")
async def get_customer_sales(customer_id: str):
    """Get sales history for a specific customer"""
    sales = await db.sales.find({
        "customer_id": customer_id,
        "is_voided": {"$ne": True}
    }).sort("created_at", -1).to_list(100)
    return [str_id(s) for s in sales]

# ==================== DAILY ROUTE ENDPOINTS ====================

@api_router.post("/daily-routes/start", response_model=DailyRouteResponse)
async def start_daily_route(data: DailyRouteStart, current_user: dict = Depends(get_current_user)):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Check if THIS SPECIFIC ROUTE is already active today for this driver
    existing = await db.daily_routes.find_one({
        "driver_id": current_user["id"],
        "route_id": data.route_id,
        "date": today,
        "status": "active"
    })
    if existing:
        raise HTTPException(status_code=400, detail="This route is already active today")
    
    # Check if this vehicle is already in use
    vehicle_in_use = await db.daily_routes.find_one({
        "vehicle_id": data.vehicle_id,
        "date": today,
        "status": "active"
    })
    if vehicle_in_use:
        raise HTTPException(status_code=400, detail="This vehicle is already in use on another route")
    
    # Get route name
    route = await db.routes.find_one({"_id": ObjectId(data.route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Get vehicle info
    vehicle = await db.vehicles.find_one({"_id": ObjectId(data.vehicle_id)})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    daily_route = {
        "route_id": data.route_id,
        "route_name": route["name"],
        "vehicle_id": data.vehicle_id,
        "vehicle_name": vehicle["name"],
        "vehicle_registration": vehicle["registration"],
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

@api_router.put("/daily-routes/{route_id}", response_model=DailyRouteResponse)
async def update_daily_route(route_id: str, update: DailyRouteUpdate, current_user: dict = Depends(get_current_user)):
    """Update daily route - Admin/Manager can update any, Driver can update own same-day"""
    daily_route = await db.daily_routes.find_one({"_id": ObjectId(route_id)})
    if not daily_route:
        raise HTTPException(status_code=404, detail="Daily route not found")
    
    # Check permissions
    is_own_route = daily_route["driver_id"] == current_user["id"]
    today = datetime.utcnow().strftime("%Y-%m-%d")
    is_same_day = daily_route["date"] == today
    
    if not is_admin_or_manager(current_user):
        if not is_own_route:
            raise HTTPException(status_code=403, detail="Cannot update other driver's route")
        if not is_same_day:
            raise HTTPException(status_code=403, detail="Cannot update past routes - contact manager")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    # Recalculate km traveled if both values present
    if "closing_km" in update_data or "opening_km" in update_data:
        opening = update_data.get("opening_km", daily_route["opening_km"])
        closing = update_data.get("closing_km", daily_route.get("closing_km"))
        if closing and opening:
            update_data["km_traveled"] = closing - opening
    
    update_data["updated_by"] = current_user["id"]
    update_data["updated_at"] = datetime.utcnow()
    
    await db.daily_routes.update_one({"_id": ObjectId(route_id)}, {"$set": update_data})
    
    updated = await db.daily_routes.find_one({"_id": ObjectId(route_id)})
    return str_id(updated)

@api_router.put("/daily-routes/{route_id}/end", response_model=DailyRouteResponse)
async def end_daily_route(route_id: str, data: DailyRouteEnd, current_user: dict = Depends(get_current_user)):
    daily_route = await db.daily_routes.find_one({"_id": ObjectId(route_id)})
    if not daily_route:
        raise HTTPException(status_code=404, detail="Daily route not found")
    
    if daily_route["driver_id"] != current_user["id"] and not is_admin_or_manager(current_user):
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

@api_router.get("/daily-routes/active", response_model=List[DailyRouteResponse])
async def get_active_daily_routes(current_user: dict = Depends(get_current_user)):
    """Get all active routes for the current driver (supports multiple concurrent routes)"""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    query = {
        "date": today,
        "status": "active"
    }
    
    # Drivers see only their own routes, admin/manager see all
    if current_user["role"] not in ["admin", "manager"]:
        query["driver_id"] = current_user["id"]
    
    daily_routes = await db.daily_routes.find(query).to_list(50)
    return [str_id(dr) for dr in daily_routes]

@api_router.get("/daily-routes/active/all", response_model=List[DailyRouteResponse])
async def get_all_active_routes(current_user: dict = Depends(get_current_user)):
    """Get all active routes across all drivers (Admin/Manager view)"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    daily_routes = await db.daily_routes.find({
        "date": today,
        "status": "active"
    }).to_list(100)
    return [str_id(dr) for dr in daily_routes]

@api_router.get("/daily-routes/history", response_model=List[DailyRouteResponse])
async def get_daily_route_history(
    driver_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    # Drivers can only see their own history, admin/manager can see all or filter
    if current_user["role"] == "driver":
        query["driver_id"] = current_user["id"]
    elif driver_id:
        query["driver_id"] = driver_id
    
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
    
    sales_query = {"created_at": {"$gte": start, "$lte": end}, "is_voided": {"$ne": True}}
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
    
    # Delivery status breakdown
    delivery_status = {
        "delivered": len([s for s in sales if s.get("delivery_status") == "delivered"]),
        "partial": len([s for s in sales if s.get("delivery_status") == "partial"]),
        "skipped": len([s for s in sales if s.get("delivery_status") == "skipped"]),
    }
    
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
        "delivery_status": delivery_status,
        "daily_routes": [str_id(dr) for dr in daily_routes]
    }

@api_router.get("/reports/route-performance/{route_id}")
async def get_route_performance(route_id: str, days: int = 7):
    """Get performance metrics for a route over the past N days"""
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

@api_router.get("/reports/export/excel")
async def export_route_report_excel(
    date_str: Optional[str] = None,
    route_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export route report to Excel format"""
    if not date_str:
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Get daily routes
    query = {"date": date_str}
    if route_id:
        query["route_id"] = route_id
    if current_user["role"] == "driver":
        query["driver_id"] = current_user["id"]
    
    daily_routes = await db.daily_routes.find(query).to_list(100)
    
    # Get sales for the day
    start = datetime.strptime(date_str, "%Y-%m-%d")
    end = start.replace(hour=23, minute=59, second=59)
    
    sales_query = {"created_at": {"$gte": start, "$lte": end}, "is_voided": {"$ne": True}}
    if route_id:
        sales_query["route_id"] = route_id
    if current_user["role"] == "driver":
        sales_query["driver_id"] = current_user["id"]
    
    sales = await db.sales.find(sales_query).to_list(1000)
    
    # Create Excel file in memory
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    
    # Styles
    header_format = workbook.add_format({
        'bold': True, 'bg_color': '#3B82F6', 'font_color': 'white',
        'border': 1, 'align': 'center', 'valign': 'vcenter'
    })
    money_format = workbook.add_format({'num_format': 'R #,##0.00', 'border': 1})
    number_format = workbook.add_format({'num_format': '#,##0', 'border': 1})
    cell_format = workbook.add_format({'border': 1, 'valign': 'vcenter'})
    title_format = workbook.add_format({
        'bold': True, 'font_size': 14, 'align': 'center'
    })
    
    # Summary Sheet
    summary_sheet = workbook.add_worksheet('Summary')
    summary_sheet.set_column('A:B', 25)
    summary_sheet.merge_range('A1:B1', f'Route Report - {date_str}', title_format)
    
    total_collected = sum(s.get("cash_collected", 0) for s in sales)
    total_expected = sum(s.get("total_amount", 0) for s in sales)
    total_crates_dropped = sum(s.get("crates_dropped", 0) for s in sales)
    total_crates_collected = sum(s.get("crates_collected", 0) for s in sales)
    total_km = sum(dr.get("km_traveled", 0) or 0 for dr in daily_routes)
    
    summary_data = [
        ['Date', date_str],
        ['Total Routes', len(daily_routes)],
        ['Total Sales', len(sales)],
        ['Total Collected', total_collected],
        ['Total Expected', total_expected],
        ['Collection Rate', f"{(total_collected / total_expected * 100) if total_expected > 0 else 0:.1f}%"],
        ['Total KM Traveled', total_km],
        ['Crates Dropped', total_crates_dropped],
        ['Crates Collected', total_crates_collected],
        ['Net Crates Out', total_crates_dropped - total_crates_collected],
    ]
    
    for row_num, (label, value) in enumerate(summary_data, start=2):
        summary_sheet.write(row_num, 0, label, cell_format)
        if isinstance(value, float) and 'Rate' not in label:
            summary_sheet.write(row_num, 1, value, money_format)
        else:
            summary_sheet.write(row_num, 1, value, cell_format)
    
    # Sales Detail Sheet
    sales_sheet = workbook.add_worksheet('Sales Details')
    sales_headers = ['Time', 'Customer', 'Driver', 'Route', 'Products', 'Total', 'Cash Collected', 
                     'Crates Dropped', 'Crates Collected', 'Payment Type', 'Status']
    
    for col, header in enumerate(sales_headers):
        sales_sheet.write(0, col, header, header_format)
    
    sales_sheet.set_column('A:A', 12)  # Time
    sales_sheet.set_column('B:B', 25)  # Customer
    sales_sheet.set_column('C:C', 18)  # Driver
    sales_sheet.set_column('D:D', 18)  # Route
    sales_sheet.set_column('E:E', 30)  # Products
    sales_sheet.set_column('F:G', 15)  # Money columns
    sales_sheet.set_column('H:I', 15)  # Crates columns
    sales_sheet.set_column('J:K', 12)  # Type, Status
    
    for row_num, sale in enumerate(sales, start=1):
        time_str = sale.get("created_at", datetime.utcnow()).strftime("%H:%M")
        products = ", ".join([f"{i.get('product_name', '')} x{i.get('quantity_delivered', 0)}" for i in sale.get("items", [])])
        route_name = sale.get("route_name", "N/A")
        
        # Try to get route name from daily route
        for dr in daily_routes:
            if dr.get("route_id") == sale.get("route_id"):
                route_name = dr.get("route_name", route_name)
                break
        
        sales_sheet.write(row_num, 0, time_str, cell_format)
        sales_sheet.write(row_num, 1, sale.get("customer_name", ""), cell_format)
        sales_sheet.write(row_num, 2, sale.get("driver_name", ""), cell_format)
        sales_sheet.write(row_num, 3, route_name, cell_format)
        sales_sheet.write(row_num, 4, products, cell_format)
        sales_sheet.write(row_num, 5, sale.get("total_amount", 0), money_format)
        sales_sheet.write(row_num, 6, sale.get("cash_collected", 0), money_format)
        sales_sheet.write(row_num, 7, sale.get("crates_dropped", 0), number_format)
        sales_sheet.write(row_num, 8, sale.get("crates_collected", 0), number_format)
        sales_sheet.write(row_num, 9, sale.get("payment_type", ""), cell_format)
        sales_sheet.write(row_num, 10, sale.get("delivery_status", ""), cell_format)
    
    # Route Details Sheet
    routes_sheet = workbook.add_worksheet('Route Details')
    route_headers = ['Route Name', 'Driver', 'Vehicle', 'Opening KM', 'Closing KM', 'KM Traveled', 
                     'Crates Out', 'Crates In', 'Sales', 'Collected', 'Status']
    
    for col, header in enumerate(route_headers):
        routes_sheet.write(0, col, header, header_format)
    
    routes_sheet.set_column('A:C', 18)
    routes_sheet.set_column('D:H', 12)
    routes_sheet.set_column('I:J', 12)
    routes_sheet.set_column('K:K', 10)
    
    for row_num, dr in enumerate(daily_routes, start=1):
        routes_sheet.write(row_num, 0, dr.get("route_name", ""), cell_format)
        routes_sheet.write(row_num, 1, dr.get("driver_name", ""), cell_format)
        routes_sheet.write(row_num, 2, f"{dr.get('vehicle_name', '')} ({dr.get('vehicle_registration', '')})", cell_format)
        routes_sheet.write(row_num, 3, dr.get("opening_km", 0), number_format)
        routes_sheet.write(row_num, 4, dr.get("closing_km", 0) or 0, number_format)
        routes_sheet.write(row_num, 5, dr.get("km_traveled", 0) or 0, number_format)
        routes_sheet.write(row_num, 6, dr.get("crates_out", 0), number_format)
        routes_sheet.write(row_num, 7, dr.get("crates_in", 0) or 0, number_format)
        routes_sheet.write(row_num, 8, dr.get("sales_count", 0), number_format)
        routes_sheet.write(row_num, 9, dr.get("total_collected", 0), money_format)
        routes_sheet.write(row_num, 10, dr.get("status", ""), cell_format)
    
    workbook.close()
    output.seek(0)
    
    filename = f"route_report_{date_str}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ==================== PERMISSIONS CHECK ENDPOINT ====================

@api_router.get("/permissions")
async def get_permissions(current_user: dict = Depends(get_current_user)):
    """Get current user's permissions"""
    role = current_user.get("role", "driver")
    
    permissions = {
        "role": role,
        "can_manage_users": role == "admin",
        "can_manage_products": role in ["admin", "manager"],
        "can_manage_routes": role in ["admin", "manager"],
        "can_manage_customers": role in ["admin", "manager"],
        "can_edit_all_sales": role in ["admin", "manager"],
        "can_void_any_sale": role in ["admin", "manager"],
        "can_edit_own_same_day_sales": True,
        "can_add_customers": True,
        "can_record_sales": role in ["admin", "manager", "driver"],
        "can_view_all_reports": role in ["admin", "manager"],
    }
    
    return permissions

# ==================== SEED ALL DATA ====================

@api_router.post("/seed-all")
async def seed_all_data():
    """Seed all sample data for testing"""
    # Seed routes first
    await seed_routes()
    
    # Seed products
    await seed_products()
    
    # Seed vehicles
    await seed_vehicles()
    
    # Seed customers
    await seed_customers()
    
    # Create demo users
    demo_users = [
        {"name": "Admin User", "phone": "0800000001", "pin": "0000", "role": "admin"},
        {"name": "Manager User", "phone": "0800000002", "pin": "1111", "role": "manager"},
        {"name": "Demo Driver", "phone": "0812345678", "pin": "1234", "role": "driver"},
        {"name": "Second Driver", "phone": "0812345679", "pin": "5678", "role": "driver"},
        {"name": "Conductor", "phone": "0812345680", "pin": "9999", "role": "conductor"},
    ]
    
    for user in demo_users:
        existing = await db.users.find_one({"phone": user["phone"]})
        if not existing:
            user_doc = {
                "name": user["name"],
                "phone": user["phone"],
                "pin_hash": hash_pin(user["pin"]),
                "role": user["role"],
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            await db.users.insert_one(user_doc)
    
    return {
        "message": "All data seeded successfully",
        "demo_logins": {
            "admin": {"phone": "0800000001", "pin": "0000"},
            "manager": {"phone": "0800000002", "pin": "1111"},
            "driver": {"phone": "0812345678", "pin": "1234"},
        }
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
