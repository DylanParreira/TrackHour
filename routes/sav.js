const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const SAV_FILE = path.join(__dirname, '..', 'sav_records.json');

// Charger les fiches SAV depuis le fichier
async function loadSavRecords() {
    try {
        const content = await fs.readFile(SAV_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (err) {
        return [];
    }
}

// Sauvegarder les fiches SAV dans le fichier
async function saveSavRecords(records) {
    await fs.writeFile(SAV_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

/**
 * POST /api/sav
 * Créer une nouvelle fiche SAV
 * Body: { nomPrenom, telephone, chantier, chantierProjetId, demande }
 */
router.post('/', async (req, res) => {
    try {
        const { nomPrenom, telephone, chantier, chantierProjetId, demande } = req.body;

        if (!nomPrenom || !chantier || !demande) {
            return res.json({ success: false, error: 'Champs obligatoires manquants (nom prénom, chantier, demande)' });
        }

        const records = await loadSavRecords();

        const newRecord = {
            id: Date.now(),
            nomPrenom: nomPrenom.trim(),
            telephone: telephone ? telephone.trim() : null,
            chantier: chantier.trim(),
            chantierProjetId: chantierProjetId || null,
            demande: demande.trim(),
            date: new Date().toISOString(),
            partageMail: false,
            partageGestionProjet: false
        };

        records.push(newRecord);
        await saveSavRecords(records);

        console.log(`📋 Fiche SAV créée : ${newRecord.nomPrenom} - ${newRecord.chantier}`);

        res.json({ success: true, record: newRecord });
    } catch (error) {
        console.error('Erreur création SAV:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/sav/:id/partage
 * Marquer une fiche SAV comme partagée
 * Body: { type: 'mail' | 'gestion' }
 */
router.put('/:id/partage', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;

        const records = await loadSavRecords();
        const record = records.find(r => r.id === parseInt(id));

        if (!record) {
            return res.json({ success: false, error: 'Fiche SAV introuvable' });
        }

        if (type === 'mail') record.partageMail = true;
        if (type === 'gestion') record.partageGestionProjet = true;
        record.datePartage = new Date().toISOString();

        await saveSavRecords(records);

        console.log(`📤 Fiche SAV ${id} partagée par : ${type}`);
        res.json({ success: true, record });
    } catch (error) {
        console.error('Erreur partage SAV:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/sav
 * Récupérer toutes les fiches SAV
 */
router.get('/', async (req, res) => {
    try {
        const records = await loadSavRecords();
        res.json({ success: true, records });
    } catch (error) {
        console.error('Erreur récupération SAV:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/sav/chantier-search
 * Rechercher un chantier dans le cache NAS + projects web
 * Query: ?q=nomChantier
 */
router.get('/chantier-search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) {
            return res.json({ success: true, results: [] });
        }

        const cache = req.app.locals.cache;
        const searchText = q.trim().toLowerCase();
        const results = [];

        // Recherche dans le cache NAS
        if (cache.nasCache && cache.nasCache.length > 0) {
            const nasMatches = cache.nasCache.filter(item =>
                (item.Chantier && item.Chantier.toLowerCase().includes(searchText)) ||
                (item.Projet && item.Projet.toLowerCase().includes(searchText)) ||
                (item.Client && item.Client.toLowerCase().includes(searchText))
            ).slice(0, 10);

            for (const match of nasMatches) {
                // Chercher le projectId dans le cache projets web
                let projectId = null;
                if (match.Projet && cache.projectsCache && cache.projectsCache.length > 0) {
                    const webProject = cache.projectsCache.find(
                        p => p.numeroAffaire && p.numeroAffaire.toLowerCase() === match.Projet.toLowerCase()
                    );
                    if (webProject) {
                        projectId = webProject.projectId || null;
                    }
                }

                results.push({
                    chantier: match.Chantier || match.Projet,
                    projet: match.Projet || null,
                    client: match.Client || null,
                    projectId: projectId,
                    nasPath: match.Path || null,
                    lien: projectId ? `https://projets.applitec-automatisme.com/projects/${projectId}` : null
                });
            }
        }

        // Dédupliquer par nom de chantier
        const seen = new Set();
        const uniqueResults = results.filter(r => {
            const key = (r.chantier || '').toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        res.json({ success: true, results: uniqueResults });
    } catch (error) {
        console.error('Erreur recherche chantier:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
