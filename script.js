// DOM Elements
const pages = {
    entrance: document.getElementById('entrance-page'),
    dashboard: document.getElementById('dashboard-page'),
    waiting: document.getElementById('waiting-page'),
    chat: document.getElementById('chat-page'),
    call: document.getElementById('call-page'),
    disconnected: document.getElementById('disconnected-page')
};

const usernameInput = document.getElementById('username-input');
const swipeBtn = document.getElementById('swipe-btn');
const startChatBtn = document.getElementById('start-chat-btn');
const usernameDisplay = document.getElementById('username-display');
const dashboardUsername = document.getElementById('dashboard-username');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const leaveBtn = document.getElementById('leave-btn');
const partnerName = document.getElementById('partner-name');
const leftMessage = document.getElementById('left-message');
const rematchBtn = document.getElementById('rematch-btn');
const homeBtn = document.getElementById('home-btn');
const donationBtn = document.getElementById('donation-btn');
const voiceCallBtn = document.getElementById('voice-call-btn');
const replyIndicator = document.getElementById('reply-indicator');
const replyUsername = document.getElementById('reply-username');
const replyText = document.getElementById('reply-text');
const closeReply = document.getElementById('close-reply');
const connectionStatus = document.getElementById('connection-status');
const progressBar = document.getElementById('progress-bar');
const activeCountElement = document.getElementById('entrance-active-count');
const qrModal = document.getElementById('qr-modal');
const closeModal = document.querySelector('.close');
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');
const menuBtn = document.querySelector('.menu-btn');
const menuContent = document.querySelector('.menu-content');

// Call Page Elements
const callPage = document.getElementById('call-page');
const callPartnerName = document.getElementById('call-partner-name');
const callStatus = document.getElementById('call-status');
const callTimer = document.getElementById('call-timer');
const backChatBtn = document.getElementById('back-chat-btn');
const hangupBtn = document.getElementById('hangup-btn');
const muteBtn = document.getElementById('mute-btn');

// Incoming Call Elements
const incomingCallModal = document.getElementById('incoming-call-modal');
const callerName = document.getElementById('caller-name');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');

// App State
let currentUser = '';
let partner = '';
let isConnected = false;
let replyingTo = null;
let chatHistory = [];
let waitingTimer = null;
let progressInterval = null;
let messageCounter = 0;
let messageElements = {};
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let typingTimer = null;
let partnerTyping = false;

// Call State
let callActive = false;
let callTimerInterval = null;
let callStartTime = 0;
let isMuted = false;
let incomingCallData = null;
let callNotificationTimer = null;
let callSound = null;
let isRinging = false;

// Initialize the app
function init() {
    // Check if we have a username in localStorage
    const savedUsername = localStorage.getItem('chatUsername');
    if (savedUsername) {
        usernameInput.value = savedUsername;
    }
    
    // Set up connection monitoring
    monitorConnection();
    
    // Event Listeners
    swipeBtn.addEventListener('click', handleSwipe);
    startChatBtn.addEventListener('click', startChat);
    sendBtn.addEventListener('click', sendMessage);
    leaveBtn.addEventListener('click', leaveChat);
    rematchBtn.addEventListener('click', rematch);
    homeBtn.addEventListener('click', goHome);
    donationBtn.addEventListener('click', showDonationModal);
    voiceCallBtn.addEventListener('click', initiateVoiceCall);
    closeReply.addEventListener('click', cancelReply);
    messageInput.addEventListener('input', handleMessageInput);
    messageInput.addEventListener('keydown', handleKeyDown);
    
    // Call Page Event Listeners
    backChatBtn.addEventListener('click', backToChat);
    hangupBtn.addEventListener('click', hangUpCall);
    muteBtn.addEventListener('click', toggleMute);
    
    // Incoming Call Event Listeners
    acceptCallBtn.addEventListener('click', acceptIncomingCall);
    rejectCallBtn.addEventListener('click', rejectIncomingCall);
    
    // Modal event listeners
    closeModal.addEventListener('click', closeDonationModal);
    window.addEventListener('click', function(event) {
        if (event.target === qrModal) {
            closeDonationModal();
        }
        if (event.target === incomingCallModal) {
            // Don't close on background click for incoming call
        }
    });
    
    // Menu functionality
    if (menuBtn && menuContent) {
        menuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            menuContent.style.display = menuContent.style.display === 'block' ? 'none' : 'block';
        });
        
        // Close menu when clicking elsewhere
        document.addEventListener('click', function() {
            menuContent.style.display = 'none';
        });
        
        // Prevent menu from closing when clicking inside it
        menuContent.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
    
    // Initialize WebSocket connection
    connectWebSocket();
    
    // Initialize with online status
    updateConnectionStatus(true);
    
    // Focus on username input
    usernameInput.focus();
}

