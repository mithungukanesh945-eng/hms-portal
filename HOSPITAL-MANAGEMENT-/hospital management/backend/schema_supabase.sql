-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('patient','doctor','admin', 'nurse', 'receptionist', 'pharmacist', 'lab-tech', 'billing')) NOT NULL,
  symptoms TEXT,
  assigned_doctor UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Doctors Table
CREATE TABLE IF NOT EXISTS doctors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  specialization TEXT,
  status TEXT CHECK (status IN ('Available', 'In Consultation', 'In Operation', 'Offline')) DEFAULT 'Available',
  patients_count INT DEFAULT 0
);

-- Foreign key for users
ALTER TABLE users ADD CONSTRAINT fk_assigned_doctor FOREIGN KEY (assigned_doctor) REFERENCES doctors(id) ON DELETE SET NULL;

-- 3. Patients Table
CREATE TABLE IF NOT EXISTS patients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  age INT,
  gender TEXT,
  symptoms TEXT,
  disease TEXT,
  assigned_doctor UUID REFERENCES doctors(id) ON DELETE SET NULL,
  patient_id_label TEXT UNIQUE,
  status TEXT DEFAULT 'Active Treatment',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT,
  status TEXT CHECK (status IN ('Pending','Confirmed','Completed','Cancelled')) DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Billing Table
CREATE TABLE IF NOT EXISTS billing (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_status TEXT CHECK (payment_status IN ('paid','unpaid','partial')) DEFAULT 'unpaid',
  service TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Pharmacy Table
CREATE TABLE IF NOT EXISTS pharmacy (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    medicine_name TEXT NOT NULL,
    stock INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    category TEXT,
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Lab Tests Table
CREATE TABLE IF NOT EXISTS labs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    category TEXT,
    status TEXT CHECK (status IN ('Pending', 'In Progress', 'Completed')) DEFAULT 'Pending',
    result TEXT,
    date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Beds Table
CREATE TABLE IF NOT EXISTS beds (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    bed_number TEXT NOT NULL UNIQUE,
    ward TEXT NOT NULL,
    status TEXT CHECK (status IN ('Available', 'Occupied', 'Maintenance')) DEFAULT 'Available',
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL
);

-- 9. Food Orders Table
CREATE TABLE IF NOT EXISTS food_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  status TEXT CHECK (status IN ('Ordered', 'Preparing', 'Out for Delivery', 'Delivered')) DEFAULT 'Ordered',
  order_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Nurse Calls Table
CREATE TABLE IF NOT EXISTS nurse_calls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  priority TEXT CHECK (priority IN ('Normal', 'Emergency')) DEFAULT 'Normal',
  status TEXT CHECK (status IN ('Active', 'Responded', 'Resolved')) DEFAULT 'Active',
  call_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Prescriptions Table
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    meds TEXT NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- Function for smart doctor assignment
CREATE OR REPLACE FUNCTION assign_doctor(symptoms_text text)
RETURNS uuid AS $$
DECLARE
  doc_id uuid;
BEGIN
  IF symptoms_text ILIKE '%fever%' THEN
    SELECT id INTO doc_id FROM doctors WHERE specialization ILIKE '%General%' LIMIT 1;
  ELSIF symptoms_text ILIKE '%chest pain%' THEN
    SELECT id INTO doc_id FROM doctors WHERE specialization ILIKE '%Cardiology%' LIMIT 1;
  ELSIF symptoms_text ILIKE '%skin%' THEN
    SELECT id INTO doc_id FROM doctors WHERE specialization ILIKE '%Dermatology%' LIMIT 1;
  ELSE
    SELECT id INTO doc_id FROM doctors WHERE specialization ILIKE '%General%' LIMIT 1;
  END IF;
  RETURN doc_id;
END;
$$ LANGUAGE plpgsql;
