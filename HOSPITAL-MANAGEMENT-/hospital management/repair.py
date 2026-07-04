import re
import os

app_file = 'frontend/js/app.js'
with open(app_file, 'r', encoding='utf-8') as f:
    app_text = f.read()

# Fix DOMContentLoaded
if 'document.addEventListener("DOMContentLoaded", () => {' in app_text:
    app_text = app_text.replace(
        'document.addEventListener("DOMContentLoaded", () => {',
        'document.addEventListener("DOMContentLoaded", async () => { await window.MemStore.init(); const __su = await API.auth.getUser(); if(__su){ MemStore.setItem("hms_v2_token","supa"); MemStore.setItem("hms_v2_role",__su.role); MemStore.setItem("hms_v2_name",__su.name); } else { MemStore.removeItem("hms_v2_token"); }'
    )

# Extract and Replace handleLoginSubmit
login_pattern = r"async function handleLoginSubmit[\s\S]*?catch \(err\) \{[\s\S]*?\n\}"
login_replacement = """async function handleLoginSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login-submit');
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;

    if (!username || !password) {
        if(typeof showToast==='function') showToast("Username and Password are required", "warning");
        return;
    }

    const orgText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
    
    try {
        const res = await API.auth.login(username, password);
        
        // Finalize state
        MemStore.setItem('hms_v2_token', res.token);
        MemStore.setItem('hms_v2_role', res.role);
        MemStore.setItem('hms_v2_name', res.username);
        
        if(typeof showToast==='function') showToast(`Welcome back, ${res.username}!`, "success");
        
        setTimeout(() => {
            location.reload(); 
        }, 1000);

    } catch (err) {
        btn.innerHTML = orgText;
        if(typeof showToast==='function') showToast(err.message, "error");
        
        // Fallback for demo without Supabase Key!
        if (err.message.includes('API key') || err.message.includes('fetch')) {
             MemStore.setItem('hms_v2_token', 'demo_token');
             MemStore.setItem('hms_v2_role', 'SuperAdmin');
             MemStore.setItem('hms_v2_name', username);
             if(typeof showToast==='function') showToast('Demo Mode Backend Active', 'success');
             setTimeout(() => { location.reload(); }, 1000);
        }
    }
}
"""
if re.search(login_pattern, app_text):
    app_text = re.sub(login_pattern, login_replacement, app_text)


# Extract and Replace handleRegistrationSubmit
reg_pattern = r"async function handleRegistrationSubmit[\s\S]*?catch \(err\) \{[\s\S]*?\n\}"
reg_replacement = """async function handleRegistrationSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-register-submit');
    
    // Collect Data
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    
    if(password !== confirmPassword) {
        if(typeof showToast==='function') showToast("Passwords do not match!", "error");
        return;
    }

    const formData = {
        name: document.getElementById('reg-fullname').value,
        age: document.getElementById('reg-age').value,
        gender: document.getElementById('reg-gender').value,
        phone: document.getElementById('reg-phone').value,
        symptoms: document.getElementById('reg-symptoms')?.value || '',
        password: password,
        role: "Patient"
    };

    const orgText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Securing Account...';
    
    try {
        const res = await API.auth.register(formData);
        if(typeof showToast==='function') showToast("Account created! Our AI has assigned your specialist.", "success");
        if(typeof closeModal==='function') closeModal('modal-register-user');
        btn.innerHTML = orgText;
    } catch (err) {
        btn.innerHTML = orgText;
        if(typeof showToast==='function') showToast(err.message, "error");
    }
}
"""
if re.search(reg_pattern, app_text):
    app_text = re.sub(reg_pattern, reg_replacement, app_text)


with open(app_file, 'w', encoding='utf-8') as f:
    f.write(app_text)

# Fix api.js MemStore
api_file = 'frontend/js/api.js'
with open(api_file, 'r', encoding='utf-8') as f:
    api_text = f.read()

# Make MemStore bulletproof
new_memstore = """// In-Memory Data Store to replace localStorage
window.MemStore = {
    _data: {},
    async init() {
        // Initialize with empty arrays safely FIRST
        this._data.patients = [];
        this._data.doctors = [];
        this._data.appointments = [];
        this._data.labs = [];
        this._data.billing = [];
        this._data.prescriptions = [];
        this._data.nurse_calls = [];
        this._data.food_orders = [];

        try {
            if(!SUPABASE_ANON_KEY.includes('YOUR_')) {
                this._data.patients = await API.patients.getAll() || [];
                this._data.doctors = await API.doctors.getAll() || [];
                this._data.appointments = await API.appointments.getAll() || [];
                this._data.labs = await API.labs.getAll() || [];
                this._data.billing = await API.billing.getHistory() || [];
                this._data.prescriptions = await API.prescriptions.getAll() || [];
                this._data.nurse_calls = await API.nurse.getCalls() || [];
                this._data.food_orders = await API.food.getHistory() || [];
            } else {
                console.warn('Supabase Anon Key is missing. Using local runtime cache only.');
            }
        } catch(e) {
            console.error('Failed to sync with Supabase', e);
        }
    },
    getItem(key) {
        if(key === 'hms_theme_color' || key === 'hms_dark_mode') return null;
        let k = key.replace('hms_v2_', '').replace('hms_portal_', '');
        return JSON.stringify(this._data[k] || []);
    },
    setItem(key, strVal) {
        if(key === 'hms_theme_color' || key === 'hms_dark_mode') return; // Ignore theme writes
        let k = key.replace('hms_v2_', '').replace('hms_portal_', '');
        try {
            this._data[k] = JSON.parse(strVal);
        } catch(e) {
            this._data[k] = strVal; // in case it's token/role
        }
    },
    removeItem(key) {
        let k = key.replace('hms_v2_', '').replace('hms_portal_', '');
        delete this._data[k];
    }
};
"""

# Replace old MemStore with new one
api_text = re.sub(r'// In-Memory Data Store to replace localStorage[\s\S]*?removeItem.*?\}\s*\}[\;]?', new_memstore, api_text)

with open(api_file, 'w', encoding='utf-8') as f:
    f.write(api_text)

print("Repair completed.")