// Show donation modal
function showDonationModal() {
    qrModal.style.display = 'block';
}

// Close donation modal
function closeDonationModal() {
    qrModal.style.display = 'none';
}

// Connect to WebSocket server
function connectWebSocket() {
    try {
        // Use secure WebSocket for HTTPS, regular for HTTP
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = window.location.port ? `:${window.location.port}` : '';
        
        // For local development vs production
        const wsUrl = host === 'localhost' 
            ? `${protocol}//localhost:3000` 
            : `wss://popchat-eqgk.onrender.com`;
        
        console.log('Connecting to WebSocket at:', wsUrl);
        
        ws = new WebSocket(wsUrl);
        
        ws.onopen = function() {
            console.log('✅ Connected to server');
            reconnectAttempts = 0;
            updateConnectionStatus(true);
            
            // Update active users count
            updateActiveUsers();
            
            // If we have a username set, send it to the server
            if (currentUser) {
                sendWebSocketMessage('set_username', { username: currentUser });
            }
        };
        
        ws.onclose = function() {
            console.log('❌ Disconnected from server');
            updateConnectionStatus(false);
            
            // Try to reconnect with exponential backoff
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                const delay = Math.pow(2, reconnectAttempts) * 1000;
                reconnectAttempts++;
                console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
                
                setTimeout(connectWebSocket, delay);
            }
        };
        
        ws.onerror = function(error) {
            console.error('WebSocket error:', error);
            updateConnectionStatus(false);
        };
        
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };
    } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        updateConnectionStatus(false);
    }
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
    console.log('Received message:', data);
    
    switch (data.type) {
        case 'welcome':
            console.log('Server:', data.message);
            break;
            
        case 'active_users':
            updateActiveUsersCount(data.count);
            break;
            
        case 'match_found':
            handleMatchFound(data.partner);
            break;
            
        case 'message':
            handleIncomingMessage(data);
            break;
            
        case 'user_left':
            handleUserLeft(data.message);
            break;
            
        case 'error':
            handleError(data.message);
            break;
            
        case 'ping':
            // Respond to ping
            sendWebSocketMessage('pong');
            break;
            
        case 'typing_start':
            handleTypingStart();
            break;
            
        case 'typing_stop':
            handleTypingStop();
            break;
            
        case 'call_request':
            handleIncomingCall(data);
            break;
            
        case 'call_accepted':
            handleCallAccepted();
            break;
            
        case 'call_rejected':
            handleCallRejected(data.reason);
            break;
            
        case 'call_end':
            handleCallEnded(data.reason);
            break;
            
        case 'call_mute':
            handleCallMuteUpdate(data.muted);
            break;
            
        default:
            console.log('Unknown message type:', data.type, data);
            if (data.text) {
                addMessage('System', data.text, 'system');
            }
    }
}

// Update active users count
function updateActiveUsersCount(count) {
    if (activeCountElement) {
        activeCountElement.textContent = `${count}+ Active Now`;
    }
}

// Handle match found
function handleMatchFound(partnerData) {
    clearInterval(progressInterval);
    if (progressBar) {
        progressBar.style.width = '100%';
    }
    
    partner = partnerData.username;
    isConnected = true;
    
    // Show chat page
    showPage('chat');
    partnerName.textContent = partner;
    
    // Add welcome message
    addMessage('System', `You are now connected with ${partner}. Say hello!`, 'system');
}

