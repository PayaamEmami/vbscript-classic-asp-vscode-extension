const vscode = require('vscode');

class VBScriptDefinitionProvider {
    constructor() {
        this.definitionCache = new Map();
    }

    async provideDefinition(document, position, token) {
        try {
            const word = document.getText(document.getWordRangeAtPosition(position));
            const searchPattern = new RegExp(`(Function|Sub)\\s+${word}\\b`, 'i');
            const cacheKey = document.uri.toString() + ':' + word;

            console.log("provideDefinition called for", document.uri);

            if (this.definitionCache.has(cacheKey)) {
                const cachedDefinitions = this.definitionCache.get(cacheKey);
                if (cachedDefinitions.length === 1) {
                    return cachedDefinitions[0];
                }
            }

            let definitions = await this.searchInDocument(document, searchPattern);
            if (definitions.length === 0) {
                definitions = await this.searchInWorkspace(searchPattern, document);
            }

            if (definitions.length === 1) {
                this.definitionCache.set(cacheKey, definitions);
                return definitions[0];
            } else if (definitions.length > 1) {
                const picks = await Promise.all(definitions.map(async (location) => {
                    const defDocument = await vscode.workspace.openTextDocument(location.uri);
                    const lineText = defDocument.lineAt(location.range.start.line).text.trim();
                    return {
                        label: `${location.uri.fsPath}:${location.range.start.line + 1}`,
                        detail: lineText,
                        location: location
                    };
                }));

                const selected = await vscode.window.showQuickPick(picks, {
                    placeHolder: 'Multiple definitions found. Select one to navigate to.'
                });

                if (selected) {
                    return selected.location;
                }
            }
        } catch (error) {
            console.error('Error providing definition:', error);
        }
    }

    async searchInDocument(document, pattern) {
        let locations = [];
        try {
            for (let i = 0; i < document.lineCount; i++) {
                let lineText = document.lineAt(i).text;
                if (pattern.test(lineText)) {
                    const location = new vscode.Location(document.uri, new vscode.Position(i, 0));
                    locations.push(location);
                }
            }
        } catch (error) {
            console.error('Error searching in document:', error);
        }
        return locations;
    }

    async searchInWorkspace(pattern, currentDocument) {
        let locations = [];
        try {
            const files = await vscode.workspace.findFiles('**/*.{html,asp,vbs}', '**/node_modules/**');
            for (const file of files) {
                if (file.fsPath === currentDocument.uri.fsPath) continue;

                const document = await vscode.workspace.openTextDocument(file);
                const fileLocations = await this.searchInDocument(document, pattern);
                locations = locations.concat(fileLocations);
            }
        } catch (error) {
            console.error('Error searching in workspace:', error);
        }
        return locations;
    }

    clearCache() {
        this.definitionCache.clear();
    }
}

function activate(context) {
    let provider = new VBScriptDefinitionProvider();
    let disposable = vscode.languages.registerDefinitionProvider(['html', 'plaintext', 'vbs'], provider);
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
