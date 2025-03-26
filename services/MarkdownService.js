class MarkdownService {
    convertToMarkdown(conversation, model) {
        const lines = [];
        const title = conversation.title.trim() || 'Untitled Chat';
        lines.push(`# ${title}`);
        lines.push(`\nStarted: ${new Date(conversation.timestamp).toLocaleString()}`);
        lines.push(`Model: ${model}`);
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

    downloadMarkdown(markdown, filename) {
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
}

export default new MarkdownService();
