/**
 * Secure Chat & WebRTC Logic
 * Fully stable version with ICE buffering and Avatar management.
 * Preserves all logic for messaging, file transfer, and high-fidelity calling.
 */
const socket = io();

const token = localStorage.getItem('token');
const userName = localStorage.getItem('userName');
const userId = localStorage.getItem('userId');

let activeRecipientId = null;
let onlineUsers = [];
let unreadCounts = {};
let stagedFile = null;

// WebRTC State
let peerConnection = null;
let localStream = null;
let callStartTime = null;
let callStartFormatted = null;
let isVideoCall = false;
let cameraEnabled = true;
let activeCallType = 'voice';
const iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
let pendingIceCandidates = [];

// UI Selectors
const chatWindow = document.getElementById('chat-window');
const msgInput = document.getElementById('msg-input');
const fileInput = document.getElementById('file-input');
const sendBtn = document.getElementById('btn-send');
const userListContent = document.getElementById('user-list-content');
const chatHeader = document.getElementById('chat-header');
const activeChatUser = document.getElementById('active-chat-user');
const activeAvatar = document.getElementById('active-avatar');
const chatInputArea = document.getElementById('chat-input-area');
const welcomeScreen = document.getElementById('welcome-screen');
const userDisplay = document.getElementById('user-display');

const callOverlay = document.getElementById('call-overlay');
const callAvatar = document.getElementById('call-avatar');
const callStatusText = document.getElementById('call-status-text');
const callerNameDisplay = document.getElementById('caller-name');
const videoGrid = document.getElementById('video-grid');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const btnAccept = document.getElementById('btn-accept-call');
const btnHangup = document.getElementById('btn-hangup');
const btnToggleMic = document.getElementById('btn-toggle-mic');
const btnToggleCamera = document.getElementById('btn-toggle-camera');

const localAvatarOverlay = document.getElementById('local-avatar-overlay');
const localAvInitial = document.getElementById('local-av-initial');
const remoteAvatarOverlay = document.getElementById('remote-avatar-overlay');
const remoteAvInitial = document.getElementById('remote-av-initial');
const remoteAvName = document.getElementById('remote-av-name');

const menuTrigger = document.querySelector('.fa-ellipsis-vertical')?.parentElement;

// ── Mobile navigation ──────────────────────────────────────────────────────
const sidebar   = document.querySelector('.sidebar');
const chatArea  = document.querySelector('.chat-area');
const btnBack   = document.getElementById('btn-back-mobile');

function showChatMobile() {
    sidebar?.classList.add('hidden-mobile');
    chatArea?.classList.add('visible-mobile');
}
function showSidebarMobile() {
    sidebar?.classList.remove('hidden-mobile');
    chatArea?.classList.remove('visible-mobile');
}
if (btnBack) btnBack.onclick = showSidebarMobile;

// ── Screenshot detection disabled ──────────────────────────────────────────

function scrollToBottom() {
    if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
}

