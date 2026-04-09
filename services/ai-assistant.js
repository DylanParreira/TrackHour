// TrackHour AI Assistant - Moteur d'apprentissage et de suggestions
// Ce module implémente un assistant IA qui apprend des habitudes de l'utilisateur

const fs = require('fs').promises;
const path = require('path');

class AIAssistant {
    constructor(dataPath) {
        this.dataPath = dataPath;
        this.memoryPath = path.join(dataPath, 'ai_memory.json');
        this.memory = {
            patterns: {},           // Patterns détectés (séquences de tâches, durées moyennes)
            validations: [],        // Historique des validations/refus utilisateur
            preferences: {},        // Préférences apprises
            emailTemplates: [],     // Templates d'emails personnalisés
            taskSequences: {},      // Séquences de tâches fréquentes par projet
            timeEstimates: {}       // Estimations de temps par type de tâche
        };
    }

    async init() {
        try {
            const data = await fs.readFile(this.memoryPath, 'utf8');
            this.memory = JSON.parse(data);
            console.log('✅ Mémoire IA chargée');
        } catch (error) {
            console.log('📝 Nouvelle mémoire IA créée');
            await this.saveMemory();
        }
    }

    async saveMemory() {
        await fs.writeFile(this.memoryPath, JSON.stringify(this.memory, null, 2));
    }

    // ========== ANALYSE DES PATTERNS ==========

