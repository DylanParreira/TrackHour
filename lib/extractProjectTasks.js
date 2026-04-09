const cheerio = require('cheerio');

/**
 * Extrait les sections et tâches d'un projet depuis le HTML
 * @param {string} htmlContent - Contenu HTML de la page projet
 * @returns {Object} Données du projet avec sections et tâches
 */
function extractProjectTasks(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const projectData = {
        numeroAffaire: '',
        projectName: '',
        client: '',
        statut: '',
        chargeAffaire: '',
        dateCreation: '',
        dateLivraison: '',
        dateMiseEnService: '',
        adresseChantier: '',
        adresseLivraison: '',
        contacts: [],
        devis: [],
        technicians: [],
        sections: []
    };
    
    console.log('🔍 Début extraction des tâches du projet...');
    
    try {
        // Extraire les infos générales du projet
        projectData.numeroAffaire = $('.badge-reference').first().text().trim();
        projectData.projectName = $('h2').first().text().trim();
        
        // Extraire le client
        const clientText = $('small:contains("Client")').parent().find('strong').text().trim();
        projectData.client = clientText;
        
        // Extraire le statut
        const statutBadge = $('.badge.bg-success, .badge.bg-warning, .badge.bg-danger').first();
        projectData.statut = statutBadge.text().trim();
        
        // Extraire le chargé d'affaire
        const chargeAffaireEl = $('small:contains("Chargé d\'affaire")').parent().find('h6');
        projectData.chargeAffaire = chargeAffaireEl.text().trim();
        
        // Extraire les dates
        $('small.text-muted').each((i, el) => {
            const text = $(el).text().trim();
            if (text === 'Date de création') {
                projectData.dateCreation = $(el).next('strong').text().trim();
            } else if (text === 'Livraison prévue') {
                projectData.dateLivraison = $(el).next('strong').text().trim();
            } else if (text === 'Mise en service') {
                projectData.dateMiseEnService = $(el).next('strong').text().trim();
            }
        });
        
        // Extraire les adresses
        $('h6').each((i, el) => {
            const title = $(el).text().trim();
            if (title.includes('Adresse du chantier')) {
                const addressEl = $(el).parent().next('.card-body').find('p');
                projectData.adresseChantier = addressEl.html() ? addressEl.html().replace(/<br\s*\/?>/g, ', ').trim() : '';
            } else if (title.includes('Adresse de livraison')) {
                const addressEl = $(el).parent().next('.card-body').find('p');
                projectData.adresseLivraison = addressEl.html() ? addressEl.html().replace(/<br\s*\/?>/g, ', ').trim() : '';
            }
        });
        
        // Extraire les contacts
        $('.list-group-item').each((i, el) => {
            const $item = $(el);
            const name = $item.find('h6').first().text().trim();
            const role = $item.find('.badge.bg-info').text().trim();
            const emailLink = $item.find('a[href^="mailto:"]');
            const phoneLink = $item.find('a[href^="tel:"]');
            
            if (name && (emailLink.length > 0 || phoneLink.length > 0)) {
                const contact = {
                    name: name,
                    role: role,
                    email: emailLink.length > 0 ? emailLink.text().trim() : '',
                    phone: phoneLink.length > 0 ? phoneLink.text().trim() : ''
                };
                projectData.contacts.push(contact);
            }
        });
        
        // Extraire les devis/commandes
        $('.list-group-flush').find('.list-group-item').each((i, el) => {
            const $item = $(el);
            const fileName = $item.find('h6').text().trim();
            const fileLink = $item.find('a[href*="sharepoint"]').attr('href');
            
            if (fileName && fileName.toLowerCase().includes('.pdf') && fileLink) {
                projectData.devis.push({
                    nom: fileName,
                    url: fileLink
                });
            }
        });
        
        // Extraire l'équipe (techniciens)
        $('h6:contains("Équipe")').parent().next('.card-body').find('.badge').each((i, el) => {
            const tech = $(el).text().trim();
            if (tech) {
                projectData.technicians.push(tech);
            }
        });
        
        console.log(`📋 Projet: ${projectData.numeroAffaire} - ${projectData.projectName}`);
        console.log(`👤 Chargé d'affaire: ${projectData.chargeAffaire}`);
        console.log(`👷 Techniciens: ${projectData.technicians.join(', ')}`);
        console.log(`📧 Contacts: ${projectData.contacts.length}`);
        console.log(`📄 Devis: ${projectData.devis.length}`);
        
        // Extraire les sections et leurs tâches
        $('.section-item').each((sectionIndex, sectionEl) => {
            const $section = $(sectionEl);
            
            const sectionId = $section.attr('data-id');
            const sectionName = $section.find('h6').first().contents().filter(function() {
                return this.type === 'text';
            }).text().trim();
            
            // Extraire la progression de la section
            const sectionProgressBadges = $section.find('.badge.bg-primary, .badge.bg-success');
            let sectionProgress = 0;
            let sectionValidated = 0;
            
            if (sectionProgressBadges.length >= 2) {
                sectionProgress = parseInt(sectionProgressBadges.first().text().replace('%', '').trim()) || 0;
                sectionValidated = parseInt(sectionProgressBadges.last().text().replace('%', '').trim()) || 0;
            }
            
            const section = {
                id: sectionId,
                name: sectionName,
                progress: sectionProgress,
                validated: sectionValidated,
                tasks: []
            };
            
            // Extraire les tâches de cette section
            $section.find('.task-item').each((taskIndex, taskEl) => {
                const $task = $(taskEl);
                
                const taskId = $task.attr('data-id');
                const taskName = $task.find('h6').text().trim();
                
                // Déterminer le statut de la tâche
                let taskStatus = 'pending'; // Par défaut : en attente
                let taskStatusDate = '';
                
                if ($task.hasClass('task-validated')) {
                    taskStatus = 'validated';
                    const validatedText = $task.find('small.text-success').text();
                    const dateMatch = validatedText.match(/(\d{2}\/\d{2}\/\d{4})/);
                    taskStatusDate = dateMatch ? dateMatch[1] : '';
                } else if ($task.hasClass('task-completed')) {
                    taskStatus = 'completed';
                    const completedText = $task.find('small.text-warning').text();
                    const dateMatch = completedText.match(/(\d{2}\/\d{2}\/\d{4})/);
                    taskStatusDate = dateMatch ? dateMatch[1] : '';
                }
                
                // Extraire la description/note de la tâche
                const taskDescription = $task.find('small.text-muted').last().text().trim();
                
                const task = {
                    id: taskId,
                    name: taskName,
                    status: taskStatus,
                    statusDate: taskStatusDate,
                    description: taskDescription || ''
                };
                
                section.tasks.push(task);
            });
            
            console.log(`  📁 Section: ${section.name} (${section.tasks.length} tâches, ${section.validated}% validé)`);
            
            projectData.sections.push(section);
        });
        
        console.log(`✅ Extraction terminée : ${projectData.sections.length} sections, ${projectData.sections.reduce((acc, s) => acc + s.tasks.length, 0)} tâches au total`);
        
        return projectData;
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'extraction des tâches:', error);
        return projectData;
    }
}

module.exports = { extractProjectTasks };