function fmtTime(date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtDuration(secs) {
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

if (!token || !userId) {
    window.location.href = 'login.html';
} else {
    if (userDisplay) userDisplay.innerText = userName;
    socket.emit('registerUser', { userId, userName });
}

socket.on('updateUserList', (users) => {
    onlineUsers = users.filter(u => u.userId !== userId);
    renderUserList();
});

function renderUserList() {
    if (!userListContent) return;
    userListContent.innerHTML = '';
    onlineUsers.forEach(user => {
        const unread = unreadCounts[user.userId] || 0;
        const badge = unread > 0 ? `<div class="unread-badge">${unread}</div>` : '';
        const item = document.createElement('div');
        item.className = `contact-item ${activeRecipientId === user.userId ? 'active' : ''}`;
        item.innerHTML = `
            <div class="contact-avatar">${user.userName.charAt(0).toUpperCase()}<div class="online-dot"></div></div>
            <div class="contact-info">
                <div class="contact-name-row"><span class="contact-name">${user.userName}</span></div>
                <div class="contact-preview"><span>Secure Session</span>${badge}</div>
            </div>`;
        item.onclick = () => selectContact(user);
        userListContent.appendChild(item);
    });
}

async function selectContact(user) {
    activeRecipientId = user.userId;
    unreadCounts[user.userId] = 0;
    conversationLog = []; // ✅ reset log for new contact
    resetFileStaging();
    showChatMobile(); // ✅ switch to chat view on mobile

    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (chatHeader) chatHeader.style.display = 'flex';
    if (chatInputArea) chatInputArea.style.display = 'block';
    if (activeChatUser) activeChatUser.innerText = user.userName;
    if (activeAvatar) activeAvatar.innerText = user.userName.charAt(0).toUpperCase();

    chatWindow.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.5;">Establishing secure tunnel...</div>';

    try {
        const response = await fetch(`/api/chat/history/${user.userId}?userId=${userId}`);
        const history = await response.json();
        chatWindow.innerHTML = '';
        if (history.length > 0) {
            history.forEach(msg => renderMessage(msg, msg.senderId === userId));
        } else {
            chatWindow.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.3; font-size:12px;">No previous messages.</div>';
        }
        setTimeout(scrollToBottom, 100);
    } catch (err) { console.error("History fetch failed:", err); }
    renderUserList();
}

function sendMessage() {
    if (!activeRecipientId) return;
    const text = msgInput.value.trim();
    if (stagedFile) {
        const p = { ...stagedFile, senderId: userId, senderName: userName, receiverId: activeRecipientId, timestamp: new Date().toISOString() };
        socket.emit('privateMessage', p);
        renderMessage(p, true);
        resetFileStaging();
    }
    if (text) {
        const p = { type: 'text', content: text, senderId: userId, senderName: userName, receiverId: activeRecipientId, timestamp: new Date().toISOString() };
        socket.emit('privateMessage', p);
        renderMessage(p, true);
        msgInput.value = '';
    }
}

function resetFileStaging() {
    stagedFile = null;
    if (fileInput) fileInput.value = '';
    document.getElementById('staged-preview-box')?.remove();
}

function showStagedPreview(type, content, name) {
    document.getElementById('staged-preview-box')?.remove();
    const box = document.createElement('div');
    box.id = 'staged-preview-box';
    Object.assign(box.style, {
        position: 'absolute', bottom: '80px', left: '30px', right: '30px',
        background: 'rgba(30, 41, 59, 0.95)', backdropFilter: 'blur(10px)',
        padding: '12px', borderRadius: '12px', border: '1px solid var(--primary)',
        display: 'flex', alignItems: 'center', gap: '12px', zIndex: '100'
    });
    box.innerHTML = `<div style="font-size:11px;flex:1">Ready to send: <strong>${name}</strong></div>
                     <div id="cancel-stage" style="cursor:pointer;color:#ef4444"><i class="fa-solid fa-xmark"></i></div>`;
    chatInputArea.appendChild(box);
    document.getElementById('cancel-stage').onclick = resetFileStaging;
}

if (sendBtn) sendBtn.onclick = sendMessage;
if (msgInput) msgInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
if (fileInput) {
    fileInput.onchange = (e) => {
        if (!activeRecipientId) return;
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const type = file.type.includes('image') ? 'image' : 'file';
            stagedFile = { type, content: reader.result, fileName: file.name };
            showStagedPreview(type, reader.result, file.name);
        };
        reader.readAsDataURL(file);
    };
}

function attachStream(videoEl, stream) {
    videoEl.srcObject = stream;
    videoEl.play().catch(e => console.warn('video.play() suppressed:', e));
}

function setLocalAvatar(show) {
    if (!localAvatarOverlay) return;
    if (localAvInitial) localAvInitial.textContent = (userName || 'U').charAt(0).toUpperCase();
    localAvatarOverlay.style.display = show ? 'flex' : 'none';
    localVideo.style.display = show ? 'none' : 'block';
}

function setRemoteAvatar(show) {
    if (!remoteAvatarOverlay) return;
    const peer = onlineUsers.find(u => u.userId === activeRecipientId);
    const name = peer ? peer.userName : (callerNameDisplay?.innerText || '?');
    if (remoteAvInitial) remoteAvInitial.textContent = name.charAt(0).toUpperCase();
    if (remoteAvName) remoteAvName.textContent = name;
    remoteAvatarOverlay.style.display = show ? 'flex' : 'none';
}

function updateCameraButtonVisibility() {
    if (!btnToggleCamera) return;
    btnToggleCamera.classList.toggle('hidden', !isVideoCall);
}

async function acquireMedia(requestedType) {
    if (requestedType === 'voice') {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        return { stream, actualType: 'voice' };
    }
    const attempts = [
        { constraints: { video: true, audio: true }, label: 'video+audio' },
        { constraints: { video: true, audio: false }, label: 'video only'  },
        { constraints: { video: false, audio: true }, label: 'audio only'  },
    ];
    let lastError;
    for (const a of attempts) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(a.constraints);
            return { stream, actualType: a.constraints.video ? 'video' : 'voice' };
        } catch (err) {
            console.warn(`getUserMedia (${a.label}) failed:`, err.name);
            lastError = err;
        }
    }
    throw lastError;
}