// Handle incoming message
function handleIncomingMessage(data) {
    const messageData = {
        sender: data.sender,
        text: data.text,
        type: 'received',
        timestamp: new Date(data.timestamp),
        id: data.id || Date.now()
    };
    
    addMessage(messageData.sender, messageData.text, messageData.type, null, messageData.id);
    chatHistory.push(messageData);
    
    // Hide typing indicator when message is received
    handleTypingStop();
}

// Handle user left
function handleUserLeft(message) {
    isConnected = false;
    leftMessage.textContent = message || "Your partner has left the conversation.";
    showPage('disconnected');
    
    // End call if active
    if (callActive) {
        endCall();
    }
}

// Handle error
function handleError(message) {
    console.error('Server error:', message);
    addMessage('System', `Error: ${message}`, 'system', true);
}

// Handle typing start from partner
function handleTypingStart() {
    if (!partnerTyping) {
        partnerTyping = true;
        typingIndicator.style.display = 'block';
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Handle typing stop from partner
function handleTypingStop() {
    if (partnerTyping) {
        partnerTyping = false;
        typingIndicator.style.display = 'none';
    }
}

// Send WebSocket message
function sendWebSocketMessage(type, data = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify({
                type,
                ...data,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Error sending message:', error);
        }
    } else {
        console.warn('WebSocket is not connected');
        updateConnectionStatus(false);
    }
}

// Monitor internet connection
function monitorConnection() {
    window.addEventListener('online', function() {
        console.log('Internet connection restored');
        updateConnectionStatus(true);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            connectWebSocket();
        }
    });
    
    window.addEventListener('offline', function() {
        console.log('Internet connection lost');
        updateConnectionStatus(false);
    });
}

// Update connection status UI
function updateConnectionStatus(online) {
    if (online) {
        connectionStatus.textContent = 'Connection restored';
        connectionStatus.className = 'connection-status online';
        setTimeout(() => {
            connectionStatus.style.display = 'none';
        }, 3000);
    } else {
        connectionStatus.textContent = 'No internet connection';
        connectionStatus.className = 'connection-status offline';
    }
}

// Update active users count
function updateActiveUsers() {
    sendWebSocketMessage('get_active_users');
}

// Handle message input for typing indicator
function handleMessageInput() {
    autoResize();
    
    if (isConnected) {
        // Send typing start if not already typing
        sendWebSocketMessage('typing_start');
        
        // Clear existing timer
        if (typingTimer) {
            clearTimeout(typingTimer);
        }
        
        // Set timer to send typing stop after 1 second of inactivity
        typingTimer = setTimeout(() => {
            sendWebSocketMessage('typing_stop');
        }, 1000);
    }
}

// Handle keydown events in the message input
function handleKeyDown(e) {
    if (e.key === 'Enter') {
        if (!e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }
}

// Auto-resize textarea based on content
function autoResize() {
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
}

// Handle swipe to match
function handleSwipe() {
    const username = usernameInput.value.trim();
    if (!username) {
        showError('Please enter a username');
        return;
    }
    
    if (username.length < 3 || username.length > 20) {
        showError('Username must be between 3 and 20 characters');
        return;
    }
    
    currentUser = username;
    localStorage.setItem('chatUsername', username);
    dashboardUsername.textContent = username;
    
    // Send username to server
    sendWebSocketMessage('set_username', { username });
    
    // Show dashboard page
    showPage('dashboard');
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'system-message error';
    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    
    const container = document.querySelector('.container');
    container.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

// Start chat - go to waiting page
function startChat() {
    usernameDisplay.textContent = currentUser;
    showPage('waiting');
    
    // Start progress bar animation
    let progress = 0;
    progressInterval = setInterval(() => {
        progress += 0.5;
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (progress >= 100) {
            clearInterval(progressInterval);
        }
    }, 100);
    
    // Request to find a partner
    sendWebSocketMessage('find_partner');
}

// Send a message
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !isConnected) return;
    
    if (message.length > 500) {
        showError('Message is too long (max 500 characters)');
        return;
    }
    
    // Add message to chat
    const messageData = {
        sender: currentUser,
        text: message,
        type: 'sent',
        timestamp: new Date(),
        replyTo: replyingTo,
        id: Date.now()
    };
    
    addMessage(messageData.sender, messageData.text, messageData.type, messageData.replyTo, messageData.id);
    chatHistory.push(messageData);
    
    // Send message to server
    sendWebSocketMessage('send_message', {
        text: message,
        replyTo: replyingTo ? replyingTo.id : null
    });
    
    // Send typing stop
    sendWebSocketMessage('typing_stop');
    
    // Reset textarea height and clear input
    messageInput.style.height = 'auto';
    messageInput.value = '';
    
    // Cancel reply if active
    if (replyingTo) {
        cancelReply();
    }
    
    // Clear typing timer
    if (typingTimer) {
        clearTimeout(typingTimer);
    }
}

// Leave the chat
function leaveChat() {
    isConnected = false;
    sendWebSocketMessage('leave_chat');
    leftMessage.textContent = "You've left the conversation.";
    showPage('disconnected');
    
    // End call if active
    if (callActive) {
        endCall();
    }
}

// Rematch with a new partner
function rematch() {
    showPage('waiting');
    
    // Clear chat messages and history
    chatMessages.innerHTML = '';
    chatHistory = [];
    messageElements = {};
    messageCounter = 0;
    
    // Start progress bar animation
    let progress = 0;
    progressInterval = setInterval(() => {
        progress += 0.5;
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (progress >= 100) {
            clearInterval(progressInterval);
        }
    }, 100);
    
    // Request to find a new partner
    sendWebSocketMessage('find_partner');
}

// Go back to home page
function goHome() {
    isConnected = false;
    if (waitingTimer) clearTimeout(waitingTimer);
    if (progressInterval) clearInterval(progressInterval);
    showPage('entrance');
    
    // End call if active
    if (callActive) {
        endCall();
    }
}

// Cancel reply
function cancelReply() {
    replyingTo = null;
    if (replyIndicator) {
        replyIndicator.style.display = 'none';
    }
}

// Highlight a message that was replied to
function highlightRepliedMessage(messageId) {
    const messageElement = messageElements[messageId];
    if (messageElement) {
        messageElement.classList.add('highlight');
        
        // Scroll to the message
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
            messageElement.classList.remove('highlight');
        }, 3000);
    }
}

