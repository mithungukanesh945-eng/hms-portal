from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
from models import db, User, Patient, Doctor, Appointment, Billing, Prescription, FoodOrder, NurseCall
from datetime import datetime, date
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'mysql+pymysql://root:@localhost/hospital_db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'super-secret-key' # Change in production

@app.route('/')
def health_check():
    return jsonify({"message": "Hospital Management API is running"}), 200

# Initialize DB
db.init_app(app)

def init_db():
    """Create all tables in Supabase if they don't exist."""
    with app.app_context():
        db.create_all()
        # Optional: seed initial data here if needed

jwt = JWTManager(app)
bcrypt = Bcrypt(app)

# AI Routing Logic
SYMPTOM_MAP = {
    'fever': 'General Physician',
    'cough': 'General Physician',
    'cold': 'General Physician',
    'flu': 'General Physician',
    'chest pain': 'Cardiologist',
    'heart': 'Cardiologist',
    'breath': 'Cardiologist',
    'skin': 'Dermatologist',
    'rash': 'Dermatologist',
    'acne': 'Dermatologist',
    'bone': 'Orthopedic',
    'fracture': 'Orthopedic',
    'joint': 'Orthopedic',
    'headache': 'Neurologist',
    'brain': 'Neurologist',
    'nerve': 'Neurologist',
    'eye': 'Ophthalmologist',
    'vision': 'Ophthalmologist'
}

def get_specialist(symptoms):
    if not symptoms:
        return 'General Physician'
    symptoms = symptoms.lower()
    for key, spec in SYMPTOM_MAP.items():
        if key in symptoms:
            return spec
    return 'General Physician'

def auto_assign_doctor(specialization):
    doctors = Doctor.query.filter_by(specialization=specialization, status='Available').all()
    if not doctors:
        # Fallback to any General Physician if specialist not available
        doctors = Doctor.query.filter_by(specialization='General Physician', status='Available').all()
    
    if not doctors:
        return None
    
    # Simple logic: Pick the doctor with least appointments today
    today = date.today()
    best_doc = None
    min_appts = float('inf')
    
    for doc in doctors:
        count = Appointment.query.filter_by(doctor_id=doc.id, date=today).count()
        if count < min_appts:
            min_appts = count
            best_doc = doc
            
    return best_doc

# Auth Routes
@app.route('/login', methods=['POST'])
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    if not data.get('username') or not data.get('password'):
        return jsonify({"message": "Please provide both username and password"}), 400
        
    user = User.query.filter_by(username=data['username']).first()
    
    if user and bcrypt.check_password_hash(user.password_hash, data['password']):
        access_token = create_access_token(identity={"id": user.id, "role": user.role, "name": user.full_name})
        return jsonify({
            "token": access_token,
            "role": user.role,
            "username": user.full_name,
            "user_id": user.id
        }), 200
    
    return jsonify({"message": "Invalid username or password"}), 401

@app.route('/register', methods=['POST'])
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    
    # Validation
    if not data.get('username') or not data.get('password') or not data.get('full_name'):
        return jsonify({"message": "Missing required fields"}), 400
        
    if User.query.filter_by(username=data['username']).first():
        return jsonify({"message": "Username or Email already exists"}), 400
    
    # Password Hashing
    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    
    # Create User
    new_user = User(
        username=data['username'],
        password_hash=hashed_password,
        role=data.get('role', 'Patient'),
        full_name=data['full_name'],
        email=data.get('email', data['username'] if '@' in data['username'] else None),
        phone=data.get('phone')
    )
    db.session.add(new_user)
    db.session.commit()
    
    # If role is patient, apply Smart Logic
    if new_user.role == 'Patient':
        symptoms = data.get('symptoms', '')
        # AI Logic: Assign Specialist based on symptoms
        specialization = get_specialist(symptoms)
        assigned_doc = auto_assign_doctor(specialization)
        
        new_pt = Patient(
            user_id=new_user.id,
            fname=data['full_name'].split()[0],
            lname=data['full_name'].split()[-1] if ' ' in data['full_name'] else '',
            age=data.get('age'),
            gender=data.get('gender'),
            phone=data.get('phone'),
            email=data.get('email'),
            symptoms=symptoms,
            disease=specialization,
            patient_id=f"PT-{new_user.id + 1000}"
        )
        db.session.add(new_pt)
        db.session.commit()
        
        # Auto-create Appointment if doctor found
        if assigned_doc:
            new_apt = Appointment(
                patient_id=new_pt.id,
                doctor_id=assigned_doc.id,
                date=date.today(),
                time="Immediately",
                status='Pending',
                notes=f"AI System Triage: {specialization} assigned based on symptoms: {symptoms}"
            )
            db.session.add(new_apt)
            db.session.commit()
            
    return jsonify({
        "message": "Account created successfully",
        "role": new_user.role,
        "name": new_user.full_name
    }), 201

# Dashboard Stats
@app.route('/api/dashboard/stats', methods=['GET'])
@jwt_required()
def get_stats():
    stats = {
        "total_patients": Patient.query.count(),
        "total_appointments": Appointment.query.count(),
        "total_doctors": Doctor.query.count(),
        "revenue": float(db.session.query(db.func.sum(Billing.amount)).scalar() or 0),
        "available_beds": 10, # Mock for now or count from Bed table
    }
    return jsonify(stats), 200

