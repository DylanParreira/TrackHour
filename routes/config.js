const express = require('express');
const fs = require('fs').promises;
const router = express.Router();

let DATA_PATH = null;
let NAS_PATH = '\\\\Nas-applitec-2\\partage\\1000- Affaires';

async function loadConfig(configFile) {
    try {
        const content = await fs.readFile(configFile, 'utf-8');
        const config = JSON.parse(content);
        DATA_PATH = config.dataPath;
        if (config.nasPath) NAS_PATH = config.nasPath;
        console.log(`📂 Chemin données: ${DATA_PATH}`);
        console.log(`📂 Chemin NAS: ${NAS_PATH}`);
        return true;
    } catch (error) {
        console.log('⚠️  Aucune configuration trouvée');
        return false;
    }
}

router.get('/check', async (req, res) => {
    res.json({ configured: DATA_PATH !== null, path: DATA_PATH, nasPath: NAS_PATH });
});

router.post('/save', async (req, res) => {
    try {
        const { dataPath, nasPath } = req.body;
        try {
            await fs.access(dataPath);
        } catch (error) {
            await fs.mkdir(dataPath, { recursive: true });
        }
        const config = { dataPath, nasPath: nasPath || NAS_PATH };
        await fs.writeFile(req.app.locals.configFile, JSON.stringify(config, null, 2));
        DATA_PATH = dataPath;
        if (nasPath) NAS_PATH = nasPath;
        console.log(`✅ Configuration sauvegardée: ${DATA_PATH}`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Erreur configuration:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/shutdown', (req, res) => {
    console.log('\n⚠️  Arrêt du serveur demandé...');
    res.json({ success: true, message: 'Serveur en cours d\'arrêt' });
    setTimeout(() => {
        console.log('✅ Serveur arrêté proprement');
        process.exit(0);
    }, 500);
});

module.exports = { router, loadConfig, getDataPath: () => DATA_PATH, getNasPath: () => NAS_PATH };
