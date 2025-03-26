import StorageService from './services/StorageService.js';
import MarkdownService from './services/MarkdownService.js';
import ModelsService from './services/ModelsService.js';

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
        this.addModelBtn = document.getElementById('addModelBtn');
        
        this.loadChatHistory();
        this.autoSaveTimeout = null;
        this.initializeEventListeners();
        this.setupKeyboardShortcuts();
        this.historyDisplayLimit = 5;
        this.showingAllHistory = false;
        this.lastUsedModel = null;
        this.inputHistory = [];
        this.inputHistoryIndex = -1;
        this.isProcessing = false;
        this.maxInputHistory = 50;
        this.updateModelSelector();
    }

    initializeEventListeners() {
        this.sendButton.addEventListener('click', () => this.handleUserInput());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleUserInput();
        });
        
        // Remove old model change handler
        this.modelSelector.addEventListener('change', () => {
            this.currentModel = this.modelSelector.value;
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
        this.addModelBtn.addEventListener('click', () => this.handleAddModel());

        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateInputHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateInputHistory(1);
            }
        });
    }

    navigateInputHistory(direction) {
        if (!this.inputHistory.length) return;
        
        this.inputHistoryIndex = Math.max(-1, Math.min(
            this.inputHistoryIndex + direction,
            this.inputHistory.length - 1
        ));

        if (this.inputHistoryIndex === -1) {
            this.userInput.value = '';
        } else {
            this.userInput.value = this.inputHistory[this.inputHistoryIndex];
        }
        
        // Move cursor to end
        setTimeout(() => {
            this.userInput.selectionStart = this.userInput.value.length;
            this.userInput.selectionEnd = this.userInput.value.length;
        }, 0);
    }

    setLoading(isLoading) {
        this.isProcessing = isLoading;
        this.sendButton.disabled = isLoading;
        this.userInput.disabled = isLoading;
        this.sendButton.innerHTML = isLoading ? '...' : '➤';
        this.userInput.style.opacity = isLoading ? '0.7' : '1';
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + K to focus search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.searchHistory.focus();
            }
            // Cmd/Ctrl + N for new chat
            if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                e.preventDefault();
                this.startNewChat();
            }
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
                timestamp: new Date().toISOString()
            };
            
            // Update conversation timestamp when modified
            this.currentConversation.lastEdited = new Date().toISOString();
            this.currentConversation.messages.push(message);
            
            // Update title if needed
            if (this.currentConversation.messages.length === 2) {
                this.currentConversation.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
            }
            
            // Update and sort conversations
            const index = this.conversations.findIndex(c => c.id === this.currentConversation.id);
            if (index !== -1) {
                this.conversations[index] = this.currentConversation;
                this.sortConversations();
            }
            
            // Save everything
            this.saveChatHistory();
        }
    }

    sortConversations() {
        this.conversations.sort((a, b) => {
            const dateA = new Date(a.lastEdited || a.timestamp);
            const dateB = new Date(b.lastEdited || b.timestamp);
            return dateB - dateA;
        });
    }

    addSystemMessage(text, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `system-message ${type}`;
        messageDiv.innerHTML = `
            ${text}
            <span class="timestamp">${new Date().toLocaleTimeString()}</span>
        `;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        if (this.currentConversation) {
            // Create message object with timestamp
            const message = {
                text,
                isSystem: true,
                timestamp: new Date().toISOString() // Store as ISO string for consistency
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
        if (!message || this.isProcessing) return;

        // Add to input history
        if (this.inputHistory[0] !== message) {
            this.inputHistory.unshift(message);
            if (this.inputHistory.length > this.maxInputHistory) {
                this.inputHistory.pop();
            }
        }
        this.inputHistoryIndex = -1;

        if (!this.currentConversation) {
            this.createNewConversation();
            this.addSystemMessage('New chat started');
            this.lastUsedModel = this.currentModel;
        } else if (this.lastUsedModel !== this.currentModel) {
            this.addSystemMessage(`Model switched to ${this.currentModel}`);
            this.lastUsedModel = this.currentModel;
        }

        this.addMessage(message, true);
        this.userInput.value = '';
        
        await this.processAIResponse(message);
    }

    async processAIResponse(message) {
        this.setLoading(true);
        try {
            const response = await ModelsService.sendCompletion(
                this.currentModel,
                this.currentConversation.messages
            );
            this.addMessage(response);
        } catch (error) {
            console.error('Error processing AI response:', error);
            this.addSystemMessage(`Error: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
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
        if (section === 'api-settings') {
            this.showAPISettings();
        }
        // TODO: Implement section handling
        console.log(`Navigating to section: ${section}`);
    }

    async showAPISettings() {
        const models = ModelsService.getModels();
        const sideMenu = document.querySelector('.side-menu');
        const originalContent = sideMenu.innerHTML;
        
        sideMenu.innerHTML = `
            <div class="settings-panel">
                <div class="settings-header">
                    <h2>API Settings</h2>
                    <button class="back-button">← Back</button>
                </div>
                <div class="models-list">
                    ${models.map(model => `
                        <div class="model-config" data-id="${model.id}">
                            <div class="model-header">
                                <h3>${model.name}</h3>
                                <button class="delete-model" title="Delete Model">🗑️</button>
                            </div>
                            <input type="text" class="api-key" placeholder="API Key" value="${model.apiKey || ''}" />
                            <textarea class="system-prompt" placeholder="System Prompt">${model.systemPrompt || ''}</textarea>
                            <input type="text" class="api-endpoint" placeholder="API Endpoint" value="${model.apiEndpoint || ''}" />
                            <div class="model-controls">
                                <label>Temperature: 
                                    <input type="number" class="temperature" value="${model.temperature}" min="0" max="2" step="0.1" />
                                </label>
                                <label>Max Tokens: 
                                    <input type="number" class="max-tokens" value="${model.maxTokens}" min="100" step="100" />
                                </label>
                                <label>
                                    <input type="checkbox" class="enabled" ${model.enabled ? 'checked' : ''} />
                                    Enabled
                                </label>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="settings-actions">
                    <button class="add-model">Add New Model</button>
                    <button class="save-settings primary">Save Changes</button>
                </div>
            </div>
        `;

        const addModelBtn = sideMenu.querySelector('.add-model');
        const saveBtn = sideMenu.querySelector('.save-settings');
        const backBtn = sideMenu.querySelector('.back-button');
        const modelsList = sideMenu.querySelector('.models-list');

        addModelBtn.onclick = () => {
            const modelId = 'model-' + Date.now();
            const modelConfig = document.createElement('div');
            modelConfig.className = 'model-config';
            modelConfig.dataset.id = modelId;
            modelConfig.innerHTML = `
                <div class="model-header">
                    <input type="text" class="model-name" placeholder="Model Name" />
                    <button class="delete-model" title="Delete Model">🗑️</button>
                </div>
                <input type="text" class="api-key" placeholder="API Key" />
                <textarea class="system-prompt" placeholder="System Prompt">You are a helpful AI assistant.</textarea>
                <input type="text" class="api-endpoint" placeholder="API Endpoint" />
                <div class="model-controls">
                    <label>Temperature: 
                        <input type="number" class="temperature" value="0.7" min="0" max="2" step="0.1" />
                    </label>
                    <label>Max Tokens: 
                        <input type="number" class="max-tokens" value="2000" min="100" step="100" />
                    </label>
                    <label>
                        <input type="checkbox" class="enabled" checked />
                        Enabled
                    </label>
                </div>
            `;
            modelsList.appendChild(modelConfig);
        };

        saveBtn.onclick = () => {
            const updatedModels = Array.from(modelsList.querySelectorAll('.model-config')).map(el => ({
                id: el.dataset.id,
                name: el.querySelector('.model-name')?.value || el.querySelector('h3')?.textContent,
                apiKey: el.querySelector('.api-key').value,
                systemPrompt: el.querySelector('.system-prompt').value,
                apiEndpoint: el.querySelector('.api-endpoint').value,
                temperature: parseFloat(el.querySelector('.temperature').value),
                maxTokens: parseInt(el.querySelector('.max-tokens').value),
                enabled: el.querySelector('.enabled').checked
            }));

            ModelsService.getModels().forEach(model => ModelsService.deleteModel(model.id));
            updatedModels.forEach(model => ModelsService.addModel(model));
            this.updateModelSelector();
            sideMenu.innerHTML = originalContent;
        };

        backBtn.onclick = () => {
            if (confirm('Discard changes?')) {
                sideMenu.innerHTML = originalContent;
            }
        };

        modelsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-model')) {
                const modelConfig = e.target.closest('.model-config');
                if (confirm('Delete this model?')) {
                    modelConfig.remove();
                }
            }
        });
    }

    createNewConversation() {
        const timestamp = new Date().toISOString(); // Store as ISO string
        this.currentConversation = {
            id: Date.now(),
            title: 'New Chat',
            messages: [],
            timestamp,
            lastEdited: timestamp
        };
        this.conversations.unshift(this.currentConversation);
        this.saveChatHistory();
        this.updateChatHistory();
        this.lastUsedModel = this.currentModel;
    }

    updateChatHistory() {
        this.chatHistory.innerHTML = '';
        const displayCount = this.showingAllHistory ? this.conversations.length : this.historyDisplayLimit;
        const visibleConversations = this.conversations.slice(0, displayCount);
        
        visibleConversations.forEach(conv => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.dataset.id = conv.id;
            if (this.currentConversation && conv.id === this.currentConversation.id) {
                historyItem.classList.add('active');
            }
            
            // Get last used model from messages
            const lastModel = this.getLastUsedModel(conv);
            const date = new Date(conv.timestamp).toLocaleDateString();
            
            historyItem.innerHTML = `
                <div class="history-item-content">
                    <div class="title">${conv.title}</div>
                    <div class="meta">
                        <span>${date}</span>
                        ${lastModel ? `<span>${lastModel}</span>` : ''}
                    </div>
                </div>
                <div class="history-actions">
                    <button class="rename-button" title="Rename Chat">✎</button>
                    <button class="download-button" title="Download Markdown">📥</button>
                    <button class="delete-button" title="Delete Chat">🗑️</button>
                </div>
            `;
            
            historyItem.querySelector('.history-item-content').addEventListener('click', () => {
                if (!this.currentConversation || conv.id !== this.currentConversation.id) {
                    this.loadConversation(conv);
                }
            });
            historyItem.querySelector('.rename-button').addEventListener('click', (e) => {
                e.stopPropagation();
                this.renameConversation(conv);
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

        // Add toggle button if needed
        if (this.conversations.length > this.historyDisplayLimit) {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = this.showingAllHistory ? 'show-less-btn' : 'show-more-btn';
            toggleBtn.textContent = this.showingAllHistory 
                ? 'Show Less'
                : `Show More (${this.conversations.length - this.historyDisplayLimit} more)`;
            toggleBtn.addEventListener('click', () => {
                this.showingAllHistory = !this.showingAllHistory;
                this.updateChatHistory();
            });
            this.chatHistory.appendChild(toggleBtn);
        }
    }

    async renameConversation(conversation) {
        const newTitle = prompt('Enter new name for chat:', conversation.title);
        if (!newTitle || newTitle === conversation.title) return;

        // Update title in memory
        conversation.title = newTitle;
        if (this.currentConversation && conversation.id === this.currentConversation.id) {
            this.currentConversation.title = newTitle;
        }

        // Update title in conversations array
        const index = this.conversations.findIndex(c => c.id === conversation.id);
        if (index !== -1) {
            this.conversations[index].title = newTitle;
        }

        // Save changes and update UI
        this.saveChatHistory();
        this.updateChatHistory();
    }

    getLastUsedModel(conversation) {
        // Find the last model change message
        const modelMessage = [...conversation.messages]
            .reverse()
            .find(msg => msg.isSystem && msg.text.includes('Model switched to'));
        
        if (modelMessage) {
            return modelMessage.text.replace('Model switched to ', '');
        }
        return null;
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
        
        // Set the last used model from the conversation history
        this.lastUsedModel = this.getLastUsedModel(conversation) || this.currentModel;
        
        this.updateChatHistory();
    }

    async downloadMarkdown(conversation) {
        const markdown = MarkdownService.convertToMarkdown(conversation, this.currentModel);
        const filename = `chat-${conversation.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${conversation.id}.md`;
        MarkdownService.downloadMarkdown(markdown, filename);
    }

    saveChatHistory() {
        StorageService.saveChatHistory(this.conversations);
        
        if (this.currentConversation) {
            const markdown = MarkdownService.convertToMarkdown(this.currentConversation, this.currentModel);
            StorageService.saveToIndexedDB(this.currentConversation.id, {
                filename: `chat-${this.currentConversation.id}.md`,
                content: markdown,
                timestamp: new Date(),
                title: this.currentConversation.title
            }).catch(error => console.error('Error saving markdown:', error));
        }
    }

    loadChatHistory() {
        this.conversations = StorageService.loadChatHistory();
        this.sortConversations();
        this.updateChatHistory();
    }

    async handleAddModel() {
        const modelName = prompt('Enter custom model name:');
        if (!modelName) return;

        const option = document.createElement('option');
        option.value = modelName.toLowerCase();
        option.textContent = modelName;
        this.modelSelector.appendChild(option);
        this.modelSelector.value = option.value;
        
        // Trigger model change
        this.currentModel = option.value;
        this.addSystemMessage(`Model switched to ${this.currentModel}`);
    }

    updateModelSelector() {
        this.modelSelector.innerHTML = '';
        ModelsService.getModels().forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            this.modelSelector.appendChild(option);
        });
        this.currentModel = this.modelSelector.value;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});
