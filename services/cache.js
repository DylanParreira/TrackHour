const fs = require('fs').promises;
const path = require('path');

class CacheManager {
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.nasCache = [];
        this.projectsCache = [];
        this.tasksCache = {};
        this.mapSites = [];
        this.nasAssociations = {}; // { numeroAF: { path: "chemin", client: "...", projet: "..." } }
        this.lastSyncTime = null;
    }

    async loadNasCache() {
        try {
            const file = path.join(this.baseDir, 'nas_cache.json');
            const content = await fs.readFile(file, 'utf-8');
            this.nasCache = JSON.parse(content);
            console.log(`📦 Cache NAS: ${this.nasCache.length} entrées`);
            return true;
        } catch (error) {
            console.log('⚠️  Aucun cache NAS');
            return false;
        }
    }

    async saveNasCache() {
        try {
            const file = path.join(this.baseDir, 'nas_cache.json');
            await fs.writeFile(file, JSON.stringify(this.nasCache, null, 2));
            console.log(`✅ Cache NAS sauvegardé: ${this.nasCache.length}`);
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde NAS:', error);
            return false;
        }
    }

    async loadProjectsCache() {
        try {
            const file = path.join(this.baseDir, 'projets_web_cache.json');
            const content = await fs.readFile(file, 'utf-8');
            const cache = JSON.parse(content);
            this.projectsCache = cache.projects || [];
            this.lastSyncTime = cache.lastSync ? new Date(cache.lastSync) : null;
            console.log(`📦 Cache projets: ${this.projectsCache.length}`);
            return true;
        } catch (error) {
            console.log('⚠️  Aucun cache projets');
            return false;
        }
    }

    async saveProjectsCache() {
        try {
            const file = path.join(this.baseDir, 'projets_web_cache.json');
            const cache = { lastSync: new Date().toISOString(), projects: this.projectsCache };
            await fs.writeFile(file, JSON.stringify(cache, null, 2));
            console.log(`✅ Cache projets sauvegardé: ${this.projectsCache.length}`);
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde projets:', error);
            return false;
        }
    }

    async loadTasksCache() {
        try {
            const file = path.join(this.baseDir, 'projets_tasks_cache.json');
            const content = await fs.readFile(file, 'utf-8');
            this.tasksCache = JSON.parse(content);
            console.log(`📋 Cache tâches: ${Object.keys(this.tasksCache).length}`);
            return true;
        } catch (error) {
            console.log('⚠️  Aucun cache tâches');
            return false;
        }
    }

    async saveTasksCache() {
        try {
            const file = path.join(this.baseDir, 'projets_tasks_cache.json');
            await fs.writeFile(file, JSON.stringify(this.tasksCache, null, 2));
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde tâches:', error);
            return false;
        }
    }

    async loadMapSites() {
        try {
            const file = path.join(this.baseDir, 'map_sites.json');
            const content = await fs.readFile(file, 'utf-8');
            this.mapSites = JSON.parse(content);
            console.log(`🗺️  Sites carte: ${this.mapSites.length}`);
            return true;
        } catch (error) {
            console.log('⚠️  Aucun fichier sites carte');
            return false;
        }
    }

    async saveMapSites() {
        try {
            const file = path.join(this.baseDir, 'map_sites.json');
            await fs.writeFile(file, JSON.stringify(this.mapSites, null, 2));
            console.log(`✅ Sites carte sauvegardés: ${this.mapSites.length}`);
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde sites:', error);
            return false;
        }
    }

    async loadNasAssociations() {
        try {
            const file = path.join(this.baseDir, 'nas_associations.json');
            const content = await fs.readFile(file, 'utf-8');
            this.nasAssociations = JSON.parse(content);
            console.log(`📌 Associations NAS: ${Object.keys(this.nasAssociations).length}`);
            return true;
        } catch (error) {
            console.log('⚠️  Aucune association NAS');
            return false;
        }
    }

    async saveNasAssociations() {
        try {
            const file = path.join(this.baseDir, 'nas_associations.json');
            await fs.writeFile(file, JSON.stringify(this.nasAssociations, null, 2));
            console.log(`✅ Associations NAS sauvegardées: ${Object.keys(this.nasAssociations).length}`);
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde associations NAS:', error);
            return false;
        }
    }

    getNasAssociation(numeroAF) {
        return this.nasAssociations[numeroAF] || null;
    }

    setNasAssociation(numeroAF, projectData) {
        this.nasAssociations[numeroAF] = {
            path: projectData.path,
            client: projectData.client,
            chantier: projectData.chantier,
            projet: projectData.projet,
            configuredAt: new Date().toISOString()
        };
    }

    removeNasAssociation(numeroAF) {
        delete this.nasAssociations[numeroAF];
    }
}

module.exports = CacheManager;
