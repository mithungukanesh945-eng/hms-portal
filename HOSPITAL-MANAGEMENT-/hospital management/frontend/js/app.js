/**
 * Luxury HMS - Core Application Controller
 * Handles Routing, State Management, DOM Events, and Theming.
 */

// ==========================================
// STATE & ON_LOAD INITIALIZATION
// ==========================================
let currentUser = null;
let currentAuthRole = 'staff'; 
let otpInterval;
let pendingUserId = null;

document.addEventListener("DOMContentLoaded", () => {
    // 1. Loading sequence
    setTimeout(() => {
        document.getElementById('main-loader').classList.add('hidden');
        checkAuthentication();
    }, 1200);

    // 2. Attach Listeners
    document.getElementById('login-form').addEventListener('submit', handleLoginSubmit);
    const regForm = document.getElementById('public-register-form');
    if (regForm) regForm.addEventListener('submit', handleRegistrationSubmit);
    
    // 3. Load Saved Themes & Brand
    const savedTheme = MemStore.getItem('hms_theme_color');
    const isDark = MemStore.getItem('hms_dark_mode') === 'true';

    if(savedTheme) {
        const t = JSON.parse(savedTheme);
        setThemeColor(t.primary, t.primaryDark, false);
    }
    if(isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('dark-mode-icon').className = 'fa-solid fa-sun';
    }
    applySettings();
    selfHealData(); // Next-Gen Self-Healing
    
    // Initialize Login UI State
    selectAuthRole('admin');
});

// ==========================================
// AUTHENTICATION FLOW
// ==========================================
function checkAuthentication() {
    const token = MemStore.getItem('hms_v2_token');
    const role = MemStore.getItem('hms_v2_role');
    const name = MemStore.getItem('hms_v2_name');

    if (token && role) {
        currentUser = { role, name };
        document.getElementById('landing-view')?.classList.add('hidden');
        bootstrapApplication();
    } else {
        document.getElementById('app-view').classList.add('hidden');
        document.getElementById('auth-view').classList.add('hidden');
    }
}

function showLoginScreen() {
    document.getElementById('landing-view')?.classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
}

function selectAuthRole(role) {
    currentAuthRole = role;
    document.querySelectorAll('.role-chip').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-auth-role="${role}"]`).classList.add('active');
    
    // UI Enhancements for Premium Login
    const bgImg = document.getElementById('login-bg-image');
    if(bgImg) {
        const roleImages = {
            'admin': 'assets/admin_banner.png',
            'doctor': 'assets/doctor_banner.png',
            'nurse': 'assets/nurse_banner.png',
            'receptionist': 'assets/receptionist_banner.png',
            'pharmacist': 'assets/pharmacist_banner.png',
            'lab-tech': 'assets/lab_tech_banner.png',
            'billing': 'assets/billing_banner.png',
            'patient': 'assets/patient_banner.png'
        };
        bgImg.style.backgroundImage = `url('${roleImages[role] || 'assets/doctor_consultation.png'}')`;
    }

    const passField = document.getElementById('password-field-container');
    if(passField) {
        // Patients usually use OTP only in this system, staff might use password
        if(role === 'patient') {
            passField.classList.add('hidden');
        } else {
            passField.classList.remove('hidden');
        }
    }

    // Reset form states
    document.getElementById('auth-otp-group').classList.add('hidden');
    document.getElementById('btn-login-submit').innerHTML = 'Secure Login <i class="fa-solid fa-arrow-right-to-bracket" style="margin-left:8px;"></i>';
    clearInterval(otpInterval);
    pendingUserId = null;
    
    // Reset OTP boxes
    document.querySelectorAll('.otp-box').forEach(b => b.value = '');
    document.getElementById('auth-otp').value = '';
}

// HELPER FUNCTIONS FOR PREMIUM LOGIN
function togglePasswordVisibility(id, icon) {
    const input = document.getElementById(id);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    } else {
        input.type = "password";
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    }
}

function moveOtpFocus(current, nextId) {
    if (current.value.length === 1) {
        document.getElementById(nextId)?.focus();
    }
    syncOtpValue();
}

function syncOtpValue() {
    let otp = "";
    document.querySelectorAll('.otp-box').forEach(box => {
        otp += box.value;
    });
    document.getElementById('auth-otp').value = otp;
}

function finalizeOtp(lastInput) {
    syncOtpValue();
    if (document.getElementById('auth-otp').value.length === 6) {
        // Auto-submit or just focus away
        document.getElementById('btn-login-submit').focus();
    }
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login-submit');
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;

    // 1. Validation based on role
    if (currentAuthRole !== 'patient' && (!username || !password)) {
        showToast("Username and Password are required", "warning");
        return;
    }
    if (currentAuthRole === 'patient' && !username) {
        showToast("Phone or Email is required", "warning");
        return;
    }

    // 2. Patient OTP Verification Flow
    if (currentAuthRole === 'patient') {
        const otpGroup = document.getElementById('auth-otp-group');
        if (otpGroup.classList.contains('hidden')) {
            showToast("Verification code sent to your device. (Code: 123456)", "success");
            triggerOtpPhase();
            return;
        } else {
            const enteredOtp = document.getElementById('auth-otp').value;
            if (enteredOtp !== '123456') {
                showToast("Invalid OTP code. Please enter 123456", "error");
                return;
            }
        }
    }

    const orgText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';

    // 3. Define local fallback credentials check
    const performLocalLogin = () => {
        let role = 'Patient';
        let name = username;

        // Map role to actual system roles
        const roleMapping = {
            'admin': { role: 'SuperAdmin', name: 'Demo Admin' },
            'doctor': { role: 'Doctor', name: 'Dr. Demo' },
            'nurse': { role: 'Nurse', name: 'Demo Nurse' },
            'receptionist': { role: 'Receptionist', name: 'Demo Receptionist' },
            'pharmacist': { role: 'Pharmacist', name: 'Demo Pharmacist' },
            'lab-tech': { role: 'Lab Technician', name: 'Demo Lab Tech' },
            'billing': { role: 'Billing Staff', name: 'Demo Billing Staff' },
            'patient': { role: 'Patient', name: 'Demo Patient' }
        };

        const mapped = roleMapping[currentAuthRole] || { role: 'Patient', name: username };
        role = mapped.role;
        name = mapped.name;

        // Check if patient exists in localStorage to pull their real name
        if (role === 'Patient') {
            const localPatients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
            const found = localPatients.find(p => p.phone === username || p.email === username || p.fname.toLowerCase() === username.toLowerCase());
            if (found) {
                name = `${found.fname} ${found.lname}`;
            }
        }

        MemStore.setItem('hms_v2_token', 'demo_token');
        MemStore.setItem('hms_v2_role', role);
        MemStore.setItem('hms_v2_name', name);

        showToast(`Welcome back, ${name}! (Local Demo)`, "success");
        setTimeout(() => {
            location.reload();
        }, 1000);
    };

    // 4. Try network fetch
    try {
        const response = await fetch('http://127.0.0.1:5000/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, password: password || '123' })
        });
        
        const res = await response.json();
        if (!response.ok) throw new Error(res.message || "Invalid credentials");
        
        // Finalize state
        MemStore.setItem('hms_v2_token', res.token);
        MemStore.setItem('hms_v2_role', res.role);
        MemStore.setItem('hms_v2_name', res.username);
        
        showToast(`Welcome back, ${res.username}!`, "success");
        setTimeout(() => {
            location.reload(); 
        }, 1000);

    } catch (err) {
        console.warn('Network login failed. Falling back to local authentication.', err);
        // Execute local demo fallback
        performLocalLogin();
    }
}

function openRegistrationModal() {
    const modal = document.getElementById('modal-register-user');
    if(modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; // Ensure flex centering
    }
}

async function handleRegistrationSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-register-submit');
    
    // Collect Data
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    
    // Validation
    if(password !== confirmPassword) {
        showToast("Passwords do not match!", "error");
        return;
    }

    const formData = {
        username: document.getElementById('reg-username').value,
        password: password,
        full_name: document.getElementById('reg-fullname').value,
        age: document.getElementById('reg-age').value,
        gender: document.getElementById('reg-gender').value,
        phone: document.getElementById('reg-phone').value,
        symptoms: document.getElementById('reg-symptoms').value,
        role: "Patient"
    };

    const orgText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Securing Account...';

    const performLocalRegister = () => {
        const localPatients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
        
        // Check if username/phone already exists
        const exists = localPatients.some(p => p.phone === formData.phone || p.fname.toLowerCase() === formData.full_name.split(' ')[0].toLowerCase());
        if (exists) {
            showToast("An account with this phone or name already exists locally.", "error");
            return;
        }

        // Triage Specialist based on symptoms
        const symptomMap = {
            'fever': 'General Physician', 'cough': 'General Physician', 'cold': 'General Physician', 'flu': 'General Physician',
            'chest pain': 'Cardiologist', 'heart': 'Cardiologist', 'breath': 'Cardiologist',
            'skin': 'Dermatologist', 'rash': 'Dermatologist', 'acne': 'Dermatologist',
            'bone': 'Orthopedic', 'fracture': 'Orthopedic', 'joint': 'Orthopedic',
            'headache': 'Neurologist', 'brain': 'Neurologist', 'nerve': 'Neurologist',
            'eye': 'Ophthalmologist', 'vision': 'Ophthalmologist'
        };

        const symptoms = formData.symptoms.toLowerCase();
        let spec = 'General Physician';
        for (const [key, val] of Object.entries(symptomMap)) {
            if (symptoms.includes(key)) {
                spec = val;
                break;
            }
        }

        // Find doctor from local list
        const localDocs = JSON.parse(MemStore.getItem('hms_v2_doctors') || '[]');
        const doc = localDocs.find(d => d.specialization === spec) || localDocs[0] || { id: 'DOC-002', name: 'Dr. James Wilson' };

        const newPatientId = 'PT-' + Math.floor(1000 + Math.random() * 9000);
        const nameParts = formData.full_name.split(' ');
        const fname = nameParts[0] || 'Patient';
        const lname = nameParts.slice(1).join(' ') || '';

        // Add to local patients list
        const newPatient = {
            patientId: newPatientId,
            fname: fname,
            lname: lname,
            age: formData.age || 30,
            gender: formData.gender || 'Male',
            phone: formData.phone || '1234567890',
            email: formData.username || '',
            symptoms: formData.symptoms || '',
            disease: spec,
            status: 'Active Treatment',
            qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${newPatientId}`
        };
        localPatients.unshift(newPatient);
        MemStore.setItem('hms_v2_patients', JSON.stringify(localPatients));

        // Auto-create Appointment
        const localApts = JSON.parse(MemStore.getItem('hms_v2_appointments') || '[]');
        const newApt = {
            id: localApts.length + 1,
            patient_id: newPatientId,
            doctor_id: doc.id,
            date: new Date().toISOString().split('T')[0],
            time: "Immediately (ASAP)",
            status: 'Pending',
            notes: `AI Smart Triage: Assigned ${spec} based on symptoms: ${formData.symptoms}`
        };
        localApts.unshift(newApt);
        MemStore.setItem('hms_v2_appointments', JSON.stringify(localApts));

        showToast("Account created successfully (Local Mode). Specialist assigned.", "success");
        closeModal('modal-register-user');
        document.getElementById('public-register-form').reset();
    };
    
    try {
        const res = await API.auth.register(formData);
        showToast("Account created! Our AI has assigned your specialist.", "success");
        closeModal('modal-register-user');
        document.getElementById('public-register-form').reset();
    } catch(err) {
        console.warn('Network registration failed. Saving account locally.', err);
        performLocalRegister();
    } finally {
        btn.innerHTML = orgText;
    }
}

function triggerOtpPhase() {
    document.getElementById('btn-login-submit').innerHTML = 'Verify & Authenticate <i class="fa-solid fa-check"></i>';
    document.getElementById('auth-otp-group').classList.remove('hidden');
    
    // Focus first OTP box
    setTimeout(() => {
        const first = document.querySelector('.otp-box');
        if(first) first.focus();
    }, 100);
    
    // Setup 60 sec timer
    let time = 60;
    const timerEl = document.getElementById('otp-timer');
    
    clearInterval(otpInterval);
    otpInterval = setInterval(() => {
        time--;
        const m = Math.floor(time / 60).toString().padStart(2, '0');
        const s = (time % 60).toString().padStart(2, '0');
        timerEl.innerText = `Expires in: ${m}:${s}`;
        
        if (time <= 0) {
            clearInterval(otpInterval);
            timerEl.innerText = "OTP Expired";
            timerEl.style.color = "var(--danger)";
        }
    }, 1000);
}

function resendOTP() {
    pendingUserId = null;
    document.getElementById('auth-otp-group').classList.add('hidden');
    document.getElementById('btn-login-submit').innerHTML = 'Secure Login <i class="fa-solid fa-arrow-right-to-bracket" style="margin-left: 8px;"></i>';
    document.getElementById('auth-otp').value = '';
    document.querySelectorAll('.otp-box').forEach(b => b.value = '');
    showToast("OTP Resent to registered device.", "success");
}

function logout() {
    MemStore.removeItem('hms_v2_token');
    MemStore.removeItem('hms_v2_role');
    MemStore.removeItem('hms_v2_name');
    location.reload();
}

// ==========================================
// APPLICATION & ROUTING SETUP 
// ==========================================
async function bootstrapApplication() {
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('app-view').classList.remove('hidden');

    // Headers
    document.getElementById('nav-user-name').innerText = currentUser.name;
    document.getElementById('nav-user-role').innerText = currentUser.role;
    document.getElementById('nav-avatar').innerText = currentUser.name.charAt(0).toUpperCase();

    buildDynamicNavigation();
    
    // Auto-route to their primary module
    const roleRoutes = {
        'SuperAdmin': 'admin-dashboard',
        'Doctor': 'doc-dashboard',
        'Nurse': 'nurse-dashboard',
        'Receptionist': 'receptionist-dashboard',
        'Pharmacist': 'pharmacist-dashboard',
        'Lab Technician': 'lab-tech-dashboard',
        'Billing Staff': 'billing-dashboard',
        'Patient': 'patient-dashboard'
    };
    
    navigate(roleRoutes[currentUser.role] || 'dashboard');
    
    // Data Migration: Ensure all patients have IDs
    const patients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    let migrated = false;
    patients.forEach(p => {
        if(!p.patientId) {
            p.patientId = 'PT-' + Math.floor(1000 + Math.random() * 9000);
            migrated = true;
        }
    });
    if(migrated) MemStore.setItem('hms_v2_patients', JSON.stringify(patients));

    // Attempt Data Load
    await fetchDashboardData();
    
    // Initialize New Next-Gen Components
    updateWardSelects();
    renderEmergencyContacts();
}

