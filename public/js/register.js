// public/js/register.js
const regBtn = document.getElementById('btn-register');
const btnText = document.getElementById('btn-text');
const btnLoader = document.getElementById('btn-loader');
const passwordInput = document.getElementById('reg-password');
const requirementsContainer = document.getElementById('password-validation-box');

/**
 * Password visibility toggle
 * Improved to prevent UI overlap with the lock icon
 */
const passwordWrapper = passwordInput.parentElement;
const toggleIcon = document.createElement('i');
toggleIcon.className = 'fa-solid fa-eye password-toggle';
passwordWrapper.appendChild(toggleIcon);

toggleIcon.onclick = () => {
    const isPassword = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
    toggleIcon.className = `fa-solid ${isPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle`;
};

/**
 * Password validation rules
 */
const passwordRules = [
    { label: "At least 8 characters", regex: /.{8,}/ },
    { label: "At least one uppercase letter", regex: /[A-Z]/ },
    { label: "At least one lowercase letter", regex: /[a-z]/ },
    { label: "At least one number", regex: /[0-9]/ },
    { label: "At least one special character", regex: /[!@#$%^&*(),.?":{}|<>]/ }
];

/**
 * Initialize Password Feedback UI
 */
function initPasswordUI() {
    requirementsContainer.innerHTML = ''; 
    passwordRules.forEach((rule, index) => {
        const item = document.createElement('div');
        item.id = `rule-${index}`;
        item.className = 'rule-item';
        item.style.color = '#94a3b8'; 
        item.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color: #ef4444;"></i> <span>${rule.label}</span>`;
        requirementsContainer.appendChild(item);
    });
}

initPasswordUI();

/**
 * Live validation listener
 */
passwordInput.addEventListener('input', () => {
    const value = passwordInput.value;
    
    passwordRules.forEach((rule, index) => {
        const item = document.getElementById(`rule-${index}`);
        const isValid = rule.regex.test(value);
        
        if (isValid) {
            item.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> <span>${rule.label}</span>`;
            item.style.color = '#10b981';
        } else {
            item.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color: #ef4444;"></i> <span>${rule.label}</span>`;
            item.style.color = '#94a3b8';
        }
    });
});

/**
 * Custom Toast Notification System
 */
function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation';
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        </div>
        <div class="toast-progress"></div>
    `;

    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: 'rgba(30, 41, 59, 0.95)',
        backdropFilter: 'blur(10px)',
        color: '#fff',
        padding: '16px 24px',
        borderRadius: '12px',
        border: `1px solid ${type === 'success' ? '#10b981' : '#ef4444'}`,
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: '300px',
        animation: 'slideIn 0.3s ease-out forwards'
    });

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Fixed UI Styles to prevent icon overlapping
const styleSheet = document.createElement("style");
styleSheet.innerText = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
    .toast-progress { position: absolute; bottom: 0; left: 0; height: 3px; width: 100%; background: rgba(255,255,255,0.2); }
    .custom-toast.error .toast-progress { background: #ef4444; }
    .custom-toast.success .toast-progress { background: #10b981; }
    .toast-content { display: flex; align-items: center; gap: 12px; }
    
    /* Crucial fix for the overlapping icons in the input box */
    .password-toggle {
        position: absolute !important;
        right: 16px !important;
        left: auto !important; /* Overrides the general CSS forcing icons to the left */
        color: #94a3b8;
        cursor: pointer;
        z-index: 10;
        transition: color 0.2s;
        display: flex;
        align-items: center;
        height: 100%;
        top: 0;
    }
    .password-toggle:hover {
        color: #00d4ff;
    }
`;
document.head.appendChild(styleSheet);

regBtn.onclick = async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = passwordInput.value;

    if (!name || !email || !password) {
        showToast("Please fill in your all details.");
        return;
    }

    const isStrongPassword = passwordRules.every(rule => rule.regex.test(password));
    if (!isStrongPassword) {
        showToast("Please follow all password security requirements.");
        return;
    }

    regBtn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();
        
        if (res.ok) {
            showToast("Account created successfully! Redirecting to login...", "success");
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        } else {
            showToast(data.message || "Registration failed. Try a different email.");
            regBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
        }
    } catch (err) {
        showToast("Server connection error. Please try again later.");
        regBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
};