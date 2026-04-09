const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const BLACKLIST_FOLDERS = ['1- Documentations','2- Programmes','3- Supervision','4- Schémas Electrique','5- Suivi de chantier','Plans','Photos','Correspondance','Archives','Sauvegardes','Export','Images','GPUCache','transfert','C.WEB','ARCHITECTURE','LISTE MATERIEL','PID'];
const SYNONYMES = {'LECLERC':['E.LECLERC','E LECLERC','LECLERC DRIVE'],'ITM':['SUPER U','HYPER U','U EXPRESS','MARCHE U','ULOG','U LOG'],'AUCHAN':['SIMPLY MARKET','SIMPLY'],'CARREFOUR':['CARREFOUR MARKET','CARREFOUR EXPRESS','CARREFOUR CITY'],'CASINO':['MONOPRIX','FRANPRIX','LEADER PRICE']};

function isBlacklisted(folderName) { return BLACKLIST_FOLDERS.includes(folderName); }
function isRealProject(folderName) { return [/^AF/i,/^-\s*AF/i,/^A\d/i,/AF\d/i].some(p => p.test(folderName)); }
function isRecentProject(projectName) {
    const match = projectName.match(/AF(\d{2})(\d{2})\d+/);
    if (!match) return false;
    try {
        const year = 2000 + parseInt(match[1]);
        const month = parseInt(match[2]);
        const projectDate = new Date(year, month - 1, 1);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return projectDate >= threeMonthsAgo;
    } catch (error) { return false; }
}
function getFuzzyMatches(searchTerm) {
    const matches = [searchTerm];
    const termUpper = searchTerm.toUpperCase();
    for (const [key, synonyms] of Object.entries(SYNONYMES)) {
        if (termUpper.includes(key)) matches.push(...synonyms);
        for (const synonym of synonyms) {
            if (termUpper.includes(synonym)) matches.push(key);
        }
    }
    if (searchTerm.length > 4) matches.push(searchTerm.substring(0, searchTerm.length - 1));
    return [...new Set(matches)];
}

router.get('/cache/check', async (req, res) => {
    const cache = req.app.locals.cache;
    res.json({ cached: cache.nasCache.length > 0, count: cache.nasCache.length, path: req.app.locals.getNasPath() });
});

router.post('/sync', async (req, res) => {
    try {
        const nasPath = req.body.nasPath || req.app.locals.getNasPath();
        console.log(`🔄 Synchronisation NAS: ${nasPath}`);

        try {
            await Promise.race([fs.access(nasPath), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))]);
        } catch (error) {
            return res.status(500).json({ success: false, error: `Serveur inaccessible: ${nasPath}` });
        }

        const cache = req.app.locals.cache;
        const newCache = [];
        let projectsFound = 0, foldersIgnored = 0, recentProjects = 0;

        async function scanDirectory(dirPath, clientName, chantierName = '') {
            try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;
                    const fullPath = path.join(dirPath, entry.name);
                    if (isBlacklisted(entry.name)) { foldersIgnored++; continue; }
                    if (isRealProject(entry.name)) {
                        const isRecent = isRecentProject(entry.name);
                        if (isRecent) recentProjects++;
                        newCache.push({ Client: clientName, Chantier: chantierName || 'Divers', Projet: entry.name, Type: 'Projet', IsRecent: isRecent, Path: fullPath });
                        projectsFound++;
                    } else {
                        await scanDirectory(fullPath, clientName, entry.name);
                    }
                }
            } catch (error) {}
        }

        const clients = await fs.readdir(nasPath, { withFileTypes: true });
        const totalClients = clients.filter(c => c.isDirectory()).length;
        let currentClient = 0;

        for (const client of clients) {
            if (!client.isDirectory()) continue;
            currentClient++;
            console.log(`[${currentClient}/${totalClients}] Client: ${client.name}`);
            await scanDirectory(path.join(nasPath, client.name), client.name);
        }

        cache.nasCache = newCache;
        await cache.saveNasCache();
        console.log(`✅ Sync terminée: ${projectsFound} projets`);
        res.json({ success: true, projectsFound, recentProjects, foldersIgnored });
    } catch (error) {
        console.error('❌ Erreur sync NAS:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/clients', async (req, res) => {
    try {
        const cache = req.app.locals.cache;
        const clients = [...new Set(cache.nasCache.map(e => e.Client))].sort();
        res.json({ success: true, clients });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/search', async (req, res) => {
    try {
        const { searchText, clientFilter } = req.body;
        const cache = req.app.locals.cache;
        if (cache.nasCache.length === 0) return res.json({ success: true, results: [], message: 'Cache vide' });

        let results = [];
        if (!searchText && clientFilter) {
            results = cache.nasCache.filter(e => e.Client === clientFilter && e.Type === 'Projet');
        } else if (searchText) {
            const searchTerms = getFuzzyMatches(searchText);
            for (const entry of cache.nasCache) {
                if (entry.Type !== 'Projet') continue;
                if (clientFilter && entry.Client !== clientFilter) continue;
                let match = false;
                for (const term of searchTerms) {
                    const termUpper = term.toUpperCase();
                    if (entry.Client.toUpperCase().includes(termUpper) || entry.Chantier.toUpperCase().includes(termUpper) || entry.Projet.toUpperCase().includes(termUpper)) {
                        match = true; break;
                    }
                    const parts = [...entry.Projet.split(/[\s\-_]+/), ...entry.Chantier.split(/[\s\-_]+/)];
                    for (const part of parts) {
                        if (part.toUpperCase().includes(termUpper)) { match = true; break; }
                    }
                    if (match) break;
                }
                if (match) results.push(entry);
            }
        }
        res.json({ success: true, results });
    } catch (error) {
        console.error('❌ Erreur recherche NAS:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/recent', async (req, res) => {
    try {
        const cache = req.app.locals.cache;
        const results = cache.nasCache.filter(e => e.Type === 'Projet' && e.IsRecent === true);
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/open', async (req, res) => {
    try {
        const { path: folderPath } = req.body;
        const { exec } = require('child_process');
        console.log(`📂 Ouverture: ${folderPath}`);
        exec(`explorer "${folderPath}"`);
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur ouverture:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
