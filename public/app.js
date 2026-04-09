// TrackHour - Application JavaScript v2.1
// PARTIE 1/7 - CONSTRUCTOR ET INITIALISATION

class TrackHourApp {
    constructor() {
        this.currentDate = new Date();
        this.tasks = [];
        this.configured = false;
        this.currentPath = null;
        this.nasPath = null;
        this.editModal = null;
        this.projectChangeModal = null;
        this.projectNotesModal = null;
        this.editNoteModal = null;
        this.projectPopupEnabled = true;
        this.lastProject = null;
        this.timeFormatDecimal = false;
        this.selectedProject = null;
        
        this.categories = {
            'TRJ': { color: 'primary', label: 'Trajet' },
            'ADM': { color: 'secondary', label: 'Administratif' },
            'CL': { color: 'success', label: 'Commercial' },
            'DEP': { color: 'danger', label: 'Dépannage' },
            'ET': { color: 'info', label: 'Etude' },
            'GTC': { color: 'warning', label: 'Supervision' },
            'MSE': { color: 'dark', label: 'Mise en service' },
            'PR': { color: 'primary', label: 'Programmation' },
            'RPL': { color: 'secondary', label: 'Réunion' },
            'SAV': { color: 'success', label: 'SAV' },
            'SC': { color: 'info', label: 'Schéma' },
            'TAR': { color: 'warning', label: 'Test' },
            'STAG': { color: 'dark', label: 'Stagiaire' },
            'CONGE': { color: 'primary', label: 'Congés' },
            'Arrêt-Maladie': { color: 'danger', label: 'Arrêt' },
            'Ferié': { color: 'success', label: 'Férié' },
            'STOCK': { color: 'secondary', label: 'Stock' },
            'INFO': { color: 'info', label: 'Info' },
            'COMM': { color: 'warning', label: 'Communication' },
            'Congé sans solde': { color: 'dark', label: 'Congé SS' }
        };
        
        this.init();
    }

    async init() {
        await this.checkConfig();
        this.loadSettings();
    }

    loadSettings() {
        const projectPopup = localStorage.getItem('projectPopupEnabled');
        if (projectPopup !== null) {
            this.projectPopupEnabled = projectPopup === 'true';
        }
    }

    saveSettings() {
        localStorage.setItem('projectPopupEnabled', this.projectPopupEnabled.toString());
    }
// PARTIE 2/7 - CONFIGURATION

    async checkConfig() {
        try {
            const response = await fetch('/api/config/check');
            const data = await response.json();
            
            if (data.configured) {
                this.configured = true;
                this.currentPath = data.path;
                this.nasPath = data.nasPath;
                this.showApp();
            } else {
                this.showSetup();
            }
        } catch (error) {
            console.error('Erreur checkConfig:', error);
            this.showSetup();
        }
    }

    showSetup() {
        document.getElementById('setupScreen').style.display = 'flex';
        document.getElementById('appContent').style.display = 'none';
        
        const form = document.getElementById('setupForm');
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        document.getElementById('setupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const path = document.getElementById('setupPath').value.trim();
            this.saveConfig(path, null, true);
            return false;
        });
    }

    async saveConfig(dataPath, nasPath, isInitial = false) {
        const errorDiv = isInitial ? document.getElementById('setupError') : document.getElementById('optionsError');
        const successDiv = document.getElementById('optionsSuccess');
        
        if (!dataPath) {
            errorDiv.textContent = 'Veuillez entrer un chemin valide';
            errorDiv.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('/api/config/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataPath, nasPath })
            });

            const data = await response.json();

            if (data.success) {
                this.configured = true;
                this.currentPath = dataPath;
                if (nasPath) this.nasPath = nasPath;
                
                if (isInitial) {
                    this.showApp();
                } else {
                    errorDiv.style.display = 'none';
                    successDiv.textContent = '✓“ Configuration enregistrée avec succès !';
                    successDiv.style.display = 'block';
                    setTimeout(() => { successDiv.style.display = 'none'; }, 3000);
                    this.loadTasks();
                    document.getElementById('nasPath').value = this.nasPath;
                }
            } else {
                errorDiv.textContent = 'Erreur : ' + data.error;
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            errorDiv.textContent = 'Erreur : ' + error.message;
            errorDiv.style.display = 'block';
        }
    }

    showApp() {
        const setupScreen = document.getElementById('setupScreen');
        const appContent = document.getElementById('appContent');
        
        setupScreen.style.display = 'none';
        setupScreen.classList.remove('d-flex');
        appContent.style.display = 'block';
        
        document.getElementById('optionsPath').value = this.currentPath;
        document.getElementById('optionsNasPath').value = this.nasPath || '';
        document.getElementById('optionProjectPopup').checked = this.projectPopupEnabled;
        
        this.editModal = new bootstrap.Modal(document.getElementById('editModal'));
        this.projectChangeModal = new bootstrap.Modal(document.getElementById('projectChangeModal'));
        this.projectNotesModal = new bootstrap.Modal(document.getElementById('projectNotesModal'));
        this.editNoteModal = new bootstrap.Modal(document.getElementById('editNoteModal'));
        
        this.setupEventListeners();
        this.setupTabs();
        this.updateDateDisplay();
        this.setCurrentTime();
        this.loadTasks();
        this.initQuickNotes();
        
        document.getElementById('reportDate').valueAsDate = new Date();
    }
