// TrackHour AI Assistant - Frontend
// Interface utilisateur pour l'assistant IA

class TrackHourAI {
    constructor() {
        this.initialized = false;
        this.analyzing = false;
        this.suggestions = [];
        this.stats = null;
    }

    /**
     * Initialise l'assistant IA
     */
    async init() {
        console.log('🤖 Initialisation de l\'assistant IA...');

        // Charger les stats initiales
        await this.loadStats();

        this.initialized = true;
        console.log('✅ Assistant IA prêt');
    }

    /**
     * Lance l'analyse complète de l'historique
     */
    async analyzeHistory() {
        if (this.analyzing) {
            console.log('⚠️ Analyse déjà en cours');
            return;
        }

        this.analyzing = true;
        this.showAnalysisProgress();

        try {
            console.log('🔍 Lancement de l\'analyse de l\'historique...');
            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                const msg = data.message || 'Analyse terminée';
                console.log('✅ Analyse terminée !', data);
                this.hideAnalysisProgress();

                const details = data.stats ?
                    `${data.stats.filesAnalyzed} fichiers analysés, ${data.stats.filesSkipped} ignorés` :
                    'L\'IA a analysé votre historique';

                this.showNotification('✅ Analyse terminée !', details, 'success');

                // Recharger les stats
                await this.loadStats();
            } else {
                throw new Error(data.error || 'Erreur inconnue');
            }
        } catch (error) {
            console.error('❌ Erreur analyse:', error);
            this.hideAnalysisProgress();
            this.showNotification('❌ Erreur', 'Impossible d\'analyser l\'historique : ' + error.message, 'error');
        } finally {
            this.analyzing = false;
        }
    }

    /**
     * Génère des suggestions pour un projet
     */
    async generateSuggestions(projectData, currentTasks = []) {
        try {
            console.log('💡 Génération de suggestions pour', projectData.projectName);

            const response = await fetch('/api/ai/suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectData, currentTasks })
            });

            const data = await response.json();

            if (data.success) {
                this.suggestions = data.suggestions;
                console.log(`✅ ${data.count} suggestion(s) générée(s)`);
                return this.suggestions;
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('❌ Erreur suggestions:', error);
            return [];
        }
    }

    /**
     * Génère un email
     */
    async generateEmail(template, projectData, recipientData) {
        try {
            console.log('✉️ Génération d\'email (template:', template + ')');

            const response = await fetch('/api/ai/email/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template, projectData, recipientData })
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ Email généré');
                return data.email;
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('❌ Erreur génération email:', error);
            return null;
        }
    }

    /**
     * Enregistre une validation de suggestion
     */
    async validateSuggestion(suggestionId, action, feedback = null) {
        try {
            const response = await fetch('/api/ai/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suggestionId, action, feedback })
            });

            const data = await response.json();

            if (data.success) {
                console.log('📊 Validation enregistrée');
                // Recharger les stats
                await this.loadStats();
            }
        } catch (error) {
            console.error('❌ Erreur validation:', error);
        }
    }

    /**
     * Charge les statistiques de l'IA
     */
    async loadStats() {
        try {
            const response = await fetch('/api/ai/stats');
            const data = await response.json();

            if (data.success) {
                this.stats = data.stats;
                console.log('📊 Stats IA chargées:', this.stats);
            }
        } catch (error) {
            console.error('❌ Erreur chargement stats:', error);
        }
    }

    /**
     * Affiche le panneau d'assistant pour un projet
     */
    async showAssistantPanel(projectData) {
        // Générer les suggestions
        const suggestions = await this.generateSuggestions(projectData);

        // Créer le panneau
        const panelHtml = this._buildAssistantPanel(projectData, suggestions);

        // Afficher dans un modal
        this._showModal('Assistant IA', panelHtml);
    }

    /**
     * Construit le HTML du panneau d'assistant
     */
    _buildAssistantPanel(projectData, suggestions) {
        if (suggestions.length === 0) {
            return `
                <div class="ai-empty-state">
                    <i class="fas fa-robot fa-3x mb-3 text-muted"></i>
                    <p class="text-muted">Aucune suggestion pour le moment.</p>
                    <p class="small text-muted">L'IA apprend de vos habitudes et générera des suggestions au fur et à mesure.</p>
                </div>
            `;
        }

        let html = '<div class="ai-suggestions-list">';

        // Grouper par priorité
        const highPriority = suggestions.filter(s => s.priority === 'high');
        const mediumPriority = suggestions.filter(s => s.priority === 'medium');
        const lowPriority = suggestions.filter(s => s.priority === 'low');

        if (highPriority.length > 0) {
            html += '<h6 class="text-danger mb-3"><i class="fas fa-exclamation-circle me-2"></i>Priorité haute</h6>';
            html += this._buildSuggestionCards(highPriority, 'danger');
        }

        if (mediumPriority.length > 0) {
            html += '<h6 class="text-warning mb-3 mt-4"><i class="fas fa-star me-2"></i>Priorité moyenne</h6>';
            html += this._buildSuggestionCards(mediumPriority, 'warning');
        }

        if (lowPriority.length > 0) {
            html += '<h6 class="text-info mb-3 mt-4"><i class="fas fa-info-circle me-2"></i>Informations</h6>';
            html += this._buildSuggestionCards(lowPriority, 'info');
        }

        html += '</div>';

        return html;
    }

    _buildSuggestionCards(suggestions, colorClass) {
        let html = '';

        for (const suggestion of suggestions) {
            const suggestionId = `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            html += `
                <div class="card mb-3 border-${colorClass}">
                    <div class="card-body">
                        <h6 class="card-title">
                            ${this._getSuggestionIcon(suggestion.type)}
                            ${suggestion.title}
                        </h6>
                        <p class="card-text small text-muted">${suggestion.description}</p>

                        <div class="d-flex gap-2 mt-3">
                            ${this._buildActionButtons(suggestion, suggestionId)}
                        </div>
                    </div>
                </div>
            `;
        }

        return html;
    }

    _getSuggestionIcon(type) {
        const icons = {
            'action': '<i class="fas fa-tasks text-primary"></i>',
            'email': '<i class="fas fa-envelope text-success"></i>',
            'insight': '<i class="fas fa-lightbulb text-warning"></i>',
            'alert': '<i class="fas fa-exclamation-triangle text-danger"></i>'
        };
        return icons[type] || '<i class="fas fa-question-circle"></i>';
    }

    _buildActionButtons(suggestion, suggestionId) {
        let buttons = '';

        if (suggestion.type === 'email') {
            buttons += `
                <button class="btn btn-sm btn-success" onclick="trackHourAI.handleEmailSuggestion('${suggestionId}', ${JSON.stringify(suggestion).replace(/"/g, '&quot;')})">
                    <i class="fas fa-envelope me-1"></i>Générer l'email
                </button>
            `;
        }

        if (suggestion.type === 'action') {
            buttons += `
                <button class="btn btn-sm btn-primary" onclick="trackHourAI.handleActionSuggestion('${suggestionId}', ${JSON.stringify(suggestion).replace(/"/g, '&quot;')})">
                    <i class="fas fa-check me-1"></i>Exécuter
                </button>
            `;
        }

        buttons += `
            <button class="btn btn-sm btn-outline-secondary" onclick="trackHourAI.validateSuggestion('${suggestionId}', 'rejected')">
                <i class="fas fa-times me-1"></i>Ignorer
            </button>
        `;

        return buttons;
    }

    /**
     * Gère une suggestion d'action
     */
    async handleActionSuggestion(suggestionId, suggestion) {
        console.log('Exécution d\'action pour suggestion:', suggestionId);

        // Pour l'instant, juste valider
        await this.validateSuggestion(suggestionId, 'accepted');

        this.showNotification('Action enregistrée', 'L\'action a été prise en compte.', 'success');
    }

    /**
     * Gère une suggestion d'email
     */
    async handleEmailSuggestion(suggestionId, suggestion) {
        console.log('Génération d\'email pour suggestion:', suggestionId);

        // Récupérer les données du projet actuel depuis le badge vert
        const badge = document.getElementById('projectWebBadge');
        if (!badge) {
            alert('Impossible de récupérer les données du projet');
            return;
        }

        // Pour l'instant, on affiche juste un modal avec l'email généré
        const email = await this.generateEmail(
            suggestion.data.template,
            window.currentProjectData, // On devra stocker ça quelque part
            suggestion.data
        );

        if (email) {
            this._showEmailModal(email);
            await this.validateSuggestion(suggestionId, 'accepted');
        }
    }

    /**
     * Affiche un modal avec l'email généré
     */
    _showEmailModal(email) {
        const modalHtml = `
            <div class="mb-3">
                <label class="form-label fw-bold">Destinataire</label>
                <input type="text" class="form-control" value="${email.to}" readonly>
            </div>
            <div class="mb-3">
                <label class="form-label fw-bold">Objet</label>
                <input type="text" class="form-control" id="emailSubject" value="${email.subject}">
            </div>
            <div class="mb-3">
                <label class="form-label fw-bold">Message</label>
                <textarea class="form-control" id="emailBody" rows="10">${email.body}</textarea>
            </div>
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <small>Copiez ce texte dans votre client email. L'envoi automatique nécessite une configuration SMTP.</small>
            </div>
            <button class="btn btn-primary" onclick="trackHourAI.copyEmailToClipboard()">
                <i class="fas fa-copy me-2"></i>Copier dans le presse-papier
            </button>
        `;

        this._showModal('Email généré', modalHtml);
    }

    /**
     * Copie l'email dans le presse-papier
     */
    copyEmailToClipboard() {
        const subject = document.getElementById('emailSubject').value;
        const body = document.getElementById('emailBody').value;
        const fullText = `Objet: ${subject}\n\n${body}`;

        navigator.clipboard.writeText(fullText).then(() => {
            this.showNotification('Copié !', 'L\'email a été copié dans le presse-papier', 'success');
        });
    }

    /**
     * Affiche le panneau de statistiques IA
     */
    async showStatsPanel() {
        await this.loadStats();

        if (!this.stats) {
            alert('Aucune statistique disponible. Lancez d\'abord une analyse.');
            return;
        }

        const html = `
            <div class="ai-stats">
                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="card bg-primary text-white">
                            <div class="card-body text-center">
                                <h3 class="mb-0">${this.stats.totalValidations}</h3>
                                <small>Suggestions validées</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card bg-success text-white">
                            <div class="card-body text-center">
                                <h3 class="mb-0">${this.stats.acceptanceRate}%</h3>
                                <small>Taux d'acceptation</small>
                            </div>
                        </div>
                    </div>
                </div>

                ${this.stats.mostCommonTasks && this.stats.mostCommonTasks.length > 0 ? `
                <h6 class="mb-3">Tâches les plus fréquentes</h6>
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Catégorie</th>
                            <th>Nombre</th>
                            <th>Durée moyenne</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.stats.mostCommonTasks.map(task => `
                            <tr>
                                <td><span class="badge bg-secondary">${task.category}</span></td>
                                <td>${task.count}</td>
                                <td>${Math.floor(task.avgDuration / 60)}h${task.avgDuration % 60}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}

                ${this.stats.peakWorkingHours && this.stats.peakWorkingHours.length > 0 ? `
                <h6 class="mb-3 mt-4">Heures de travail préférées</h6>
                <div class="d-flex gap-2">
                    ${this.stats.peakWorkingHours.map(hour => `
                        <div class="badge bg-info">${hour.hour} (${hour.count} tâches)</div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        `;

        this._showModal('Statistiques IA', html);
    }

    // ========== HELPERS ==========

    showAnalysisProgress() {
        // Afficher un indicateur de progression
        const indicator = document.createElement('div');
        indicator.id = 'aiAnalysisIndicator';
        indicator.className = 'alert alert-info position-fixed bottom-0 end-0 m-3';
        indicator.style.zIndex = '9999';
        indicator.innerHTML = `
            <i class="fas fa-spinner fa-spin me-2"></i>
            <strong>Analyse en cours...</strong>
            <p class="mb-0 small">L'IA analyse votre historique de tâches...</p>
        `;
        document.body.appendChild(indicator);
    }

    hideAnalysisProgress() {
        const indicator = document.getElementById('aiAnalysisIndicator');
        if (indicator) indicator.remove();
    }

    showNotification(title, message, type = 'info') {
        const colors = {
            success: 'success',
            error: 'danger',
            info: 'info'
        };

        const notification = document.createElement('div');
        notification.className = `alert alert-${colors[type]} alert-dismissible position-fixed bottom-0 end-0 m-3`;
        notification.style.zIndex = '9999';
        notification.innerHTML = `
            <strong>${title}</strong>
            <p class="mb-0 small">${message}</p>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 5000);
    }

    _showModal(title, content) {
        // Créer un modal Bootstrap dynamique
        const modalId = 'aiModal_' + Date.now();
        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-robot me-2"></i>${title}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${content}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();

        // Supprimer le modal du DOM après fermeture
        document.getElementById(modalId).addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }
}

// Instance globale
const trackHourAI = new TrackHourAI();
