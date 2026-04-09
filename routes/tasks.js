const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

router.get('/:year/:month/:day', async (req, res) => {
    try {
        const DATA_PATH = req.app.locals.getDataPath();
        if (!DATA_PATH) {
            return res.status(400).json({ success: false, error: 'Configuration manquante' });
        }

        const { year, month, day } = req.params;
        const filePath = path.join(DATA_PATH, year, month, `${day}.txt`);

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim());
            const tasks = [];

            for (const line of lines) {
                const match = line.trim().match(/^(\d{2}:\d{2})\s+(.+)$/);
                if (match) {
                    tasks.push({ time: match[1], description: match[2] });
                }
            }

            res.json({ success: true, tasks });
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.json({ success: true, tasks: [] });
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/:year/:month/:day', async (req, res) => {
    try {
        const DATA_PATH = req.app.locals.getDataPath();
        if (!DATA_PATH) {
            return res.status(400).json({ success: false, error: 'Configuration manquante' });
        }

        const { year, month, day } = req.params;
        const { tasks } = req.body;

        const dirPath = path.join(DATA_PATH, year, month);
        const filePath = path.join(dirPath, `${day}.txt`);

        await fs.mkdir(dirPath, { recursive: true });
        const content = '\uFEFF' + tasks.map(t => `${t.time} ${t.description}`).join('\n');
        await fs.writeFile(filePath, content, 'utf-8');

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/extract', async (req, res) => {
    try {
        const { extractProjectTasks } = require('../lib/extractProjectTasks');
        const { htmlContent, projectInfo, numeroAF } = req.body;
        if (!htmlContent) return res.status(400).json({ success: false, error: 'HTML manquant' });
        console.log(`🔄 Extraction tâches ${numeroAF || ''}...`);
        const projectData = extractProjectTasks(htmlContent);
        if (projectInfo) {
            projectData.projectInfo = projectInfo;
            console.log(`📋 Infos enrichies: Contacts ${projectInfo.contacts?.length||0}, Devis ${projectInfo.devis?.length||0}, Équipe ${projectInfo.equipe?.techniciens?.length||0}`);

            // 🆕 Sauvegarder l'URL SharePoint si elle existe
            if (projectInfo.sharepointUrl && projectData.numeroAffaire) {
                try {
                    const sharepointLinksPath = path.join(__dirname, '..', 'sharepoint_links.json');
                    let sharepointLinks = {};

                    // Charger le fichier existant
                    try {
                        const content = await fs.readFile(sharepointLinksPath, 'utf-8');
                        sharepointLinks = JSON.parse(content);
                    } catch (err) {
                        // Fichier n'existe pas encore, on crée un objet vide
                        console.log('📝 Création du fichier sharepoint_links.json');
                    }

                    // Extraire le nom du fichier depuis l'URL
                    const urlObj = new URL(projectInfo.sharepointUrl);
                    const fileParam = urlObj.searchParams.get('file');
                    const fileName = fileParam || 'Document SharePoint';

                    // Générer l'embedUrl
                    const embedUrl = projectInfo.sharepointUrl.replace('action=default', 'action=embedview') + '&wdAllowInteractivity=False&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True';

                    // Ajouter/Mettre à jour l'entrée
                    sharepointLinks[projectData.numeroAffaire] = {
                        url: projectInfo.sharepointUrl,
                        embedUrl: embedUrl,
                        fileName: fileName,
                        addedDate: new Date().toISOString().split('T')[0]
                    };

                    // Sauvegarder
                    await fs.writeFile(sharepointLinksPath, JSON.stringify(sharepointLinks, null, 2), 'utf-8');
                    console.log(`📊 URL SharePoint sauvegardée pour ${projectData.numeroAffaire}`);
                } catch (spError) {
                    console.error('⚠️ Erreur sauvegarde SharePoint:', spError.message);
                }
            }
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

router.post('/search', async (req, res) => {
    try {
        const DATA_PATH = req.app.locals.getDataPath();
        if (!DATA_PATH) {
            return res.status(400).json({ success: false, error: 'Configuration manquante' });
        }

        const { keywords, category, dateStart, dateEnd } = req.body;
        const results = [];
        const start = dateStart ? new Date(dateStart) : new Date(2020, 0, 1);
        const end = dateEnd ? new Date(dateEnd) : new Date();

        const years = await fs.readdir(DATA_PATH).catch(() => []);

        for (const year of years) {
            if (!/^\d{4}$/.test(year)) continue;

            const yearPath = path.join(DATA_PATH, year);
            const months = await fs.readdir(yearPath).catch(() => []);

            for (const month of months) {
                if (!/^\d{2}$/.test(month)) continue;

                const monthPath = path.join(yearPath, month);
                const days = await fs.readdir(monthPath).catch(() => []);

                for (const dayFile of days) {
                    if (!dayFile.endsWith('.txt')) continue;

                    const day = dayFile.replace('.txt', '');
                    const fileDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

                    if (fileDate < start || fileDate > end) continue;

                    const filePath = path.join(monthPath, dayFile);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const lines = content.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim());

                    for (const line of lines) {
                        const match = line.trim().match(/^(\d{2}:\d{2})\s+(.+)$/);
                        if (!match) continue;

                        const time = match[1];
                        const description = match[2];

                        if (keywords && !description.toLowerCase().includes(keywords.toLowerCase())) continue;
                        if (category && !description.includes(category)) continue;

                        results.push({
                            date: `${day}/${month}/${year}`,
                            time,
                            description,
                            year,
                            month,
                            day
                        });
                    }
                }
            }
        }

        res.json({ success: true, results });
    } catch (error) {
        console.error('Erreur recherche:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
