const BASE_URL = 'http://localhost:5000';

function getHeaders() {
    const token = localStorage.getItem('hms_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

async function apiFetch(endpoint, options = {}) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers: getHeaders()
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API Error: ${response.status}`);
        }
        return await response.json();
    } catch (err) {
        console.warn(`[API Wrapper] Failure at ${endpoint}:`, err);
        throw err;
    }
}

const API = {
    auth: {
        register: async (data) => {
            const res = await apiFetch('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    username: data.email || data.phone || data.username,
                    password: data.password || 'Apollo123!',
                    full_name: data.name,
                    role: data.role || 'Patient',
                    email: data.email,
                    phone: data.phone,
                    symptoms: data.symptoms || '',
                    age: data.age,
                    gender: data.gender
                })
            });
            return res;
        },

        login: async (username, password) => {
            const res = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            if (res.token) {
                localStorage.setItem('hms_token', res.token);
            }
            return {
                token: res.token,
                role: res.role,
                username: res.username
            };
        },
        
        logout: async () => {
             localStorage.removeItem('hms_token');
        },

        getUser: async () => {
             // Basic implementation: trust localStorage or write a /me route in app.py
             const token = localStorage.getItem('hms_token');
             if (!token) return null;
             // Decoding JWT is possible but we just return role/name from MemStore.
             return null; 
        }
    },

    dashboard: {
        getStats: async () => {
            return await apiFetch('/api/dashboard/stats');
        }
    },

    patients: {
        getAll: async (name = '') => {
            return await apiFetch(`/api/patients${name ? '?name='+name : ''}`);
        },
        create: async (data) => {
            return await apiFetch('/api/patients', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },
        update: async (id, data) => {
            // Not implemented in standard app.py, mocking failure grace
            return data;
        }
    },

    doctors: {
        getAll: async () => {
            return await apiFetch('/api/doctors').catch(() => []);
        }
    },

    food: {
        placeOrder: async (patient_id, item) => {
            return await apiFetch('/api/food-orders', {
                method: 'POST',
                body: JSON.stringify({ item })
            });
        },
        getHistory: async () => {
            return await apiFetch('/api/food-orders').catch(() => []);
        }
    },

    nurse: {
        call: async (patient_id, priority = 'Normal', bed_id = null) => {
            return await apiFetch('/api/nurse-call', {
                method: 'POST',
                body: JSON.stringify({ priority })
            });
        },
        getCalls: async () => {
            return await apiFetch('/api/nurse-calls').catch(() => []);
        }
    },

    billing: {
        getHistory: async () => {
            return await apiFetch('/api/billing').catch(() => []);
        },
        create: async (patient_id, amount, service) => {
            return null;
        }
    },
    
    appointments: {
        getAll: async () => {
             return await apiFetch('/api/appointments').catch(() => []);
        },
        create: async (patient_id, doctor_id, date, time) => {
             return null;
        }
    },
    
    labs: {
         getAll: async () => {
             return await apiFetch('/api/labs').catch(() => []);
         }
    },
    
    prescriptions: {
         getAll: async () => {
             return await apiFetch('/api/prescriptions').catch(() => []);
         }
    }
};

window.API = API;


// MemStore backed by localStorage to persist data across page reloads and tabs
window.MemStore = {
    getItem(key) {
        return localStorage.getItem(key);
    },
    setItem(key, value) {
        localStorage.setItem(key, value);
    },
    removeItem(key) {
        localStorage.removeItem(key);
    },
    async init() {
        try {
            // Seed default doctors if empty
            if (!localStorage.getItem('hms_v2_doctors')) {
                const defaultDocs = [
                    { id: 'DOC-001', name: "Dr. Sarah Connor", specialization: "Cardiologist", status: "Available", phone: "9876543210" },
                    { id: 'DOC-002', name: "Dr. James Wilson", specialization: "General Physician", status: "Available", phone: "9876543211" },
                    { id: 'DOC-003', name: "Dr. House", specialization: "Neurologist", status: "Available", phone: "9876543212" }
                ];
                localStorage.setItem('hms_v2_doctors', JSON.stringify(defaultDocs));
            }

            // Seed default patients if empty
            if (!localStorage.getItem('hms_v2_patients')) {
                const defaultPatients = [
                    { patientId: 'PT-1001', fname: "John", lname: "Doe", age: 45, gender: "Male", phone: "1234567890", status: "Active Treatment", disease: "Cardiology", qrCode: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=PT-1001" },
                    { patientId: 'PT-1002', fname: "Jane", lname: "Smith", age: 32, gender: "Female", phone: "0987654321", status: "Active Treatment", disease: "General Consult", qrCode: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=PT-1002" }
                ];
                localStorage.setItem('hms_v2_patients', JSON.stringify(defaultPatients));
            }

            // Seed default appointments if empty
            if (!localStorage.getItem('hms_v2_appointments')) {
                const defaultApts = [
                    { id: 1, patient_id: 'PT-1001', doctor_id: 'DOC-001', date: new Date().toISOString().split('T')[0], time: "10:00 AM", status: "Pending", notes: "Regular cardiovascular checkup" },
                    { id: 2, patient_id: 'PT-1002', doctor_id: 'DOC-002', date: new Date().toISOString().split('T')[0], time: "11:30 AM", status: "Pending", notes: "General health follow-up" }
                ];
                localStorage.setItem('hms_v2_appointments', JSON.stringify(defaultApts));
            }

            // Seed default beds if empty
            if (!localStorage.getItem('hms_v2_beds')) {
                const defaultBeds = [
                    { id: "BED-101", ward: "ICU A", status: "Occupied", patient: "John Doe" },
                    { id: "BED-102", ward: "ICU A", status: "Available" },
                    { id: "BED-103", ward: "General Ward 1", status: "Available" },
                    { id: "BED-104", ward: "General Ward 1", status: "Occupied", patient: "Jane Smith" },
                    { id: "BED-105", ward: "General Ward 2", status: "Available" }
                ];
                localStorage.setItem('hms_v2_beds', JSON.stringify(defaultBeds));
            }

            // Seed pharmacy if empty
            if (!localStorage.getItem('hms_v2_pharmacy')) {
                const defaultPharm = [
                    { name: "Paracetamol 500mg", stock: 250, price: 10, category: "Analgesic" },
                    { name: "Amoxicillin 250mg", stock: 120, price: 35, category: "Antibiotic" },
                    { name: "Aspirin 81mg", stock: 300, price: 15, category: "Cardiology" },
                    { name: "Metformin 500mg", stock: 180, price: 20, category: "Antidiabetic" }
                ];
                localStorage.setItem('hms_v2_pharmacy', JSON.stringify(defaultPharm));
            }

            // Seed billing if empty
            if (!localStorage.getItem('hms_v2_billing')) {
                const defaultBills = [
                    { id: "BILL-001", patientId: "PT-1001", amount: 1500.00, status: "Pending", date: new Date().toISOString().split('T')[0], service: "Cardiology Consultation" },
                    { id: "BILL-002", patientId: "PT-1002", amount: 250.00, status: "Paid", date: new Date().toISOString().split('T')[0], service: "General Practitioner Visit" }
                ];
                localStorage.setItem('hms_v2_billing', JSON.stringify(defaultBills));
            }

            // Seed food orders if empty
            if (!localStorage.getItem('hms_v2_food_orders')) {
                const defaultFood = [
                    { item: "Diabetic Special Meal", status: "Ordered", time: new Date().toISOString().split('T')[0] + " 08:30" }
                ];
                localStorage.setItem('hms_v2_food_orders', JSON.stringify(defaultFood));
            }

            // Sync with backend API if online
            const response = await fetch(`${BASE_URL}/`, { method: 'GET' }).catch(() => null);
            if (response && response.ok) {
                console.log('Backend API is online. Syncing data...');
                const patients = await API.patients.getAll().catch(() => null);
                if (patients) localStorage.setItem('hms_v2_patients', JSON.stringify(patients));

                const doctors = await API.doctors.getAll().catch(() => null);
                if (doctors) localStorage.setItem('hms_v2_doctors', JSON.stringify(doctors));

                const appointments = await API.appointments.getAll().catch(() => null);
                if (appointments) localStorage.setItem('hms_v2_appointments', JSON.stringify(appointments));
            }
        } catch (e) {
            console.warn('Failed to sync MemStore with API (running offline mode):', e);
        }
    }
};
