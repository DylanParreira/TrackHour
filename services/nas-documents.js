const fs = require('fs').promises;
const path = require('path');

/**
 * Service pour gérer l'accès aux documents dans le NAS
 * Gère les dossiers :
 * - 1- Documentations/Bus
 * - 1- Documentations/Plans
 * - 3- Supervision (fichiers uniquement)
 * - 4- Schémas Electrique/PDF
 */

const DOCUMENT_FOLDERS = {
    BUS: '1- Documentations/Bus',
    PLANS: '1- Documentations/Plans',
    SUPERVISION: '3- Supervision',
    SCHEMAS: '4- Schémas Electrique/PDF'
};

// Extensions de fichiers supportées
const SUPPORTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.dwg', '.dxf', '.png', '.jpg', '.jpeg', '.zip', '.rar'];

/**
 * Recherche les dossiers de projet dans le NAS correspondant à un terme de recherche
 * @param {string} nasPath - Chemin racine du NAS
 * @param {string} searchTerm - Terme de recherche (numéro AF ou nom de projet)
 * @returns {Promise<Array>} Liste des projets trouvés avec leurs chemins
 */
async function searchProjects(nasPath, searchTerm) {
    const results = [];
    const searchUpper = searchTerm.toUpperCase();

    try {
        const clients = await fs.readdir(nasPath, { withFileTypes: true });

        for (const client of clients) {
            if (!client.isDirectory()) continue;

            const clientPath = path.join(nasPath, client.name);

            try {
                const chantiers = await fs.readdir(clientPath, { withFileTypes: true });

                for (const chantier of chantiers) {
                    if (!chantier.isDirectory()) continue;

                    const chantierPath = path.join(clientPath, chantier.name);

                    // Vérifier si le dossier correspond à un projet AF
                    if (isProjectFolder(chantier.name) && matchesSearch(chantier.name, searchUpper)) {
                        results.push({
                            client: client.name,
                            chantier: 'Root',
                            projet: chantier.name,
                            path: chantierPath
                        });
                    }

                    // Scanner les sous-dossiers
                    try {
                        const subFolders = await fs.readdir(chantierPath, { withFileTypes: true });

                        for (const subFolder of subFolders) {
                            if (!subFolder.isDirectory()) continue;

                            if (isProjectFolder(subFolder.name) && matchesSearch(subFolder.name, searchUpper)) {
                                results.push({
                                    client: client.name,
                                    chantier: chantier.name,
                                    projet: subFolder.name,
                                    path: path.join(chantierPath, subFolder.name)
                                });
                            }
                        }
                    } catch (err) {
                        // Ignorer les erreurs d'accès aux sous-dossiers
                    }
                }
            } catch (err) {
                // Ignorer les erreurs d'accès aux dossiers clients
            }
        }
    } catch (error) {
        console.error('Erreur lors de la recherche de projets:', error);
        throw error;
    }

    return results;
}

/**
 * Vérifie si un nom de dossier correspond à un projet
 */
function isProjectFolder(folderName) {
    return [
        /^AF/i,
        /^-\s*AF/i,
        /^A\d/i,
        /AF\d/i
    ].some(pattern => pattern.test(folderName));
}

/**
 * Vérifie si un nom de projet correspond au terme de recherche
 */
function matchesSearch(projectName, searchTermUpper) {
    const projectUpper = projectName.toUpperCase();

    // Recherche directe
    if (projectUpper.includes(searchTermUpper)) {
        return true;
    }

    // Recherche par parties (espaces, tirets, underscores)
    const parts = projectName.split(/[\s\-_]+/);
    return parts.some(part => part.toUpperCase().includes(searchTermUpper));
}

/**
 * Récupère les documents disponibles pour un projet spécifique
 * @param {string} projectPath - Chemin complet du projet
 * @returns {Promise<Object>} Object contenant les documents par catégorie
 */