async function flushPendingCandidates() {
    while (pendingIceCandidates.length > 0) {
        const c = pendingIceCandidates.shift();
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(c)); }
        catch (e) { console.warn('Buffered ICE rejected (safe):', e); }
    }
}

function createPeerConnection(remoteTargetId) {
    const pc = new RTCPeerConnection(iceServers);

    pc.ontrack = (event) => {
        if (remoteVideo.srcObject !== event.streams[0]) {
            attachStream(remoteVideo, event.streams[0]);
        }
        const hasVideo = event.streams[0].getVideoTracks().length > 0;
        setRemoteAvatar(!hasVideo);

        callStatusText.innerText = 'Line Secured';
        callStartTime = new Date();
        callStartFormatted = fmtTime(callStartTime);
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) socket.emit('ice-candidate', { to: remoteTargetId, candidate: event.candidate });
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') terminateCall(true);
    };

    return pc;
}

async function initCall(type) {
    if (!activeRecipientId) return;
    if (peerConnection) terminateCall(false);

    activeCallType = type;
    const targetUser = onlineUsers.find(u => u.userId === activeRecipientId);
    const targetName = targetUser?.userName || 'User';

    showCallOverlay('Dialing...', targetName);

    try {
        const { stream, actualType } = await acquireMedia(type);
        localStream = stream;
        isVideoCall = actualType === 'video';
        cameraEnabled = isVideoCall;
        activeCallType = actualType;

        if (isVideoCall) {
            videoGrid.classList.remove('hidden');
            attachStream(localVideo, localStream);
            setLocalAvatar(false);
            setRemoteAvatar(true);
        } else {
            if (type === 'video') callStatusText.innerText = 'Camera unavailable, audio only';
            videoGrid.classList.remove('hidden');
            setLocalAvatar(true);
            setRemoteAvatar(true);
        }

        updateCameraButtonVisibility();
        peerConnection = createPeerConnection(activeRecipientId);
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('call-user', { to: activeRecipientId, from: userId, fromName: userName, offer, type: actualType });

    } catch (err) {
        console.error('No media devices:', err);
        callStatusText.innerText = 'Microphone access denied';
        setTimeout(() => terminateCall(false), 1500);
    }
}

socket.on('incoming-call', async (data) => {
    if (peerConnection) { socket.emit('hang-up', { to: data.from, reason: 'busy' }); return; }

    activeRecipientId = data.from;
    activeCallType = data.type;

    showCallOverlay(`Incoming ${data.type} call...`, data.fromName);
    btnAccept.classList.remove('hidden');

    btnAccept.onclick = async () => {
        btnAccept.classList.add('hidden');
        callStatusText.innerText = 'Connecting...';

        try {
            let stream, actualType;
            try {
                ({ stream, actualType } = await acquireMedia(data.type));
            } catch (mediaErr) {
                console.error('No media on callee:', mediaErr);
                callStatusText.innerText = 'Microphone access denied';
                socket.emit('hang-up', { to: data.from });
                setTimeout(() => terminateCall(false), 1500);
                return;
            }

            localStream = stream;
            isVideoCall = actualType === 'video';
            cameraEnabled = isVideoCall;
            activeCallType = actualType;

            if (isVideoCall) {
                videoGrid.classList.remove('hidden');
                attachStream(localVideo, localStream);
                setLocalAvatar(false);
                setRemoteAvatar(true);
            } else {
                if (data.type === 'video') callStatusText.innerText = 'Camera unavailable, audio only';
                videoGrid.classList.remove('hidden');
                setLocalAvatar(true);
                setRemoteAvatar(true);
            }

            updateCameraButtonVisibility();
            peerConnection = createPeerConnection(data.from);
            localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            await flushPendingCandidates();

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('answer-call', { to: data.from, answer });

        } catch (err) {
            console.error('Callee setup failed:', err);
            socket.emit('hang-up', { to: data.from });
            terminateCall(false);
        }
    };
});

socket.on('call-answered', async (data) => {
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        await flushPendingCandidates();
    }
});

socket.on('ice-candidate', async (data) => {
    if (!data.candidate) return;
    if (peerConnection && peerConnection.remoteDescription) {
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)); }
        catch (e) { console.warn('ICE rejected:', e); }
    } else {
        pendingIceCandidates.push(data.candidate);
    }
});

socket.on('call-ended', () => terminateCall(false));

