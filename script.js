// DOM Elements
const pages = {
    entrance: document.getElementById('entrance-page'),
    dashboard: document.getElementById('dashboard-page'),
    waiting: document.getElementById('waiting-page'),
    chat: document.getElementById('chat-page'),
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
const exportChatBtn = document.getElementById('export-chat-btn');
const replyIndicator = document.getElementById('reply-indicator');
const replyUsername = document.getElementById('reply-username');
const replyText = document.getElementById('reply-text');
const closeReply = document.getElementById('close-reply');
const connectionStatus = document.getElementById('connection-status');
const progressBar = document.getElementById('progress-bar');
const activeCountElement = document.getElementById('entrance-active-count');
const qrModal = document.getElementById('qr-modal');
const closeModal = document.querySelector('.close');

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
    exportChatBtn.addEventListener('click', exportChatHistory);
    closeReply.addEventListener('click', cancelReply);
    messageInput.addEventListener('input', autoResize);
    messageInput.addEventListener('keydown', handleKeyDown);
    
    // Modal event listeners
    closeModal.addEventListener('click', closeDonationModal);
    window.addEventListener('click', function(event) {
        if (event.target === qrModal) {
            closeDonationModal();
        }
    });
    
    // Initialize WebSocket connection
    connectWebSocket();
    
    // Initialize with online status
    updateConnectionStatus(true);
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
    // Use your Render backend URL directly
    const wsUrl = 'wss://popchat-eqgk.onrender.com';
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = function() {
        console.log('Connected to POPCHAT server');
        updateConnectionStatus(true);
        updateActiveUsers(); // update active users count
    };
    
    ws.onclose = function() {
        console.log('Disconnected from server');
        updateConnectionStatus(false);
        
        // Try to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
    switch (data.type) {
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
            handleUserLeft();
            break;
            
        case 'error':
            handleError(data.message);
            break;
    }
}

// Update active users count
function updateActiveUsersCount(count) {
    activeCountElement.textContent = `${count}+ Active Now`;
}

// Handle match found
function handleMatchFound(partnerData) {
    clearInterval(progressInterval);
    progressBar.style.width = '100%';
    
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
        id: data.id
    };
    
    addMessage(messageData.sender, messageData.text, messageData.type, null, messageData.id);
    chatHistory.push(messageData);
}

// Handle user left
function handleUserLeft() {
    isConnected = false;
    leftMessage.textContent = "Your partner has left the conversation.";
    showPage('disconnected');
}

// Handle error
function handleError(message) {
    console.error('Server error:', message);
    alert(`Error: ${message}`);
}

// Send WebSocket message
function sendWebSocketMessage(type, data = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type,
            ...data
        }));
    }
}

// Monitor internet connection
function monitorConnection() {
    window.addEventListener('online', function() {
        updateConnectionStatus(true);
    });
    
    window.addEventListener('offline', function() {
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

// Handle keydown events in the message input
function handleKeyDown(e) {
    if (e.key === 'Enter') {
        if (!e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
        // If shift is pressed, allow default behavior (new line)
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
        alert('Please enter a username');
        return;
    }
    
    if (username.length < 3 || username.length > 20) {
        alert('Username must be between 3 and 20 characters');
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

// Start chat - go to waiting page
function startChat() {
    usernameDisplay.textContent = currentUser;
    showPage('waiting');
    
    // Start progress bar animation
    let progress = 0;
    progressInterval = setInterval(() => {
        progress += 0.5;
        progressBar.style.width = `${progress}%`;
        
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
        alert('Message is too long (max 500 characters)');
        return;
    }
    
    // Add message to chat
    const messageData = {
        sender: currentUser,
        text: message,
        type: 'sent',
        timestamp: new Date(),
        replyTo: replyingTo,
        id: messageCounter++
    };
    
    addMessage(messageData.sender, messageData.text, messageData.type, messageData.replyTo, messageData.id);
    chatHistory.push(messageData);
    
    // Send message to server
    sendWebSocketMessage('send_message', {
        text: message,
        replyTo: replyingTo ? replyingTo.id : null
    });
    
    // Reset textarea height and clear input
    messageInput.style.height = 'auto';
    messageInput.value = '';
    
    // Cancel reply if active
    if (replyingTo) {
        cancelReply();
    }
}

// Leave the chat
function leaveChat() {
    isConnected = false;
    sendWebSocketMessage('leave_chat');
    leftMessage.textContent = "You've left the conversation.";
    showPage('disconnected');
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
        progressBar.style.width = `${progress}%`;
        
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
}

// Export chat history
function exportChatHistory() {
    let exportData = `POPCHAT Conversation History\n`;
    exportData += `Date: ${new Date().toLocaleString()}\n`;
    exportData += `Participants: ${currentUser} and ${partner}\n`;
    exportData += `Messages:\n\n`;
    
    chatHistory.forEach(msg => {
        const time = msg.timestamp.toLocaleTimeString();
        exportData += `[${time}] ${msg.sender}: ${msg.text}\n`;
    });
    
    const blob = new Blob([exportData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `popchat_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Cancel reply
function cancelReply() {
    replyingTo = null;
    replyIndicator.style.display = 'none';
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
function addMessage(sender, text, type, replyTo = null, messageId = null) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', type);
    
    if (messageId !== null) {
        messageElement.dataset.messageId = messageId;
        messageElements[messageId] = messageElement;
    }
    
    if (type === 'system') {
        messageElement.textContent = text;
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
            messageElement.addEventListener('mousedown', function() {
                pressTimer = window.setTimeout(function() {
                    replyingTo = { 
                        sender: sender, 
                        text: text,
                        id: messageId
                    };
                    replyUsername.textContent = `${sender}`;
                    replyText.textContent = text.length > 30 ? text.substring(0, 30) + '...' : text;
                    replyIndicator.style.display = 'flex';
                }, 500);
            });
            
            messageElement.addEventListener('mouseup', function() {
                clearTimeout(pressTimer);
            });
            
            messageElement.addEventListener('touchstart', function() {
                pressTimer = window.setTimeout(function() {
                    replyingTo = { 
                        sender: sender, 
                        text: text,
                        id: messageId
                    };
                    replyUsername.textContent = `${sender}`;
                    replyText.textContent = text.length > 30 ? text.substring(0, 30) + '...' : text;
                    replyIndicator.style.display = 'flex';
                }, 500);
            });
            
            messageElement.addEventListener('touchend', function() {
                clearTimeout(pressTimer);
            });
        }
    }
    
    chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show specific page
function showPage(pageName) {
    // Hide all pages
    for (const page in pages) {
        pages[page].classList.remove('active');
    }
    
    // Show requested page
    pages[pageName].classList.add('active');
    
    // Focus on input if we're on the chat page
    if (pageName === 'chat') {
        setTimeout(() => {
            messageInput.focus();
        }, 100);
    }
    
    // Reset progress bar if leaving waiting page
    if (pageName !== 'waiting') {
        clearInterval(progressInterval);
        progressBar.style.width = '0%';
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);