function buildDynamicNavigation() {
    const nav = document.getElementById('nav-menu');
    nav.innerHTML = '';
    
    let items = [];
    if(currentUser.role === 'Patient') {
        items = [
            { id: 'patient-dashboard', text: 'Health Dashboard', icon: 'fa-gauge-high' },
            { id: 'appointments', text: 'My Appointments', icon: 'fa-calendar-check' },
            { id: 'prescriptions', text: 'Prescriptions', icon: 'fa-prescription' },
            { id: 'billing', text: 'My Billing', icon: 'fa-file-invoice-dollar' },
            { id: 'ambulance', text: 'Emergency SOS', icon: 'fa-truck-medical', color:'var(--danger)' }
        ];
    } else if (currentUser.role === 'Doctor') {
        items = [
            { id: 'doc-dashboard', text: 'Clinical Workstation', icon: 'fa-stethoscope' },
            { id: 'patients', text: 'My Patients', icon: 'fa-hospital-user' },
            { id: 'appointments', text: 'Daily Schedule', icon: 'fa-calendar-check' },
            { id: 'laboratory', text: 'Test Requests', icon: 'fa-microscope' }
        ];
    } else if (currentUser.role === 'Nurse') {
        items = [
            { id: 'nurse-dashboard', text: 'Care Station', icon: 'fa-user-nurse' },
            { id: 'patients', text: 'Patient Registry', icon: 'fa-hospital-user' },
            { id: 'appointments', text: 'Central Booking', icon: 'fa-calendar-check' },
            { id: 'beds', text: 'Bed Management', icon: 'fa-bed' },
            { id: 'shifts', text: 'Staff Roster', icon: 'fa-clock-rotate-left' }
        ];
    } else if (currentUser.role === 'Receptionist') {
        items = [
            { id: 'receptionist-dashboard', text: 'Reception Desk', icon: 'fa-bell-concierge' },
            { id: 'patients', text: 'Patient Registry', icon: 'fa-user-plus' },
            { id: 'appointments', text: 'Daily Bookings', icon: 'fa-calendar-check' },
            { id: 'beds', text: 'Bed Status', icon: 'fa-bed' },
            { id: 'ambulance', text: 'Ambulance Call', icon: 'fa-truck-medical' }
        ];
    } else if (currentUser.role === 'Pharmacist') {
        items = [
            { id: 'pharmacist-dashboard', text: 'Pharmacy Hub', icon: 'fa-pills' },
            { id: 'pharmacy', text: 'Medical Stock', icon: 'fa-boxes-stacked' }
        ];
    } else if (currentUser.role === 'Lab Technician') {
        items = [
            { id: 'lab-tech-dashboard', text: 'Diagnostics Hub', icon: 'fa-flask-vial' },
            { id: 'laboratory', text: 'Laboratory Tests', icon: 'fa-microscope' }
        ];
    } else if (currentUser.role === 'Billing Staff') {
        items = [
            { id: 'billing-dashboard', text: 'Finance Hub', icon: 'fa-indian-rupee-sign' },
            { id: 'billing', text: 'Invoicing', icon: 'fa-file-invoice-dollar' }
        ];
    } else if (currentUser.role === 'Staff') {
        items = [
            { id: 'dashboard', text: 'Operations Center', icon: 'fa-chart-pie' },
            { id: 'patients', text: 'Patient Registry', icon: 'fa-hospital-user' },
            { id: 'appointments', text: 'Central Booking', icon: 'fa-calendar-check' },
            { id: 'beds', text: 'Bed Management', icon: 'fa-bed' },
            { id: 'shifts', text: 'Staff Duty Roster', icon: 'fa-clock-rotate-left' }
        ];
    } else {
        items = [
            { id: 'admin-dashboard', text: 'Executive Center', icon: 'fa-shield-halved' },
            { id: 'patients', text: 'Patient Registry', icon: 'fa-hospital-user' },
            { id: 'doctors', text: 'Medical Staff', icon: 'fa-user-doctor' },
            { id: 'appointments', text: 'Central Booking', icon: 'fa-calendar-check' },
            { id: 'pharmacy', text: 'Pharmacy & Stock', icon: 'fa-pills' },
            { id: 'laboratory', text: 'Laboratory Tests', icon: 'fa-microscope' },
            { id: 'beds', text: 'Bed Management', icon: 'fa-bed' },
            { id: 'ambulance', text: 'Ambulance Fleet', icon: 'fa-truck-medical' },
            { id: 'equipment', text: 'Medical Assets', icon: 'fa-microchip' },
            { id: 'shifts', text: 'Staff Shifting', icon: 'fa-clock-rotate-left' },
            { id: 'billing', text: 'Finance & Billing', icon: 'fa-file-invoice-dollar' },
            { id: 'settings', text: 'System Settings', icon: 'fa-gears' }
        ];
    }

    items.forEach(i => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.id = `menu-${i.id}`;
        li.onclick = () => navigate(i.id);
        li.innerHTML = `<i class="fa-solid ${i.icon}" style="color: ${i.color || 'inherit'}"></i> ${i.text}`;
        nav.appendChild(li);
    });
}
let _isNavigating = false;
function navigate(viewId) {
    // Guard against re-entrant calls (prevents infinite recursion)
    if (_isNavigating) return;
    _isNavigating = true;

    try {
        // 1. Update Sidebar
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const targetNav = document.getElementById(`menu-${viewId}`);
        if (targetNav) targetNav.classList.add('active');

        // 2. Hide all views
        document.querySelectorAll('.router-view').forEach(el => el.classList.add('hidden'));

        // 3. Show target
        const targetView = document.getElementById(`view-${viewId}`);
        if (targetView) {
            targetView.classList.remove('hidden');

            // Context-specific rendering (based on which view is shown)
            const trackedViews = [
                'admin-dashboard', 'doc-dashboard', 'nurse-dashboard', 'receptionist-dashboard',
                'pharmacist-dashboard', 'lab-tech-dashboard', 'billing-dashboard', 'patient-dashboard',
                'patients', 'appointments', 'doctors', 'pharmacy', 'laboratory', 'billing', 'ambulance', 'equipment', 'shifts'
            ];
            if (trackedViews.includes(viewId)) {
                renderLocalData();
            }
            if (viewId === 'beds') {
                renderBedGrid();
            }
            // Only call these for nurse/patient specific views to avoid redundant work
            if (viewId === 'patient-dashboard') {
                renderPatientFoodOrders();
                renderPatientNurseCalls();
            }
            if (viewId === 'nurse-dashboard') {
                renderNurseDashboardAlerts();
                renderHandoverNotes();
            }
            if (viewId === 'prescriptions') {
                renderPendingFulfillment();
            }

            // Simple animation trigger
            targetView.style.opacity = '0';
            targetView.style.transform = 'translateY(15px)';
            setTimeout(() => {
                targetView.style.transition = 'all 0.4s ease';
                targetView.style.opacity = '1';
                targetView.style.transform = 'translateY(0)';
            }, 10);
        } else {
            // View not found — fallback to role dashboard (no toast spam)
            const roleRoutes = {
                'SuperAdmin': 'admin-dashboard',
                'Doctor': 'doc-dashboard',
                'Nurse': 'nurse-dashboard',
                'Receptionist': 'receptionist-dashboard',
                'Pharmacist': 'pharmacist-dashboard',
                'Lab Technician': 'lab-tech-dashboard',
                'Billing Staff': 'billing-dashboard',
                'Patient': 'patient-dashboard'
            };
            const fallback = currentUser ? (roleRoutes[currentUser.role] || 'admin-dashboard') : null;
            if (fallback && fallback !== viewId) {
                _isNavigating = false; // Allow the fallback navigate to run
                navigate(fallback);
                return;
            }
        }
    } catch(err) {
        console.error('[navigate] Error during navigation to ' + viewId + ':', err);
    } finally {
        _isNavigating = false;
    }
}
// ==========================================
// DATA FETCHING & MOCKING
// ==========================================
async function fetchDashboardData() {
    try {
        const stats = await API.dashboard.getStats();
        
        // Update Admin Stats
        const adminS = {
            patients: document.getElementById('admin-stat-patients'),
            docs: document.getElementById('admin-stat-doctors'),
            apts: document.getElementById('admin-stat-appointments'),
            rev: document.getElementById('admin-stat-revenue'),
            beds: document.getElementById('admin-stat-beds'),
            busy: document.getElementById('admin-stat-busy')
        };
        if(adminS.patients) adminS.patients.innerText = stats.total_patients;
        if(adminS.docs) adminS.docs.innerText = stats.total_doctors;
        if(adminS.apts) adminS.apts.innerText = stats.total_appointments;
        if(adminS.rev) adminS.rev.innerText = '₹' + stats.revenue.toLocaleString();
        if(adminS.beds) adminS.beds.innerText = stats.available_beds;

        // Update Patient Stats if applicable
        if(currentUser.role === 'Patient') {
            const bills = await API.billing.getHistory();
            const ptS = {
                apts: document.getElementById('pt-stat-apts'),
                bill: document.getElementById('pt-stat-bill')
            };
            if(ptS.bill) ptS.bill.innerText = '₹' + bills.filter(b => b.status !== 'Paid').reduce((s, b) => s + b.amount, 0).toLocaleString();
        }

        renderLocalData();
        renderGlobalChart();
        renderRoleSpecificLists();
    } catch (err) {
        console.error("Dashboard data fetch failed", err);
    }
}

function renderRoleSpecificLists() {
    const localApts = JSON.parse(MemStore.getItem('hms_v2_appointments') || '[]');
    const localPatients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    const localLabs = JSON.parse(MemStore.getItem('hms_v2_labs') || '[]');
    const localBills = JSON.parse(MemStore.getItem('hms_v2_billing') || '[]');

    // 1. Doc Schedule
    const docTbl = document.querySelector('#doc-tbl-schedule tbody');
    if(docTbl) {
        const myApts = localApts.filter(a => a.doctor === currentUser.name);
        docTbl.innerHTML = myApts.slice(0, 5).map(a => `
            <tr><td>${a.time}</td><td>${a.patient}</td><td><span class="badge" style="background:rgba(245,158,11,0.1); color:var(--warning)">${a.status}</span></td><td><button class="btn btn-glass btn-sm" onclick="viewPatient360ByVal('${a.patient}')">View</button></td></tr>
        `).join('') || '<tr><td colspan="4" class="text-center text-muted">No appointments found.</td></tr>';
    }

    // 2. Recep Recent
    const recepTbl = document.querySelector('#recep-tbl-recent tbody');
    if(recepTbl) {
        recepTbl.innerHTML = localPatients.slice(0, 5).map(p => `
            <tr><td>${p.fname} ${p.lname}</td><td>${p.patientId}</td><td>General OPD</td><td><button class="btn btn-glass btn-sm" onclick="viewPatient360('${p.patientId}')">Open</button></td></tr>
        `).join('') || '<tr><td colspan="4" class="text-center text-muted">No recent registrations.</td></tr>';
    }

    // 3. Nurse Ward
    const nurseGrid = document.getElementById('nurse-ward-summary');
    if(nurseGrid) {
        const beds = JSON.parse(MemStore.getItem('hms_v2_beds') || '[]');
        nurseGrid.innerHTML = beds.slice(0, 3).map(b => `
            <div class="flex justify-between items-center p-2 rounded" style="background:rgba(255,255,255,0.05);">
                <span><i class="fa-solid fa-bed text-primary"></i> ${b.number}</span>
                <span class="text-sm">${b.status === 'Occupied' ? b.patient : 'Empty'}</span>
                <span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success)">${b.status}</span>
            </div>
        `).join('') || '<div class="text-muted">No ward data available.</div>';
    }
}

// Fallback helper for doctor dashboard
function viewPatient360ByVal(val) {
    const pts = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    const p = pts.find(x => (x.fname + ' ' + x.lname) === val || x.patientId === val);
    if(p) {
        viewPatient360(p.patientId);
        // Hide search dropdown if open
        const dropdown = document.getElementById('search-results-dropdown');
        if(dropdown) dropdown.classList.add('hidden');
    }
    else showToast("Patient profile not found.", "error");
}

let dashboardChart = null;
function renderGlobalChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)';

    const localPatients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    const baseline = localPatients.length > 0 ? localPatients.length * 10 : 50;

    if(dashboardChart) dashboardChart.destroy();
    
    dashboardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Monthly Growth',
                data: [baseline - 20, baseline, baseline + 40, baseline + 10, baseline + 60, baseline + 80],
                borderColor: '#1e3a8a',
                backgroundColor: 'rgba(30, 58, 138, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#1e3a8a',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: gridColor }, ticks: { color: textColor, font: {family: 'Outfit'} } },
                x: { grid: { display: false }, ticks: { color: textColor, font: {family: 'Outfit'} } }
            }
        }
    });
}

