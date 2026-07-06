from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import json
import math
import os
from datetime import date
from typing import List
from fastapi.middleware.cors import CORSMiddleware
import uuid

app = FastAPI(
    title="BMI & Health Record Tracker API",
    description="Backend API for storing and retrieving BMI records",
    version="1.0"
)

# Enable browser cross-origin communications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://stayfitstayhappy.netlify.app/"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"]
)

RECORDS_FILE = "health_records.json"
USERS_FILE = "users.json"

# ------------------------------------
# JSON Storage Helpers
# ------------------------------------
def load_records():
    if not os.path.exists(RECORDS_FILE):
        return []
    try:
        with open(RECORDS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []

def save_records(records):
    with open(RECORDS_FILE, "w") as f:
        json.dump(records, f, indent=4)

def load_users():
    if not os.path.exists(USERS_FILE):
        return []
    try:
        with open(USERS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []

def save_users(users):
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=4)


# ------------------------------------
# Core BMI Calculations
# ------------------------------------
def calculate_bmi(weight, height_cm):
    height_m = height_cm / 100
    return round(weight / math.pow(height_m, 2), 2)

def classify_bmi(bmi):
    if bmi < 18.5:
        return "Underweight"
    elif bmi < 25:
        return "Normal Weight"
    elif bmi < 30:
        return "Overweight"
    else:
        return "Obese"


# ------------------------------------
# Pydantic Structural Models
# ------------------------------------
class HealthInput(BaseModel):
    user_id: str
    name: str = Field(..., min_length=1)
    weight_kg: float = Field(..., gt=0)
    height_cm: float = Field(..., gt=0)
    roll_no: int = Field(..., gt=0)

class HealthRecord(BaseModel):
    user_id: str
    roll_no: int
    name: str
    weight_kg: float
    height_cm: float
    bmi: float
    category: str
    date: str

class UserRegister(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: str
    password: str


# ------------------------------------
# REST API Architecture Endpoints
# ------------------------------------
@app.get("/")
def home():
    return {"message": "BMI & Health Record Tracker API", "status": "Running"}

@app.post("/register")
def register_user(data: UserRegister):
    users = load_users()
    if any(u.get("email", "").lower() == data.email.lower() for u in users):
        raise HTTPException(status_code=400, detail="Email is already registered.")
        
    new_user = {
        "user_id": str(uuid.uuid4()),
        "email": data.email.lower(),
        "password": data.password
    }
    users.append(new_user)
    save_users(users)
    return {"message": "Registration successful", "user_id": new_user["user_id"]}

@app.post("/login")
def login_user(data: UserLogin):
    users = load_users()
    user = next((u for u in users if u.get("email", "").lower() == data.email.lower() and u.get("password") == data.password), None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {"message": "Login successful", "user_id": user["user_id"]}

@app.post("/records", response_model=HealthRecord)
def add_record(data: HealthInput):
    bmi = calculate_bmi(data.weight_kg, data.height_cm)
    category = classify_bmi(bmi)

    record = {
        "user_id": data.user_id,
        "roll_no": data.roll_no,
        "name": data.name,
        "weight_kg": data.weight_kg,
        "height_cm": data.height_cm,
        "bmi": bmi,
        "category": category,
        "date": str(date.today())
    }
    records = load_records()
    records.append(record)
    save_records(records)
    return record

@app.get("/records", response_model=List[HealthRecord])
def get_all_records(user_id: str = None):
    raw_records = load_records()
    # Filter records, ensuring older legacy records missing 'user_id' don't break the load sequence
    valid_records = [r for r in raw_records if "user_id" in r and "roll_no" in r]
    if user_id:
        return [r for r in valid_records if r.get("user_id") == user_id]
    return valid_records

@app.get("/records/{date_str}", response_model=List[HealthRecord])
def search_record(date_str: str, user_id: str = None):
    raw_records = load_records()
    valid_records = [r for r in raw_records if "user_id" in r and "roll_no" in r]
    
    result = [
        r for r in valid_records
        if r["date"] == date_str and (user_id is None or r.get("user_id") == user_id)
    ]
    if not result:
        raise HTTPException(status_code=404, detail="Record not found")
    return result
