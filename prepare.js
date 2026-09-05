const fs = require("fs");

const file = "index.html";
let html = fs.readFileSync(file, "utf8");

html = html.replace(
  /const CLOUDFLARE_WORKER_URL = '[^']*';\s*const PWA_API_KEY = '[^']*';/,
  "const COPE_AI_URL = '/api/cope-ai';"
);

html = html.replace(
  /function callCopeAI\(userMessage, onSuccess, onError\) \{[\s\S]*?\n  \}\n  \n  \/\/ Enter key to send/,
  `function callCopeAI(userMessage, onSuccess, onError) {
    var messages = [
      { role: 'user', content: userMessage }
    ];

    if (chatHistory.length > 0) {
      messages = chatHistory.slice(-10).concat(messages);
    }

    var payload = {
      model: 'claude-opus-4-8',
      max_tokens: 500,
      system: 'You are Cope, a compassionate AI companion created to support mental health and wellbeing. Be warm, empathetic, and supportive. Keep responses concise (2-3 sentences). Never provide professional medical advice—encourage them to seek professional help for serious concerns.',
      messages: messages
    };

    fetch(COPE_AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      if (!res.ok) throw new Error('Server error: ' + res.status);
      return res.json();
    })
    .then(function(data) {
      if (data.content && data.content[0] && data.content[0].text) {
        var responseText = data.content[0].text;
        chatHistory.push({ role: 'user', content: userMessage });
        chatHistory.push({ role: 'assistant', content: responseText });
        onSuccess(responseText);
      } else if (data.error) {
        throw new Error('API Error: ' + data.error);
      } else {
        throw new Error('Invalid response format');
      }
    })
    .catch(function(err) {
      console.error('Cope AI error:', err);
      onError('⚠️ ' + err.message + '\\n\\nPlease try again in a moment.');
    });
  }
  
  // Enter key to send`
);

// Keep the PWA service-worker path valid both on GitHub Pages (/Cope/)
// and when the app is served from the AWS container root (/).
html = html.replace(
  "navigator.serviceWorker.register('/Cope/sw.js')",
  "navigator.serviceWorker.register('./sw.js')"
);

// Add the optional, consent-based Toastid Tech lead capture to the production build.
const leadScript = '<script src="./lead-capture.js" defer></script>';
if (!html.includes('lead-capture.js')) {
  html = html.replace('</body>', `  ${leadScript}\n</body>`);
}

fs.writeFileSync(file, html);

// Make the manifest portable between the GitHub Pages subpath and the
// AWS container root. Relative paths resolve against the manifest location.
const manifestFile = "manifest.json";
let manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
manifest.start_url = "./";
manifest.scope = "./";
manifest.icons = (manifest.icons || []).map(icon => ({
  ...icon,
  src: icon.src.replace(/^\/Cope\//, "./")
}));
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

console.log("Cope frontend prepared for AWS /api/cope-ai");
