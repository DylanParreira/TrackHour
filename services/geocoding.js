async function geocodeAddress(address) {
    try {
        const encodedAddress = encodeURIComponent(address);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=fr&limit=1`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'TrackHour/1.0' }
        });

        const data = await response.json();

        if (data && data.length > 0) {
            return {
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon),
                displayName: data[0].display_name
            };
        }

        return null;
    } catch (error) {
        console.error('Erreur géocodage:', error);
        return null;
    }
}

async function searchAddress(client, siteName, numeroAF) {
    async function searchWithNominatim(query) {
        try {
            const encodedQuery = encodeURIComponent(query + ' France');
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&countrycodes=fr&limit=3`;
            const response = await fetch(url, { headers: { 'User-Agent': 'TrackHour/2.0' } });
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) return null;
            const data = await response.json();
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            return null;
        }
    }

    async function searchWithPhoton(query) {
        try {
            const encodedQuery = encodeURIComponent(query);
            const url = `https://photon.komoot.io/api/?q=${encodedQuery}&limit=3&lang=fr`;
            const response = await fetch(url);
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) return null;
            const data = await response.json();
            if (data.features && data.features.length > 0) {
                const feature = data.features[0];
                return {
                    lat: feature.geometry.coordinates[1],
                    lon: feature.geometry.coordinates[0],
                    display_name: feature.properties.name + ', ' + (feature.properties.city || feature.properties.county || '')
                };
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async function searchWithOpenCage(query) {
        try {
            const apiKey = '5c61875d504840f7a095dbe9c0c12aa1';
            const encodedQuery = encodeURIComponent(query + ' France');
            const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodedQuery}&key=${apiKey}&limit=1&language=fr&countrycode=fr`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                return { lat: result.geometry.lat, lon: result.geometry.lng, display_name: result.formatted };
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async function searchWithPositionStack(query) {
        try {
            const apiKey = 'b069881b4bef7e5a96f88d71d20705f2';
            const encodedQuery = encodeURIComponent(query + ' France');
            const url = `http://api.positionstack.com/v1/forward?access_key=${apiKey}&query=${encodedQuery}&limit=1&country=FR`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.data && data.data.length > 0) {
                const result = data.data[0];
                return { lat: result.latitude, lon: result.longitude, display_name: result.label };
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    const searchStrategies = [
        siteName,
        `${siteName} magasin`,
        `${siteName} supermarché`,
        siteName.replace(/ITM|LECLERC|CARREFOUR|AUCHAN|CASINO|INTERMARCHE/gi, (match) => {
            const brands = {
                'ITM': 'Intermarché', 'LECLERC': 'E.Leclerc', 'CARREFOUR': 'Carrefour',
                'AUCHAN': 'Auchan', 'CASINO': 'Casino', 'INTERMARCHE': 'Intermarché'
            };
            return brands[match.toUpperCase()] || match;
        })
    ];

    const geocodingEngines = [
        { name: 'Nominatim', function: searchWithNominatim, delay: 1000 },
        { name: 'Photon', function: searchWithPhoton, delay: 500 },
        { name: 'OpenCage', function: searchWithOpenCage, delay: 300 },
        { name: 'PositionStack', function: searchWithPositionStack, delay: 300 }
    ];

    for (const searchQuery of searchStrategies) {
        for (const engine of geocodingEngines) {
            try {
                const result = await engine.function(searchQuery);
                if (result) {
                    return {
                        address: result.display_name,
                        latitude: parseFloat(result.lat),
                        longitude: parseFloat(result.lon),
                        geocoder: engine.name
                    };
                }
                await new Promise(resolve => setTimeout(resolve, engine.delay));
            } catch (error) {
                continue;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return null;
}

module.exports = { geocodeAddress, searchAddress };