function terminateCall(sendSignal = true) {
    if (callStartTime) {
        const endTime = new Date();
        const duration = Math.floor((endTime - callStartTime) / 1000);
        const label = activeCallType === 'video' ? 'Video call' : 'Voice call';
        const content = `${label}|${callStartFormatted}|${fmtTime(endTime)}|${fmtDuration(duration)}`;

        if (sendSignal) recordCallInChat(content);
        else renderMessage({ type: 'call', content, senderId: activeRecipientId, receiverId: userId, timestamp: new Date().toISOString() }, false);
    } else if (activeRecipientId && sendSignal) {
        const label = activeCallType === 'video' ? 'Video call' : 'Voice call';
        recordCallInChat(`${label}|cancelled`);
    }

    if (sendSignal && activeRecipientId) socket.emit('hang-up', { to: activeRecipientId });

    if (localStream) {
        localStream.getTracks().forEach(t => { t.stop(); t.enabled = false; });
        localStream = null;
    }

    if (peerConnection) {
        peerConnection.onconnectionstatechange = null;
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;
        peerConnection.close();
        peerConnection = null;
    }

    pendingIceCandidates = [];
    isVideoCall = false;
    cameraEnabled = true;
    callStartTime = null;
    callStartFormatted = null;

    if (callAvatar) callAvatar.innerText = '?';

    if (btnToggleCamera) {
        btnToggleCamera.classList.add('hidden');
        btnToggleCamera.style.opacity = '1';
        btnToggleCamera.title = 'Turn Camera Off';
        btnToggleCamera.innerHTML = '<i class="fa-solid fa-video"></i>';
    }
    if (btnToggleMic) {
        btnToggleMic.style.opacity = '1';
        btnToggleMic.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    }

    if (localAvatarOverlay) localAvatarOverlay.style.display = 'none';
    if (remoteAvatarOverlay) remoteAvatarOverlay.style.display = 'none';

    callOverlay.classList.add('hidden');
    videoGrid.classList.add('hidden');
    btnAccept.classList.add('hidden');
    localVideo.style.display = 'block';
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
}

function recordCallInChat(content) {
    if (!activeRecipientId) return;
    const msg = { type: 'call', content, senderId: userId, receiverId: activeRecipientId, timestamp: new Date().toISOString() };
    socket.emit('privateMessage', msg);
    renderMessage(msg, true);
}

function showCallOverlay(status, name) {
    callOverlay.classList.remove('hidden');
    callStatusText.innerText = status;
    callerNameDisplay.innerText = name;
    if (callAvatar) callAvatar.innerText = (name || '?').charAt(0).toUpperCase();
}

socket.on('receivePrivateMessage', (msg) => {
    if (msg.senderId === activeRecipientId) renderMessage(msg, false);
    else { unreadCounts[msg.senderId] = (unreadCounts[msg.senderId] || 0) + 1; renderUserList(); }
});

function renderMessage(msg, isSelf) {
    if (msg.type === 'call') {
        const log = document.createElement('div');
        log.className = 'msg-row call-log';
        const parts = msg.content.split('|');
        const label = parts[0];
        const isCancelled = parts[1] === 'cancelled';
        let bubbleHtml;
        if (isCancelled) {
            bubbleHtml = `<div class="call-log-bubble missed"><i class="fa-solid fa-phone-slash"></i><div class="call-log-text"><span class="call-log-label">${label}</span><span class="call-log-meta">Cancelled</span></div></div>`;
        } else {
            const startTime = parts[1] || '';
            const endTime   = parts[2] || '';
            const duration  = parts[3] || '';
            bubbleHtml = `<div class="call-log-bubble success"><i class="fa-solid fa-phone-flip"></i><div class="call-log-text"><span class="call-log-label">${label} · ${duration}</span><span class="call-log-meta">${startTime} – ${endTime}</span></div></div>`;
        }
        log.innerHTML = bubbleHtml;
        chatWindow.appendChild(log);
        scrollToBottom();
        return;
    }
    const row = document.createElement('div');
    row.className = `msg-row ${isSelf ? 'self' : 'other'}`;
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let contentHtml = '';
    if (msg.type === 'text') contentHtml = `<p>${msg.content}</p>`;
    else if (msg.type === 'image') contentHtml = `<img src="${msg.content}" style="max-width:250px;border-radius:12px;">`;
    else if (msg.type === 'file') contentHtml = `<div style="padding:10px;background:rgba(0,0,0,0.1);border-radius:8px;">📁 ${msg.fileName}</div>`;
    const encBadge = isSelf ? `<span class="enc-indicator"><i class="fa-solid fa-lock"></i>encrypted</span>` : '';
    row.innerHTML = `<div class="bubble">${contentHtml}<div class="bubble-meta">${encBadge}${time}</div></div>`;
    chatWindow.appendChild(row);
    scrollToBottom();
    // ✅ Track message for AI summarizer
    conversationLog.push({
        type: msg.type,
        content: msg.content,
        senderName: isSelf ? userName : (activeChatUser?.innerText || 'Them')
    });
}

