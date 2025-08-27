// ====== PAGE HANDLING ======
const pages = {
    entrance: document.getElementById("entrance-page"),
    dashboard: document.getElementById("dashboard-page"),
    waiting: document.getElementById("waiting-page"),
    chat: document.getElementById("chat-page"),
    disconnected: document.getElementById("disconnected-page")
};

function showPage(pageId) {
    Object.values(pages).forEach(page => page.classList.remove("active"));
    pages[pageId].classList.add("active");
}

// ====== ELEMENTS ======
const swipeBtn = document.getElementById("swipe-btn");
const usernameInput = document.getElementById("username-input");
const dashboardUsername = document.getElementById("dashboard-username");
const startChatBtn = document.getElementById("start-chat-btn");
const usernameDisplay = document.getElementById("username-display");
const partnerName = document.getElementById("partner-name");
const sendBtn = document.getElementById("send-btn");
const messageInput = document.getElementById("message-input");
const chatMessages = document.getElementById("chat-messages");
const leaveBtn = document.getElementById("leave-btn");
const rematchBtn = document.getElementById("rematch-btn");
const homeBtn = document.getElementById("home-btn");
const leftMessage = document.getElementById("left-message");

// Connection status banner
let connectionStatus = document.createElement("div");
connectionStatus.className = "connection-status";
document.body.appendChild(connectionStatus);

// ====== STATE ======
let currentUser = "";
let isConnected = false;
let socket = null;

// ====== PAGE FLOW ======
swipeBtn.addEventListener("click", () => {
    const username = usernameInput.value.trim();
    if (username.length === 0) {
        alert("Please enter a username");
        return;
    }
    currentUser = username;
    dashboardUsername.textContent = username;
    showPage("dashboard");
});

startChatBtn.addEventListener("click", () => {
    usernameDisplay.textContent = currentUser;
    showPage("waiting");

    // Connect WebSocket
    socket = new WebSocket("wss://your-backend-url"); // 🔗 palitan ng actual backend URL

    socket.onopen = () => {
        isConnected = true;
        socket.send(JSON.stringify({ type: "join", username: currentUser }));
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "match") {
            partnerName.textContent = data.partner;
            showPage("chat");
        } else if (data.type === "message") {
            addMessage(data.sender, data.text);
        } else if (data.type === "left") {
            leftMessage.textContent = "Stranger has left the chat.";
            showPage("disconnected");
        }
    };

    socket.onclose = () => {
        if (isConnected) {
            leftMessage.textContent = "Connection lost.";
            showPage("disconnected");
        }
        isConnected = false;
    };
});

sendBtn.addEventListener("click", () => {
    const message = messageInput.value.trim();
    if (message.length === 0) return;

    addMessage(currentUser, message);
    socket.send(JSON.stringify({ type: "message", sender: currentUser, text: message }));
    messageInput.value = "";
});

leaveBtn.addEventListener("click", () => {
    if (socket) socket.close();
    isConnected = false;
    leftMessage.textContent = "You have left the chat.";
    showPage("disconnected");
});

rematchBtn.addEventListener("click", () => {
    usernameDisplay.textContent = currentUser;
    showPage("waiting");

    socket = new WebSocket("wss://your-backend-url");
    socket.onopen = () => {
        isConnected = true;
        socket.send(JSON.stringify({ type: "join", username: currentUser }));
    };
});

homeBtn.addEventListener("click", () => {
    if (socket) socket.close();
    showPage("entrance");
    currentUser = "";
    usernameInput.value = "";
});

// ====== CHAT UI ======
function addMessage(sender, text) {
    const msg = document.createElement("div");
    msg.className = "chat-message";
    msg.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ====== CONNECTION HANDLER ======
function updateConnectionStatus(online) {
    if (online) {
        connectionStatus.textContent = '🟢 You are Online';
        connectionStatus.classList.remove("offline");
        connectionStatus.classList.add("online");

        // Enable inputs and buttons
        document.querySelectorAll("button, input, textarea").forEach(el => {
            el.disabled = false;
            el.style.opacity = "1";
            el.style.cursor = "pointer";
        });

        // Hide after 3s
        setTimeout(() => {
            connectionStatus.style.display = 'none';
        }, 3000);

    } else {
        connectionStatus.textContent = '🔴 No Internet Connection';
        connectionStatus.classList.remove("online");
        connectionStatus.classList.add("offline");
        connectionStatus.style.display = 'block';

        // Disable inputs and buttons
        document.querySelectorAll("button, input, textarea").forEach(el => {
            el.disabled = true;
            el.style.opacity = "0.5";
            el.style.cursor = "not-allowed";
        });

        // If nasa chat tapos nawalan ng net
        if (pages.chat.classList.contains("active")) {
            if (socket) socket.close();
            isConnected = false;
            leftMessage.textContent = "You are offline. Conversation ended.";
            showPage("disconnected");
        }
    }
}

// ====== LISTENERS ======
window.addEventListener("online", () => updateConnectionStatus(true));
window.addEventListener("offline", () => updateConnectionStatus(false));
updateConnectionStatus(navigator.onLine);

// ====== STYLE INJECTION ======
const style = document.createElement("style");
style.textContent = `
.connection-status {
    position: fixed;
    top: 0; left: 0; right: 0;
    padding: 12px;
    text-align: center;
    font-weight: bold;
    font-size: 14px;
    z-index: 2000;
    display: none;
    transition: all 0.3s ease-in-out;
}
.connection-status.online {
    background-color: #4CAF50;
    color: #000;
    display: block;
}
.connection-status.offline {
    background-color: #ff4444;
    color: #fff;
    display: block;
}
`;
document.head.appendChild(style);
