const getElement = (id) => document.getElementById(id);

const elements = {
    sidebar: getElement('sidebar'),
    regionName: getElement('region-name'),
    closeBtn: getElement('close-sidebar'),
    scoreValue: getElement('score-value'),
    scoreIconContainer: getElement('score-icon-container'),
    explanationText: getElement('explanation-text'),
    valTemp: getElement('val-temp'),
    valTempAnomaly: getElement('val-temp-anomaly'),
    valRain: getElement('val-rain'),
    valAir: getElement('val-air'),
    valAirDetail: getElement('val-air-detail'),
    valEnergy: getElement('val-energy'),
    valCarbon: getElement('val-carbon'),
    trendBadge: getElement('trend-badge'),
    progressBarFill: getElement('progress-bar-fill'),
    criticalWarning: getElement('critical-warning'),
    criticalYear: getElement('critical-year')
};

const REGION_BASELINES = {
    "default": { energy: 300, carbon: 50 },
    "Île-de-France": { energy: 550, carbon: 55 },
    "Nouvelle-Aquitaine": { energy: 320, carbon: 40 },
    "Auvergne-Rhône-Alpes": { energy: 480, carbon: 45 },
    "Bourgogne-Franche-Comté": { energy: 250, carbon: 35 },
    "Bretagne": { energy: 280, carbon: 38 },
    "Centre-Val de Loire": { energy: 260, carbon: 60 },
    "Corse": { energy: 90, carbon: 120 },
    "Grand Est": { energy: 390, carbon: 50 },
    "Hauts-de-France": { energy: 410, carbon: 58 },
    "Normandie": { energy: 310, carbon: 42 },
    "Occitanie": { energy: 360, carbon: 44 },
    "Pays de la Loire": { energy: 290, carbon: 39 },
    "Provence-Alpes-Côte d'Azur": { energy: 420, carbon: 55 }
};

let selectedRegion = null;
let geoJsonLayer = null;

