import StorageService from './StorageService.js';

class ModelsService {
    constructor() {
        this.models = new Map();
        this.loadModels();
    }

    async loadModels() {
        const models = StorageService.loadModels();
        this.models.clear();
        models.forEach(model => this.models.set(model.id, model));
    }

    saveModels() {
        StorageService.saveModels(Array.from(this.models.values()));
    }

    getModels() {
        return Array.from(this.models.values()).filter(model => model.enabled);
    }

    getModel(id) {
        return this.models.get(id);
    }

    addModel(config) {
        this.models.set(config.id, config);
        this.saveModels();
    }

    updateModel(id, config) {
        if (this.models.has(id)) {
            this.models.set(id, { ...this.models.get(id), ...config });
            this.saveModels();
        }
    }

    deleteModel(id) {
        this.models.delete(id);
        this.saveModels();
    }

    async sendCompletion(modelId, messages) {
        const model = this.models.get(modelId);
        if (!model) throw new Error('Model not found');
        if (!model.apiKey) throw new Error('API key not configured');

        const fullMessages = [
            { role: 'system', content: model.systemPrompt },
            ...messages.map(msg => ({
                role: msg.isUser ? 'user' : 'assistant',
                content: msg.text
            }))
        ];

        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${model.apiKey}`
            },
            body: JSON.stringify({
                model: model.modelId || 'grok-2-latest',
                messages: fullMessages,
                temperature: model.temperature,
                stream: false,
                max_tokens: model.maxTokens
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
}

export default new ModelsService();
