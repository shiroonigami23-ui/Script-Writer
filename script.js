const state = {
    currentScript: null,
    scripts: JSON.parse(localStorage.getItem('scripts')) || {},
    voiceRecognition: null,
    isRecording: false,
    copilotMemory: JSON.parse(localStorage.getItem('copilotMemory')) || [],
    theme: localStorage.getItem('theme') || 'dark'
};

function init() {
    setupEventListeners();
    loadScripts();
    setupVoiceRecognition();
    applyTheme(state.theme);
    updateCopilotMemory();
    renderScripts();
}

function setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchSection(btn.dataset.section));
    });
    document.getElementById('menuToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
    });
    document.getElementById('toggleTheme').addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', state.theme);
        applyTheme(state.theme);
    });
    document.getElementById('clearBtn').addEventListener('click', () => {
        if (confirm('Clear all text?')) document.getElementById('scriptEditor').value = '';
    });
    document.getElementById('saveBtn').addEventListener('click', saveCurrentScript);
    document.getElementById('playTTSBtn').addEventListener('click', playTTS);
    document.getElementById('pauseTTSBtn').addEventListener('click', pauseTTS);
    document.getElementById('analyzeBtn').addEventListener('click', analyzeScript);
    document.getElementById('startVoiceBtn').addEventListener('click', startVoiceMatching);
    document.getElementById('stopVoiceBtn').addEventListener('click', stopVoiceMatching);
    document.getElementById('clearVoiceBtn').addEventListener('click', clearVoiceMatching);
    document.getElementById('newScriptBtn').addEventListener('click', () => {
        document.getElementById('newScriptModal').classList.add('active');
    });
    document.getElementById('createScriptBtn').addEventListener('click', createNewScript);
    document.getElementById('closeNewScriptModal').addEventListener('click', () => {
        document.getElementById('newScriptModal').classList.remove('active');
    });
    document.querySelectorAll('.generate-card').forEach(card => {
        card.addEventListener('click', () => generateScript(card.dataset.template));
    });
    document.getElementById('generateCustomBtn').addEventListener('click', () => {
        const topic = document.getElementById('customTopic').value;
        if (topic.trim()) generateCustomScript(topic);
    });
    document.getElementById('searchScripts').addEventListener('input', (e) => {
        filterScripts(e.target.value);
    });
    document.getElementById('exportTxt').addEventListener('click', () => exportScript('txt'));
    document.getElementById('exportMd').addEventListener('click', () => exportScript('md'));
    document.getElementById('exportJson').addEventListener('click', () => exportScript('json'));
    document.getElementById('exportHtml').addEventListener('click', () => exportScript('html'));
    document.getElementById('exportAll').addEventListener('click', exportAllScripts);
    document.getElementById('viewHistoryBtn').addEventListener('click', showCopilotHistory);
    document.getElementById('clearMemoryBtn').addEventListener('click', clearCopilotMemory);
}

function switchSection(sectionId) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });
    document.querySelectorAll('.content-area').forEach(area => area.classList.remove('active'));
    document.getElementById(sectionId + 'Section').classList.add('active');
    const titles = {editor: '✍️ Write & Edit', voice: '🎤 Voice Match', generate: '✨ AI Generate', copilot: '🤖 Co-pilot', scripts: '📚 My Scripts', export: '📤 Export'};
    document.getElementById('currentTitle').textContent = titles[sectionId];
    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('active');
}

let currentUtterance = null;
function playTTS() {
    const text = document.getElementById('scriptEditor').value;
    if (!text.trim()) { alert('No script to read!'); return; }
    window.speechSynthesis.cancel();
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.rate = 0.95;
    window.speechSynthesis.speak(currentUtterance);
    document.getElementById('ttsPreview').textContent = text;
}
function pauseTTS() { window.speechSynthesis.pause(); }

function analyzeScript() {
    const text = document.getElementById('scriptEditor').value;
    if (!text.trim()) { alert('Write something first!'); return; }
    const words = text.match(/\b\w+\b/g) || [];
    const sentences = text.match(/[.!?]+/g) || [];
    const uniqueWords = new Set(words);
    document.getElementById('wordCount').textContent = words.length;
    document.getElementById('charCount').textContent = text.length;
    document.getElementById('readTime').textContent = Math.ceil(words.length / 200);
    document.getElementById('uniqueWords').textContent = uniqueWords.size;
    document.getElementById('avgWords').textContent = sentences.length > 0 ? Math.round(words.length / sentences.length) : 0;
    document.getElementById('scriptAnalytics').style.display = 'block';
}

function setupVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Speech Recognition not supported'); return; }
    state.voiceRecognition = new SpeechRecognition();
    state.voiceRecognition.continuous = true;
    state.voiceRecognition.interimResults = true;
    state.voiceRecognition.onstart = () => {
        state.isRecording = true;
        document.getElementById('micIndicator').classList.add('active');
    };
    state.voiceRecognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.toLowerCase();
            if (event.results[i].isFinal) finalTranscript += transcript + ' ';
            else interimTranscript += transcript;
        }
        document.getElementById('spokenTranscript').textContent = finalTranscript + interimTranscript;
        matchWords(finalTranscript + interimTranscript);
    };
    state.voiceRecognition.onend = () => {
        state.isRecording = false;
        document.getElementById('micIndicator').classList.remove('active');
    };
}

function startVoiceMatching() {
    const scriptText = document.getElementById('scriptEditor').value;
    if (!scriptText.trim()) { alert('Write a script first!'); return; }
    document.getElementById('scriptPreview').textContent = scriptText;
    state.voiceRecognition.start();
}
function stopVoiceMatching() { state.voiceRecognition.stop(); }
function clearVoiceMatching() {
    document.getElementById('spokenTranscript').textContent = 'Click Start...';
    document.getElementById('wordMatches').innerHTML = '';
    document.getElementById('matchAccuracy').textContent = '0';
    document.getElementById('confidence').textContent = '0';
    document.getElementById('progressFill').style.width = '0%';
}

function matchWords(spokenText) {
    const scriptText = document.getElementById('scriptEditor').value.toLowerCase();
    const words = spokenText.split(/\s+/).filter(w => w.length > 0);
    const scriptWords = scriptText.split(/\s+/);
    let matched = 0, matchesHtml = '';
    words.forEach(word => {
        if (word.length < 2) return;
        let foundMatch = false;
        for (let scriptWord of scriptWords) {
            if (scriptWord.includes(word) || word.includes(scriptWord)) {
                foundMatch = true;
                matched++;
                break;
            }
        }
        matchesHtml += `<div class="word-match-item"><span>${word}</span><span class="match-status ${foundMatch ? 'matched' : ''}">${foundMatch ? '✓' : '✗'}</span></div>`;
    });
    const accuracy = words.length > 0 ? Math.round((matched / words.length) * 100) : 0;
    document.getElementById('matchAccuracy').textContent = accuracy;
    document.getElementById('confidence').textContent = accuracy;
    document.getElementById('progressFill').style.width = accuracy + '%';
    document.getElementById('wordMatches').innerHTML = matchesHtml;
}

const templates = {
    'git-tutorial': {generate: () => `Git Tutorial\n${'='.repeat(12)}\nInitialize repository, add files, commit changes, create branches, merge, push`},
    'github-workflow': {generate: () => `GitHub Workflow\n${'='.repeat(15)}\nFork repo, create branch, commit, push, pull request, merge`},
    'ml-basics': {generate: () => `ML Basics\n${'='.repeat(8)}\nSupervised learning, unsupervised learning, features, overfitting, regularization`},
    'api-integration': {generate: () => `API Integration\n${'='.repeat(14)}\nREST principles, HTTP methods, status codes, authentication`},
    'deepseek': {generate: () => `DeepSeek Guide\n${'='.repeat(13)}\nSearch academic content, use filters, export citations`},
    'colab-setup': {generate: () => `Google Colab\n${'='.repeat(11)}\nCreate notebook, mount drive, install libraries, run cells`},
    'cnn-explained': {generate: () => `CNN Explained\n${'='.repeat(12)}\nConvolution, pooling, filters, activation, backpropagation`},
};

function generateScript(template) {
    if (templates[template]) {
        document.getElementById('scriptEditor').value = templates[template].generate();
        switchSection('editor');
        addToCopilotMemory(`Generated: ${template}`);
    }
}

function generateCustomScript(topic) {
    const script = `${topic}\n${'='.repeat(topic.length)}\n\nKey points about ${topic}:\n• Understanding fundamentals\n• Advanced techniques\n• Best practices\n• Real applications`;
    document.getElementById('scriptEditor').value = script;
    switchSection('editor');
    addToCopilotMemory(`Generated: ${topic}`);
}

function createNewScript() {
    const name = document.getElementById('scriptNameInput').value;
    const category = document.getElementById('scriptCategoryInput').value;
    if (!name.trim()) { alert('Name required!'); return; }
    const id = Date.now();
    state.scripts[id] = {
        id, name, category: category || 'Uncategorized', content: '',
        createdAt: new Date().toLocaleString(),
        updatedAt: new Date().toLocaleString()
    };
    saveScripts();
    renderScripts();
    state.currentScript = id;
    document.getElementById('scriptNameInput').value = '';
    document.getElementById('scriptCategoryInput').value = '';
    document.getElementById('newScriptModal').classList.remove('active');
    switchSection('editor');
    addToCopilotMemory(`Created: ${name}`);
}

function saveCurrentScript() {
    if (state.currentScript && state.scripts[state.currentScript]) {
        state.scripts[state.currentScript].content = document.getElementById('scriptEditor').value;
        saveScripts();
        alert('Saved! 💾');
    }
}

