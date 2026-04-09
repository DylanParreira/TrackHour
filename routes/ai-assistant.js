// Routes API pour l'Assistant IA
const express = require('express');
const router = express.Router();
const AIAssistant = require('../services/ai-assistant');

let assistant = null;

// Initialiser l'assistant quand on a le dataPath
function initAssistant(dataPath) {
    if (!assistant && dataPath) {
        assistant = new AIAssistant(dataPath);
        assistant.init().catch(err => console.error('Erreur init AI:', err));
        console.log('🤖 Assistant IA initialisé');
    }
    return assistant;
}

// Middleware pour vérifier que l'assistant est initialisé
function ensureAssistant(req, res, next) {
    const dataPath = req.app.locals.getDataPath();
    if (!dataPath) {
        return res.json({ success: false, error: 'Configuration requise' });
    }

    if (!assistant) {
        initAssistant(dataPath);
    }

    next();
}

// ========== ROUTES ==========

/**
 * POST /api/ai/analyze
 * Lance l'analyse complète de l'historique des tâches
 */
router.post('/analyze', ensureAssistant, async (req, res) => {
    try {
        console.log('🔍 Lancement de l\'analyse IA...');
        const result = await assistant.analyzeAllTasks();

        res.json({
            success: true,
            patterns: result.patterns,
            stats: result.stats,
            message: `Analyse terminée: ${result.stats.filesAnalyzed} fichiers analysés`
        });
    } catch (error) {
        console.error('Erreur analyse IA:', error);
        res.json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

/**
 * POST /api/ai/suggestions
 * Génère des suggestions pour un projet donné
 * Body: { projectData, currentTasks }
 */
router.post('/suggestions', ensureAssistant, async (req, res) => {
    try {
        const { projectData, currentTasks } = req.body;

        if (!projectData) {
            return res.json({ success: false, error: 'projectData requis' });
        }

        console.log(`💡 Génération de suggestions pour ${projectData.projectName}`);
        const suggestions = await assistant.generateSuggestions(projectData, currentTasks);

        res.json({
            success: true,
            suggestions,
            count: suggestions.length
        });
    } catch (error) {
        console.error('Erreur génération suggestions:', error);
        res.json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ai/email/generate
 * Génère un email basé sur un template
 * Body: { template, projectData, recipientData }
 */
router.post('/email/generate', ensureAssistant, async (req, res) => {
    try {
        const { template, projectData, recipientData } = req.body;

        if (!template || !projectData || !recipientData) {
            return res.json({ success: false, error: 'Paramètres manquants' });
        }

        console.log(`✉️ Génération d'email (template: ${template})`);
        const email = assistant.generateEmail(template, projectData, recipientData);

        res.json({
            success: true,
            email
        });
    } catch (error) {
        console.error('Erreur génération email:', error);
        res.json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ai/validate
 * Enregistre une validation/refus de suggestion
 * Body: { suggestionId, action, feedback }
 */
router.post('/validate', ensureAssistant, async (req, res) => {
    try {
        const { suggestionId, action, feedback } = req.body;

        if (!suggestionId || !action) {
            return res.json({ success: false, error: 'suggestionId et action requis' });
        }

        console.log(`📊 Validation enregistrée: ${suggestionId} - ${action}`);
        await assistant.recordValidation(suggestionId, action, feedback);

        res.json({
            success: true,
            message: 'Validation enregistrée'
        });
    } catch (error) {
        console.error('Erreur validation:', error);
        res.json({ success: false, error: error.message });
    }
});

/**
 * GET /api/ai/stats
 * Récupère les statistiques d'apprentissage de l'IA
 */
router.get('/stats', ensureAssistant, async (req, res) => {
    try {
        console.log('📊 Récupération des stats IA');
        const stats = await assistant.getStats();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Erreur récupération stats:', error);
        res.json({ success: false, error: error.message });
    }
});

/**
 * GET /api/ai/memory
 * Récupère la mémoire complète de l'IA (pour debug)
 */
router.get('/memory', ensureAssistant, async (req, res) => {
    try {
        res.json({
            success: true,
            memory: assistant.memory
        });
    } catch (error) {
        console.error('Erreur récupération mémoire:', error);
        res.json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ai/learn-from-notes
 * Analyse les notes de projets pour apprendre
 */
router.post('/learn-from-notes', ensureAssistant, async (req, res) => {
    try {
        const dataPath = req.app.locals.getDataPath();
        const notesPath = require('path').join(dataPath, 'project_notes.json');
        const fs = require('fs').promises;

        let notesData = [];
        try {
            const content = await fs.readFile(notesPath, 'utf8');
            notesData = JSON.parse(content);
        } catch (err) {
            console.log('Aucune note à analyser');
        }

        // Analyser les notes pour extraire des patterns
        const insights = {
            projectsWithNotes: notesData.length,
            totalNotes: notesData.reduce((sum, p) => sum + (p.notes?.length || 0), 0),
            averageNotesPerProject: 0
        };

        if (notesData.length > 0) {
            insights.averageNotesPerProject = insights.totalNotes / notesData.length;
        }

        // Enregistrer dans la mémoire IA
        assistant.memory.noteInsights = insights;
        await assistant.saveMemory();

        res.json({
            success: true,
            insights,
            message: 'Analyse des notes terminée'
        });
    } catch (error) {
        console.error('Erreur learn-from-notes:', error);
        res.json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ai/task-link/record
 * Enregistre une liaison entre une description et une tâche
 * Body: { description, numeroAF, taskName, sectionName, date }
 */
router.post('/task-link/record', ensureAssistant, async (req, res) => {
    try {
        const { description, numeroAF, taskName, sectionName, date } = req.body;

        if (!description || !numeroAF || !taskName || !sectionName) {
            return res.json({
                success: false,
                error: 'Paramètres manquants (description, numeroAF, taskName, sectionName requis)'
            });
        }

        console.log(`🔗 Enregistrement liaison: "${description}" → ${taskName} (${sectionName}) sur ${numeroAF}`);

        const link = await assistant.recordTaskLink(description, numeroAF, taskName, sectionName, date);

        res.json({
            success: true,
            link,
            message: 'Liaison enregistrée avec succès'
        });
    } catch (error) {
        console.error('Erreur task-link/record:', error);
        res.json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ai/task-link/find-similar
 * Trouve des suggestions basées sur les liaisons précédentes
 * Body: { description, numeroAF }
 */
router.post('/task-link/find-similar', ensureAssistant, async (req, res) => {
    try {
        const { description, numeroAF } = req.body;

        if (!description) {
            return res.json({ success: false, error: 'Description requise' });
        }

        console.log(`🔍 Recherche suggestions pour: "${description}"`);

        const suggestions = await assistant.findSimilarTaskLinks(description, numeroAF);

        res.json({
            success: true,
            suggestions,
            count: suggestions.length
        });
    } catch (error) {
        console.error('Erreur task-link/find-similar:', error);
        res.json({ success: false, error: error.message });
    }
});

/**
 * GET /api/ai/task-link/stats
 * Récupère les statistiques des liaisons
 */
router.get('/task-link/stats', ensureAssistant, async (req, res) => {
    try {
        const stats = assistant.getTaskLinkStats();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Erreur task-link/stats:', error);
        res.json({ success: false, error: error.message });
    }
});

/**
 * GET /api/ai/task-link/project/:numeroAF
 * Récupère toutes les liaisons pour un projet
 */
router.get('/task-link/project/:numeroAF', ensureAssistant, async (req, res) => {
    try {
        const { numeroAF } = req.params;
        const links = await assistant.getTaskLinksForProject(numeroAF);

        res.json({
            success: true,
            links,
            count: links.length
        });
    } catch (error) {
        console.error('Erreur task-link/project:', error);
        res.json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ai/task-link/check-project
 * Vérifie si un projet a des tâches similaires à l'historique
 * Body: { projectData }
 */
router.post('/task-link/check-project', ensureAssistant, async (req, res) => {
    try {
        const { projectData } = req.body;

        if (!projectData) {
            return res.json({ success: false, error: 'projectData requis' });
        }

        console.log(`🔍 Vérification suggestions pour projet ${projectData.projectName}`);

        const taskSuggestions = await assistant.findSimilarTasksInProject(projectData);
        const hasAnysuggestions = Object.keys(taskSuggestions).length > 0;

        res.json({
            success: true,
            hasSuggestions: hasAnysuggestions,
            taskSuggestions,
            count: Object.keys(taskSuggestions).length
        });
    } catch (error) {
        console.error('Erreur task-link/check-project:', error);
        res.json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ai/feedback
 * Enregistre le feedback utilisateur sur une suggestion
 * Body: { currentTaskName, suggestedTaskName, feedbackType, timestamp }
 */
router.post('/feedback', ensureAssistant, async (req, res) => {
    try {
        const { currentTaskName, suggestedTaskName, feedbackType, timestamp } = req.body;

        if (!currentTaskName || !suggestedTaskName || !feedbackType) {
            return res.json({
                success: false,
                error: 'Paramètres manquants (currentTaskName, suggestedTaskName, feedbackType requis)'
            });
        }

        console.log(`📊 Feedback: ${currentTaskName} ← ${suggestedTaskName} = ${feedbackType}`);

        await assistant.recordFeedback(currentTaskName, suggestedTaskName, feedbackType, timestamp);

        res.json({
            success: true,
            message: 'Feedback enregistré'
        });
    } catch (error) {
        console.error('Erreur feedback:', error);
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;
module.exports.initAssistant = initAssistant;