# Patient Registration with Smarter Logic
@app.route('/api/patients', methods=['POST'])
@jwt_required()
def create_patient():
    data = request.json
    # AI Routing
    specialization = get_specialist(data.get('symptoms', ''))
    assigned_doc = auto_assign_doctor(specialization)
    
    new_pt = Patient(
        fname=data['fname'],
        lname=data['lname'],
        age=data.get('age'),
        gender=data.get('gender'),
        phone=data.get('phone'),
        email=data.get('email'),
        symptoms=data.get('symptoms'),
        disease=specialization, # Initial diagnosis based on routing
        patient_id=f"PT-{Patient.query.count() + 1001}"
    )
    db.session.add(new_pt)
    db.session.commit()
    
    # Create auto-appointment if doc assigned
    if assigned_doc:
        new_apt = Appointment(
            patient_id=new_pt.id,
            doctor_id=assigned_doc.id,
            date=date.today(),
            time="ASAP",
            status='Pending',
            notes=f"AI Assigned: {specialization}"
        )
        db.session.add(new_apt)
        db.session.commit()
        
    return jsonify({
        "message": "Patient registered and doctor assigned",
        "patient": {"id": new_pt.id, "patient_id": new_pt.patient_id},
        "assigned_doctor": assigned_doc.name if assigned_doc else "None Available"
    }), 201

@app.route('/api/patients', methods=['GET'])
@jwt_required()
def get_all_patients():
    name_query = request.args.get('name')
    if name_query:
        patients = Patient.query.filter(Patient.fname.ilike(f"%{name_query}%") | Patient.lname.ilike(f"%{name_query}%")).all()
    else:
        patients = Patient.query.all()
        
    result = []
    for p in patients:
        result.append({
            "id": p.id,
            "patient_id": p.patient_id,
            "fname": p.fname,
            "lname": p.lname,
            "age": p.age,
            "phone": p.phone,
            "status": p.status,
            "disease": p.disease
        })
    return jsonify(result), 200

# Food Orders
@app.route('/api/food-orders', methods=['POST'])
@jwt_required()
def place_order():
    data = request.json
    user_id = get_jwt_identity()['id']
    patient = Patient.query.filter_by(user_id=user_id).first()
    if not patient:
        return jsonify({"message": "Patient profile not found"}), 404
        
    new_order = FoodOrder(patient_id=patient.id, item=data['item'])
    db.session.add(new_order)
    db.session.commit()
    return jsonify({"message": "Order placed"}), 201

@app.route('/api/food-orders', methods=['GET'])
@jwt_required()
def get_orders():
    user_id = get_jwt_identity()['id']
    patient = Patient.query.filter_by(user_id=user_id).first()
    if not patient:
        return jsonify([]), 200
    
    orders = FoodOrder.query.filter_by(patient_id=patient.id).all()
    return jsonify([{
        "item": o.item,
        "status": o.status,
        "time": o.order_time.strftime("%Y-%m-%d %H:%M")
    } for o in orders]), 200

# Nurse Call
@app.route('/api/nurse-call', methods=['POST'])
@jwt_required()
def call_nurse():
    data = request.json
    user_id = get_jwt_identity()['id']
    patient = Patient.query.filter_by(user_id=user_id).first()
    if not patient:
        return jsonify({"message": "Patient profile not found"}), 404
        
    new_call = NurseCall(patient_id=patient.id, priority=data.get('priority', 'Normal'))
    db.session.add(new_call)
    db.session.commit()
    return jsonify({"message": "Nurse notified"}), 201

# Billing
@app.route('/api/billing', methods=['GET'])
@jwt_required()
def get_bills():
    user = get_jwt_identity()
    if user['role'] == 'Patient':
        patient = Patient.query.filter_by(user_id=user['id']).first()
        bills = Billing.query.filter_by(patient_id=patient.id).all()
    else:
        bills = Billing.query.all()
        
    return jsonify([{
        "id": b.id,
        "amount": float(b.amount),
        "status": b.status,
        "date": b.date.strftime("%Y-%m-%d")
    } for b in bills]), 200

if __name__ == '__main__':
    init_db()
    # Seed demo users if admin is missing (must be inside app context!)
    with app.app_context():
        if User.query.filter_by(username='admin').first() is None:
            hashed = bcrypt.generate_password_hash('demo123').decode('utf-8')
            
            # Super Admin
            admin = User(username='admin', password_hash=hashed, role='SuperAdmin', full_name='Demo Admin')
            
            # Demo Doctor
            dr_user = User(username='doctor', password_hash=hashed, role='Doctor', full_name='Dr. Demo')
            
            # Demo Patient
            pt_user = User(username='patient', password_hash=hashed, role='Patient', full_name='Demo Patient')
            
            db.session.add_all([admin, dr_user, pt_user])
            db.session.commit()
            
            # Associate Profiles
            db.session.add(Doctor(user_id=dr_user.id, name="Dr. Demo", specialization="General Physician"))
            db.session.add(Patient(user_id=pt_user.id, fname="Demo", lname="Patient", patient_id="PT-9999"))
            db.session.commit()
            
        if Doctor.query.count() <= 1:
            doc1 = Doctor(name="Dr. Sarah Connor", specialization="Cardiologist", status="Available")
            doc2 = Doctor(name="Dr. James Wilson", specialization="General Physician", status="Available")
            doc3 = Doctor(name="Dr. House", specialization="Neurologist", status="Available")
            db.session.add_all([doc1, doc2, doc3])
            db.session.commit()
            
    app.run(debug=True, port=5000)
