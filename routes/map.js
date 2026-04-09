const express = require('express');
const { geocodeAddress, searchAddress } = require('../services/geocoding');
const router = express.Router();

console.log('🗺️ Module routes/map.js chargé');

router.get('/sites', async (req, res) => {
    try {
        const cache = req.app.locals.cache;
        res.json({ success: true, sites: cache.mapSites });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/sites', async (req, res) => {
    try {
        const { name, client, address, numeroAF, status, remoteAccess, notes } = req.body;
        if (!name || !client || !address) return res.status(400).json({ success: false, error: 'Nom, client et adresse requis' });
        console.log(`🔍 Géocodage: ${address}`);
        const geocode = await geocodeAddress(address);
        if (!geocode) return res.status(400).json({ success: false, error: 'Adresse introuvable' });
        const cache = req.app.locals.cache;
        const newSite = { id: Date.now(), name, client, address, latitude: geocode.latitude, longitude: geocode.longitude, numeroAF: numeroAF || '', status: status || 'online', remoteAccess: remoteAccess || '', notes: notes || '', createdAt: new Date().toISOString() };
        cache.mapSites.push(newSite);
        await cache.saveMapSites();
        console.log(`✅ Site ajouté: ${name}`);
        res.json({ success: true, site: newSite });
    } catch (error) {
        console.error('❌ Erreur création site:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/sites/:id', async (req, res) => {
    try {
        const siteId = parseInt(req.params.id);
        const { name, client, address, numeroAF, status, remoteAccess, notes } = req.body;
        const cache = req.app.locals.cache;
        const siteIndex = cache.mapSites.findIndex(s => s.id === siteId);
        if (siteIndex === -1) return res.status(404).json({ success: false, error: 'Site non trouvé' });
        const oldSite = cache.mapSites[siteIndex];
        let latitude = oldSite.latitude;
        let longitude = oldSite.longitude;
        if (address !== oldSite.address) {
            console.log(`🔍 Re-géocodage: ${address}`);
            const geocode = await geocodeAddress(address);
            if (!geocode) return res.status(400).json({ success: false, error: 'Nouvelle adresse introuvable' });
            latitude = geocode.latitude;
            longitude = geocode.longitude;
        }
        cache.mapSites[siteIndex] = { ...oldSite, name, client, address, latitude, longitude, numeroAF: numeroAF || '', status: status || 'online', remoteAccess: remoteAccess || '', notes: notes || '', updatedAt: new Date().toISOString() };
        await cache.saveMapSites();
        console.log(`✅ Site modifié: ${name}`);
        res.json({ success: true, site: cache.mapSites[siteIndex] });
    } catch (error) {
        console.error('❌ Erreur modification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/sites/:id', async (req, res) => {
    try {
        const siteId = parseInt(req.params.id);
        const cache = req.app.locals.cache;
        const siteIndex = cache.mapSites.findIndex(s => s.id === siteId);
        if (siteIndex === -1) return res.status(404).json({ success: false, error: 'Site non trouvé' });
        const deletedSite = cache.mapSites[siteIndex];
        cache.mapSites.splice(siteIndex, 1);
        await cache.saveMapSites();
        console.log(`✅ Site supprimé: ${deletedSite.name}`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Erreur suppression:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/check-status', async (req, res) => {
    try {
        const { remoteAccess } = req.body;
        if (!remoteAccess) return res.json({ success: true, status: 'offline', message: 'Aucun lien' });
        if (remoteAccess.startsWith('http://') || remoteAccess.startsWith('https://')) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                const response = await fetch(remoteAccess, { method: 'HEAD', signal: controller.signal }).catch(() => null);
                clearTimeout(timeout);
                if (response && response.ok) return res.json({ success: true, status: 'online', message: 'Connexion réussie' });
                else return res.json({ success: true, status: 'offline', message: 'Site inaccessible' });
            } catch (error) {
                return res.json({ success: true, status: 'offline', message: 'Erreur: ' + error.message });
            }
        } else {
            return res.json({ success: true, status: 'checking', message: 'Vérification non disponible' });
        }
    } catch (error) {
        console.error('❌ Erreur vérification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/check-all-status', async (req, res) => {
    try {
        const cache = req.app.locals.cache;
        const updates = [];
        for (const site of cache.mapSites) {
            if (site.remoteAccess && (site.remoteAccess.startsWith('http://') || site.remoteAccess.startsWith('https://'))) {
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 3000);
                    const response = await fetch(site.remoteAccess, { method: 'HEAD', signal: controller.signal }).catch(() => null);
                    clearTimeout(timeout);
                    const newStatus = (response && response.ok) ? 'online' : 'offline';
                    if (site.status !== newStatus) {
                        site.status = newStatus;
                        site.lastChecked = new Date().toISOString();
                        updates.push({ id: site.id, name: site.name, status: newStatus });
                    }
                } catch (error) {
                    if (site.status !== 'offline') {
                        site.status = 'offline';
                        site.lastChecked = new Date().toISOString();
                        updates.push({ id: site.id, name: site.name, status: 'offline' });
                    }
                }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (updates.length > 0) await cache.saveMapSites();
        console.log(`✅ Vérification: ${cache.mapSites.length} sites, ${updates.length} MAJ`);
        res.json({ success: true, checked: cache.mapSites.length, updates });
    } catch (error) {
        console.error('❌ Erreur vérification globale:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.checkUrl = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: 'URL manquante' });
        if (!url.startsWith('http://') && !url.startsWith('https://')) return res.json({ success: true, online: false, message: 'Non HTTP' });
        const urlParsed = new URL(url);
        const isHttps = urlParsed.protocol === 'https:';
        const protocol = isHttps ? require('https') : require('http');
        const online = await new Promise((resolve) => {
            const options = { hostname: urlParsed.hostname, port: urlParsed.port || (isHttps ? 443 : 80), path: urlParsed.pathname + urlParsed.search, method: 'HEAD', timeout: 5000, rejectUnauthorized: false, headers: { 'User-Agent': 'TrackHour/1.0' } };
            const request = protocol.request(options, (response) => resolve(response.statusCode >= 200 && response.statusCode < 400));
            request.on('error', () => resolve(false));
            request.on('timeout', () => { request.destroy(); resolve(false); });
            request.end();
        });
        res.json({ success: true, online: online });
    } catch (error) {
        console.error('Erreur vérification URL:', error);
        res.json({ success: true, online: false });
    }
};

router.searchAddress = async (req, res) => {
    try {
        const { client, siteName, numeroAF } = req.body;
        if (!client || !siteName) return res.status(400).json({ success: false, error: 'Client et nom requis' });
        console.log(`🔍 Recherche adresse: ${siteName}`);
        const result = await searchAddress(client, siteName, numeroAF);
        if (result) {
            console.log(`✅ Adresse: ${result.address}`);
            res.json({ success: true, ...result });
        } else {
            console.log(`⚠️  Aucune adresse trouvée`);
            res.json({ success: true, address: null, message: 'Aucune adresse trouvée' });
        }
    } catch (error) {
        console.error('❌ Erreur recherche adresse:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Recherche du numéro d'affaire dans les caches
router.post('/search-by-name', async (req, res) => {
    try {
        const { siteName, client } = req.body;
        if (!siteName) return res.status(400).json({ success: false, error: 'Nom du site requis' });

        console.log(`🔍 Recherche numéro d'affaire pour: ${siteName}`);
        const cache = req.app.locals.cache;

        // Nettoyer le nom pour la recherche
        const cleanName = siteName.trim().toLowerCase();

        // 1. Recherche dans projets_web_cache (plus fiable)
        if (cache.projectsCache && cache.projectsCache.projects) {
            for (const project of cache.projectsCache.projects) {
                const projectNameClean = (project.projectName || '').toLowerCase();
                const clientNameClean = (project.client || '').toLowerCase().replace(/[.\-\s]/g, '');
                const clientSearchClean = client ? client.toLowerCase().replace(/[.\-\s]/g, '') : '';

                // Recherche par nom exact ou partiel
                if (projectNameClean.includes(cleanName) || cleanName.includes(projectNameClean)) {
                    // Vérifier aussi le client si fourni (en ignorant points, tirets et espaces)
                    if (!client || clientNameClean.includes(clientSearchClean) || clientSearchClean.includes(clientNameClean)) {
                        console.log(`✅ Trouvé dans projets_web_cache: ${project.numeroAffaire}`);
                        return res.json({
                            success: true,
                            found: true,
                            numeroAF: project.numeroAffaire,
                            projectName: project.projectName,
                            client: project.client,
                            source: 'web_cache',
                            statut: project.statut
                        });
                    }
                }
            }
        }

        // 2. Recherche dans nas_cache (extraction depuis le champ "Projet")
        if (cache.nasCache && Array.isArray(cache.nasCache)) {
            for (const entry of cache.nasCache) {
                const chantierClean = (entry.Chantier || '').toLowerCase();
                const clientNasClean = (entry.Client || '').toLowerCase().replace(/[.\-\s]/g, '');
                const clientSearchClean = client ? client.toLowerCase().replace(/[.\-\s]/g, '') : '';

                // Recherche par nom de chantier
                if (chantierClean.includes(cleanName) || cleanName.includes(chantierClean)) {
                    // Vérifier aussi le client si fourni (en ignorant points, tirets et espaces)
                    if (!client || clientNasClean.includes(clientSearchClean) || clientSearchClean.includes(clientNasClean)) {
                        // Extraire le numéro AF du champ "Projet"
                        const projetField = entry.Projet || '';
                        const afMatch = projetField.match(/AF\d{7}|A\d{7}/i);

                        if (afMatch) {
                            console.log(`✅ Trouvé dans nas_cache: ${afMatch[0]}`);
                            return res.json({
                                success: true,
                                found: true,
                                numeroAF: afMatch[0].toUpperCase(),
                                projectName: entry.Chantier,
                                client: entry.Client,
                                source: 'nas_cache',
                                path: entry.Path
                            });
                        }
                    }
                }
            }
        }

        // 3. Recherche dans projets_tasks_cache (si les autres ont échoué)
        if (cache.tasksCache && typeof cache.tasksCache === 'object') {
            for (const [numeroAF, project] of Object.entries(cache.tasksCache)) {
                const projectNameClean = (project.projectName || '').toLowerCase();
                const clientNameClean = (project.client || '').toLowerCase().replace(/[.\-\s]/g, '');
                const clientSearchClean = client ? client.toLowerCase().replace(/[.\-\s]/g, '') : '';

                if (projectNameClean.includes(cleanName) || cleanName.includes(projectNameClean)) {
                    if (!client || clientNameClean.includes(clientSearchClean) || clientSearchClean.includes(clientNameClean)) {
                        console.log(`✅ Trouvé dans tasks_cache: ${numeroAF}`);
                        return res.json({
                            success: true,
                            found: true,
                            numeroAF: numeroAF,
                            projectName: project.projectName,
                            client: project.client,
                            source: 'tasks_cache'
                        });
                    }
                }
            }
        }

        console.log(`⚠️  Aucun numéro d'affaire trouvé pour: ${siteName}`);
        res.json({ success: true, found: false, message: 'Aucun numéro d\'affaire trouvé dans les caches' });

    } catch (error) {
        console.error('❌ Erreur recherche numéro d\'affaire:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Enregistrer une adresse trouvée pour un projet dans le cache tasks
router.post('/save-discovered-address', async (req, res) => {
    console.log('🔥 Route /save-discovered-address appelée!');
    try {
        const { numeroAF, siteName, address } = req.body;
        if (!siteName || !address) {
            return res.status(400).json({ success: false, error: 'Site name and address required' });
        }

        console.log(`💾 Enregistrement adresse découverte: ${siteName} -> ${address}`);

        const cache = req.app.locals.cache;

        // Si on a un numéro d'affaire, mettre à jour le cache tasks
        if (numeroAF && cache.tasksCache && cache.tasksCache[numeroAF]) {
            if (!cache.tasksCache[numeroAF].extractedData) {
                cache.tasksCache[numeroAF].extractedData = {};
            }
            cache.tasksCache[numeroAF].extractedData.adresseChantier = address;
            await cache.saveTasksCache();
            console.log(`✅ Adresse "${address}" ajoutée au cache tasks pour ${numeroAF} dans extractedData.adresseChantier`);
        } else if (numeroAF) {
            console.warn(`⚠️ Le projet ${numeroAF} n'existe pas encore dans le cache tasks. L'adresse sera sauvegardée lors de la prochaine extraction.`);
        }

        // Sinon, créer une entrée dans le cache tasks avec le nom du site
        if (!numeroAF) {
            // Essayer de créer un identifiant unique basé sur le nom
            const tempId = `TEMP_${siteName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
            if (!cache.tasksCache[tempId]) {
                cache.tasksCache[tempId] = {
                    projectName: siteName,
                    extractedData: {
                        adresseChantier: address
                    },
                    isTemporary: true,
                    discoveredAt: new Date().toISOString()
                };
                await cache.saveTasksCache();
                console.log(`✅ Adresse sauvegardée temporairement sous ${tempId}`);
            }
        }

        res.json({ success: true, message: 'Adresse enregistrée' });
    } catch (error) {
        console.error('❌ Erreur enregistrement adresse:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
module.exports.checkUrl = router.checkUrl;
module.exports.searchAddress = router.searchAddress;