function saveScripts() {
    localStorage.setItem('scripts', JSON.stringify(state.scripts));
    updateCopilotMemory();
}
function loadScripts() {}
function renderScripts() {
    const container = document.getElementById('scriptsList');
    if (Object.keys(state.scripts).length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">No scripts yet!</div>';
        return;
    }
    container.innerHTML = Object.values(state.scripts).map(script => `
        <div class="script-card">
            <div class="script-card-header"><div class="script-card-title">${script.name}</div></div>
            <div class="script-card-meta"><span>${script.category}</span><span>${script.updatedAt}</span></div>
            <div class="script-card-preview">${script.content.slice(0, 80)}...</div>
            <div class="script-card-footer">
                <button class="script-card-btn" onclick="editScript(${script.id})">Edit</button>
                <button class="script-card-btn" onclick="deleteScript(${script.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function editScript(id) {
    state.currentScript = id;
    document.getElementById('scriptEditor').value = state.scripts[id].content;
    switchSection('editor');
}

function deleteScript(id) {
    if (confirm('Delete?')) {
        delete state.scripts[id];
        saveScripts();
        renderScripts();
    }
}

function filterScripts(query) {
    const filtered = Object.values(state.scripts).filter(s => 
        s.name.toLowerCase().includes(query.toLowerCase()) || 
        s.category.toLowerCase().includes(query.toLowerCase())
    );
    const container = document.getElementById('scriptsList');
    container.innerHTML = filtered.length ? filtered.map(s => `
        <div class="script-card">
            <div class="script-card-header"><div class="script-card-title">${s.name}</div></div>
            <div class="script-card-meta"><span>${s.category}</span></div>
            <div class="script-card-preview">${s.content.slice(0, 80)}...</div>
            <div class="script-card-footer">
                <button class="script-card-btn" onclick="editScript(${s.id})">Edit</button>
                <button class="script-card-btn" onclick="deleteScript(${s.id})">Delete</button>
            </div>
        </div>
    `).join('') : '<div style="grid-column: 1/-1; text-align: center;">No scripts found.</div>';
}

function addToCopilotMemory(entry) {
    state.copilotMemory.push({ timestamp: new Date().toLocaleString(), action: entry });
    if (state.copilotMemory.length > 50) state.copilotMemory = state.copilotMemory.slice(-50);
    localStorage.setItem('copilotMemory', JSON.stringify(state.copilotMemory));
    updateCopilotMemory();
}

function updateCopilotMemory() {
    document.getElementById('memoryCount').textContent = state.copilotMemory.length;
    document.getElementById('totalScripts').textContent = Object.keys(state.scripts).length;
    const totalWords = Object.values(state.scripts).reduce((sum, s) => sum + (s.content.match(/\b\w+\b/g) || []).length, 0);
    document.getElementById('totalWords').textContent = totalWords;
    const recent = state.copilotMemory.slice(-5).reverse().map(m => `${m.timestamp}: ${m.action}`).join('\n');
    document.getElementById('copilotMemoryContent').textContent = recent || 'No memories yet.';
}

function showCopilotHistory() {
    alert('Recent Actions:\n\n' + state.copilotMemory.slice(-10).reverse().map(m => `${m.timestamp}: ${m.action}`).join('\n'));
}

function clearCopilotMemory() {
    if (confirm('Clear all memory?')) {
        state.copilotMemory = [];
        localStorage.setItem('copilotMemory', JSON.stringify([]));
        updateCopilotMemory();
    }
}

function exportScript(format) {
    const text = document.getElementById('scriptEditor').value;
    if (!text.trim()) { alert('No script!'); return; }
    let content, filename;
    if (format === 'txt') { content = text; filename = 'script.txt'; }
    else if (format === 'md') { content = `# Script\n\n${text}`; filename = 'script.md'; }
    else if (format === 'json') { content = JSON.stringify({content: text, timestamp: new Date().toISOString()}, null, 2); filename = 'script.json'; }
    else if (format === 'html') { content = `<!DOCTYPE html><html><body style="font-family: Arial;"><pre>${text.replace(/</g, '&lt;')}</pre></body></html>`; filename = 'script.html'; }
    const blob = new Blob([content], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    addToCopilotMemory(`Exported: ${format}`);
}

function exportAllScripts() {
    const allScripts = Object.values(state.scripts);
    if (allScripts.length === 0) { alert('No scripts!'); return; }
    const content = allScripts.map(s => `\n${'='.repeat(40)}\n${s.name}\n${'='.repeat(40)}\n${s.content}`).join('\n');
    const blob = new Blob([content], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'all-scripts.txt';
    link.click();
    addToCopilotMemory('Exported All');
}

function applyTheme(theme) {
    document.body.style.colorScheme = theme;
}

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) document.getElementById('sidebar').classList.remove('active');
});

document.addEventListener('DOMContentLoaded', init);
