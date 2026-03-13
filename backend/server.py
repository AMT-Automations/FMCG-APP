from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import csv
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, date, timedelta
import hashlib
import jwt
from bson import ObjectId
import xlsxwriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

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
app = FastAPI(title="Mzansi FMCG Tracker API")

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
    'conductor': 1,
    'customer': 0
}

def check_role(user: dict, required_roles: List[str]) -> bool:
    """Check if user has one of the required roles"""
    return user.get('role') in required_roles

def is_admin_or_manager(user: dict) -> bool:
    return user.get('role') in ['admin', 'manager']

def is_admin(user: dict) -> bool:
    return user.get('role') == 'admin'

def is_customer(user: dict) -> bool:
    return user.get('role') == 'customer'

# ==================== MODELS ====================

class CompanyCreate(BaseModel):
    name: str
    contact_person: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None

class CompanySetup(BaseModel):
    company: CompanyCreate
    admin_name: str
    admin_phone: str
    admin_pin: str  # 4-digit PIN

class CompanyResponse(BaseModel):
    id: str
    name: str
    contact_person: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime

class UserCreate(BaseModel):
    name: str
    phone: str
    pin: str  # 4-digit PIN
    role: str = "driver"  # admin, manager, driver, conductor
    company_id: Optional[str] = None

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
    company_id: Optional[str] = None
    customer_profile: Optional[Dict[str, Any]] = None

class LoginRequest(BaseModel):
    phone: str
    pin: str

class LoginResponse(BaseModel):
    token: str
    user: UserResponse
    company: Optional[CompanyResponse] = None

class ProductCreate(BaseModel):
    name: str
    category: str
    unit_type: str  # units, crates, liters
    price: float
    vat_applicable: bool = True  # True = has VAT, False = VAT exempt

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    unit_type: Optional[str] = None
    price: Optional[float] = None
    vat_applicable: Optional[bool] = None
    is_active: Optional[bool] = None

class ProductResponse(BaseModel):
    id: str
    name: str
    category: str
    unit_type: str
    price: float
    vat_applicable: bool = True
    is_active: bool = True

class CustomerCreate(BaseModel):
    name: str
    contact: Optional[str] = None
    location: Optional[str] = None
    payment_terms: str = "cash"  # cash, credit, mixed
    credit_limit: Optional[float] = None
    route_id: Optional[str] = None
    custom_prices: Optional[Dict[str, float]] = None  # product_id -> custom price

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    location: Optional[str] = None
    payment_terms: Optional[str] = None
    credit_limit: Optional[float] = None
    route_id: Optional[str] = None
    custom_prices: Optional[Dict[str, float]] = None  # product_id -> custom price
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

class SplitPayment(BaseModel):
    method: str  # cash, eft, shop2shop, kazang
    amount: float
    reference: Optional[str] = None  # Reference number for EFT/Shop2Shop/Kazang

class SaleCreate(BaseModel):
    route_id: str
    customer_id: str
    customer_name: str
    items: List[SaleItemCreate]
    crates_dropped: int = 0  # Crates left with customer
    crates_collected: int = 0  # Crates collected back (empties)
    cash_collected: float  # Total collected (sum of all payment methods)
    payment_type: str = "cash"  # Primary payment type: cash, eft, shop2shop, kazang, split
    split_payments: Optional[List[SplitPayment]] = None  # For split payments
    notes: Optional[str] = None
    delivery_status: str = "delivered"  # delivered, partial, skipped

class SaleUpdate(BaseModel):
    items: Optional[List[SaleItemCreate]] = None
    cash_collected: Optional[float] = None
    payment_type: Optional[str] = None
    split_payments: Optional[List[SplitPayment]] = None
    notes: Optional[str] = None
    delivery_status: Optional[str] = None
    void_reason: Optional[str] = None

class SaleResponse(BaseModel):
    id: str
    invoice_number: Optional[str] = None
    route_id: str
    route_name: Optional[str] = None
    customer_id: str
    customer_name: str
    driver_id: str
    driver_name: str
    items: List[dict]
    total_amount: float
    cash_collected: float
    shortage_amount: float = 0
    crates_dropped: int = 0
    crates_collected: int = 0
    payment_type: str
    split_payments: Optional[List[dict]] = None
    delivery_status: str = "delivered"
    notes: Optional[str]
    is_voided: bool = False
    void_reason: Optional[str] = None
    created_at: datetime

# ==================== STOCK MANAGEMENT MODELS ====================