document.getElementById('btn-voice-call').onclick = () => initCall('voice');
document.getElementById('btn-video-call').onclick = () => initCall('video');
btnHangup.onclick = () => terminateCall(true);

btnToggleMic.onclick = () => {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    btnToggleMic.style.opacity = track.enabled ? '1' : '0.4';
    btnToggleMic.title = track.enabled ? 'Mute Mic' : 'Unmute Mic';
    btnToggleMic.innerHTML = track.enabled ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-solid fa-microphone-slash"></i>';
};

btnToggleCamera.onclick = () => {
    if (!localStream || !isVideoCall) return;
    const track = localStream.getVideoTracks()[0];
    if (!track) return;
    cameraEnabled = !cameraEnabled;
    track.enabled = cameraEnabled;
    btnToggleCamera.style.opacity = cameraEnabled ? '1' : '0.4';
    btnToggleCamera.title = cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On';
    btnToggleCamera.innerHTML = cameraEnabled ? '<i class="fa-solid fa-video"></i>' : '<i class="fa-solid fa-video-slash"></i>';
    setLocalAvatar(!cameraEnabled);
};

if (menuTrigger) {
    menuTrigger.onclick = (e) => {
        e.stopPropagation();
        const existing = document.getElementById('sidebar-dropdown-menu');
        if (existing) { existing.remove(); return; }
        const menu = document.createElement('div');
        menu.id = 'sidebar-dropdown-menu';
        Object.assign(menu.style, { position: 'absolute', top: '70px', left: '24px', background: '#1e293b', border: '1px solid var(--border)', borderRadius: '12px', padding: '8px', zIndex: '1000' });
        menu.innerHTML = `<div id="dropdown-logout" style="padding:10px;cursor:pointer;color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> Secure Logout</div>`;
        menuTrigger.parentElement.appendChild(menu);
        document.getElementById('dropdown-logout').onclick = confirmLogout;
        window.addEventListener('click', () => menu.remove(), { once: true });
    };
}

function confirmLogout() {
    if (confirm("End secure session and wipe local data?")) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}
const headerLogoutBtn = document.getElementById('btn-logout');
if (headerLogoutBtn) headerLogoutBtn.onclick = confirmLogout;

// ── AI Conversation Summarizer ────────────────────────────────────────────
const btnSummarize    = document.getElementById('btn-summarize');
const summaryModal    = document.getElementById('summary-modal');
const btnCloseSummary = document.getElementById('btn-close-summary');
const summaryLoading  = document.getElementById('summary-loading');
const summaryText     = document.getElementById('summary-text');

// Tracks all messages in the current conversation for summarizing
let conversationLog = [];

if (btnSummarize) {
    btnSummarize.onclick = async () => {
        if (!activeRecipientId) return;

        // Show modal with loading state
        summaryModal.classList.remove('hidden');
        summaryLoading.classList.remove('hidden');
        summaryText.classList.add('hidden');
        summaryText.innerHTML = '';

        try {
            const res = await fetch('/api/chat/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: conversationLog })
            });

            const data = await res.json();

            summaryLoading.classList.add('hidden');
            summaryText.classList.remove('hidden');

            if (!res.ok) {
                summaryText.innerHTML = `<p style="color:#ef4444">${data.message || 'Summarization failed.'}</p>`;
                return;
            }

            // Render the bullet points
            const badge = `<div class="summary-badge"><i class="fa-solid fa-robot"></i> Powered by Groq LLaMA 3</div>`;
            const points = data.points.map(p =>
                `<div class="summary-point">
                    <i class="fa-solid fa-circle-dot"></i>
                    <span>${p}</span>
                </div>`
            ).join('');

            summaryText.innerHTML = badge + points;

        } catch (err) {
            summaryLoading.classList.add('hidden');
            summaryText.classList.remove('hidden');
            summaryText.innerHTML = `<p style="color:#ef4444">Connection error. Please try again.</p>`;
        }
    };
}

if (btnCloseSummary) {
    btnCloseSummary.onclick = () => summaryModal.classList.add('hidden');
}

// Close modal on backdrop click
if (summaryModal) {
    summaryModal.onclick = (e) => {
        if (e.target === summaryModal) summaryModal.classList.add('hidden');
    };
}