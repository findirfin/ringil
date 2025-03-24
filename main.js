class ChatApp {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.modelSelector = document.getElementById('modelSelector');
        this.currentModel = this.modelSelector.value;
        this.menuItems = document.querySelectorAll('.menu-section a');
        this.chatHistory = document.getElementById('chatHistory');
        this.conversations = [];
        this.searchHistory = document.getElementById('searchHistory');
        this.newChatBtn = document.getElementById('newChatBtn');
        
        this.loadChatHistory();
        this.autoSaveTimeout = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.sendButton.addEventListener('click', () => this.handleUserInput());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleUserInput();
        });
        this.modelSelector.addEventListener('change', () => {
            this.currentModel = this.modelSelector.value;
            this.addSystemMessage(`Model switched to ${this.currentModel}`);
        });
        this.menuItems.forEach(item => {
            item.addEventListener('click', (e) => this.handleMenuItemClick(e));
        });
        
        // Remove settings button listener as it's been removed
        this.settingsButton = null;
        
        // Remove menu toggle related code
        this.menuToggle = null;

        this.searchHistory.addEventListener('input', () => this.filterHistory());
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
    }

    convertToMarkdown(conversation) {
        const lines = [];
        const title = conversation.title.trim() || 'Untitled Chat';
        lines.push(`# ${title}`);
        lines.push(`\nStarted: ${new Date(conversation.timestamp).toLocaleString()}`);
        lines.push(`Model: ${this.currentModel}`);
        lines.push(`\n## Conversation\n`);

        conversation.messages.forEach(msg => {
            if (msg.isSystem) {
                lines.push(`\n---\n_${msg.text}_\n---\n`);
            } else {
                const role = msg.isUser ? '**User**' : '**Assistant**';
                lines.push(`\n### ${role}\n${msg.text}\n`);
            }
        });

        return lines.join('\n');
    }

    async saveToMarkdown(conversation) {
        const markdown = this.convertToMarkdown(conversation);
        const filename = `chat-${conversation.id}.md`;
        
        try {
            // Save to IndexedDB
            await this.saveToIndexedDB(conversation.id, {
                filename,
                content: markdown,
                timestamp: new Date(),
                title: conversation.title
            });
        } catch (error) {
            console.error('Error saving markdown:', error);
        }
    }

    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('RingilChats', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('chats')) {
                    db.createObjectStore('chats', { keyPath: 'id' });
                }
            };
        });
    }

    async saveToIndexedDB(id, data) {
        const db = await this.initIndexedDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['chats'], 'readwrite');
            const store = transaction.objectStore('chats');
            const request = store.put({ id, ...data });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    renderMessage(text, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
        messageDiv.textContent = text;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    renderSystemMessage(text, timestamp) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';
        messageDiv.innerHTML = `
            ${text}
            <span class="timestamp">${timestamp.toLocaleTimeString()}</span>
        `;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    addMessage(text, isUser = false) {
        this.renderMessage(text, isUser);
        
        if (this.currentConversation) {
            // Create message object with timestamp
            const message = {
                text,
                isUser,
                timestamp: new Date().toISOString() // Store as ISO string for consistency
            };
            
            // Add to current conversation
            this.currentConversation.messages.push(message);
            
            // Update title if needed
            if (this.currentConversation.messages.length === 2) {
                this.currentConversation.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
            }
            
            // Update conversation in the conversations array
            const index = this.conversations.findIndex(c => c.id === this.currentConversation.id);
            if (index !== -1) {
                this.conversations[index] = this.currentConversation;
            }
            
            // Save everything
            this.saveChatHistory();
        }
    }

    addSystemMessage(text, timestamp = new Date()) {
        this.renderSystemMessage(text, timestamp);
        
        if (this.currentConversation) {
            // Create message object with timestamp
            const message = {
                text,
                isSystem: true,
                timestamp: timestamp.toISOString() // Store as ISO string for consistency
            };
            
            // Add to current conversation
            this.currentConversation.messages.push(message);
            
            // Update conversation in the conversations array
            const index = this.conversations.findIndex(c => c.id === this.currentConversation.id);
            if (index !== -1) {
                this.conversations[index] = this.currentConversation;
            }
            
            // Save everything
            this.saveChatHistory();
        }
    }

    async handleUserInput() {
        const message = this.userInput.value.trim();
        if (!message) return;

        if (!this.currentConversation) {
            this.createNewConversation();
            this.addSystemMessage('New chat started');
        }

        this.addMessage(message, true);
        this.userInput.value = '';
        
        await this.processAIResponse(message);
    }

    async processAIResponse(message) {
        try {
            // TODO: Implement actual AI API call with this.currentModel
            const response = await this.mockAIResponse(message);
            this.addMessage(`[${this.currentModel}] ${response}`);
        } catch (error) {
            console.error('Error processing AI response:', error);
            this.addMessage('Sorry, there was an error processing your request.');
        }
    }

    async mockAIResponse(message) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(`This is a placeholder AI response for: "${message}"`);
            }, 1000);
        });
    }

    toggleSettings() {
        // TODO: Implement settings panel
        console.log('Settings clicked');
    }

    handleMenuItemClick(e) {
        e.preventDefault();
        const section = e.target.dataset.section;
        // TODO: Implement section handling
        console.log(`Navigating to section: ${section}`);
    }

    createNewConversation() {
        const timestamp = new Date().toISOString(); // Store as ISO string
        this.currentConversation = {
            id: Date.now(),
            title: 'New Chat',
            messages: [],
            timestamp
        };
        this.conversations.unshift(this.currentConversation);
        this.saveChatHistory();
        this.updateChatHistory();
    }

    updateChatHistory() {
        this.chatHistory.innerHTML = '';
        this.conversations.forEach(conv => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            if (this.currentConversation && conv.id === this.currentConversation.id) {
                historyItem.classList.add('active');
            }
            
            historyItem.innerHTML = `
                <div class="history-item-content">
                    <div class="title">${conv.title}</div>
                    <div class="timestamp">${new Date(conv.timestamp).toLocaleString()}</div>
                </div>
                <div class="history-actions">
                    <button class="download-button" title="Download Markdown">📥</button>
                    <button class="delete-button" title="Delete Chat">🗑️</button>
                </div>
            `;
            
            historyItem.querySelector('.history-item-content').addEventListener('click', () => {
                // Only load if it's not the current conversation
                if (!this.currentConversation || conv.id !== this.currentConversation.id) {
                    this.loadConversation(conv);
                }
            });
            historyItem.querySelector('.download-button').addEventListener('click', (e) => {
                e.stopPropagation();
                this.downloadMarkdown(conv);
            });
            historyItem.querySelector('.delete-button').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteConversation(conv.id);
            });
            
            this.chatHistory.appendChild(historyItem);
        });
    }

    async deleteConversation(id) {
        if (!confirm('Are you sure you want to delete this chat?')) return;

        // Remove from conversations array
        this.conversations = this.conversations.filter(conv => conv.id !== id);
        
        // Clear current conversation if it's the one being deleted
        if (this.currentConversation && this.currentConversation.id === id) {
            this.currentConversation = null;
            this.chatMessages.innerHTML = '';
        }

        // Remove from IndexedDB
        try {
            const db = await this.initIndexedDB();
            const transaction = db.transaction(['chats'], 'readwrite');
            const store = transaction.objectStore('chats');
            await store.delete(id);
        } catch (error) {
            console.error('Error deleting from IndexedDB:', error);
        }

        // Update UI and local storage
        this.saveChatHistory();
        this.updateChatHistory();
    }

    async loadConversation(conversation) {
        if (this.currentConversation && conversation.id === this.currentConversation.id) {
            return;
        }

        // Create a proper deep copy with parsed dates
        this.currentConversation = JSON.parse(JSON.stringify(conversation));
        
        this.chatMessages.innerHTML = '';
        
        // Render all messages
        this.currentConversation.messages.forEach(msg => {
            if (msg.isSystem) {
                this.renderSystemMessage(msg.text, new Date(msg.timestamp));
            } else {
                this.renderMessage(msg.text, msg.isUser);
            }
        });
        
        this.updateChatHistory();
    }

    async downloadMarkdown(conversation) {
        const markdown = this.convertToMarkdown(conversation);
        const filename = `chat-${conversation.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${conversation.id}.md`;
        
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    saveChatHistory() {
        // Save to localStorage
        localStorage.setItem('chatHistory', JSON.stringify(this.conversations));
        
        // Save current conversation to IndexedDB
        if (this.currentConversation) {
            this.saveToMarkdown(this.currentConversation);
        }
    }

    loadChatHistory() {
        const saved = localStorage.getItem('chatHistory');
        if (saved) {
            this.conversations = JSON.parse(saved);
            this.updateChatHistory();
        }
    }

    filterHistory() {
        const searchTerm = this.searchHistory.value.toLowerCase();
        const historyItems = this.chatHistory.querySelectorAll('.history-item');
        
        historyItems.forEach(item => {
            const title = item.querySelector('.title').textContent.toLowerCase();
            item.style.display = title.includes(searchTerm) ? 'block' : 'none';
        });
    }

    startNewChat() {
        this.chatMessages.innerHTML = '';
        this.createNewConversation();
        this.addSystemMessage('New chat started');
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});
