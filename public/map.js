// ═══════════════════════════════════════════════════════════════
// MODULE CARTE DES CHANTIERS - LEAFLET.JS - VERSION CORRIGÉE
// ═══════════════════════════════════════════════════════════════

class MapManager {
    constructor() {
        this.map = null;
        this.markers = [];
        this.sites = [];
        this.currentSite = null;
        this.siteModal = null;
        this.detailsModal = null;
    }

    async init() {
        console.log('🗺️ Initialisation du module Carte...');
        
        // Vérifier la visibilité du conteneur
        const mapContainer = document.getElementById('map');
        console.log('👀 Conteneur #map:', mapContainer);
        console.log('📊 Dimensions:', {
            width: mapContainer.offsetWidth,
            height: mapContainer.offsetHeight,
            visible: window.getComputedStyle(mapContainer.parentElement).display
        });
        
        // S'assurer que le conteneur a une taille minimale
        if (mapContainer.offsetHeight === 0) {
            console.warn('⚠️ Le conteneur #map a une hauteur de 0px !');
            mapContainer.style.height = '600px';
            mapContainer.style.minHeight = '600px';
        }
        
        // Initialiser la carte Leaflet centrée sur la France
        this.map = L.map('map', {
            preferCanvas: true,
            zoomControl: true
        }).setView([46.603354, 1.888334], 6);

        // Ajouter le fond de carte OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);

        // Forcer le recalcul de la taille après un court délai
        setTimeout(() => {
            if (this.map) {
                this.map.invalidateSize();
                console.log('🔄 Taille de la carte recalculée après initialisation');
            }
        }, 300);

        // Initialiser les modals
        this.siteModal = new bootstrap.Modal(document.getElementById('siteModal'));
        this.detailsModal = new bootstrap.Modal(document.getElementById('siteDetailsModal'));

        // Charger les sites depuis le serveur
        await this.loadSites();

        // Attacher les événements
        this.attachEvents();

        console.log('✅ Module Carte initialisé');
    }

