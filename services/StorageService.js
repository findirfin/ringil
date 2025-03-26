class StorageService {
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

    saveChatHistory(conversations) {
        localStorage.setItem('chatHistory', JSON.stringify(conversations));
    }

    loadChatHistory() {
        const saved = localStorage.getItem('chatHistory');
        return saved ? JSON.parse(saved) : [];
    }

    loadModels() {
        const saved = localStorage.getItem('aiModels');
        return saved ? JSON.parse(saved) : [
            {
                id: 'default-gpt4',
                name: 'GPT-4',
                provider: 'openai',
                apiEndpoint: 'https://api.openai.com/v1/chat/completions',
                apiKey: '',
                systemPrompt: 'You are a helpful AI assistant.',
                temperature: 0.7,
                maxTokens: 2000,
                enabled: true
            }
        ];
    }

    saveModels(models) {
        localStorage.setItem('aiModels', JSON.stringify(models));
    }
}

export default new StorageService();
