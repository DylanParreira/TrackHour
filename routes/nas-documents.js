const express = require('express');
const router = express.Router();
const nasDocuments = require('../services/nas-documents');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * Routes API pour gérer les documents du NAS et les associations
 */

/**
 * POST /api/nas-documents/search-projects
 * Recherche des projets dans le NAS
 * Body: { searchTerm: string }
 */
router.post('/search-projects', async (req, res) => {
    try {
        const { searchTerm } = req.body;

        if (!searchTerm || searchTerm.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Le terme de recherche est requis'
            });
        }

        const nasPath = req.app.locals.getNasPath();
        console.log(`🔍 Recherche de projets NAS: "${searchTerm}"`);

        const projects = await nasDocuments.searchProjects(nasPath, searchTerm);

        console.log(`✅ ${projects.length} projet(s) trouvé(s)`);

        res.json({
            success: true,
            projects,
            count: projects.length
        });

    } catch (error) {
        console.error('❌ Erreur lors de la recherche de projets:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/nas-documents/associate
 * Associe un numeroAF à un projet NAS
 * Body: { numeroAF: string, projectData: { path, client, chantier, projet } }
 */
router.post('/associate', async (req, res) => {
    try {
        const { numeroAF, projectData } = req.body;

        if (!numeroAF || !projectData || !projectData.path) {
            return res.status(400).json({
                success: false,
                error: 'numeroAF et projectData (avec path) sont requis'
            });
        }

        const cache = req.app.locals.cache;
        cache.setNasAssociation(numeroAF, projectData);
        await cache.saveNasAssociations();

        console.log(`✅ Association créée: ${numeroAF} → ${projectData.path}`);

        res.json({
            success: true,
            message: 'Association créée avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur lors de l\'association:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/nas-documents/association/:numeroAF
 * Récupère l'association d'un numeroAF
 */
router.get('/association/:numeroAF', async (req, res) => {
    try {
        const { numeroAF } = req.params;
        const cache = req.app.locals.cache;

        const association = cache.getNasAssociation(numeroAF);

        if (association) {
            res.json({
                success: true,
                found: true,
                association
            });
        } else {
            res.json({
                success: true,
                found: false
            });
        }

    } catch (error) {
        console.error('❌ Erreur lors de la récupération de l\'association:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/nas-documents/association/:numeroAF
 * Supprime l'association d'un numeroAF
 */
router.delete('/association/:numeroAF', async (req, res) => {
    try {
        const { numeroAF } = req.params;
        const cache = req.app.locals.cache;

        cache.removeNasAssociation(numeroAF);
        await cache.saveNasAssociations();

        console.log(`🗑️ Association supprimée: ${numeroAF}`);

        res.json({
            success: true,
            message: 'Association supprimée'
        });

    } catch (error) {
        console.error('❌ Erreur lors de la suppression:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/nas-documents/browse/:numeroAF
 * Liste les dossiers et fichiers d'un dossier NAS pour navigation
 * Query params: folder (bus|plans|supervision|schemas), subPath
 */
router.get('/browse/:numeroAF', async (req, res) => {
    try {
        const { numeroAF } = req.params;
        const { folder = 'supervision', subPath = '' } = req.query;
        const cache = req.app.locals.cache;

        const association = cache.getNasAssociation(numeroAF);

        if (!association) {
            return res.json({
                success: false,
                message: 'Aucune association NAS configurée pour ce projet'
            });
        }

        // Définir le chemin racine selon le dossier demandé
        const folderPaths = {
            'bus': path.join(association.path, '1- Documentations', 'Bus'),
            'plans': path.join(association.path, '1- Documentations', 'Plans'),
            'supervision': path.join(association.path, '3- Supervision'),
            'schemas': path.join(association.path, '4- Schémas Electrique', 'PDF')
        };

        const basePath = folderPaths[folder];
        if (!basePath) {
            return res.json({
                success: false,
                message: 'Dossier invalide'
            });
        }

        const fullPath = path.join(basePath, subPath);

        console.log(`📂 Navigation dans ${folder}: ${fullPath}`);

        // Vérifier que le chemin existe
        try {
            await fs.access(fullPath);
        } catch (err) {
            return res.json({
                success: false,
                message: 'Dossier non trouvé'
            });
        }

        const entries = await fs.readdir(fullPath, { withFileTypes: true });

        const folders = [];
        const files = [];

        for (const entry of entries) {
            const entryPath = path.join(fullPath, entry.name);
            const stats = await fs.stat(entryPath);

            if (entry.isDirectory()) {
                folders.push({
                    name: entry.name,
                    path: path.join(subPath, entry.name).replace(/\\/g, '/'),
                    type: 'folder'
                });
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                files.push({
                    name: entry.name,
                    path: entryPath,
                    size: stats.size,
                    sizeFormatted: nasDocuments.formatFileSize(stats.size),
                    modified: stats.mtime,
                    modifiedFormatted: new Date(stats.mtime).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    extension: ext,
                    type: 'file'
                });
            }
        }

        // Trier : dossiers d'abord (alphabétique), puis fichiers (alphabétique)
        folders.sort((a, b) => a.name.localeCompare(b.name));
        files.sort((a, b) => a.name.localeCompare(b.name));

        res.json({
            success: true,
            currentPath: subPath || '/',
            folders: folders,
            files: files
        });

    } catch (error) {
        console.error('❌ Erreur navigation Supervision:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/nas-documents/documents/:numeroAF
 * Récupère les documents NAS pour un numeroAF (utilise l'association)
 */
router.get('/documents/:numeroAF', async (req, res) => {
    try {
        const { numeroAF } = req.params;
        const cache = req.app.locals.cache;

        const association = cache.getNasAssociation(numeroAF);

        if (!association) {
            return res.json({
                success: true,
                found: false,
                message: 'Aucune association NAS configurée pour ce projet'
            });
        }

        console.log(`📂 Récupération des documents pour: ${association.path}`);

        const documents = await nasDocuments.getProjectDocuments(association.path);

        // Formater la taille des fichiers
        const formatDocuments = (docs) => docs.map(doc => ({
            ...doc,
            sizeFormatted: nasDocuments.formatFileSize(doc.size),
            modifiedFormatted: new Date(doc.modified).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })
        }));

        const totalCount = documents.bus.length + documents.plans.length +
                          documents.supervision.length + documents.schemas.length;

        console.log(`✅ ${totalCount} document(s) trouvé(s)`);

        res.json({
            success: true,
            found: true,
            association,
            documents: {
                bus: formatDocuments(documents.bus),
                plans: formatDocuments(documents.plans),
                supervision: formatDocuments(documents.supervision),
                schemas: formatDocuments(documents.schemas)
            },
            totalCount
        });

    } catch (error) {
        console.error('❌ Erreur lors de la récupération des documents:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/nas-documents/open-file
 * Ouvre un fichier avec l'application par défaut
 * Body: { filePath: string }
 */
router.post('/open-file', async (req, res) => {
    try {
        const { filePath } = req.body;

        if (!filePath || filePath.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Le chemin du fichier est requis'
            });
        }

        console.log(`📄 Ouverture du fichier: ${filePath}`);

        // Utiliser start pour ouvrir le fichier avec l'application par défaut
        exec(`start "" "${filePath}"`, (error) => {
            if (error) {
                console.error('❌ Erreur lors de l\'ouverture du fichier:', error);
            }
        });

        res.json({ success: true });

    } catch (error) {
        console.error('❌ Erreur lors de l\'ouverture du fichier:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/nas-documents/open-folder
 * Ouvre un dossier dans l'Explorateur Windows
 * Body: { folderPath: string }
 */
router.post('/open-folder', async (req, res) => {
    try {
        const { folderPath } = req.body;

        if (!folderPath || folderPath.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Le chemin du dossier est requis'
            });
        }

        console.log(`📁 Ouverture du dossier: ${folderPath}`);

        exec(`explorer "${folderPath}"`, (error) => {
            if (error) {
                console.error('❌ Erreur lors de l\'ouverture du dossier:', error);
            }
        });

        res.json({ success: true });

    } catch (error) {
        console.error('❌ Erreur lors de l\'ouverture du dossier:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
