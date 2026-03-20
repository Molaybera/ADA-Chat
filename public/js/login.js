// public/js/login.js
const loginBtn = document.getElementById('btn-login');
const btnText = document.getElementById('btn-text');
const btnLoader = document.getElementById('btn-loader');

/**
 * Custom Toast Notification System
 * Replaces default browser alerts with an attractive UI popup
 */
function showToast(message, type = 'error') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    
    // Set icons based on type
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation';
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        </div>
        <div class="toast-progress"></div>
    `;

    // Add styles dynamically if they aren't in CSS yet
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: 'rgba(30, 41, 59, 0.9)',
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

    // Append to body
    document.body.appendChild(toast);

    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animation keyframes to the document
const styleSheet = document.createElement("style");
styleSheet.innerText = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .toast-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        width: 100%;
        background: rgba(255,255,255,0.2);
    }
    .custom-toast.error .toast-progress { background: #ef4444; }
    .custom-toast.success .toast-progress { background: #10b981; }
    .toast-content { display: flex; align-items: center; gap: 12px; }
`;
document.head.appendChild(styleSheet);

loginBtn.onclick = async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // Basic Validation
    if (!email || !password) {
        showToast("Please fill in all fields to proceed.");
        return;
    }

    // --- START LOADING STATE ---
    loginBtn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        
        if (res.ok) {
            // Store email temporarily for the OTP page
            sessionStorage.setItem('pendingEmail', email);
            showToast("Credentials verified! Sending OTP...", "success");
            
            // Short delay so user can see the success toast
            setTimeout(() => {
                window.location.href = 'otp.html';
            }, 1000);
        } else {
            showToast(data.message || "Login failed. Please check your details.");
            // --- RESET LOADING STATE ON ERROR ---
            loginBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
        }
    } catch (err) {
        console.error("Login Error:", err);
        showToast("Server unreachable. Please check your internet connection.");
        
        // --- RESET LOADING STATE ON ERROR ---
        loginBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
};