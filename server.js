const express = require('express');
const path = require('path');
const CacheManager = require('./services/cache');

const app = express();
const PORT = 3000;

// Configuration CORS pour permettre les requêtes depuis le site de gestion
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

const CONFIG_FILE = path.join(__dirname, 'config.json');
const cacheManager = new CacheManager(__dirname);

app.locals.configFile = CONFIG_FILE;
app.locals.cache = cacheManager;

const configModule = require('./routes/config');
app.locals.getDataPath = configModule.getDataPath;
app.locals.getNasPath = configModule.getNasPath;

app.use('/api/config', configModule.router);
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/report', require('./routes/reports'));
app.use('/api/nas', require('./routes/nas'));
app.use('/api/nas-documents', require('./routes/nas-documents'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/map', require('./routes/map'));
app.use('/api/ai', require('./routes/ai-assistant'));
app.use('/api/sharepoint', require('./routes/sharepoint'));
app.use('/api/sav', require('./routes/sav'));
app.post('/api/check-url', require('./routes/map').checkUrl);
app.post('/api/search-address', require('./routes/map').searchAddress);

async function startServer() {
    await configModule.loadConfig(CONFIG_FILE);
    await cacheManager.loadNasCache();
    await cacheManager.loadProjectsCache();
    await cacheManager.loadTasksCache();
    await cacheManager.loadMapSites();
    await cacheManager.loadNasAssociations();

    app.listen(PORT, () => {
        console.log('='.repeat(60));
        console.log('✅ TrackHour démarré avec succès !');
        console.log('='.repeat(60));
        if (configModule.getDataPath()) {
            console.log(`📂 Dossier: ${configModule.getDataPath()}`);
        } else {
            console.log('⚠️  Configuration requise');
        }
        if (cacheManager.nasCache.length > 0) {
            console.log(`📦 Cache NAS: ${cacheManager.nasCache.length} projets`);
        }
        console.log(`🌐 URL: http://localhost:${PORT}`);
        console.log('='.repeat(60));
    });
}

startServer();