async function renderLocalData() {
    function generateEmptyState(colspan, icon, title, subtitle) {
        return `<tr><td colspan="${colspan}" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <i class="fa-solid ${icon}" style="font-size: 2rem; margin-bottom: 1rem; color: var(--border-solid);"></i><br>
            ${title}<br><span style="font-size:0.8rem">${subtitle}</span>
        </td></tr>`;
    }

    const pTbody = document.querySelector('#tbl-patients tbody');
    if (pTbody) {
        try {
            const patients = await API.patients.getAll();
            if(patients.length > 0) {
                pTbody.innerHTML = patients.map((p, index) => {
                    const status = p.status || 'Active Treatment';
                    let sColor = '--warning', bg = 'rgba(245, 158, 11, 0.1)';
                    if(status.includes('Recovered')) { sColor = '--success'; bg = 'rgba(16, 185, 129, 0.1)'; }
                    if(status.includes('Critical')) { sColor = '--danger'; bg = 'rgba(239, 68, 68, 0.1)'; }
                    return `
                    <tr>
                       <td><strong>${p.fname} ${p.lname}</strong></td>
                       <td>${p.age} yrs</td>
                       <td>${p.disease}</td>
                        <td><span class="badge" style="position:static; padding:4px 8px; font-size:0.8rem; background:${bg}; color:var(${sColor})">${status}</span></td>
                        <td>
                           <i class="fa-solid fa-id-card text-primary" onclick="viewPatient360('${p.patient_id}')" style="cursor:pointer; margin-right:8px;" title="View 360 Profile"></i>
                           <i class="fa-solid fa-pen-to-square text-warning" style="cursor:pointer; margin-right:8px;"></i>
                           ${currentUser.role === 'SuperAdmin' ? `<i class="fa-solid fa-trash text-danger" style="cursor:pointer;"></i>` : ''}
                        </td>
                    </tr>
                `}).join('');
            } else {
                pTbody.innerHTML = generateEmptyState(6, 'fa-box-open', 'No patient data available.', 'Register a patient to begin showing records here.');
            }
        } catch (e) { console.error(e); }
    }

    const aTbody = document.querySelector('#tbl-appointments tbody');
    if (aTbody) {
        const apts = JSON.parse(MemStore.getItem('hms_v2_appointments') || '[]');
        const patients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
        const doctors = JSON.parse(MemStore.getItem('hms_v2_doctors') || '[]');

        if (apts.length > 0) {
            aTbody.innerHTML = apts.map((a, i) => {
                // Lookup patient and doctor names
                const pt = patients.find(p => p.patientId === a.patient_id || p.patientId === a.patientId) || {};
                const doc = doctors.find(d => d.id === a.doctor_id || d.id === a.doctorId) || {};
                const ptName = a.patient || (pt.fname ? `${pt.fname} ${pt.lname}` : 'Unknown Patient');
                const docName = a.doctor || doc.name || 'Unknown Doctor';
                const status = a.status || 'Pending';
                let sColor = 'var(--warning)', sBg = 'rgba(245,158,11,0.1)';
                if (status === 'Completed') { sColor = 'var(--success)'; sBg = 'rgba(16,185,129,0.1)'; }
                if (status === 'Cancelled') { sColor = 'var(--danger)'; sBg = 'rgba(239,68,68,0.1)'; }
                if (status === 'Confirmed') { sColor = 'var(--primary)'; sBg = 'rgba(92,103,242,0.1)'; }
                return `<tr>
                    <td><strong>APT-${1000 + i}</strong></td>
                    <td>${ptName}</td>
                    <td>${docName}</td>
                    <td>${a.date || 'Today'} ${a.time ? '@ ' + a.time : ''}</td>
                    <td><span class="badge" style="background:${sBg}; color:${sColor}; padding:4px 8px; font-size:0.8rem;">${status}</span></td>
                    <td>
                        ${status === 'Pending' ? `<button class="btn btn-glass btn-sm" onclick="updateAppointmentStatus(${i}, 'Confirmed')">Confirm</button>` : ''}
                        ${status === 'Confirmed' ? `<button class="btn btn-primary btn-sm" onclick="updateAppointmentStatus(${i}, 'Completed')">Complete</button>` : ''}
                        ${status !== 'Cancelled' && status !== 'Completed' ? `<button class="btn btn-glass btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="updateAppointmentStatus(${i}, 'Cancelled')">Cancel</button>` : ''}
                    </td>
                </tr>`;
            }).join('');
        } else {
            aTbody.innerHTML = generateEmptyState(6, 'fa-calendar-xmark', 'No appointments scheduled.', 'Book an appointment to see it listed here.');
        }
    }


    // Call all sub-renders
    renderDoctorDashboard();
    renderAmbulance();
    renderEquipment();
    renderShifts();
    renderManageStaff();
    renderInventoryAlerts();
    renderPatientFoodOrders();
    renderPatientNurseCalls();
    renderNurseDashboardAlerts();
    renderVitalsPtSelect();
    renderStaffRoster();
    renderBedGrid();
    renderPendingFulfillment();
    renderSampleTracking();
    renderSalaries();
    renderAssets();
    renderAmbulanceFleet();
    renderLabRooms();
}

function updateAppointmentStatus(index, newStatus) {
    const apts = JSON.parse(MemStore.getItem('hms_v2_appointments') || '[]');
    if (apts[index]) {
        apts[index].status = newStatus;
        MemStore.setItem('hms_v2_appointments', JSON.stringify(apts));
        const msgs = { Confirmed: 'Appointment confirmed!', Completed: 'Appointment marked as completed!', Cancelled: 'Appointment cancelled.' };
        showToast(msgs[newStatus] || 'Status updated.', newStatus === 'Cancelled' ? 'warning' : 'success');
        renderLocalData();
    }
}

async function orderFood(item) {
    try {
        await API.food.placeOrder(item);
        showToast(`Order placed for ${item}!`, "success");
        renderPatientFoodOrders();
    } catch (e) {
        showToast("Food order failed: " + e.message, "error");
    }
}


async function triggerNurseCall(priority = 'Normal') {
    try {
        await API.nurse.call(priority);
        showToast(`${priority} Nurse Call Alert Sent!`, priority === 'Emergency' ? "error" : "warning");
        renderPatientNurseCalls();
    } catch (e) {
        showToast("Nurse call failed: " + e.message, "error");
    }
}

function renderDoctorDashboard() {
    if(currentUser.role !== 'Doctor') return;
    
    const localPatients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    const localApts = JSON.parse(MemStore.getItem('hms_v2_appointments') || '[]');
    
    // Count unique patients assigned (based on appointments)
    const myApts = localApts.filter(a => a.doctor === currentUser.name);
    const myPatientNames = new Set(myApts.map(a => a.patient));
    
    const statPts = document.getElementById('doc-stat-patients');
    if(statPts) statPts.innerText = myPatientNames.size || localPatients.length; // fallback to all if no appts
    
    const statApts = document.getElementById('doc-stat-apts');
    if(statApts) statApts.innerText = myApts.length;
    
    const statPending = document.getElementById('doc-stat-pending');
    if(statPending) statPending.innerText = myApts.filter(a => a.status === 'Pending').length;
    
    const statCompleted = document.getElementById('doc-stat-completed');
    if(statCompleted) statCompleted.innerText = myApts.filter(a => a.status === 'Completed').length;
    
    const tbody = document.getElementById('doc-today-apts-dynamic');
    if(tbody) {
        if(myApts.length > 0) {
            tbody.innerHTML = myApts.slice(0, 5).map((a, i) => {
                let badge = `<span class="badge" style="background:rgba(245,158,11,0.1); color:var(--warning)">Pending</span>`;
                if(a.status === 'In Progress') badge = `<span class="badge" style="background:rgba(92,103,242,0.1); color:var(--primary)">In Progress</span>`;
                if(a.status === 'Completed') badge = `<span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success)">Completed</span>`;
                
                return `
                <tr>
                    <td>${a.time}</td>
                    <td><strong>${a.patient}</strong></td>
                    <td><span class="text-xs text-muted"><i class="fa-solid fa-hourglass-half"></i> Wait: ${predictWaitTime(i+1)}</span></td>
                    <td>${badge}</td>
                    <td>
                        <button class="btn btn-glass" style="padding:4px 8px; font-size:0.8rem;" onclick="updateAptStatusByVal('${a.patient}', '${a.time}', 'In Progress')">Start</button>
                        <button class="btn btn-primary" style="padding:4px 8px; font-size:0.8rem;" onclick="updateAptStatusByVal('${a.patient}', '${a.time}', 'Completed')">Finish</button>
                    </td>
                </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No appointments assigned.</td></tr>`;
        }
    }
    
    // Burnout Analytic
    const risk = calculateBurnoutRisk(myApts.length);
    const burnoutEl = document.getElementById('doc-stat-burnout');
    const burnoutIcon = document.getElementById('doc-burnout-icon');
    if(burnoutEl) {
        burnoutEl.innerText = risk.level;
        burnoutEl.style.color = risk.color;
    }
    if(burnoutIcon) {
        burnoutIcon.style.color = risk.color;
        burnoutIcon.style.background = risk.color + '15';
        burnoutIcon.innerHTML = `<i class="fa-solid ${risk.icon}"></i>`;
    }

    // Generate QR for current doctor
    const currentDocId = (JSON.parse(MemStore.getItem('hms_v2_doctors') || '[]').find(d => d.name === currentUser.name) || {id: 'DOC-001'}).id;
    generateStaffQR(currentDocId);
}

function renderDoctorGrid() {
    const dptBody = document.querySelector('#doctor-grid-container');
    if (dptBody) {
        const localDocs = JSON.parse(MemStore.getItem('hms_v2_doctors') || '[]');
        if(localDocs.length > 0) {
            dptBody.innerHTML = localDocs.map((d, index) => {
                const fallbackImg = `https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&q=80`;
                const finalImg = d.photo || fallbackImg;
                return `
                <div class="doc-card">
                   <img src="${finalImg}" alt="Doctor" class="doc-photo">
                   <div class="doc-name">${d.name}</div>
                   <div class="doc-spec">${d.spec}</div>
                   <span class="badge" style="position:static; padding:4px 12px; font-size:0.85rem; border-radius:50px; background:rgba(16,185,129,0.1); color:var(${d.status === 'Available' ? '--success' : '--warning'})">${d.status}</span>
                   <div class="doc-actions">
                       <button class="icon-btn" onclick="editDoctor(${index})" title="Edit"><i class="fa-solid fa-pen" style="color:var(--warning)"></i></button>
                       ${currentUser.role === 'SuperAdmin' ? `<button class="icon-btn" onclick="deleteRecord('hms_v2_doctors', ${index})" title="Delete"><i class="fa-solid fa-trash" style="color:var(--danger)"></i></button>` : ''}
                   </div>
                </div>
            `}).join('');
        } else {
            dptBody.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding: 4rem 1rem;">
                    <i class="fa-solid fa-user-doctor" style="font-size:4rem; color:var(--border-solid); margin-bottom:1.5rem;"></i>
                    <h3 style="color:var(--text-main);">No medical staff added.</h3>
                    <p style="color:var(--text-muted);">Click Add Doctor to populate the directory.</p>
                </div>
            `;
        }
    }
}

function renderPharmacyTable() {
    const pharmBody = document.querySelector('#tbl-pharmacy tbody');
    if (pharmBody) {
        const localPharm = JSON.parse(MemStore.getItem('hms_v2_pharmacy') || '[]');
        if(localPharm.length > 0) {
            pharmBody.innerHTML = localPharm.map((m, index) => `
                <tr>
                   <td><strong>${m.id || 'MED-NEW'}</strong></td><td>${m.name}</td><td>${m.cat}</td>
                   <td>${m.stock < 50 ? `<span style="color:var(--danger)">${m.stock} units (Low)</span>` : `<strong>${m.stock}</strong> units`}</td><td>${m.expiry || 'Dec 2026'}</td>
                   <td>
                       <i class="fa-solid fa-pen-to-square text-warning" onclick="editMedicine(${index})" style="cursor:pointer; margin-right:8px;"></i>
                       <i class="fa-solid fa-trash text-danger" onclick="deleteRecord('hms_v2_pharmacy', ${index})" style="cursor:pointer;"></i>
                   </td>
                </tr>
            `).join('');
        }
    }
}

function renderLabsTable() {
    const labBody = document.querySelector('#tbl-labs tbody');
    if (labBody) {
        const localLabs = JSON.parse(MemStore.getItem('hms_v2_labs') || '[]');
        const filteredLabs = localLabs.filter(l => !(currentUser.role === 'Patient' && l.patient !== currentUser.name));
        if (filteredLabs.length > 0) {
            labBody.innerHTML = filteredLabs.map((l, index) => `
                <tr>
                   <td><strong>${l.id || 'LAB-NEW'}</strong></td><td>${l.patient}</td><td>${l.test}</td><td>${l.date || 'Today'}</td>
                   <td><span class="badge" style="background:rgba(245,158,11,0.1); color:var(${l.status === 'Pending' ? '--warning' : '--success'})">${l.status || 'Pending'}</span></td>
                   <td>
                       <i class="fa-solid fa-id-card text-primary" onclick="viewPatient360ByVal('${l.patient}')" style="cursor:pointer; margin-right:8px;" title="View 360 Profile"></i>
                       ${currentUser.role === 'Lab Technician' && l.status !== 'Completed' ? `<i class="fa-solid fa-circle-check text-success" onclick="handleCompleteReport('${l.id}')" style="cursor:pointer; margin-right:8px;" title="Complete Report"></i>` : ''}
                       <i class="fa-solid fa-pen-to-square text-warning" onclick="editLab(${index})" style="cursor:pointer; margin-right:8px;"></i>
                       <i class="fa-solid fa-trash text-danger" onclick="deleteRecord('hms_v2_labs', ${index})" style="cursor:pointer;"></i>
                   </td>
                </tr>
            `).join('');
        }
    }
}

function renderBillingTable() {
    const billBody = document.querySelector('#tbl-billing tbody');
    if (billBody) {
        const localBills = JSON.parse(MemStore.getItem('hms_v2_billing') || '[]');
        const filteredBills = localBills.filter(b => !(currentUser.role === 'Patient' && b.patient !== currentUser.name));
        if (filteredBills.length > 0) {
            billBody.innerHTML = filteredBills.map((b, index) => `
                <tr>
                   <td><strong>${b.id || 'INV-NEW'}</strong></td><td>${b.patient}</td><td>${b.service}</td><td>₹${parseFloat(b.amount).toFixed(2)}</td>
                   <td><span class="badge" style="background:rgba(16,185,129,0.1); color:var(${b.status === 'Paid' ? '--success' : '--warning'})">${b.status || 'Unpaid'}</span></td>
                   <td>
                       <i class="fa-solid fa-id-card text-primary" onclick="viewPatient360ByVal('${b.patient}')" style="cursor:pointer; margin-right:8px;" title="View 360 Profile"></i>
                       <i class="fa-solid fa-eye text-primary" onclick="viewInvoice(${index})" style="cursor:pointer; margin-right:8px;" title="Print Invoice"></i>
                       <i class="fa-solid fa-pen-to-square text-warning" onclick="editInvoice(${index})" style="cursor:pointer; margin-right:8px;" title="Edit"></i>
                       <i class="fa-solid fa-trash text-danger" onclick="deleteRecord('hms_v2_billing', ${index})" style="cursor:pointer;" title="Delete"></i>
                   </td>
                </tr>
            `).join('');
        }
    }
}

function handleAutoPopulate() {
    // Auto-populate all patient selections
    const selects = document.querySelectorAll('.dynamic-patient-select');
    const allPts = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    const ptOptions = allPts.map(p => `<option value="${p.fname} ${p.lname}">${p.fname} ${p.lname} [${p.patientId}]</option>`).join('');
    selects.forEach(s => { 
        const currentVal = s.value;
        s.innerHTML = (ptOptions ? '<option value="">Select Patient...</option>' + ptOptions : '<option value="">No Patients Available</option>'); 
        if(currentVal) s.value = currentVal;
    });

    // Populate Salary Staff Select
    const salSelect = document.getElementById('sal-staff-id');
    if(salSelect) {
        const staffDocs = JSON.parse(MemStore.getItem('hms_v2_doctors') || '[]');
        salSelect.innerHTML = '<option value="">Select Staff...</option>' + staffDocs.map(d => `<option value="${d.id}">${d.name} (${d.role})</option>`).join('');
    }

    // Populate Appointment Registry
    const aptPtSelect = document.getElementById('bk-apt-pt');
    if(aptPtSelect) {
        aptPtSelect.innerHTML = '<option value="">Select Patient...</option>' + allPts.map(p => `<option value="${p.fname} ${p.lname}">${p.fname} ${p.lname}</option>`).join('');
    }
    const aptDocSelect = document.getElementById('bk-apt-doc');
    if(aptDocSelect) {
        const staffDocs = JSON.parse(MemStore.getItem('hms_v2_doctors') || '[]');
        aptDocSelect.innerHTML = '<option value="">Select Doctor...</option>' + staffDocs.filter(d => d.role === 'Doctor').map(d => `<option value="${d.name}">${d.name} (${d.department || 'General'})</option>`).join('');
    }
}

function renderSalaries() {
    const list = document.getElementById('admin-salary-list');
    if(!list) return;
    const salaries = JSON.parse(MemStore.getItem('hms_v2_salaries') || '[]');
    if(salaries.length > 0) {
        list.innerHTML = salaries.map(s => `
            <div class="flex justify-between items-center p-3 rounded" style="background:rgba(255,255,255,0.05);">
                <div>
                   <strong style="color:var(--text-main)">${s.staffId}</strong>
                   <div style="font-size:0.75rem; color:var(--text-muted)">Disbursed on: ${s.date}</div>
                </div>
                <div style="text-align:right">
                    <div style="color:var(--success); font-weight:bold;">₹${parseInt(s.amount).toLocaleString()}</div>
                    <span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success)">Paid</span>
                </div>
            </div>
        `).join('');
    } else {
        list.innerHTML = '<div class="text-muted text-center py-4">No recent disbursements.</div>';
    }
}

function renderAssets() {
    const list = document.getElementById('admin-asset-list');
    if(!list) return;
    const assets = JSON.parse(MemStore.getItem('hms_v2_assets') || '[]');
    if(assets.length > 0) {
        list.innerHTML = assets.map(a => `
            <div class="flex justify-between items-center p-3 rounded" style="background:rgba(255,255,255,0.05);">
                <div>
                   <strong style="color:var(--text-main)">${a.name}</strong>
                   <div style="font-size:0.75rem; color:var(--text-muted)">S/N: ${a.serial} | ${a.category}</div>
                </div>
                <div><span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success)">${a.status}</span></div>
            </div>
        `).join('');
    } else {
        list.innerHTML = '<div class="text-muted text-center py-4">No assets registered.</div>';
    }
}

function renderAmbulanceFleet() {
    const list = document.getElementById('admin-ambulance-list');
    if(!list) return;
    const fleet = JSON.parse(MemStore.getItem('hms_v2_fleet') || '[]');
    if(fleet.length > 0) {
        list.innerHTML = fleet.map(v => `
            <div class="flex justify-between items-center p-3 rounded" style="background:rgba(255,255,255,0.05);">
                <div>
                   <strong style="color:var(--text-main)">${v.plate}</strong>
                   <div style="font-size:0.75rem; color:var(--text-muted)">Driver: ${v.driver} | ${v.type}</div>
                </div>
                <div><span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success)">${v.status}</span></div>
            </div>
        `).join('');
    } else {
        list.innerHTML = '<div class="text-muted text-center py-4">No vehicles in fleet.</div>';
    }
}

function renderLabRooms() {
    const list = document.getElementById('admin-lab-list');
    if(!list) return;
    // Mock lab rooms if not in LS
    let rooms = JSON.parse(MemStore.getItem('hms_v2_lab_rooms'));
    if(!rooms) {
        rooms = [
            { id: 'L-01', name: 'X-Ray Lab', status: 'Available' },
            { id: 'L-02', name: 'Blood Bank', status: 'Busy' },
            { id: 'L-03', name: 'MRI Scan', status: 'Maintenance' }
        ];
        MemStore.setItem('hms_v2_lab_rooms', JSON.stringify(rooms));
    }
    list.innerHTML = rooms.map(r => `
        <div class="flex justify-between items-center p-3 rounded" style="background:rgba(255,255,255,0.05);">
            <div>
               <strong style="color:var(--text-main)">${r.name}</strong>
               <div style="font-size:0.75rem; color:var(--text-muted)">Room ID: ${r.id}</div>
            </div>
            <div>
               <span class="badge" style="background:${r.status === 'Available' ? 'rgba(16,185,129,0.1)' : (r.status === 'Busy' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)')}; color:var(${r.status === 'Available' ? '--success' : (r.status === 'Busy' ? '--danger' : '--warning')})">${r.status}</span>
            </div>
        </div>
    `).join('');
}

function handleGlobalSearch(query) {
    const dropdown = document.getElementById('search-results-dropdown');
    const queryLC = query.toLowerCase();

    // 1. Search Patients
    const patients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    const ptResults = patients.filter(p => 
        p.fname.toLowerCase().includes(queryLC) || 
        p.lname.toLowerCase().includes(queryLC) ||
        p.patientId.toLowerCase().includes(queryLC)
    ).map(p => ({ ...p, type: 'Patient', title: `${p.fname} ${p.lname}`, sub: p.disease, id: p.patientId }));

    // 2. Search Appointments
    const apts = JSON.parse(MemStore.getItem('hms_v2_appointments') || '[]');
    const aptResults = apts.filter(a => a.patient.toLowerCase().includes(queryLC) || a.doctor.toLowerCase().includes(queryLC))
        .map(a => ({ type: 'Appointment', title: `Apt: ${a.patient}`, sub: `${a.date} w/ ${a.doctor}`, id: a.patient }));

    // 3. Search Lab Reports
    const labs = JSON.parse(MemStore.getItem('hms_v2_labs') || '[]');
    const labResults = labs.filter(l => l.patient.toLowerCase().includes(queryLC) || l.test.toLowerCase().includes(queryLC))
        .map(l => ({ type: 'Lab', title: `Test: ${l.test}`, sub: `Patient: ${l.patient}`, id: l.patient }));

    const combined = [...ptResults, ...aptResults, ...labResults].slice(0, 10);

    if(combined.length > 0) {
        dropdown.classList.remove('hidden');
        dropdown.innerHTML = combined.map(item => `
            <div class="search-item" onclick="viewPatient360ByVal('${item.id}')" style="padding: 1rem; border-bottom: 1px solid var(--border-solid); cursor:pointer; transition:0.2s;" onmouseover="this.style.background='rgba(92, 103, 242, 0.1)'" onmouseout="this.style.background=''">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="flex items-center gap-2">
                        <div class="stat-icon" style="width:32px; height:32px; font-size:0.8rem; border-radius:8px;">
                            <i class="fa-solid ${item.type === 'Patient' ? 'fa-user' : (item.type === 'Appointment' ? 'fa-calendar' : 'fa-vial')}"></i>
                        </div>
                        <div>
                            <strong style="color:var(--text-main)">${item.title}</strong>
                            <div class="text-xs text-muted">${item.sub}</div>
                        </div>
                    </div>
                    <span class="badge" style="background:var(--primary); color:white; font-size:0.7rem; position:static;">${item.type}</span>
                </div>
            </div>
        `).join('');
    } else {
        dropdown.innerHTML = `<div style="padding:1.5rem; text-align:center; color:var(--text-muted);">No matching records found.</div>`;
        dropdown.classList.remove('hidden');
    }
}

function viewPatient360(patientId) {
    renderPatient360(patientId);
}

function renderAmbulance() {
    const tbody = document.querySelector('#tbl-ambulance tbody');
    if(!tbody) return;
    const reqs = JSON.parse(MemStore.getItem('hms_v2_ambulance') || '[]');
    const statEl = document.getElementById('stat-amb-active');
    if(statEl) statEl.innerText = reqs.filter(r => r.status !== 'Completed').length;
    
    if(reqs.length > 0) {
        tbody.innerHTML = reqs.map((r, i) => `
            <tr>
                <td><strong>AMB-${1000 + i}</strong></td>
                <td>${r.patient}</td>
                <td>${r.driver}</td>
                <td><span class="badge" style="background:rgba(239,68,68,0.1); color:var(--danger)">${r.status}</span></td>
                <td><button class="btn btn-glass" onclick="updateAmbStatus(${i}, 'Completed')">Complete</button></td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">No active ambulance requests.</td></tr>`;
    }
}