async function getProjectDocuments(projectPath) {
    const documents = {
        bus: [],
        plans: [],
        supervision: [],
        schemas: []
    };

    try {
        // Vérifier si le dossier projet existe
        await fs.access(projectPath);

        // Scanner le dossier Bus
        const busPath = path.join(projectPath, '1- Documentations', 'Bus');
        try {
            const busFiles = await scanDocumentFolder(busPath, true);
            documents.bus = busFiles;
            console.log(`✅ Bus: ${busFiles.length} fichiers trouvés`);
        } catch (err) {
            console.log(`⚠️ Dossier Bus non trouvé: ${busPath}`);
        }

        // Scanner le dossier Plans
        const plansPath = path.join(projectPath, '1- Documentations', 'Plans');
        try {
            const plansFiles = await scanDocumentFolder(plansPath, true);
            documents.plans = plansFiles;
            console.log(`✅ Plans: ${plansFiles.length} fichiers trouvés`);
        } catch (err) {
            console.log(`⚠️ Dossier Plans non trouvé: ${plansPath}`);
        }

        // Scanner le dossier Supervision (fichiers uniquement, pas de récursion)
        const supervisionPath = path.join(projectPath, '3- Supervision');
        try {
            const supervisionFiles = await scanDocumentFolder(supervisionPath, false);
            documents.supervision = supervisionFiles;
            console.log(`✅ Supervision: ${supervisionFiles.length} fichiers trouvés`);
        } catch (err) {
            console.log(`⚠️ Dossier Supervision non trouvé: ${supervisionPath}`);
        }

        // Scanner le dossier Schémas Électrique > PDF
        const schemasPath = path.join(projectPath, '4- Schémas Electrique', 'PDF');
        try {
            const schemasFiles = await scanDocumentFolder(schemasPath, true);
            documents.schemas = schemasFiles;
            console.log(`✅ Schémas: ${schemasFiles.length} fichiers trouvés`);
        } catch (err) {
            console.log(`⚠️ Dossier Schémas/PDF non trouvé: ${schemasPath}`);
        }

    } catch (error) {
        console.error('Erreur lors de la récupération des documents:', error);
        throw error;
    }

    return documents;
}

/**
 * Scanner un dossier et retourner la liste des fichiers avec leurs métadonnées
 * @param {string} folderPath - Chemin du dossier à scanner
 * @param {boolean} recursive - Scanner récursivement les sous-dossiers
 * @returns {Promise<Array>} Liste des fichiers trouvés
 */
async function scanDocumentFolder(folderPath, recursive = false) {
    const files = [];

    try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);

            if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();

                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    try {
                        const stats = await fs.stat(fullPath);

                        files.push({
                            name: entry.name,
                            path: fullPath,
                            extension: ext,
                            size: stats.size,
                            modified: stats.mtime,
                            type: getFileType(ext)
                        });
                    } catch (err) {
                        console.error(`Erreur lors de la lecture du fichier ${fullPath}:`, err);
                    }
                }
            } else if (entry.isDirectory() && recursive) {
                // Scanner récursivement les sous-dossiers
                try {
                    const subFiles = await scanDocumentFolder(fullPath, true);

                    // Ajouter le nom du sous-dossier au nom du fichier
                    subFiles.forEach(file => {
                        file.name = `${entry.name}/${file.name}`;
                        files.push(file);
                    });
                } catch (err) {
                    console.error(`Erreur lors du scan du sous-dossier ${fullPath}:`, err);
                }
            }
        }
    } catch (error) {
        throw error;
    }

    return files;
}

/**
 * Détermine le type de fichier basé sur l'extension
 */
function getFileType(extension) {
    const types = {
        '.pdf': 'PDF',
        '.doc': 'Word',
        '.docx': 'Word',
        '.xls': 'Excel',
        '.xlsx': 'Excel',
        '.txt': 'Texte',
        '.dwg': 'AutoCAD',
        '.dxf': 'AutoCAD',
        '.png': 'Image',
        '.jpg': 'Image',
        '.jpeg': 'Image',
        '.zip': 'Archive',
        '.rar': 'Archive'
    };

    return types[extension.toLowerCase()] || 'Autre';
}

/**
 * Formater la taille du fichier en format lisible
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
    searchProjects,
    getProjectDocuments,
    formatFileSize,
    DOCUMENT_FOLDERS
};
