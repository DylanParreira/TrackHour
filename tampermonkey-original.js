// ==UserScript==
// @name         TrackHour - Extracteur Automatique de Tâches v2
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Extrait automatiquement les tâches et infos projet depuis le site de gestion vers TrackHour
// @author       Vous
// @match        https://projets.applitec-automatisme.com/projects/*
// @grant        GM_xmlhttpRequest
// @grant        window.close
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

    console.log('🚀 TrackHour v2.1 - Script actif');

    // Vérifier si on est bien sur une page projet
    const urlMatch = window.location.href.match(/\/projects\/(\d+)/);
    if (!urlMatch) return;

    const projectId = urlMatch[1];

    // Vérifier si on vient de TrackHour (paramètre dans l'URL)
    const urlParams = new URLSearchParams(window.location.search);
    const autoExtract = urlParams.get('trackhour_auto');

    // 🆕 Fonction pour extraire les informations enrichies du projet
    function extractProjectInfo() {
        const info = {
            numeroAF: 'INCONNU',
            dateCreation: null,
            dateLivraison: null,
            dateMES: null,
            adresseChantier: null,
            adresseLivraison: null,
            description: null,
            contacts: [],
            equipe: {
                chargeAffaire: null,
                techniciens: []
            },
            devis: [],
            avancement: 0,
            statut: null
        };

        try {
            // Numéro AF
            const afBadge = document.querySelector('.badge-reference');
            if (afBadge) info.numeroAF = afBadge.textContent.trim();

            // Statut du projet
            const statusBadge = document.querySelector('.badge.bg-success, .badge.bg-warning, .badge.bg-danger');
            if (statusBadge) info.statut = statusBadge.textContent.trim();

            // Dates du projet
            const dateElements = document.querySelectorAll('.col-md-2 strong');
            dateElements.forEach(el => {
                const label = el.parentElement.querySelector('.text-muted')?.textContent;
                if (label && label.includes('Date de création')) info.dateCreation = el.textContent.trim();
                if (label && label.includes('Livraison prévue')) info.dateLivraison = el.textContent.trim();
                if (label && label.includes('Mise en service')) info.dateMES = el.textContent.trim();
            });

            // Avancement global
            const progressText = document.querySelector('.progress-bar.bg-success');
            if (progressText) {
                const match = progressText.style.width.match(/(\d+)/);
                if (match) info.avancement = parseInt(match[1]);
            }

            // Description
            const descCard = document.querySelector('.card-header .fas.fa-info-circle');
            if (descCard) {
                const descBody = descCard.closest('.card').querySelector('.card-body');
                if (descBody) info.description = descBody.textContent.trim();
            }

            // Adresse du chantier
            const chantierCard = document.querySelector('.fas.fa-hard-hat');
            if (chantierCard) {
                const adresseBody = chantierCard.closest('.card').querySelector('.card-body p');
                if (adresseBody) info.adresseChantier = adresseBody.innerHTML.replace(/<br\s*\/?>/gi, '\n');
            }

            // Adresse de livraison
            const livraisonCard = document.querySelector('.fas.fa-truck');
            if (livraisonCard) {
                const adresseBody = livraisonCard.closest('.card').querySelector('.card-body p');
                if (adresseBody) info.adresseLivraison = adresseBody.innerHTML.replace(/<br\s*\/?>/gi, '\n');
            }

            // Équipe - Chargé d'affaire
            const chargeAffaireDiv = document.querySelector('.fas.fa-user-tie');
            if (chargeAffaireDiv) {
                const nameEl = chargeAffaireDiv.closest('.d-flex').querySelector('h6');
                if (nameEl) info.equipe.chargeAffaire = nameEl.textContent.trim();
            }

            // Équipe - Techniciens
            const techElements = document.querySelectorAll('.fas.fa-hard-hat');
            techElements.forEach(el => {
                const techName = el.nextElementSibling?.textContent.trim();
                if (techName && !info.equipe.techniciens.includes(techName)) {
                    info.equipe.techniciens.push(techName);
                }
            });

            // Contacts du projet
            const contactItems = document.querySelectorAll('.list-group-item h6');
            contactItems.forEach(el => {
                const name = el.textContent.trim();
                const contactDiv = el.closest('.list-group-item');
                const role = contactDiv.querySelector('.badge.bg-info')?.textContent.trim();
                const phone = contactDiv.querySelector('a[href^="tel:"]')?.textContent.trim();
                const email = contactDiv.querySelector('a[href^="mailto:"]')?.textContent.trim();

                if (name && !name.includes('Ajouter')) {
                    info.contacts.push({ name, role, phone, email });
                }
            });

            // Devis / BDC
            const devisItems = document.querySelectorAll('.fas.fa-file-pdf');
            devisItems.forEach(el => {
                const devisDiv = el.closest('.list-group-item');
                if (devisDiv) {
                    const titre = devisDiv.querySelector('h6')?.textContent.trim();
                    const date = devisDiv.querySelector('.text-muted')?.textContent.match(/Modifié le (.+)/)?.[1];
                    const taille = devisDiv.querySelector('.text-muted span')?.textContent.trim();
                    const lien = devisDiv.querySelector('a.btn')?.href;

                    if (titre) {
                        info.devis.push({ titre, date, taille, lien });
                    }
                }
            });

        } catch (error) {
            console.error('❌ Erreur extraction infos:', error);
        }

        return info;
    }

    if (autoExtract === 'true') {
        // MODE AUTOMATIQUE : Extraction silencieuse
        console.log('🤖 Mode automatique détecté');

        window.addEventListener('load', function() {
            // Attendre 1 seconde que tout soit chargé
            setTimeout(() => {
                console.log('📦 Récupération du HTML...');

                const htmlContent = document.documentElement.outerHTML;
                const projectInfo = extractProjectInfo();

                console.log(`📤 Envoi de ${projectInfo.numeroAF}...`);

                // Envoyer à TrackHour
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'http://localhost:3000/api/tasks/extract',
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({
                        htmlContent: htmlContent,
                        numeroAF: projectInfo.numeroAF,
                        projectId: projectId,
                        projectInfo: projectInfo  // 🆕 Nouvelles infos
                    }),
                    onload: function(response) {
                        console.log('✅ Envoi réussi - Fermeture automatique dans 500ms');
                        // Fermer l'onglet automatiquement après succès
                        setTimeout(() => window.close(), 500);
                    },
                    onerror: function(error) {
                        console.error('❌ Erreur:', error);
                        // Fermer l'onglet même en cas d'erreur (après 2 secondes)
                        setTimeout(() => window.close(), 2000);
                    }
                });
            }, 1000);
        });

    } else {
        // MODE MANUEL : Afficher le bouton
        window.addEventListener('load', function() {
            const projectInfo = extractProjectInfo();

            const button = document.createElement('button');
            button.innerHTML = '📤 Envoyer vers TrackHour';
            button.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                padding: 15px 25px;
                background: #28a745;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;

            button.addEventListener('click', function() {
                button.innerHTML = '⏳ Envoi...';
                button.disabled = true;

                const htmlContent = document.documentElement.outerHTML;

                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'http://localhost:3000/api/tasks/extract',
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({
                        htmlContent: htmlContent,
                        numeroAF: projectInfo.numeroAF,
                        projectId: projectId,
                        projectInfo: projectInfo  // 🆕 Nouvelles infos
                    }),
                    onload: function(response) {
                        const data = JSON.parse(response.responseText);
                        if (data.success) {
                            button.innerHTML = '✅ Envoyé !';
                            alert(`✅ ${data.projectData.sections.length} sections extraites !`);
                            setTimeout(() => window.close(), 1000);
                        } else {
                            button.innerHTML = '❌ Erreur';
                            alert('❌ ' + data.error);
                        }
                    },
                    onerror: function() {
                        button.innerHTML = '❌ Erreur';
                        alert('❌ TrackHour non accessible');
                    }
                });
            });

            document.body.appendChild(button);
        });
    }
})();