    attachEvents() {
        // Bouton ajouter un site
        const addBtn = document.getElementById('addSiteBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.showAddSiteModal();
            });
        }

        // Bouton sauvegarder
        const saveBtn = document.getElementById('saveSiteBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSite();
            });
        }

        // Bouton actualiser
        const refreshBtn = document.getElementById('refreshMapBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadSites();
            });
        }
        
        // Bouton vérifier les statuts
        const checkBtn = document.getElementById('checkAllStatusBtn');
        if (checkBtn) {
            console.log('✅ Bouton checkAllStatusBtn trouvé et lié');
            checkBtn.addEventListener('click', () => {
                console.log('🔍 Clic sur vérifier les statuts détecté !');
                this.checkAllStatus();
            });
        } else {
            console.error('❌ Bouton checkAllStatusBtn introuvable !');
        }

        // Bouton modifier (dans la modal de détails)
        const editBtn = document.getElementById('editSiteBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.detailsModal.hide();
                this.showEditSiteModal(this.currentSite);
            });
        }

        // Bouton recherche d'adresse
        const searchBtn = document.getElementById('searchAddressBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.searchAddressAuto();
            });
        }

        // Autocomplétion nom chantier
        const siteNameInput = document.getElementById('siteName');
        if (siteNameInput) {
            siteNameInput.addEventListener('input', async (e) => {
                const query = e.target.value.trim();
                if (query.length >= 3) {
                    await this.searchSiteInCache(query);
                }
            });
        }

        // Bouton supprimer (dans la modal de détails)
        const deleteBtn = document.getElementById('deleteSiteBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteSite(this.currentSite.id);
            });
        }

        // Filtres
        document.getElementById('mapSearch').addEventListener('input', (e) => {
            this.filterSites();
        });

        document.getElementById('mapClientFilter').addEventListener('change', () => {
            this.filterSites();
        });

        document.getElementById('mapStatusFilter').addEventListener('change', () => {
            this.filterSites();
        });
    }

    async loadSites() {
        try {
            const response = await fetch('/api/map/sites');
            const data = await response.json();
            
            if (data.success) {
                this.sites = data.sites || [];
                this.displaySites();
                this.updateClientFilter();
                console.log(`✅ ${this.sites.length} site(s) chargé(s)`);
            }
        } catch (error) {
            console.error('Erreur chargement sites:', error);
            this.showError('Erreur lors du chargement des sites');
        }
    }

    displaySites() {
        // Effacer les marqueurs existants
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        // Ajouter les nouveaux marqueurs
        this.sites.forEach(site => {
            if (site.latitude && site.longitude) {
                const marker = this.createMarker(site);
                this.markers.push(marker);
            }
        });

        // Mettre à jour la liste
        this.updateSitesList();

        // Mettre à jour le compteur
        document.getElementById('siteCount').textContent = this.sites.length;
    }

    createMarker(site) {
        // Icône personnalisée selon le statut
        const iconColor = this.getStatusColor(site.status);
        
        const marker = L.marker([site.latitude, site.longitude], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: `<div style="background: ${iconColor}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).addTo(this.map);

        // Popup au clic (sans ouvrir automatiquement les détails)
        marker.bindPopup(this.createPopupContent(site));

        return marker;
    }

    createPopupContent(site) {
        const statusBadge = this.getStatusBadge(site.status);
        const statusLabel = this.getStatusLabel(site.status);
        
        let html = `
            <div style="min-width: 280px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h6 style="color: #0d6efd; font-weight: bold; margin: 0;">
                        ${site.name}
                    </h6>
                    <span class="badge bg-${statusBadge}" style="font-size: 0.7rem;">${statusLabel}</span>
                </div>
                <p style="margin: 5px 0; font-size: 0.9rem;">
                    <strong>Client:</strong> ${site.client}
                </p>
        `;

        if (site.numeroAF) {
            html += `<p style="margin: 5px 0; font-size: 0.9rem;"><strong>AF:</strong> ${site.numeroAF}</p>`;
        }

        if (site.address) {
            html += `<p style="margin: 5px 0; font-size: 0.85rem; color: #666;"><i class="fas fa-map-marker-alt"></i> ${site.address}</p>`;
        }

        if (site.remoteAccess) {
            html += `
                <div style="margin-top: 10px; display: flex; gap: 5px;">
                    <a href="${site.remoteAccess}" target="_blank" 
                       style="flex: 1; display: inline-block; padding: 6px 12px; background: #0d6efd; color: white; text-decoration: none; border-radius: 4px; font-size: 0.85rem; text-align: center;">
                        <i class="fas fa-desktop"></i> Accès
                    </a>
                    <button onclick="mapManager.showSiteDetails(mapManager.sites.find(s => s.id === ${site.id}))" 
                       style="flex: 1; padding: 6px 12px; background: #6c757d; color: white; border: none; border-radius: 4px; font-size: 0.85rem; cursor: pointer;">
                        <i class="fas fa-info-circle"></i> Détails
                    </button>
                </div>
            `;
        } else {
            html += `
                <button onclick="mapManager.showSiteDetails(mapManager.sites.find(s => s.id === ${site.id}))" 
                   style="width: 100%; margin-top: 10px; padding: 6px 12px; background: #6c757d; color: white; border: none; border-radius: 4px; font-size: 0.85rem; cursor: pointer;">
                    <i class="fas fa-info-circle"></i> Voir les détails
                </button>
            `;
        }

        html += `</div>`;
        return html;
    }

    getStatusColor(status) {
        const colors = {
            'online': '#28a745',
            'offline': '#6c757d'
        };
        return colors[status] || '#007bff';
    }

    updateSitesList() {
        const container = document.getElementById('sitesList');
        
        if (this.sites.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted p-4">
                    <i class="fas fa-map fa-3x mb-3 d-block"></i>
                    <p>Aucun site enregistré</p>
                </div>
            `;
            return;
        }

        let html = '<div class="list-group list-group-flush">';
        
        this.sites.forEach(site => {
            html += `
                <a href="#" class="list-group-item list-group-item-action" data-site-id="${site.id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${site.name}</h6>
                        <small class="badge bg-${this.getStatusBadge(site.status)}">${this.getStatusLabel(site.status)}</small>
                    </div>
                    <p class="mb-1 small">${site.client}</p>
                    ${site.address ? `<small class="text-muted"><i class="fas fa-map-marker-alt"></i> ${site.address}</small>` : ''}
                </a>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        // Attacher les clics
        container.querySelectorAll('[data-site-id]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const siteId = parseInt(item.dataset.siteId);
                const site = this.sites.find(s => s.id === siteId);
                if (site) {
                    this.showSiteDetails(site);
                    // Centrer la carte sur le site
                    if (site.latitude && site.longitude) {
                        this.map.setView([site.latitude, site.longitude], 14);
                    }
                }
            });
        });
    }

    getStatusBadge(status) {
        const badges = {
            'online': 'success',
            'offline': 'secondary'
        };
        return badges[status] || 'primary';
    }

    getStatusLabel(status) {
        const labels = {
            'online': 'Fonctionnel',
            'offline': 'Down'
        };
        return labels[status] || status;
    }

    showAddSiteModal() {
        document.getElementById('siteModalTitle').textContent = 'Ajouter un site';
        document.getElementById('siteForm').reset();
        document.getElementById('siteId').value = '';
        this.siteModal.show();
    }

    showEditSiteModal(site) {
        document.getElementById('siteModalTitle').textContent = 'Modifier le site';
        document.getElementById('siteId').value = site.id;
        document.getElementById('siteName').value = site.name;
        document.getElementById('siteClient').value = site.client;
        document.getElementById('siteAddress').value = site.address || '';
        document.getElementById('siteNumeroAF').value = site.numeroAF || '';
        document.getElementById('siteStatus').value = site.status;
        document.getElementById('siteRemoteAccess').value = site.remoteAccess || '';
        document.getElementById('siteNotes').value = site.notes || '';
        this.siteModal.show();
    }

    async saveSite() {
        const siteId = document.getElementById('siteId').value;
        const siteData = {
            name: document.getElementById('siteName').value,
            client: document.getElementById('siteClient').value,
            address: document.getElementById('siteAddress').value,
            numeroAF: document.getElementById('siteNumeroAF').value,
            status: document.getElementById('siteStatus').value,
            remoteAccess: document.getElementById('siteRemoteAccess').value,
            notes: document.getElementById('siteNotes').value
        };

        if (!siteData.name || !siteData.client || !siteData.address) {
            alert('Veuillez remplir tous les champs obligatoires');
            return;
        }

        try {
            const url = siteId ? `/api/map/sites/${siteId}` : '/api/map/sites';
            const method = siteId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(siteData)
            });

            const data = await response.json();

            if (data.success) {
                this.siteModal.hide();
                await this.loadSites();
                this.showSuccess(siteId ? 'Site modifié avec succès' : 'Site ajouté avec succès');
            } else {
                this.showError(data.error || 'Erreur lors de la sauvegarde');
            }
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            this.showError('Erreur lors de la sauvegarde du site');
        }
    }

    async searchAddressAuto() {
        const siteName = document.getElementById('siteName').value.trim();
        const client = document.getElementById('siteClient').value.trim();
        const numeroAF = document.getElementById('siteNumeroAF').value.trim();

        if (!siteName) {
            alert('Veuillez entrer un nom de chantier');
            return;
        }

        const btn = document.getElementById('searchAddressBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const response = await fetch('/api/search-address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client, siteName, numeroAF })
            });

            const data = await response.json();

            if (data.success && data.address) {
                document.getElementById('siteAddress').value = data.address;
                this.showSuccess(`Adresse trouvée via ${data.geocoder}`);
            } else {
                this.showError('Adresse introuvable avec les moteurs de recherche');
            }
        } catch (error) {
            console.error('Erreur recherche adresse:', error);
            this.showError('Erreur lors de la recherche');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-search"></i>';
        }
    }

    async searchSiteInCache(query) {
        try {
            const response = await fetch('/api/nas/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ searchText: query, clientFilter: '' })
            });

            const data = await response.json();

            if (data.success && data.results.length > 0) {
                const first = data.results[0];
                if (first.Chantier && !document.getElementById('siteClient').value) {
                    document.getElementById('siteClient').value = first.Client || '';
                }
                if (first.NumAffaire && !document.getElementById('siteNumeroAF').value) {
                    document.getElementById('siteNumeroAF').value = first.NumAffaire;
                }
            }
        } catch (error) {
            console.error('Erreur recherche cache:', error);
        }
    }

    async deleteSite(siteId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce site ?')) {
            return;
        }

        try {
            const response = await fetch(`/api/map/sites/${siteId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                this.detailsModal.hide();
                await this.loadSites();
                this.showSuccess('Site supprimé avec succès');
            } else {
                this.showError(data.error || 'Erreur lors de la suppression');
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            this.showError('Erreur lors de la suppression du site');
        }
    }

    async showSiteDetails(site) {
        this.currentSite = site;
        document.getElementById('siteDetailsTitle').textContent = site.name;

        let html = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="text-muted mb-3">Informations générales</h6>
                    <p><strong>Client:</strong> ${site.client}</p>
                    <p><strong>Statut:</strong> <span class="badge bg-${this.getStatusBadge(site.status)}">${this.getStatusLabel(site.status)}</span></p>
                    ${site.numeroAF ? `<p><strong>Numéro AF:</strong> ${site.numeroAF}</p>` : '<p id="numeroAFSearchContainer"><strong>Numéro AF:</strong> <span class="text-muted">Non défini</span> <button class="btn btn-sm btn-outline-primary ms-2" onclick="mapManager.searchNumeroAF()"><i class="fas fa-search me-1"></i>Rechercher</button></p>'}
                    ${site.address ? `<p><strong>Adresse:</strong><br>${site.address}</p>` : ''}
                </div>
                <div class="col-md-6">
                    <h6 class="text-muted mb-3">Accès à distance</h6>
                    ${site.remoteAccess ? `
                        <p>
                            <a href="${site.remoteAccess}" target="_blank" class="btn btn-primary btn-sm">
                                <i class="fas fa-desktop me-2"></i>Ouvrir l'accès distant
                            </a>
                        </p>
                    ` : '<p class="text-muted">Aucun accès distant configuré</p>'}
                </div>
            </div>
        `;

        if (site.notes) {
            html += `
                <hr>
                <h6 class="text-muted mb-3">Notes</h6>
                <div class="alert alert-info">${site.notes.replace(/\n/g, '<br>')}</div>
            `;
        }

        document.getElementById('siteDetailsContent').innerHTML = html;
        this.detailsModal.show();

        // Recherche automatique du numéro AF si absent
        if (!site.numeroAF) {
            await this.searchNumeroAF();
        }
    }

    async searchNumeroAF() {
        if (!this.currentSite) return;

        const container = document.getElementById('numeroAFSearchContainer');
        if (!container) return;

        // Afficher un indicateur de chargement
        container.innerHTML = '<strong>Numéro AF:</strong> <span class="text-muted"><i class="fas fa-spinner fa-spin me-1"></i>Recherche en cours...</span>';

        try {
            const response = await fetch('/api/map/search-by-name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteName: this.currentSite.name,
                    client: this.currentSite.client
                })
            });

            const result = await response.json();

            if (result.success && result.found) {
                // Sauvegarder automatiquement
                container.innerHTML = `
                    <strong>Numéro AF:</strong>
                    <span class="badge bg-success me-2">${result.numeroAF}</span>
                    <small class="text-muted"><i class="fas fa-spinner fa-spin me-1"></i>Sauvegarde automatique...</small>
                `;

                // Sauvegarder immédiatement
                await this.saveNumeroAF(result.numeroAF, result.source);
            } else {
                // Aucun résultat trouvé
                container.innerHTML = `
                    <strong>Numéro AF:</strong>
                    <span class="text-warning"><i class="fas fa-exclamation-triangle me-1"></i>Non trouvé dans les caches</span>
                    <button class="btn btn-sm btn-outline-primary ms-2" onclick="mapManager.searchNumeroAF()">
                        <i class="fas fa-redo me-1"></i>Réessayer
                    </button>
                `;
            }
        } catch (error) {
            console.error('Erreur recherche numéro AF:', error);
            container.innerHTML = `
                <strong>Numéro AF:</strong>
                <span class="text-danger"><i class="fas fa-times me-1"></i>Erreur de recherche</span>
                <button class="btn btn-sm btn-outline-primary ms-2" onclick="mapManager.searchNumeroAF()">
                    <i class="fas fa-redo me-1"></i>Réessayer
                </button>
            `;
        }
    }

    async saveNumeroAF(numeroAF, source = 'cache') {
        if (!this.currentSite) return;

        try {
            const response = await fetch(`/api/map/sites/${this.currentSite.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...this.currentSite,
                    numeroAF: numeroAF
                })
            });

            const result = await response.json();

            if (result.success) {
                // Mettre à jour le site dans la liste
                const siteIndex = this.sites.findIndex(s => s.id === this.currentSite.id);
                if (siteIndex !== -1) {
                    this.sites[siteIndex].numeroAF = numeroAF;
                    this.currentSite.numeroAF = numeroAF;
                }

                // Afficher un message de succès
                const container = document.getElementById('numeroAFSearchContainer');
                if (container) {
                    container.innerHTML = `<strong>Numéro AF:</strong> <span class="badge bg-primary">${numeroAF}</span> <small class="text-success"><i class="fas fa-check me-1"></i>Auto-sauvegardé (${source})</small>`;
                }

                this.showSuccess(`Numéro d'affaire ${numeroAF} trouvé et sauvegardé automatiquement depuis ${source}`);

                // Recharger les sites après 2 secondes
                setTimeout(() => this.loadSites(), 2000);
            } else {
                this.showError(result.error || 'Erreur lors de la sauvegarde');
            }
        } catch (error) {
            console.error('Erreur sauvegarde numéro AF:', error);
            this.showError('Erreur lors de la sauvegarde du numéro d\'affaire');
        }
    }

    updateClientFilter() {
        const select = document.getElementById('mapClientFilter');
        const clients = [...new Set(this.sites.map(s => s.client))].sort();

        let html = '<option value="">Tous les clients</option>';
        clients.forEach(client => {
            html += `<option value="${client}">${client}</option>`;
        });

        select.innerHTML = html;
    }

    filterSites() {
        const searchText = document.getElementById('mapSearch').value.toLowerCase();
        const clientFilter = document.getElementById('mapClientFilter').value;
        const statusFilter = document.getElementById('mapStatusFilter').value;

        // Filtrer et afficher
        const filtered = this.sites.filter(site => {
            const matchSearch = !searchText || 
                site.name.toLowerCase().includes(searchText) ||
                site.client.toLowerCase().includes(searchText) ||
                (site.numeroAF && site.numeroAF.toLowerCase().includes(searchText));

            const matchClient = !clientFilter || site.client === clientFilter;
            const matchStatus = !statusFilter || site.status === statusFilter;

            return matchSearch && matchClient && matchStatus;
        });

        // Mettre à jour l'affichage
        this.sites = filtered;
        this.displaySites();
    }

    async checkAllStatus() {
        const btn = document.getElementById('checkAllStatusBtn');
        const progressDiv = document.createElement('div');
        progressDiv.id = 'statusCheckProgress';
        progressDiv.className = 'alert alert-info position-fixed top-0 start-50 translate-middle-x mt-3';
        progressDiv.style.zIndex = '9999';
        progressDiv.style.minWidth = '400px';
        progressDiv.innerHTML = `
            <div class="mb-2"><i class="fas fa-spinner fa-spin me-2"></i>Vérification en cours...</div>
            <div class="progress">
                <div id="progressBar" class="progress-bar progress-bar-striped progress-bar-animated"
                     style="width: 0%">0%</div>
            </div>
        `;
        document.body.appendChild(progressDiv);

        if (btn) btn.disabled = true;

        try {
            const sitesWithRemote = this.sites.filter(s => s.remoteAccess);
            const total = sitesWithRemote.length;
            let checked = 0;

            const progressBar = document.getElementById('progressBar');

            for (const site of sitesWithRemote) {
                try {
                    const response = await fetch('/api/check-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: site.remoteAccess })
                    });
                    const data = await response.json();

                    const newStatus = data.online ? 'online' : 'offline';
                    if (newStatus !== site.status) {
                        await fetch(`/api/map/sites/${site.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...site, status: newStatus })
                        });
                    }
                } catch (err) {
                    console.error(`Erreur check ${site.name}:`, err);
                }

                checked++;
                const percent = Math.round((checked / total) * 100);
                progressBar.style.width = percent + '%';
                progressBar.textContent = percent + '%';
            }

            progressDiv.remove();
            await this.loadSites();
            this.showSuccess(`✅ ${total} sites vérifiés`);
        } catch (error) {
            progressDiv.remove();
            this.showError('Erreur: ' + error.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    }
    
    showSuccess(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-success position-fixed top-0 start-50 translate-middle-x mt-3';
        alert.style.zIndex = '9999';
        alert.innerHTML = `<i class="fas fa-check-circle me-2"></i>${message}`;
        document.body.appendChild(alert);

        setTimeout(() => {
            alert.remove();
        }, 5000);
    }
    
    showInfo(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-info position-fixed top-0 start-50 translate-middle-x mt-3';
        alert.style.zIndex = '9999';
        alert.innerHTML = `<i class="fas fa-info-circle me-2"></i>${message}`;
        document.body.appendChild(alert);

        setTimeout(() => {
            alert.remove();
        }, 3000);
    }

    showError(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger position-fixed top-0 start-50 translate-middle-x mt-3';
        alert.style.zIndex = '9999';
        alert.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>${message}`;
        document.body.appendChild(alert);

        setTimeout(() => {
            alert.remove();
        }, 3000);
    }
}

// Initialiser le gestionnaire de carte
window.mapManager = null;

// Écouter le changement d'onglet
document.addEventListener('DOMContentLoaded', () => {
    const tabMap = document.getElementById('tabMap');
    if (tabMap) {
        tabMap.addEventListener('click', async () => {
            if (!window.mapManager) {
                // Attendre un peu que l'onglet soit visible
                setTimeout(async () => {
                    window.mapManager = new MapManager();
                    await window.mapManager.init();
                    
                    // Forcer le recalcul de la taille de la carte après initialisation
                    setTimeout(() => {
                        if (window.mapManager && window.mapManager.map) {
                            window.mapManager.map.invalidateSize();
                            console.log('🗺️ Taille de la carte recalculée');
                        }
                    }, 500);
                }, 150);
            } else {
                // Si la carte existe déjà, juste recalculer sa taille
                if (window.mapManager && window.mapManager.map) {
                    setTimeout(() => {
                        window.mapManager.map.invalidateSize();
                        console.log('🗺️ Taille de la carte recalculée (réaffichage)');
                    }, 150);
                }
            }
        });
    }
});