    /**
     * Analyse l'historique complet des tâches pour détecter des patterns
     */
    async analyzeAllTasks() {
        try {
            const years = await fs.readdir(this.dataPath);
            const patterns = {
                taskDurations: {},      // Durées moyennes par type de tâche
                taskSequences: {},      // Séquences fréquentes
                workingHours: {},       // Heures de travail préférées
                projectTypes: {}        // Types de projets et leurs caractéristiques
            };

            let filesAnalyzed = 0;
            let filesSkipped = 0;

            for (const year of years) {
                if (!/^\d{4}$/.test(year)) continue;

                try {
                    const yearPath = path.join(this.dataPath, year);
                    const stat = await fs.stat(yearPath);
                    if (!stat.isDirectory()) continue;

                    const months = await fs.readdir(yearPath);

                    for (const month of months) {
                        try {
                            const monthPath = path.join(yearPath, month);
                            const monthStat = await fs.stat(monthPath);
                            if (!monthStat.isDirectory()) continue;

                            const days = await fs.readdir(monthPath);

                            for (const day of days) {
                                try {
                                    const filePath = path.join(monthPath, day);
                                    const fileStat = await fs.stat(filePath);

                                    // Ignorer les dossiers et fichiers non .json
                                    if (fileStat.isDirectory() || !day.endsWith('.json')) {
                                        continue;
                                    }

                                    const content = await fs.readFile(filePath, 'utf8');

                                    // Vérifier que le contenu n'est pas vide
                                    if (!content || content.trim().length === 0) {
                                        filesSkipped++;
                                        continue;
                                    }

                                    const tasks = JSON.parse(content);

                                    // Vérifier que tasks est un tableau et n'est pas vide
                                    if (!Array.isArray(tasks) || tasks.length === 0) {
                                        filesSkipped++;
                                        continue;
                                    }

                                    this._analyzeDay(tasks, patterns);
                                    filesAnalyzed++;
                                } catch (error) {
                                    // Ignorer les fichiers problématiques
                                    filesSkipped++;
                                    console.log(`⚠️ Fichier ignoré: ${day} (${error.message})`);
                                }
                            }
                        } catch (error) {
                            console.log(`⚠️ Mois ignoré: ${month} (${error.message})`);
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Année ignorée: ${year} (${error.message})`);
                }
            }

            console.log(`✅ Analyse terminée: ${filesAnalyzed} fichiers analysés, ${filesSkipped} ignorés`);

            this.memory.patterns = patterns;
            await this.saveMemory();

            return {
                patterns,
                stats: {
                    filesAnalyzed,
                    filesSkipped
                }
            };
        } catch (error) {
            console.error('Erreur analyse patterns:', error);
            throw error;
        }
    }

    _analyzeDay(tasks, patterns) {
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const parsed = this._parseTaskDescription(task.description);

            // Analyser la durée si on a une tâche suivante
            if (i < tasks.length - 1) {
                const duration = this._calculateDuration(task.time, tasks[i + 1].time);
                const key = parsed.category || 'NO_CATEGORY';

                if (!patterns.taskDurations[key]) {
                    patterns.taskDurations[key] = { total: 0, count: 0, samples: [] };
                }

                patterns.taskDurations[key].total += duration;
                patterns.taskDurations[key].count++;
                patterns.taskDurations[key].samples.push({
                    description: parsed.description,
                    duration,
                    date: tasks[0].time // Approximatif
                });
            }

            // Analyser les séquences (2 tâches consécutives)
            if (i < tasks.length - 1) {
                const nextTask = tasks[i + 1];
                const nextParsed = this._parseTaskDescription(nextTask.description);
                const sequenceKey = `${parsed.category || 'NONE'}_${nextParsed.category || 'NONE'}`;

                patterns.taskSequences[sequenceKey] = (patterns.taskSequences[sequenceKey] || 0) + 1;
            }

            // Analyser les heures de travail
            const hour = parseInt(task.time.split(':')[0]);
            patterns.workingHours[hour] = (patterns.workingHours[hour] || 0) + 1;
        }
    }

    _parseTaskDescription(description) {
        const categories = ['TRJ', 'ADM', 'CL', 'DEP', 'ET', 'GTC', 'MSE', 'PR', 'RPL', 'SAV', 'SC', 'TAR', 'STAG', 'CONGE', 'INFO', 'COMM'];
        const parts = description.trim().split(' ');
        const lastPart = parts[parts.length - 1];

        if (categories.includes(lastPart)) {
            return {
                description: parts.slice(0, -1).join(' '),
                category: lastPart
            };
        }

        return { description, category: null };
    }

    _calculateDuration(time1, time2) {
        const [h1, m1] = time1.split(':').map(Number);
        const [h2, m2] = time2.split(':').map(Number);
        return (h2 * 60 + m2) - (h1 * 60 + m1);
    }

    // ========== SUGGESTIONS INTELLIGENTES ==========

    /**
     * Génère des suggestions pour un projet donné
     */
    async generateSuggestions(projectData, currentTasks = []) {
        const suggestions = [];

        // 1. ANALYSE INTELLIGENTE : Prochaines étapes logiques
        const nextSteps = this._predictNextSteps(projectData, currentTasks);
        suggestions.push(...nextSteps);

        // 2. EMAILS CONTEXTUELS
        const emailSuggestions = this._generateEmailSuggestions(projectData);
        suggestions.push(...emailSuggestions);

        // 3. RAPPELS AUTOMATIQUES basés sur les patterns
        const reminders = this._generateReminders(projectData);
        suggestions.push(...reminders);

        // 4. OPTIMISATIONS de temps
        const optimizations = this._suggestOptimizations(projectData, currentTasks);
        suggestions.push(...optimizations);

        // 5. ALERTES sur blocages potentiels
        const alerts = this._detectPotentialIssues(projectData);
        suggestions.push(...alerts);

        return suggestions;
    }

    _predictNextSteps(projectData, currentTasks) {
        const suggestions = [];
        const sections = projectData.sections || [];

        // Analyser les tâches terminées vs en cours
        let hasCompletedTasks = false;
        let hasPendingTasks = false;
        let lastCompletedSection = null;

        for (const section of sections) {
            const completed = section.tasks.filter(t => t.status === 'completed' || t.status === 'validated').length;
            const total = section.tasks.length;

            if (completed === total && total > 0) {
                hasCompletedTasks = true;
                lastCompletedSection = section.name;
            } else if (completed > 0 && completed < total) {
                hasPendingTasks = true;

                // Suggérer de finir la section en cours
                suggestions.push({
                    type: 'action',
                    priority: 'high',
                    action: 'focus_section',
                    title: `Terminer "${section.name}"`,
                    description: `${completed}/${total} tâches terminées. Finissez cette section avant de passer à autre chose !`,
                    data: { section: section.name, progress: (completed / total * 100).toFixed(0) }
                });
            }
        }

        // Prédire la prochaine étape basée sur les patterns
        if (lastCompletedSection && this.memory.patterns.taskSequences) {
            const commonNext = this._findCommonNextTask(lastCompletedSection);
            if (commonNext) {
                suggestions.push({
                    type: 'insight',
                    priority: 'medium',
                    title: `Prochaine étape suggérée : ${commonNext}`,
                    description: `Basé sur vos projets passés, cette tâche vient généralement après "${lastCompletedSection}"`,
                    data: { suggestion: commonNext }
                });
            }
        }

        return suggestions;
    }

    _generateEmailSuggestions(projectData) {
        const suggestions = [];
        const { projectInfo, extractedData } = projectData;

        if (!projectInfo || !extractedData || !extractedData.contacts || extractedData.contacts.length === 0) {
            return suggestions;
        }

        const { statut, avancement } = projectInfo;
        const contacts = extractedData.contacts;

        // Email selon le statut
        if (statut === 'En cours' && avancement >= 50) {
            suggestions.push({
                type: 'email',
                priority: 'medium',
                action: 'send_progress_update',
                title: `Point d'avancement : ${avancement}%`,
                description: `Informer ${contacts[0].name} que le projet avance bien`,
                data: {
                    to: contacts[0].email,
                    toName: contacts[0].name,
                    template: 'progress_update',
                    progress: avancement
                }
            });
        }

        if (statut === 'Fin de projet' || avancement >= 95) {
            suggestions.push({
                type: 'email',
                priority: 'high',
                action: 'send_completion',
                title: '🎉 Projet terminé !',
                description: `Prévenir ${contacts[0].name} que le projet est prêt`,
                data: {
                    to: contacts[0].email,
                    toName: contacts[0].name,
                    template: 'project_completion'
                }
            });
        }

        // Suggestion de sauvegarde
        if (avancement >= 80 && statut !== 'Fin de projet') {
            suggestions.push({
                type: 'email',
                priority: 'high',
                action: 'send_backup',
                title: '💾 Envoyer la sauvegarde',
                description: `Le projet est à ${avancement}%, pensez à envoyer la sauvegarde à ${contacts[0].name}`,
                data: {
                    to: contacts[0].email,
                    toName: contacts[0].name,
                    template: 'backup_reminder'
                }
            });
        }

        return suggestions;
    }

    _generateReminders(projectData) {
        const suggestions = [];
        const { projectInfo, sections } = projectData;

        // Rappel si projet bloqué
        if (projectInfo?.estBloque) {
            suggestions.push({
                type: 'alert',
                priority: 'high',
                title: '⚠️ Projet bloqué',
                description: 'Ce projet est marqué comme bloqué. Vérifiez ce qui pose problème.',
                data: { blocked: true }
            });
        }

        // Rappel si beaucoup de tâches terminées non validées
        if (sections) {
            let unvalidatedCount = 0;
            for (const section of sections) {
                unvalidatedCount += section.tasks.filter(t => t.status === 'completed' && !t.validatedDate).length;
            }

            if (unvalidatedCount > 3) {
                suggestions.push({
                    type: 'action',
                    priority: 'medium',
                    action: 'validate_tasks',
                    title: `${unvalidatedCount} tâches à valider`,
                    description: 'Pensez à valider vos tâches terminées sur le site de gestion',
                    data: { count: unvalidatedCount }
                });
            }
        }

        return suggestions;
    }

    _suggestOptimizations(projectData, currentTasks) {
        const suggestions = [];

        // Analyser le temps passé vs temps estimé
        if (this.memory.patterns.taskDurations) {
            const avgDurations = this.memory.patterns.taskDurations;

            // Suggérer de faire les tâches courtes d'abord
            const shortTasks = [];
            for (const [category, data] of Object.entries(avgDurations)) {
                const avgMinutes = data.total / data.count;
                if (avgMinutes < 60) {
                    shortTasks.push({ category, avgMinutes: Math.round(avgMinutes) });
                }
            }

            if (shortTasks.length > 0) {
                suggestions.push({
                    type: 'insight',
                    priority: 'low',
                    title: '⚡ Optimisation : tâches rapides',
                    description: `Vous avez des tâches rapides (${shortTasks.map(t => t.category).join(', ')}). Faites-les en premier !`,
                    data: { shortTasks }
                });
            }
        }

        return suggestions;
    }

    _detectPotentialIssues(projectData) {
        const suggestions = [];
        const { projectInfo, extractedData } = projectData;

        // Alerte si pas de contact
        if (!extractedData?.contacts || extractedData.contacts.length === 0) {
            suggestions.push({
                type: 'alert',
                priority: 'medium',
                title: '📧 Aucun contact enregistré',
                description: 'Aucun contact n\'est associé à ce projet. Ajoutez-en un pour pouvoir communiquer.',
                data: { noContact: true }
            });
        }

        // Alerte si date de livraison approche
        if (projectInfo?.dateLivraison) {
            const deliveryDate = new Date(projectInfo.dateLivraison);
            const now = new Date();
            const daysUntilDelivery = Math.ceil((deliveryDate - now) / (1000 * 60 * 60 * 24));

            if (daysUntilDelivery <= 7 && daysUntilDelivery > 0 && projectInfo.avancement < 90) {
                suggestions.push({
                    type: 'alert',
                    priority: 'high',
                    title: `⏰ Livraison dans ${daysUntilDelivery} jours !`,
                    description: `Le projet n'est qu'à ${projectInfo.avancement}%. Accélérez le rythme !`,
                    data: { daysRemaining: daysUntilDelivery, progress: projectInfo.avancement }
                });
            }
        }

        return suggestions;
    }

    _findCommonNextTask(lastCompletedSection) {
        // Logique simple pour l'instant
        const commonSequences = {
            'Étude': 'Programmation',
            'Programmation': 'Test',
            'Test': 'Mise en service',
            'Mise en service': 'Validation'
        };

        return commonSequences[lastCompletedSection] || null;
    }

    async _findSimilarProjects(projectName) {
        // Rechercher dans l'historique des projets similaires
        // Pour l'instant, on retourne un tableau vide, à implémenter avec l'historique réel
        return [];
    }

    _estimateProjectTime(projectData) {
        if (!projectData.sections) return null;

        const totalTasks = projectData.sections.reduce((sum, s) => sum + s.tasks.length, 0);
        const completedTasks = projectData.sections.reduce((sum, s) =>
            sum + s.tasks.filter(t => t.status === 'completed' || t.status === 'validated').length, 0);

        if (completedTasks === 0) return null;

        // Estimation très basique pour l'instant
        const avgTimePerTask = 60; // 1h par tâche par défaut
        const remainingTasks = totalTasks - completedTasks;
        const estimatedMinutes = remainingTasks * avgTimePerTask;

        return {
            remainingTasks,
            estimatedMinutes,
            formatted: `${Math.floor(estimatedMinutes / 60)}h${estimatedMinutes % 60}`,
            samplesCount: 0
        };
    }

    // ========== GÉNÉRATEUR D'EMAILS ==========

    /**
     * Génère un email basé sur un template et les données du projet
     */
    generateEmail(template, projectData, recipientData) {
        const templates = {
            progress_update: {
                subject: `Avancement ${projectData.projectName} - ${projectData.projectInfo?.avancement}%`,
                body: `Bonjour ${recipientData.toName},

Je vous fais un point rapide sur l'avancement du projet ${projectData.projectName}.

📊 État actuel : ${projectData.projectInfo?.avancement}% terminé
${this._getTasksSummary(projectData)}

${projectData.extractedData?.adresseChantier ? `📍 Site : ${projectData.extractedData.adresseChantier}\n` : ''}
${projectData.projectInfo?.dateLivraison ? `📅 Livraison prévue : ${projectData.projectInfo.dateLivraison}\n` : ''}

Le projet avance bien et devrait être livré dans les délais.

Restant à votre disposition,
Cordialement`
            },

            project_completion: {
                subject: `✅ Projet terminé - ${projectData.projectName}`,
                body: `Bonjour ${recipientData.toName},

J'ai le plaisir de vous informer que le projet ${projectData.projectName} est maintenant terminé ! 🎉

${projectData.extractedData?.adresseChantier ? `📍 Site : ${projectData.extractedData.adresseChantier}\n` : ''}

Prochaines étapes :
- Validation finale de votre côté
- Formation si nécessaire
- Documentation complète disponible

N'hésitez pas à me contacter pour la moindre question ou pour planifier la livraison.

Cordialement`
            },

            backup_reminder: {
                subject: `💾 Sauvegarde ${projectData.projectName}`,
                body: `Bonjour ${recipientData.toName},

Veuillez trouver ci-joint la sauvegarde complète du projet ${projectData.projectName}.

📋 Contenu de la sauvegarde :
- Programme complet de l'installation
- Configuration système
- Documentation technique

${projectData.extractedData?.adresseChantier ? `📍 Site : ${projectData.extractedData.adresseChantier}\n` : ''}

⚠️ Important : Conservez cette sauvegarde en lieu sûr !

Merci de me confirmer la bonne réception.

Cordialement`
            },

            status_update: {
                subject: `Point de situation - ${projectData.projectName}`,
                body: `Bonjour ${recipientData.toName},

Voici un point de situation sur le projet ${projectData.projectName}.

État actuel :
- Avancement : ${projectData.projectInfo?.avancement || 'N/A'}%
- Statut : ${projectData.projectInfo?.statut || 'En cours'}
${this._getTasksSummary(projectData)}

${projectData.extractedData?.adresseChantier ? `📍 Site : ${projectData.extractedData.adresseChantier}\n` : ''}

Je reste disponible pour tout complément d'information.

Cordialement`
            }
        };

        const selectedTemplate = templates[template] || templates.status_update;

        return {
            to: recipientData.to,
            subject: selectedTemplate.subject,
            body: selectedTemplate.body,
            generatedAt: new Date().toISOString()
        };
    }

    _getTasksSummary(projectData) {
        if (!projectData.sections || projectData.sections.length === 0) {
            return '';
        }

        let completed = 0;
        let total = 0;

        for (const section of projectData.sections) {
            for (const task of section.tasks) {
                total++;
                if (task.status === 'completed' || task.status === 'validated') {
                    completed++;
                }
            }
        }

        return `- Tâches réalisées : ${completed}/${total}`;
    }

    // ========== MÉMORISATION DES VALIDATIONS ==========

    /**
     * Enregistre une validation/refus de suggestion
     */
    async recordValidation(suggestionId, action, feedback = null) {
        this.memory.validations.push({
            suggestionId,
            action, // 'accepted', 'rejected', 'modified'
            feedback,
            timestamp: new Date().toISOString()
        });

        await this.saveMemory();

        // Mettre à jour les préférences en fonction du feedback
        this._updatePreferences(suggestionId, action);
    }

    // ========== APPRENTISSAGE DES LIAISONS TÂCHES ==========

    /**
     * Enregistre une liaison entre une description de travail et une tâche de projet
     * @param {string} description - Ce que l'utilisateur a fait (ex: "Installation des coffrets")
     * @param {string} numeroAF - Numéro du projet (ex: "AF240123")
     * @param {string} taskName - Nom de la tâche liée (ex: "Installation matériel")
     * @param {string} sectionName - Nom de la section (ex: "Électricité")
     * @param {string} date - Date de la liaison
     */
    async recordTaskLink(description, numeroAF, taskName, sectionName, date = null) {
        if (!this.memory.taskLinks) {
            this.memory.taskLinks = [];
        }

        const link = {
            description: description.trim().toLowerCase(),
            numeroAF,
            taskName,
            sectionName,
            date: date || new Date().toISOString(),
            normalizedDescription: this._normalizeText(description)
        };

        this.memory.taskLinks.push(link);
        await this.saveMemory();

        console.log('📝 Liaison enregistrée:', link);
        return link;
    }

    /**
     * Trouve des suggestions basées sur les liaisons précédentes
     * Recherche par similarité entre NOMS DE TÂCHES (pas descriptions)
     * Filtre les suggestions avec feedback négatif
     * @param {string} taskName - Nom de la tâche actuelle (ex: "XML Trane")
     * @param {string} numeroAF - Projet actuel (optionnel)
     * @returns {Array} - Suggestions trouvées (comment vous avez accompli cette tâche)
     */
    async findSimilarTaskLinks(taskName, numeroAF = null) {
        if (!this.memory.taskLinks || this.memory.taskLinks.length === 0) {
            return [];
        }

        const normalizedInput = this._normalizeText(taskName);
        const suggestions = [];

        for (const link of this.memory.taskLinks) {
            // Ne pas suggérer depuis le même projet
            if (numeroAF && link.numeroAF === numeroAF) {
                continue;
            }

            // Comparer avec le NOM DE LA TÂCHE (pas la description de l'utilisateur)
            const normalizedTaskName = this._normalizeText(link.taskName);
            const similarity = this._calculateSimilarity(normalizedInput, normalizedTaskName);

            if (similarity > 0.5) { // Seuil de similarité à 50% pour les noms de tâches
                // Vérifier le feedback pour cette paire de tâches
                const feedbackScore = this._getFeedbackScore(taskName, link.taskName);

                // Ne pas suggérer si le score de feedback est trop négatif
                if (feedbackScore < -2) {
                    console.log(`❌ Suggestion filtrée (feedback négatif): ${link.taskName}`);
                    continue;
                }

                suggestions.push({
                    ...link,
                    similarity,
                    userDescription: link.description, // Ce que l'utilisateur a écrit
                    feedbackScore // Ajout du score pour débogage
                });
            }
        }

        // Trier par combinaison de similarité et feedback
        suggestions.sort((a, b) => {
            const scoreA = a.similarity + (a.feedbackScore * 0.1);
            const scoreB = b.similarity + (b.feedbackScore * 0.1);
            return scoreB - scoreA;
        });

        return suggestions; // Retourner TOUTES les suggestions (pas limité à 3)
    }

    /**
     * Trouve toutes les tâches similaires dans un projet donné
     * Pour afficher l'ampoule sur le bouton Assistance
     * @param {object} projectData - Données du projet avec sections et tâches
     * @returns {object} - Map des tâches avec leurs suggestions
     */
    async findSimilarTasksInProject(projectData) {
        if (!projectData || !projectData.sections) {
            return {};
        }

        const taskSuggestions = {};

        for (const section of projectData.sections) {
            for (const task of section.tasks) {
                const suggestions = await this.findSimilarTaskLinks(task.name, projectData.projectInfo?.numeroAF);

                if (suggestions.length > 0) {
                    taskSuggestions[task.name] = {
                        taskName: task.name,
                        sectionName: section.name,
                        suggestions: suggestions
                    };
                }
            }
        }

        return taskSuggestions;
    }

    /**
     * Normalise un texte pour la comparaison
     */
    _normalizeText(text) {
        return text
            .toLowerCase()
            .trim()
            // Supprimer les accents
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            // Supprimer la ponctuation
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
            // Remplacer les espaces multiples par un seul
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Calcule la similarité entre deux textes (algorithme simple basé sur les mots communs)
     */
    _calculateSimilarity(text1, text2) {
        const words1 = new Set(text1.split(' ').filter(w => w.length > 2));
        const words2 = new Set(text2.split(' ').filter(w => w.length > 2));

        if (words1.size === 0 || words2.size === 0) {
            return 0;
        }

        // Intersection des mots
        const intersection = new Set([...words1].filter(w => words2.has(w)));

        // Similarité de Jaccard
        const union = new Set([...words1, ...words2]);
        const jaccard = intersection.size / union.size;

        // Bonus si les mots clés importants sont présents
        const importantWords = ['installation', 'programmation', 'test', 'mise en service', 'etude', 'schema'];
        let bonus = 0;

        for (const word of importantWords) {
            if (words1.has(word) && words2.has(word)) {
                bonus += 0.1;
            }
        }

        return Math.min(jaccard + bonus, 1.0);
    }

    /**
     * Récupère toutes les liaisons pour un projet spécifique
     */
    async getTaskLinksForProject(numeroAF) {
        if (!this.memory.taskLinks) {
            return [];
        }

        return this.memory.taskLinks.filter(link => link.numeroAF === numeroAF);
    }

    /**
     * Récupère les statistiques des liaisons
     */
    getTaskLinkStats() {
        if (!this.memory.taskLinks) {
            return {
                totalLinks: 0,
                projectsWithLinks: 0,
                mostLinkedTasks: []
            };
        }

        const projectsSet = new Set(this.memory.taskLinks.map(l => l.numeroAF));
        const taskCounts = {};

        for (const link of this.memory.taskLinks) {
            const key = `${link.taskName} (${link.sectionName})`;
            taskCounts[key] = (taskCounts[key] || 0) + 1;
        }

        const mostLinkedTasks = Object.entries(taskCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([task, count]) => ({ task, count }));

        return {
            totalLinks: this.memory.taskLinks.length,
            projectsWithLinks: projectsSet.size,
            mostLinkedTasks
        };
    }

    // ========== SYSTÈME DE FEEDBACK ==========

    /**
     * Enregistre le feedback utilisateur sur une suggestion
     * @param {string} currentTaskName - Tâche actuelle
     * @param {string} suggestedTaskName - Tâche suggérée
     * @param {string} feedbackType - 'helpful' ou 'not_helpful'
     * @param {string} timestamp - Date du feedback
     */
    async recordFeedback(currentTaskName, suggestedTaskName, feedbackType, timestamp = null) {
        if (!this.memory.feedbacks) {
            this.memory.feedbacks = [];
        }

        const feedback = {
            currentTaskName: this._normalizeText(currentTaskName),
            suggestedTaskName: this._normalizeText(suggestedTaskName),
            feedbackType, // 'helpful' ou 'not_helpful'
            timestamp: timestamp || new Date().toISOString()
        };

        this.memory.feedbacks.push(feedback);
        await this.saveMemory();

        console.log(`✅ Feedback enregistré: ${currentTaskName} ← ${suggestedTaskName} = ${feedbackType}`);
        return feedback;
    }

    /**
     * Calcule le score de feedback pour une paire de tâches
     * Score positif = suggestions utiles
     * Score négatif = suggestions non pertinentes
     * @param {string} currentTaskName - Tâche actuelle
     * @param {string} suggestedTaskName - Tâche suggérée
     * @returns {number} - Score (-∞ à +∞)
     */
    _getFeedbackScore(currentTaskName, suggestedTaskName) {
        if (!this.memory.feedbacks || this.memory.feedbacks.length === 0) {
            return 0; // Neutre si pas de feedback
        }

        const normalizedCurrent = this._normalizeText(currentTaskName);
        const normalizedSuggested = this._normalizeText(suggestedTaskName);

        let score = 0;

        for (const feedback of this.memory.feedbacks) {
            // Vérifier si ce feedback concerne cette paire de tâches (ou similaires)
            const currentMatch = this._calculateSimilarity(normalizedCurrent, feedback.currentTaskName);
            const suggestedMatch = this._calculateSimilarity(normalizedSuggested, feedback.suggestedTaskName);

            // Si les deux tâches correspondent avec au moins 80% de similarité
            if (currentMatch > 0.8 && suggestedMatch > 0.8) {
                if (feedback.feedbackType === 'helpful') {
                    score += 1;
                } else if (feedback.feedbackType === 'not_helpful') {
                    score -= 1;
                }
            }
        }

        return score;
    }

    /**
     * Récupère les statistiques de feedback
     */
    getFeedbackStats() {
        if (!this.memory.feedbacks || this.memory.feedbacks.length === 0) {
            return {
                totalFeedbacks: 0,
                helpfulCount: 0,
                notHelpfulCount: 0,
                helpfulRate: 0
            };
        }

        const helpfulCount = this.memory.feedbacks.filter(f => f.feedbackType === 'helpful').length;
        const notHelpfulCount = this.memory.feedbacks.filter(f => f.feedbackType === 'not_helpful').length;
        const total = this.memory.feedbacks.length;

        return {
            totalFeedbacks: total,
            helpfulCount,
            notHelpfulCount,
            helpfulRate: total > 0 ? Math.round((helpfulCount / total) * 100) : 0
        };
    }

    _updatePreferences(suggestionId, action) {
        // Logique d'apprentissage : ajuster les scores de confiance
        // Pour l'instant, simple compteur
        if (!this.memory.preferences[suggestionId]) {
            this.memory.preferences[suggestionId] = { accepted: 0, rejected: 0 };
        }

        if (action === 'accepted') {
            this.memory.preferences[suggestionId].accepted++;
        } else if (action === 'rejected') {
            this.memory.preferences[suggestionId].rejected++;
        }
    }

    // ========== STATISTIQUES ==========

    async getStats() {
        const patterns = this.memory.patterns;

        return {
            totalValidations: this.memory.validations.length,
            acceptanceRate: this._calculateAcceptanceRate(),
            mostCommonTasks: this._getMostCommonTasks(patterns.taskDurations),
            peakWorkingHours: this._getPeakHours(patterns.workingHours),
            averageDurations: this._getAverageDurations(patterns.taskDurations)
        };
    }

    _calculateAcceptanceRate() {
        const total = this.memory.validations.length;
        if (total === 0) return 0;

        const accepted = this.memory.validations.filter(v => v.action === 'accepted').length;
        return Math.round((accepted / total) * 100);
    }

    _getMostCommonTasks(taskDurations) {
        return Object.entries(taskDurations)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([category, data]) => ({
                category,
                count: data.count,
                avgDuration: Math.round(data.total / data.count)
            }));
    }

    _getPeakHours(workingHours) {
        return Object.entries(workingHours)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([hour, count]) => ({ hour: `${hour}h`, count }));
    }

    _getAverageDurations(taskDurations) {
        const result = {};
        for (const [category, data] of Object.entries(taskDurations)) {
            result[category] = Math.round(data.total / data.count);
        }
        return result;
    }
}

module.exports = AIAssistant;
