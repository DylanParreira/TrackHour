const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

router.get('/sync/status', async (req, res) => {
    try {
        const cache = req.app.locals.cache;
        const sourceFilePath = path.join(__dirname, '..', 'Ressources', 'CodeSourceGestionProjet.txt');
        let sourceExists = false;
        try { await fs.access(sourceFilePath); sourceExists = true; } catch (error) {}
        res.json({ success: true, cached: cache.projectsCache.length > 0, projectsCount: cache.projectsCache.length, lastSync: cache.lastSyncTime, sourceExists, sourcePath: sourceFilePath });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/sync', async (req, res) => {
    try {
        const { extractDashboardProjects } = require('../lib/extractDashboardProjects');
        const cache = req.app.locals.cache;
        const sourceFilePath = path.join(__dirname, '..', 'Ressources', 'CodeSourceGestionProjet.txt');
        console.log(`🔄 Synchronisation projets web...`);
        try { await fs.access(sourceFilePath); } catch (error) {
            return res.status(404).json({ success: false, error: 'Fichier source introuvable', path: sourceFilePath });
        }
        const htmlContent = await fs.readFile(sourceFilePath, 'utf-8');
        const projects = extractDashboardProjects(htmlContent);
        if (projects.length === 0) return res.status(400).json({ success: false, error: 'Aucun projet trouvé' });
        cache.projectsCache = projects;
        cache.lastSyncTime = new Date();
        await cache.saveProjectsCache();
        console.log(`✅ Sync terminée: ${projects.length} projets`);
        res.json({ success: true, projectsCount: projects.length, syncTime: cache.lastSyncTime });
    } catch (error) {
        console.error('❌ Erreur sync projets web:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/find/:numeroAF', async (req, res) => {
    try {
        const { numeroAF } = req.params;
        const cache = req.app.locals.cache;
        if (cache.projectsCache.length === 0) return res.json({ success: true, found: false, message: 'Cache vide' });
        const project = cache.projectsCache.find(p => p.numeroAffaire.toLowerCase() === numeroAF.toLowerCase());
        if (project) res.json({ success: true, found: true, project });
        else res.json({ success: true, found: false, message: 'Projet non trouvé' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/all', async (req, res) => {
    try {
        const { client, statut, bloque } = req.query;
        const cache = req.app.locals.cache;
        let projects = [...cache.projectsCache];
        if (client) projects = projects.filter(p => p.client.toLowerCase().includes(client.toLowerCase()));
        if (statut) projects = projects.filter(p => p.statut === statut);
        if (bloque === 'true') projects = projects.filter(p => p.estBloque);
        res.json({ success: true, projects, totalCount: cache.projectsCache.length, filteredCount: projects.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/open-source', async (req, res) => {
    try {
        const { exec } = require('child_process');
        const sourceFilePath = path.join(__dirname, '..', 'Ressources', 'CodeSourceGestionProjet.txt');
        console.log(`📂 Ouverture: ${sourceFilePath}`);
        exec(`notepad "${sourceFilePath}"`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Erreur ouverture:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/tasks/extract', async (req, res) => {
    try {
        const { extractProjectTasks } = require('../lib/extractProjectTasks');
        const { htmlContent, projectInfo, numeroAF } = req.body;
        if (!htmlContent) return res.status(400).json({ success: false, error: 'HTML manquant' });
        console.log(`🔄 Extraction tâches ${numeroAF || ''}...`);
        const projectData = extractProjectTasks(htmlContent);
        if (projectInfo) {
            projectData.projectInfo = projectInfo;
            console.log(`📋 Infos enrichies: Contacts ${projectInfo.contacts?.length||0}, Devis ${projectInfo.devis?.length||0}, Équipe ${projectInfo.equipe?.techniciens?.length||0}`);
        }
        projectData.lastUpdate = new Date().toLocaleString('fr-FR');
        const totalTasks = projectData.sections.reduce((acc, s) => acc + s.tasks.length, 0);
        const validatedTasks = projectData.sections.reduce((acc, s) => acc + s.tasks.filter(t => t.status === 'validated').length, 0);
        const completedTasks = projectData.sections.reduce((acc, s) => acc + s.tasks.filter(t => t.status === 'completed').length, 0);
        projectData.stats = { totalSections: projectData.sections.length, totalTasks, validatedTasks, completedTasks, pendingTasks: totalTasks - validatedTasks - completedTasks };
        console.log(`✅ Extraction: ${projectData.sections.length} sections, ${totalTasks} tâches`);
        const cache = req.app.locals.cache;
        if (projectData.numeroAffaire) {
            cache.tasksCache[projectData.numeroAffaire] = projectData;
            console.log(`💾 Projet ${projectData.numeroAffaire} en cache`);
            await cache.saveTasksCache();
        }
        res.json({ success: true, projectData });
    } catch (error) {
        console.error('❌ Erreur extraction:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/tasks/project/:numeroAF', async (req, res) => {
    try {
        const { numeroAF } = req.params;
        const cache = req.app.locals.cache;
        const projectData = cache.tasksCache[numeroAF];
        if (projectData) res.json({ success: true, found: true, projectData });
        else res.json({ success: true, found: false, message: 'Projet non en cache' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/tasks/list', async (req, res) => {
    try {
        const cache = req.app.locals.cache;
        const projects = Object.keys(cache.tasksCache).map(af => ({ numeroAF: af, projectName: cache.tasksCache[af].projectName, sectionsCount: cache.tasksCache[af].sections.length }));
        res.json({ success: true, projects });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
