const cheerio = require('cheerio');

/**
 * Extrait les données des projets depuis le HTML du dashboard de gestion
 * @param {string} htmlContent - Contenu HTML de la page
 * @returns {Array} Liste des projets extraits
 */
function extractDashboardProjects(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const projects = [];
    
    console.log('🔍 Début extraction des projets...');
    
    // Parcourir chaque ligne du tableau (chaque projet)
    $('tbody tr[data-project-row]').each((index, row) => {
        const $row = $(row);
        
        try {
            // Extraction des données depuis les attributs data-*
            const numeroAffaire = $row.find('td[data-reference]').attr('data-reference') || 
                                 $row.find('td[data-reference] .badge-reference').text().trim();
            
            const projectName = $row.find('td[data-project-name] a').text().trim();
            const projectUrl = $row.find('td[data-project-name] a').attr('href') || '';
            const projectId = projectUrl.match(/\/projects\/(\d+)/)?.[1] || '';
            
            const client = $row.find('td[data-client-name]').text().trim()
                                .replace(/\s+/g, ' ')
                                .replace(/.*?([A-Z].*)/s, '$1'); // Enlever l'icône
            
            // Extraire le chargé d'affaire
            const chargeAffaireCell = $row.find('td').eq(3);
            const chargeAffaire = chargeAffaireCell.text().trim()
                                                   .replace(/\s+/g, ' ')
                                                   .replace(/.*?([A-ZÀ-ÿ].*)/s, '$1'); // Enlever l'icône
            
            // Extraire le statut
            const statutCell = $row.find('td').eq(4);
            const statut = statutCell.find('.badge').first().text().trim();
            const estBloque = statutCell.find('.badge-danger').length > 0;
            
            // Extraire l'avancement
            const avancementText = $row.find('.progress-bar').attr('style');
            const avancementMatch = avancementText?.match(/width:\s*(\d+)%/);
            const avancement = avancementMatch ? parseInt(avancementMatch[1], 10) : 0;
            
            // Extraire les dates
            const datesCell = $row.find('td').last();
            const dateLivraison = datesCell.find('small:contains("Livraison")').find('.text-dark').text().trim();
            const dateMiseEnService = datesCell.find('small:contains("Mise en service")').find('.text-dark').text().trim();
            
            // Vérifier que les données essentielles sont présentes
            if (numeroAffaire && projectName) {
                projects.push({
                    numeroAffaire,
                    projectId,
                    projectUrl: projectUrl.startsWith('http') ? projectUrl : `https://projets.applitec-automatisme.com${projectUrl}`,
                    projectName,
                    client: client || 'Non défini',
                    chargeAffaire: chargeAffaire || 'Non assigné',
                    statut: statut || 'Inconnu',
                    avancement,
                    dateLivraison: dateLivraison === '-' ? '' : dateLivraison,
                    dateMiseEnService: dateMiseEnService === '-' ? '' : dateMiseEnService,
                    estBloque
                });
                
                console.log(`✅ Projet ${index + 1}: ${numeroAffaire} - ${projectName}`);
            }
        } catch (error) {
            console.error(`❌ Erreur ligne ${index + 1}:`, error.message);
        }
    });
    
    console.log(`✅ Extraction terminée : ${projects.length} projets trouvés`);
    
    return projects;
}

module.exports = { extractDashboardProjects };
