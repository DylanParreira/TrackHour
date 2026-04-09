const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const SHAREPOINT_FILE = path.join(__dirname, '..', 'sharepoint_links.json');

/**
 * Récupère l'URL SharePoint pour un projet
 * GET /api/sharepoint/:numeroAF
 */
router.get('/:numeroAF', async (req, res) => {
    try {
        const { numeroAF } = req.params;

        // Charger le fichier des liens SharePoint
        const data = await fs.readFile(SHAREPOINT_FILE, 'utf8');
        const links = JSON.parse(data);

        if (links[numeroAF]) {
            res.json({
                success: true,
                found: true,
                data: links[numeroAF]
            });
        } else {
            res.json({
                success: true,
                found: false,
                message: `Aucun lien SharePoint configuré pour ${numeroAF}`
            });
        }
    } catch (error) {
        console.error('Erreur récupération lien SharePoint:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Récupère tous les liens SharePoint
 * GET /api/sharepoint/all
 */
router.get('/all/list', async (req, res) => {
    try {
        const data = await fs.readFile(SHAREPOINT_FILE, 'utf8');
        const links = JSON.parse(data);

        res.json({
            success: true,
            links
        });
    } catch (error) {
        console.error('Erreur récupération liens SharePoint:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Ajoute ou met à jour un lien SharePoint pour un projet
 * POST /api/sharepoint/set
 * Body: { numeroAF, url, fileName }
 */
router.post('/set', async (req, res) => {
    try {
        const { numeroAF, url, fileName } = req.body;

        if (!numeroAF || !url) {
            return res.json({
                success: false,
                error: 'numeroAF et url sont requis'
            });
        }

        // Convertir l'URL normale en URL d'embed
        let embedUrl = url;
        if (url.includes('action=default')) {
            embedUrl = url.replace('action=default', 'action=embedview')
                .replace('&mobileredirect=true', '')
                + '&wdAllowInteractivity=False&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True';
        } else if (!url.includes('action=embedview')) {
            // Si l'URL ne contient pas d'action, ajouter embedview
            embedUrl = url + (url.includes('?') ? '&' : '?') + 'action=embedview&wdAllowInteractivity=False&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True';
        }

        // Charger les liens existants
        let links = {};
        try {
            const data = await fs.readFile(SHAREPOINT_FILE, 'utf8');
            links = JSON.parse(data);
        } catch (err) {
            // Fichier n'existe pas encore, on crée un objet vide
            console.log('Création du fichier sharepoint_links.json');
        }

        // Ajouter/mettre à jour le lien
        links[numeroAF] = {
            url,
            embedUrl,
            fileName: fileName || `Suivi-de-Chantier-${numeroAF}.xlsm`,
            addedDate: links[numeroAF]?.addedDate || new Date().toISOString().split('T')[0],
            lastUpdated: new Date().toISOString().split('T')[0]
        };

        // Sauvegarder
        await fs.writeFile(SHAREPOINT_FILE, JSON.stringify(links, null, 2), 'utf8');

        res.json({
            success: true,
            message: `Lien SharePoint configuré pour ${numeroAF}`,
            data: links[numeroAF]
        });
    } catch (error) {
        console.error('Erreur sauvegarde lien SharePoint:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Supprime un lien SharePoint pour un projet
 * DELETE /api/sharepoint/:numeroAF
 */
router.delete('/:numeroAF', async (req, res) => {
    try {
        const { numeroAF } = req.params;

        // Charger les liens existants
        const data = await fs.readFile(SHAREPOINT_FILE, 'utf8');
        const links = JSON.parse(data);

        if (links[numeroAF]) {
            delete links[numeroAF];
            await fs.writeFile(SHAREPOINT_FILE, JSON.stringify(links, null, 2), 'utf8');

            res.json({
                success: true,
                message: `Lien SharePoint supprimé pour ${numeroAF}`
            });
        } else {
            res.json({
                success: false,
                message: `Aucun lien SharePoint pour ${numeroAF}`
            });
        }
    } catch (error) {
        console.error('Erreur suppression lien SharePoint:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