function renderEquipment() {
    const tbody = document.querySelector('#tbl-equipment tbody');
    if(!tbody) return;
    const items = JSON.parse(MemStore.getItem('hms_v2_equipment') || '[]');
    if(items.length > 0) {
        tbody.innerHTML = items.map((e, i) => `
            <tr>
                <td><strong>${e.name}</strong></td>
                <td>${e.cat}</td>
                <td><code>${e.serial}</code></td>
                <td><span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success)">Available</span></td>
                <td>Main Store</td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">Inventory is currently empty.</td></tr>`;
    }
}

function renderShifts() {
    const tbody = document.querySelector('#tbl-shifts tbody');
    if(!tbody) return;
    const shifts = JSON.parse(MemStore.getItem('hms_v2_shifts') || '[]');
    if(shifts.length > 0) {
        tbody.innerHTML = shifts.map(s => `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td>Medical Staff</td>
                <td>${s.type}</td>
                <td>${s.type === 'Morning' ? '08:00 - 16:00' : (s.type === 'Evening' ? '16:00 - 00:00' : '00:00 - 08:00')}</td>
                <td><span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success)">On Duty</span></td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">No shifts assigned for today.</td></tr>`;
    }
}

function handleRequestAmbulance(e) {
    e.preventDefault();
    const reqs = JSON.parse(MemStore.getItem('hms_v2_ambulance') || '[]');
    reqs.push({
        patient: document.getElementById('amb-patient').value,
        driver: document.getElementById('amb-driver').value,
        status: 'Dispatched',
        date: new Date().toISOString()
    });
    MemStore.setItem('hms_v2_ambulance', JSON.stringify(reqs));
    showToast("Ambulance Dispatched!", "error");
    closeModal('modal-request-ambulance');
    renderAmbulance();
}

function handleAddEquipment(e) {
    e.preventDefault();
    const items = JSON.parse(MemStore.getItem('hms_v2_equipment') || '[]');
    items.push({
        name: document.getElementById('eq-name').value,
        cat: document.getElementById('eq-cat').value,
        serial: document.getElementById('eq-serial').value
    });
    MemStore.setItem('hms_v2_equipment', JSON.stringify(items));
    showToast("Asset Registered!", "success");
    closeModal('modal-add-equipment');
    renderEquipment();
}

function handleAddShift(e) {
    e.preventDefault();
    const shifts = JSON.parse(MemStore.getItem('hms_v2_shifts') || '[]');
    shifts.push({
        name: document.getElementById('sh-name').value,
        type: document.getElementById('sh-type').value
    });
    MemStore.setItem('hms_v2_shifts', JSON.stringify(shifts));
    showToast("Shift Assigned!", "success");
    closeModal('modal-add-shift');
    renderShifts();
}

function updateAmbStatus(idx, status) {
    const reqs = JSON.parse(MemStore.getItem('hms_v2_ambulance') || '[]');
    reqs[idx].status = status;
    MemStore.setItem('hms_v2_ambulance', JSON.stringify(reqs));
    renderAmbulance();
}

// ==========================================
// STAFF & INVENTORY DASHBOARD HELPERS
// ==========================================
function renderManageStaff() {
    const tbody = document.querySelector('#tbl-manage-staff tbody');
    if(!tbody) return;
    
    // Logic: Combine doctors and potentially other staff
    const docs = JSON.parse(MemStore.getItem('hms_v2_doctors') || '[]');
    const shifts = JSON.parse(MemStore.getItem('hms_v2_shifts') || '[]');
    
    if(docs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No staff records to display.</td></tr>`;
        return;
    }

    tbody.innerHTML = docs.map(d => {
        const shift = shifts.find(s => s.name === d.name) || { type: 'Not Assigned' };
        return `
            <tr>
                <td><strong>${d.name}</strong></td>
                <td>${d.spec}</td>
                <td><span class="badge" style="background:rgba(92,103,242,0.1); color:var(--primary)">${shift.type}</span></td>
                <td><span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success)">${d.status}</span></td>
            </tr>
        `;
    }).join('');
}

function suggestBed(urgency) {
    const beds = JSON.parse(MemStore.getItem('hms_v2_beds') || '[]');
    const available = beds.filter(b => b.status === 'Available');
    if (available.length === 0) return null;
    
    if(urgency === 'Critical') {
        const icu = available.find(b => b.number.startsWith('ICU') || b.number.includes('ER'));
        if(icu) return icu;
    }
    return available[0];
}

function handleSmartAllocateBed(patientName, urgency) {
    const bed = suggestBed(urgency);
    if (!bed) {
        showToast("No beds available for allocation.", "error");
        return;
    }
    
    const beds = JSON.parse(MemStore.getItem('hms_v2_beds') || '[]');
    const bedIdx = beds.findIndex(b => b.number === bed.number);
    if(bedIdx > -1) {
        beds[bedIdx].status = 'Occupied';
        beds[bedIdx].patient = patientName;
        MemStore.setItem('hms_v2_beds', JSON.stringify(beds));
        
        showToast(`Patient ${patientName} allocated to ${bed.number} automatically.`, "success");
        renderLocalData();
        fetchDashboardData();
    }
}

function renderInventoryAlerts() {
    const list = document.getElementById('inv-alerts-list');
    if(!list) return;
    
    const pharma = JSON.parse(MemStore.getItem('hms_v2_pharmacy') || '[]');
    const lowStock = pharma.filter(m => parseInt(m.stock) < 50);
    
    if(lowStock.length > 0) {
        list.innerHTML = lowStock.map(p => `
            <div class="glass-card" style="padding:1rem; border-left:4px solid var(--danger);">
                <div class="flex justify-between items-center">
                    <div>
                        <strong class="text-danger">${p.name}</strong><br>
                        <span class="text-sm text-muted">Category: ${p.cat}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:1.5rem; font-weight:bold; color:var(--danger);">${p.stock}</span><br>
                        <span class="text-xs text-muted">units left</span>
                    </div>
                </div>
            </div>
        `).join('');
    } else {
        list.innerHTML = `
            <div class="glass-card text-center" style="padding:2rem;">
                <i class="fa-solid fa-check-circle text-success" style="font-size:2rem; margin-bottom:1rem;"></i>
                <h4 style="color:var(--text-main);">Inventory is Healthy</h4>
                <p class="text-muted text-sm" style="margin:0;">No items are currently running low on stock.</p>
            </div>
        `;
    }
}


// ==========================================
// MODAL & CRUD HANDLERS
// ==========================================
window.currentEditState = null;

function deleteRecord(storageKey, index) {
    if(confirm("Are you sure you want to permanently delete this record?")) {
        const data = JSON.parse(MemStore.getItem(storageKey) || '[]');
        data.splice(index, 1);
        MemStore.setItem(storageKey, JSON.stringify(data));
        showToast("Record successfully deleted.", "success");
        renderLocalData();
        fetchDashboardData();
    }
}

function openModal(id) {
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
    window.currentEditState = null; // Clean up edit state
}

function handleLogic(e, storageKey, modalId, dataObj, successMsg) {
    e.preventDefault();
    const records = JSON.parse(MemStore.getItem(storageKey) || '[]');
    
    if (window.currentEditState && window.currentEditState.key === storageKey) {
        records[window.currentEditState.index] = { ...records[window.currentEditState.index], ...dataObj };
        showToast("Record updated successfully!", "success");
    } else {
        records.unshift(dataObj);
        showToast(successMsg, "success");
    }
    
    MemStore.setItem(storageKey, JSON.stringify(records));
    closeModal(modalId);
    e.target.reset();
    renderLocalData();
    fetchDashboardData();
}

function previewPatientPhoto(e) {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            const b64 = evt.target.result;
            document.getElementById('pt-preview').innerHTML = `<img src="${b64}" style="width:100%; height:100%; object-fit:cover;">`;
            document.getElementById('pt-photo-base64').value = b64;
        };
        reader.readAsDataURL(file);
    }
}

async function handleRegisterPatient(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orgText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing AI Routing...';

    const data = {
        fname: document.getElementById('pt-fname').value,
        lname: document.getElementById('pt-lname').value,
        age: document.getElementById('pt-age').value,
        gender: 'Not Specified', // Default or add field
        phone: 'Not Provided',
        email: 'Not Provided',
        symptoms: document.getElementById('pt-disease').value, // Using disease field for symptoms
    };

    try {
        const res = await API.patients.create(data);
        showToast(res.message, "success");
        if(res.assigned_doctor) {
            showToast(`Symptom matching complete. Assigned to ${res.assigned_doctor}.`, "info");
        }
        closeModal('modal-add-patient');
        e.target.reset();
        renderLocalData();
        fetchDashboardData();
    } catch (err) {
        showToast("Registration failed: " + err.message, "error");
    } finally {
        btn.innerHTML = orgText;
    }
}

function editPatient(idx) {
    const data = JSON.parse(MemStore.getItem('hms_v2_patients'))[idx];
    document.getElementById('pt-fname').value = data.fname || '';
    document.getElementById('pt-lname').value = data.lname || '';
    document.getElementById('pt-age').value = data.age || '';
    document.getElementById('pt-status').value = data.status || 'Active Treatment';
    document.getElementById('pt-disease').value = data.disease || '';
    
    if(data.photo) {
        document.getElementById('pt-preview').innerHTML = `<img src="${data.photo}" style="width:100%; height:100%; object-fit:cover;">`;
        document.getElementById('pt-photo-base64').value = data.photo;
    } else {
        document.getElementById('pt-preview').innerHTML = '<i class="fa-solid fa-user text-muted fa-2x"></i>';
        document.getElementById('pt-photo-base64').value = '';
    }
    
    window.currentEditState = { key: 'hms_v2_patients', index: idx };
    openModal('modal-add-patient');
}

// --- SYSTEM SETTINGS ---
function previewSettingsLogo(e) {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            const b64 = evt.target.result;
            document.getElementById('preview-settings-logo').innerHTML = `<img src="${b64}" style="width:100%; height:100%; object-fit:contain;">`;
            document.getElementById('setting-logo-base64').value = b64;
        };
        reader.readAsDataURL(file);
    }
}

function saveSettings() {
    const settings = {
        hospName: document.getElementById('setting-hosp-name').value || 'Luxury Care',
        hospAddress: document.getElementById('setting-hosp-address').value,
        hospPhone: document.getElementById('setting-hosp-phone').value,
        colorPrimary: document.getElementById('setting-color-primary').value || '#5c67f2',
        logoBase64: document.getElementById('setting-logo-base64').value || ''
    };
    MemStore.setItem('hms_v2_settings', JSON.stringify(settings));
    showToast("Global Settings applied instantly!", "success");
    applySettings();
}

function applySettings() {
    const s = JSON.parse(MemStore.getItem('hms_v2_settings'));
    if(!s) return;
    
    if(s.colorPrimary) {
        document.documentElement.style.setProperty('--primary', s.colorPrimary);
        document.documentElement.style.setProperty('--primary-light', s.colorPrimary + '40'); // approximated alpha
    }
    if(s.hospName) {
        const hNameDisplay = document.getElementById('display-hospital-name');
        if(hNameDisplay) hNameDisplay.innerText = s.hospName;
        
        const loginHName = document.getElementById('login-hospital-name');
        if(loginHName) loginHName.innerText = s.hospName;

        document.querySelectorAll('.landing-brand').forEach(b => {
             b.innerHTML = `<i class="fa-solid fa-heart-pulse"></i> ` + s.hospName;
        });
    }
    if(s.logoBase64 && s.logoBase64.startsWith('data:image')) {
        const hImgDisplay = document.getElementById('display-hospital-img');
        const hIconDisplay = document.getElementById('display-hospital-logo');
        if(hImgDisplay) {
            hImgDisplay.src = s.logoBase64;
            hImgDisplay.style.display = 'block';
            if(hIconDisplay) hIconDisplay.style.display = 'none';
        }
        
        const setImg = document.getElementById('preview-settings-logo');
        if(setImg) setImg.innerHTML = `<img src="${s.logoBase64}" style="width:100%; height:100%; object-fit:contain;">`;
        const setBgInput = document.getElementById('setting-logo-base64');
        if(setBgInput) setBgInput.value = s.logoBase64;
    }
    
    // Pre-fill fields if in settings view
    const setFormName = document.getElementById('setting-hosp-name');
    if(setFormName) setFormName.value = s.hospName || '';
    const setFormAddr = document.getElementById('setting-hosp-address');
    if(setFormAddr) setFormAddr.value = s.hospAddress || '';
    const setFormPhone = document.getElementById('setting-hosp-phone');
    if(setFormPhone) setFormPhone.value = s.hospPhone || '';
    const setFormCol = document.getElementById('setting-color-primary');
    if(setFormCol) setFormCol.value = s.colorPrimary || '#5c67f2';
    const setFormHex = document.getElementById('setting-color-hex');
    if(setFormHex) setFormHex.value = s.colorPrimary || '#5c67f2';
}

function handleBookAppointment(e) {
    handleLogic(e, 'hms_v2_appointments', 'modal-quick-action', {
        patient: document.getElementById('apt-patient').value,
        doctor: document.getElementById('apt-doctor').value,
        date: document.getElementById('apt-date').value,
        time: document.getElementById('apt-time').value
    }, 'Appointment booked!');
}

function editAppointment(idx) {
    const data = JSON.parse(MemStore.getItem('hms_v2_appointments'))[idx];
    document.getElementById('apt-patient').value = data.patient;
    document.getElementById('apt-doctor').value = data.doctor;
    document.getElementById('apt-date').value = data.date;
    document.getElementById('apt-time').value = data.time;
    window.currentEditState = { key: 'hms_v2_appointments', index: idx };
    openModal('modal-quick-action');
}

function previewDoctorPhoto(e) {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            const b64 = evt.target.result;
            document.getElementById('doc-preview').innerHTML = `<img src="${b64}" style="width:100%; height:100%; object-fit:cover;">`;
            document.getElementById('doc-photo-base64').value = b64;
        };
        reader.readAsDataURL(file);
    }
}

function handleRegisterDoctor(e) {
    handleLogic(e, 'hms_v2_doctors', 'modal-add-doctor', {
        id: `DOC-${Math.floor(Math.random()*900)+100}`,
        name: document.getElementById('doc-name').value,
        spec: document.getElementById('doc-spec').value,
        phone: document.getElementById('doc-phone').value,
        status: 'Available',
        photo: document.getElementById('doc-photo-base64').value || ''
    }, 'Doctor Registered');
    
    // reset preview manually
    document.getElementById('doc-preview').innerHTML = '<i class="fa-solid fa-camera" style="color:var(--text-muted)"></i>';
    document.getElementById('doc-photo-base64').value = '';
}

function editDoctor(idx) {
    const data = JSON.parse(MemStore.getItem('hms_v2_doctors'))[idx];
    document.getElementById('doc-name').value = data.name;
    document.getElementById('doc-spec').value = data.spec;
    document.getElementById('doc-phone').value = data.phone;
    
    if(data.photo) {
        document.getElementById('doc-preview').innerHTML = `<img src="${data.photo}" style="width:100%; height:100%; object-fit:cover;">`;
        document.getElementById('doc-photo-base64').value = data.photo;
    } else {
        document.getElementById('doc-preview').innerHTML = '<i class="fa-solid fa-camera" style="color:var(--text-muted)"></i>';
        document.getElementById('doc-photo-base64').value = '';
    }
    
    window.currentEditState = { key: 'hms_v2_doctors', index: idx };
    openModal('modal-add-doctor');
}

// ==========================================
// NEW MODULE HANDLERS (Pharmacy, Lab, Billing)
// ==========================================
function checkDrugInteraction(medsText, ptName) {
    const knownConflicts = [
        { d1: 'Aspirin', d2: 'Warfarin', risk: 'High', msg: 'Increased risk of bleeding.' },
        { d1: 'Metformin', d2: 'Contrast', risk: 'Moderate', msg: 'Potential kidney strain.' },
        { d1: 'Sildenafil', d2: 'Nitroglycerin', risk: 'Critical', msg: 'Severe drop in blood pressure.' }
    ];
    
    const allRx = JSON.parse(MemStore.getItem('hms_v2_prescriptions') || '[]');
    const ptMeds = allRx.filter(r => r.patient === ptName).map(r => r.meds).join('\n');
    
    const conflictsFound = [];
    knownConflicts.forEach(c => {
        const hasD1 = medsText.toLowerCase().includes(c.d1.toLowerCase()) || ptMeds.toLowerCase().includes(c.d1.toLowerCase());
        const hasD2 = medsText.toLowerCase().includes(c.d2.toLowerCase()) || ptMeds.toLowerCase().includes(c.d2.toLowerCase());
        
        const bothInNew = medsText.toLowerCase().includes(c.d1.toLowerCase()) && medsText.toLowerCase().includes(c.d2.toLowerCase());
        const splitConflict = (medsText.toLowerCase().includes(c.d1.toLowerCase()) && ptMeds.toLowerCase().includes(c.d2.toLowerCase())) ||
                             (medsText.toLowerCase().includes(c.d2.toLowerCase()) && ptMeds.toLowerCase().includes(c.d1.toLowerCase()));
        
        if(bothInNew || splitConflict) {
            conflictsFound.push(c);
        }
    });
    
    return conflictsFound;
}

function handleSavePrescription(e) {
    e.preventDefault();
    const rxPatient = document.getElementById('rx-patient').value;
    const diagnosis = document.getElementById('rx-diagnosis').value;
    const meds = document.getElementById('rx-meds').value;
    const notes = document.getElementById('rx-notes').value;

    const conflicts = checkDrugInteraction(meds, rxPatient);
    if(conflicts.length > 0) {
        const confirmMsg = conflicts.map(c => `⚠️ [${c.risk}] ${c.d1} + ${c.d2}: ${c.msg}`).join('\n');
        if(!confirm(confirmMsg + '\n\nDo you want to proceed anyway? (Not recommended)')) {
            return;
        }
    }

    const prescriptions = JSON.parse(MemStore.getItem('hms_v2_prescriptions') || '[]');
    prescriptions.unshift({
        id: 'RX-' + Math.floor(Math.random()*9000),
        patient: rxPatient,
        doctor: currentUser.name,
        diagnosis: diagnosis,
        meds: meds,
        notes: notes,
        date: new Date().toLocaleDateString('en-IN', {day:'numeric', month:'short'})
    });
    MemStore.setItem('hms_v2_prescriptions', JSON.stringify(prescriptions));
    showToast("Prescription issued and synced to Patient Portal successfully!", "success");
    closeModal('modal-add-prescription');
    e.target.reset();
}

function saveQuickNote() {
    const patient = document.getElementById('doc-quick-note-patient').value;
    const text = document.getElementById('doc-quick-note-text').value;
    if(!text || !patient) { showToast("Select patient and write a note.", "warning"); return; }
    
    const notesArr = JSON.parse(MemStore.getItem('hms_v2_notes') || '[]');
    notesArr.unshift({ patient, doctor: currentUser.name, text, date: new Date().toLocaleString() });
    MemStore.setItem('hms_v2_notes', JSON.stringify(notesArr));
    
    document.getElementById('doc-quick-note-text').value = '';
    showToast("Clinical note attached to patient record.", "success");
}

function updateAptStatusByVal(patient, time, status) {
    const apts = JSON.parse(MemStore.getItem('hms_v2_appointments') || '[]');
    const idx = apts.findIndex(a => a.patient === patient && a.time === time);
    if(idx > -1) {
        apts[idx].status = status;
        MemStore.setItem('hms_v2_appointments', JSON.stringify(apts));
        showToast("Consultation status updated to: " + status, "success");
        renderLocalData(); 
    }
}

function handleRegisterMedicine(e) {
    handleLogic(e, 'hms_v2_pharmacy', 'modal-add-medicine', {
        id: `MED-${Math.floor(Math.random()*900)+100}`,
        name: document.getElementById('med-name').value,
        cat: document.getElementById('med-cat').value,
        stock: parseInt(document.getElementById('med-stock').value),
        expiry: 'Dec 2026'
    }, 'Medication Added');
}

function editMedicine(idx) {
    const data = JSON.parse(MemStore.getItem('hms_v2_pharmacy'))[idx];
    document.getElementById('med-name').value = data.name;
    document.getElementById('med-cat').value = data.cat;
    document.getElementById('med-stock').value = data.stock;
    window.currentEditState = { key: 'hms_v2_pharmacy', index: idx };
    openModal('modal-add-medicine');
}

function handleCreateReport(e) {
    handleLogic(e, 'hms_v2_labs', 'modal-create-report', {
        id: `LAB-${Math.floor(Math.random()*900)+100}`,
        patient: document.getElementById('lab-patient').value,
        test: document.getElementById('lab-test').value,
        date: 'Just Now',
        status: 'Pending'
    }, 'Lab Report Requested');
}

function editLab(idx) {
    const data = JSON.parse(MemStore.getItem('hms_v2_labs'))[idx];
    document.getElementById('lab-patient').value = data.patient;
    document.getElementById('lab-test').value = data.test;
    window.currentEditState = { key: 'hms_v2_labs', index: idx };
    openModal('modal-create-report');
}

function calcTotal() {
    const consult = parseFloat(document.getElementById('inv-consult').value || 0);
    const lab = parseFloat(document.getElementById('inv-lab').value || 0);
    const meds = parseFloat(document.getElementById('inv-meds').value || 0);
    const taxRate = parseFloat(document.getElementById('inv-tax').value || 0);
    
    const sub = consult + lab + meds;
    const tax = sub * (taxRate / 100);
    const total = sub + tax;
    
    document.getElementById('inv-total-display').innerText = total.toFixed(2);
    document.getElementById('inv-amount').value = total.toFixed(2);
}

function handleGenerateInvoice(e) {
    handleLogic(e, 'hms_v2_billing', 'modal-generate-invoice', {
        id: `INV-${Math.floor(Math.random()*9000)+1000}`,
        patient: document.getElementById('inv-patient').value,
        service: "Medical Services",
        consult: document.getElementById('inv-consult').value,
        lab: document.getElementById('inv-lab').value,
        meds: document.getElementById('inv-meds').value,
        tax: document.getElementById('inv-tax').value,
        amount: parseFloat(document.getElementById('inv-amount').value),
        status: 'Unpaid',
        date: new Date().toLocaleDateString()
    }, 'Invoice Generated');
}

function editInvoice(idx) {
    const data = JSON.parse(MemStore.getItem('hms_v2_billing'))[idx];
    document.getElementById('inv-patient').value = data.patient;
    document.getElementById('inv-consult').value = data.consult || 0;
    document.getElementById('inv-lab').value = data.lab || 0;
    document.getElementById('inv-meds').value = data.meds || 0;
    document.getElementById('inv-tax').value = data.tax || 0;
    calcTotal();
    window.currentEditState = { key: 'hms_v2_billing', index: idx };
    openModal('modal-generate-invoice');
}

function viewInvoice(idx) {
    const data = JSON.parse(MemStore.getItem('hms_v2_billing'))[idx];
    document.getElementById('print-inv-id').innerText = data.id;
    document.getElementById('print-inv-date').innerText = data.date || new Date().toLocaleDateString();
    document.getElementById('print-inv-patient').innerText = data.patient;
    
    document.getElementById('print-inv-consult').innerText = `₹${parseFloat(data.consult || 0).toFixed(2)}`;
    document.getElementById('print-inv-lab').innerText = `₹${parseFloat(data.lab || 0).toFixed(2)}`;
    document.getElementById('print-inv-meds').innerText = `₹${parseFloat(data.meds || 0).toFixed(2)}`;
    
    const sub = parseFloat(data.consult||0) + parseFloat(data.lab||0) + parseFloat(data.meds||0);
    const t = sub * (parseFloat(data.tax||0) / 100);
    document.getElementById('print-inv-tax').innerText = `₹${t.toFixed(2)} (${data.tax||0}%)`;
    
    document.getElementById('print-inv-total').innerText = `₹${parseFloat(data.amount).toFixed(2)}`;
    
    const payBtn = document.getElementById('btn-invoice-pay-now');
    if(payBtn) {
        if(data.status !== 'Paid') {
            payBtn.classList.remove('hidden');
            payBtn.onclick = () => openPaymentGateway(data.id, data.amount);
        } else {
            payBtn.classList.add('hidden');
        }
    }

    openModal('modal-view-invoice');
}

function openPaymentGateway(orderId, amount) {
    document.getElementById('pay-order-id').innerText = orderId;
    document.getElementById('pay-amount-display').innerText = `₹${parseFloat(amount).toLocaleString()}`;
    openModal('modal-payment-gateway');
}

function printInvoice() {
    const printContent = document.getElementById('print-invoice-area').innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    location.reload(); 
}


// ==========================================
// CUSTOMIZATION & THEME HANDLERS
// ==========================================
function toggleThemePanel() {
    document.getElementById('theme-panel').classList.toggle('open');
}

function setThemeColor(primary, dark, save=true) {
    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--primary-dark', dark);
    
    // calculate a light version
    document.documentElement.style.setProperty('--primary-light', primary + '99'); // Add hex alpha 60%
    
    if(save) {
        MemStore.setItem('hms_theme_color', JSON.stringify({ primary, primaryDark: dark }));
        showToast("Theme Accent Updated!", "success");
    }
}

function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    const icon = document.getElementById('dark-mode-icon');
    
    if (isDark) {
        html.setAttribute('data-theme', 'light');
        icon.className = 'fa-solid fa-moon';
        MemStore.setItem('hms_dark_mode', 'false');
        showToast("Switched to Light Mode", "success");
    } else {
        html.setAttribute('data-theme', 'dark');
        icon.className = 'fa-solid fa-sun';
        MemStore.setItem('hms_dark_mode', 'true');
        showToast("Switched to Dark Mode", "success");
    }
}

function saveHospitalBrand() {
    const name = document.getElementById('hs-name-input').value || "Nexus HMS";
    const address = document.getElementById('hs-address-input').value || "";
    const fileInput = document.getElementById('hs-logo-upload');
    
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgData = e.target.result;
            applyBrandUpdate(name, address, imgData);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        const existing = JSON.parse(MemStore.getItem('hms_hospital_brand') || '{}');
        applyBrandUpdate(name, address, existing.img || null);
    }
}

function applyBrandUpdate(name, address, imgData) {
    document.getElementById('display-hospital-name').innerText = name;
    
    const addrEl = document.getElementById('display-hospital-address');
    if(addrEl) {
        addrEl.innerText = address;
        addrEl.style.display = address ? 'block' : 'none';
    }
    
    if(imgData) {
        const imgEl = document.getElementById('display-hospital-img');
        if(imgEl) {
            imgEl.src = imgData;
            imgEl.style.display = 'block';
        }
        const logoEl = document.getElementById('display-hospital-logo');
        if(logoEl) logoEl.style.display = 'none';
    } else {
        const imgEl = document.getElementById('display-hospital-img');
        if(imgEl) imgEl.style.display = 'none';
        const logoEl = document.getElementById('display-hospital-logo');
        if(logoEl) logoEl.style.display = 'inline-block';
    }
    
    const brandData = { name, address };
    if(imgData) brandData.img = imgData;
    
    MemStore.setItem('hms_hospital_brand', JSON.stringify(brandData));
    showToast("Hospital Details Updated", "success");
}

function deletePatient(idx) {
    if(confirm("Are you sure you want to permanently delete this patient record?")) {
        const patients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
        patients.splice(idx, 1);
        MemStore.setItem('hms_v2_patients', JSON.stringify(patients));
        showToast("Patient record deleted.", "success");
        renderLocalData();
        fetchDashboardData();
    }
}

function editPatient(idx) {
    showToast("Edit Patient Modal triggered (Data bounds connected)", "success");
}

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'glass toast';
    
    let icon = type === 'success' ? 'fa-check-circle text-success' : 'fa-triangle-exclamation text-danger';
    if(type==='warning') icon = 'fa-info-circle text-warning';
    
    // Set border color dynamically
    const borderColor = type === 'success' ? 'var(--success)' : (type === 'error' ? 'var(--danger)' : 'var(--warning)');
    toast.style.borderLeftColor = borderColor;

    toast.innerHTML = `
        <i class="fa-solid ${icon}" style="font-size: 1.2rem;"></i>
        <div>
            <h4 style="font-size: 0.95rem; margin-bottom: 2px;">${type === 'success' ? 'System Notification' : (type === 'error' ? 'Action Failed' : 'Info')}</h4>
            <p style="font-size: 0.85rem; margin: 0;">${message}</p>
        </div>
        <button style="margin-left:auto; background:none; border:none; cursor:pointer; color:var(--text-muted);" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'scaleUp 0.3s reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
function promptPrescribe(patientName) {
    const rx = prompt(`Enter prescription for ${patientName}:`, "Paracetamol 500mg (2x Daily)");
    if(rx) {
        const prescriptions = JSON.parse(MemStore.getItem('hms_v2_prescriptions') || '[]');
        prescriptions.unshift({
            id: 'RX-' + Math.floor(Math.random()*9000),
            patient: patientName,
            doctor: currentUser.name,
            meds: rx,
            date: new Date().toLocaleDateString('en-IN', {day:'numeric', month:'short'})
        });
        MemStore.setItem('hms_v2_prescriptions', JSON.stringify(prescriptions));
        showToast("Prescription issued successfully!", "success");
    }
}

window.addEventListener('storage', () => {
    // If billing, patients, or appointments change elsewhere, redraw
    renderLocalData();
    fetchDashboardData();
    renderBedGrid();
});

// ==========================================
// BED MANAGEMENT LOGIC
// ==========================================
function renderBedGrid() {
    const container = document.getElementById('ward-container');
    if(!container) return;

    const wards = JSON.parse(MemStore.getItem('hms_v2_wards') || '[]');
    const beds = JSON.parse(MemStore.getItem('hms_v2_beds') || '[]');
    
    // Default Wards if empty — seed without reloading page
    let activeWards = wards;
    if(activeWards.length === 0) {
        activeWards = [
            { id: 'w1', name: 'ICU', desc: 'Critical Care Unit' },
            { id: 'w2', name: 'General Ward', desc: 'Standard inpatient care' },
            { id: 'w3', name: 'Emergency', desc: 'Emergency triage' }
        ];
        MemStore.setItem('hms_v2_wards', JSON.stringify(activeWards));
    }

    container.innerHTML = activeWards.map(ward => {
        const wardBeds = beds.filter(b => b.wardId === ward.id);
        const avail = wardBeds.filter(b => b.status === 'Available').length;
        
        return `
        <div class="glass-card" style="padding: 1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-solid); padding-bottom: 1rem;">
                <div>
                    <h3 style="margin:0;">${ward.name}</h3>
                    <p class="text-muted" style="font-size:0.85rem; margin-top:2px;">${ward.desc}</p>
                </div>
                <div class="flex gap-4">
                    <span class="text-sm">Total: <strong>${wardBeds.length}</strong></span>
                    <span class="text-sm text-success">Available: <strong>${avail}</strong></span>
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem;">
                ${wardBeds.map(bed => {
                    let color = 'var(--success)', icon = 'fa-bed', bg = 'rgba(16,185,129,0.1)';
                    if(bed.status === 'Occupied') { color = 'var(--danger)'; bg = 'rgba(239,68,68,0.1)'; }
                    if(bed.status === 'Reserved') { color = 'var(--warning)'; bg = 'rgba(245,158,11,0.1)'; }
                    if(bed.status === 'Cleaning') { color = 'var(--primary)'; bg = 'rgba(92,103,242,0.1)'; }
                    
                    return `
                    <div class="glass-card" style="padding:1rem; text-align:center; border: 1px solid ${bg}; background:${bg}; cursor:pointer;" onclick="openAllocationModal('${bed.id}', '${bed.number}')">
                        <i class="fa-solid ${icon}" style="font-size:1.5rem; color:${color}; margin-bottom:0.5rem;"></i>
                        <div style="font-weight:bold; font-size:0.9rem;">${bed.status === 'Occupied' ? bed.patient : bed.number}</div>
                        <div style="font-size:0.75rem; color:${color}; margin-top:4px;">${bed.status}</div>
                        ${bed.status === 'Occupied' ? `<button class="btn btn-glass" style="font-size:0.7rem; padding:2px 8px; margin-top:8px; width:100%; border-color:var(--danger); color:var(--danger);" onclick="event.stopPropagation(); releaseBed('${bed.id}')">Discharge</button>` : ''}
                    </div>
                    `;
                }).join('')}
                ${wardBeds.length === 0 ? `<div class="text-muted" style="font-size:0.85rem; padding:1rem; border:1px dashed var(--border-solid); border-radius:8px; grid-column:1/-1; text-align:center;">No beds added to this ward.</div>` : ''}
            </div>
        </div>
        `;
    }).join('');

    // Update Overall Stats (guard against elements not existing on current view)
    const statTotal = document.getElementById('stat-total-beds');
    const statAvail = document.getElementById('stat-avail-beds');
    const statOcc = document.getElementById('stat-occ-beds');
    const statCleaning = document.getElementById('stat-cleaning-beds');
    if(statTotal) statTotal.innerText = beds.length;
    if(statAvail) statAvail.innerText = beds.filter(b => b.status === 'Available').length;
    if(statOcc) statOcc.innerText = beds.filter(b => b.status === 'Occupied').length;
    if(statCleaning) statCleaning.innerText = beds.filter(b => b.status === 'Cleaning').length;

    // Populate Selects
    const wardSelect = document.getElementById('bed-ward-select');
    if(wardSelect) {
        wardSelect.innerHTML = activeWards.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    }
}

function handleAddWard(e) {
    e.preventDefault();
    const wards = JSON.parse(MemStore.getItem('hms_v2_wards') || '[]');
    wards.push({
        id: 'w' + Date.now(),
        name: document.getElementById('ward-name').value,
        desc: document.getElementById('ward-desc').value
    });
    MemStore.setItem('hms_v2_wards', JSON.stringify(wards));
    showToast("New Ward Created!", "success");
    closeModal('modal-add-room');
    renderBedGrid();
}

function handleAddBed(e) {
    e.preventDefault();
    const beds = JSON.parse(MemStore.getItem('hms_v2_beds') || '[]');
    beds.push({
        id: 'b' + Date.now(),
        wardId: document.getElementById('bed-ward-select').value,
        number: document.getElementById('bed-number').value,
        status: 'Available'
    });
    MemStore.setItem('hms_v2_beds', JSON.stringify(beds));
    showToast("Bed Registered Successfully!", "success");
    closeModal('modal-add-bed');
    renderBedGrid();
}

function openAllocationModal(id, number) {
    const beds = JSON.parse(MemStore.getItem('hms_v2_beds') || '[]');
    const bed = beds.find(b => b.id === id);
    if(bed.status === 'Occupied') return; // handled via separate discharge button

    document.getElementById('allocate-bed-id').value = id;
    document.getElementById('display-bed-id').value = number;
    
    // Populate Patients
    const patients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    const sel = document.getElementById('allocate-pt-select');
    sel.innerHTML = patients.map(p => `<option value="${p.fname} ${p.lname}">${p.fname} ${p.lname}</option>`).join('');
    
    openModal('modal-allocate-bed');
}

function handleAllocateBed(e) {
    e.preventDefault();
    const bedId = document.getElementById('allocate-bed-id').value;
    const ptName = document.getElementById('allocate-pt-select').value;
    const status = document.getElementById('allocate-status').value;

    const beds = JSON.parse(MemStore.getItem('hms_v2_beds') || '[]');
    const bedIdx = beds.findIndex(b => b.id === bedId);
    if(bedIdx > -1) {
        beds[bedIdx].status = status;
        beds[bedIdx].patient = ptName;
        MemStore.setItem('hms_v2_beds', JSON.stringify(beds));
        showToast(`Bed allocated to ${ptName}`, "success");
        closeModal('modal-allocate-bed');
        renderBedGrid();
    }
}

function releaseBed(id) {
    const beds = JSON.parse(MemStore.getItem('hms_v2_beds') || '[]');
    const idx = beds.findIndex(b => b.id === id);
    if(idx > -1) {
        beds[idx].status = 'Cleaning';
        delete beds[idx].patient;
        MemStore.setItem('hms_v2_beds', JSON.stringify(beds));
        showToast("Bed status updated to Cleaning.", "warning");
        renderBedGrid();
        
        // Auto-available after 5s simulate cleaning
        setTimeout(() => {
            const b2 = JSON.parse(MemStore.getItem('hms_v2_beds') || '[]');
            const i2 = b2.findIndex(b => b.id === id);
            if(i2 > -1 && b2[i2].status === 'Cleaning') {
                b2[i2].status = 'Available';
                MemStore.setItem('hms_v2_beds', JSON.stringify(b2));
                renderBedGrid();
            }
        }, 5000);
    }
}

// ==========================================
// NEW FEATURES: PATIENT PORTAL & ADMIN
// ==========================================

function handleScheduleTelemedicine(e) {
    e.preventDefault();
    const doc = document.getElementById('tele-doctor').value;
    const date = document.getElementById('tele-date').value;
    const time = document.getElementById('tele-time').value;
    showToast(`Telemedicine scheduled with ${doc} on ${date} at ${time}.`, "success");
    closeModal('modal-schedule-telemedicine');
}

function handleAddEmergencyContact(e) {
    e.preventDefault();
    const contacts = JSON.parse(MemStore.getItem('hms_v2_emergency_contacts') || '[]');
    contacts.push({
        name: document.getElementById('ec-name').value,
        phone: document.getElementById('ec-phone').value
    });
    MemStore.setItem('hms_v2_emergency_contacts', JSON.stringify(contacts));
    showToast("Emergency Contact Added!", "success");
    document.getElementById('ec-name').value = '';
    document.getElementById('ec-phone').value = '';
    renderEmergencyContacts();
}

function renderEmergencyContacts() {
    const list = document.getElementById('ec-list');
    if(!list) return;
    const contacts = JSON.parse(MemStore.getItem('hms_v2_emergency_contacts') || '[]');
    if(contacts.length > 0) {
        list.innerHTML = contacts.map((c, i) => `
            <div class="glass-card" style="padding:1rem; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${c.name}</strong><br>
                    <span class="text-sm text-muted"><i class="fa-solid fa-phone"></i> ${c.phone}</span>
                </div>
                <button class="icon-btn text-danger" type="button" onclick="deleteEmergencyContact(${i})"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');
    } else {
        list.innerHTML = `<div class="text-muted text-center" style="padding:1rem;">No contacts saved.</div>`;
    }
}

function deleteEmergencyContact(idx) {
    const contacts = JSON.parse(MemStore.getItem('hms_v2_emergency_contacts') || '[]');
    contacts.splice(idx, 1);
    MemStore.setItem('hms_v2_emergency_contacts', JSON.stringify(contacts));
    renderEmergencyContacts();
}

function handleLogMetrics(e) {
    e.preventDefault();
    showToast("Health Metrics Logged Successfully!", "success");
    closeModal('modal-health-metrics');
}

function handleSubmitFeedback(e) {
    e.preventDefault();
    showToast("Thank you! Your feedback has been submitted.", "success");
    closeModal('modal-feedback');
}

function handleSaveInsurance(e) {
    e.preventDefault();
    showToast("Insurance details updated.", "success");
    closeModal('modal-insurance');
}

function handleRequestRefill(e) {
    e.preventDefault();
    const med = document.getElementById('refill-med').value;
    showToast(`Refill request for ${med} submitted!`, "success");
    closeModal('modal-medication-refill');
}

function handleSetReminder(e) {
    e.preventDefault();
    showToast("Appointment Reminder Activated!", "success");
    closeModal('modal-appointment-reminder');
}

function renderManageStaff() {
    const tbody = document.querySelector('#tbl-manage-staff tbody');
    if(!tbody) return;
    const docs = JSON.parse(MemStore.getItem('hms_v2_doctors') || '[]');
    const shifts = JSON.parse(MemStore.getItem('hms_v2_shifts') || '[]');
    
    let html = docs.map(d => `
        <tr>
            <td><strong>${d.name}</strong><br><span class="text-xs text-muted">${d.spec}</span></td>
            <td>Doctor</td>
            <td>General Timing</td>
            <td><span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success)">${d.status}</span></td>
        </tr>
    `).join('');
    
    html += shifts.map(s => `
        <tr>
            <td><strong>${s.name}</strong></td>
            <td>Support/Staff</td>
            <td>${s.type}</td>
            <td><span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success)">Assigned</span></td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html || `<tr><td colspan="4" class="text-center text-muted">No staff records found.</td></tr>`;
}

function renderInventoryAlerts() {
    const list = document.getElementById('inv-alerts-list');
    if(!list) return;
    const pharmacy = JSON.parse(MemStore.getItem('hms_v2_pharmacy') || '[]');
    const lowStock = pharmacy.filter(p => parseInt(p.stock) < 50);
    
    if(lowStock.length > 0) {
        list.innerHTML = lowStock.map(p => `
            <div class="glass-card" style="padding:1rem; border-left:4px solid var(--danger);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong class="text-danger">${p.name}</strong><br>
                        <span class="text-sm text-muted">Category: ${p.cat}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:1.5rem; font-weight:bold; color:var(--danger);">${p.stock}</span><br>
                        <span class="text-xs text-muted">units left</span>
                    </div>
                </div>
            </div>
        `).join('');
    } else {
        list.innerHTML = `
            <div class="glass-card text-center" style="padding:2rem;">
                <i class="fa-solid fa-check-circle text-success" style="font-size:2rem; margin-bottom:1rem;"></i>
                <h4 style="color:var(--text-main);">Inventory is Healthy</h4>
                <p class="text-muted text-sm" style="margin:0;">No items are currently running low on stock.</p>
            </div>
        `;
    }
}

// ==========================================
// SEARCH 360 ENGINE
// ==========================================
function handleGlobalSearch(query) {
    const dropdown = document.getElementById('search-results-dropdown');
    if(!dropdown) return;
    
    if(!query || query.length < 2) {
        dropdown.classList.add('hidden');
        return;
    }
    
    const term = query.toLowerCase();
    const patients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    
    const matches = patients.filter(p => 
        (p.fname + " " + p.lname).toLowerCase().includes(term) ||
        (p.patientId || '').toLowerCase().includes(term)
    );
    
    if(matches.length > 0) {
        dropdown.innerHTML = matches.map(p => `
            <div style="padding:1rem; border-bottom:1px solid rgba(255,255,255,0.1); cursor:pointer; transition:0.3s;" 
                 onmouseover="this.style.background='rgba(92,103,242,0.2)'" 
                 onmouseout="this.style.background='transparent'"
                 onclick="renderPatient360('${p.patientId}')">
                <div class="flex items-center gap-3">
                    ${p.photo ? `<img src="${p.photo}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">` : `<i class="fa-solid fa-magnifying-glass text-primary"></i>`}
                    <div>
                        <div style="font-weight:bold; color:var(--text-main);">${p.fname} ${p.lname}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">${p.patientId} | ${p.disease}</div>
                    </div>
                </div>
            </div>
        `).join('');
        dropdown.classList.remove('hidden');
    } else {
        dropdown.innerHTML = `<div style="padding:1rem; color:var(--text-muted); text-align:center;">No patients found.</div>`;
        dropdown.classList.remove('hidden');
    }
}

document.addEventListener('click', (e) => {
    if(!e.target.closest('.search-bar') && !e.target.closest('#search-results-dropdown')) {
        const drop = document.getElementById('search-results-dropdown');
        if(drop) drop.classList.add('hidden');
    }
});

function renderPatient360(patientId) {
    const drop = document.getElementById('search-results-dropdown');
    if(drop) drop.classList.add('hidden');
    const input = document.getElementById('global-search-input');
    if(input) input.value = '';
    
    const patients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    const pt = patients.find(p => p.patientId === patientId);
    if(!pt) return;
    
    const patientName = `${pt.fname} ${pt.lname}`;

    // Switch View
    navigate('patient-profile'); 
    
    // Set Header
    document.getElementById('profile-pt-name').innerText = patientName;
    document.getElementById('profile-pt-id').innerText = patientId || 'PT-UNKNOWN';
    if(pt.qrCode) document.getElementById('profile-qr-img').src = pt.qrCode;
    
    // Gather Data
    const apts = JSON.parse(MemStore.getItem('hms_v2_appointments') || '[]').filter(a => a.patient === patientName);
    const bills = JSON.parse(MemStore.getItem('hms_v2_billing') || '[]').filter(b => b.patient === patientName);
    const labs = JSON.parse(MemStore.getItem('hms_v2_labs') || '[]').filter(l => l.patient === patientName);
    const prescriptions = JSON.parse(MemStore.getItem('hms_v2_prescriptions') || '[]').filter(p => p.patient === patientName);
    const notes = JSON.parse(MemStore.getItem('hms_v2_notes') || '[]').filter(n => n.patient === patientName);
    
    // Set Top Stats
    const apSpan = document.getElementById('profile-stat-apts');
    if(apSpan) apSpan.innerText = apts.length;
    
    const billSpan = document.getElementById('profile-stat-billing');
    if(billSpan) billSpan.innerText = '₹' + bills.reduce((sum, b) => sum + Number(b.amount||0), 0).toLocaleString();
    
    const labSpan = document.getElementById('profile-stat-labs');
    if(labSpan) labSpan.innerText = labs.length;
    
    // 1. Render Appts
    const aptTbody = document.querySelector('#profile-tbl-apts tbody');
    if(aptTbody) {
        aptTbody.innerHTML = apts.length > 0 ? apts.map(a => `
            <tr>
                <td>${a.date}</td>
                <td>${a.doctor}</td>
                <td><span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success); position:static;">${a.status || 'Confirmed'}</span></td>
            </tr>
        `).join('') : `<tr><td colspan="3" class="text-center text-muted">No history found.</td></tr>`;
    }
    
    // 2. Render Billing
    const billTbody = document.querySelector('#profile-tbl-billing tbody');
    if(billTbody) {
        billTbody.innerHTML = bills.length > 0 ? bills.map(b => `
            <tr>
                <td><strong>${b.id}</strong></td>
                <td>${b.service}</td>
                <td>₹${b.amount}</td>
                <td><span class="badge" style="background:${b.status==='Paid'?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.1)'}; color:var(--${b.status==='Paid'?'success':'danger'}); position:static;">${b.status}</span></td>
            </tr>
        `).join('') : `<tr><td colspan="4" class="text-center text-muted">No financial records.</td></tr>`;
    }
    
    // 3. Render Prescriptions & Notes
    const rxDiv = document.getElementById('profile-prescriptions');
    if(rxDiv) {
        let content = prescriptions.map(p => `
            <div style="background:rgba(92,103,242,0.05); margin-bottom:0.5rem; padding:1rem; border-radius:8px; border-left:3px solid var(--primary);">
                <div style="font-weight:bold; font-size:1.1rem; margin-bottom:0.25rem;">${p.diagnosis}</div>
                <div style="font-size:0.9rem; margin-bottom:0.5rem; color:var(--text-muted);"><i class="fa-solid fa-user-doctor"></i> ${p.doctor} | ${p.date}</div>
                <p style="white-space:pre-wrap; font-size:0.9rem;">${p.meds}</p>
                ${p.notes ? `<div style="background:rgba(255,255,255,0.05); margin-top:0.5rem; padding:0.5rem; border-radius:4px; font-size:0.8rem;"><i>" ${p.notes} "</i></div>` : ''}
            </div>
        `).join('');
        
        content += notes.map(n => `
            <div style="background:rgba(245,158,11,0.05); margin-bottom:0.5rem; padding:1rem; border-radius:8px; border-left:3px solid var(--warning);">
                <div style="font-weight:bold; font-size:0.9rem; margin-bottom:0.25rem;"><i class="fa-solid fa-pen"></i> Clinical Note from ${n.doctor}</div>
                <div style="font-size:0.8rem; margin-bottom:0.5rem; color:var(--text-muted)">${n.date}</div>
                <p style="font-size:0.9rem; margin:0;">${n.text}</p>
            </div>
        `).join('');
        
        rxDiv.innerHTML = content || `<div class="text-muted text-center" style="padding:1rem;">No prescriptions or clinical notes loaded.</div>`;
        const labDiv = document.getElementById('profile-labs');
        if(labDiv) {
            labDiv.innerHTML = labs.length > 0 ? labs.map(l => `
                <div style="background:rgba(16,185,129,0.05); margin-bottom:0.5rem; padding:1rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:bold; color:var(--text-main); margin-bottom:0.25rem;"><i class="fa-solid fa-flask text-success"></i> ${l.test}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">${l.date}</div>
                    </div>
                    <span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success); position:static;">${l.status}</span>
                </div>
            `).join('') : `<div class="text-muted text-center" style="padding:1rem;">No active lab configurations.</div>`;
        }

        // 5. Render Digital Twin Predictions
        const predList = document.getElementById('health-prediction-list');
        if(predList) {
            const risks = renderHealthRiskPrediction(pt);
            predList.innerHTML = risks.map(r => `
                <div>
                    <div class="flex justify-between text-sm mb-1">
                        <span>${r.name}</span>
                        <span class="text-xs font-bold ${r.score > 50 ? 'text-danger' : 'text-primary'}">${r.score}% Potential</span>
                    </div>
                    <div style="width:100%; height:6px; background:rgba(0,0,0,0.1); border-radius:3px; overflow:hidden;">
                        <div style="width:${r.score}%; height:100%; background:${r.score > 50 ? 'var(--danger)' : 'var(--primary)'}; transition:1s;"></div>
                    </div>
                </div>
            `).join('');
        }
    }
}

// ==========================================
// BILLING & INVOICE ENGINE
// ==========================================
function calcTotal() {
    const consult = parseFloat(document.getElementById('inv-consult').value || 0);
    const lab = parseFloat(document.getElementById('inv-lab').value || 0);
    const meds = parseFloat(document.getElementById('inv-meds').value || 0);
    const taxPercent = parseFloat(document.getElementById('inv-tax').value || 0);
    
    const subtotal = consult + lab + meds;
    const taxAmount = subtotal * (taxPercent / 100);
    const total = subtotal + taxAmount;
    
    document.getElementById('inv-total-display').innerText = total.toLocaleString('en-IN', {minimumFractionDigits: 2});
    document.getElementById('inv-amount').value = total.toFixed(2);
}

function handleBillingPatientChange(patientName) {
    const ptIdInput = document.getElementById('inv-pt-id');
    const docInput = document.getElementById('inv-doctor');
    
    if(!patientName) {
        if(ptIdInput) ptIdInput.value = '';
        if(docInput) docInput.value = '';
        return;
    }

    const patients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    const appointments = JSON.parse(MemStore.getItem('hms_v2_appointments') || '[]');
    
    const pt = patients.find(p => (p.fname + " " + p.lname) === patientName);
    const lastApt = appointments.filter(a => a.patient === patientName).pop();

    if(pt && ptIdInput) ptIdInput.value = pt.patientId || 'PT-PROCESSED';
    if(lastApt && docInput) docInput.value = lastApt.doctor || 'General OPD';
    
    // Auto-calculate charges from records
    const labs = JSON.parse(MemStore.getItem('hms_v2_labs') || '[]').filter(l => l.patient === patientName && l.status !== 'Billed');
    const prescriptions = JSON.parse(MemStore.getItem('hms_v2_prescriptions') || '[]').filter(r => r.patient === patientName && r.status !== 'Billed');
    
    const labCharge = labs.length * 1500; // Flat 1500 per test for demo
    const medCharge = prescriptions.length * 800; // Flat 800 per rx for demo
    
    document.getElementById('inv-consult').value = 1000;
    document.getElementById('inv-lab').value = labCharge;
    document.getElementById('inv-meds').value = medCharge;
    
    calcTotal();
}

function handleCompleteReport(reportId) {
    const labs = JSON.parse(MemStore.getItem('hms_v2_labs') || '[]');
    const idx = labs.findIndex(l => l.id === reportId);
    if(idx > -1) {
        labs[idx].status = 'Completed';
        labs[idx].completedDate = new Date().toLocaleDateString('en-IN');
        MemStore.setItem('hms_v2_labs', JSON.stringify(labs));
        showToast("Laboratory report finalized and synced.", "success");
        renderLocalData();
        fetchDashboardData();
    }
}

function handleGenerateInvoice(event) {
    event.preventDefault();
    const patientCharge = document.getElementById('inv-patient').value;
    const ptId = document.getElementById('inv-pt-id').value;
    const doctor = document.getElementById('inv-doctor').value;
    const amount = document.getElementById('inv-amount').value;
    const consult = document.getElementById('inv-consult').value;
    const lab = document.getElementById('inv-lab').value;
    const meds = document.getElementById('inv-meds').value;
    const tax = document.getElementById('inv-tax').value;

    const bills = JSON.parse(MemStore.getItem('hms_v2_billing') || '[]');
    const newBill = {
        id: 'INV-' + Math.floor(Math.random() * 9000 + 1000),
        patient: patientCharge,
        ptId: ptId,
        doctor: doctor,
        service: 'Consultation & Diagnostics',
        amount: amount,
        consult: consult,
        lab: lab,
        meds: meds,
        tax: tax,
        status: 'Unpaid',
        date: new Date().toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})
    };

    bills.unshift(newBill);
    MemStore.setItem('hms_v2_billing', JSON.stringify(bills));
    
    showToast("Invoice Generated Successfully", "success");
    closeModal('modal-generate-invoice');
    
    // Refresh tables
    if(typeof renderLocalData === 'function') renderLocalData();
    
    // Pre-fill print modal
    showPrintInvoice(newBill);
}

function showPrintInvoice(bill) {
    document.getElementById('print-inv-id').innerText = bill.id;
    document.getElementById('print-inv-date').innerText = bill.date;
    document.getElementById('print-inv-patient').innerText = bill.patient;
    document.getElementById('print-inv-consult').innerText = `₹${parseFloat(bill.consult).toLocaleString()}`;
    document.getElementById('print-inv-lab').innerText = `₹${parseFloat(bill.lab).toLocaleString()}`;
    document.getElementById('print-inv-meds').innerText = `₹${parseFloat(bill.meds).toLocaleString()}`;
    
    const sub = parseFloat(bill.consult||0) + parseFloat(bill.lab||0) + parseFloat(bill.meds||0);
    const t = sub * (parseFloat(bill.tax||0) / 100);
    document.getElementById('print-inv-tax').innerText = `₹${t.toLocaleString()} (${bill.tax}%)`;
    document.getElementById('print-inv-total').innerText = `₹${parseFloat(bill.amount).toLocaleString()}`;
    
    // Settings sync for branding in print
    const settings = JSON.parse(MemStore.getItem('hms_v2_settings') || '{}');
    if(settings.hospitalName) document.getElementById('print-hs-name').innerText = settings.hospitalName;
    if(settings.hospitalAddress) document.getElementById('print-hs-address').innerText = settings.hospitalAddress;
    if(settings.logoBase64) {
        const logo = document.getElementById('print-hs-logo');
        logo.src = settings.logoBase64;
        logo.style.display = 'block';
    }

    openModal('modal-view-invoice');
}

// ==========================================
// NEXT-GEN SELF-HEALING & RESILIENCY
// ==========================================
function selfHealData() {
    console.log("🧬 [Self-Healing] Analyzing system integrity...");
    const keys = ['hms_v2_patients', 'hms_v2_appointments', 'hms_v2_doctors', 'hms_v2_pharmacy', 'hms_v2_labs', 'hms_v2_billing', 'hms_v2_beds', 'hms_v2_wards'];
    let fixes = 0;

    keys.forEach(key => {
        let data = JSON.parse(MemStore.getItem(key) || '[]');
        if (!Array.isArray(data)) {
            console.warn(`[Self-Healing] Corrupted key ${key} reset to empty array.`);
            MemStore.setItem(key, '[]');
            fixes++;
            return;
        }

        if (key === 'hms_v2_patients') {
            const seenIds = new Set();
            data = data.filter(p => {
                if (!p.patientId || seenIds.has(p.patientId)) {
                    p.patientId = 'PT-' + Math.floor(100000 + Math.random() * 900000);
                    fixes++;
                }
                seenIds.add(p.patientId);
                // Simulated QR Digital ID
                if(!p.qrCode) {
                    p.qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${p.patientId}`;
                    fixes++;
                }
                return true;
            });
            MemStore.setItem(key, JSON.stringify(data));
        }
    });

    if (fixes > 0) {
        console.log(`✅ [Self-Healing] System integrity restored. ${fixes} issues resolved.`);
    } else {
        console.log("✨ [Self-Healing] System is healthy.");
    }
}

function exportSystemData() {
    const data = {};
    for (let i = 0; i < MemStore.length; i++) {
        const key = MemStore.key(i);
        if (key.startsWith('hms_v2_')) {
            data[key] = JSON.parse(MemStore.getItem(key));
        }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apollo_hms_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("System backup exported successfully.", "success");
}

function simulateSync() {
    const syncBtn = document.getElementById('sync-status-btn');
    if(!syncBtn) return;
    
    syncBtn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Syncing...';
    syncBtn.style.color = 'var(--primary-light)';
    
    setTimeout(() => {
        syncBtn.innerHTML = '<i class="fa-solid fa-cloud-check"></i> Cloud Synced';
        syncBtn.style.color = 'var(--success)';
        showToast("Local data synchronized with cloud backup.", "success");
    }, 2000);
}

// ==========================================
// PHASE 2: AI & PREDICTIVE ANALYTICS
// ==========================================
function predictWaitTime(appointmentCount) {
    // 15 mins per patient baseline
    const baseMinutes = appointmentCount * 15;
    if (baseMinutes === 0) return "Ready";
    if (baseMinutes < 30) return "< 30 mins";
    return `~${Math.floor(baseMinutes / 60)}h ${baseMinutes % 60}m`;
}

function calculateBurnoutRisk(patientCount) {
    if (patientCount > 15) return { level: 'High', color: 'var(--danger)', icon: 'fa-fire' };
    if (patientCount > 8) return { level: 'Moderate', color: 'var(--warning)', icon: 'fa-temperature-half' };
    return { level: 'Low', color: 'var(--success)', icon: 'fa-leaf' };
}

function runAITriage(patientData) {
    showToast("🧠 AI analyzing clinical symptoms...", "info");
    return new Promise(resolve => {
        setTimeout(() => {
            const risk = Math.random() > 0.7 ? 'High' : 'Low';
            const dept = risk === 'High' ? 'Emergency / Cardiology' : 'General OPD';
            resolve({ risk, dept, confidence: (85 + Math.random() * 10).toFixed(1) + '%' });
        }, 1500);
    });
}

function renderHealthRiskPrediction(patient) {
    // Simulated Smart Health Prediction based on Age & Disease
    const age = parseInt(patient.age) || 30;
    const risks = [];
    if (age > 50) risks.push({ name: 'Cardiovascular Profile', score: 65 });
    if (patient.disease?.toLowerCase().includes('diabetes')) risks.push({ name: 'Neuropathy Risk', score: 40 });
    if (age < 20) risks.push({ name: 'Nutritional Balance', score: 20 });
    
    // Default risk
    risks.push({ name: 'Metabolic Stability', score: 15 + (age / 5) });
    
    return risks;
}

function showAIDecisionSupport() {
    const ptNameLabel = document.getElementById('profile-pt-name');
    if(!ptNameLabel) return;
    const ptName = ptNameLabel.innerText;
    
    runAITriage({ name: ptName }).then(res => {
        const msg = `AI Triage Result for ${ptName}:\nRisk: ${res.risk}\nRecommended Dept: ${res.dept}\nConfidence: ${res.confidence}`;
        alert(msg);
        showToast("Decision support report generated.", "success");
    });
}

// ==========================================
// PHASE 3: AUTOMATION & CLINICAL WORKFLOWS
// ==========================================
function addHandoverNote() {
    const input = document.getElementById('handover-note-input');
    if(!input || !input.value) return;
    
    const notes = JSON.parse(MemStore.getItem('hms_v2_handovers') || '[]');
    notes.unshift({
        user: currentUser.name,
        role: currentUser.role,
        text: input.value,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });
    MemStore.setItem('hms_v2_handovers', JSON.stringify(notes));
    input.value = '';
    renderHandoverNotes();
    showToast("Handover note synchronized.", "success");
}

function renderHandoverNotes() {
    const list = document.getElementById('nurse-handover-list');
    if(!list) return;
    
    const notes = JSON.parse(MemStore.getItem('hms_v2_handovers') || '[]');
    if(notes.length === 0) {
        list.innerHTML = `<div class="text-center text-muted" style="padding:2rem;">No handover notes for this shift.</div>`;
        return;
    }
    
    list.innerHTML = notes.map(n => `
        <div class="glass-card" style="padding:0.75rem; border-left:3px solid var(--primary); background: rgba(255,255,255,0.05);">
            <div class="flex justify-between items-center mb-1">
                <strong class="text-sm">${n.user} (${n.role})</strong>
                <span class="text-xs text-muted">${n.time}</span>
            </div>
            <p class="text-sm" style="margin:0; color:var(--text-main);">${n.text}</p>
        </div>
    `).join('');
}

// ==========================================
// PHASE 5: VOICE ASSISTANT COMMANDS
// ==========================================
let isListening = false;
function toggleVoiceAssistant() {
    const bar = document.getElementById('voice-status-bar');
    const fab = document.getElementById('voice-assistant-fab');
    const waves = document.getElementById('voice-waves');
    if(!bar || !fab) return;
    
    isListening = !isListening;
    if(isListening) {
        bar.style.display = 'block';
        fab.style.background = 'var(--danger)';
        if(waves) { waves.style.animation = 'pulse 1.5s infinite'; waves.style.opacity = '1'; }
        startMockRecognition();
    } else {
        bar.style.display = 'none';
        fab.style.background = 'var(--primary)';
        if(waves) { waves.style.animation = 'none'; waves.style.opacity = '0'; }
    }
}

function startMockRecognition() {
    const status = document.getElementById('voice-text');
    const indicator = document.getElementById('voice-indicator');
    const commands = ["Open Laboratory", "Book appointment", "Show inventory", "Logout", "Status check"];
    
    setTimeout(() => {
        if(!isListening) return;
        if(indicator) indicator.style.background = 'var(--success)';
        const cmd = commands[Math.floor(Math.random() * commands.length)];
        if(status) status.innerText = `Recognized: "${cmd}"`;
        
        setTimeout(() => {
            handleVoiceCommand(cmd);
            toggleVoiceAssistant();
        }, 1500);
    }, 2000);
}

function handleVoiceCommand(cmd) {
    const c = cmd.toLowerCase();
    showToast(`Voice Command: ${cmd}`, 'primary');
    if(c.includes('laboratory')) navigate('laboratory');
    else if(c.includes('inventory')) navigate('pharmacy');
    else if(c.includes('appointment')) openModal('modal-quick-action');
    else if(c.includes('logout')) logout();
    else if(c.includes('status')) {
        const pts = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]').length;
        showToast(`System Brief: ${pts} active patients currently in system.`, 'success');
    }
}

// ==========================================
// PHASE 6: FOOD, NURSE CALL & TRACKING logic
// ==========================================

function handleFoodOrder(e) {
    e.preventDefault();
    const type = document.getElementById('food-meal-type').value;
    const diet = document.querySelector('input[name="diet"]:checked').value;
    const items = Array.from(document.querySelectorAll('input[name="food-item"]:checked')).map(i => i.value);

    if(items.length === 0) {
        showToast("Please select at least one food item.", "warning");
        return;
    }

    const orders = JSON.parse(MemStore.getItem('hms_v2_food_orders') || '[]');
    const newOrder = {
        id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
        patientName: currentUser.name,
        patientId: MemStore.getItem('hms_v2_pt_id') || 'PT-DEMO',
        type,
        diet,
        items: items.join(', '),
        status: 'Preparing',
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };

    orders.unshift(newOrder);
    MemStore.setItem('hms_v2_food_orders', JSON.stringify(orders));
    
    closeModal('modal-order-food');
    showToast(`${type} order placed successfully!`, "success");
    renderLocalData();
}

function triggerNurseCall(type = 'Regular') {
    const alerts = JSON.parse(MemStore.getItem('hms_v2_nurse_alerts') || '[]');
    const newAlert = {
        id: 'ALT-' + Math.floor(1000 + Math.random() * 9000),
        patientName: currentUser.name,
        room: 'Ward 4B - Bed 12',
        type,
        status: 'Active',
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };

    alerts.unshift(newAlert);
    MemStore.setItem('hms_v2_nurse_alerts', JSON.stringify(alerts));
    
    showToast(type === 'Emergency' ? "EMERGENCY ALERT SENT!" : "Nurse called. Assistance is on the way.", type === 'Emergency' ? "error" : "warning");
    renderLocalData();
}

function trackMedicine() {
    const nameEl = document.getElementById('track-medicine-name');
    const statusEl = document.getElementById('track-status-text');
    if(!nameEl || !statusEl) return;
    
    const meds = ["Amoxicillin 500mg", "Lipitor 20mg", "Metformin 850mg", "Amlodipine 5mg"];
    const activeMed = meds[Math.floor(Math.random() * meds.length)];
    nameEl.innerText = activeMed;

    document.querySelectorAll('.step').forEach(s => s.classList.remove('active', 'completed'));
    document.getElementById('track-step-1').classList.add('active');
    statusEl.innerText = "Pharmacist is packing your medication...";

    setTimeout(() => {
        const s1 = document.getElementById('track-step-1');
        const s2 = document.getElementById('track-step-2');
        if(s1 && s2) {
            s1.classList.add('completed');
            s2.classList.add('active');
            statusEl.innerText = "Medication is out for delivery to your ward.";
        }
    }, 3000);

    setTimeout(() => {
        const s2 = document.getElementById('track-step-2');
        const s3 = document.getElementById('track-step-3');
        if(s2 && s3) {
            s2.classList.add('completed');
            s3.classList.add('active');
            statusEl.innerText = "Delivered! Please collect from the nursing station.";
            showToast("Medication Delivered", "success");
        }
    }, 7000);
}

function handleBillingPatientChange(val) {
    const patients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    const pt = patients.find(p => (p.fname + ' ' + p.lname) === val);
    
    if(pt) {
        const idField = document.getElementById('inv-pt-id');
        const docField = document.getElementById('inv-doctor');
        if(idField) idField.value = pt.patientId || 'PT-XXXX';
        if(docField) docField.value = pt.doctor || 'Dr. Self';
        showToast(`Data autofilled for ${pt.fname}`, "info");
    }
}

function renderPatientFoodOrders() {
    const tbl = document.getElementById('pt-tbl-food');
    if(!tbl) return;
    const body = tbl.querySelector('tbody');
    const orders = JSON.parse(MemStore.getItem('hms_v2_food_orders') || '[]');
    const myOrders = orders.filter(o => o.patientName === currentUser.name);

    if(myOrders.length === 0) {
        body.innerHTML = '<tr><td colspan="4" class="text-center">No orders yet.</td></tr>';
        return;
    }

    body.innerHTML = myOrders.map(o => `
        <tr>
            <td>${o.time}</td>
            <td><strong>${o.type}</strong><br><small>${o.items}</small></td>
            <td><span class="badge" style="background:var(--warning); color:white;">${o.status}</span></td>
            <td><button class="btn btn-glass btn-sm" onclick="showToast('Order is being prepared', 'info')">Track</button></td>
        </tr>
    `).join('');
}

function renderPatientNurseCalls() {
    const div = document.getElementById('pt-nurse-calls');
    if(!div) return;
    const alerts = JSON.parse(MemStore.getItem('hms_v2_nurse_alerts') || '[]');
    const myAlerts = alerts.filter(a => a.patientName === currentUser.name && a.status === 'Active');

    if(myAlerts.length === 0) {
        div.innerHTML = '<p class="text-muted text-sm">No active calls for assistance.</p>';
        return;
    }

    div.innerHTML = myAlerts.map(a => `
        <div class="glass-card flex justify-between items-center" style="padding:0.75rem; border-left:4px solid ${a.type === 'Emergency' ? 'var(--danger)' : 'var(--warning)'}">
            <div>
                <strong class="${a.type === 'Emergency' ? 'text-danger' : 'text-warning'}">${a.type} Call</strong>
                <p class="text-xs text-muted">Sent at ${a.time}</p>
            </div>
            <button class="btn btn-glass btn-sm" onclick="cancelNurseCall('${a.id}')">Cancel</button>
        </div>
    `).join('');
}

function cancelNurseCall(id) {
    let alerts = JSON.parse(MemStore.getItem('hms_v2_nurse_alerts') || '[]');
    alerts = alerts.filter(a => a.id !== id);
    MemStore.setItem('hms_v2_nurse_alerts', JSON.stringify(alerts));
    showToast("Call cancelled.", "info");
    renderLocalData();
}

function renderNurseDashboardAlerts() {
    const bannerContainer = document.querySelector('#view-nurse-dashboard .banner-content');
    if(!bannerContainer) return;
    
    const oldBanner = document.querySelector('.nurse-alert-banner');
    if(oldBanner) oldBanner.remove();

    const alerts = JSON.parse(MemStore.getItem('hms_v2_nurse_alerts') || '[]');
    const activeEmergencies = alerts.filter(a => a.type === 'Emergency' && a.status === 'Active');

    if(activeEmergencies.length > 0) {
        const banner = document.createElement('div');
        banner.className = 'nurse-alert-banner';
        banner.innerHTML = `
            <div>
                <strong><i class="fa-solid fa-triangle-exclamation"></i> CRITICAL: EMERGENCY CALL</strong>
                <p class="text-xs">Patient in Room ${activeEmergencies[0].room} requires immediate attention.</p>
            </div>
            <button class="btn btn-primary" style="background:white; color:var(--danger);" onclick="showToast('Emergency team dispatched!', 'error')">RESPOND NOW</button>
        `;
        bannerContainer.after(banner);
    }
}

// ==========================================
// PHASE 7: MISSING CRUD & REGISTRATION
// ==========================================

function handleRegisterPatient(e) {
    const ptId = 'PT-' + Math.floor(1000 + Math.random() * 9000);
    handleLogic(e, 'hms_v2_patients', 'modal-add-patient', {
        patientId: ptId,
        fname: document.getElementById('pt-fname').value,
        lname: document.getElementById('pt-lname').value,
        age: document.getElementById('pt-age').value,
        status: document.getElementById('pt-status').value,
        disease: document.getElementById('pt-disease').value,
        photo: document.getElementById('pt-photo-base64').value,
        doctor: 'Dr. Sarah Connor' // Default assignment
    }, 'Patient Registered Successfully!');
}

function handleRegisterDoctor(e) {
    handleLogic(e, 'hms_v2_doctors', 'modal-add-doctor', {
        name: document.getElementById('doc-name').value,
        spec: document.getElementById('doc-spec').value,
        phone: document.getElementById('doc-phone').value,
        photo: document.getElementById('doc-photo-base64').value,
        status: 'Available'
    }, 'Doctor Registered!');
}

function handleAddWard(e) {
    handleLogic(e, 'hms_v2_wards', 'modal-add-room', {
        name: document.getElementById('ward-name').value,
        desc: document.getElementById('ward-desc').value
    }, 'New Ward Created');
    updateWardSelects();
}

function handleAddBed(e) {
    handleLogic(e, 'hms_v2_beds', 'modal-add-bed', {
        ward: document.getElementById('bed-ward-select').value,
        number: document.getElementById('bed-number').value,
        status: 'Available'
    }, 'Bed Registered');
}

function handleAllocateBed(e) {
    e.preventDefault();
    const bedId = document.getElementById('display-bed-id').value;
    const ptName = document.getElementById('allocate-pt-select').value;
    const status = document.getElementById('allocate-status').value;

    const beds = JSON.parse(MemStore.getItem('hms_v2_beds') || '[]');
    const idx = beds.findIndex(b => b.number === bedId);
    if(idx > -1) {
        beds[idx].patient = ptName;
        beds[idx].status = status;
        MemStore.setItem('hms_v2_beds', JSON.stringify(beds));
        showToast("Bed Allocated Successfully", "success");
        closeModal('modal-allocate-bed');
        renderLocalData();
        renderBedGrid();
    }
}

function handleBookAppointment(e) {
    handleLogic(e, 'hms_v2_appointments', 'modal-quick-action', {
        patient: document.getElementById('apt-patient').value,
        doctor: document.getElementById('apt-doctor').value,
        date: document.getElementById('apt-date').value,
        time: document.getElementById('apt-time').value,
        status: 'Pending'
    }, 'Appointment Booked!');
}

function handleScheduleTelemedicine(e) {
    handleLogic(e, 'hms_v2_telemedicine', 'modal-schedule-telemedicine', {
        doctor: document.getElementById('tele-doctor').value,
        date: document.getElementById('tele-date').value,
        time: document.getElementById('tele-time').value,
        status: 'Scheduled'
    }, 'Telemedicine Session Scheduled');
}

function handleAddEmergencyContact(e) {
    e.preventDefault();
    const name = document.getElementById('ec-name').value;
    const phone = document.getElementById('ec-phone').value;
    
    const contacts = JSON.parse(MemStore.getItem('hms_v2_contacts') || '[]');
    contacts.push({ name, phone });
    MemStore.setItem('hms_v2_contacts', JSON.stringify(contacts));
    
    document.getElementById('ec-name').value = '';
    document.getElementById('ec-phone').value = '';
    showToast("Emergency Contact Added", "success");
    renderEmergencyContacts();
}

function renderEmergencyContacts() {
    const list = document.getElementById('ec-list');
    if(!list) return;
    const contacts = JSON.parse(MemStore.getItem('hms_v2_contacts') || '[]');
    list.innerHTML = contacts.map(c => `
        <div class="glass-card flex justify-between items-center p-2">
            <span><strong>${c.name}</strong>: ${c.phone}</span>
            <i class="fa-solid fa-phone text-success" onclick="showToast('Calling ${c.name}...', 'success')"></i>
        </div>
    `).join('') || '<p class="text-xs text-muted">No emergency contacts saved.</p>';
}

function handleLogMetrics(e) {
    e.preventDefault();
    const metrics = {
        bp: document.getElementById('hm-bp').value,
        sugar: document.getElementById('hm-sugar').value,
        weight: document.getElementById('hm-weight').value,
        date: new Date().toLocaleString()
    };
    const log = JSON.parse(MemStore.getItem('hms_v2_metrics') || '[]');
    log.unshift(metrics);
    MemStore.setItem('hms_v2_metrics', JSON.stringify(log));
    
    showToast("Health Metrics Logged", "success");
    closeModal('modal-health-metrics');
    e.target.reset();
}

function handleCompleteReport(labId) {
    let labs = JSON.parse(MemStore.getItem('hms_v2_labs') || '[]');
    const idx = labs.findIndex(l => l.id === labId);
    if(idx > -1) {
        labs[idx].status = 'Completed';
        MemStore.setItem('hms_v2_labs', JSON.stringify(labs));
        showToast("Report marked as Completed", "success");
        renderLocalData();
    }
}

function updateWardSelects() {
    const wards = JSON.parse(MemStore.getItem('hms_v2_wards') || '[]');
    const select = document.getElementById('bed-ward-select');
    if(select) {
        select.innerHTML = wards.map(w => `<option value="${w.name}">${w.name}</option>`).join('') || '<option value="">No Wards Created</option>';
    }
}

function previewDoctorPhoto(e) {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            const b64 = evt.target.result;
            document.getElementById('doc-preview').innerHTML = `<img src="${b64}" style="width:100%; height:100%; object-fit:cover;">`;
            document.getElementById('doc-photo-base64').value = b64;
        };
        reader.readAsDataURL(file);
    }
}

function handleMedRefill(e) {
    e.preventDefault();
    const med = document.getElementById('refill-med-name').value;
    const qty = document.getElementById('refill-qty').value;
    showToast(`Refill request for ${qty} units of ${med} submitted to pharmacy.`, "success");
    closeModal('modal-medication-refill');
}

function handleFeedback(e) {
    e.preventDefault();
    showToast("Thank you for your valuable feedback! We're committed to your care.", "success");
    closeModal('modal-feedback');
}

function handleSmartAllocateBed(ptName, priority) {
    const beds = JSON.parse(MemStore.getItem('hms_v2_beds') || '[]');
    const available = beds.filter(b => b.status === 'Available');
    if(available.length > 0) {
        // Simple AI logic: Choose first available or based on ward priority
        const bestBed = available[0];
        document.getElementById('display-bed-id').value = bestBed.number;
        document.getElementById('allocate-pt-select').value = ptName;
        showToast(`AI Suggestion: Bed ${bestBed.number} in ${bestBed.ward} is optimal for ${ptName}.`, "info");
    } else {
        showToast("AI: No available beds for auto-allocation.", "warning");
    }
}

// --- NEW ENTERPRISE HANDLERS ---

function handleRegisterPatient(e) {
    e.preventDefault();
    const name = document.getElementById('reg-pt-name').value;
    const age = document.getElementById('reg-pt-age').value;
    const phone = document.getElementById('reg-pt-phone').value;
    const blood = document.getElementById('reg-pt-blood').value;
    const id = "PT-" + Math.floor(1000 + Math.random() * 9000);

    const patients = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    patients.push({ id, name, age, phone, blood, registeredAt: new Date().toISOString() });
    MemStore.setItem('hms_v2_patients', JSON.stringify(patients));

    showToast(`Patient ${name} registered successfully with ID: ${id}`, "success");
    closeModal('modal-add-patient');
    renderLocalData();
}

function handleRegisterStaff(e) {
    e.preventDefault();
    const name = document.getElementById('reg-staff-name').value;
    const role = document.getElementById('reg-staff-role').value;
    const dept = document.getElementById('reg-staff-dept').value;
    const id = (role === 'Doctor' ? 'DOC-' : 'STF-') + Math.floor(100 + Math.random() * 900);

    const doctors = JSON.parse(MemStore.getItem('hms_v2_doctors') || '[]');
    doctors.push({ id, name, role, department: dept, status: 'Available', salary: role === 'Doctor' ? 120000 : 45000 });
    MemStore.setItem('hms_v2_doctors', JSON.stringify(doctors));

    showToast(`${role} ${name} added to staff directory.`, "success");
    closeModal('modal-add-doctor');
    renderLocalData();
}

function handleBookAppointment(e) {
    e.preventDefault();
    const pt = document.getElementById('bk-apt-pt').value;
    const doc = document.getElementById('bk-apt-doc').value;
    const date = document.getElementById('bk-apt-date').value;
    const time = document.getElementById('bk-apt-time').value;

    const appointments = JSON.parse(MemStore.getItem('hms_v2_appointments') || '[]');
    appointments.push({ 
        id: "APT-" + Math.floor(1000 + Math.random() * 9000),
        patient: pt,
        doctor: doc,
        date,
        time,
        status: 'Confirmed'
    });
    MemStore.setItem('hms_v2_appointments', JSON.stringify(appointments));

    showToast(`Appointment booked for ${pt} with ${doc}`, "success");
    closeModal('modal-add-appointment');
    renderLocalData();
}

function handleDocStatusChange(val) {
    const role = MemStore.getItem('hms_v2_role');
    const name = MemStore.getItem('hms_v2_name');
    if(role === 'Doctor') {
        const doctors = JSON.parse(MemStore.getItem('hms_v2_doctors') || '[]');
        const idx = doctors.findIndex(d => d.name === name);
        if(idx !== -1) {
            doctors[idx].status = val;
            MemStore.setItem('hms_v2_doctors', JSON.stringify(doctors));
            showToast(`Status updated to: ${val}`, "info");
            renderLocalData();
        }
    }
}

function handleSalaryPayment(e) {
    e.preventDefault();
    const staffId = document.getElementById('sal-staff-id').value;
    const amount = document.getElementById('sal-amount').value;
    
    const salaries = JSON.parse(MemStore.getItem('hms_v2_salaries') || '[]');
    salaries.push({
        staffId,
        amount,
        date: new Date().toLocaleDateString(),
        status: 'Paid'
    });
    MemStore.setItem('hms_v2_salaries', JSON.stringify(salaries));
    
    showToast(`Salary of ₹${amount} disbursed to ${staffId}`, "success");
    closeModal('modal-add-salary');
    renderSalaries();
}

function handleAddAsset(e) {
    e.preventDefault();
    const name = document.getElementById('asset-name').value;
    const cat = document.getElementById('asset-category').value;
    const serial = document.getElementById('asset-serial').value;
    const id = "AST-" + Math.floor(100 + Math.random() * 900);

    const assets = JSON.parse(MemStore.getItem('hms_v2_assets') || '[]');
    assets.push({ id, name, category: cat, serial, status: 'Available' });
    MemStore.setItem('hms_v2_assets', JSON.stringify(assets));

    showToast(`Asset ${name} registered.`, "success");
    closeModal('modal-add-asset');
    renderAssets();
}

function handleAddAmbulance(e) {
    e.preventDefault();
    const plate = document.getElementById('amb-plate').value;
    const type = document.getElementById('amb-type').value;
    const driver = document.getElementById('amb-driver').value;

    const fleet = JSON.parse(MemStore.getItem('hms_v2_fleet') || '[]');
    fleet.push({ plate, type, driver, status: 'Available', insurance: 'Valid' });
    MemStore.setItem('hms_v2_fleet', JSON.stringify(fleet));

    showToast(`Vehicle ${plate} added to fleet.`, "success");
    closeModal('modal-add-ambulance');
    renderAmbulanceFleet();
}

function processFinalPayment(method) {
    const orderId = document.getElementById('pay-order-id').innerText;
    const amount = document.getElementById('pay-amount-display').innerText;
    
    showToast(`Payment of ${amount} via ${method} successful!`, "success");
    
    // Update Revenue
    let revenue = parseFloat(MemStore.getItem('hms_v2_revenue') || '0');
    revenue += parseFloat(amount.replace('₹', ''));
    MemStore.setItem('hms_v2_revenue', revenue.toString());
    
    closeModal('modal-payment-gateway');
    renderLocalData();
}

function generateStaffQR(staffId) {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = "white";
    ctx.fillRect(0,0,100,100);
    ctx.fillStyle = "black";
    for(let i=0; i<10; i++) {
        for(let j=0; j<10; j++) {
            if(Math.random() > 0.5) ctx.fillRect(i*10, j*10, 8, 8);
        }
    }
    const b64 = canvas.toDataURL();
    const display = document.getElementById('staff-qr-display');
    if(display) display.innerHTML = `<img src="${b64}" style="width:100%; height:100%;">`;
}

// --- PATIENT SELF-SERVICE HANDLERS ---

function handleNurseEmergency() {
    const calls = JSON.parse(MemStore.getItem('hms_v2_nurse_calls') || '[]');
    calls.unshift({
        id: 'CALL-' + Math.floor(100+Math.random()*900),
        patient: currentUser.name,
        ward: 'Emergency Ward',
        time: 'Just Now',
        status: 'Active'
    });
    MemStore.setItem('hms_v2_nurse_calls', JSON.stringify(calls));
    showToast("Nurse alerted! Emergency protocols activated for your bed.", "danger");
    renderPatientNurseCalls();
    renderNurseDashboardAlerts();
}

function handleDietOrder(e) {
    e.preventDefault();
    const type = document.getElementById('diet-type').value;
    const meal = document.getElementById('diet-meal').value;
    
    const orders = JSON.parse(MemStore.getItem('hms_v2_food_orders') || '[]');
    orders.unshift({
        id: 'FOOD-' + Math.floor(100+Math.random()*900),
        patient: currentUser.name,
        type,
        meal,
        time: new Date().toLocaleTimeString(),
        status: 'Ordered'
    });
    MemStore.setItem('hms_v2_food_orders', JSON.stringify(orders));
    showToast(`${meal} (${type}) ordered successfully!`, "success");
    closeModal('modal-food-order');
    renderPatientFoodOrders();
}

function handleCompleteReport(reportId) {
    const labs = JSON.parse(MemStore.getItem('hms_v2_labs') || '[]');
    const idx = labs.findIndex(l => l.id === reportId);
    if(idx > -1) {
        labs[idx].status = 'Completed';
        MemStore.setItem('hms_v2_labs', JSON.stringify(labs));
        showToast(`Lab report ${reportId} verified and completed.`, "success");
        renderLocalData();
    }
}

function handleUpdateBedStatus(num, status) {
    const beds = JSON.parse(MemStore.getItem('hms_v2_beds') || '[]');
    const idx = beds.findIndex(b => b.number === num);
    if(idx > -1) {
        beds[idx].status = status;
        MemStore.setItem('hms_v2_beds', JSON.stringify(beds));
        showToast(`Bed ${num} status updated to ${status}`, "info");
        renderBedGrid();
        renderLocalData();
    }
}

function renderPatientFoodOrders() {
    const list = document.getElementById('pt-food-orders');
    if(!list) return;
    const orders = JSON.parse(MemStore.getItem('hms_v2_food_orders') || '[]');
    const myOrders = orders.filter(o => o.patient === currentUser.name);
    
    if(myOrders.length > 0) {
        list.innerHTML = myOrders.map(o => `
            <div class="flex justify-between items-center p-3 rounded glass-card mb-2">
                <div>
                    <strong>${o.meal}</strong>
                    <div class="text-xs text-muted">${o.type} | ${o.time}</div>
                </div>
                <span class="badge" style="background:rgba(92,103,242,0.1); color:var(--primary)">${o.status}</span>
            </div>
        `).join('');
    } else {
        list.innerHTML = '<div class="text-center text-sm text-muted py-4">No active food orders.</div>';
    }
}

function renderPatientNurseCalls() {
    const list = document.getElementById('pt-nurse-calls');
    if(!list) return;
    const calls = JSON.parse(MemStore.getItem('hms_v2_nurse_calls') || '[]');
    const myCalls = calls.filter(c => c.patient === currentUser.name);
    
    if(myCalls.length > 0) {
        list.innerHTML = myCalls.map(c => `
            <div class="flex justify-between items-center p-3 rounded glass-card mb-2" style="border-left: 3px solid var(--danger);">
                <div>
                    <strong>Nurse Call Active</strong>
                    <div class="text-xs text-muted">${c.time} | ${c.ward}</div>
                </div>
                <span class="badge" style="background:rgba(239,68,68,0.1); color:var(--danger)">${c.status}</span>
            </div>
        `).join('');
    } else {
        list.innerHTML = '<div class="text-center text-sm text-muted py-4">System Normal. No active calls.</div>';
    }
}

function renderNurseDashboardAlerts() {
    const list = document.getElementById('nurse-alerts-list');
    if(!list) return;
    const calls = JSON.parse(MemStore.getItem('hms_v2_nurse_calls') || '[]');
    const activeCalls = calls.filter(c => c.status === 'Active');
    
    if(activeCalls.length > 0) {
        list.innerHTML = activeCalls.map(c => `
            <div class="flex justify-between items-center p-3 mb-2 rounded glass-card" style="border-left: 4px solid var(--danger);">
                <div>
                   <strong class="text-danger">EMERGENCY: ${c.patient}</strong>
                   <div class="text-xs text-muted">${c.time} | ${c.ward}</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="handleResolveCall('${c.id}')">Respond</button>
            </div>
        `).join('');
    } else {
        list.innerHTML = '<div class="text-center text-sm text-muted py-4">No active patient alerts.</div>';
    }
}

function handleResolveCall(id) {
    const calls = JSON.parse(MemStore.getItem('hms_v2_nurse_calls') || '[]');
    const idx = calls.findIndex(c => c.id === id);
    if(idx > -1) {
        calls[idx].status = 'Resolved';
        MemStore.setItem('hms_v2_nurse_calls', JSON.stringify(calls));
        showToast("Signal resolved. Response logged.", "success");
        renderNurseDashboardAlerts();
    }
}

function renderHandoverNotes() {
    const list = document.getElementById('nurse-handover-notes');
    if(!list) return;
    let notes = JSON.parse(MemStore.getItem('hms_v2_nurse_notes'));
    if(!notes) {
        notes = [
            { id: 1, text: "Patient in B-402 needs vitals checked every 2 hours.", time: "Today, 8:00 AM", author: "Nurse Julia" },
            { id: 2, text: "X-ray report for Dr. Connor is ready in lab.", time: "Today, 9:30 AM", author: "Lab Tech Mike" }
        ];
        MemStore.setItem('hms_v2_nurse_notes', JSON.stringify(notes));
    }
    list.innerHTML = notes.map(n => `
        <div class="p-3 mb-2 rounded glass-card">
           <p class="text-sm">${n.text}</p>
           <div class="flex justify-between mt-2 text-xs text-muted">
              <span>${n.author}</span>
              <span>${n.time}</span>
           </div>
        </div>
    `).join('');
}

function renderStaffList() {
    const tbody = document.querySelector('#tbl-manage-staff tbody');
    if(!tbody) return;
    const doctors = JSON.parse(MemStore.getItem('hms_v2_doctors') || '[]');
    tbody.innerHTML = doctors.map((d, i) => `
        <tr>
            <td>${d.name}</td>
            <td>${d.role}</td>
            <td>${d.department || 'N/A'}</td>
            <td><span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success)">${d.status || 'Active'}</span></td>
            <td>
                <button class="btn btn-sm btn-glass" onclick="deleteItem('hms_v2_doctors', ${i}); renderStaffList();"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderInventoryAlerts() {
    const list = document.getElementById('inventory-alerts-list');
    if(!list) return;
    const meds = JSON.parse(MemStore.getItem('hms_v2_pharmacy') || '[]');
    const lowStock = meds.filter(m => m.stock < 50);
    
    if(lowStock.length > 0) {
        list.innerHTML = lowStock.map(m => `
            <div class="flex justify-between items-center p-3 rounded glass-card mb-2" style="border-left: 4px solid var(--warning);">
                <div>
                    <strong>${m.name}</strong>
                    <div class="text-xs text-muted">Current Stock: ${m.stock} | ${m.cat}</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="openModal('modal-add-medicine'); editMedicine(${meds.indexOf(m)});">Restock</button>
            </div>
        `).join('');
    } else {
        list.innerHTML = '<div class="text-center text-sm text-muted py-4">No critical inventory alerts.</div>';
    }
}

function handleSaveVitals(e) {
    e.preventDefault();
    const pt = document.getElementById('vitals-pt-select').value;
    const bp = document.getElementById('v-bp').value;
    const hr = document.getElementById('v-hr').value;
    
    const vitals = JSON.parse(MemStore.getItem('hms_v2_vitals') || '[]');
    vitals.unshift({
        id: 'VIT-' + Date.now().toString().slice(-4),
        patient: pt,
        bp,
        hr,
        time: new Date().toLocaleTimeString(),
        nurse: MemStore.getItem('hms_v2_name')
    });
    MemStore.setItem('hms_v2_vitals', JSON.stringify(vitals));
    showToast(`Vitals recorded for ${pt}`, "success");
    closeModal('modal-add-vitals');
    e.target.reset();
}

function renderStaffRoster() {
    const list = document.getElementById('staff-roster-list');
    if(!list) return;
    const roster = [
        { name: 'Dr. Smith', shift: 'Morning', dept: 'OPD' },
        { name: 'Nurse Julia', shift: 'Morning', dept: 'ICU' },
        { name: 'Dr. Connor', shift: 'Evening', dept: 'Emergency' },
        { name: 'Nurse Mike', shift: 'Night', dept: 'General Ward' }
    ];
    list.innerHTML = roster.map(r => `
        <div class="flex justify-between items-center p-3 rounded glass-card">
            <div>
                <strong>${r.name}</strong>
                <div class="text-xs text-muted">${r.dept}</div>
            </div>
            <span class="badge" style="background:rgba(92,103,242,0.1); color:var(--primary)">${r.shift}</span>
        </div>
    `).join('');
}

function renderBedGrid() {
    const container = document.getElementById('bed-grid-container');
    if(!container) return;
    const beds = JSON.parse(MemStore.getItem('hms_v2_beds') || '[]');
    
    container.innerHTML = beds.map(b => `
        <div class="glass-card text-center p-4 hover-scale pointer" 
             style="border: 1px solid ${b.status === 'Available' ? 'var(--success)' : 'var(--danger)'};"
             onclick="handleUpdateBedStatus('${b.number}', '${b.status === 'Available' ? 'Occupied' : 'Available'}')">
            <div class="text-lg font-bold" style="color:${b.status === 'Available' ? 'var(--success)' : 'var(--danger)'}">#${b.number}</div>
            <div class="text-xs text-muted mb-2">${b.type}</div>
            <span class="text-xs">${b.status}</span>
        </div>
    `).join('');
}

function renderVitalsPtSelect() {
    const select = document.getElementById('vitals-pt-select');
    if(!select) return;
    const pts = JSON.parse(MemStore.getItem('hms_v2_patients') || '[]');
    select.innerHTML = '<option value="">Select Patient...</option>' + pts.map(p => `<option value="${p.fname} ${p.lname}">${p.fname} ${p.lname}</option>`).join('');
}

function renderEmergencyContacts() {
    const list = document.getElementById('emergency-contacts-list');
    if(!list) return;
    const contacts = [
        { name: 'Dr. Sarah (Emergency Head)', phone: '+91-9876543210' },
        { name: 'Ambulance Dispatch', phone: '102 / 108' },
        { name: 'Hospital Front Desk', phone: '011-2345678' }
    ];
    list.innerHTML = contacts.map(c => `
        <div class="flex justify-between p-3 glass-card mb-2">
            <strong>${c.name}</strong>
            <a href="tel:${c.phone}" class="text-primary">${c.phone}</a>
        </div>
    `).join('');
}

function renderPatientHistory(name) {
    const content = document.getElementById('patient-history-content');
    if(!content) return;
    const rx = JSON.parse(MemStore.getItem('hms_v2_prescriptions') || '[]');
    const labs = JSON.parse(MemStore.getItem('hms_v2_labs') || '[]');
    const history = rx.filter(r => r.patient === name || r.patient.includes(name));
    
    content.innerHTML = `
        <div class="mb-4">
            <h4 class="text-sm caps text-muted mb-4">Past Diagnoses & Prescriptions</h4>
            ${history.length > 0 ? history.map(h => `
                <div class="glass-card p-3 mb-2">
                    <div class="flex justify-between"><strong>${h.diagnosis}</strong> <span class="text-xs">${h.date}</span></div>
                    <div class="text-sm mt-1">${h.meds}</div>
                </div>
            `).join('') : '<p class="text-muted">No clinical history found.</p>'}
        </div>
        <div>
            <h4 class="text-sm caps text-muted mb-4">Laboratory Records</h4>
            ${labs.filter(l => l.patient === name).map(l => `
                <div class="flex justify-between p-2 rounded mb-1" style="background:rgba(255,255,255,0.05);">
                    <span>${l.test}</span> <span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success)">${l.status}</span>
                </div>
            `).join('')}
        </div>
    `;
    openModal('modal-patient-history');
}

function renderPendingFulfillment() {
    const list = document.getElementById('fulfillment-list');
    if(!list) return;
    const rx = JSON.parse(MemStore.getItem('hms_v2_prescriptions') || '[]');
    const pending = rx.filter(r => r.status === 'Pending' || !r.status);
    
    if(pending.length > 0) {
        list.innerHTML = pending.map(p => `
            <div class="flex justify-between items-center p-3 rounded glass-card">
                <div>
                    <strong>${p.patient}</strong>
                    <div class="text-xs text-muted">${p.meds}</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="fulfillPrescription('${p.id}')">Dispense</button>
            </div>
        `).join('');
    } else {
        list.innerHTML = '<div class="text-center text-sm text-muted py-4">No pending fulfillments.</div>';
    }
}

function fulfillPrescription(id) {
    const rx = JSON.parse(MemStore.getItem('hms_v2_prescriptions') || '[]');
    const item = rx.find(r => r.id === id);
    if(item) {
        item.status = 'Dispensed';
        MemStore.setItem('hms_v2_prescriptions', JSON.stringify(rx));
        showToast("Medication dispensed successfully.", "success");
        renderPendingFulfillment();
    }
}

function renderSampleTracking() {
    const list = document.getElementById('sample-status-list');
    if(!list) return;
    const labs = JSON.parse(MemStore.getItem('hms_v2_labs') || '[]');
    
    list.innerHTML = labs.map(l => `
        <div class="flex justify-between items-center p-3 rounded glass-card">
            <div>
                <strong>${l.test}</strong>
                <div class="text-xs text-muted">${l.patient} | ${l.id}</div>
            </div>
            <select class="form-control text-xs" style="width:120px;" onchange="updateSampleStatus('${l.id}', this.value)">
                <option value="Collected" ${l.status === 'Collected' ? 'selected' : ''}>Collected</option>
                <option value="Processing" ${l.status === 'Processing' ? 'selected' : ''}>Processing</option>
                <option value="Completed" ${l.status === 'Completed' ? 'selected' : ''}>Completed</option>
            </select>
        </div>
    `).join('');
}

function updateSampleStatus(id, status) {
    const labs = JSON.parse(MemStore.getItem('hms_v2_labs') || '[]');
    const item = labs.find(l => l.id === id);
    if(item) {
        item.status = status;
        MemStore.setItem('hms_v2_labs', JSON.stringify(labs));
        showToast(`Sample status updated to ${status}`, "success");
    }
}
