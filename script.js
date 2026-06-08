document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const rainContainer = document.getElementById('rainContainer');
    const messagesContainer = document.getElementById('messagesContainer');
    const chatForm = document.getElementById('chatForm');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const typingIndicator = document.getElementById('typingIndicator');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const msgCountSpan = document.getElementById('msgCount');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const welcomeTime = document.getElementById('welcomeTime');
    const suggestionsWrapper = document.getElementById('suggestionsWrapper');
    
    // About Modal Elements
    const infoIcon = document.querySelector('.info-icon');
    const infoModal = document.getElementById('infoModal');
    const closeModal = document.getElementById('closeModal');

    // Conversation State
    let chatHistory = [];
    let messageCount = 0;

    // 1. Generate Rain Particles
    function initRain() {
        if (!rainContainer) return;
        const dropCount = 60;
        for (let i = 0; i < dropCount; i++) {
            const drop = document.createElement('div');
            drop.classList.add('raindrop');
            drop.style.left = `${Math.random() * 100}vw`;
            drop.style.animationDuration = `${Math.random() * 1.5 + 0.8}s`;
            drop.style.animationDelay = `${Math.random() * 2}s`;
            rainContainer.appendChild(drop);
        }
    }
    initRain();

    // 2. Set Current Time for Welcome Message
    function getFormattedTime() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        return `${hours}:${minutes} ${ampm}`;
    }
    if (welcomeTime) {
        welcomeTime.textContent = getFormattedTime();
    }

    // 3. Health Check Backend Connection
    async function checkBackendHealth() {
        try {
            const response = await fetch('/api/health');
            if (response.ok) {
                statusDot.className = 'status-dot online pulsing';
                statusText.textContent = 'Online & Active';
            } else {
                throw new Error('Unhealthy');
            }
        } catch (error) {
            console.error('Backend health check failed:', error);
            statusDot.className = 'status-dot pulsing'; // stays red
            statusText.textContent = 'Backend Offline';
        }
    }
    checkBackendHealth();
    // Re-check health every 30 seconds
    setInterval(checkBackendHealth, 30000);

    // 4. Custom Markdown Parser (Splits code blocks and formatting safely)
    function parseMarkdown(text) {
        // Split text by code blocks ```...```
        const parts = text.split(/(```[\s\S]*?```)/g);
        
        return parts.map(part => {
            if (part.startsWith('```')) {
                // Code block formatting
                const match = part.match(/```(\w*)\n([\s\S]*?)```/);
                if (match) {
                    const lang = match[1] || 'code';
                    const code = match[2].trim()
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;");
                    return `<div class="code-container">
                                <div class="code-header">
                                    <span>${lang}</span>
                                    <button class="copy-btn" onclick="copyCode(this)">
                                        <i class="fa-regular fa-copy"></i> Copy
                                    </button>
                                </div>
                                <pre><code>${code}</code></pre>
                            </div>`;
                }
                return part;
            } else {
                // Regular paragraph text formatting
                let escaped = part
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
                
                // Bold replacement: **text** -> <strong>text</strong>
                escaped = escaped.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
                
                // Inline code replacement: `code` -> <code>code</code>
                escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
                
                // Unordered lists replacement: lines starting with "- " or "* "
                const lines = escaped.split('\n');
                let inList = false;
                const processedLines = [];
                
                for (let line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                        if (!inList) {
                            processedLines.push('<ul>');
                            inList = true;
                        }
                        processedLines.push(`<li>${trimmed.substring(2)}</li>`);
                    } else if (trimmed === '' && inList) {
                        processedLines.push('</ul>');
                        inList = false;
                    } else {
                        if (inList) {
                            processedLines.push('</ul>');
                            inList = false;
                        }
                        processedLines.push(line);
                    }
                }
                if (inList) {
                    processedLines.push('</ul>');
                }
                
                return processedLines.join('\n').replace(/\n/g, '<br>');
            }
        }).join('');
    }

    // Define copyCode globally so it is accessible from the inline onclick attribute
    window.copyCode = function(button) {
        const pre = button.closest('.code-container').querySelector('pre');
        const code = pre.querySelector('code').innerText;
        
        navigator.clipboard.writeText(code).then(() => {
            button.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> Copied!`;
            button.style.pointerEvents = 'none';
            
            setTimeout(() => {
                button.innerHTML = `<i class="fa-regular fa-copy"></i> Copy`;
                button.style.pointerEvents = 'auto';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy code: ', err);
        });
    };

    // 5. Append message bubble to DOM
    function appendMessage(role, text) {
        const isUser = role === 'user';
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isUser ? 'user-message-wrapper' : 'model-message-wrapper'} animate-in`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = isUser ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        const msgTextDiv = document.createElement('div');
        msgTextDiv.className = 'message-text';
        msgTextDiv.innerHTML = isUser ? text.replace(/\n/g, '<br>') : parseMarkdown(text);
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = getFormattedTime();
        
        bubble.appendChild(msgTextDiv);
        bubble.appendChild(timeDiv);
        wrapper.appendChild(avatar);
        wrapper.appendChild(bubble);
        
        messagesContainer.appendChild(wrapper);
        
        // Auto scroll to bottom
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });

        // Update stats
        if (isUser) {
            messageCount++;
            msgCountSpan.textContent = messageCount;
        }
    }

    // 6. Send message to backend
    async function sendMessage(message) {
        if (!message.trim()) return;

        // Add user message to UI and history
        appendMessage('user', message);
        
        // Clear input and show typing state
        userInput.value = '';
        userInput.disabled = true;
        sendBtn.disabled = true;
        typingIndicator.classList.remove('hidden');
        
        // Hide suggestions once chat starts to clean up interface
        if (suggestionsWrapper) {
            suggestionsWrapper.style.opacity = '0';
            setTimeout(() => {
                suggestionsWrapper.classList.add('hidden');
            }, 300);
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    history: chatHistory
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                // Save context history in backend friendly format
                chatHistory.push({ role: 'user', text: message });
                chatHistory.push({ role: 'model', text: data.response });
                
                // Append bot response
                appendMessage('model', data.response);
            } else {
                const errorMsg = data.detail || 'An error occurred while fetching response.';
                appendMessage('model', `⚠️ **Error:** ${errorMsg}\n\nPlease check if your backend server is running and the Gemini API key is active.`);
            }
        } catch (error) {
            console.error('API call failed:', error);
            appendMessage('model', '⚠️ **Connection Error:** Could not reach the Rainbot server. Please verify the backend is running.');
        } finally {
            userInput.disabled = false;
            sendBtn.disabled = false;
            typingIndicator.classList.add('hidden');
            userInput.focus();
        }
    }

    // 7. Event Listeners
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = userInput.value;
        sendMessage(msg);
    });

    // Suggestion Pills
    document.querySelectorAll('.suggestion-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const prompt = pill.getAttribute('data-prompt');
            if (prompt) {
                sendMessage(prompt);
            }
        });
    });

    // Clear Chat
    clearChatBtn.addEventListener('click', () => {
        chatHistory = [];
        messageCount = 0;
        msgCountSpan.textContent = '0';
        
        // Clear all except the first welcome message
        const wrappers = Array.from(messagesContainer.querySelectorAll('.message-wrapper'));
        wrappers.forEach((wrapper, index) => {
            if (index > 0) {
                wrapper.remove();
            }
        });

        // Bring back suggestions if they were hidden
        if (suggestionsWrapper) {
            suggestionsWrapper.classList.remove('hidden');
            setTimeout(() => {
                suggestionsWrapper.style.opacity = '1';
            }, 50);
        }
        
        userInput.focus();
    });

    // Theme Toggle Ambience
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('ambient-mode');
        const isAmbient = document.body.classList.contains('ambient-mode');
        themeToggleBtn.innerHTML = isAmbient 
            ? '<i class="fa-solid fa-cloud-moon"></i> <span>Normal Ambience</span>'
            : '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Change Ambience</span>';
    });

    // Modal Events
    infoIcon.addEventListener('click', () => {
        infoModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => {
        infoModal.classList.add('hidden');
    });

    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            infoModal.classList.add('hidden');
        }
    });
});