class StockReceiveCreate(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    supplier: Optional[str] = None
    batch_reference: Optional[str] = None
    damages_in_transit: int = 0  # Damaged during transport
    rejected_stock: int = 0  # Rejected due to quality issues
    spoilt_from_factory: int = 0  # Spoilt/expired from factory
    crates_received: int = 0  # Crates received from manufacturer
    crates_returned: int = 0  # Empty crates returned to manufacturer
    notes: Optional[str] = None

class StockTakeCreate(BaseModel):
    product_id: str
    product_name: str
    system_quantity: int
    physical_count: int
    variance_reason: Optional[str] = None

class StockAdjustmentCreate(BaseModel):
    product_id: str
    product_name: str
    adjustment_quantity: int  # Positive or negative
    reason: str  # damages, spoilage, theft, correction, other
    notes: Optional[str] = None

class StockMovementResponse(BaseModel):
    id: str
    movement_type: str  # receive, sale, adjustment, take
    product_id: str
    product_name: str
    quantity: int
    reference: Optional[str]
    personnel_id: str
    personnel_name: str
    created_at: datetime

# ==================== EMAIL RECIPIENT MANAGEMENT ====================

class EmailRecipientCreate(BaseModel):
    email: str
    name: Optional[str] = None
    report_types: List[str]  # sales, stock, finance, daily, weekly

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
    total_expected: float = 0  # Total invoice amounts
    total_shortage: float = 0  # Total shortages (Expected - Collected)
    vehicle_check: Optional[Dict[str, Any]] = None  # Vehicle inspection data

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

def get_company_filter(user: dict) -> dict:
    """Get a MongoDB filter to scope data by the user's company_id.
    Returns empty dict if user has no company (backward compatible with legacy data)."""
    company_id = user.get("company_id")
    if company_id:
        return {"company_id": company_id}
    return {}

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
        "company_id": user.company_id,
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
    
    # Include company info in response
    company_info = None
    if user.get("company_id"):
        company = await db.companies.find_one({"_id": ObjectId(user["company_id"])})
        if company:
            company_info = str_id(company)
    
    return {
        "token": token,
        "user": str_id(user),
        "company": company_info
    }

# ==================== COMPANY SETUP ====================

@api_router.post("/companies/setup")
async def setup_company(setup: CompanySetup):
    """Register a new company with its admin user - clean slate with no pre-loaded data"""
    # Check if admin phone is already registered
    existing = await db.users.find_one({"phone": setup.admin_phone})
    if existing:
        raise HTTPException(status_code=400, detail="This phone number is already registered")
    
    # Create company
    company_doc = {
        "name": setup.company.name,
        "contact_person": setup.company.contact_person,
        "phone": setup.company.phone,
        "email": setup.company.email,
        "address": setup.company.address,
        "created_at": datetime.utcnow(),
    }
    result = await db.companies.insert_one(company_doc)
    company_id = str(result.inserted_id)
    
    # Create admin user for the company
    admin_doc = {
        "name": setup.admin_name,
        "phone": setup.admin_phone,
        "pin_hash": hash_pin(setup.admin_pin),
        "role": "admin",
        "is_active": True,
        "company_id": company_id,
        "created_at": datetime.utcnow(),
    }
    await db.users.insert_one(admin_doc)
    
    return {
        "message": "Company registered successfully",
        "company_id": company_id,
        "company_name": setup.company.name,
        "admin_phone": setup.admin_phone,
    }

@api_router.get("/companies/mine", response_model=CompanyResponse)
async def get_my_company(current_user: dict = Depends(get_current_user)):
    """Get the current user's company details"""
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=404, detail="No company associated with this user")
    
    company = await db.companies.find_one({"_id": ObjectId(company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    return str_id(company)

@api_router.put("/companies/mine")
async def update_my_company(data: CompanyCreate, current_user: dict = Depends(get_current_user)):
    """Update the current user's company details"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=404, detail="No company associated")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    company = await db.companies.find_one({"_id": ObjectId(company_id)})
    return str_id(company)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ==================== USER MANAGEMENT (Admin Only) ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Show only users from the same company
    query = get_company_filter(current_user)
    query["pin_hash"] = {"$exists": True}  # ensure it's a real user
    users = await db.users.find(query, {'pin_hash': 0}).to_list(500)
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
        "company_id": current_user.get("company_id"),
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
async def get_products(current_user: dict = Depends(get_current_user)):
    query = get_company_filter(current_user)
    products = await db.products.find(query).to_list(100)
    return [str_id(p) for p in products]

@api_router.post("/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, current_user: dict = Depends(get_current_user)):
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    product_doc = product.dict()
    product_doc["company_id"] = current_user.get("company_id")
    result = await db.products.insert_one(product_doc)
    product_doc["_id"] = result.inserted_id
    return str_id(product_doc)

@api_router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, product: ProductUpdate, current_user: dict = Depends(get_current_user)):
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    existing = await db.products.find_one({"_id": ObjectId(product_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = {k: v for k, v in product.dict().items() if v is not None}
    if update_data:
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
async def get_vehicles(include_inactive: bool = False, current_user: dict = Depends(get_current_user)):
    query = get_company_filter(current_user)
    if not include_inactive:
        query["is_active"] = {"$ne": False}
    vehicles = await db.vehicles.find(query).to_list(100)
    return [str_id(v) for v in vehicles]

@api_router.get("/vehicles/available")
async def get_available_vehicles(current_user: dict = Depends(get_current_user)):
    """Get vehicles not currently in use on an active route"""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Get all vehicles for this company
    query = get_company_filter(current_user)
    query["is_active"] = {"$ne": False}
    all_vehicles = await db.vehicles.find(query).to_list(100)
    
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
    vehicle_doc["company_id"] = current_user.get("company_id")
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
async def get_customers(route_id: Optional[str] = None, include_inactive: bool = False, current_user: dict = Depends(get_current_user)):
    query = get_company_filter(current_user)
    if route_id:
        query["route_id"] = route_id
    if not include_inactive:
        query["is_active"] = {"$ne": False}
    customers = await db.customers.find(query).to_list(500)
    return [str_id(c) for c in customers]

@api_router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return str_id(customer)

@api_router.post("/customers", response_model=CustomerResponse)
async def create_customer(customer: CustomerCreate, current_user: dict = Depends(get_current_user)):
    customer_doc = customer.dict()
    customer_doc["is_active"] = True
    customer_doc["balance"] = 0.0
    customer_doc["created_by"] = current_user["id"]
    customer_doc["company_id"] = current_user.get("company_id")
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
    query = get_company_filter(current_user)
    routes = await db.routes.find(query).to_list(50)
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
    route_doc["company_id"] = current_user.get("company_id")
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
    
    # Calculate shortage (Invoice Total - Cash Collected)
    shortage_amount = max(0, total - sale.cash_collected)
    
    # Generate automatic invoice number: INV-YYYYMMDD-ROUTE-####
    today = datetime.utcnow()
    today_str = today.strftime("%Y%m%d")
    
    # Get route code (first 4 chars of route name or route_id)
    route = await db.routes.find_one({"_id": ObjectId(sale.route_id)})
    route_code = route["name"][:4].upper().replace(" ", "") if route else sale.route_id[:4].upper()
    
    # Count sales for today to generate sequence number
    start_of_day = today.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = today.replace(hour=23, minute=59, second=59, microsecond=999999)
    daily_sales_count = await db.sales.count_documents({
        "created_at": {"$gte": start_of_day, "$lte": end_of_day}
    })
    sequence_num = daily_sales_count + 1
    
    # Format: INV-YYYYMMDD-ROUTE-0001
    invoice_number = f"INV-{today_str}-{route_code}-{sequence_num:04d}"
    
    sale_doc = {
        "invoice_number": invoice_number,
        "route_id": sale.route_id,
        "route_name": route["name"] if route else "Unknown",
        "customer_id": sale.customer_id,
        "customer_name": sale.customer_name,
        "driver_id": current_user["id"],
        "driver_name": current_user["name"],
        "items": [item.dict() for item in sale.items],
        "total_amount": total,
        "crates_dropped": sale.crates_dropped,
        "crates_collected": sale.crates_collected,
        "cash_collected": sale.cash_collected,
        "shortage_amount": shortage_amount,
        "payment_type": sale.payment_type,
        "split_payments": [sp.dict() for sp in sale.split_payments] if sale.split_payments else None,
        "delivery_status": sale.delivery_status,
        "notes": sale.notes,
        "is_voided": False,
        "company_id": current_user.get("company_id"),
        "created_at": datetime.utcnow()
    }
    
    result = await db.sales.insert_one(sale_doc)
    sale_doc["_id"] = result.inserted_id
    
    # Update daily route totals including crates and shortage tracking
    today_date_str = datetime.utcnow().strftime("%Y-%m-%d")
    await db.daily_routes.update_one(
        {"driver_id": current_user["id"], "date": today_date_str, "status": "active"},
        {"$inc": {
            "sales_count": 1, 
            "total_collected": sale.cash_collected,
            "total_expected": total,
            "total_shortage": shortage_amount,
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
    
    # Deduct stock for each item sold
    for item in sale.items:
        net_sold = item.quantity_delivered - item.quantity_returned
        if net_sold > 0:
            # Reduce stock
            await db.stock.update_one(
                {"product_id": item.product_id},
                {"$inc": {"quantity": -net_sold}}
            )
            # Log the movement
            await db.stock_movements.insert_one({
                "movement_type": "sale",
                "product_id": item.product_id,
                "product_name": item.product_name,
                "quantity": -net_sold,
                "sale_id": str(sale_doc["_id"]),
                "invoice_number": invoice_number,
                "customer_name": sale.customer_name,
                "driver_id": current_user["id"],
                "driver_name": current_user["name"],
                "created_at": datetime.utcnow()
            })
    
    return str_id(sale_doc)

@api_router.get("/sales", response_model=List[SaleResponse])
async def get_sales(
    route_id: Optional[str] = None,
    date_str: Optional[str] = None,
    customer_id: Optional[str] = None,
    include_voided: bool = False,
    current_user: dict = Depends(get_current_user)
):
    query = get_company_filter(current_user)
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
        "company_id": current_user.get("company_id"),
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

@api_router.get("/daily-routes/{route_id}", response_model=DailyRouteResponse)
async def get_daily_route_by_id(route_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific daily route by ID"""
    daily_route = await db.daily_routes.find_one({"_id": ObjectId(route_id)})
    if not daily_route:
        raise HTTPException(status_code=404, detail="Daily route not found")
    
    # Check permissions - drivers can only see their own routes
    if current_user["role"] == "driver" and daily_route["driver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this route")
    
    return str_id(daily_route)

@api_router.delete("/daily-routes/{route_id}")
async def delete_daily_route(route_id: str, current_user: dict = Depends(get_current_user)):
    """Delete/cancel a daily route - Admin/Manager only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required to delete routes")
    
    daily_route = await db.daily_routes.find_one({"_id": ObjectId(route_id)})
    if not daily_route:
        raise HTTPException(status_code=404, detail="Daily route not found")
    
    # Delete associated sales if any
    await db.sales.delete_many({"route_id": route_id})
    
    # Delete the route
    await db.daily_routes.delete_one({"_id": ObjectId(route_id)})
    
    return {"message": "Route deleted successfully", "deleted_sales": True}

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
        "daily_routes": [str_id(dr) for dr in daily_routes],
        "vehicle_inspections": [
            {
                "route_name": dr.get("route_name", ""),
                "vehicle_name": dr.get("vehicle_name", ""),
                "vehicle_registration": dr.get("vehicle_registration", ""),
                "driver_name": dr.get("driver_name", ""),
                "inspection": dr.get("vehicle_check", {}),
            }
            for dr in daily_routes if dr.get("vehicle_check")
        ]
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
    """Export beautiful, interactive route report to Excel format"""
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
    
    # Get products for breakdown
    products = await db.products.find().to_list(500)
    product_map = {str(p["_id"]): p["name"] for p in products}
    
    # Create Excel file in memory
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    
    # ==================== DEFINE STYLES ====================
    # Brand colors
    primary_color = '#3B82F6'  # Blue
    success_color = '#10B981'  # Green
    warning_color = '#F59E0B'  # Orange
    danger_color = '#EF4444'   # Red
    dark_bg = '#1E293B'        # Dark background
    light_text = '#F8FAFC'     # Light text
    
    # Title styles
    title_format = workbook.add_format({
        'bold': True, 'font_size': 24, 'font_color': primary_color,
        'align': 'center', 'valign': 'vcenter'
    })
    subtitle_format = workbook.add_format({
        'bold': True, 'font_size': 14, 'font_color': '#64748B',
        'align': 'center', 'valign': 'vcenter'
    })
    
    # Header styles
    header_format = workbook.add_format({
        'bold': True, 'font_size': 11, 'font_color': 'white',
        'bg_color': primary_color, 'border': 1, 'border_color': primary_color,
        'align': 'center', 'valign': 'vcenter', 'text_wrap': True
    })
    header_green = workbook.add_format({
        'bold': True, 'font_size': 11, 'font_color': 'white',
        'bg_color': success_color, 'border': 1,
        'align': 'center', 'valign': 'vcenter'
    })
    header_orange = workbook.add_format({
        'bold': True, 'font_size': 11, 'font_color': 'white',
        'bg_color': warning_color, 'border': 1,
        'align': 'center', 'valign': 'vcenter'
    })
    
    # Data cell styles
    cell_format = workbook.add_format({
        'border': 1, 'border_color': '#E2E8F0',
        'valign': 'vcenter', 'align': 'left'
    })
    cell_center = workbook.add_format({
        'border': 1, 'border_color': '#E2E8F0',
        'valign': 'vcenter', 'align': 'center'
    })
    cell_wrap = workbook.add_format({
        'border': 1, 'border_color': '#E2E8F0',
        'valign': 'vcenter', 'text_wrap': True
    })
    
    # Number formats
    money_format = workbook.add_format({
        'num_format': 'R #,##0.00', 'border': 1, 'border_color': '#E2E8F0',
        'align': 'right', 'valign': 'vcenter'
    })
    money_bold = workbook.add_format({
        'num_format': 'R #,##0.00', 'border': 1, 'bold': True,
        'align': 'right', 'valign': 'vcenter', 'bg_color': '#F0FDF4'
    })
    number_format = workbook.add_format({
        'num_format': '#,##0', 'border': 1, 'border_color': '#E2E8F0',
        'align': 'center', 'valign': 'vcenter'
    })
    percent_format = workbook.add_format({
        'num_format': '0.0%', 'border': 1, 'border_color': '#E2E8F0',
        'align': 'center', 'valign': 'vcenter'
    })
    date_format = workbook.add_format({
        'num_format': 'yyyy-mm-dd', 'border': 1, 'border_color': '#E2E8F0',
        'align': 'center', 'valign': 'vcenter'
    })
    time_format = workbook.add_format({
        'num_format': 'hh:mm', 'border': 1, 'border_color': '#E2E8F0',
        'align': 'center', 'valign': 'vcenter'
    })
    
    # Status styles
    status_delivered = workbook.add_format({
        'bold': True, 'font_color': 'white', 'bg_color': success_color,
        'border': 1, 'align': 'center', 'valign': 'vcenter'
    })
    status_pending = workbook.add_format({
        'bold': True, 'font_color': 'white', 'bg_color': warning_color,
        'border': 1, 'align': 'center', 'valign': 'vcenter'
    })
    status_active = workbook.add_format({
        'bold': True, 'font_color': 'white', 'bg_color': primary_color,
        'border': 1, 'align': 'center', 'valign': 'vcenter'
    })
    
    # KPI Card styles
    kpi_label = workbook.add_format({
        'font_size': 10, 'font_color': '#64748B',
        'align': 'center', 'valign': 'bottom'
    })
    kpi_value = workbook.add_format({
        'bold': True, 'font_size': 18, 'font_color': '#1E293B',
        'align': 'center', 'valign': 'top'
    })
    kpi_value_money = workbook.add_format({
        'bold': True, 'font_size': 18, 'font_color': success_color,
        'num_format': 'R #,##0.00', 'align': 'center', 'valign': 'top'
    })
    
    # Alternating row colors
    row_even = workbook.add_format({
        'border': 1, 'border_color': '#E2E8F0',
        'bg_color': '#F8FAFC', 'valign': 'vcenter'
    })
    row_odd = workbook.add_format({
        'border': 1, 'border_color': '#E2E8F0',
        'valign': 'vcenter'
    })
    
    # Calculate totals
    total_collected = sum(s.get("cash_collected", 0) for s in sales)
    total_expected = sum(s.get("total_amount", 0) for s in sales)
    total_crates_dropped = sum(s.get("crates_dropped", 0) for s in sales)
    total_crates_collected = sum(s.get("crates_collected", 0) for s in sales)
    total_km = sum(dr.get("km_traveled", 0) or 0 for dr in daily_routes)
    collection_rate = (total_collected / total_expected) if total_expected > 0 else 0
    
    # ==================== DASHBOARD SHEET ====================
    dashboard = workbook.add_worksheet('📊 Dashboard')
    dashboard.set_tab_color(primary_color)
    
    # Set column widths
    dashboard.set_column('A:A', 3)   # Margin
    dashboard.set_column('B:G', 18)  # KPI columns
    dashboard.set_column('H:H', 3)   # Margin
    
    # Hide gridlines for cleaner look
    dashboard.hide_gridlines(2)
    
    # Title
    dashboard.set_row(1, 40)
    dashboard.merge_range('B2:G2', '📊 MZANSI DISTRIBUTION TRACKER', title_format)
    dashboard.merge_range('B3:G3', f'Daily Report - {date_str}', subtitle_format)
    
    # KPI Cards Row 1
    dashboard.set_row(5, 20)
    dashboard.set_row(6, 30)
    
    kpis = [
        ('Total Sales', len(sales), None),
        ('Cash Collected', total_collected, 'money'),
        ('Expected', total_expected, 'money'),
        ('Collection Rate', collection_rate, 'percent'),
        ('Routes', len(daily_routes), None),
        ('KM Traveled', total_km, None),
    ]
    
    for i, (label, value, fmt) in enumerate(kpis):
        col = i + 1  # B=1, C=2, etc.
        dashboard.write(4, col, label, kpi_label)
        if fmt == 'money':
            dashboard.write(5, col, value, kpi_value_money)
        elif fmt == 'percent':
            dashboard.write(5, col, f"{value*100:.1f}%", kpi_value)
        else:
            dashboard.write(5, col, value, kpi_value)
    
    # Crates Summary Row
    dashboard.set_row(8, 20)
    dashboard.set_row(9, 30)
    
    crate_kpis = [
        ('Crates Out', total_crates_dropped),
        ('Crates In', total_crates_collected),
        ('Net Crates', total_crates_dropped - total_crates_collected),
    ]
    
    for i, (label, value) in enumerate(crate_kpis):
        col = i + 1
        dashboard.write(7, col, label, kpi_label)
        dashboard.write(8, col, value, kpi_value)
    
    # Add a mini sales table on dashboard
    dashboard.write(11, 1, 'Recent Sales', header_format)
    dashboard.merge_range('B12:G12', '', header_format)
    
    mini_headers = ['Time', 'Customer', 'Amount', 'Collected', 'Status']
    for i, h in enumerate(mini_headers):
        dashboard.write(12, i + 1, h, header_format)
    
    for row_idx, sale in enumerate(sales[:10], start=13):
        time_str = sale.get("created_at", datetime.utcnow()).strftime("%H:%M")
        row_fmt = row_even if row_idx % 2 == 0 else row_odd
        dashboard.write(row_idx, 1, time_str, row_fmt)
        dashboard.write(row_idx, 2, sale.get("customer_name", "")[:20], row_fmt)
        dashboard.write(row_idx, 3, sale.get("total_amount", 0), money_format)
        dashboard.write(row_idx, 4, sale.get("cash_collected", 0), money_format)
        status = sale.get("delivery_status", "delivered")
        if status == "delivered":
            dashboard.write(row_idx, 5, "✓ Delivered", status_delivered)
        else:
            dashboard.write(row_idx, 5, "⏳ Pending", status_pending)
    
    # ==================== SALES DETAILS SHEET ====================
    sales_sheet = workbook.add_worksheet('💰 Sales Details')
    sales_sheet.set_tab_color(success_color)
    sales_sheet.hide_gridlines(2)
    
    # Set column widths
    sales_sheet.set_column('A:A', 12)   # Time
    sales_sheet.set_column('B:B', 25)   # Customer
    sales_sheet.set_column('C:C', 18)   # Driver
    sales_sheet.set_column('D:D', 35)   # Products
    sales_sheet.set_column('E:E', 14)   # Total
    sales_sheet.set_column('F:F', 14)   # Collected
    sales_sheet.set_column('G:G', 12)   # Crates Out
    sales_sheet.set_column('H:H', 12)   # Crates In
    sales_sheet.set_column('I:I', 12)   # Payment
    sales_sheet.set_column('J:J', 12)   # Status
    
    # Title
    sales_sheet.set_row(0, 30)
    sales_sheet.merge_range('A1:J1', f'💰 Sales Report - {date_str}', title_format)
    
    # Headers with filters
    sales_headers = ['Time', 'Customer', 'Driver', 'Products', 'Total', 'Collected', 
                     'Crates Out', 'Crates In', 'Payment', 'Status']
    
    for col, header in enumerate(sales_headers):
        sales_sheet.write(2, col, header, header_format)
    
    # Enable auto-filter
    if sales:
        sales_sheet.autofilter(2, 0, 2 + len(sales), len(sales_headers) - 1)
    
    # Freeze header row
    sales_sheet.freeze_panes(3, 0)
    
    # Data rows
    for row_num, sale in enumerate(sales, start=3):
        time_str = sale.get("created_at", datetime.utcnow()).strftime("%H:%M")
        products = ", ".join([f"{i.get('product_name', '')} x{i.get('quantity_delivered', 0)}" 
                             for i in sale.get("items", [])])
        
        row_fmt = row_even if row_num % 2 == 0 else row_odd
        
        sales_sheet.write(row_num, 0, time_str, cell_center)
        sales_sheet.write(row_num, 1, sale.get("customer_name", ""), cell_format)
        sales_sheet.write(row_num, 2, sale.get("driver_name", ""), cell_format)
        sales_sheet.write(row_num, 3, products, cell_wrap)
        sales_sheet.write(row_num, 4, sale.get("total_amount", 0), money_format)
        sales_sheet.write(row_num, 5, sale.get("cash_collected", 0), money_format)
        sales_sheet.write(row_num, 6, sale.get("crates_dropped", 0), number_format)
        sales_sheet.write(row_num, 7, sale.get("crates_collected", 0), number_format)
        sales_sheet.write(row_num, 8, sale.get("payment_type", "cash").upper(), cell_center)
        
        status = sale.get("delivery_status", "delivered")
        if status == "delivered":
            sales_sheet.write(row_num, 9, "✓ DELIVERED", status_delivered)
        else:
            sales_sheet.write(row_num, 9, "PENDING", status_pending)
    
    # Totals row
    if sales:
        total_row = 3 + len(sales)
        sales_sheet.write(total_row, 3, 'TOTALS:', header_format)
        sales_sheet.write(total_row, 4, total_expected, money_bold)
        sales_sheet.write(total_row, 5, total_collected, money_bold)
        sales_sheet.write(total_row, 6, total_crates_dropped, header_green)
        sales_sheet.write(total_row, 7, total_crates_collected, header_green)
    
    # ==================== ROUTES SHEET ====================
    routes_sheet = workbook.add_worksheet('🚗 Routes')
    routes_sheet.set_tab_color(warning_color)
    routes_sheet.hide_gridlines(2)
    
    # Set column widths
    routes_sheet.set_column('A:A', 20)  # Route
    routes_sheet.set_column('B:B', 18)  # Driver
    routes_sheet.set_column('C:C', 25)  # Vehicle
    routes_sheet.set_column('D:D', 12)  # Opening KM
    routes_sheet.set_column('E:E', 12)  # Closing KM
    routes_sheet.set_column('F:F', 12)  # KM Traveled
    routes_sheet.set_column('G:G', 12)  # Crates Out
    routes_sheet.set_column('H:H', 12)  # Crates In
    routes_sheet.set_column('I:I', 10)  # Sales
    routes_sheet.set_column('J:J', 14)  # Collected
    routes_sheet.set_column('K:K', 12)  # Status
    
    # Title
    routes_sheet.set_row(0, 30)
    routes_sheet.merge_range('A1:K1', f'🚗 Route Details - {date_str}', title_format)
    
    # Headers
    route_headers = ['Route', 'Driver', 'Vehicle', 'Start KM', 'End KM', 'Distance', 
                     'Crates Out', 'Crates In', 'Sales', 'Collected', 'Status']
    
    for col, header in enumerate(route_headers):
        routes_sheet.write(2, col, header, header_format)
    
    # Enable auto-filter
    if daily_routes:
        routes_sheet.autofilter(2, 0, 2 + len(daily_routes), len(route_headers) - 1)
    
    routes_sheet.freeze_panes(3, 0)
    
    # Data rows
    for row_num, dr in enumerate(daily_routes, start=3):
        vehicle_info = f"{dr.get('vehicle_name', 'N/A')} ({dr.get('vehicle_registration', '')})"
        row_fmt = row_even if row_num % 2 == 0 else row_odd
        
        routes_sheet.write(row_num, 0, dr.get("route_name", ""), cell_format)
        routes_sheet.write(row_num, 1, dr.get("driver_name", ""), cell_format)
        routes_sheet.write(row_num, 2, vehicle_info, cell_format)
        routes_sheet.write(row_num, 3, dr.get("opening_km", 0), number_format)
        routes_sheet.write(row_num, 4, dr.get("closing_km", 0) or 0, number_format)
        routes_sheet.write(row_num, 5, dr.get("km_traveled", 0) or 0, number_format)
        routes_sheet.write(row_num, 6, dr.get("crates_out", 0), number_format)
        routes_sheet.write(row_num, 7, dr.get("crates_in", 0) or 0, number_format)
        routes_sheet.write(row_num, 8, dr.get("sales_count", 0), number_format)
        routes_sheet.write(row_num, 9, dr.get("total_collected", 0), money_format)
        
        status = dr.get("status", "active")
        if status == "completed":
            routes_sheet.write(row_num, 10, "✓ COMPLETED", status_delivered)
        else:
            routes_sheet.write(row_num, 10, "🔵 ACTIVE", status_active)
    
    # ==================== PRODUCT BREAKDOWN SHEET ====================
    products_sheet = workbook.add_worksheet('📦 Products')
    products_sheet.set_tab_color('#8B5CF6')
    products_sheet.hide_gridlines(2)
    
    # Set column widths
    products_sheet.set_column('A:A', 25)  # Product
    products_sheet.set_column('B:B', 15)  # Category
    products_sheet.set_column('C:C', 12)  # Delivered
    products_sheet.set_column('D:D', 12)  # Returned
    products_sheet.set_column('E:E', 12)  # Damages
    products_sheet.set_column('F:F', 12)  # Net Sold
    products_sheet.set_column('G:G', 14)  # Revenue
    
    # Title
    products_sheet.set_row(0, 30)
    products_sheet.merge_range('A1:G1', f'📦 Product Breakdown - {date_str}', title_format)
    
    # Calculate product totals
    product_totals = {}
    for sale in sales:
        for item in sale.get("items", []):
            prod_name = item.get("product_name", "Unknown")
            if prod_name not in product_totals:
                product_totals[prod_name] = {
                    "delivered": 0, "returned": 0, "damages": 0, "revenue": 0,
                    "category": item.get("category", "Other")
                }
            product_totals[prod_name]["delivered"] += item.get("quantity_delivered", 0)
            product_totals[prod_name]["returned"] += item.get("quantity_returned", 0)
            product_totals[prod_name]["damages"] += item.get("damages", 0)
            net = item.get("quantity_delivered", 0) - item.get("quantity_returned", 0)
            product_totals[prod_name]["revenue"] += net * item.get("unit_price", 0)
    
    # Headers
    prod_headers = ['Product', 'Category', 'Delivered', 'Returned', 'Damages', 'Net Sold', 'Revenue']
    for col, header in enumerate(prod_headers):
        products_sheet.write(2, col, header, header_format)
    
    if product_totals:
        products_sheet.autofilter(2, 0, 2 + len(product_totals), len(prod_headers) - 1)
    
    products_sheet.freeze_panes(3, 0)
    
    # Data rows
    for row_num, (prod_name, data) in enumerate(sorted(product_totals.items()), start=3):
        net_sold = data["delivered"] - data["returned"]
        row_fmt = row_even if row_num % 2 == 0 else row_odd
        
        products_sheet.write(row_num, 0, prod_name, cell_format)
        products_sheet.write(row_num, 1, data["category"], cell_center)
        products_sheet.write(row_num, 2, data["delivered"], number_format)
        products_sheet.write(row_num, 3, data["returned"], number_format)
        products_sheet.write(row_num, 4, data["damages"], number_format)
        products_sheet.write(row_num, 5, net_sold, header_green if net_sold > 0 else number_format)
        products_sheet.write(row_num, 6, data["revenue"], money_format)
    
    # Grand totals
    if product_totals:
        total_row = 3 + len(product_totals)
        grand_delivered = sum(d["delivered"] for d in product_totals.values())
        grand_returned = sum(d["returned"] for d in product_totals.values())
        grand_damages = sum(d["damages"] for d in product_totals.values())
        grand_revenue = sum(d["revenue"] for d in product_totals.values())
        
        products_sheet.write(total_row, 0, 'GRAND TOTAL', header_format)
        products_sheet.write(total_row, 1, '', header_format)
        products_sheet.write(total_row, 2, grand_delivered, header_green)
        products_sheet.write(total_row, 3, grand_returned, header_orange)
        products_sheet.write(total_row, 4, grand_damages, header_orange)
        products_sheet.write(total_row, 5, grand_delivered - grand_returned, header_green)
        products_sheet.write(total_row, 6, grand_revenue, money_bold)
    
    # ==================== VEHICLE INSPECTION SHEET ====================
    insp_sheet = workbook.add_worksheet('🔍 Vehicle Inspection')
    insp_sheet.set_tab_color('#EF4444')
    insp_sheet.hide_gridlines(2)
    
    insp_sheet.set_column('A:A', 22)  # Category / Route
    insp_sheet.set_column('B:B', 18)  # Vehicle
    insp_sheet.set_column('C:C', 18)  # Driver
    insp_sheet.set_column('D:D', 35)  # Item
    insp_sheet.set_column('E:E', 10)  # Status
    insp_sheet.set_column('F:F', 40)  # Comment
    
    insp_sheet.set_row(0, 30)
    insp_sheet.merge_range('A1:F1', f'🔍 Vehicle Inspection Report - {date_str}', title_format)
    
    insp_headers = ['Route / Category', 'Vehicle', 'Driver', 'Inspection Item', 'Status', 'Comments']
    for col, header in enumerate(insp_headers):
        insp_sheet.write(2, col, header, header_format)
    
    insp_sheet.freeze_panes(3, 0)
    
    insp_row = 3
    for dr in daily_routes:
        vc = dr.get("vehicle_check") or {}
        if not vc:
            continue
        
        route_name = dr.get("route_name", "")
        vehicle_info = f"{dr.get('vehicle_name', 'N/A')} ({dr.get('vehicle_registration', '')})"
        driver_name = dr.get("driver_name", "")
        
        # Summary row
        summary = vc.get("summary", {})
        pass_rate = summary.get("pass_rate", 0)
        total_items = summary.get("total_items", 0)
        passed_count = summary.get("passed", 0)
        failed_count = summary.get("failed", 0)
        
        summary_text = f"Pass Rate: {pass_rate}% ({passed_count}/{total_items})"
        if failed_count > 0:
            summary_text += f" - {failed_count} FAILED"
        
        insp_sheet.write(insp_row, 0, route_name, header_format)
        insp_sheet.write(insp_row, 1, vehicle_info, header_format)
        insp_sheet.write(insp_row, 2, driver_name, header_format)
        insp_sheet.write(insp_row, 3, summary_text, header_format)
        insp_sheet.write(insp_row, 4, f"{pass_rate}%", header_green if pass_rate >= 80 else header_orange)
        insp_sheet.write(insp_row, 5, vc.get("overall_notes", "") or "", cell_wrap)
        insp_row += 1
        
        # Category details
        categories = vc.get("categories", {})
        for cat_id, cat_data in categories.items():
            cat_title = cat_data.get("title", cat_id)
            for item in cat_data.get("items", []):
                status = item.get("passed")
                status_text = "✓ PASS" if status is True else ("✗ FAIL" if status is False else "—")
                status_fmt = status_delivered if status is True else (status_pending if status is False else cell_center)
                comment = item.get("comment") or ""
                
                insp_sheet.write(insp_row, 0, cat_title, cell_format)
                insp_sheet.write(insp_row, 1, "", cell_format)
                insp_sheet.write(insp_row, 2, "", cell_format)
                insp_sheet.write(insp_row, 3, item.get("label", ""), cell_format)
                insp_sheet.write(insp_row, 4, status_text, status_fmt)
                insp_sheet.write(insp_row, 5, comment, cell_wrap)
                insp_row += 1
        
        # Blank separator row
        insp_row += 1
    
    # If no inspections
    if insp_row == 3:
        insp_sheet.write(3, 0, "No vehicle inspections recorded for this date", cell_format)

    # Set Dashboard as the active sheet
    dashboard.activate()
    
    workbook.close()
    output.seek(0)
    
    filename = f"mzansi_report_{date_str}.xlsx"
    
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
# ==================== EMAIL REPORT ENDPOINTS ====================

class EmailReportRequest(BaseModel):
    report_type: str  # daily, weekly, monthly
    recipient_emails: List[str]
    date_str: Optional[str] = None
    include_excel: bool = True

@api_router.post("/settings/email")
async def save_email_settings(config: dict, current_user: dict = Depends(get_current_user)):
    """Save email settings - Admin only"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.settings.update_one(
        {"key": "email_config"},
        {"$set": {"key": "email_config", "value": config, "updated_at": datetime.utcnow()}},
        upsert=True
    )
    return {"message": "Email settings saved"}

@api_router.get("/settings/email")
async def get_email_settings(current_user: dict = Depends(get_current_user)):
    """Get email settings - Admin only"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.settings.find_one({"key": "email_config"})
    if not settings:
        return {"configured": False}
    return {"configured": True, "recipient_emails": settings.get("value", {}).get("recipient_emails", [])}

async def generate_report_excel_for_email(report_type: str, date_str: str = None):
    """Generate Excel report for emailing"""
    if not date_str:
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    end_date = datetime.strptime(date_str, "%Y-%m-%d")
    if report_type == "daily":
        start_date = end_date
    elif report_type == "weekly":
        start_date = end_date - timedelta(days=7)
    elif report_type == "monthly":
        start_date = end_date - timedelta(days=30)
    else:
        start_date = end_date
    
    daily_routes = await db.daily_routes.find({
        "date": {"$gte": start_date.strftime("%Y-%m-%d"), "$lte": date_str}
    }).to_list(500)
    
    sales = await db.sales.find({
        "created_at": {"$gte": start_date, "$lte": end_date.replace(hour=23, minute=59, second=59)},
        "is_voided": {"$ne": True}
    }).to_list(5000)
    
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    
    header_format = workbook.add_format({'bold': True, 'bg_color': '#3B82F6', 'font_color': 'white', 'border': 1})
    money_format = workbook.add_format({'num_format': 'R #,##0.00', 'border': 1})
    cell_format = workbook.add_format({'border': 1})
    
    summary = workbook.add_worksheet('Summary')
    summary.set_column('A:B', 25)
    summary.write('A1', 'Metric', header_format)
    summary.write('B1', 'Value', header_format)
    
    total_collected = sum(s.get("cash_collected", 0) for s in sales)
    total_expected = sum(s.get("total_amount", 0) for s in sales)
    
    metrics = [
        ('Report Type', report_type.capitalize()),
        ('Period', f"{start_date.strftime('%Y-%m-%d')} to {date_str}"),
        ('Total Routes', len(daily_routes)),
        ('Total Sales', len(sales)),
        ('Total Collected', total_collected),
        ('Total Expected', total_expected),
    ]
    
    for i, (metric, value) in enumerate(metrics, start=1):
        summary.write(i, 0, metric, cell_format)
        summary.write(i, 1, str(value) if not isinstance(value, float) else value, money_format if isinstance(value, float) else cell_format)
    
    sales_sheet = workbook.add_worksheet('Sales')
    headers = ['Date/Time', 'Customer', 'Driver', 'Total', 'Collected', 'Crates Out', 'Crates In']
    for col, h in enumerate(headers):
        sales_sheet.write(0, col, h, header_format)
    
    for row, sale in enumerate(sales, start=1):
        created_at = sale.get("created_at", datetime.utcnow())
        sales_sheet.write(row, 0, created_at.strftime("%Y-%m-%d %H:%M"), cell_format)
        sales_sheet.write(row, 1, sale.get("customer_name", ""), cell_format)
        sales_sheet.write(row, 2, sale.get("driver_name", ""), cell_format)
        sales_sheet.write(row, 3, sale.get("total_amount", 0), money_format)
        sales_sheet.write(row, 4, sale.get("cash_collected", 0), money_format)
        sales_sheet.write(row, 5, sale.get("crates_dropped", 0), cell_format)
        sales_sheet.write(row, 6, sale.get("crates_collected", 0), cell_format)
    
    workbook.close()
    output.seek(0)
    return output.getvalue()

@api_router.post("/reports/email")
async def email_report(
    request: EmailReportRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Send report via email - Admin/Manager only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    settings = await db.settings.find_one({"key": "email_config"})
    if not settings or not settings.get("value"):
        raise HTTPException(status_code=400, detail="Email not configured. Please set up email settings first.")
    
    email_config = settings["value"]
    date_str = request.date_str or datetime.utcnow().strftime("%Y-%m-%d")
    
    email_record = {
        "report_type": request.report_type,
        "recipient_emails": request.recipient_emails,
        "date_str": date_str,
        "status": "pending",
        "requested_by": current_user["id"],
        "requested_at": datetime.utcnow()
    }
    
    result = await db.email_logs.insert_one(email_record)
    email_id = str(result.inserted_id)
    
    async def send_email_task():
        try:
            excel_data = await generate_report_excel_for_email(request.report_type, date_str)
            
            msg = MIMEMultipart()
            msg['From'] = email_config.get('sender_email')
            msg['To'] = ', '.join(request.recipient_emails)
            msg['Subject'] = f"Mzansi FMCG Tracker - {request.report_type.capitalize()} Report ({date_str})"
            
            body = f"Dear Team,\n\nPlease find attached the {request.report_type} report for {date_str}.\n\nBest regards,\nDistribution Management System"
            msg.attach(MIMEText(body, 'plain'))
            
            if request.include_excel:
                attachment = MIMEBase('application', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                attachment.set_payload(excel_data)
                encoders.encode_base64(attachment)
                attachment.add_header('Content-Disposition', f'attachment; filename={request.report_type}_report_{date_str}.xlsx')
                msg.attach(attachment)
            
            # Support both SSL (port 465) and TLS (port 587)
            smtp_port = email_config.get('smtp_port', 465)
            smtp_server = email_config.get('smtp_server', 'mail.mzansipc.co.za')
            
            if smtp_port == 465:
                # Use SSL
                server = smtplib.SMTP_SSL(smtp_server, smtp_port)
            else:
                # Use TLS
                server = smtplib.SMTP(smtp_server, smtp_port)
                server.starttls()
            
            server.login(email_config.get('sender_email'), email_config.get('sender_password'))
            server.send_message(msg)
            server.quit()
            
            await db.email_logs.update_one(
                {"_id": ObjectId(email_id)},
                {"$set": {"status": "sent", "sent_at": datetime.utcnow()}}
            )
        except Exception as e:
            await db.email_logs.update_one(
                {"_id": ObjectId(email_id)},
                {"$set": {"status": "failed", "error": str(e), "failed_at": datetime.utcnow()}}
            )
    
    background_tasks.add_task(send_email_task)
    
    return {"message": f"{request.report_type.capitalize()} report queued", "email_id": email_id}

@api_router.get("/reports/email-logs")
async def get_email_logs(current_user: dict = Depends(get_current_user)):
    """Get email send history"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    logs = await db.email_logs.find().sort("requested_at", -1).to_list(50)
    return [str_id(log) for log in logs]

# ==================== CUSTOMER PRICING ENDPOINTS ====================

@api_router.get("/customers/{customer_id}/prices")
async def get_customer_prices(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get custom prices for a customer"""
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    products = await db.products.find().to_list(500)
    custom_prices = customer.get("custom_prices") or {}
    
    price_list = []
    for product in products:
        product_id = str(product["_id"])
        price_list.append({
            "product_id": product_id,
            "product_name": product["name"],
            "category": product["category"],
            "default_price": product["price"],
            "custom_price": custom_prices.get(product_id) if custom_prices else None,
            "effective_price": custom_prices.get(product_id, product["price"]) if custom_prices else product["price"]
        })
    
    return {"customer_id": customer_id, "customer_name": customer["name"], "price_list": price_list}

@api_router.put("/customers/{customer_id}/prices")
async def update_customer_prices(
    customer_id: str,
    prices: Dict[str, float],
    current_user: dict = Depends(get_current_user)
):
    """Update custom prices for a customer - Admin/Manager only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    await db.customers.update_one(
        {"_id": ObjectId(customer_id)},
        {"$set": {"custom_prices": prices, "prices_updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Customer prices updated", "customer_id": customer_id}

# ==================== STOCK MANAGEMENT ENDPOINTS ====================

@api_router.get("/stock/levels")
async def get_stock_levels(current_user: dict = Depends(get_current_user)):
    """Get current stock levels for all products"""
    products = await db.products.find().to_list(500)
    stock_levels = []
    
    for product in products:
        product_id = str(product["_id"])
        stock_item = await db.stock.find_one({"product_id": product_id})
        
        stock_levels.append({
            "product_id": product_id,
            "product_name": product["name"],
            "category": product["category"],
            "unit_type": product.get("unit_type", "units"),
            "current_quantity": stock_item.get("quantity", 0) if stock_item else 0,
            "last_updated": stock_item.get("updated_at") if stock_item else None
        })
    
    return stock_levels

@api_router.post("/stock/receive")
async def receive_stock(data: StockReceiveCreate, current_user: dict = Depends(get_current_user)):
    """Record incoming stock from supplier - Admin/Manager only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    # Calculate net quantity after deducting damages/rejects/spoilt
    total_deductions = data.damages_in_transit + data.rejected_stock + data.spoilt_from_factory
    net_quantity = data.quantity - total_deductions
    
    # Update or create stock record with net quantity
    await db.stock.update_one(
        {"product_id": data.product_id},
        {
            "$inc": {"quantity": net_quantity},
            "$set": {"product_name": data.product_name, "updated_at": datetime.utcnow()}
        },
        upsert=True
    )
    
    # Log the receive movement
    movement = {
        "movement_type": "receive",
        "product_id": data.product_id,
        "product_name": data.product_name,
        "quantity": data.quantity,
        "net_quantity": net_quantity,
        "damages_in_transit": data.damages_in_transit,
        "rejected_stock": data.rejected_stock,
        "spoilt_from_factory": data.spoilt_from_factory,
        "crates_received": data.crates_received,
        "crates_returned": data.crates_returned,
        "supplier": data.supplier,
        "batch_reference": data.batch_reference,
        "notes": data.notes,
        "personnel_id": current_user["id"],
        "personnel_name": current_user["name"],
        "created_at": datetime.utcnow()
    }
    await db.stock_movements.insert_one(movement)
    
    # Log deductions separately for accountability if any
    if data.damages_in_transit > 0:
        await db.stock_movements.insert_one({
            "movement_type": "damages_in_transit",
            "product_id": data.product_id,
            "product_name": data.product_name,
            "quantity": -data.damages_in_transit,
            "supplier": data.supplier,
            "batch_reference": data.batch_reference,
            "personnel_id": current_user["id"],
            "personnel_name": current_user["name"],
            "created_at": datetime.utcnow()
        })
    
    if data.rejected_stock > 0:
        await db.stock_movements.insert_one({
            "movement_type": "rejected_stock",
            "product_id": data.product_id,
            "product_name": data.product_name,
            "quantity": -data.rejected_stock,
            "supplier": data.supplier,
            "batch_reference": data.batch_reference,
            "personnel_id": current_user["id"],
            "personnel_name": current_user["name"],
            "created_at": datetime.utcnow()
        })
    
    if data.spoilt_from_factory > 0:
        await db.stock_movements.insert_one({
            "movement_type": "spoilt_from_factory",
            "product_id": data.product_id,
            "product_name": data.product_name,
            "quantity": -data.spoilt_from_factory,
            "supplier": data.supplier,
            "batch_reference": data.batch_reference,
            "personnel_id": current_user["id"],
            "personnel_name": current_user["name"],
            "created_at": datetime.utcnow()
        })
    
    # Update global crates tracking
    if data.crates_received > 0 or data.crates_returned > 0:
        await db.crates_tracking.update_one(
            {"type": "global"},
            {
                "$inc": {
                    "crates_from_manufacturer": data.crates_received,
                    "crates_returned_to_manufacturer": data.crates_returned
                },
                "$set": {"updated_at": datetime.utcnow()}
            },
            upsert=True
        )
    
    # Get updated stock level
    stock = await db.stock.find_one({"product_id": data.product_id})
    
    return {
        "message": "Stock received successfully",
        "product_id": data.product_id,
        "product_name": data.product_name,
        "quantity_received": data.quantity,
        "damages_in_transit": data.damages_in_transit,
        "rejected_stock": data.rejected_stock,
        "spoilt_from_factory": data.spoilt_from_factory,
        "net_quantity_added": net_quantity,
        "crates_received": data.crates_received,
        "crates_returned": data.crates_returned,
        "new_total": stock.get("quantity", 0) if stock else net_quantity
    }

@api_router.post("/stock/adjustment")
async def adjust_stock(data: StockAdjustmentCreate, current_user: dict = Depends(get_current_user)):
    """Adjust stock for damages, spoilage, theft, etc. - Admin/Manager only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    # Get current stock
    stock = await db.stock.find_one({"product_id": data.product_id})
    current_qty = stock.get("quantity", 0) if stock else 0
    
    # Calculate new quantity
    new_qty = current_qty + data.adjustment_quantity
    if new_qty < 0:
        raise HTTPException(status_code=400, detail=f"Cannot adjust below zero. Current: {current_qty}, Adjustment: {data.adjustment_quantity}")
    
    # Update stock
    await db.stock.update_one(
        {"product_id": data.product_id},
        {
            "$set": {"quantity": new_qty, "product_name": data.product_name, "updated_at": datetime.utcnow()}
        },
        upsert=True
    )
    
    # Log the movement
    movement = {
        "movement_type": "adjustment",
        "product_id": data.product_id,
        "product_name": data.product_name,
        "quantity": data.adjustment_quantity,
        "reason": data.reason,
        "notes": data.notes,
        "previous_quantity": current_qty,
        "new_quantity": new_qty,
        "personnel_id": current_user["id"],
        "personnel_name": current_user["name"],
        "created_at": datetime.utcnow()
    }
    await db.stock_movements.insert_one(movement)
    
    return {
        "message": "Stock adjusted successfully",
        "product_id": data.product_id,
        "product_name": data.product_name,
        "adjustment": data.adjustment_quantity,
        "reason": data.reason,
        "previous_quantity": current_qty,
        "new_quantity": new_qty
    }

@api_router.post("/stock/take")
async def record_stock_take(data: StockTakeCreate, current_user: dict = Depends(get_current_user)):
    """Record stock take (physical count) - Admin/Manager only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    variance = data.physical_count - data.system_quantity
    
    # Update stock to physical count
    await db.stock.update_one(
        {"product_id": data.product_id},
        {
            "$set": {
                "quantity": data.physical_count,
                "product_name": data.product_name,
                "updated_at": datetime.utcnow(),
                "last_stock_take": datetime.utcnow()
            }
        },
        upsert=True
    )
    
    # Log the stock take
    stock_take_record = {
        "movement_type": "stock_take",
        "product_id": data.product_id,
        "product_name": data.product_name,
        "system_quantity": data.system_quantity,
        "physical_count": data.physical_count,
        "variance": variance,
        "variance_reason": data.variance_reason,
        "personnel_id": current_user["id"],
        "personnel_name": current_user["name"],
        "created_at": datetime.utcnow()
    }
    await db.stock_movements.insert_one(stock_take_record)
    
    return {
        "message": "Stock take recorded",
        "product_id": data.product_id,
        "product_name": data.product_name,
        "system_quantity": data.system_quantity,
        "physical_count": data.physical_count,
        "variance": variance,
        "variance_reason": data.variance_reason
    }

@api_router.get("/stock/movements")
async def get_stock_movements(
    product_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get stock movement history"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    start_date = datetime.utcnow() - timedelta(days=days)
    query = {"created_at": {"$gte": start_date}}
    
    if product_id:
        query["product_id"] = product_id
    if movement_type:
        query["movement_type"] = movement_type
    
    movements = await db.stock_movements.find(query).sort("created_at", -1).to_list(500)
    return [str_id(m) for m in movements]

@api_router.get("/stock/report")
async def get_stock_report(current_user: dict = Depends(get_current_user)):
    """Generate stock report with opening, received, sold, adjustments, closing, and variances"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    products = await db.products.find().to_list(500)
    report = []
    
    # Get date range for this week (Monday to now)
    today = datetime.utcnow()
    days_since_monday = today.weekday()
    week_start = today - timedelta(days=days_since_monday)
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_damages_transit = 0
    total_rejected = 0
    total_spoilt = 0
    total_stock_take_variance = 0
    
    for product in products:
        product_id = str(product["_id"])
        
        # Get movements for this product this week
        movements = await db.stock_movements.find({
            "product_id": product_id,
            "created_at": {"$gte": week_start}
        }).to_list(500)
        
        # Calculate totals by movement type
        received = sum(m.get("net_quantity", m.get("quantity", 0)) for m in movements if m.get("movement_type") == "receive")
        adjustments = sum(m.get("quantity", 0) for m in movements if m.get("movement_type") == "adjustment")
        damages_transit = sum(abs(m.get("quantity", 0)) for m in movements if m.get("movement_type") == "damages_in_transit")
        rejected = sum(abs(m.get("quantity", 0)) for m in movements if m.get("movement_type") == "rejected_stock")
        spoilt = sum(abs(m.get("quantity", 0)) for m in movements if m.get("movement_type") == "spoilt_from_factory")
        
        # Stock take variances
        stock_takes = [m for m in movements if m.get("movement_type") == "stock_take"]
        variance = sum(m.get("variance", 0) for m in stock_takes)
        
        total_damages_transit += damages_transit
        total_rejected += rejected
        total_spoilt += spoilt
        total_stock_take_variance += variance
        
        # Get sales from stock movements (now tracked there)
        sold = abs(sum(m.get("quantity", 0) for m in movements if m.get("movement_type") == "sale"))
        
        # If no sales in movements, check sales collection
        if sold == 0:
            sales = await db.sales.find({
                "created_at": {"$gte": week_start},
                "is_voided": {"$ne": True}
            }).to_list(2000)
            
            for sale in sales:
                for item in sale.get("items", []):
                    if item.get("product_id") == product_id:
                        sold += (item.get("quantity_delivered", 0) - item.get("quantity_returned", 0))
        
        # Current stock
        stock = await db.stock.find_one({"product_id": product_id})
        closing = stock.get("quantity", 0) if stock else 0
        
        # Calculate opening (closing - received - adjustments + sold + damages + rejected + spoilt)
        opening = closing - received - adjustments + sold + damages_transit + rejected + spoilt
        
        report.append({
            "product_id": product_id,
            "product_name": product["name"],
            "category": product["category"],
            "opening_stock": max(0, opening),
            "received": received,
            "sold": sold,
            "adjustments": adjustments,
            "damages_in_transit": damages_transit,
            "rejected_stock": rejected,
            "spoilt_from_factory": spoilt,
            "stock_take_variance": variance,
            "closing_stock": closing
        })
    
    # Get crates tracking
    crates = await db.crates_tracking.find_one({"type": "global"})
    
    return {
        "report_date": today.isoformat(),
        "week_start": week_start.isoformat(),
        "products": report,
        "summary": {
            "total_products": len(report),
            "total_received": sum(p["received"] for p in report),
            "total_sold": sum(p["sold"] for p in report),
            "total_adjustments": sum(p["adjustments"] for p in report),
            "total_damages_in_transit": total_damages_transit,
            "total_rejected_stock": total_rejected,
            "total_spoilt_from_factory": total_spoilt,
            "total_stock_take_variance": total_stock_take_variance
        },
        "crates": {
            "from_manufacturer": crates.get("crates_from_manufacturer", 0) if crates else 0,
            "returned_to_manufacturer": crates.get("crates_returned_to_manufacturer", 0) if crates else 0,
            "net_crates": (crates.get("crates_from_manufacturer", 0) - crates.get("crates_returned_to_manufacturer", 0)) if crates else 0
        }
    }

@api_router.post("/stock/seed")
async def seed_stock():
    """Seed initial stock levels"""
    products = await db.products.find().to_list(100)
    
    for product in products:
        product_id = str(product["_id"])
        # Set initial stock level
        await db.stock.update_one(
            {"product_id": product_id},
            {
                "$set": {
                    "product_id": product_id,
                    "product_name": product["name"],
                    "quantity": 100,  # Default starting stock
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )
    
    return {"message": f"Seeded stock for {len(products)} products"}

# ==================== PDF EXPORT ====================

@api_router.get("/reports/export/pdf")
async def export_report_pdf(
    date_str: Optional[str] = None,
    route_id: Optional[str] = None,
    driver_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export route report to PDF format with filters"""
    if not date_str:
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Build query based on filters
    query = {"date": date_str}
    if route_id:
        query["route_id"] = route_id
    if driver_id and is_admin_or_manager(current_user):
        query["driver_id"] = driver_id
    elif current_user["role"] == "driver":
        query["driver_id"] = current_user["id"]
    
    daily_routes = await db.daily_routes.find(query).to_list(100)
    
    # Get sales
    start = datetime.strptime(date_str, "%Y-%m-%d")
    end = start.replace(hour=23, minute=59, second=59)
    
    sales_query = {"created_at": {"$gte": start, "$lte": end}, "is_voided": {"$ne": True}}
    if route_id:
        sales_query["route_id"] = route_id
    if customer_id:
        sales_query["customer_id"] = customer_id
    if driver_id and is_admin_or_manager(current_user):
        sales_query["driver_id"] = driver_id
    elif current_user["role"] == "driver":
        sales_query["driver_id"] = current_user["id"]
    
    sales = await db.sales.find(sales_query).to_list(1000)
    
    # Create PDF - use landscape for more room
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), topMargin=30, bottomMargin=30, leftMargin=30, rightMargin=30)
    styles = getSampleStyleSheet()
    elements = []
    
    # Custom styles
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=22, spaceAfter=6, alignment=1, textColor=colors.HexColor('#3B82F6'))
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=12, spaceAfter=10, alignment=1, textColor=colors.HexColor('#64748B'))
    section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=14, spaceBefore=20, spaceAfter=10, textColor=colors.HexColor('#1E293B'))
    
    # Header
    elements.append(Paragraph("Mzansi FMCG Tracker", title_style))
    elements.append(Paragraph(f"Route Sales Report - {date_str}", subtitle_style))
    elements.append(Spacer(1, 15))
    
    # Summary section
    total_sales = len(sales)
    total_collected = sum(s.get('cash_collected', 0) for s in sales)
    total_expected = sum(s.get('total_amount', 0) for s in sales)
    total_shortage = sum(s.get('shortage_amount', 0) for s in sales)
    
    elements.append(Paragraph("Summary", section_style))
    summary_data = [
        ['Total Sales', 'Total Expected', 'Total Collected', 'Total Shortage', 'Collection Rate'],
        [str(total_sales), f'R {total_expected:.2f}', f'R {total_collected:.2f}', f'R {total_shortage:.2f}', f'{(total_collected/total_expected*100) if total_expected > 0 else 0:.1f}%']
    ]
    summary_table = Table(summary_data, colWidths=[130, 130, 130, 130, 130])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3B82F6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8FAFC')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
        ('FONTSIZE', (0, 1), (-1, -1), 12),
        ('TOPPADDING', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 15))
    
    # Sales Detail section
    if sales:
        elements.append(Paragraph("Sales Details", section_style))
        sales_data = [['Invoice Number', 'Customer', 'Driver', 'Items', 'Amount', 'Received', 'Shortage', 'Payment', 'Time']]
        for sale in sales[:50]:
            items_list = []
            for item in sale.get('items', []):
                net = item.get('quantity_delivered', 0) - item.get('quantity_returned', 0)
                items_list.append(f"{item.get('product_name', '?')} x{net}")
            
            payment_type = sale.get('payment_type', 'cash').upper()
            if payment_type == 'SPLIT':
                split_parts = []
                for sp in sale.get('split_payments', []):
                    split_parts.append(f"{sp.get('method','?').title()}: R{sp.get('amount',0):.0f}")
                payment_type = ', '.join(split_parts) if split_parts else 'SPLIT'
            
            sales_data.append([
                sale.get('invoice_number', 'N/A'),
                sale.get('customer_name', 'N/A'),
                sale.get('driver_name', 'N/A'),
                ', '.join(items_list),
                f"R {sale.get('total_amount', 0):.2f}",
                f"R {sale.get('cash_collected', 0):.2f}",
                f"R {sale.get('shortage_amount', 0):.2f}",
                payment_type,
                sale.get('created_at', datetime.utcnow()).strftime('%H:%M')
            ])
        
        sales_table = Table(sales_data, colWidths=[110, 85, 70, 130, 65, 65, 60, 100, 40])
        sales_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10B981')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (3, 1), (3, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(sales_table)
    
    # Route Summary section
    if daily_routes:
        elements.append(Spacer(1, 20))
        elements.append(Paragraph("Route Summary", section_style))
        route_data = [['Route', 'Driver', 'Vehicle', 'Status', 'Sales', 'Collected', 'Shortage']]
        for dr in daily_routes:
            route_data.append([
                dr.get('route_name', 'N/A')[:15],
                dr.get('driver_name', 'N/A')[:12],
                dr.get('vehicle_name', 'N/A')[:10],
                dr.get('status', 'N/A'),
                str(dr.get('sales_count', 0)),
                f"R {dr.get('total_collected', 0):.2f}",
                f"R {dr.get('total_shortage', 0):.2f}"
            ])
        
        route_table = Table(route_data, colWidths=[80, 70, 60, 55, 45, 75, 65])
        route_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F59E0B')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FEF3C7')]),
        ]))
        elements.append(route_table)
    
    # Footer
    elements.append(Spacer(1, 30))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=1, textColor=colors.HexColor('#94A3B8'))
    elements.append(Paragraph(f"Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC", footer_style))
    elements.append(Paragraph("Mzansi FMCG Tracker - Powered by Emergent", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=sales_report_{date_str}.pdf"}
    )

# ==================== EMAIL RECIPIENTS MANAGEMENT ====================

class EmailRecipient(BaseModel):
    email: str
    name: Optional[str] = None
    report_types: List[str] = []  # e.g., ['sales', 'stock', 'summary']
    is_active: bool = True

class EmailRecipientCreate(BaseModel):
    email: str
    name: Optional[str] = None
    report_types: List[str] = []

class EmailConfig(BaseModel):
    sender_email: str
    sender_password: str
    smtp_server: str = "mail.mzansipc.co.za"
    smtp_port: int = 465

@api_router.get("/admin/settings/email")
async def get_email_settings(current_user: dict = Depends(get_current_user)):
    """Get email configuration - Admin only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    config = await db.settings.find_one({"type": "email_config"})
    if not config:
        return {"configured": False}
    
    # Don't expose password
    return {
        "configured": True,
        "sender_email": config.get("sender_email"),
        "smtp_server": config.get("smtp_server"),
        "smtp_port": config.get("smtp_port")
    }

@api_router.post("/admin/settings/email")
async def save_email_settings(config: EmailConfig, current_user: dict = Depends(get_current_user)):
    """Save email configuration - Admin only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.settings.update_one(
        {"type": "email_config"},
        {"$set": {
            "type": "email_config",
            "sender_email": config.sender_email,
            "sender_password": config.sender_password,
            "smtp_server": config.smtp_server,
            "smtp_port": config.smtp_port,
            "updated_at": datetime.utcnow(),
            "updated_by": current_user["id"]
        }},
        upsert=True
    )
    
    return {"message": "Email configuration saved successfully"}

@api_router.get("/admin/email-recipients")
async def get_email_recipients(current_user: dict = Depends(get_current_user)):
    """Get all email recipients - Admin only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    recipients = await db.email_recipients.find().to_list(100)
    return [str_id(r) for r in recipients]

@api_router.post("/admin/email-recipients")
async def add_email_recipient(data: EmailRecipientCreate, current_user: dict = Depends(get_current_user)):
    """Add a new email recipient - Admin only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if email already exists
    existing = await db.email_recipients.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email recipient already exists")
    
    recipient = {
        "email": data.email,
        "name": data.name,
        "report_types": data.report_types,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "created_by": current_user["id"]
    }
    
    result = await db.email_recipients.insert_one(recipient)
    recipient["_id"] = result.inserted_id
    
    return str_id(recipient)

@api_router.put("/admin/email-recipients/{recipient_id}")
async def update_email_recipient(recipient_id: str, data: EmailRecipientCreate, current_user: dict = Depends(get_current_user)):
    """Update an email recipient - Admin only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.email_recipients.update_one(
        {"_id": ObjectId(recipient_id)},
        {"$set": {
            "email": data.email,
            "name": data.name,
            "report_types": data.report_types,
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    return {"message": "Recipient updated"}

@api_router.delete("/admin/email-recipients/{recipient_id}")
async def delete_email_recipient(recipient_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an email recipient - Admin only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.email_recipients.delete_one({"_id": ObjectId(recipient_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    return {"message": "Recipient deleted"}

@api_router.post("/admin/email-recipients/{recipient_id}/toggle")
async def toggle_email_recipient(recipient_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle email recipient active status - Admin only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    recipient = await db.email_recipients.find_one({"_id": ObjectId(recipient_id)})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    new_status = not recipient.get("is_active", True)
    await db.email_recipients.update_one(
        {"_id": ObjectId(recipient_id)},
        {"$set": {"is_active": new_status}}
    )
    
    return {"message": f"Recipient {'activated' if new_status else 'deactivated'}", "is_active": new_status}

# ==================== AUTOMATED REPORTS ====================

@api_router.post("/admin/send-report")
async def send_report_email(
    report_type: str,  # 'sales', 'stock', 'summary'
    date_str: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Send report to configured email recipients - Admin only"""
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not date_str:
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Get email config
    email_config = await db.settings.find_one({"type": "email_config"})
    if not email_config:
        raise HTTPException(status_code=400, detail="Email not configured. Please set up email settings first.")
    
    # Get recipients for this report type
    recipients = await db.email_recipients.find({
        "is_active": True,
        "report_types": report_type
    }).to_list(50)
    
    if not recipients:
        raise HTTPException(status_code=400, detail=f"No active recipients configured for {report_type} reports")
    
    # Generate report based on type
    if report_type == 'stock':
        # Generate stock report
        report_data = await get_stock_report(current_user)
        subject = f"Stock Report - {date_str}"
        body = f"""
        <h2>Weekly Stock Report</h2>
        <p><strong>Report Date:</strong> {date_str}</p>
        <p><strong>Week Start:</strong> {report_data.get('week_start', 'N/A')}</p>
        <h3>Summary</h3>
        <ul>
            <li>Total Products: {report_data['summary']['total_products']}</li>
            <li>Total Received: {report_data['summary']['total_received']}</li>
            <li>Total Sold: {report_data['summary']['total_sold']}</li>
            <li>Total Adjustments: {report_data['summary']['total_adjustments']}</li>
        </ul>
        <h3>Product Details</h3>
        <table border="1" style="border-collapse: collapse;">
            <tr style="background-color: #3B82F6; color: white;">
                <th>Product</th><th>Opening</th><th>Received</th><th>Sold</th><th>Adjustments</th><th>Closing</th>
            </tr>
        """
        for p in report_data.get('products', []):
            body += f"""
            <tr>
                <td>{p['product_name']}</td>
                <td>{p['opening_stock']}</td>
                <td>{p['received']}</td>
                <td>{p['sold']}</td>
                <td>{p['adjustments']}</td>
                <td>{p['closing_stock']}</td>
            </tr>
            """
        body += "</table>"
    else:
        # Generate sales report
        start = datetime.strptime(date_str, "%Y-%m-%d")
        end = start.replace(hour=23, minute=59, second=59)
        sales = await db.sales.find({
            "created_at": {"$gte": start, "$lte": end},
            "is_voided": {"$ne": True}
        }).to_list(1000)
        
        total_expected = sum(s.get('total_amount', 0) for s in sales)
        total_collected = sum(s.get('cash_collected', 0) for s in sales)
        total_shortage = sum(s.get('shortage_amount', 0) for s in sales)
        
        subject = f"Sales Report - {date_str}"
        body = f"""
        <h2>Daily Sales Report</h2>
        <p><strong>Date:</strong> {date_str}</p>
        <h3>Summary</h3>
        <ul>
            <li><strong>Total Sales:</strong> {len(sales)}</li>
            <li><strong>Total Expected:</strong> R {total_expected:.2f}</li>
            <li><strong>Total Collected:</strong> R {total_collected:.2f}</li>
            <li><strong>Total Shortage:</strong> R {total_shortage:.2f}</li>
        </ul>
        """
    
    # Send emails
    sent_count = 0
    failed = []
    
    for recipient in recipients:
        try:
            msg = MIMEMultipart('alternative')
            msg['From'] = email_config.get('sender_email')
            msg['To'] = recipient['email']
            msg['Subject'] = subject
            
            msg.attach(MIMEText(body, 'html'))
            
            smtp_port = email_config.get('smtp_port', 465)
            smtp_server = email_config.get('smtp_server', 'mail.mzansipc.co.za')
            
            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_server, smtp_port)
            else:
                server = smtplib.SMTP(smtp_server, smtp_port)
                server.starttls()
            
            server.login(email_config.get('sender_email'), email_config.get('sender_password'))
            server.send_message(msg)
            server.quit()
            sent_count += 1
        except Exception as e:
            failed.append({"email": recipient['email'], "error": str(e)})
    
    return {
        "message": f"Report sent to {sent_count} recipients",
        "sent": sent_count,
        "failed": failed
    }

# ==================== CLEAR DATA ====================

@api_router.post("/admin/clear-data")
async def clear_all_data(current_user: dict = Depends(get_current_user)):
    """Clear all practice/demo data - Admin only"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Clear transactional data only (keep users, products, routes, customers)
    await db.sales.delete_many({})
    await db.daily_routes.delete_many({})
    await db.stock_movements.delete_many({})
    await db.stock.delete_many({})
    await db.crates_tracking.delete_many({})
    await db.email_logs.delete_many({})
    
    return {
        "message": "All practice data cleared successfully",
        "cleared": ["sales", "daily_routes", "stock_movements", "stock", "crates_tracking", "email_logs"]
    }

# ==================== ORDERING SYSTEM ====================

# --- Order Models ---
class CustomerRegister(BaseModel):
    business_name: str
    contact_person: str
    phone: str
    pin: str
    delivery_address: Optional[str] = None
    location: Optional[str] = None
    company_id: str  # which distributor they order from
    route_id: str    # which route/area they fall under

class DeliverySchedule(BaseModel):
    delivery_days: List[str] = []  # e.g. ["Monday", "Thursday"]
    cut_off_hours_before: int = 16  # hours before delivery day to cut off orders
    cut_off_time: str = "16:00"    # display time

class OrderItemCreate(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_price: float

class OrderCreate(BaseModel):
    company_id: str
    items: List[OrderItemCreate]
    notes: Optional[str] = None

class OrderAdjustItem(BaseModel):
    product_id: str
    product_name: str
    original_quantity: int
    adjusted_quantity: int
    unit_price: float
    reason: Optional[str] = None

class OrderAdjust(BaseModel):
    items: List[OrderAdjustItem]
    adjustment_reason: Optional[str] = None

ORDER_STATUSES = ["pending", "confirmed", "adjusted", "packed", "out_for_delivery", "delivered", "cancelled"]

DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

def generate_order_number(company_name: str) -> str:
    """Generate unique order number: COMPCODE-DATE-SEQ"""
    code = ''.join(c for c in company_name.upper() if c.isalpha())[:4]
    if len(code) < 3:
        code = code.ljust(3, 'X')
    date_str = datetime.utcnow().strftime("%Y%m%d")
    import random
    seq = random.randint(1, 999)
    return f"{code}-{date_str}-{seq:03d}"

def get_next_delivery_day(delivery_days: List[str], cut_off_hours: int = 16) -> Optional[dict]:
    """Calculate the next delivery day and whether ordering is still open"""
    if not delivery_days:
        return None
    
    now = datetime.utcnow()
    today_name = now.strftime("%A")
    
    # Build ordered list of delivery days from today
    day_indices = {d: i for i, d in enumerate(DAYS_OF_WEEK)}
    today_idx = day_indices.get(today_name, 0)
    
    for offset in range(0, 8):
        check_idx = (today_idx + offset) % 7
        check_day = DAYS_OF_WEEK[check_idx]
        
        if check_day in delivery_days:
            delivery_date = now + timedelta(days=offset)
            cut_off_date = delivery_date - timedelta(hours=cut_off_hours)
            
            if now < cut_off_date:
                return {
                    "delivery_day": check_day,
                    "delivery_date": delivery_date.strftime("%Y-%m-%d"),
                    "cut_off_time": cut_off_date.isoformat(),
                    "is_open": True,
                    "hours_until_cutoff": max(0, (cut_off_date - now).total_seconds() / 3600)
                }
    
    # All cut-offs passed, find next week's first delivery
    for offset in range(1, 8):
        check_idx = (today_idx + offset) % 7
        check_day = DAYS_OF_WEEK[check_idx]
        if check_day in delivery_days:
            delivery_date = now + timedelta(days=offset + 7)
            cut_off_date = delivery_date - timedelta(hours=cut_off_hours)
            return {
                "delivery_day": check_day,
                "delivery_date": delivery_date.strftime("%Y-%m-%d"),
                "cut_off_time": cut_off_date.isoformat(),
                "is_open": now < cut_off_date,
                "hours_until_cutoff": max(0, (cut_off_date - now).total_seconds() / 3600)
            }
    
    return None

# --- Customer Registration ---
@api_router.post("/auth/register-customer")
async def register_customer(data: CustomerRegister):
    """Register a new customer user linked to a distributor company and route"""
    existing = await db.users.find_one({"phone": data.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    # Verify company exists
    company = await db.companies.find_one({"_id": ObjectId(data.company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Verify route exists
    route = await db.routes.find_one({"_id": ObjectId(data.route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    user_doc = {
        "name": data.contact_person,
        "phone": data.phone,
        "pin_hash": hash_pin(data.pin),
        "role": "customer",
        "is_active": True,
        "company_id": data.company_id,
        "customer_profile": {
            "business_name": data.business_name,
            "contact_person": data.contact_person,
            "delivery_address": data.delivery_address,
            "location": data.location,
            "route_id": data.route_id,
            "route_name": route.get("name", ""),
        },
        "created_at": datetime.utcnow()
    }
    result = await db.users.insert_one(user_doc)
    
    # Also create a customer record for the distribution system
    customer_doc = {
        "name": data.business_name,
        "phone": data.phone,
        "address": data.delivery_address or "",
        "route_id": data.route_id,
        "route_name": route.get("name", ""),
        "is_active": True,
        "balance": 0.0,
        "company_id": data.company_id,
        "user_id": str(result.inserted_id),
        "created_by": str(result.inserted_id),
        "created_at": datetime.utcnow()
    }
    await db.customers.insert_one(customer_doc)
    
    return {
        "message": "Customer registered successfully",
        "user_id": str(result.inserted_id),
        "company_name": company.get("name"),
        "route_name": route.get("name", ""),
    }

# --- Public: List Companies for customer registration ---
@api_router.get("/companies/list")
async def list_companies():
    """Public endpoint - list all companies for customer registration"""
    companies = await db.companies.find({}).to_list(100)
    return [{"id": str(c["_id"]), "name": c["name"], "phone": c.get("phone", "")} for c in companies]

# --- Public: List routes for a company ---
@api_router.get("/companies/{company_id}/routes")
async def list_company_routes(company_id: str):
    """Public endpoint - list routes for a company with delivery schedules"""
    routes = await db.routes.find({"company_id": company_id}).to_list(50)
    result = []
    for r in routes:
        schedule = r.get("delivery_schedule", {})
        result.append({
            "id": str(r["_id"]),
            "name": r.get("name", ""),
            "description": r.get("description", ""),
            "delivery_days": schedule.get("delivery_days", []),
            "cut_off_time": schedule.get("cut_off_time", "16:00"),
        })
    return result

# --- Public: List products for a company ---
@api_router.get("/companies/{company_id}/products")
async def list_company_products(company_id: str):
    """Public endpoint - list products for a company (for customer browsing)"""
    products = await db.products.find({"company_id": company_id}).to_list(200)
    return [str_id(p) for p in products]

# --- Route Delivery Schedule ---
@api_router.put("/routes/{route_id}/schedule")
async def update_route_schedule(route_id: str, schedule: DeliverySchedule, current_user: dict = Depends(get_current_user)):
    if not is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.routes.update_one(
        {"_id": ObjectId(route_id)},
        {"$set": {"delivery_schedule": schedule.dict()}}
    )
    return {"message": "Delivery schedule updated"}

@api_router.get("/routes/{route_id}/schedule")
async def get_route_schedule(route_id: str, current_user: dict = Depends(get_current_user)):
    route = await db.routes.find_one({"_id": ObjectId(route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    schedule = route.get("delivery_schedule", {"delivery_days": [], "cut_off_hours_before": 16, "cut_off_time": "16:00"})
    delivery_info = get_next_delivery_day(
        schedule.get("delivery_days", []),
        schedule.get("cut_off_hours_before", 16)
    )
    
    return {
        "route_id": route_id,
        "route_name": route.get("name", ""),
        "schedule": schedule,
        "next_delivery": delivery_info
    }

# --- Customer: Get products from their distributor ---
@api_router.get("/customer/products")
async def get_customer_products(current_user: dict = Depends(get_current_user)):
    """Customer sees products from their assigned distributor"""
    if not is_customer(current_user):
        raise HTTPException(status_code=403, detail="Customer access only")
    
    company_id = current_user.get("company_id")
    if not company_id:
        return []
    
    products = await db.products.find({"company_id": company_id}).to_list(200)
    return [str_id(p) for p in products]

# --- Customer: Get delivery info ---
@api_router.get("/customer/delivery-info")
async def get_customer_delivery_info(current_user: dict = Depends(get_current_user)):
    """Get the customer's next delivery day and cut-off info"""
    if not is_customer(current_user):
        raise HTTPException(status_code=403, detail="Customer access only")
    
    profile = current_user.get("customer_profile", {})
    route_id = profile.get("route_id")
    
    if not route_id:
        return {"message": "No route assigned", "next_delivery": None}
    
    route = await db.routes.find_one({"_id": ObjectId(route_id)})
    if not route:
        return {"message": "Route not found", "next_delivery": None}
    
    schedule = route.get("delivery_schedule", {"delivery_days": [], "cut_off_hours_before": 16})
    delivery_info = get_next_delivery_day(
        schedule.get("delivery_days", []),
        schedule.get("cut_off_hours_before", 16)
    )
    
    company = await db.companies.find_one({"_id": ObjectId(current_user.get("company_id", "000000000000000000000000"))})
    
    return {
        "company_name": company.get("name", "") if company else "",
        "route_name": route.get("name", ""),
        "schedule": schedule,
        "next_delivery": delivery_info,
        "profile": profile,
    }

# --- Place Order ---
@api_router.post("/orders")
async def create_order(order: OrderCreate, current_user: dict = Depends(get_current_user)):
    """Customer places an order"""
    if not is_customer(current_user):
        raise HTTPException(status_code=403, detail="Customer access only")
    
    # Get customer profile
    profile = current_user.get("customer_profile", {})
    route_id = profile.get("route_id")
    
    # Verify company
    company = await db.companies.find_one({"_id": ObjectId(order.company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Check delivery schedule and cut-off
    if route_id:
        route = await db.routes.find_one({"_id": ObjectId(route_id)})
        schedule = route.get("delivery_schedule", {}) if route else {}
        delivery_days = schedule.get("delivery_days", [])
        cut_off_hours = schedule.get("cut_off_hours_before", 16)
        
        delivery_info = get_next_delivery_day(delivery_days, cut_off_hours)
        
        if delivery_info and not delivery_info.get("is_open", True):
            return {"error": True, "message": f"Orders for the next delivery are closed. Next delivery: {delivery_info.get('delivery_day', 'TBD')}"}
    else:
        delivery_info = None
    
    # Check for duplicate orders (same customer, same day)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    existing_order = await db.orders.find_one({
        "customer_id": current_user["id"],
        "company_id": order.company_id,
        "created_at": {"$gte": today_start},
        "status": {"$nin": ["cancelled"]}
    })
    if existing_order:
        raise HTTPException(status_code=400, detail="You already have an active order for today. Please wait or cancel the existing order.")
    
    # Generate order number
    order_number = generate_order_number(company.get("name", "ORD"))
    # Ensure unique
    while await db.orders.find_one({"order_number": order_number}):
        order_number = generate_order_number(company.get("name", "ORD"))
    
    total_amount = sum(item.quantity * item.unit_price for item in order.items)
    
    order_doc = {
        "order_number": order_number,
        "company_id": order.company_id,
        "customer_id": current_user["id"],
        "customer_name": profile.get("business_name", current_user.get("name", "")),
        "customer_phone": current_user.get("phone", ""),
        "route_id": route_id,
        "route_name": profile.get("route_name", ""),
        "items": [item.dict() for item in order.items],
        "original_items": [item.dict() for item in order.items],
        "total_amount": total_amount,
        "status": "pending",
        "delivery_day": delivery_info.get("delivery_day", "") if delivery_info else "",
        "delivery_date": delivery_info.get("delivery_date", "") if delivery_info else "",
        "notes": order.notes,
        "adjustments": [],
        "status_history": [{"status": "pending", "timestamp": datetime.utcnow().isoformat(), "by": current_user["id"]}],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    
    result = await db.orders.insert_one(order_doc)
    order_doc["_id"] = result.inserted_id
    
    return str_id(order_doc)

# --- Get Orders ---
@api_router.get("/orders")
async def get_orders(
    status: Optional[str] = None,
    route_id: Optional[str] = None,
    date_str: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get orders - filtered by role"""
    query = {}
    
    if is_customer(current_user):
        query["customer_id"] = current_user["id"]
    else:
        # Distributor staff see their company's orders
        cf = get_company_filter(current_user)
        query.update(cf)
        
        # Drivers only see their route's orders
        if current_user.get("role") == "driver":
            active_route = await db.daily_routes.find_one({
                "driver_id": current_user["id"],
                "status": "active"
            })
            if active_route:
                query["route_id"] = active_route.get("route_id")
            else:
                return []
    
    if status:
        query["status"] = status
    if route_id:
        query["route_id"] = route_id
    if date_str:
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            query["created_at"] = {
                "$gte": date_obj,
                "$lt": date_obj + timedelta(days=1)
            }
        except ValueError:
            pass
    
    orders = await db.orders.find(query).sort("created_at", -1).to_list(500)
    return [str_id(o) for o in orders]

# --- Get Single Order ---
@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Security: customers can only see their own orders
    if is_customer(current_user) and order.get("customer_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return str_id(order)

class OrderStatusUpdate(BaseModel):
    status: str

# --- Update Order Status ---
@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusUpdate, current_user: dict = Depends(get_current_user)):
    status = body.status
    if is_customer(current_user):
        # Customers can only cancel pending orders
        if status != "cancelled":
            raise HTTPException(status_code=403, detail="Customers can only cancel orders")
    
    if status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {ORDER_STATUSES}")
    
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if is_customer(current_user) and order.get("customer_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if is_customer(current_user) and order.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending orders")
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$set": {"status": status, "updated_at": datetime.utcnow()},
            "$push": {"status_history": {"status": status, "timestamp": datetime.utcnow().isoformat(), "by": current_user["id"]}}
        }
    )
    
    return {"message": f"Order status updated to {status}"}

# --- Adjust Order (Distributor) ---
@api_router.put("/orders/{order_id}/adjust")
async def adjust_order(order_id: str, adjustment: OrderAdjust, current_user: dict = Depends(get_current_user)):
    if is_customer(current_user):
        raise HTTPException(status_code=403, detail="Only distributors can adjust orders")
    
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("status") in ["delivered", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot adjust delivered or cancelled orders")
    
    # Update items
    new_items = []
    for adj_item in adjustment.items:
        new_items.append({
            "product_id": adj_item.product_id,
            "product_name": adj_item.product_name,
            "quantity": adj_item.adjusted_quantity,
            "unit_price": adj_item.unit_price,
        })
    
    new_total = sum(i["quantity"] * i["unit_price"] for i in new_items)
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$set": {
                "items": new_items,
                "total_amount": new_total,
                "status": "adjusted",
                "updated_at": datetime.utcnow(),
            },
            "$push": {
                "adjustments": {
                    "adjusted_by": current_user["id"],
                    "adjusted_by_name": current_user.get("name", ""),
                    "reason": adjustment.adjustment_reason,
                    "items": [i.dict() for i in adjustment.items],
                    "timestamp": datetime.utcnow().isoformat()
                },
                "status_history": {"status": "adjusted", "timestamp": datetime.utcnow().isoformat(), "by": current_user["id"]}
            }
        }
    )
    
    return {"message": "Order adjusted successfully", "new_total": new_total}

# --- Order Dashboard for Distributor ---
@api_router.get("/orders/dashboard/summary")
async def get_order_dashboard(current_user: dict = Depends(get_current_user)):
    if is_customer(current_user):
        raise HTTPException(status_code=403, detail="Distributor access only")
    
    query = get_company_filter(current_user)
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    query["created_at"] = {"$gte": today}
    
    orders = await db.orders.find(query).to_list(1000)
    
    summary = {
        "total_orders": len(orders),
        "pending": len([o for o in orders if o.get("status") == "pending"]),
        "confirmed": len([o for o in orders if o.get("status") == "confirmed"]),
        "adjusted": len([o for o in orders if o.get("status") == "adjusted"]),
        "packed": len([o for o in orders if o.get("status") == "packed"]),
        "out_for_delivery": len([o for o in orders if o.get("status") == "out_for_delivery"]),
        "delivered": len([o for o in orders if o.get("status") == "delivered"]),
        "cancelled": len([o for o in orders if o.get("status") == "cancelled"]),
        "total_value": sum(o.get("total_amount", 0) for o in orders if o.get("status") not in ["cancelled"]),
    }
    
    # Route breakdown
    route_orders = {}
    for o in orders:
        rn = o.get("route_name", "Unassigned")
        if rn not in route_orders:
            route_orders[rn] = {"count": 0, "value": 0}
        route_orders[rn]["count"] += 1
        route_orders[rn]["value"] += o.get("total_amount", 0)
    
    summary["by_route"] = route_orders
    return summary

# --- Route Packing Summary ---
@api_router.get("/orders/packing/{route_id}")
async def get_route_packing_summary(route_id: str, current_user: dict = Depends(get_current_user)):
    if is_customer(current_user):
        raise HTTPException(status_code=403, detail="Distributor access only")
    
    query = get_company_filter(current_user)
    query["route_id"] = route_id
    query["status"] = {"$in": ["pending", "confirmed", "adjusted"]}
    
    orders = await db.orders.find(query).to_list(500)
    
    product_totals = {}
    for order in orders:
        for item in order.get("items", []):
            pid = item.get("product_id", "")
            if pid not in product_totals:
                product_totals[pid] = {"product_name": item.get("product_name", ""), "total_quantity": 0, "orders_count": 0}
            product_totals[pid]["total_quantity"] += item.get("quantity", 0)
            product_totals[pid]["orders_count"] += 1
    
    route = await db.routes.find_one({"_id": ObjectId(route_id)})
    
    return {
        "route_id": route_id,
        "route_name": route.get("name", "") if route else "",
        "total_orders": len(orders),
        "products": list(product_totals.values()),
    }

# ==================== SUPPORT INFO ====================

@api_router.get("/support-info")
async def get_support_info():
    """Get app support and contact information"""
    return {
        "company": "Mzafri Distribution",
        "website": "www.mzafri.co.za",
        "support_email": "supportapp@mzafri.co.za",
        "contact_number": "+27 71 876 5600",
        "app_name": "Mzansi FMCG Tracker",
        "version": "1.0.0"
    }

# ==================== HEALTH CHECK ====================

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