// PARTIE 3/7 - TABS ET POPUP PROJET

    setupTabs() {
        const tabs = ['Dashboard', 'Search', 'Reports', 'NasSearch', 'ProjectTracking', 'Map', 'Options'];
        
        tabs.forEach(tab => {
            document.getElementById(`tab${tab}`).addEventListener('click', () => {
                tabs.forEach(t => {
                    document.getElementById(`tab${t}`).classList.remove('active');
                    document.getElementById(`content${t}`).classList.remove('active');
                });
                document.getElementById(`tab${tab}`).classList.add('active');
                document.getElementById(`content${tab}`).classList.add('active');
                
                if (tab === 'ProjectTracking') {
                    this.loadAllProjects();
                }
            });
        });

        document.getElementById('optionsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const path = document.getElementById('optionsPath').value.trim();
            const nasPath = document.getElementById('optionsNasPath').value.trim();
            this.saveConfig(path, nasPath, false);
        });

        document.getElementById('optionProjectPopup').addEventListener('change', (e) => {
            this.projectPopupEnabled = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('searchForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.performSearch();
        });

        document.getElementById('generateReport').addEventListener('click', () => this.generateReport());
        document.getElementById('exportPDF').addEventListener('click', () => this.exportReport('pdf'));
        document.getElementById('exportExcel').addEventListener('click', () => this.exportReport('excel'));
        
        document.querySelectorAll('input[name="timeFormat"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.timeFormatDecimal = e.target.value === 'decimal';
                const reportCard = document.getElementById('reportCard');
                if (reportCard) {
                    this.generateReport();
                }
            });
        });
        
        document.getElementById('refreshProjectsBtn').addEventListener('click', () => {
            this.loadAllProjects();
        });
        
        // Bouton synchronisation projets web
        const syncProjectsBtn = document.getElementById('syncProjectsButton');
        const openSourceFileBtn = document.getElementById('openSourceFileButton');
        
        if (syncProjectsBtn) {
            syncProjectsBtn.addEventListener('click', () => this.syncProjectsFromWeb());
            // Vérifier le statut au chargement
            this.checkProjectsSyncStatus();
        }
        
        if (openSourceFileBtn) {
            openSourceFileBtn.addEventListener('click', () => this.openProjectsSourceFile());
        }
        
        this.initNasSearch();
        this.initAIAssistant();
		document.getElementById('tabMap').addEventListener('click', async () => {
    // Force la carte à se redimensionner
    setTimeout(() => {
        if (window.mapManager && window.mapManager.map) {
            window.mapManager.map.invalidateSize();
            console.log('🗺️ Carte redimensionnée depuis app.js');
        }
    }, 200);
});
    }

    initAIAssistant() {
        // Bouton analyser l'historique
        document.getElementById('btnAnalyzeIA').addEventListener('click', async () => {
            if (confirm('Analyser votre historique de tâches ?\n\nL\'IA va analyser toutes vos tâches passées pour apprendre vos habitudes. Cela peut prendre quelques secondes.')) {
                await trackHourAI.analyzeHistory();
                await this.updateAIStats();
            }
        });

        // Bouton afficher les stats détaillées
        document.getElementById('btnShowAIStats').addEventListener('click', async () => {
            await trackHourAI.showStatsPanel();
        });

        // Charger les stats initiales
        this.updateAIStats();

        // Initialiser l'IA en arrière-plan
        trackHourAI.init().catch(err => console.error('Erreur init IA:', err));
    }

    async updateAIStats() {
        try {
            const response = await fetch('/api/ai/stats');
            const data = await response.json();

            if (data.success && data.stats) {
                document.getElementById('aiStatsValidations').textContent = data.stats.totalValidations || 0;
                document.getElementById('aiStatsAcceptance').textContent = (data.stats.acceptanceRate || 0) + '%';

                const patternsCount = data.stats.mostCommonTasks ? data.stats.mostCommonTasks.length : 0;
                document.getElementById('aiStatsPatterns').textContent = patternsCount;
            }
        } catch (error) {
            console.error('Erreur updateAIStats:', error);
        }
    }

    extractProjectName(description) {
        const parsed = this.parseTaskDescription(description);
        return parsed.description;
    }

    async checkProjectChange(description) {
        const currentProject = this.extractProjectName(description);
        
        if (currentProject.toLowerCase().includes('pause') || 
            currentProject.toLowerCase().includes('fin')) {
            return;
        }
        
        if (this.lastProject && this.lastProject !== currentProject && this.projectPopupEnabled) {
            await this.showProjectChangePopup(this.lastProject, currentProject);
        }
        
        this.lastProject = currentProject;
    }

    async showProjectChangePopup(prevProject, newProject) {
        return new Promise(async (resolve) => {
            document.getElementById('projectChangePrevProject').textContent = prevProject;
            document.getElementById('projectChangeNewProject').textContent = newProject;
            document.getElementById('projectChangeDescription').value = '';
            document.getElementById('linkToTaskCheckbox').checked = false;

            const modal = this.projectChangeModal;

            // Détecter le numéro AF si présent dans prevProject
            const afMatch = prevProject.match(/AF\d+/i);
            const numeroAF = afMatch ? afMatch[0].toUpperCase() : null;

            document.getElementById('projectChangeIgnore').onclick = () => {
                modal.hide();
                resolve(null);
            };

            document.getElementById('projectChangeSave').onclick = async () => {
                const desc = document.getElementById('projectChangeDescription').value.trim();
                const shouldLinkToTask = document.getElementById('linkToTaskCheckbox').checked;

                if (desc) {
                    const taskInfo = this.getLastTaskInfo();
                    if (taskInfo) {
                        const timeRange = `${taskInfo.startTime}-${taskInfo.endTime}`;

                        // Nettoyer le nom du projet avant de sauvegarder
                        let cleanPrevProject = prevProject.replace(/\s+/g, ' ').trim();
                        cleanPrevProject = cleanPrevProject.replace(/[<>:"|?*]/g, '_');

                        await this.addNoteToProject(cleanPrevProject, taskInfo.date, timeRange, desc);
                    }

                    modal.hide();

                    // Si case cochée, proposer de lier à une tâche
                    if (shouldLinkToTask && numeroAF) {
                        await this.offerTaskLinking(desc, numeroAF);
                    }

                    resolve(desc);
                } else {
                    alert('Veuillez entrer une description');
                }
            };

            modal.show();
        });
    }

    displayAISuggestions(suggestions, container) {
        if (!container) return;

        let html = `
            <div class="alert alert-info mt-3 mb-0" style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border: 2px solid #667eea;">
                <div class="d-flex align-items-center mb-2">
                    <i class="fas fa-robot me-2" style="font-size: 1.2rem; color: #667eea;"></i>
                    <strong style="color: #667eea;">💡 L'IA a trouvé des similitudes</strong>
                </div>
        `;

        suggestions.forEach((suggestion, index) => {
            const similarityPercent = Math.round(suggestion.similarity * 100);
            const dateObj = new Date(suggestion.date);
            const formattedDate = dateObj.toLocaleDateString('fr-FR');

            html += `
                <div class="mb-2 p-2" style="background: white; border-radius: 8px; border-left: 4px solid #667eea;">
                    <div class="d-flex justify-content-between align-items-start">
                        <div style="flex: 1;">
                            <small class="text-muted d-block mb-1">
                                <i class="fas fa-history me-1"></i>
                                ${formattedDate} sur <strong>${suggestion.numeroAF}</strong>
                                <span class="badge bg-success ms-2">${similarityPercent}% similaire</span>
                            </small>
                            <div class="fw-bold mb-1" style="color: #1f2937;">
                                "${suggestion.originalDescription}"
                            </div>
                            <small class="text-primary">
                                <i class="fas fa-arrow-right me-1"></i>
                                Lié à : <strong>${suggestion.taskName}</strong> (${suggestion.sectionName})
                            </small>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                <small class="text-muted d-block mt-2">
                    <i class="fas fa-info-circle me-1"></i>
                    L'IA vous rappelle vos choix précédents pour vous faire gagner du temps
                </small>
            </div>
        `;

        container.innerHTML = html;
    }

    async offerTaskLinking(description, numeroAF) {
        // Vérifier si le projet a des tâches en cache
        try {
            const response = await fetch(`/api/projects/tasks/project/${numeroAF}`);
            const data = await response.json();

            if (!data.found || !data.projectData || !data.projectData.sections) {
                // Proposer l'extraction
                const extract = confirm(`📋 Voulez-vous extraire les tâches de ${numeroAF} pour lier votre travail à une tâche spécifique ?\n\nCela permettra à l'IA d'apprendre et de vous suggérer automatiquement la prochaine fois.`);

                if (extract) {
                    // Lancer l'extraction ciblée
                    if (typeof startAutomaticExtraction === 'function') {
                        await startAutomaticExtraction(numeroAF, false);

                        // Attendre un peu puis proposer à nouveau
                        setTimeout(async () => {
                            await this.showTaskLinkingModal(description, numeroAF);
                        }, 2000);
                    }
                }
                return;
            }

            // Les tâches sont en cache, afficher directement le modal
            await this.showTaskLinkingModal(description, numeroAF, data.projectData);

        } catch (error) {
            console.error('Erreur offerTaskLinking:', error);
        }
    }

    async showTaskLinkingModal(description, numeroAF, projectData = null) {
        // Si pas de données, recharger
        if (!projectData) {
            try {
                const response = await fetch(`/api/projects/tasks/project/${numeroAF}`);
                const data = await response.json();

                if (!data.found) {
                    console.log('Projet pas encore extrait');
                    return;
                }

                projectData = data.projectData;
            } catch (error) {
                console.error('Erreur chargement projet:', error);
                return;
            }
        }

        // Créer un modal temporaire pour la liaison
        const modalHtml = `
            <div class="modal fade" id="taskLinkingModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                            <h5 class="modal-title">
                                <i class="fas fa-link me-2"></i>
                                Lier votre accomplissement à une tâche
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Ce que vous avez fait :</strong> "${description}"
                            </div>

                            <div class="mb-3">
                                <label class="form-label fw-bold">À quelle tâche du projet ${numeroAF} cela correspond-il ?</label>
                                <div id="taskLinkingList" style="max-height: 400px; overflow-y: auto;">
                                    ${this.generateTaskLinkingList(projectData, description)}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="fas fa-times me-2"></i>Passer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insérer le modal dans le DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const linkingModal = new bootstrap.Modal(document.getElementById('taskLinkingModal'));

        // Nettoyer après fermeture
        document.getElementById('taskLinkingModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });

        linkingModal.show();
    }

    generateTaskLinkingList(projectData, description) {
        let html = '';

        projectData.sections.forEach(section => {
            html += `
                <div class="mb-3">
                    <h6 class="text-primary">
                        <i class="fas fa-folder me-2"></i>${section.name}
                    </h6>
            `;

            section.tasks.forEach(task => {
                const statusIcon = task.status === 'validated' ? '✅' :
                                 task.status === 'completed' ? '⏳' : '⭕';

                html += `
                    <button class="btn btn-sm btn-outline-primary mb-2 me-2"
                            onclick="app.linkToTask('${this.escapeForAttribute(description)}', '${projectData.projectInfo?.numeroAF || projectData.projectName}', '${this.escapeForAttribute(task.name)}', '${this.escapeForAttribute(section.name)}')">
                        ${statusIcon} ${task.name}
                    </button>
                `;
            });

            html += '</div>';
        });

        return html;
    }

    escapeForAttribute(text) {
        if (!text) return '';
        return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    async linkToTask(description, numeroAF, taskName, sectionName) {
        try {
            const response = await fetch('/api/ai/task-link/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description,
                    numeroAF,
                    taskName,
                    sectionName,
                    date: new Date().toISOString()
                })
            });

            const data = await response.json();

            if (data.success) {
                // Fermer le modal
                const linkingModal = bootstrap.Modal.getInstance(document.getElementById('taskLinkingModal'));
                if (linkingModal) linkingModal.hide();

                // Afficher une confirmation
                this.showNotification('Liaison enregistrée', `"${description}" → ${taskName} (${sectionName})`, 'success');

                console.log('✅ Liaison enregistrée avec succès:', data.link);
            } else {
                alert('Erreur : ' + data.error);
            }
        } catch (error) {
            console.error('Erreur linkToTask:', error);
            alert('Erreur lors de l\'enregistrement : ' + error.message);
        }
    }

    showNotification(title, message, type = 'info') {
        const colors = {
            success: 'success',
            error: 'danger',
            info: 'info',
            warning: 'warning'
        };

        const notification = document.createElement('div');
        notification.className = `alert alert-${colors[type]} alert-dismissible position-fixed bottom-0 end-0 m-3`;
        notification.style.zIndex = '99999';
        notification.style.minWidth = '300px';
        notification.innerHTML = `
            <strong><i class="fas fa-check-circle me-2"></i>${title}</strong>
            <p class="mb-0 small">${message}</p>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 5000);
    }

    formatMinutesToHours(minutes) {
        const min = parseInt(minutes);
        if (isNaN(min)) {
            return '-';
        }
        
        if (this.timeFormatDecimal) {
            return (min / 60).toFixed(2) + 'h';
        } else {
            const h = Math.floor(min / 60);
            const m = min % 60;
            return `${h}h${String(m).padStart(2, '0')}`;
        }
    }

    formatDelta(deltaMinutes) {
        const delta = parseInt(deltaMinutes);
        if (isNaN(delta)) {
            return '-';
        }
        
        const prefix = delta >= 0 ? '+' : '';
        return prefix + this.formatMinutesToHours(Math.abs(delta));
    }
// PARTIE 4/7 - RECHERCHE NAS

    async openProjectsSourceFile() {
        try {
            const response = await fetch('/api/projects/open-source', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (!data.success) {
                alert('Impossible d\'ouvrir le fichier. Vérifiez qu\'il existe.');
            }
        } catch (error) {
            console.error('Erreur openProjectsSourceFile:', error);
            alert('Erreur : ' + error.message);
        }
    }

    async checkProjectsSyncStatus() {
        try {
            const response = await fetch('/api/projects/sync/status');
            const data = await response.json();
            
            const statusDiv = document.getElementById('projectsSyncStatus');
            
            if (data.success) {
                if (data.cached && data.projectsCount > 0) {
                    statusDiv.className = 'alert alert-success mb-0';
                    statusDiv.innerHTML = `<i class="fas fa-check-circle me-2"></i>Synchronisé : ${data.projectsCount} projets trouvés`;
                    if (data.lastSync) {
                        const syncDate = new Date(data.lastSync);
                        statusDiv.innerHTML += ` | Dernière synchro : ${syncDate.toLocaleString('fr-FR')}`;
                    }
                } else {
                    statusDiv.className = 'alert alert-warning mb-0';
                    if (!data.sourceExists) {
                        statusDiv.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>Fichier source manquant : ${data.sourcePath}`;
                    } else {
                        statusDiv.innerHTML = '<i class="fas fa-clock me-2"></i>Statut : Aucune synchronisation';
                    }
                }
            }
        } catch (error) {
            console.error('Erreur checkProjectsSyncStatus:', error);
        }
    }

    async syncProjectsFromWeb() {
        const button = document.getElementById('syncProjectsButton');
        const statusDiv = document.getElementById('projectsSyncStatus');
        
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Synchronisation...';
        
        statusDiv.className = 'alert alert-info mb-0';
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Lecture du fichier source...';
        
        try {
            const response = await fetch('/api/projects/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                statusDiv.className = 'alert alert-success mb-0';
                statusDiv.innerHTML = `<i class="fas fa-check-circle me-2"></i>Synchronisation réussie ! ${data.projectsCount} projets importés`;
                
                alert(`Synchronisation terminée !\n\n${data.projectsCount} projets ont été importés avec succès.\n\nVous pouvez maintenant taper un numéro AF dans le dashboard pour voir les informations du projet.`);
            } else {
                statusDiv.className = 'alert alert-danger mb-0';
                statusDiv.innerHTML = `<i class="fas fa-exclamation-circle me-2"></i>Erreur : ${data.error}`;
                alert('Erreur de synchronisation : ' + data.error);
            }
        } catch (error) {
            console.error('Erreur syncProjectsFromWeb:', error);
            statusDiv.className = 'alert alert-danger mb-0';
            statusDiv.innerHTML = `<i class="fas fa-exclamation-circle me-2"></i>Erreur : ${error.message}`;
            alert('Erreur : ' + error.message);
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-sync-alt me-2"></i>SYNCHRONISER';
        }
    }

    initNasSearch() {
        this.checkNasCache();
        
        document.getElementById('syncNasButton').addEventListener('click', () => this.syncNas());
        
        let searchTimer = null;
        document.getElementById('nasSearchBox').addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => this.searchNas(), 500);
        });
        
        document.getElementById('nasClientFilter').addEventListener('change', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => this.searchNas(), 300);
        });
        
        document.getElementById('nasClearButton').addEventListener('click', () => {
            document.getElementById('nasSearchBox').value = '';
            document.getElementById('nasClientFilter').selectedIndex = 0;
            this.clearNasResults();
        });
        
        document.getElementById('nasRecentButton').addEventListener('click', () => this.showRecentProjects());
    }
    
    async checkNasCache() {
        try {
            const response = await fetch('/api/nas/cache/check');
            const data = await response.json();
            
            if (data.cached) {
                document.getElementById('nasSyncStatus').innerHTML = 
                    `<i class="fas fa-check-circle me-1 text-success"></i>Cache prêt : ${data.count} projets`;
                
                // Mettre à jour aussi dans Options
                const optionsStatus = document.getElementById('optionsNasSyncStatus');
                if (optionsStatus) {
                    optionsStatus.className = 'alert alert-success mb-0';
                    optionsStatus.innerHTML = `<i class="fas fa-check-circle me-2"></i>Cache synchronisé : ${data.count} projets trouvés`;
                }
                
                await this.loadNasClients();
            } else {
                document.getElementById('nasSyncStatus').innerHTML = 
                    `<i class="fas fa-info-circle me-1"></i>Aucun cache - Synchronisez dans Options`;
                
                // Mettre à jour aussi dans Options
                const optionsStatus = document.getElementById('optionsNasSyncStatus');
                if (optionsStatus) {
                    optionsStatus.className = 'alert alert-info mb-0';
                    optionsStatus.innerHTML = `<i class="fas fa-clock me-2"></i>Aucune synchronisation effectuée`;
                }
            }
        } catch (error) {
            console.error('Erreur checkNasCache:', error);
        }
    }
    
    async loadNasClients() {
        try {
            const response = await fetch('/api/nas/clients');
            const data = await response.json();
            
            if (data.success) {
                const select = document.getElementById('nasClientFilter');
                select.innerHTML = '<option value="">-- TOUS LES CLIENTS --</option>';
                
                for (const client of data.clients) {
                    const option = document.createElement('option');
                    option.value = client;
                    option.textContent = client;
                    select.appendChild(option);
                }
            }
        } catch (error) {
            console.error('Erreur loadNasClients:', error);
        }
    }
    
    async syncNas() {
        const button = document.getElementById('syncNasButton');
        const status = document.getElementById('nasSyncStatus');
        
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Synchronisation...';
        
        const progressModal = new bootstrap.Modal(document.getElementById('syncProgressModal'));
        progressModal.show();
        
        document.getElementById('syncProgressText').textContent = 'Démarrage...';
        document.getElementById('syncProgressPercent').textContent = '0%';
        document.getElementById('syncProgressBar').style.width = '0%';
        document.getElementById('syncProjectCount').textContent = '0';
        document.getElementById('syncRecentCount').textContent = '0';
        document.getElementById('syncIgnoredCount').textContent = '0';
        
        let progress = 0;
        const progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 5;
                if (progress > 90) progress = 90;
                document.getElementById('syncProgressBar').style.width = progress + '%';
                document.getElementById('syncProgressPercent').textContent = Math.floor(progress) + '%';
                document.getElementById('syncProgressText').textContent = 'Scan des dossiers en cours...';
            }
        }, 500);
        
        try {
            const startTime = Date.now();
            const nasPath = this.nasPath || document.getElementById('optionsNasPath').value;

            const response = await fetch('/api/nas/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nasPath })
            });
            
            clearInterval(progressInterval);
            
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('syncProgressBar').style.width = '100%';
                document.getElementById('syncProgressPercent').textContent = '100%';
                document.getElementById('syncProgressText').textContent = 'Synchronisation terminée !';
                document.getElementById('syncProjectCount').textContent = data.projectsFound;
                document.getElementById('syncRecentCount').textContent = data.recentProjects;
                document.getElementById('syncIgnoredCount').textContent = data.foldersIgnored;
                
                const duration = Math.floor((Date.now() - startTime) / 1000);
                
                status.innerHTML = 
                    `<i class="fas fa-check-circle me-1 text-success"></i>Sync OK : ${data.projectsFound} projets (${data.recentProjects} récents) - Durée: ${duration}s`;
                
                // Mettre à jour aussi dans Options
                const optionsStatus = document.getElementById('optionsNasSyncStatus');
                if (optionsStatus) {
                    optionsStatus.className = 'alert alert-success mb-0';
                    optionsStatus.innerHTML = `<i class="fas fa-check-circle me-2"></i>Sync OK : ${data.projectsFound} projets (${data.recentProjects} récents) - Durée: ${duration}s`;
                }
                
                await this.loadNasClients();
                
                setTimeout(() => {
                    progressModal.hide();
                    alert(`Synchronisation terminée !\n\nProjets trouvés : ${data.projectsFound}\nProjets récents : ${data.recentProjects}\nDossiers ignorés : ${data.foldersIgnored}\nDurée : ${duration} secondes`);
                }, 2000);
            } else {
                clearInterval(progressInterval);
                progressModal.hide();
                status.innerHTML = '<i class="fas fa-exclamation-circle me-1 text-danger"></i>Erreur sync';
                alert('Erreur : ' + data.error);
            }
        } catch (error) {
            clearInterval(progressInterval);
            progressModal.hide();
            console.error('Erreur syncNas:', error);
            status.innerHTML = '<i class="fas fa-exclamation-circle me-1 text-danger"></i>Erreur sync';
            alert('Erreur : ' + error.message);
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-sync-alt me-2"></i>SYNCHRONISER';
        }
    }
    
    async searchNas() {
        const searchText = document.getElementById('nasSearchBox').value.trim();
        const clientFilter = document.getElementById('nasClientFilter').value;
        
        if (!searchText && !clientFilter) {
            this.clearNasResults();
            return;
        }
        
        try {
            const response = await fetch('/api/nas/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ searchText, clientFilter })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayNasResults(data.results);
            } else {
                alert('Erreur recherche : ' + data.error);
            }
        } catch (error) {
            console.error('Erreur searchNas:', error);
            alert('Erreur recherche : ' + error.message);
        }
    }
    
    async showRecentProjects() {
        try {
            const response = await fetch('/api/nas/recent');
            const data = await response.json();
            
            if (data.success) {
                if (data.results.length === 0) {
                    alert('Aucun projet récent trouvé dans les 3 derniers mois.');
                } else {
                    this.displayNasResults(data.results);
                }
            } else {
                alert('Erreur : ' + data.error);
            }
        } catch (error) {
            console.error('Erreur showRecentProjects:', error);
            alert('Erreur : ' + error.message);
        }
    }
    
    displayNasResults(results) {
        const tbody = document.getElementById('nasResultsBody');
        const count = document.getElementById('nasResultCount');
        
        count.textContent = results.length;
        
        if (results.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted p-4">
                        <i class="fas fa-search-minus fa-2x mb-2 d-block"></i>
                        Aucun résultat trouvé
                    </td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        for (const result of results) {
            const rowClass = result.IsRecent ? 'table-success' : '';
            const badge = result.IsRecent ? '<span class="badge bg-success ms-2">Récent</span>' : '';
            
            html += `
                <tr class="${rowClass}">
                    <td>${this.escapeHtml(result.Client)}</td>
                    <td>${this.escapeHtml(result.Chantier)}</td>
                    <td>${this.escapeHtml(result.Projet)}${badge}</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-primary" onclick="app.openNasFolder('${this.escapeForJs(result.Path)}')" title="Ouvrir le dossier">
                            <i class="fas fa-folder-open"></i>
                        </button>
                    </td>
                </tr>
            `;
        }
        
        tbody.innerHTML = html;
    }
    
    clearNasResults() {
        const tbody = document.getElementById('nasResultsBody');
        const count = document.getElementById('nasResultCount');
        
        count.textContent = '0';
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted p-5">
                    <i class="fas fa-search fa-3x mb-3 d-block"></i>
                    Lancez une recherche ou synchronisez le cache
                </td>
            </tr>
        `;
    }
    
    async openNasFolder(folderPath) {
        try {
            await fetch('/api/nas/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: folderPath })
            });
        } catch (error) {
            console.error('Erreur openNasFolder:', error);
            alert('Erreur ouverture : ' + error.message);
        }
    }
    
    async openNasFolderFromTask(taskDescription) {
        // Extraire le numéro de projet (AFXXXXXX) de la description
        const afMatch = taskDescription.match(/AF\d{7}/i);
        
        if (!afMatch) {
            alert('Aucun numéro de projet AF trouvé dans cette tâche.');
            return;
        }
        
        const numeroProjet = afMatch[0].toUpperCase();
        
        // Ouvrir l'onglet Recherche NAS
        document.getElementById('tabNasSearch').click();
        
        // Pré-remplir la barre de recherche
        document.getElementById('nasSearchBox').value = numeroProjet;
        
        // Lancer la recherche automatiquement
        await this.searchNas();
    }
    
    escapeForJs(str) {
        return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, '');
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    async openAIAssistant(numeroAF) {
        try {
            // Récupérer les données du projet
            const response = await fetch(`/api/projects/tasks/project/${numeroAF}`);
            const data = await response.json();

            if (!data.found) {
                alert('Projet non trouvé. Lancez d\'abord l\'extraction des données.');
                return;
            }

            // Stocker globalement pour l'IA
            window.currentProjectData = data.projectData;

            // Initialiser l'IA si nécessaire
            if (!trackHourAI.initialized) {
                await trackHourAI.init();
            }

            // Afficher le panneau d'assistant
            await trackHourAI.showAssistantPanel(data.projectData);
        } catch (error) {
            console.error('Erreur openAIAssistant:', error);
            alert('Erreur : ' + error.message);
        }
    }
    
    toggleNote(noteId, fullText) {
        const noteEl = document.getElementById(noteId);
        const textEl = noteEl.querySelector('.note-text');
        const btnEl = noteEl.querySelector('.btn-note-expand i');
        
        if (noteEl.classList.contains('expanded')) {
            // Réduire
            const shortText = fullText.substring(0, 80) + '...';
            textEl.textContent = shortText;
            btnEl.className = 'fas fa-plus';
            noteEl.classList.remove('expanded');
        } else {
            // Agrandir
            textEl.textContent = fullText;
            btnEl.className = 'fas fa-minus';
            noteEl.classList.add('expanded');
        }
    }
// PARTIE 5/7 - TASKS ET EVENTS

    setupEventListeners() {
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        document.getElementById('prevDay').addEventListener('click', () => this.changeDate(-1));
        document.getElementById('nextDay').addEventListener('click', () => this.changeDate(1));
        document.getElementById('today').addEventListener('click', () => {
            this.currentDate = new Date();
            this.updateDateDisplay();
            this.loadTasks();
        });

        document.getElementById('addManualNote').addEventListener('click', () => this.openManualNoteModal());
        document.getElementById('openSAV').addEventListener('click', () => this.openSAVModal());
        document.getElementById('addPause').addEventListener('click', () => this.quickAdd('Pause', ''));
        document.getElementById('endDay').addEventListener('click', () => this.quickAdd('Fin de la journee', ''));

        document.getElementById('saveEdit').addEventListener('click', () => this.saveTaskEdit());
        document.getElementById('deleteTask').addEventListener('click', () => this.deleteTask());
        
        document.getElementById('quitBtn').addEventListener('click', () => this.quitApplication());
        
        // Auto-complétion sur le champ Description
        this.setupDescriptionAutocomplete();
        
        // Clic sur Description met à jour l'heure
        document.getElementById('taskDescription').addEventListener('focus', () => {
            this.setCurrentTime();
        });
        
        // Détection automatique des projets web
        document.getElementById('taskDescription').addEventListener('input', () => {
            this.detectWebProject();
        });
    }

    setupDescriptionAutocomplete() {
        const input = document.getElementById('taskDescription');
        let datalist = document.getElementById('projectSuggestions');
        
        // Créer le datalist s'il n'existe pas
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'projectSuggestions';
            input.parentNode.appendChild(datalist);
            input.setAttribute('list', 'projectSuggestions');
        }
        
        let searchTimeout = null;
        
        // Auto-complétion intelligente : cache local + NAS
        input.addEventListener('input', async () => {
            const searchText = input.value.trim().toLowerCase();
            
            // Si moins de 2 caractères, on vide les suggestions
            if (searchText.length < 2) {
                datalist.innerHTML = '';
                return;
            }
            
            // Annuler la recherche précédente
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            searchTimeout = setTimeout(async () => {
                const suggestions = new Set(); // Utiliser un Set pour éviter les doublons
                
                // 1. PRIORITÉ : Suggestions depuis les tâches locales récentes
                const localSuggestions = await this.getLocalSuggestions(searchText);
                localSuggestions.forEach(s => suggestions.add(s));
                
                // 2. Suggestions depuis le cache NAS (si disponible)
                try {
                    const response = await fetch('/api/nas/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ searchText, clientFilter: '' })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success && data.results.length > 0) {
                        // Ajouter les résultats NAS (limiter à 5)
                        for (let i = 0; i < Math.min(5, data.results.length); i++) {
                            const result = data.results[i];
                            // Afficher le PROJET (AFXXX) et le nom du chantier
                            suggestions.add(`${result.Projet} - ${result.Chantier}`);
                        }
                    }
                } catch (error) {
                    console.error('Erreur autocomplete NAS:', error);
                }
                
                // Afficher les suggestions (max 10)
                datalist.innerHTML = '';
                const suggestionArray = Array.from(suggestions).slice(0, 10);
                
                suggestionArray.forEach(suggestion => {
                    const option = document.createElement('option');
                    option.value = suggestion;
                    datalist.appendChild(option);
                });
            }, 300); // Délai de 300ms pour éviter trop de requêtes
        });
    }

    async getLocalSuggestions(searchText) {
        const suggestions = [];
        const seenDescriptions = new Set();
        
        try {
            // Récupérer les tâches des 30 derniers jours
            const today = new Date();
            
            for (let daysBack = 0; daysBack < 30; daysBack++) {
                const date = new Date(today);
                date.setDate(date.getDate() - daysBack);
                
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                
                try {
                    const response = await fetch(`/api/tasks/${year}/${month}/${day}`);
                    const data = await response.json();
                    
                    if (data.success && data.tasks) {
                        for (const task of data.tasks) {
                            const parsed = this.parseTaskDescription(task.description);
                            const desc = parsed.description.toLowerCase();
                            
                            // Ignorer pause et fin de journée
                            if (desc.includes('pause') || desc.includes('fin')) {
                                continue;
                            }
                            
                            // Vérifier si ça correspond à la recherche
                            if (desc.includes(searchText)) {
                                const cleanDesc = parsed.description;
                                
                                // Éviter les doublons
                                if (!seenDescriptions.has(cleanDesc)) {
                                    seenDescriptions.add(cleanDesc);
                                    suggestions.push(cleanDesc);
                                }
                            }
                        }
                    }
                } catch (error) {
                    // Ignorer les erreurs de fichiers manquants
                    continue;
                }
                
                // Limiter le nombre de suggestions locales à 10
                if (suggestions.length >= 10) {
                    break;
                }
            }
        } catch (error) {
            console.error('Erreur getLocalSuggestions:', error);
        }
        
        return suggestions;
    }

    async detectWebProject() {
        const description = document.getElementById('taskDescription').value.trim();
        
        // Chercher un numéro AF dans la description
        const afMatch = description.match(/AF\d{7}/i);
        
        if (afMatch) {
            const numeroAF = afMatch[0].toUpperCase();
            await this.displayWebProjectBadge(numeroAF);
        } else {
            // Supprimer le badge s'il n'y a pas de numéro AF
            const existingBadge = document.getElementById('projectWebBadge');
            if (existingBadge) {
                existingBadge.remove();
            }
        }
    }

    async startTargetedExtraction(numeroAF) {
        console.log(`🎯 Démarrage extraction ciblée pour ${numeroAF}`);
        
        // Masquer le bouton "Extraction ciblée"
        const btnExtract = document.getElementById(`btnExtract_${numeroAF}`);
        if (btnExtract) {
            btnExtract.disabled = true;
            btnExtract.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Extraction...';
        }
        
        // Lancer l'extraction (appeler la fonction de index.html)
        if (typeof startAutomaticExtraction === 'function') {
            try {
                await startAutomaticExtraction(numeroAF);
                
                // Après extraction réussie, masquer "Extraction" et afficher "Assistance"
                if (btnExtract) {
                    btnExtract.style.display = 'none';
                }
                
                const btnAssistant = document.getElementById(`btnAssistant_${numeroAF}`);
                if (btnAssistant) {
                    btnAssistant.style.display = 'inline-block';
                }
                
                console.log('✅ Extraction terminée - Bouton Assistance activé');
                
            } catch (error) {
                console.error('❌ Erreur extraction:', error);
                if (btnExtract) {
                    btnExtract.disabled = false;
                    btnExtract.innerHTML = '<i class="fas fa-download me-1"></i>Extraction ciblée';
                }
                alert('Erreur lors de l\'extraction : ' + error.message);
            }
        } else {
            console.error('❌ Fonction startAutomaticExtraction non trouvée');
            alert('Erreur : fonction d\'extraction non disponible');
        }
    }

    async displayWebProjectBadge(numeroAF) {
        try {
            const response = await fetch(`/api/projects/find/${numeroAF}`);
            const data = await response.json();
            
            if (data.success && data.found) {
                const project = data.project;
                
                // Récupérer les données extraites
                const tasksResponse = await fetch(`/api/projects/tasks/project/${numeroAF}`);
                const tasksData = await tasksResponse.json();
                let extractedData = null;
                if (tasksData.success && tasksData.found) {
                    extractedData = tasksData.projectData;
                }

                // FALLBACK: Si pas d'adresse dans extractedData, vérifier map_sites avant de géocoder
                // ✅ CORRECTION : Vérifier aussi dans extractedData.extractedData.adresseChantier
                let hasValidAddress = (extractedData && extractedData.adresseChantier &&
                                       extractedData.adresseChantier !== "Non définie" &&
                                       extractedData.adresseChantier !== "Non défini" &&
                                       extractedData.adresseChantier.trim() !== "") ||
                                      (extractedData && extractedData.extractedData?.adresseChantier &&
                                       extractedData.extractedData.adresseChantier !== "Non définie" &&
                                       extractedData.extractedData.adresseChantier !== "Non défini" &&
                                       extractedData.extractedData.adresseChantier.trim() !== "");

                // Vérifier d'abord dans map_sites avant de lancer le géocodage
                if (!hasValidAddress) {
                    try {
                        const mapResponse = await fetch('/api/map/sites');
                        const mapData = await mapResponse.json();
                        if (mapData.success && mapData.sites) {
                            const cachedSite = mapData.sites.find(s => s.numeroAF === numeroAF);
                            if (cachedSite && cachedSite.address && cachedSite.address !== 'Non définie') {
                                console.log(`✅ Adresse déjà en cache dans map_sites: ${cachedSite.address}`);
                                if (!extractedData) extractedData = {};
                                extractedData.adresseChantier = cachedSite.address;
                                if (!extractedData.extractedData) extractedData.extractedData = {};
                                extractedData.extractedData.adresseChantier = cachedSite.address;
                                hasValidAddress = true;
                            }
                        }
                    } catch (mapError) {
                        console.error('Erreur vérification map_sites:', mapError);
                    }
                }

                if (!hasValidAddress) {
                    const currentAddr = extractedData?.adresseChantier || extractedData?.extractedData?.adresseChantier || 'null';
                    console.log(`⚠️ Pas d'adresse trouvée pour ${numeroAF} (valeur: "${currentAddr}"), tentative de géocodage...`);

                    try {
                        const addressResponse = await fetch('/api/search-address', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                client: project.client || 'Client',
                                siteName: project.projectName,
                                numeroAF: numeroAF
                            })
                        });

                        const addressData = await addressResponse.json();
                        if (addressData.success && addressData.address) {
                            console.log(`✅ Adresse trouvée via ${addressData.geocoder}: ${addressData.address}`);

                            // Ajouter l'adresse aux extractedData (dans le bon objet)
                            if (!extractedData) {
                                extractedData = {};
                            }
                            // Mettre à jour à la fois au niveau racine et dans extractedData
                            extractedData.adresseChantier = addressData.address;
                            if (!extractedData.extractedData) {
                                extractedData.extractedData = {};
                            }
                            extractedData.extractedData.adresseChantier = addressData.address;
                            hasValidAddress = true; // ✅ Éviter la boucle infinie

                            // Sauvegarder immédiatement dans le cache
                            try {
                                const saveResponse = await fetch('/api/map/save-discovered-address', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        numeroAF: numeroAF,
                                        siteName: project.projectName,
                                        address: addressData.address
                                    })
                                });

                                const saveResult = await saveResponse.json();
                                console.log(`💾 Résultat sauvegarde adresse:`, saveResult);

                                if (saveResponse.ok && saveResult.success) {
                                    console.log(`✅ Adresse "${addressData.address}" sauvegardée dans le cache pour ${numeroAF}`);
                                } else {
                                    console.warn(`⚠️ Échec sauvegarde adresse:`, saveResult.error || 'Raison inconnue');
                                }
                            } catch (saveError) {
                                console.error('❌ Erreur sauvegarde adresse:', saveError);
                            }
                        } else {
                            console.log(`⚠️ Aucune adresse trouvée via géocodage pour ${project.projectName}`);
                        }
                    } catch (addressError) {
                        console.error('Erreur recherche adresse:', addressError);
                    }
                }
                
                // Supprimer l'ancien badge s'il existe
                const existingBadge = document.getElementById('projectWebBadge');
                if (existingBadge) {
                    existingBadge.remove();
                }
                
                // Déterminer la couleur du statut
                let statutClass = 'secondary';
                let statutIcon = 'fa-circle';
                
                switch(project.statut) {
                    case 'En cours':
                        statutClass = 'success';
                        statutIcon = 'fa-play';
                        break;
                    case 'Terminé':
                        statutClass = 'primary';
                        statutIcon = 'fa-check';
                        break;
                    case 'Fin de projet':
                        statutClass = 'warning';
                        statutIcon = 'fa-flag-checkered';
                        break;
                    case 'Non commencé':
                        statutClass = 'secondary';
                        statutIcon = 'fa-circle';
                        break;
                }
                
                // Badge de projet bloqué
                const bloqueHtml = project.estBloque ? 
                    `<span class="badge bg-danger ms-2" title="Projet bloqué">
                        <i class="fas fa-exclamation-triangle"></i> BLOQUÉ
                    </span>` : '';
                
                // Liste des techniciens (si disponible)
                let techniciansHtml = '';
                if (project.technicians && project.technicians.length > 0) {
                    techniciansHtml = `
                        <div class="col-md-12">
                            <strong><i class="fas fa-users me-1 text-secondary"></i>Techniciens:</strong> 
                            ${project.technicians.map(t => `<span class="badge bg-light text-dark me-1">${this.escapeHtml(t)}</span>`).join('')}
                        </div>
                    `;
                }
                
                // Créer la carte enrichie
                const badgeDiv = document.createElement('div');
                badgeDiv.id = 'projectWebBadge';
                badgeDiv.className = 'col-md-12 mt-2';
                badgeDiv.innerHTML = `
                    <div class="card border-success shadow-sm">
                        <div class="card-header bg-success text-white d-flex justify-content-between align-items-center">
                            <div>
                                <i class="fas fa-check-circle me-2"></i>
                                <strong>Projet détecté : ${this.escapeHtml(project.projectName)}</strong>
                            </div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-warning" id="btnExtract_${numeroAF}" onclick="app.startTargetedExtraction('${numeroAF}')" title="Lancer l'extraction ciblée" style="display:${extractedData ? 'none' : 'inline-block'};">
                                    <i class="fas fa-download me-1"></i>Extraction ciblée
                                </button>
                                <button class="btn btn-sm btn-success" id="btnAssistant_${numeroAF}" onclick="openTaskAssistant('${numeroAF}')" title="Ouvrir l'assistant IA" style="display:${extractedData ? 'inline-block' : 'none'};">
                                    <i class="fas fa-robot me-1"></i>Assistant
                                    <span id="aiLightbulb_${numeroAF}" style="display:none;">💡</span>
                                </button>
                                <a href="${project.projectUrl}" target="_blank" class="btn btn-sm btn-light" title="Ouvrir le projet">
                                    <i class="fas fa-external-link-alt"></i>
                                </a>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="row g-2 mb-2">
                                <div class="col-md-6">
                                    <strong><i class="fas fa-building me-1 text-primary"></i>Client:</strong> ${this.escapeHtml(project.client)}
                                </div>
                                <div class="col-md-6">
                                    <strong><i class="fas fa-user-tie me-1 text-info"></i>Chargé d'affaire:</strong> ${this.escapeHtml(project.chargeAffaire)}
                                </div>
                            </div>
                            <div class="row g-2">
                                <div class="col-md-6">
                                    <strong><i class="fas fa-info-circle me-1 text-secondary"></i>Statut:</strong>
                                    <span class="badge bg-${statutClass} ms-1">
                                        <i class="fas ${statutIcon} me-1"></i>${this.escapeHtml(project.statut)}
                                    </span>
                                    ${bloqueHtml}
                                </div>
                                ${project.dateLivraison ? `
                                    <div class="col-md-6">
                                        <strong><i class="fas fa-calendar-alt me-1 text-warning"></i>Livraison:</strong> ${this.escapeHtml(project.dateLivraison)}
                                    </div>
                                ` : ''}
                            </div>
                            ${techniciansHtml}
                            ${extractedData && (extractedData.contacts?.length > 0 || extractedData.devis?.length > 0 || extractedData.adresseChantier) ? `
                            <div class="mt-2 p-2 bg-light border rounded">
                                <small class="text-muted"><i class="fas fa-info-circle me-1"></i>Données extraites</small>
                                <div class="mt-2">
                                ${extractedData.contacts?.length > 0 ? `
                                <div class="mb-2"><strong class="text-primary"><i class="fas fa-address-book me-1"></i>Contacts:</strong><br>
                                ${extractedData.contacts.map(c => `<small>• <strong>${this.escapeHtml(c.name)}</strong> ${c.role ? `(${this.escapeHtml(c.role)})` : ''}<br>
                                ${c.email ? `&nbsp;&nbsp;<a href="mailto:${c.email}"><i class="fas fa-envelope me-1"></i>${this.escapeHtml(c.email)}</a>` : ''}
                                ${c.phone ? ` <a href="tel:${c.phone}"><i class="fas fa-phone me-1"></i>${this.escapeHtml(c.phone)}</a>` : ''}</small><br>`).join('')}
                                </div>` : ''}
                                ${extractedData.devis?.length > 0 ? `
                                <div class="mb-2"><strong class="text-success"><i class="fas fa-file-pdf me-1"></i>Documents:</strong><br>
                                ${extractedData.devis.map(d => `<small>• <a href="${d.url}" target="_blank"><i class="fas fa-external-link-alt me-1"></i>${this.escapeHtml(d.nom)}</a></small><br>`).join('')}
                                </div>` : ''}
                                ${(extractedData.adresseChantier && extractedData.adresseChantier !== "Non définie" && extractedData.adresseChantier !== "Non défini") || (extractedData.extractedData?.adresseChantier && extractedData.extractedData.adresseChantier !== "Non définie" && extractedData.extractedData.adresseChantier !== "Non défini") ? `
                                <div><strong class="text-secondary"><i class="fas fa-map-marker-alt me-1"></i>Chantier:</strong> <small>${this.escapeHtml(extractedData.adresseChantier || extractedData.extractedData?.adresseChantier)}</small></div>
                                ` : ''}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
                
                // Insérer le badge après le formulaire
                const taskForm = document.getElementById('taskForm');
                taskForm.parentElement.appendChild(badgeDiv);

                // Vérifier si l'IA a des suggestions pour ce projet
                if (extractedData) {
                    this.checkAISuggestionsForProject(numeroAF, extractedData);
                }

            } else {
                // Projet non trouvé, supprimer le badge
                const existingBadge = document.getElementById('projectWebBadge');
                if (existingBadge) {
                    existingBadge.remove();
                }
            }
        } catch (error) {
            console.error('Erreur detectWebProject:', error);
        }
    }

    async displayNasProjectBadge(numeroAF) {
        try {
            // Rechercher dans le cache NAS
            const nasResponse = await fetch('/api/nas/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ searchText: numeroAF, clientFilter: '' })
            });

            const nasData = await nasResponse.json();

            if (!nasData.success || nasData.results.length === 0) {
                alert(`Projet ${numeroAF} introuvable dans tous les caches.\n\nVérifiez le numéro d'affaire ou synchronisez les données.`);
                return;
            }

            const nasProject = nasData.results[0];

            // Supprimer l'ancien badge s'il existe
            const existingBadge = document.getElementById('projectWebBadge');
            if (existingBadge) {
                existingBadge.remove();
            }

            // Créer le badge simplifié avec données NAS uniquement
            const badgeDiv = document.createElement('div');
            badgeDiv.id = 'projectWebBadge';
            badgeDiv.className = 'col-md-12 mt-2';
            badgeDiv.innerHTML = `
                <div class="card border-info shadow-sm">
                    <div class="card-header bg-info text-white d-flex justify-content-between align-items-center">
                        <div>
                            <i class="fas fa-folder me-2"></i>
                            <strong>${this.escapeHtml(nasProject.Chantier || numeroAF)}</strong>
                            <span class="badge bg-light text-dark ms-2">NAS uniquement</span>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-success" id="btnAssistant_${numeroAF}" onclick="openTaskAssistant('${numeroAF}')" title="Ouvrir l'assistant">
                                <i class="fas fa-robot me-1"></i>Assistant
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="row g-2 mb-2">
                            <div class="col-md-6">
                                <strong><i class="fas fa-building me-1 text-primary"></i>Client:</strong> ${this.escapeHtml(nasProject.Client || 'N/A')}
                            </div>
                            <div class="col-md-6">
                                <strong><i class="fas fa-folder-open me-1 text-secondary"></i>Numéro AF:</strong> ${numeroAF}
                            </div>
                        </div>
                        ${nasProject.Path ? `
                        <div class="row g-2">
                            <div class="col-12">
                                <button class="btn btn-sm btn-outline-primary" onclick="app.openNasFolder('${this.escapeForJs(nasProject.Path)}')">
                                    <i class="fas fa-folder-open me-1"></i>Ouvrir le dossier NAS
                                </button>
                            </div>
                        </div>
                        ` : ''}
                        <div class="alert alert-info mt-3 mb-0">
                            <small>
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Projet non synchronisé depuis la gestion web</strong><br>
                                Les données affichées proviennent uniquement du cache NAS. Pour obtenir plus d'informations (tâches, contacts, devis),
                                synchronisez le projet depuis l'onglet <strong>Options</strong>.
                            </small>
                        </div>
                    </div>
                </div>
            `;

            // Insérer le badge après le formulaire (même logique que displayWebProjectBadge)
            const taskForm = document.getElementById('taskForm');
            if (taskForm) {
                taskForm.parentElement.appendChild(badgeDiv);

                // Scroller vers le badge
                setTimeout(() => {
                    badgeDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 100);
            } else {
                console.warn('⚠️ taskForm introuvable, impossible d\'afficher le badge');
            }

            console.log(`✅ Badge NAS affiché pour ${numeroAF}`);
        } catch (error) {
            console.error('Erreur displayNasProjectBadge:', error);
            alert('Erreur lors de l\'affichage des infos du projet NAS.');
        }
    }

    async checkAISuggestionsForProject(numeroAF, projectData) {
        try {
            const response = await fetch('/api/ai/task-link/check-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectData })
            });

            const data = await response.json();

            if (data.success && data.hasSuggestions) {
                // Afficher l'ampoule sur le bouton Assistance
                const lightbulb = document.getElementById(`aiLightbulb_${numeroAF}`);
                if (lightbulb) {
                    lightbulb.style.display = 'inline';
                    lightbulb.title = `${data.count} tâche(s) similaire(s) trouvée(s) dans votre historique!`;
                    console.log(`💡 ${data.count} suggestion(s) trouvée(s) pour ${numeroAF}`);
                }

                // Stocker les suggestions pour l'assistant
                window[`aiSuggestions_${numeroAF}`] = data.taskSuggestions;
            }
        } catch (error) {
            console.error('Erreur checkAISuggestionsForProject:', error);
        }
    }

    async showProjectInfo(numeroAF) {
        try {
            // Appeler l'API pour récupérer les infos du projet
            const response = await fetch(`/api/projects/find/${numeroAF}`);
            const data = await response.json();

            if (data.success && data.found) {
                // Afficher le badge avec les infos du cache web
                await this.displayWebProjectBadge(numeroAF);

                // Scroller vers le badge
                setTimeout(() => {
                    const badge = document.getElementById('projectWebBadge');
                    if (badge) {
                        badge.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }, 100);
            } else {
                // ✅ Projet non trouvé dans le cache web, essayer le cache NAS
                console.log(`⚠️ Projet ${numeroAF} non trouvé dans cache web, recherche dans cache NAS...`);
                await this.displayNasProjectBadge(numeroAF);
            }
        } catch (error) {
            console.error('Erreur showProjectInfo:', error);
            alert('Erreur lors de la récupération des infos du projet.');
        }
    }

    updateDateDisplay() {
        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'Décembre'];
        const dateStr = `${days[this.currentDate.getDay()]} ${this.currentDate.getDate()} ${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        document.getElementById('currentDate').textContent = dateStr;
    }

    setCurrentTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        document.getElementById('taskTime').value = `${hours}:${minutes}`;
    }

    changeDate(days) {
        this.currentDate.setDate(this.currentDate.getDate() + days);
        this.updateDateDisplay();
        this.loadTasks();
    }

    async loadTasks() {
        try {
            const year = this.currentDate.getFullYear();
            const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.currentDate.getDate()).padStart(2, '0');

            const response = await fetch(`/api/tasks/${year}/${month}/${day}`);
            const data = await response.json();

            if (data.success) {
                this.tasks = data.tasks || [];
                
                this.lastProject = null;
                for (let i = this.tasks.length - 1; i >= 0; i--) {
                    const projectName = this.extractProjectName(this.tasks[i].description);
                    if (!projectName.toLowerCase().includes('pause') && 
                        !projectName.toLowerCase().includes('fin')) {
                        this.lastProject = projectName;
                        break;
                    }
                }
            } else {
                this.tasks = [];
                this.lastProject = null;
            }

            // Charger les infos sur les notes des projets
            await this.loadProjectNotesInfo();
            
            this.renderTasks();
            this.updateStats();
        } catch (error) {
            console.error('Erreur:', error);
            this.tasks = [];
            this.lastProject = null;
            this.renderTasks();
            this.updateStats();
        }
    }

    async loadProjectNotesInfo() {
        try {
            const response = await fetch('/api/notes/all');
            const data = await response.json();
            if (data.success) {
                this.projectsWithNotes = {};
                for (const project of data.projects) {
                    this.projectsWithNotes[project.numeroAF] = project.totalNotes || 0;
                }
            }
        } catch (error) {
            console.error('Erreur loadProjectNotesInfo:', error);
            this.projectsWithNotes = {};
        }
    }

    parseTaskDescription(fullDescription) {
        const parts = fullDescription.trim().split(' ');
        const lastPart = parts[parts.length - 1];
        
        if (this.categories[lastPart]) {
            return {
                description: parts.slice(0, -1).join(' '),
                category: lastPart
            };
        }
        
        return {
            description: fullDescription,
            category: ''
        };
    }

    async renderTasks() {
        const taskList = document.getElementById('taskList');
        const taskCount = document.getElementById('taskCount');

        if (this.tasks.length === 0) {
            taskList.innerHTML = '<div class="text-center text-muted p-5">Aucune tâche pour cette journée</div>';
            taskCount.textContent = '0';
            return;
        }

        // Pré-charger les infos NAS pour tous les projets AF
        const nasProjectsCache = {};
        for (const task of this.tasks) {
            const parsed = this.parseTaskDescription(task.description);
            const afMatch = parsed.description.match(/AF\d{7}/i);
            if (afMatch) {
                const numeroAF = afMatch[0].toUpperCase();
                if (!nasProjectsCache[numeroAF]) {
                    try {
                        const response = await fetch('/api/nas/search', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ searchText: numeroAF, clientFilter: '' })
                        });
                        const data = await response.json();
                        if (data.success && data.results.length > 0) {
                            // Trouver le résultat qui correspond EXACTEMENT au numéro AF
                            const exactMatch = data.results.find(r => r.Projet.toUpperCase() === numeroAF);
                            if (exactMatch) {
                                nasProjectsCache[numeroAF] = exactMatch.Path;
                            }
                        }
                    } catch (error) {
                        console.error('Erreur check NAS:', error);
                    }
                }
            }
        }

        let html = '';
        for (let i = 0; i < this.tasks.length; i++) {
            const task = this.tasks[i];
            const parsed = this.parseTaskDescription(task.description);
            const duration = this.calculateDuration(i);
            const isPause = parsed.description.toLowerCase().includes('pause');
            const isEnd = parsed.description.toLowerCase().includes('fin');

            let className = 'task-item align-middle';
            if (isPause) className += ' pause';
            if (isEnd) className += ' end-day';

            const categoryBadge = parsed.category ? 
                `<span class="badge badge-category bg-${this.categories[parsed.category].color}">${parsed.category}</span>` : '';

            // Vérifier si ce projet a des notes et les récupérer
            let notesHtml = '';
            if (this.projectsWithNotes && this.projectsWithNotes[parsed.description] > 0 && !isPause && !isEnd) {
                // Charger les notes du projet
                try {
                    const notesResponse = await fetch(`/api/notes/${encodeURIComponent(parsed.description)}`);
                    const notesData = await notesResponse.json();
                    
                    if (notesData.success && notesData.notes && notesData.notes.length > 0) {
                        const lastNote = notesData.notes[notesData.notes.length - 1];
                        // Limiter à 80 caractères
                        const isTruncated = lastNote.text.length > 80;
                        const shortText = isTruncated ? lastNote.text.substring(0, 80) + '...' : lastNote.text;
                        const noteId = `note-${i}`;
                        notesHtml = `
                            <div class="task-note" id="${noteId}">
                                <i class="fas fa-comment-dots me-1"></i>
                                <span class="note-text">${this.escapeHtml(shortText)}</span>
                                ${isTruncated ? `
                                    <button class="btn-note-expand" onclick="app.toggleNote('${noteId}', '${this.escapeForJs(lastNote.text)}'); event.stopPropagation();" title="Voir la note complète">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                ` : ''}
                            </div>
                        `;
                    }
                } catch (error) {
                    console.error('Erreur chargement notes:', error);
                }
            }
            
            const hasNotes = this.projectsWithNotes && this.projectsWithNotes[parsed.description] > 0;
            const notesButton = hasNotes ? 
                `<button class="btn btn-sm btn-outline-info ms-2" onclick="app.viewProjectNotes('${this.escapeForJs(parsed.description)}')" title="Voir les notes">
                    <i class="fas fa-clipboard-list"></i> ${this.projectsWithNotes[parsed.description]}
                </button>` : '';
            
            // Vérifier si c'est un numéro AF pour ajouter le bouton info
            const afMatch = parsed.description.match(/AF\d{7}/i);
            const infoButton = afMatch ? 
                `<button class="btn btn-sm btn-outline-primary ms-2" onclick="app.showProjectInfo('${afMatch[0].toUpperCase()}')" title="Infos projet web">
                    <i class="fas fa-info-circle"></i>
                </button>` : '';
            
            // Ajouter un bouton pour rechercher le dossier NAS pour tous les projets AF
            const afMatch2 = parsed.description.match(/AF\d{7}/i);
            const nasButton = (afMatch2 && !isPause && !isEnd) ? 
                `<button class="btn btn-sm btn-outline-success" onclick="app.openNasFolderFromTask('${this.escapeForJs(parsed.description)}')" title="Rechercher dans NAS">
                    <i class="fas fa-search"></i>
                </button>` : '';

            html += `
                <div class="${className}">
                    <div class="task-layout">
                        <div class="task-left">
                            <span class="badge-reference me-3">${task.time}</span>
                            <div class="task-description">
                                <div>${this.escapeHtml(parsed.description)} ${categoryBadge}</div>
                                ${notesHtml}
                            </div>
                        </div>
                        <div class="task-buttons">
                            <div class="task-hover-actions d-flex gap-1">
                                ${notesButton}
                                ${infoButton}
                                ${nasButton}
                                <button class="btn btn-sm btn-outline-primary" onclick="app.editTask(${i})">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        </div>
                        <div class="task-duration">
                            <span class="text-muted small fw-bold">${duration || ''}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        taskList.innerHTML = html;
        taskCount.textContent = this.tasks.length;
    }

    calculateDuration(index) {
        if (index >= this.tasks.length - 1) return '';

        const current = this.timeToMinutes(this.tasks[index].time);
        const next = this.timeToMinutes(this.tasks[index + 1].time);
        const diff = next - current;

        if (diff < 0) return '';

        const hours = Math.floor(diff / 60);
        const minutes = diff % 60;

        return hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${minutes}min`;
    }

    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    updateStats() {
        document.getElementById('statTasks').textContent = this.tasks.length;

        if (this.tasks.length > 0) {
            document.getElementById('statStart').textContent = this.tasks[0].time;
            document.getElementById('statEnd').textContent = this.tasks[this.tasks.length - 1].time;

            const first = this.timeToMinutes(this.tasks[0].time);
            const last = this.timeToMinutes(this.tasks[this.tasks.length - 1].time);
            let total = last - first;

            for (let i = 0; i < this.tasks.length - 1; i++) {
                const parsed = this.parseTaskDescription(this.tasks[i].description);
                if (parsed.description.toLowerCase().includes('pause')) {
                    const pauseStart = this.timeToMinutes(this.tasks[i].time);
                    const pauseEnd = this.timeToMinutes(this.tasks[i + 1].time);
                    total -= (pauseEnd - pauseStart);
                }
            }

            const hours = Math.floor(total / 60);
            const minutes = total % 60;
            document.getElementById('statDuration').textContent = `${hours}h${String(minutes).padStart(2, '0')}`;
        } else {
            document.getElementById('statStart').textContent = '--:--';
            document.getElementById('statEnd').textContent = '--:--';
            document.getElementById('statDuration').textContent = '0h00';
        }
    }

    async addTask() {
        const time = document.getElementById('taskTime').value;
        const description = document.getElementById('taskDescription').value.trim();
        const category = document.getElementById('taskCategory').value;

        if (!time || !description) return;

        const fullDescription = category ? `${description} ${category}` : description;

        await this.checkProjectChange(fullDescription);

        this.tasks.push({ time, description: fullDescription });
        this.tasks.sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));

        await this.saveTasks();

        document.getElementById('taskDescription').value = '';
        document.getElementById('taskCategory').value = '';
        this.setCurrentTime();
        document.getElementById('taskDescription').focus();
    }

    async saveTasks() {
        try {
            const year = this.currentDate.getFullYear();
            const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.currentDate.getDate()).padStart(2, '0');

            const response = await fetch(`/api/tasks/${year}/${month}/${day}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tasks: this.tasks })
            });

            const data = await response.json();

            if (data.success) {
                this.renderTasks();
                this.updateStats();
            } else {
                alert('Erreur lors de la sauvegarde');
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la sauvegarde');
        }
    }

    quickAdd(text, category) {
        this.setCurrentTime();
        document.getElementById('taskDescription').value = text;
        document.getElementById('taskCategory').value = category;
        document.getElementById('taskDescription').focus();
    }

    // =============================================
    // MODULE SAV
    // =============================================

    openSAVModal() {
        // Vérifier que la dernière tâche n'est pas une Pause ou Fin de journée
        if (this.tasks.length > 0) {
            const lastTask = this.tasks[this.tasks.length - 1];
            const lastDesc = lastTask.description.toLowerCase();
            if (lastDesc.includes('pause') || lastDesc.includes('fin')) {
                alert('Vous ne pouvez pas créer un SAV pendant une Pause ou après une Fin de journée.\n\nReprenez d\'abord une tâche.');
                return;
            }
        }

        // Mémoriser la tâche précédente (avant le SAV)
        if (this.tasks.length > 0) {
            this.savPreviousTask = this.tasks[this.tasks.length - 1].description;
        } else {
            this.savPreviousTask = null;
        }

        // Créer la tâche "Divers bureau SAV"
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const time = `${hours}:${minutes}`;

        this.tasks.push({ time, description: 'Divers bureau SAV' });
        this.tasks.sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));
        this.saveTasks();

        // Réinitialiser le formulaire SAV
        document.getElementById('savNomPrenom').value = '';
        document.getElementById('savTelephone').value = '';
        document.getElementById('savChantier').value = '';
        document.getElementById('savChantierProjetId').value = '';
        document.getElementById('savDemande').value = '';
        document.getElementById('savChantierLien').style.display = 'none';
        document.getElementById('savChantierResults').style.display = 'none';

        // Ouvrir le modal SAV
        if (!this.savModal) {
            this.savModal = new bootstrap.Modal(document.getElementById('savModal'));
        }
        this.savModal.show();

        // Setup des event listeners du modal (une seule fois)
        this.setupSAVModalListeners();
    }

    setupSAVModalListeners() {
        // Éviter de re-binder les listeners multiples fois
        if (this.savListenersSetup) return;
        this.savListenersSetup = true;

        // Autocomplete chantier
        let chantierTimer = null;
        document.getElementById('savChantier').addEventListener('input', (e) => {
            const q = e.target.value.trim();
            const resultsDiv = document.getElementById('savChantierResults');

            if (q.length < 2) {
                resultsDiv.style.display = 'none';
                resultsDiv.innerHTML = '';
                document.getElementById('savChantierProjetId').value = '';
                document.getElementById('savChantierLien').style.display = 'none';
                return;
            }

            clearTimeout(chantierTimer);
            chantierTimer = setTimeout(async () => {
                try {
                    const response = await fetch(`/api/sav/chantier-search?q=${encodeURIComponent(q)}`);
                    const data = await response.json();

                    if (data.success && data.results.length > 0) {
                        resultsDiv.innerHTML = '';
                        data.results.forEach(item => {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = 'list-group-item list-group-item-action';
                            btn.innerHTML = `
                                <div class="fw-semibold">${item.chantier}</div>
                                <div class="small text-muted">
                                    ${item.projet ? '<span class="badge bg-primary me-1">' + item.projet + '</span>' : ''}
                                    ${item.client ? item.client : ''}
                                    ${item.lien ? ' <i class="fas fa-external-link-alt text-success"></i>' : ''}
                                </div>
                            `;
                            btn.addEventListener('click', () => {
                                document.getElementById('savChantier').value = item.chantier;
                                document.getElementById('savChantierProjetId').value = item.projectId || '';
                                resultsDiv.style.display = 'none';

                                // Afficher le lien si disponible
                                if (item.lien) {
                                    document.getElementById('savChantierLienUrl').href = item.lien;
                                    document.getElementById('savChantierLien').style.display = 'block';
                                } else {
                                    document.getElementById('savChantierLien').style.display = 'none';
                                }

                                // Auto-ouverture du dossier NAS si trouvé
                                if (item.nasPath) {
                                    fetch('/api/nas/open', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ path: item.nasPath })
                                    }).catch(err => console.error('Erreur ouverture dossier NAS:', err));
                                }

                                // Auto-ouverture du projet dans la gestion de projet si disponible
                                if (item.lien) {
                                    window.open(item.lien, '_blank');
                                }
                            });
                            resultsDiv.appendChild(btn);
                        });
                        resultsDiv.style.display = 'block';
                    } else {
                        resultsDiv.style.display = 'none';
                    }
                } catch (err) {
                    console.error('Erreur recherche chantier SAV:', err);
                }
            }, 300);
        });

        // Fermer les résultats si clic ailleurs
        document.addEventListener('click', (e) => {
            const resultsDiv = document.getElementById('savChantierResults');
            if (resultsDiv && !resultsDiv.contains(e.target) && e.target.id !== 'savChantier') {
                resultsDiv.style.display = 'none';
            }
        });

        // Annuler le modal SAV (sans supprimer la tâche "Divers bureau SAV" déjà créée)
        document.getElementById('savModalCancel').addEventListener('click', () => {
            if (this.savModal) this.savModal.hide();
        });

        document.getElementById('savModalClose').addEventListener('click', () => {
            if (this.savModal) this.savModal.hide();
        });

        // Soumettre la fiche SAV
        document.getElementById('savSubmit').addEventListener('click', async () => {
            const nomPrenom = document.getElementById('savNomPrenom').value.trim();
            const telephone = document.getElementById('savTelephone').value.trim();
            const chantier = document.getElementById('savChantier').value.trim();
            const chantierProjetId = document.getElementById('savChantierProjetId').value;
            const demande = document.getElementById('savDemande').value.trim();

            if (!nomPrenom || !chantier || !demande) {
                alert('Les champs Nom Prénom, Chantier et Demande sont obligatoires.');
                return;
            }

            // POST vers le backend
            try {
                const response = await fetch('/api/sav', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nomPrenom, telephone, chantier, chantierProjetId, demande })
                });
                const data = await response.json();

                if (data.success) {
                    // Fermer le modal formulaire
                    if (this.savModal) this.savModal.hide();

                    // Stocker les données pour le partage
                    this.currentSAVRecord = data.record;

                    // Afficher le modal partage
                    this.showSAVShareModal(data.record);
                } else {
                    alert('Erreur sauvegarde : ' + data.error);
                }
            } catch (err) {
                console.error('Erreur POST SAV:', err);
                alert('Erreur lors de la sauvegarde de la fiche.');
            }
        });

        // --- Modal Partage ---
        document.getElementById('savShareEmail').addEventListener('click', () => {
            this.shareSAVByEmail(this.currentSAVRecord);
        });

        document.getElementById('savShareGestion').addEventListener('click', () => {
            this.shareSAVByGestionProjet(this.currentSAVRecord);
        });

        document.getElementById('savShareSkip').addEventListener('click', () => {
            if (this.savShareModal) this.savShareModal.hide();
            this.offerResumePreviousTask();
        });

        // --- Modal Reprendre tâche ---
        document.getElementById('savResumeConfirm').addEventListener('click', () => {
            this.resumePreviousTask();
            if (this.savResumeModal) this.savResumeModal.hide();
        });
    }

    showSAVShareModal(record) {
        // Remplir le résumé
        document.getElementById('savShareNomPrenom').textContent = record.nomPrenom;
        document.getElementById('savShareChantier').textContent = record.chantier;
        document.getElementById('savShareDemande').textContent = record.demande;

        // Téléphone : afficher uniquement si présent
        const telDiv = document.getElementById('savShareTelDiv');
        if (record.telephone) {
            document.getElementById('savShareTelephone').textContent = record.telephone;
            telDiv.style.display = 'block';
        } else {
            telDiv.style.display = 'none';
        }

        if (!this.savShareModal) {
            this.savShareModal = new bootstrap.Modal(document.getElementById('savShareModal'));
        }
        this.savShareModal.show();
    }

    shareSAVByEmail(record) {
        const sujet = `SAV - ${record.chantier} - ${record.nomPrenom}`;
        const corps = [
            `Bonjour,`,
            ``,
            `Nouvelle demande SAV reçue :`,
            ``,
            `Contact : ${record.nomPrenom}`,
            record.telephone ? `Téléphone : ${record.telephone}` : null,
            `Chantier : ${record.chantier}`,
            `Date : ${new Date(record.date).toLocaleString('fr-FR')}`,
            ``,
            `Demande :`,
            record.demande,
            ``,
            `---`,
            `Créé depuis TrackHour`
        ].filter(line => line !== null).join('\n');

        // Construire le mailto: (ouvre le client email par défaut, souvent Outlook web en entreprise)
        const mailto = `mailto:?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
        window.open(mailto, '_blank');

        // Marquer comme partagé par mail
        fetch(`/api/sav/${record.id}/partage`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'mail' })
        }).catch(err => console.error('Erreur marque partage mail:', err));

        // Fermer le modal partage et proposer reprendre
        if (this.savShareModal) this.savShareModal.hide();
        this.offerResumePreviousTask();
    }

    shareSAVByGestionProjet(record) {
        // Ouvrir la page SAV/create dans une popup
        const url = 'https://projets.applitec-automatisme.com/sav/create';
        const width = 900;
        const height = 700;
        const left = Math.round((window.screen.width - width) / 2);
        const top = Math.round((window.screen.height - height) / 2);

        const popup = window.open(
            url,
            'trackhour_sav_create',
            `width=${width},height=${height},left=${left},top=${top},toolbar=yes,location=yes,menubar=no,status=yes`
        );

        if (!popup) {
            alert('Pop-up bloquée. Autorisez les pop-ups pour ce site et réessayez.');
            return;
        }

        // Envoyer les données SAV via postMessage après chargement de la page
        const savData = {
            type: 'trackhour_sav_data',
            nomPrenom: record.nomPrenom,
            telephone: record.telephone || '',
            chantier: record.chantier,
            chantierProjetId: record.chantierProjetId,
            demande: record.demande
        };

        // Attendre que la popup soit chargée puis envoyer le message
        let attempts = 0;
        const maxAttempts = 30; // 15 secondes
        const sendInterval = setInterval(() => {
            attempts++;
            try {
                popup.postMessage(savData, 'https://projets.applitec-automatisme.com');
            } catch (e) {
                // Silencer les erreurs cross-origin tant que la page charge
            }
            // Arrêter après un few tentatives réussies ou timeout
            if (attempts >= maxAttempts) {
                clearInterval(sendInterval);
                console.log('⏰ Timeout envoi postMessage SAV');
            }
        }, 500);

        // Écouter la confirmation que le script tampermonkey a reçu les données
        const confirmListener = (event) => {
            if (event.origin === 'https://projets.applitec-automatisme.com' &&
                event.data && event.data.type === 'trackhour_sav_confirmed') {
                clearInterval(sendInterval);
                console.log('✅ Données SAV reçues par le formulaire distant');
                window.removeEventListener('message', confirmListener);
            }
        };
        window.addEventListener('message', confirmListener);

        // Marquer comme partagé par gestion projet
        fetch(`/api/sav/${record.id}/partage`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'gestion' })
        }).catch(err => console.error('Erreur marque partage gestion:', err));

        // Fermer le modal partage et proposer reprendre
        if (this.savShareModal) this.savShareModal.hide();
        this.offerResumePreviousTask();
    }

    offerResumePreviousTask() {
        if (!this.savPreviousTask) return;

        // Afficher le nom de la tâche précédente dans le modal
        document.getElementById('savResumePrevTask').textContent = this.savPreviousTask;

        if (!this.savResumeModal) {
            this.savResumeModal = new bootstrap.Modal(document.getElementById('savResumeModal'));
        }
        this.savResumeModal.show();
    }

    async resumePreviousTask() {
        if (!this.savPreviousTask) return;

        const prevTaskDesc = this.savPreviousTask;

        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const time = `${hours}:${minutes}`;

        this.tasks.push({ time, description: prevTaskDesc });
        this.tasks.sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));
        await this.saveTasks();

        this.savPreviousTask = null;
        this.showNotification('Tâche reprise', `Vous êtes de nouveau sur : ${prevTaskDesc}`, 'success');
    }

    // =============================================
    // FIN MODULE SAV
    // =============================================

    editTask(index) {
        const task = this.tasks[index];
        const parsed = this.parseTaskDescription(task.description);
        
        document.getElementById('editTime').value = task.time;
        document.getElementById('editDescription').value = parsed.description;
        document.getElementById('editCategory').value = parsed.category;
        document.getElementById('editIndex').value = index;
        
        // Vérifier si le projet a des notes
        const hasNotes = this.projectsWithNotes && this.projectsWithNotes[parsed.description] > 0;
        const noteSection = document.getElementById('editTaskNoteSection');
        
        if (hasNotes) {
            noteSection.style.display = 'block';
            // Configurer le bouton pour ouvrir les notes
            document.getElementById('editTaskNoteBtn').onclick = () => {
                this.editModal.hide();
                this.viewProjectNotes(parsed.description);
            };
        } else {
            noteSection.style.display = 'none';
        }
        
        this.editModal.show();
    }

    async saveTaskEdit() {
        const indexInput = document.getElementById('editIndex');
        const index = parseInt(indexInput.value);
        const time = document.getElementById('editTime').value;
        const description = document.getElementById('editDescription').value.trim();
        const category = document.getElementById('editCategory').value;

        if (!time || !description) return;

        const fullDescription = category ? `${description} ${category}` : description;
        
        const fromReport = indexInput.getAttribute('data-from-report') === 'true';
        
        if (fromReport) {
            const year = indexInput.getAttribute('data-year');
            const month = indexInput.getAttribute('data-month');
            const day = indexInput.getAttribute('data-day');
            
            try {
                const response = await fetch(`/api/tasks/${year}/${month}/${day}`);
                const data = await response.json();
                
                if (data.success) {
                    const tasks = data.tasks || [];
                    tasks[index] = { time, description: fullDescription };
                    tasks.sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));
                    
                    const saveResponse = await fetch(`/api/tasks/${year}/${month}/${day}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tasks })
                    });
                    
                    const saveData = await saveResponse.json();
                    
                    if (saveData.success) {
                        indexInput.removeAttribute('data-from-report');
                        indexInput.removeAttribute('data-year');
                        indexInput.removeAttribute('data-month');
                        indexInput.removeAttribute('data-day');
                        
                        this.editModal.hide();
                        await this.generateReport();
                    } else {
                        alert('Erreur lors de la sauvegarde');
                    }
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert('Erreur lors de la sauvegarde');
            }
        } else {
            this.tasks[index] = { time, description: fullDescription };
            this.tasks.sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));
            await this.saveTasks();
            this.editModal.hide();
        }
    }

    async deleteTask() {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) return;

        const indexInput = document.getElementById('editIndex');
        const index = parseInt(indexInput.value);
        const fromReport = indexInput.getAttribute('data-from-report') === 'true';
        
        if (fromReport) {
            const year = indexInput.getAttribute('data-year');
            const month = indexInput.getAttribute('data-month');
            const day = indexInput.getAttribute('data-day');
            
            try {
                const response = await fetch(`/api/tasks/${year}/${month}/${day}`);
                const data = await response.json();
                
                if (data.success) {
                    const tasks = data.tasks || [];
                    tasks.splice(index, 1);
                    
                    const saveResponse = await fetch(`/api/tasks/${year}/${month}/${day}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tasks })
                    });
                    
                    const saveData = await saveResponse.json();
                    
                    if (saveData.success) {
                        indexInput.removeAttribute('data-from-report');
                        indexInput.removeAttribute('data-year');
                        indexInput.removeAttribute('data-month');
                        indexInput.removeAttribute('data-day');
                        
                        this.editModal.hide();
                        await this.generateReport();
                    } else {
                        alert('Erreur lors de la suppression');
                    }
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert('Erreur lors de la suppression');
            }
        } else {
            this.tasks.splice(index, 1);
            await this.saveTasks();
            this.editModal.hide();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async quitApplication() {
        if (confirm('Êtes-vous sûr de vouloir quitter TrackHour ?')) {
            try {
                await fetch('/api/shutdown', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                document.body.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;"><div style="text-align: center;"><i class="fas fa-check-circle fa-4x text-success mb-3"></i><h2>TrackHour arrêté</h2><p class="text-muted">Vous pouvez fermer cet onglet</p></div></div>';
                
                setTimeout(() => {
                    window.close();
                }, 1000);
            } catch (error) {
                console.error('Erreur arrêt:', error);
                window.close();
            }
        }
    }
// PARTIE 6/7 - RECHERCHE ET RAPPORTS

    async performSearch() {
        const keywords = document.getElementById('searchKeywords').value.trim();
        const category = document.getElementById('searchCategory').value;
        const dateStart = document.getElementById('searchDateStart').value;
        const dateEnd = document.getElementById('searchDateEnd').value;

        try {
            const response = await fetch('/api/tasks/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords, category, dateStart, dateEnd })
            });

            const data = await response.json();

            if (data.success) {
                this.displaySearchResults(data.results);
            } else {
                alert('Erreur lors de la recherche: ' + (data.error || 'inconnue'));
            }
        } catch (error) {
            console.error('Erreur recherche:', error);
            alert('Erreur lors de la recherche: ' + error.message);
        }
    }

    displaySearchResults(results) {
        const resultsDiv = document.getElementById('searchResults');
        const count = document.getElementById('searchCount');
        
        count.textContent = results.length;

        if (results.length === 0) {
            resultsDiv.innerHTML = '<div class="text-center text-muted p-4">Aucun résultat trouvé</div>';
            return;
        }

        let html = '<div class="list-group">';
        for (const result of results) {
            const parsed = this.parseTaskDescription(result.description);
            const categoryBadge = parsed.category ? 
                `<span class="badge badge-category bg-${this.categories[parsed.category].color} ms-2">${parsed.category}</span>` : '';

            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="badge bg-secondary me-2">${result.date}</span>
                            <span class="badge-reference me-2">${result.time}</span>
                            ${this.escapeHtml(parsed.description)}
                            ${categoryBadge}
                        </div>
                        <button class="btn btn-sm btn-outline-primary" onclick="app.goToDate('${result.year}', '${result.month}', '${result.day}')">
                            <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;
        }
        html += '</div>';

        resultsDiv.innerHTML = html;
    }

    goToDate(year, month, day) {
        this.currentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        document.getElementById('tabDashboard').click();
        this.updateDateDisplay();
        this.loadTasks();
    }
    
    async editTaskFromReport(year, month, day, taskIndex, taskTime, taskDescription) {
        const parsed = this.parseTaskDescription(taskDescription);
        
        document.getElementById('editTime').value = taskTime;
        document.getElementById('editDescription').value = parsed.description;
        document.getElementById('editCategory').value = parsed.category;
        
        document.getElementById('editIndex').value = taskIndex;
        document.getElementById('editIndex').setAttribute('data-year', year);
        document.getElementById('editIndex').setAttribute('data-month', month);
        document.getElementById('editIndex').setAttribute('data-day', day);
        document.getElementById('editIndex').setAttribute('data-from-report', 'true');
        
        this.editModal.show();
    }

    async generateReport() {
        const type = document.getElementById('reportType').value;
        const date = document.getElementById('reportDate').value;

        try {
            const response = await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, date })
            });

            const data = await response.json();

            if (data.success) {
                this.displayReport(data.report);
            } else {
                alert('Erreur lors de la génération du rapport: ' + (data.error || 'inconnue'));
            }
        } catch (error) {
            console.error('Erreur rapport:', error);
            alert('Erreur lors de la génération du rapport: ' + error.message);
        }
    }

    displayReport(report) {
        const content = document.getElementById('reportContent');
        
        if (report.type === 'daily') {
            this.displayDailyReport(report, content);
        } else if (report.type === 'weekly' || report.type === 'monthly') {
            this.displayPeriodReport(report, content);
        }
    }

    displayDailyReport(report, container) {
        const reportDate = new Date(report.date);
        const dateStr = reportDate.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        let html = `
            <div class="card" id="reportCard">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0">Rapport Journalier - ${dateStr}</h5>
                </div>
                <div class="card-body">
        `;

        if (report.tasks.length === 0) {
            html += '<p class="text-muted">Aucune tâche enregistrée pour cette journée</p>';
        } else {
            html += '<table class="table table-striped"><thead><tr><th>Heure</th><th>Description</th><th>Catégorie</th><th>Durée</th></tr></thead><tbody>';
            
            for (let i = 0; i < report.tasks.length; i++) {
                const task = report.tasks[i];
                const parsed = this.parseTaskDescription(task.description);
                
                let duration = '';
                if (i < report.tasks.length - 1) {
                    const current = this.timeToMinutes(task.time);
                    const next = this.timeToMinutes(report.tasks[i + 1].time);
                    const diff = next - current;
                    if (diff > 0) {
                        const h = Math.floor(diff / 60);
                        const m = diff % 60;
                        duration = h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
                    }
                }
                
                const categoryBadge = parsed.category ? 
                    `<span class="badge bg-${this.categories[parsed.category].color}">${parsed.category}</span>` : '-';
                
                html += `<tr>
                    <td><strong>${task.time}</strong></td>
                    <td>${this.escapeHtml(parsed.description)}</td>
                    <td>${categoryBadge}</td>
                    <td>${duration}</td>
                </tr>`;
            }
            
            html += '</tbody></table>';
        }

        html += '</div></div>';
        container.innerHTML = html;
    }

    displayPeriodReport(report, container) {
        const title = report.type === 'weekly' ? 'Rapport Hebdomadaire' : 'Rapport Mensuel';
        
        let html = `
            <div class="card" id="reportCard">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0">${title}</h5>
                </div>
                <div class="card-body">
        `;

        if (report.tasks.length === 0) {
            html += '<p class="text-muted">Aucune donnée pour cette période</p>';
        } else {
            html += '<div class="table-responsive">';
            html += '<table class="table table-hover">';
            html += '<thead class="table-light"><tr><th>Date</th><th>Heure</th><th>Description</th><th>Catégorie</th><th>Durée</th><th>Actions</th></tr></thead>';
            html += '<tbody>';
            
            for (const day of report.tasks) {
                const [dayNum, monthNum, yearNum] = day.date.split('/');
                
                let dayHeader = `<strong>${day.date}</strong>`;
                if (day.totalMinutes !== undefined) {
                    const dayDeltaColor = day.deltaMinutes >= 0 ? 'text-success' : 'text-danger';
                    const dayDeltaSymbol = day.deltaMinutes >= 0 ? '✓“' : '⚠️';
                    dayHeader += ` | Total: ${this.formatMinutesToHours(day.totalMinutes)} | Delta: <span class="${dayDeltaColor}">${this.formatDelta(day.deltaMinutes)} ${dayDeltaSymbol}</span>`;
                }
                
                html += `<tr class="table-primary">
                    <td colspan="6">${dayHeader}</td>
                </tr>`;
                
                if (day.projectTotals && Array.isArray(day.projectTotals) && day.projectTotals.length > 0) {
                    html += `<tr class="table-light">
                        <td></td>
                        <td colspan="5"><strong>Projets groupés :</strong><br>`;
                    
                    for (const project of day.projectTotals) {
                        const parsed = this.parseTaskDescription(project.description);
                        html += `<span class="badge bg-secondary me-2 mb-1 clickable-project" onclick="app.highlightProject('${this.escapeForJs(parsed.description)}')">${this.escapeHtml(parsed.description)}: ${this.formatMinutesToHours(project.duration)}</span>`;
                    }
                    
                    html += `</td></tr>`;
                }
                
                for (let i = 0; i < day.tasks.length; i++) {
                    const task = day.tasks[i];
                    const parsed = this.parseTaskDescription(task.description);
                    
                    const duration = task.duration ? this.formatMinutesToHours(task.duration) : '-';
                    
                    const categoryBadge = parsed.category ? 
                        `<span class="badge bg-${this.categories[parsed.category].color}">${parsed.category}</span>` : '-';
                    
                    const projectClass = this.selectedProject === parsed.description ? 'table-warning' : '';
                    
                    html += `<tr class="${projectClass} clickable-project-row" onclick="app.highlightProject('${this.escapeForJs(parsed.description)}')">
                        <td></td>
                        <td><span class="badge-reference">${task.time}</span></td>
                        <td>${this.escapeHtml(parsed.description)}</td>
                        <td>${categoryBadge}</td>
                        <td>${duration}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); app.editTaskFromReport('${yearNum}', '${monthNum}', '${dayNum}', ${i}, '${task.time}', \`${task.description.replace(/`/g, '\\`')}\`)" title="Modifier">
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    </tr>`;
                }
            }
            
            html += '</tbody></table></div>';
        }

        html += '</div></div>';
        container.innerHTML = html;
    }

    highlightProject(projectName) {
        if (this.selectedProject === projectName) {
            this.selectedProject = null;
        } else {
            this.selectedProject = projectName;
        }
        this.generateReport();
    }

    exportReport(format) {
        const reportCard = document.getElementById('reportCard');
        
        if (!reportCard) {
            alert('Veuillez d\'abord générer un rapport');
            return;
        }

        if (format === 'pdf') {
            this.exportToPDF(reportCard);
        } else if (format === 'excel') {
            this.exportToExcel();
        }
    }

    exportToPDF(element) {
        const opt = {
            margin: 10,
            filename: `rapport_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save();
    }

    async exportToExcel() {
        const type = document.getElementById('reportType').value;
        const date = document.getElementById('reportDate').value;

        try {
            const response = await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, date })
            });

            const data = await response.json();

            if (!data.success) {
                alert('Erreur lors de la génération du rapport');
                return;
            }

            const report = data.report;
            const wb = XLSX.utils.book_new();

            if (type === 'daily') {
                const wsData = [['Heure', 'Description', 'Catégorie', 'Durée']];
                
                for (let i = 0; i < report.tasks.length; i++) {
                    const task = report.tasks[i];
                    const parsed = this.parseTaskDescription(task.description);
                    
                    let duration = '';
                    if (i < report.tasks.length - 1) {
                        const current = this.timeToMinutes(task.time);
                        const next = this.timeToMinutes(report.tasks[i + 1].time);
                        const diff = next - current;
                        if (diff > 0) {
                            const h = Math.floor(diff / 60);
                            const m = diff % 60;
                            duration = h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
                        }
                    }
                    
                    wsData.push([task.time, parsed.description, parsed.category || '-', duration]);
                }
                
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, 'Rapport Journalier');
            } else {
                const summaryData = [['Catégorie', 'Temps (minutes)', 'Temps (heures)']];
                for (const [category, minutes] of Object.entries(report.summary)) {
                    const hours = (minutes / 60).toFixed(2);
                    summaryData.push([category, minutes, hours]);
                }
                const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
                XLSX.utils.book_append_sheet(wb, wsSummary, 'Résumé');
                
                const detailData = [['Date', 'Heure', 'Description', 'Catégorie']];
                for (const day of report.tasks) {
                    for (const task of day.tasks) {
                        const parsed = this.parseTaskDescription(task.description);
                        detailData.push([day.date, task.time, parsed.description, parsed.category || '-']);
                    }
                }
                const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
                XLSX.utils.book_append_sheet(wb, wsDetail, 'Détail');
            }

            const filename = `rapport_${type}_${date}.xlsx`;
            XLSX.writeFile(wb, filename);
        } catch (error) {
            console.error('Erreur export Excel:', error);
            alert('Erreur lors de l\'export Excel');
        }
    }
// PARTIE 7/7 - SUIVI PROJETS ET NOTES

    async loadAllProjects() {
        try {
            const response = await fetch('/api/notes/all');
            const data = await response.json();

            if (data.success) {
                this.displayProjectTracking(data.projects);
            } else {
                alert('Erreur chargement projets : ' + data.error);
            }
        } catch (error) {
            console.error('Erreur loadAllProjects:', error);
            alert('Erreur : ' + error.message);
        }
    }

    displayProjectTracking(projects) {
        const content = document.getElementById('projectTrackingContent');
        
        if (projects.length === 0) {
            content.innerHTML = `
                <div class="col-12 text-center text-muted p-5">
                    <i class="fas fa-clipboard-list fa-3x mb-3 d-block"></i>
                    <p>Aucun projet avec notes pour le moment</p>
                    <p class="small">Les notes sont créées automatiquement lorsque vous changez de projet</p>
                </div>
            `;
            return;
        }

        let html = '';
        for (const project of projects) {
            const noteCount = project.totalNotes || 0;
            const lastNote = project.notes && project.notes.length > 0 ? project.notes[project.notes.length - 1] : null;
            
            html += `
                <div class="col-md-6 col-lg-4">
                    <div class="card h-100">
                        <div class="card-body">
                            <h5 class="card-title">
                                <i class="fas fa-folder text-primary me-2"></i>
                                ${this.escapeHtml(project.folderName || project.numeroAF)}
                            </h5>
                            <div class="mb-2">
                                <span class="badge bg-info">
                                    <i class="fas fa-sticky-note me-1"></i>${noteCount} note${noteCount > 1 ? 's' : ''}
                                </span>
                            </div>
                            ${lastNote ? `
                                <div class="small text-muted mb-2">
                                    <strong>Dernière note :</strong><br>
                                    ${lastNote.date} ${lastNote.timeRange}<br>
                                    <em>${this.escapeHtml(lastNote.text.substring(0, 80))}${lastNote.text.length > 80 ? '...' : ''}</em>
                                </div>
                            ` : ''}
                        </div>
                        <div class="card-footer bg-light d-flex gap-2">
                            <button class="btn btn-sm btn-primary flex-fill" onclick="app.viewProjectNotes('${this.escapeForJs(project.numeroAF)}')">
                                <i class="fas fa-eye me-1"></i>Voir notes
                            </button>
                            <button class="btn btn-sm btn-success" onclick="app.addNoteToProject('${this.escapeForJs(project.numeroAF)}')">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        content.innerHTML = html;
    }

    async viewProjectNotes(numeroAF) {
        try {
            const response = await fetch(`/api/notes/${encodeURIComponent(numeroAF)}`);
            const data = await response.json();

            if (data.success) {
                document.getElementById('modalProjectName').textContent = numeroAF;
                this.displayProjectNotesList(data.notes, numeroAF);
                this.projectNotesModal.show();

                document.getElementById('addNoteBtn').onclick = () => {
                    this.addNoteToProject(numeroAF);
                };
            } else {
                alert('Erreur : ' + data.error);
            }
        } catch (error) {
            console.error('Erreur viewProjectNotes:', error);
            alert('Erreur : ' + error.message);
        }
    }

    displayProjectNotesList(notes, numeroAF) {
        const listDiv = document.getElementById('projectNotesList');

        if (notes.length === 0) {
            listDiv.innerHTML = `
                <div class="text-center text-muted p-4">
                    <i class="fas fa-sticky-note fa-2x mb-2 d-block"></i>
                    Aucune note pour ce projet
                </div>
            `;
            return;
        }

        let html = '';
        for (let i = 0; i < notes.length; i++) {
            const note = notes[i];
            html += `
                <div class="card mb-2">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <span class="badge bg-secondary">${this.escapeHtml(note.date)}</span>
                                <span class="badge bg-info ms-1">${this.escapeHtml(note.timeRange)}</span>
                            </div>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary" onclick="app.editNote('${this.escapeForJs(numeroAF)}', ${i}, '${this.escapeForJs(note.date)}', '${this.escapeForJs(note.timeRange)}', \`${this.escapeForJs(note.text)}\`)">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-outline-danger" onclick="app.deleteNote('${this.escapeForJs(numeroAF)}', ${i})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <p class="mb-0" style="white-space: pre-wrap;">${this.escapeHtml(note.text)}</p>
                    </div>
                </div>
            `;
        }

        listDiv.innerHTML = html;
    }

    async addNoteToProject(numeroAF, date = null, timeRange = null, noteText = null) {
        if (date && timeRange && noteText) {
            await this.saveNote(numeroAF, date, timeRange, noteText);
            return;
        }

        document.getElementById('editNoteTitle').textContent = 'Ajouter une note';
        document.getElementById('editNoteDate').value = new Date().toLocaleDateString('fr-FR');
        document.getElementById('editNoteTimeRange').value = 'Manuel';
        document.getElementById('editNoteText').value = '';
        document.getElementById('editNoteProjectName').value = numeroAF;
        document.getElementById('editNoteIndex').value = '-1';

        this.editNoteModal.show();

        document.getElementById('saveNoteBtn').onclick = () => {
            this.saveNoteFromModal();
        };
    }

    editNote(numeroAF, noteIndex, date, timeRange, text) {
        document.getElementById('editNoteTitle').textContent = 'Modifier la note';
        document.getElementById('editNoteDate').value = date;
        document.getElementById('editNoteTimeRange').value = timeRange;
        document.getElementById('editNoteText').value = text;
        document.getElementById('editNoteProjectName').value = numeroAF;
        document.getElementById('editNoteIndex').value = noteIndex;

        this.editNoteModal.show();

        document.getElementById('saveNoteBtn').onclick = () => {
            this.saveNoteFromModal();
        };
    }

    async saveNoteFromModal() {
        const numeroAF = document.getElementById('editNoteProjectName').value;
        const date = document.getElementById('editNoteDate').value;
        const timeRange = document.getElementById('editNoteTimeRange').value;
        const text = document.getElementById('editNoteText').value.trim();
        const noteIndex = parseInt(document.getElementById('editNoteIndex').value);

        if (!text) {
            alert('Veuillez entrer une note');
            return;
        }

        if (noteIndex === -1) {
            await this.saveNote(numeroAF, date, timeRange, text);
        } else {
            await this.updateNote(numeroAF, noteIndex, text);
        }

        this.editNoteModal.hide();
        await this.viewProjectNotes(numeroAF);
    }

    async openManualNoteModal() {
        // Essayer de trouver automatiquement le numéro d'affaire à partir de la dernière tâche
        let autoNumeroAF = '';
        let autoSiteName = '';

        // Récupérer le dernier projet depuis la dernière tâche
        if (this.tasks && this.tasks.length > 0) {
            for (let i = this.tasks.length - 1; i >= 0; i--) {
                const projectName = this.extractProjectName(this.tasks[i].description);
                if (projectName && !projectName.toLowerCase().includes('pause') && !projectName.toLowerCase().includes('fin')) {
                    autoSiteName = projectName;
                    break;
                }
            }
        }

        // Si on a un nom de site, chercher le numéro d'affaire automatiquement
        let autoAdresse = '';
        let autoClient = '';
        let hasAddressInCache = false;

        if (autoSiteName) {
            try {
                const response = await fetch('/api/map/find-numero-affaire', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ siteName: autoSiteName })
                });

                const data = await response.json();
                if (data.success && data.found && data.numeroAF) {
                    autoNumeroAF = data.numeroAF;
                    autoClient = data.client || '';
                    console.log(`✅ Numéro d'affaire trouvé automatiquement: ${autoNumeroAF} pour ${autoSiteName}`);

                    // Vérifier si on a déjà l'adresse dans le cache
                    if (this.projetsWebCache && this.projetsWebCache[autoNumeroAF]) {
                        const projectData = this.projetsWebCache[autoNumeroAF];
                        if (projectData.extractedData && projectData.extractedData.adresseChantier) {
                            hasAddressInCache = true;
                            console.log(`✅ Adresse déjà en cache: ${projectData.extractedData.adresseChantier}`);
                        }
                    }
                }

                // FALLBACK: Si pas d'adresse en cache (même si on a le numéro d'affaire), chercher l'adresse
                if (!hasAddressInCache) {
                    console.log(`⚠️ Pas d'adresse en cache, tentative de recherche via géocodage...`);

                    try {
                        const addressResponse = await fetch('/api/search-address', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                client: autoClient || 'Client',
                                siteName: autoSiteName,
                                numeroAF: autoNumeroAF || ''
                            })
                        });

                        const addressData = await addressResponse.json();
                        if (addressData.success && addressData.address) {
                            autoAdresse = addressData.address;
                            console.log(`✅ Adresse trouvée via ${addressData.geocoder}: ${autoAdresse}`);
                        }
                    } catch (addressError) {
                        console.error('Erreur recherche adresse:', addressError);
                    }
                }
            } catch (error) {
                console.error('Erreur recherche numéro d\'affaire:', error);
            }
        }

        // Créer un modal pour saisir manuellement une note
        const modalHtml = `
            <div class="modal fade" id="manualNoteModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-info text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-sticky-note me-2"></i>
                                Ajouter une note manuelle
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label fw-bold">Numéro d'affaire</label>
                                <input type="text" class="form-control" id="manualNoteProject" list="manualNoteProjectSuggestions" placeholder="Ex: AF240123..." required autocomplete="off">
                                <datalist id="manualNoteProjectSuggestions"></datalist>
                                <small class="text-muted">
                                    <i class="fas fa-info-circle me-1"></i>
                                    Tapez pour voir les suggestions (numéros d'affaire existants)
                                </small>
                            </div>

                            <div class="mb-3">
                                <label class="form-label fw-bold">Note</label>
                                <textarea class="form-control" id="manualNoteText" rows="5" placeholder="Décrivez ce que vous avez fait..." required></textarea>
                            </div>

                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="manualNoteLinkTask">
                                <label class="form-check-label" for="manualNoteLinkTask">
                                    <strong>☑️ Lier l'accomplissement à une tâche du projet</strong>
                                    <small class="d-block text-muted">
                                        <i class="fas fa-lightbulb me-1"></i>
                                        Permet à l'IA d'apprendre comment vous accomplissez vos tâches
                                    </small>
                                </label>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="fas fa-times me-2"></i>Annuler
                            </button>
                            <button type="button" class="btn btn-info" id="saveManualNoteBtn">
                                <i class="fas fa-save me-2"></i>Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Supprimer l'ancien modal s'il existe
        const oldModal = document.getElementById('manualNoteModal');
        if (oldModal) oldModal.remove();

        // Insérer le modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const manualNoteModal = new bootstrap.Modal(document.getElementById('manualNoteModal'));

        // Nettoyer après fermeture
        document.getElementById('manualNoteModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });

        // Configurer l'auto-complétion sur le champ Projet
        this.setupManualNoteAutocomplete();

        // Pré-remplir le champ avec le numéro d'affaire trouvé automatiquement
        if (autoNumeroAF) {
            document.getElementById('manualNoteProject').value = autoNumeroAF;
            // Ajouter un indicateur visuel
            const input = document.getElementById('manualNoteProject');
            input.classList.add('border-success');
            input.style.backgroundColor = '#d4edda';

            // Afficher un message de confirmation
            const smallTag = input.nextElementSibling.nextElementSibling; // Le <small> après le datalist
            if (smallTag) {
                smallTag.innerHTML = `<i class="fas fa-check-circle text-success me-1"></i>Numéro d'affaire détecté automatiquement pour "${autoSiteName}"`;
            }
        } else if (autoAdresse) {
            // Si une adresse a été trouvée via géocodage
            const input = document.getElementById('manualNoteProject');
            const smallTag = input.nextElementSibling.nextElementSibling;
            if (smallTag) {
                const message = autoNumeroAF
                    ? `<i class="fas fa-info-circle text-warning me-1"></i>Pas d'accès à distance trouvé pour ${autoNumeroAF}, mais adresse détectée via géocodage : <strong>${autoAdresse}</strong>`
                    : `<i class="fas fa-info-circle text-info me-1"></i>Numéro d'affaire non trouvé dans les caches, mais adresse détectée : <strong>${autoAdresse}</strong>`;
                smallTag.innerHTML = message;
            }

            // Sauvegarder l'adresse pour l'utiliser plus tard
            this._tempAddressForSite = {
                siteName: autoSiteName,
                address: autoAdresse,
                numeroAF: autoNumeroAF
            };
        }

        // Gérer le bouton Enregistrer
        document.getElementById('saveManualNoteBtn').onclick = async () => {
            let numeroAF = document.getElementById('manualNoteProject').value.trim();
            const noteText = document.getElementById('manualNoteText').value.trim();
            const shouldLinkToTask = document.getElementById('manualNoteLinkTask').checked;

            if (!numeroAF) {
                alert('Veuillez entrer un numéro d\'affaire');
                return;
            }

            if (!noteText) {
                alert('Veuillez entrer une note');
                return;
            }

            // Nettoyer le numéro d'affaire AVANT de sauvegarder
            // Remplacer les espaces multiples par un seul espace
            numeroAF = numeroAF.replace(/\s+/g, ' ').trim().toUpperCase();
            // Remplacer les caractères invalides pour Windows
            numeroAF = numeroAF.replace(/[<>:"|?*]/g, '_');

            // Sauvegarder la note
            const now = new Date();
            const date = now.toLocaleDateString('fr-FR');
            const timeRange = 'Manuel';

            await this.saveNote(numeroAF, date, timeRange, noteText);

            // Si on a découvert une adresse via le fallback, la sauvegarder dans le cache
            if (this._tempAddressForSite && this._tempAddressForSite.address) {
                try {
                    const addressResponse = await fetch('/api/map/save-discovered-address', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            numeroAF: numeroAF || '',
                            siteName: this._tempAddressForSite.siteName,
                            address: this._tempAddressForSite.address
                        })
                    });

                    const addressData = await addressResponse.json();
                    if (addressData.success) {
                        console.log(`✅ Adresse sauvegardée dans le cache`);
                        this.showNotification('Adresse enregistrée', `L'adresse ${this._tempAddressForSite.address} a été ajoutée au cache`, 'success');
                    }
                } catch (error) {
                    console.error('Erreur sauvegarde adresse:', error);
                }

                // Nettoyer la variable temporaire
                delete this._tempAddressForSite;
            }

            manualNoteModal.hide();

            // Si case cochée, proposer de lier à une tâche
            if (shouldLinkToTask) {
                await this.offerTaskLinking(noteText, numeroAF);
            }

            this.showNotification('Note enregistrée', `Note ajoutée à ${numeroAF}`, 'success');
        };

        manualNoteModal.show();
    }

    setupManualNoteAutocomplete() {
        const input = document.getElementById('manualNoteProject');
        const datalist = document.getElementById('manualNoteProjectSuggestions');

        let searchTimeout = null;

        input.addEventListener('input', async () => {
            const searchText = input.value.trim().toLowerCase();

            // Si moins de 2 caractères, on vide les suggestions
            if (searchText.length < 2) {
                datalist.innerHTML = '';
                return;
            }

            // Annuler la recherche précédente
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            searchTimeout = setTimeout(async () => {
                const suggestions = new Set();

                // 1. Chercher dans l'historique de tâches locales
                try {
                    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
                        const date = new Date();
                        date.setDate(date.getDate() - dayOffset);

                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');

                        const response = await fetch(`/api/tasks/${year}/${month}/${day}`);
                        const data = await response.json();

                        if (data.success && data.tasks) {
                            data.tasks.forEach(task => {
                                const parsed = this.parseTaskDescription(task.description);
                                const desc = parsed.description.toLowerCase();

                                // Extraire les numéros AF
                                const afMatch = parsed.description.match(/AF\d+/i);
                                if (afMatch && afMatch[0].toLowerCase().includes(searchText)) {
                                    suggestions.add(afMatch[0].toUpperCase());
                                }

                                // Ajouter aussi les descriptions qui matchent
                                if (desc.includes(searchText)) {
                                    suggestions.add(parsed.description);
                                }
                            });
                        }

                        if (suggestions.size >= 5) break; // Limiter la recherche
                    }
                } catch (error) {
                    console.error('Erreur recherche tâches:', error);
                }

                // 2. Chercher dans les projets suivis
                try {
                    const response = await fetch('/api/notes/all');
                    const data = await response.json();

                    if (data.success && data.projects) {
                        data.projects.forEach(project => {
                            const numeroAF = project.numeroAF.toLowerCase();
                            if (numeroAF.includes(searchText)) {
                                suggestions.add(project.numeroAF);
                            }
                        });
                    }
                } catch (error) {
                    console.error('Erreur recherche projets:', error);
                }

                // 3. Chercher dans le cache NAS si disponible
                try {
                    const response = await fetch('/api/nas/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: searchText })
                    });

                    const data = await response.json();

                    if (data.success && data.results) {
                        for (const result of data.results.slice(0, 5)) {
                            if (result.Projet && result.Projet.toLowerCase().includes(searchText)) {
                                suggestions.add(`${result.Projet} - ${result.Chantier}`);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erreur recherche NAS:', error);
                }

                // Afficher les suggestions (max 10)
                datalist.innerHTML = '';
                const suggestionArray = Array.from(suggestions).slice(0, 10);

                suggestionArray.forEach(suggestion => {
                    const option = document.createElement('option');
                    option.value = suggestion;
                    datalist.appendChild(option);
                });
            }, 300); // Délai de 300ms
        });
    }

    async saveNote(numeroAF, date, timeRange, note) {
        try {
            // Essayer de récupérer le nom du chantier depuis le cache
            let nomChantier = null;

            // 1. Chercher dans projetsWebCache
            if (this.projetsWebCache && this.projetsWebCache[numeroAF]) {
                const projectData = this.projetsWebCache[numeroAF];
                if (projectData.extractedData && projectData.extractedData.adresseChantier) {
                    nomChantier = projectData.extractedData.adresseChantier;
                } else if (projectData.projectInfo && projectData.projectInfo.projectName) {
                    nomChantier = projectData.projectInfo.projectName;
                }
            }

            // 2. Si pas trouvé, chercher dans les projets récents
            if (!nomChantier && this.recentProjects) {
                const project = this.recentProjects.find(p => p.numeroAffaire === numeroAF);
                if (project) {
                    nomChantier = project.projectName;
                }
            }

            const response = await fetch('/api/notes/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numeroAF, nomChantier, date, timeRange, note })
            });

            const data = await response.json();

            if (data.success) {
                console.log('Note sauvegardée pour', numeroAF);
                if (document.getElementById('tabProjectTracking').classList.contains('active')) {
                    await this.loadAllProjects();
                }
            } else {
                alert('Erreur sauvegarde note : ' + data.error);
            }
        } catch (error) {
            console.error('Erreur saveNote:', error);
            alert('Erreur : ' + error.message);
        }
    }

    async updateNote(numeroAF, noteIndex, newNote) {
        try {
            const response = await fetch('/api/notes/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numeroAF, noteIndex, newNote })
            });

            const data = await response.json();

            if (data.success) {
                console.log('Note modifiée');
            } else {
                alert('Erreur modification note : ' + data.error);
            }
        } catch (error) {
            console.error('Erreur updateNote:', error);
            alert('Erreur : ' + error.message);
        }
    }

    async deleteNote(numeroAF, noteIndex) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette note ?')) return;

        try {
            const response = await fetch('/api/notes/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numeroAF, noteIndex })
            });

            const data = await response.json();

            if (data.success) {
                await this.viewProjectNotes(numeroAF);
            } else {
                alert('Erreur suppression note : ' + data.error);
            }
        } catch (error) {
            console.error('Erreur deleteNote:', error);
            alert('Erreur : ' + error.message);
        }
    }

    getLastTaskInfo() {
        if (this.tasks.length === 0) return null;
        
        for (let i = this.tasks.length - 1; i >= 0; i--) {
            const projectName = this.extractProjectName(this.tasks[i].description);
            if (!projectName.toLowerCase().includes('pause') && 
                !projectName.toLowerCase().includes('fin')) {
                
                let startTime = this.tasks[i].time;
                for (let j = i - 1; j >= 0; j--) {
                    const prevProject = this.extractProjectName(this.tasks[j].description);
                    if (prevProject === projectName) {
                        startTime = this.tasks[j].time;
                    } else {
                        break;
                    }
                }
                
                return {
                    projectName,
                    startTime,
                    endTime: this.tasks[i].time,
                    date: this.currentDate.toLocaleDateString('fr-FR')
                };
            }
        }
        
        return null;
    }

    // ===== BLOC-NOTES RAPIDE v2 =====
    
    loadQuickNotes() {
        // Charger les todos
        const todosJson = localStorage.getItem('quickNotes_todos');
        if (todosJson) {
            try {
                this.todos = JSON.parse(todosJson);
            } catch (e) {
                this.todos = [];
            }
        } else {
            this.todos = [];
        }
        this.renderTodos();

        // Charger le planning
        const planningJson = localStorage.getItem('quickNotes_planning');
        if (planningJson) {
            try {
                this.planning = JSON.parse(planningJson);
            } catch (e) {
                this.planning = {};
            }
        } else {
            this.planning = {};
        }
        this.renderPlanning();

        // Charger les notes libres
        const notes = localStorage.getItem('quickNotes_notes') || '';
        if (document.getElementById('quickNotesNotes')) {
            document.getElementById('quickNotesNotes').value = notes;
        }
    }

    saveQuickNotes() {
        localStorage.setItem('quickNotes_todos', JSON.stringify(this.todos));
        localStorage.setItem('quickNotes_planning', JSON.stringify(this.planning));
        const notes = document.getElementById('quickNotesNotes').value;
        localStorage.setItem('quickNotes_notes', notes);

        const btn = document.getElementById('saveQuickNotes');
        if (btn) {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            btn.classList.add('btn-success');
            btn.classList.remove('btn-outline-primary');

            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.remove('btn-success');
                btn.classList.add('btn-outline-primary');
            }, 1000);
        }
    }

    renderTodos() {
        const todoList = document.getElementById('todoList');
        if (!todoList) return;

        if (this.todos.length === 0) {
            todoList.innerHTML = '<div class="text-center text-muted small p-2">Aucune tâche</div>';
            return;
        }

        let html = '';
        for (let i = 0; i < this.todos.length; i++) {
            const todo = this.todos[i];
            const checkedClass = todo.done ? 'text-decoration-line-through text-muted' : '';
            html += `
                <div class="d-flex align-items-center mb-1 p-1 border-bottom">
                    <input type="checkbox" class="form-check-input me-2" ${todo.done ? 'checked' : ''} 
                           onchange="app.toggleTodo(${i})" style="cursor: pointer;">
                    <span class="flex-grow-1 small ${checkedClass}" style="cursor: pointer;" onclick="app.toggleTodo(${i})">${this.escapeHtml(todo.text)}</span>
                    <button class="btn btn-sm btn-link text-danger p-0" onclick="app.deleteTodo(${i})" title="Supprimer">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }
        todoList.innerHTML = html;
    }

    addTodo() {
        const input = document.getElementById('newTodoInput');
        const text = input.value.trim();
        
        if (text) {
            this.todos.push({ text, done: false });
            input.value = '';
            this.renderTodos();
            this.saveQuickNotes();
        }
    }

    toggleTodo(index) {
        this.todos[index].done = !this.todos[index].done;
        this.renderTodos();
        this.saveQuickNotes();
    }

    deleteTodo(index) {
        this.todos.splice(index, 1);
        this.renderTodos();
        this.saveQuickNotes();
    }

    renderPlanning() {
        const planningTable = document.getElementById('planningTable');
        if (!planningTable) return;

        let html = '';
        for (let h = 8; h <= 18; h++) {
            const hour = `${String(h).padStart(2, '0')}:00`;
            const value = this.planning[hour] || '';
            
            html += `
                <tr>
                    <td class="text-muted small" style="width: 60px;">${hour}</td>
                    <td>
                        <input type="text" class="form-control form-control-sm" 
                               value="${this.escapeHtml(value)}" 
                               onchange="app.updatePlanning('${hour}', this.value)"
                               placeholder="...">
                    </td>
                </tr>
            `;
        }
        planningTable.innerHTML = html;
    }

    updatePlanning(hour, value) {
        if (value.trim()) {
            this.planning[hour] = value.trim();
        } else {
            delete this.planning[hour];
        }
        this.saveQuickNotes();
    }

    initQuickNotes() {
        if (!document.getElementById('todoList')) {
            return;
        }

        this.todos = [];
        this.planning = {};
        this.loadQuickNotes();

        const newTodoInput = document.getElementById('newTodoInput');
        if (newTodoInput) {
            newTodoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addTodo();
                }
            });
        }

        const addTodoBtn = document.getElementById('addTodoBtn');
        if (addTodoBtn) {
            addTodoBtn.addEventListener('click', () => {
                this.addTodo();
            });
        }

        const saveBtn = document.getElementById('saveQuickNotes');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveQuickNotes();
            });
        }

        setInterval(() => {
            if (document.getElementById('quickNotesNotes')) {
                this.saveQuickNotes();
            }
        }, 30000);
    }
}

// Initialiser l'application
const app = new TrackHourApp();