const map = L.map('map', {
    center: [46.603354, 1.888334],
    zoom: 6,
    zoomControl: false,
    scrollWheelZoom: true,
    doubleClickZoom: false
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

const getColor = (score) => {
    if (score == null) return '#374151';
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#fbbf24';
    if (score >= 40) return '#f97316';
    return '#ef4444';
};

async function fetchClimateData(lat, lon) {
    try {
        const weatherPromise = fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation&timezone=auto`).then(r => r.json());
        const airPromise = fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,nitrogen_dioxide,ozone&timezone=auto`).then(r => r.json());
        
        const [weatherData, airData] = await Promise.all([weatherPromise, airPromise]);

        return {
            weather: weatherData.current,
            air: airData.current
        };
    } catch (error) {
        return null;
    }
}

function calculateHealthScore(weather, air, baselineCarbon) {
    let score = 100;

    if (air.pm2_5 > 5) score -= (air.pm2_5 - 5) * 1.5;
    if (air.nitrogen_dioxide > 10) score -= (air.nitrogen_dioxide - 10) * 0.5;
    if (baselineCarbon > 50) score -= (baselineCarbon - 50) * 0.5;

    const tempStress = Math.abs(weather.temperature_2m - 20);
    if (tempStress > 10) score -= (tempStress - 10) * 2;

    return Math.max(0, Math.min(100, Math.round(score)));
}

function getAirQualityLabel(pm25) {
    if (pm25 < 10) return "Bonne";
    if (pm25 < 25) return "Moyenne";
    if (pm25 < 50) return "Dégradée";
    return "Mauvaise";
}

async function updateSidebar(name, lat, lon) {
    const baseline = REGION_BASELINES[name] || REGION_BASELINES["default"];
    const data = await fetchClimateData(lat, lon);

    if (!data) {
        alert("Impossible de récupérer les données météo en temps réel.");
        return;
    }

    const { weather, air } = data;
    const healthScore = calculateHealthScore(weather, air, baseline.carbon);

    elements.regionName.textContent = name;
    elements.scoreValue.textContent = healthScore;
    
    const scoreColor = getColor(healthScore);
    elements.scoreValue.style.color = scoreColor;
    elements.scoreIconContainer.style.borderColor = scoreColor;
    elements.scoreIconContainer.style.color = scoreColor;

    elements.explanationText.textContent = healthScore >= 75 ? "Cette région montre une bonne résilience climatique actuellement." :
           healthScore >= 50 ? "Zone sous surveillance : stress environnemental modéré." :
           "Attention : indicateurs climatiques critiques (Pollution/Météo).";

    elements.valTemp.textContent = `${weather.temperature_2m}°C`;
    
    const anomaly = (weather.temperature_2m - 15).toFixed(1);
    elements.valTempAnomaly.textContent = `${anomaly > 0 ? '+' : ''}${anomaly}°C écart (est.)`;
    elements.valTempAnomaly.style.color = anomaly > 0 ? '#f87171' : '#60a5fa';

    elements.valRain.textContent = `${weather.precipitation} mm`;

    elements.valAir.textContent = getAirQualityLabel(air.pm2_5);
    elements.valAirDetail.textContent = `PM2.5: ${air.pm2_5} µg/m³`;

    elements.valEnergy.textContent = `${baseline.energy} GWh`;
    elements.valCarbon.textContent = `${baseline.carbon} gCO2/kWh`;

    elements.trendBadge.className = 'trend-badge'; 
    
    let trend = 'stable';
    if (healthScore < 50) trend = 'worsening';
    if (healthScore > 80) trend = 'improving';

    if (trend === 'improving') {
        elements.trendBadge.textContent = '↗ Amélioration';
        elements.trendBadge.classList.add('trend-impr');
    } else if (trend === 'stable') {
        elements.trendBadge.textContent = '→ Stable';
        elements.trendBadge.classList.add('trend-stable');
    } else {
        elements.trendBadge.textContent = '↘ Dégradation';
        elements.trendBadge.classList.add('trend-degrade');
    }

    elements.progressBarFill.style.width = `${healthScore}%`;
    elements.progressBarFill.style.backgroundColor = scoreColor;

    if (healthScore < 55) {
        elements.criticalWarning.classList.remove('hidden');
        elements.criticalYear.textContent = Math.floor(2030 + (healthScore / 5));
    } else {
        elements.criticalWarning.classList.add('hidden');
    }

    elements.sidebar.classList.remove('hidden');
    lucide.createIcons();
}

function styleFeature(feature) {
    const name = feature.properties.nom;
    const isSelected = name === selectedRegion;
    
    return {
        fillColor: isSelected ? 'rgba(255, 255, 255, 0.1)' : '#334155', 
        weight: isSelected ? 2 : 1,
        opacity: 1,
        color: isSelected ? 'white' : 'rgba(255,255,255,0.3)',
        dashArray: '',
        fillOpacity: isSelected ? 0.6 : 0.4
    };
}

function onEachFeature(feature, layer) {
    const name = feature.properties.nom;

    layer.bindTooltip(name, {
        permanent: false,
        direction: "center",
        className: "region-label"
    });

    layer.on({
        mouseover: (e) => {
            if (name !== selectedRegion) {
                const l = e.target;
                l.setStyle({
                    weight: 2,
                    color: '#e2e8f0',
                    fillOpacity: 0.6
                });
                l.bringToFront();
            }
        },
        mouseout: (e) => {
            if (name !== selectedRegion) {
                geoJsonLayer.resetStyle(e.target);
            }
        },
        click: (e) => {
            selectedRegion = name;
            
            map.fitBounds(e.target.getBounds(), { padding: [50, 50], duration: 0.8 });
            
            const clickLat = e.latlng.lat;
            const clickLng = e.latlng.lng;

            geoJsonLayer.setStyle(styleFeature);
            e.target.setStyle({
                weight: 3,
                color: '#22c55e',
                fillOpacity: 0.1
            });

            updateSidebar(name, clickLat, clickLng);
        }
    });
}

fetch('regions.json')
    .then(response => response.json())
    .then(data => {
        geoJsonLayer = L.geoJSON(data, {
            style: styleFeature,
            onEachFeature: onEachFeature
        }).addTo(map);
    })
    .catch(err => console.error(err));

elements.closeBtn.addEventListener('click', () => {
    selectedRegion = null;
    geoJsonLayer.resetStyle();
    map.setView([46.603354, 1.888334], 6);
    elements.sidebar.classList.add('hidden');
});

lucide.createIcons();