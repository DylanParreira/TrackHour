const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

function parseNotes(content) {
    const notes = [];
    const lines = content.split('\n');
    let currentNote = null;
    for (const line of lines) {
        const headerMatch = line.match(/^\[(\d{2}\/\d{2}\/\d{4})\s+(.+?)\]$/);
        if (headerMatch) {
            if (currentNote) notes.push(currentNote);
            currentNote = { date: headerMatch[1], timeRange: headerMatch[2], text: '' };
        } else if (currentNote && line.trim()) {
            currentNote.text += (currentNote.text ? '\n' : '') + line;
        }
    }
    if (currentNote) notes.push(currentNote);
    return notes;
}

router.get('/all', async (req, res) => {
    try {
        const DATA_PATH = req.app.locals.getDataPath();
        if (!DATA_PATH) return res.status(400).json({ success: false, error: 'Configuration manquante' });

        const suiviPath = path.join(DATA_PATH, 'SUIVI_PROJETS');
        const projects = [];

        try {
            const projectFolders = await fs.readdir(suiviPath, { withFileTypes: true });
            for (const folder of projectFolders) {
                if (!folder.isDirectory()) continue;
                const notesPath = path.join(suiviPath, folder.name, 'notes.txt');
                try {
                    const content = await fs.readFile(notesPath, 'utf-8');
                    const notes = parseNotes(content);

                    // Extraire le numeroAF du nom de dossier (avant le " - " s'il existe)
                    let numeroAF = folder.name;
                    const dashIndex = folder.name.indexOf(' - ');
                    if (dashIndex !== -1) {
                        numeroAF = folder.name.substring(0, dashIndex);
                    }
                    // Nettoyer les tirets et espaces au début/fin
                    numeroAF = numeroAF.replace(/^[-\s]+|[-\s]+$/g, '').trim();

                    projects.push({
                        numeroAF: numeroAF,
                        folderName: folder.name,
                        notes,
                        totalNotes: notes.length
                    });
                } catch (error) {}
            }
        } catch (error) {}

        res.json({ success: true, projects });
    } catch (error) {
        console.error('Erreur récupération notes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/:numeroAF', async (req, res) => {
    try {
        const DATA_PATH = req.app.locals.getDataPath();
        if (!DATA_PATH) return res.status(400).json({ success: false, error: 'Configuration manquante' });

        const { numeroAF } = req.params;
        const suiviPath = path.join(DATA_PATH, 'SUIVI_PROJETS');

        // Chercher le dossier qui commence par le numeroAF
        let folderName = null;
        try {
            const folders = await fs.readdir(suiviPath, { withFileTypes: true });
            for (const folder of folders) {
                if (folder.isDirectory() && folder.name.startsWith(numeroAF + ' ')) {
                    folderName = folder.name;
                    break;
                } else if (folder.isDirectory() && folder.name === numeroAF) {
                    folderName = folder.name;
                    break;
                }
            }
        } catch (error) {
            // Le dossier SUIVI_PROJETS n'existe pas
        }

        if (!folderName) {
            return res.json({ success: true, numeroAF, notes: [] });
        }

        const notesPath = path.join(suiviPath, folderName, 'notes.txt');

        try {
            const content = await fs.readFile(notesPath, 'utf-8');
            const notes = parseNotes(content);
            res.json({ success: true, numeroAF, notes });
        } catch (error) {
            if (error.code === 'ENOENT') res.json({ success: true, numeroAF, notes: [] });
            else throw error;
        }
    } catch (error) {
        console.error('Erreur récupération notes projet:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/save', async (req, res) => {
    try {
        const DATA_PATH = req.app.locals.getDataPath();
        if (!DATA_PATH) return res.status(400).json({ success: false, error: 'Configuration manquante' });

        let { numeroAF, nomChantier, date, timeRange, note } = req.body;
        if (!numeroAF || !date || !timeRange || !note) return res.status(400).json({ success: false, error: 'Données manquantes' });

        // Nettoyer le numéro d'affaire: remplacer les espaces multiples par un seul espace
        numeroAF = numeroAF.replace(/\s+/g, ' ').trim().toUpperCase();

        // Créer le nom de dossier: numeroAF - nomChantier (ou juste numeroAF si pas de nom)
        let folderName = numeroAF;
        if (nomChantier && nomChantier.trim()) {
            // Nettoyer le nom du chantier
            const cleanNomChantier = nomChantier.trim().replace(/[<>:"|?*]/g, '_');
            folderName = `${numeroAF} - ${cleanNomChantier}`;
        }

        // Vérifier si un dossier existe déjà pour ce numéro d'affaire
        const suiviPath = path.join(DATA_PATH, 'SUIVI_PROJETS');
        let existingFolder = null;
        try {
            const folders = await fs.readdir(suiviPath, { withFileTypes: true });
            for (const folder of folders) {
                if (folder.isDirectory() && folder.name.startsWith(numeroAF + ' ')) {
                    existingFolder = folder.name;
                    break;
                } else if (folder.isDirectory() && folder.name === numeroAF) {
                    existingFolder = folder.name;
                    break;
                }
            }
        } catch (error) {
            // Le dossier SUIVI_PROJETS n'existe pas encore
        }

        // Utiliser le dossier existant ou créer un nouveau
        const projectPath = path.join(DATA_PATH, 'SUIVI_PROJETS', existingFolder || folderName);
        const notesPath = path.join(projectPath, 'notes.txt');

        await fs.mkdir(projectPath, { recursive: true });

        let existingContent = '';
        try { existingContent = await fs.readFile(notesPath, 'utf-8'); } catch (error) {}

        const newNote = `\n[${date} ${timeRange}]\n${note}\n`;
        await fs.writeFile(notesPath, existingContent + newNote, 'utf-8');

        res.json({ success: true, message: 'Note sauvegardée' });
    } catch (error) {
        console.error('Erreur sauvegarde note:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/update', async (req, res) => {
    try {
        const DATA_PATH = req.app.locals.getDataPath();
        if (!DATA_PATH) return res.status(400).json({ success: false, error: 'Configuration manquante' });

        const { numeroAF, noteIndex, newNote } = req.body;
        if (!numeroAF || noteIndex === undefined || !newNote) return res.status(400).json({ success: false, error: 'Données manquantes' });

        // Chercher le dossier qui commence par le numeroAF
        const suiviPath = path.join(DATA_PATH, 'SUIVI_PROJETS');
        let folderName = null;
        try {
            const folders = await fs.readdir(suiviPath, { withFileTypes: true });
            for (const folder of folders) {
                if (folder.isDirectory() && folder.name.startsWith(numeroAF + ' ')) {
                    folderName = folder.name;
                    break;
                } else if (folder.isDirectory() && folder.name === numeroAF) {
                    folderName = folder.name;
                    break;
                }
            }
        } catch (error) {
            return res.status(404).json({ success: false, error: 'Projet non trouvé' });
        }

        if (!folderName) {
            return res.status(404).json({ success: false, error: 'Projet non trouvé' });
        }

        const notesPath = path.join(suiviPath, folderName, 'notes.txt');
        const content = await fs.readFile(notesPath, 'utf-8');
        const notes = parseNotes(content);

        if (noteIndex < 0 || noteIndex >= notes.length) return res.status(400).json({ success: false, error: 'Index invalide' });

        notes[noteIndex].text = newNote;
        const newContent = notes.map(n => `[${n.date} ${n.timeRange}]\n${n.text}\n`).join('\n');
        await fs.writeFile(notesPath, newContent, 'utf-8');

        res.json({ success: true, message: 'Note modifiée' });
    } catch (error) {
        console.error('Erreur modification note:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/delete', async (req, res) => {
    try {
        const DATA_PATH = req.app.locals.getDataPath();
        if (!DATA_PATH) return res.status(400).json({ success: false, error: 'Configuration manquante' });

        const { numeroAF, noteIndex } = req.body;
        if (!numeroAF || noteIndex === undefined) return res.status(400).json({ success: false, error: 'Données manquantes' });

        // Chercher le dossier qui commence par le numeroAF
        const suiviPath = path.join(DATA_PATH, 'SUIVI_PROJETS');
        let folderName = null;
        try {
            const folders = await fs.readdir(suiviPath, { withFileTypes: true });
            for (const folder of folders) {
                if (folder.isDirectory() && folder.name.startsWith(numeroAF + ' ')) {
                    folderName = folder.name;
                    break;
                } else if (folder.isDirectory() && folder.name === numeroAF) {
                    folderName = folder.name;
                    break;
                }
            }
        } catch (error) {
            return res.status(404).json({ success: false, error: 'Projet non trouvé' });
        }

        if (!folderName) {
            return res.status(404).json({ success: false, error: 'Projet non trouvé' });
        }

        const notesPath = path.join(suiviPath, folderName, 'notes.txt');
        const content = await fs.readFile(notesPath, 'utf-8');
        const notes = parseNotes(content);

        if (noteIndex < 0 || noteIndex >= notes.length) return res.status(400).json({ success: false, error: 'Index invalide' });

        notes.splice(noteIndex, 1);
        const newContent = notes.map(n => `[${n.date} ${n.timeRange}]\n${n.text}\n`).join('\n');
        await fs.writeFile(notesPath, newContent, 'utf-8');

        res.json({ success: true, message: 'Note supprimée' });
    } catch (error) {
        console.error('Erreur suppression note:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
