const vscode = require('vscode');

class VBScriptDefinitionProvider {
    constructor() {
        this.definitionCache = new Map(); // Cache to store search results
    }

    async provideDefinition(document, position, token) {
        try {
            const word = document.getText(document.getWordRangeAtPosition(position));
            const searchPattern = new RegExp(`(Function|Sub)\\s+${word}\\b`, 'i');

            // Check cache first
            const cacheKey = document.uri.toString() + ':' + word;
            if (this.definitionCache.has(cacheKey)) {
                return this.definitionCache.get(cacheKey);
            }

            // Search in current document
            let definitionLocation = await this.searchInDocument(document, searchPattern);
            if (definitionLocation) {
                this.definitionCache.set(cacheKey, definitionLocation);
                return definitionLocation;
            }

            // Search in other files
            definitionLocation = await this.searchInWorkspace(searchPattern, document);
            this.definitionCache.set(cacheKey, definitionLocation);
            return definitionLocation;
        } catch (error) {
            console.error('Error providing definition:', error);
        }
    }

    async searchInDocument(document, pattern) {
        try {
            for (let i = 0; i < document.lineCount; i++) {
                let lineText = document.lineAt(i).text;
                if (pattern.test(lineText)) {
                    return new vscode.Location(document.uri, new vscode.Position(i, 0));
                }
            }
        } catch (error) {
            console.error('Error searching in document:', error);
        }
        return null;
    }

    async searchInWorkspace(pattern, currentDocument) {
        try {
            const files = await vscode.workspace.findFiles('**/*.{html,asp}', '**/node_modules/**');
            for (const file of files) {
                if (file.fsPath === currentDocument.uri.fsPath) continue;

                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const location = await this.searchInDocument(document, pattern);
                    if (location) return location;
                } catch (innerError) {
                    console.error(`Error opening or searching file ${file.fsPath}:`, innerError);
                }
            }
        } catch (error) {
            console.error('Error searching in workspace:', error);
        }
        return null;
    }

    clearCache() {
        this.definitionCache.clear();
    }
}

function activate(context) {
    let provider = new VBScriptDefinitionProvider();
    let disposable = vscode.languages.registerDefinitionProvider(['html', 'plaintext'], provider);

    // Clear cache when files are changed
    let watcher = vscode.workspace.createFileSystemWatcher('**/*.{html,asp,vbs}');
    watcher.onDidChange(() => provider.clearCache());
    watcher.onDidCreate(() => provider.clearCache());
    watcher.onDidDelete(() => provider.clearCache());

    context.subscriptions.push(disposable, watcher);

    console.log('Your extension "classic-asp-function-search" is now active!');
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
