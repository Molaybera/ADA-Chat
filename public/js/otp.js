const verifyBtn = document.getElementById('btn-verify');
const btnText = document.getElementById('btn-text');
const btnLoader = document.getElementById('btn-loader');
const otpInput = document.getElementById('otp-code');

/**
 * Custom Toast Notification System
 */
function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation';
    
    toast.innerHTML = `
        <div class="toast-content" style="display: flex; align-items: center; gap: 12px;">
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        </div>
        <div class="toast-progress"></div>
    `;

    Object.assign(toast.style, {
        position: 'fixed', top: '20px', right: '20px', background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)', color: '#fff', padding: '16px 24px', borderRadius: '12px',
        border: `1px solid ${type === 'success' ? '#10b981' : '#ef4444'}`, zIndex: '99999',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)', minWidth: '320px',
        animation: 'slideInRight 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
    });

    document.body.appendChild(toast);

    if (!document.getElementById('toast-anim-css')) {
        const style = document.createElement('style');
        style.id = 'toast-anim-css';
        style.innerHTML = `
            @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
            .toast-progress { position: absolute; bottom: 0; left: 0; height: 3px; background: #00d4ff; width: 100%; }
            .custom-toast.error .toast-progress { background: #ef4444; }
            .custom-toast.success .toast-progress { background: #10b981; }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

verifyBtn.onclick = async (e) => {
    e.preventDefault();
    
    const email = sessionStorage.getItem('pendingEmail');
    const otp = otpInput.value;

    if (!otp || otp.length < 6) {
        showToast("Please enter the complete 6-digit code.");
        return;
    }

    if (!email) {
        showToast("Session expired. Please start login again.");
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }

    verifyBtn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');

    try {
        const res = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });

        const data = await res.json();
        
        if (res.ok) {
            const token = data.token;
            const userObj = data.user || {};
            const name = userObj.name || "User";
            const id = userObj.id || userObj._id; 

            if (!token || !id) {
                showToast("Server error: Missing identity data.");
                verifyBtn.disabled = false;
                btnText.classList.remove('hidden');
                btnLoader.classList.add('hidden');
                return;
            }

            // SECURE SESSION: Using sessionStorage for privacy
            sessionStorage.setItem('token', token);
            sessionStorage.setItem('userName', name);
            sessionStorage.setItem('userId', id); 
            
            sessionStorage.removeItem('pendingEmail');
            showToast("Verification successful!", "success");
            
            setTimeout(() => {
                window.location.href = 'chat.html';
            }, 1000);
        } else {
            showToast(data.message || "Invalid or expired OTP.");
            verifyBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
        }
    } catch (err) {
        showToast("Connection error. Please try again.");
        verifyBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
};