// Add a message to the chat
function addMessage(sender, text, type, replyTo = null, messageId = null, isError = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', type);
    if (isError) {
        messageElement.classList.add('error');
    }
    
    if (messageId !== null) {
        messageElement.dataset.messageId = messageId;
        messageElements[messageId] = messageElement;
    }
    
    if (type === 'system') {
        messageElement.innerHTML = `<i class="fas fa-info-circle"></i> ${text}`;
        if (isError) {
            messageElement.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${text}`;
        }
    } else {
        let messageHTML = '';
        
        if (type === 'received') {
            messageHTML += `<div class="message-username">${sender}</div>`;
        }
        
        // Add reply reference if this is a reply
        if (replyTo) {
            messageHTML += `<div class="reply-reference">Replying to: ${replyTo.sender}</div>`;
            
            // Add click event to highlight the original message
            messageElement.addEventListener('click', function() {
                highlightRepliedMessage(replyTo.id);
            });
        }
        
        // Preserve line breaks in messages
        const formattedText = text.replace(/\n/g, '<br>');
        messageHTML += formattedText;
        
        // Add timestamp
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageHTML += `<div class="message-time">${timeString}</div>`;
        
        messageElement.innerHTML = messageHTML;
        
        // Add long press event for reply (only for received messages)
        if (type === 'received') {
            let pressTimer;
            
            const startPress = () => {
                pressTimer = setTimeout(() => {
                    replyingTo = { 
                        sender: sender, 
                        text: text,
                        id: messageId
                    };
                    if (replyUsername) replyUsername.textContent = `${sender}`;
                    if (replyText) replyText.textContent = text.length > 30 ? text.substring(0, 30) + '...' : text;
                    if (replyIndicator) replyIndicator.style.display = 'flex';
                }, 500);
            };
            
            const endPress = () => {
                clearTimeout(pressTimer);
            };
            
            messageElement.addEventListener('mousedown', startPress);
            messageElement.addEventListener('mouseup', endPress);
            messageElement.addEventListener('mouseleave', endPress);
            messageElement.addEventListener('touchstart', startPress);
            messageElement.addEventListener('touchend', endPress);
            messageElement.addEventListener('touchcancel', endPress);
        }
    }
    
    if (chatMessages) {
        // Insert before typing indicator
        chatMessages.insertBefore(messageElement, typingIndicator);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Show specific page
function showPage(pageName) {
    // Hide all pages
    for (const page in pages) {
        if (pages[page]) {
            pages[page].classList.remove('active');
        }
    }
    
    // Show requested page
    if (pages[pageName]) {
        pages[pageName].classList.add('active');
    }
    
    // Focus on input if we're on the chat page
    if (pageName === 'chat') {
        setTimeout(() => {
            if (messageInput) messageInput.focus();
        }, 100);
    }
    
    // Reset progress bar if leaving waiting page
    if (pageName !== 'waiting' && progressBar) {
        clearInterval(progressInterval);
        progressBar.style.width = '0%';
    }
    
    // Hide typing indicator when changing pages
    if (pageName !== 'chat') {
        handleTypingStop();
    }
    
    // Hide menu when changing pages
    if (menuContent) {
        menuContent.style.display = 'none';
    }
    
    // End call if leaving call page by other means
    if (pageName !== 'call' && callActive) {
        endCall();
    }
}

// Voice Call Functions
function initiateVoiceCall() {
    if (!isConnected) {
        showError('You need to be connected to a partner to start a call');
        return;
    }
    
    // Hide menu
    menuContent.style.display = 'none';
    
    // Set up call page
    callPartnerName.textContent = partner;
    callStatus.textContent = 'Calling...';
    callTimer.textContent = '00:00';
    
    // Show call page
    showPage('call');
    callActive = true;
    
    // Send call request to partner via WebSocket
    sendWebSocketMessage('call_request', {
        type: 'voice_call'
    });
    
    // Update menu notification
    updateMenuCallNotification(true);
    
    // Simulate call progress
    setTimeout(() => {
        if (callActive) {
            callStatus.textContent = 'Ringing...';
            callStatus.classList.add('ringing');
        }
    }, 2000);
}

function backToChat() {
    if (callActive) {
        showPage('chat');
        // Keep call active in background
    }
}

function hangUpCall() {
    // Send hangup signal to partner
    sendWebSocketMessage('call_end', {
        reason: 'user_hangup'
    });
    
    endCall();
    
    // Show appropriate page based on current state
    if (isConnected) {
        showPage('chat');
    } else {
        showPage('entrance');
    }
}

function toggleMute() {
    isMuted = !isMuted;
    
    if (isMuted) {
        muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i><span>Unmute</span>';
        muteBtn.classList.add('active');
        // Send mute signal to server
        sendWebSocketMessage('call_mute', { muted: true });
    } else {
        muteBtn.innerHTML = '<i class="fas fa-microphone"></i><span>Mute</span>';
        muteBtn.classList.remove('active');
        // Send unmute signal to server
        sendWebSocketMessage('call_mute', { muted: false });
    }
}

function endCall() {
    callActive = false;
    isMuted = false;
    
    // Reset mute button
    muteBtn.innerHTML = '<i class="fas fa-microphone"></i><span>Mute</span>';
    muteBtn.classList.remove('active');
    
    // Clear timer
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    
    // Reset call status
    callStatus.textContent = 'Call Ended';
    callStatus.classList.remove('ringing', 'connected');
    callStatus.classList.add('ended');
    
    // Update menu notification
    updateMenuCallNotification(false);
}

function startCallTimer() {
    callStartTime = Date.now();
    callTimerInterval = setInterval(updateCallTimer, 1000);
}

function updateCallTimer() {
    if (!callActive) return;
    
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    callTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Incoming Call Functions
function showIncomingCallNotification(callerName) {
    // Stop any previous call sounds
    stopCallSound();
    
    // Update modal content
    callerName.textContent = `${callerName} is calling you`;
    
    // Show notification
    incomingCallModal.style.display = 'block';
    
    // Start ringing sound and vibration
    startCallSound();
    vibratePhone();
    
    isRinging = true;
    
    // Update menu notification
    updateMenuCallNotification(true);
    
    // Auto-reject after 30 seconds if not answered
    callNotificationTimer = setTimeout(() => {
        if (isRinging) {
            rejectIncomingCall();
        }
    }, 30000);
}

function acceptIncomingCall() {
    if (!incomingCallData) return;
    
    stopCallNotification();
    sendWebSocketMessage('call_accepted');
    
    // Set up call page
    callPartnerName.textContent = partner;
    callStatus.textContent = 'Connected';
    callStatus.classList.remove('ringing');
    callStatus.classList.add('connected');
    
    // Show call page
    showPage('call');
    callActive = true;
    startCallTimer();
}

function rejectIncomingCall() {
    stopCallNotification();
    sendWebSocketMessage('call_rejected', { reason: 'declined' });
    showPage('chat');
}

function stopCallNotification() {
    isRinging = false;
    incomingCallModal.style.display = 'none';
    stopCallSound();
    stopVibration();
    
    if (callNotificationTimer) {
        clearTimeout(callNotificationTimer);
        callNotificationTimer = null;
    }
    
    // Update menu notification
    updateMenuCallNotification(false);
}

function startCallSound() {
    // Create ringing sound (simple beep pattern)
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        
        // Beep pattern: beep-beep-beep pause
        let beepCount = 0;
        const beepInterval = setInterval(() => {
            if (!isRinging) {
                clearInterval(beepInterval);
                oscillator.stop();
                return;
            }
            
            if (beepCount % 4 === 3) {
                gainNode.gain.value = 0;
            } else {
                gainNode.gain.value = 0.1;
            }
            
            beepCount++;
        }, 500);
        
        callSound = {
            context: audioContext,
            oscillator: oscillator,
            interval: beepInterval
        };
    } catch (error) {
        console.log('Audio not supported:', error);
    }
}

function stopCallSound() {
    if (callSound) {
        if (callSound.interval) clearInterval(callSound.interval);
        if (callSound.oscillator) callSound.oscillator.stop();
        if (callSound.context) callSound.context.close();
        callSound = null;
    }
}

function vibratePhone() {
    // Vibrate pattern: vibrate for 500ms, pause for 500ms
    if (navigator.vibrate) {
        const vibrateInterval = setInterval(() => {
            if (!isRinging) {
                clearInterval(vibrateInterval);
                navigator.vibrate(0);
                return;
            }
            navigator.vibrate(500);
        }, 1000);
    }
}

function stopVibration() {
    if (navigator.vibrate) {
        navigator.vibrate(0);
    }
}

// Call Event Handlers
function handleIncomingCall(data) {
    incomingCallData = data;
    showIncomingCallNotification(partner);
}

function handleCallAccepted() {
    if (callActive) {
        callStatus.textContent = 'Connected';
        callStatus.classList.remove('ringing');
        callStatus.classList.add('connected');
        startCallTimer();
    }
}

function handleCallRejected(reason) {
    if (callActive) {
        callStatus.textContent = 'Call Rejected';
        endCall();
        setTimeout(() => {
            showPage('chat');
        }, 2000);
    }
}

function handleCallEnded(reason) {
    if (callActive) {
        callStatus.textContent = 'Call Ended - ' + (reason === 'user_hangup' ? 'Partner hung up' : 'Call ended');
        endCall();
        
        // Show notification in chat
        addMessage('System', `Voice call ended: ${reason === 'user_hangup' ? 'Partner ended the call' : 'Call completed'}`, 'system');
        
        setTimeout(() => {
            showPage('chat');
        }, 2000);
    }
}

function handleCallMuteUpdate(muted) {
    // Update UI to show partner's mute status
    // This would show a mute indicator near partner's name in a real app
    console.log(`Partner is ${muted ? 'muted' : 'unmuted'}`);
}

function updateMenuCallNotification(hasCall) {
    const menuBtn = document.querySelector('.menu-btn');
    if (menuBtn) {
        if (hasCall) {
            menuBtn.innerHTML = '<i class="fas fa-phone" style="color: #4CAF50; animation: pulse-glow 1s infinite;"></i>';
        } else {
            menuBtn.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Handle page refresh/closing
window.addEventListener('beforeunload', () => {
    if (isConnected) {
        sendWebSocketMessage('leave_chat');
    }
    if (callActive) {
        sendWebSocketMessage('call_end', { reason: 'user_left' });
    }
});