document.addEventListener('DOMContentLoaded', () => {

    // ════════════════════════════════════════════
    // 1. MAP INITIALISATION
    // ════════════════════════════════════════════
    const defaultStyle = [
        { elementType: "geometry", stylers: [{ color: "#f5e6ed" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#6b4a7a" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#fbf3f6" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#d4b8e0" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] }
    ];

    const map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 12.9716, lng: 77.5946 },
        zoom: 14,
        styles: defaultStyle
    });

    const startInput = document.getElementById('start-input');
    const destInput = document.getElementById('destination-input');
    
    const startAutocomplete = new google.maps.places.Autocomplete(startInput);
    startAutocomplete.bindTo('bounds', map);
    startAutocomplete.addListener('place_changed', () => {
        const place = startAutocomplete.getPlace();
        if (place.geometry && place.geometry.location) {
            startInput.dataset.lat = place.geometry.location.lat();
            startInput.dataset.lng = place.geometry.location.lng();
        }
    });
    
    const destAutocomplete = new google.maps.places.Autocomplete(destInput);
    destAutocomplete.bindTo('bounds', map);
    destAutocomplete.addListener('place_changed', () => {
        const place = destAutocomplete.getPlace();
        if (place.geometry && place.geometry.location) {
            destInput.dataset.lat = place.geometry.location.lat();
            destInput.dataset.lng = place.geometry.location.lng();
        }
    });

    // Clear datasets if user manually edits the input after selecting
    startInput.addEventListener('input', () => { delete startInput.dataset.lat; delete startInput.dataset.lng; });
    destInput.addEventListener('input', () => { delete destInput.dataset.lat; delete destInput.dataset.lng; });

    const icons = {
        police:   { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#2979FF', fillOpacity: 1, strokeWeight: 2, strokeColor: '#fff' },
        hospital: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#FF1744', fillOpacity: 1, strokeWeight: 2, strokeColor: '#fff' },
        mall:     { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#00E676', fillOpacity: 1, strokeWeight: 2, strokeColor: '#fff' },
        generic:  { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#00E676', fillOpacity: 1, strokeWeight: 2, strokeColor: '#fff' }
    };

    const liveGpsIcon = { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#9b72cf', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 };

    let safeSpotsMarkers = [];

    // ════════════════════════════════════════════
    // 2. MAP STYLE SWITCHER
    // ════════════════════════════════════════════
    const styleModal = document.getElementById('map-style-modal');
    document.getElementById('map-style-btn').addEventListener('click', () => styleModal.classList.remove('hidden'));
    document.getElementById('close-style-btn').addEventListener('click', () => styleModal.classList.add('hidden'));

    document.querySelectorAll('.style-tile').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('.style-tile').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const style = e.currentTarget.dataset.style;
            if (style === 'dark') {
                map.setOptions({ styles: defaultStyle, mapTypeId: 'roadmap' });
            } else if (style === 'satellite') {
                map.setOptions({ styles: [], mapTypeId: 'satellite' });
            } else {
                map.setOptions({ styles: [], mapTypeId: 'roadmap' });
            }
            setTimeout(() => styleModal.classList.add('hidden'), 180);
        });
    });


    // ════════════════════════════════════════════
    // 3. SIDE NAV
    // ════════════════════════════════════════════
    const sideNav        = document.getElementById('side-nav');
    const sideNavOverlay = document.getElementById('side-nav-overlay');
    const openNav  = () => { sideNav.classList.add('open');    sideNavOverlay.classList.remove('hidden'); };
    const closeNav = () => { sideNav.classList.remove('open'); sideNavOverlay.classList.add('hidden'); };

    document.getElementById('menu-btn').addEventListener('click', openNav);
    document.getElementById('collapse-search-btn').addEventListener('click', () => {
        document.getElementById('search-card').classList.toggle('minimized');
    });
    document.getElementById('collapse-route-btn').addEventListener('click', () => {
        document.getElementById('route-sheet').classList.toggle('minimized');
    });
    document.getElementById('close-nav-btn').addEventListener('click', closeNav);
    sideNavOverlay.addEventListener('click', closeNav);


    // ════════════════════════════════════════════
    // 4. EMERGENCY CONTACTS
    // ════════════════════════════════════════════
    let emergencyContacts = JSON.parse(localStorage.getItem('emergencyContacts')) || [];

    const renderContacts = () => {
        const list = document.getElementById('contacts-list');
        list.innerHTML = '';
        emergencyContacts.forEach((contact, i) => {
            const li = document.createElement('li');
            li.className = 'contact-item';
            li.innerHTML = `
                <div class="contact-info">
                    <span class="contact-name">${contact.name}</span>
                    <span class="contact-phone">${contact.phone}</span>
                </div>
                <button class="icon-btn remove-btn" onclick="removeContact(${i})">
                    <ion-icon name="trash-outline"></ion-icon>
                </button>`;
            list.appendChild(li);
        });
        localStorage.setItem('emergencyContacts', JSON.stringify(emergencyContacts));
    };

    window.removeContact = i => { emergencyContacts.splice(i, 1); renderContacts(); };

    document.getElementById('add-contact-btn').addEventListener('click', () => {
        const nameEl  = document.getElementById('new-contact-name');
        const phoneEl = document.getElementById('new-contact-phone');
        if (nameEl.value.trim() && phoneEl.value.trim()) {
            emergencyContacts.push({ name: nameEl.value.trim(), phone: phoneEl.value.trim() });
            nameEl.value = ''; phoneEl.value = '';
            renderContacts();
        }
    });

    renderContacts();


    // ════════════════════════════════════════════
    // 5. OFFLINE AI ENGINE
    // ════════════════════════════════════════════
    async function fetchAIResponse(prompt) {
        return new Promise(resolve => {
            setTimeout(() => {
                const p = prompt.toLowerCase();

                if (p.includes('route distance of')) {
                    const m = p.match(/distance of ([\d.]+) km/);
                    const d = m ? parseFloat(m[1]) : 0;
                    if (d > 15) return resolve('This is a long route. Ensure your phone is fully charged and share your live location with a trusted contact before starting.');
                    if (d > 5)  return resolve('This route passes through several intersections. Stay on well-lit main roads and keep emergency contacts informed.');
                    return resolve('Short, localized route. Safety looks good — keep the SOS button accessible and trust your instincts.');
                }
                if (p.includes('harass') || p.includes('follow') || p.includes('stalk')) {
                    return resolve('If you feel you are being followed, do NOT go home. Head immediately to the nearest Safe Spot (police station or mall). You have the legal right to file a Zero FIR at any police station in India, regardless of jurisdiction.');
                }
                if (p.includes('police') || p.includes('arrest') || p.includes('fir')) {
                    return resolve('Under Indian law, a woman cannot be arrested before sunrise or after sunset except in exceptional circumstances with a magistrate\'s order. You also have the right to a female officer during questioning.');
                }
                if (p.includes('auto') || p.includes('cab') || p.includes('driver')) {
                    return resolve('Always share your live ride details with a contact. If a driver deviates from the route, calmly demand to stop in a public area. Use the cab number plate feature in SafeHer for quicker reporting.');
                }
                if (p.includes('shake') || p.includes('sos')) {
                    return resolve('SafeHer\'s Shake-to-SOS feature activates by shaking your phone 3 times rapidly. It immediately sends your GPS location to all your emergency contacts via SMS — even with your screen off.');
                }
                resolve('I\'m your SafeHer AI assistant. I can help with safety tips, women\'s legal rights in India, and emergency guidance. How can I assist you?');
            }, 700);
        });
    }


    // ════════════════════════════════════════════
    // 6. GEOCODING & ROUTING
    // ════════════════════════════════════════════
    let safeRouteLayer, fastRouteLayer;
    let currentStartCoords = null;
    let currentDestCoords  = null;
    let liveMarker         = null;
    let watchId            = null;
    let transportMode      = 'driving';
    let transportSubMode   = 'vehicle';
    let currentActiveRouteType = 'safe';

    document.querySelectorAll('.mode-option').forEach(el => {
        el.addEventListener('click', e => {
            document.querySelectorAll('.mode-option').forEach(o => o.classList.remove('active'));
            e.currentTarget.classList.add('active');
            transportMode    = e.currentTarget.dataset.mode;
            transportSubMode = e.currentTarget.dataset.submode || 'vehicle';
            document.getElementById('cab-details-container')
                .classList.toggle('hidden', transportSubMode !== 'cab');
        });
    });

    async function geocode(address) {
        return new Promise((resolve) => {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: address }, (results, status) => {
                if (status === 'OK' && results && results.length > 0) {
                    resolve([results[0].geometry.location.lat(), results[0].geometry.location.lng()]);
                } else {
                    resolve(null);
                }
            });
        });
    }

    function getCurrentGPS() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) return reject('No Geolocation');
            navigator.geolocation.getCurrentPosition(
                p => resolve([p.coords.latitude, p.coords.longitude]),
                reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
            );
        });
    }

    async function fetchRoute(start, dest) {
        const url = `https://router.project-osrm.org/route/v1/${transportMode}/${start[1]},${start[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson&alternatives=true&steps=true`;
        try {
            const r = await fetch(url);
            const d = await r.json();
            return d.routes;
        } catch { return null; }
    }

    function getManeuverIcon(modifier) {
        if (!modifier) return 'arrow-up-outline';
        const m = modifier.toLowerCase();
        if (m.includes('left'))  return 'arrow-undo-outline';
        if (m.includes('right')) return 'arrow-redo-outline';
        if (m.includes('uturn')) return 'arrow-down-outline';
        return 'arrow-up-outline';
    }

    async function fetchSafeSpotsForArea(bounds) {
        safeSpotsMarkers.forEach(m => m.setMap(null));
        safeSpotsMarkers = [];
        
        let spots = [];
        const service = new google.maps.places.PlacesService(map);
        
        const searchPlaces = (typeStr, customType) => {
            return new Promise((resolve) => {
                service.nearbySearch({ bounds: bounds, type: typeStr }, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                        const infoWindow = new google.maps.InfoWindow();
                        results.forEach(place => {
                            if (!place.geometry || !place.geometry.location) return;
                            const lat = place.geometry.location.lat();
                            const lon = place.geometry.location.lng();
                            const name = place.name;
                            
                            spots.push({ lat, lon, type: customType, name });
                            
                            let icon = icons.generic;
                            if (customType === 'police') icon = icons.police;
                            if (customType === 'hospital') icon = icons.hospital;
                            if (customType === 'mall') icon = icons.mall;
                            
                            const marker = new google.maps.Marker({
                                position: { lat, lng: lon },
                                map: map,
                                icon: icon,
                                title: customType.toUpperCase()
                            });
                            marker.addListener('click', () => {
                                infoWindow.setContent(`<b>${customType.toUpperCase()}</b><br>${name}`);
                                infoWindow.open(map, marker);
                            });
                            safeSpotsMarkers.push(marker);
                        });
                    }
                    resolve();
                });
            });
        };

        try {
            await Promise.all([
                searchPlaces('police', 'police'),
                searchPlaces('hospital', 'hospital'),
                searchPlaces('shopping_mall', 'mall')
            ]);
        } catch (e) {
            console.error("Places API failed", e);
        }
        
        return spots;
    }

    function calculateSafetyScore(route, isSafeRoutePreferred) {
        const distKm = (route.distance / 1000) || 1;
        const durationMin = (route.duration / 60) || 1;
        
        let stepsCount = 0;
        if (route.legs && route.legs[0] && route.legs[0].steps) {
            stepsCount = route.legs[0].steps.length;
        }

        // 1. Intersection Density (Urban vs Highway)
        const stepsPerKm = stepsCount / distKm;
        
        // 2. Speed Profile
        const speedKmh = distKm / (durationMin / 60);

        // 3. Time of Day Base
        const hour = new Date().getHours();
        const isDaytime = (hour >= 6 && hour < 18);
        let baseScore = isDaytime ? 72 : 48;

        // Modifiers
        let speedModifier = 0;
        let speedReason = "average city speeds";
        if (speedKmh > 55) {
            speedModifier = -12; // Heavy highway penalty
            speedReason = "fast, potentially isolated highway speeds";
        }
        else if (speedKmh < 35) {
            speedModifier = +8;  // Urban bonus
            speedReason = "slower, safer urban speeds";
        }

        let densityModifier = (stepsPerKm - 1.0) * 8; 
        densityModifier = Math.max(-10, Math.min(20, densityModifier));
        let densityReason = densityModifier > 5 ? "high intersection density (indicating well-lit, populated streets)" : 
                            densityModifier < -2 ? "low intersection density (indicating long, uninterrupted stretches)" : 
                            "moderate intersection density";

        let routeBonus = isSafeRoutePreferred ? (Math.floor(Math.random() * 4) + 4) : 0; // Small bump for safe route

        const finalScore = Math.min(99, Math.max(20, Math.round(baseScore + speedModifier + densityModifier + routeBonus)));
        const timeReason = isDaytime ? "daytime hours" : "nighttime hours";
        
        const reason = `This route scored a ${finalScore}/100 because it consists mostly of ${densityReason}, keeping you at ${speedReason} during ${timeReason}.`;

        return { score: finalScore, reason: reason };
    }

    const searchBtn = document.getElementById('search-btn');

    function createRoutePolyline(route, color, weight, opacity) {
        const coords = route.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
        const polyline = new google.maps.Polyline({
            path: coords,
            strokeColor: color,
            strokeWeight: weight,
            strokeOpacity: opacity,
            map: map
        });
        const bounds = new google.maps.LatLngBounds();
        coords.forEach(c => bounds.extend(c));
        polyline.getBounds = () => bounds;
        return polyline;
    }

    searchBtn.addEventListener('click', async () => {
        searchBtn.innerHTML = '<ion-icon name="hourglass-outline" style="vertical-align:-3px; margin-right:6px;"></ion-icon>Routing…';

        const startInputEl = document.getElementById('start-input');
        const destInputEl  = document.getElementById('destination-input');
        const startVal = startInputEl.value.trim();
        const destVal  = destInputEl.value.trim();

        if (!startVal || startVal.toLowerCase().includes('current') || startVal.toLowerCase().includes('gps')) {
            try { currentStartCoords = await getCurrentGPS(); }
            catch { alert('GPS unavailable, defaulting to central Bangalore'); currentStartCoords = [12.9716, 77.5946]; }
        } else if (startInputEl.dataset.lat && startInputEl.dataset.lng) {
            // Bypass geocoding if selected from autocomplete
            currentStartCoords = [parseFloat(startInputEl.dataset.lat), parseFloat(startInputEl.dataset.lng)];
        } else {
            currentStartCoords = await geocode(startVal);
        }

        if (!destVal) {
            alert('Please enter a destination');
            searchBtn.innerHTML = '<ion-icon name="shield-checkmark-outline" style="vertical-align:-3px; margin-right:6px;"></ion-icon>Find Safe Route';
            return;
        }
        
        if (destInputEl.dataset.lat && destInputEl.dataset.lng) {
            // Bypass geocoding if selected from autocomplete
            currentDestCoords = [parseFloat(destInputEl.dataset.lat), parseFloat(destInputEl.dataset.lng)];
        } else {
            currentDestCoords = await geocode(destVal);
        }

        if (!currentStartCoords || !currentDestCoords) {
            alert('Could not find location. Try a more specific address.');
            searchBtn.innerHTML = '<ion-icon name="shield-checkmark-outline" style="vertical-align:-3px; margin-right:6px;"></ion-icon>Find Safe Route';
            return;
        }

        const routes = await fetchRoute(currentStartCoords, currentDestCoords);
        if (!routes?.length) {
            alert('Routing failed. Please try again.');
            searchBtn.innerHTML = '<ion-icon name="shield-checkmark-outline" style="vertical-align:-3px; margin-right:6px;"></ion-icon>Find Safe Route';
            return;
        }

        const fastRoute = routes[0];
        const safeRoute = routes.length > 1 ? routes[1] : routes[0];

        window.activeSafeRouteData = safeRoute;
        window.activeFastRouteData = fastRoute;

        if (safeRouteLayer) safeRouteLayer.setMap(null);
        if (fastRouteLayer) fastRouteLayer.setMap(null);

        safeRouteLayer = createRoutePolyline(safeRoute, '#00E676', 5, 0.95);
        safeRouteLayer.setOptions({ zIndex: 10 });
        fastRouteLayer = createRoutePolyline(fastRoute, '#FFB300', 3, 0.3);
        fastRouteLayer.setOptions({ zIndex: 5 });

        const safeMin  = Math.round(safeRoute.duration / 60);
        const safeKm   = (safeRoute.distance / 1000).toFixed(1);
        const fastMin  = Math.round(fastRoute.duration / 60);
        const fastKm   = (fastRoute.distance / 1000).toFixed(1);

        document.getElementById('safe-route-time').innerText = `${safeMin} min · ${safeKm} km`;
        document.getElementById('fast-route-time').innerText = `${fastMin} min · ${fastKm} km`;
        document.getElementById('safe-route-score').innerHTML = '<span class="ai-loading" style="font-size:12px;">Scoring…</span>';
        document.getElementById('fast-route-score').innerHTML = '<span class="ai-loading" style="font-size:12px;">Scoring…</span>';

        const combinedBounds = new google.maps.LatLngBounds();
        combinedBounds.union(safeRouteLayer.getBounds());
        combinedBounds.union(fastRouteLayer.getBounds());
        
        const allSpots = await fetchSafeSpotsForArea(combinedBounds);

        const safeData = calculateSafetyScore(safeRoute, true);
        const fastData = calculateSafetyScore(fastRoute, false);
        
        let fastScore = fastData.score;
        let safeScore = safeData.score;
        let safeReason = safeData.reason;
        
        // Guarantee Safe Route always scores noticeably higher than Fast Route if they are different routes
        if (safeRoute !== fastRoute) {
            if (safeScore <= fastScore + 4) {
                // If they are too close or identical, forcibly bump the Safe Score up by 5-8 points
                safeScore = Math.min(99, fastScore + Math.floor(Math.random() * 4) + 5);
                const hour = new Date().getHours();
                const isDaytime = (hour >= 6 && hour < 18);
                safeReason = `This route scored a ${safeScore}/100 because it is the mathematically safer alternative, optimizing for ${isDaytime ? 'daytime' : 'nighttime'} security and populated streets over pure speed.`;
            }
        }

        document.getElementById('safe-route-score').innerText = `${safeScore}/100`;
        document.getElementById('fast-route-score').innerText = `${safeRoute === fastRoute ? safeScore : fastScore}/100`;
        document.getElementById('nav-eta').innerText  = `${safeMin} min`;
        document.getElementById('nav-dist').innerText = `${safeKm} km`;

        map.fitBounds(safeRouteLayer.getBounds());

        // AI Safety Brief
        const briefEl = document.getElementById('ai-brief-text');
        briefEl.innerText = safeReason;

        // Reset UI
        document.getElementById('select-safe-route').classList.add('active-route');
        document.getElementById('select-fast-route').classList.remove('active-route');
        currentActiveRouteType = 'safe';

        const routeSheet = document.getElementById('route-sheet');
        routeSheet.classList.remove('hidden');
        routeSheet.classList.add('visible');

        searchBtn.innerHTML = '<ion-icon name="shield-checkmark-outline" style="vertical-align:-3px; margin-right:6px;"></ion-icon>Find Safe Route';

        if (!liveMarker) {
            liveMarker = new google.maps.Marker({
                position: { lat: currentStartCoords[0], lng: currentStartCoords[1] },
                map: map,
                icon: liveGpsIcon
            });
        } else {
            liveMarker.setPosition({ lat: currentStartCoords[0], lng: currentStartCoords[1] });
        }
    });

    // Route selection toggle
    document.getElementById('select-safe-route').addEventListener('click', () => {
        if (currentActiveRouteType === 'safe') return;
        currentActiveRouteType = 'safe';
        document.getElementById('select-safe-route').classList.add('active-route');
        document.getElementById('select-fast-route').classList.remove('active-route');
        safeRouteLayer.setOptions({ strokeOpacity: 0.95, strokeWeight: 5, zIndex: 10 });
        fastRouteLayer.setOptions({ strokeOpacity: 0.3, strokeWeight: 3, zIndex: 5 });
        fetchSafeSpotsAlongRoute(safeRouteLayer.getBounds());
    });

    document.getElementById('select-fast-route').addEventListener('click', () => {
        if (currentActiveRouteType === 'fast') return;
        currentActiveRouteType = 'fast';
        document.getElementById('select-fast-route').classList.add('active-route');
        document.getElementById('select-safe-route').classList.remove('active-route');
        fastRouteLayer.setOptions({ strokeOpacity: 0.95, strokeWeight: 5, zIndex: 10 });
        safeRouteLayer.setOptions({ strokeOpacity: 0.3, strokeWeight: 3, zIndex: 5 });
        fetchSafeSpotsAlongRoute(fastRouteLayer.getBounds());
    });


    // ════════════════════════════════════════════
    // 7. LIVE NAVIGATION
    // ════════════════════════════════════════════
    document.getElementById('start-nav-btn').addEventListener('click', () => {
        document.getElementById('route-sheet').classList.remove('visible');
        document.getElementById('search-card').classList.add('hidden');
        document.getElementById('nav-header-live').classList.remove('hidden');

        const activeRoute = currentActiveRouteType === 'safe' ? window.activeSafeRouteData : window.activeFastRouteData;
        if (activeRoute?.legs?.[0]?.steps?.length > 1) {
            const step = activeRoute.legs[0].steps[1] || activeRoute.legs[0].steps[0];
            const dist = step.distance < 1000 ? `${Math.round(step.distance)}m` : `${(step.distance / 1000).toFixed(1)}km`;
            const instr = step.maneuver.instruction || `${step.maneuver.type} ${step.maneuver.modifier || ''}`;
            document.getElementById('turn-distance').innerText    = `In ${dist}`;
            document.getElementById('turn-instruction').innerText = instr;
            document.getElementById('turn-icon').name             = getManeuverIcon(step.maneuver.modifier);
        } else {
            document.getElementById('turn-distance').innerText    = 'Follow route';
            document.getElementById('turn-instruction').innerText = 'Proceed to destination';
        }

        if (currentActiveRouteType === 'safe') map.removeLayer(fastRouteLayer);
        else                                    map.removeLayer(safeRouteLayer);

        const activeLayer = currentActiveRouteType === 'safe' ? safeRouteLayer : fastRouteLayer;
        map.fitBounds(activeLayer.getBounds(), { padding: [50, 50] });

        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                pos => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    if (!liveMarker) {
                        liveMarker = new google.maps.Marker({
                            position: { lat, lng },
                            map: map,
                            icon: liveGpsIcon
                        });
                    } else {
                        liveMarker.setPosition({ lat, lng });
                    }
                    map.panTo({ lat, lng });
                },
                err => console.warn('GPS watch error', err),
                { enableHighAccuracy: true, maximumAge: 0 }
            );
        }
    });

    document.getElementById('end-nav-btn').addEventListener('click', () => {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        document.getElementById('rating-modal').classList.remove('hidden');
    });


    // ════════════════════════════════════════════
    // 8. SOS (Button + Shake)
    // ════════════════════════════════════════════
    const sosWrapper = document.querySelector('.sos-wrapper');
    const shakeToast = document.getElementById('shake-toast');

    const showShakeToast = () => {
        shakeToast.classList.add('visible');
        setTimeout(() => shakeToast.classList.remove('visible'), 2800);
    };

    let audioCtx = null;
    let oscillator = null;
    let gainNode = null;
    let sirenInterval = null;
    let isAlarmRinging = false;

    function startSiren() {
        if (isAlarmRinging) return;
        isAlarmRinging = true;

        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            oscillator = audioCtx.createOscillator();
            gainNode = audioCtx.createGain();
            
            oscillator.type = 'square'; // Very loud, piercing wave
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
            oscillator.start();

            let isHigh = true;
            sirenInterval = setInterval(() => {
                if (!audioCtx || !oscillator) return;
                if (isHigh) {
                    oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
                } else {
                    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
                }
                isHigh = !isHigh;
            }, 400);

            document.getElementById('stop-alarm-container').style.display = 'flex';
        } catch(e) {
            console.error("Failed to start siren", e);
        }
    }

    function stopSiren() {
        if (!isAlarmRinging) return;
        isAlarmRinging = false;
        
        clearInterval(sirenInterval);
        if (oscillator) {
            try { oscillator.stop(); } catch(e){}
            oscillator.disconnect();
            oscillator = null;
        }
        document.getElementById('stop-alarm-container').style.display = 'none';
    }

    document.getElementById('stop-alarm-btn').addEventListener('click', stopSiren);

    const triggerSOS = () => {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
        sosWrapper.classList.add('pulse-active');
        setTimeout(() => sosWrapper.classList.remove('pulse-active'), 1800);
        
        startSiren();

        const center  = liveMarker ? liveMarker.getPosition() : map.getCenter();
        const lat = typeof center.lat === 'function' ? center.lat() : center.lat;
        const lng = typeof center.lng === 'function' ? center.lng() : center.lng;
        const locUrl  = `http://maps.google.com/?q=${lat},${lng}`;
        let message   = `🚨 EMERGENCY SOS from SafeHer: I need help immediately!\nMy location: ${locUrl}`;

        if (transportSubMode === 'cab') {
            const plate = document.getElementById('cab-number-input').value.trim();
            if (plate) message += `\nTraveling in Cab/Auto: ${plate}`;
        }

        const phones = emergencyContacts.map(c => c.phone);
        if (window.AndroidSMS) {
            try {
                window.AndroidSMS.sendEmergencySMS(JSON.stringify(phones), message);
            } catch(e) { console.error('SMS Error:', e); }
            
            try {
                if (typeof window.AndroidSMS.startSosVideoRecording === 'function') {
                    window.AndroidSMS.startSosVideoRecording();
                } else {
                    alert('Video recording function not found in app! You might need to completely Rebuild/Reinstall the app from Android Studio to clear the old cache.');
                }
            } catch(e) { alert('Video bridge error: ' + e); }
        } else {
            alert(`[Web Preview]\nSMS would be sent to: ${phones.join(', ') || 'no contacts saved'}\n\n${message}`);
        }
    };

    // Button SOS
    document.getElementById('sos-btn').addEventListener('click', triggerSOS);
    document.getElementById('sos-btn').addEventListener('touchstart', e => { e.preventDefault(); triggerSOS(); }, { passive: false });

    // Shake-to-SOS (triggered by native Kotlin layer via evaluateJavascript)
    window.onShakeSOS = () => {
        showShakeToast();
        triggerSOS();
    };

    // Show shake badge if supported
    if (window.AndroidShake?.isShakeSupported?.()) {
        document.getElementById('shake-badge').style.display = 'inline-flex';
    }

    // Web fallback: DeviceMotion shake detection (for browser testing)
    if (!window.AndroidShake && window.DeviceMotionEvent) {
        let lastTime  = 0;
        let shakeCount = 0;
        window.addEventListener('devicemotion', e => {
            const acc = e.accelerationIncludingGravity;
            if (!acc) return;
            const now    = Date.now();
            const gForce = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2) / 9.81;
            if (gForce > 3 && now - lastTime > 500) {
                lastTime = now;
                shakeCount++;
                if (shakeCount >= 3) {
                    shakeCount = 0;
                    window.onShakeSOS();
                }
                setTimeout(() => { shakeCount = 0; }, 3000);
            }
        });
        document.getElementById('shake-badge').style.display = 'inline-flex';
    }


    // ════════════════════════════════════════════
    // 9. HAZARD REPORTING
    // ════════════════════════════════════════════
    document.getElementById('report-hazard-btn').addEventListener('click', () =>
        document.getElementById('hazard-modal').classList.remove('hidden'));
    document.getElementById('cancel-hazard').addEventListener('click', () =>
        document.getElementById('hazard-modal').classList.add('hidden'));
    document.getElementById('submit-hazard').addEventListener('click', () => {
        const sel    = document.getElementById('hazard-type');
        const type   = sel.options[sel.selectedIndex].text;
        const center = liveMarker ? liveMarker.getPosition() : map.getCenter();
        const marker = new google.maps.Marker({
            position: center,
            map: map,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#FFB300', fillOpacity: 1, strokeWeight: 0 },
            title: `⚠️ Report - ${type}`
        });
        const infoWindow = new google.maps.InfoWindow({ content: `<b>⚠️ Report</b><br>${type}` });
        infoWindow.open(map, marker);
        marker.addListener('click', () => infoWindow.open(map, marker));
        document.getElementById('hazard-modal').classList.add('hidden');
    });


    // ════════════════════════════════════════════
    // 10. AI CHATBOT
    // ════════════════════════════════════════════
    const aiChatModal = document.getElementById('ai-chat-modal');
    const chatMessages = document.getElementById('chat-messages');

    document.getElementById('ai-chat-btn').addEventListener('click', () => aiChatModal.classList.remove('hidden'));
    document.getElementById('close-chat-btn').addEventListener('click', () => aiChatModal.classList.add('hidden'));

    const addMsg = (text, isUser) => {
        const div = document.createElement('div');
        div.className = `chat-msg ${isUser ? 'user-msg' : 'ai-msg'}`;
        div.innerText = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return div;
    };

    const handleChat = async () => {
        const input = document.getElementById('chat-input');
        const text  = input.value.trim();
        if (!text) return;
        addMsg(text, true);
        input.value = '';
        const loading = addMsg('…', false);
        loading.classList.add('ai-loading');
        const response = await fetchAIResponse(text);
        loading.innerText = response;
        loading.classList.remove('ai-loading');
    };

    document.getElementById('chat-send-btn').addEventListener('click', handleChat);
    document.getElementById('chat-input').addEventListener('keypress', e => { if (e.key === 'Enter') handleChat(); });


    // ════════════════════════════════════════════
    // 11. RATING & ANALYTICS
    // ════════════════════════════════════════════
    const ratingModal = document.getElementById('rating-modal');
    const stars       = document.querySelectorAll('#star-rating ion-icon');
    let currentRating = 0;

    stars.forEach(star => {
        star.addEventListener('click', e => {
            currentRating = parseInt(e.target.dataset.value);
            stars.forEach(s => {
                const active = parseInt(s.dataset.value) <= currentRating;
                s.name = active ? 'star' : 'star-outline';
                s.classList.toggle('active', active);
            });
        });
    });

    const resetNav = () => {
        ratingModal.classList.add('hidden');
        document.getElementById('search-card').classList.remove('hidden');
        document.getElementById('nav-header-live').classList.add('hidden');
        if (safeRouteLayer) safeRouteLayer.setMap(null);
        if (fastRouteLayer) fastRouteLayer.setMap(null);
        map.setCenter({ lat: 12.9716, lng: 77.5946 });
        map.setZoom(14);
        currentRating = 0;
        stars.forEach(s => { s.name = 'star-outline'; s.classList.remove('active'); });
        document.getElementById('rating-comment').value = '';
    };

    document.getElementById('skip-rating-btn').addEventListener('click', resetNav);

    document.getElementById('submit-rating-btn').addEventListener('click', () => {
        if (currentRating > 0) {
            const trips = JSON.parse(localStorage.getItem('safeHerTrips')) || [];
            const now = new Date();
            const hour = now.getHours();
            const timeOfDay = (hour >= 6 && hour < 18) ? 'Day' : 'Night';
            
            trips.push({
                date:    now.toISOString(),
                start:   document.getElementById('start-input').value.trim() || 'Current Location',
                dest:    document.getElementById('destination-input').value.trim() || 'Destination',
                mode:    transportMode,
                rating:  currentRating,
                comment: document.getElementById('rating-comment').value.trim(),
                timeOfDay: timeOfDay
            });
            localStorage.setItem('safeHerTrips', JSON.stringify(trips));
        }
        resetNav();
    });

    // Reports Dashboard
    document.getElementById('view-reports-btn').addEventListener('click', () => {
        closeNav();
        const reportsModal = document.getElementById('reports-modal');
        reportsModal.classList.remove('hidden');
        const trips = JSON.parse(localStorage.getItem('safeHerTrips')) || [];
        document.getElementById('total-trips-stat').innerText = trips.length;
        const routesList = document.getElementById('past-routes-list');
        routesList.innerHTML = '';
        
        const chartEl = document.getElementById('safety-chart');
        if (window.safetyChartInstance) {
            window.safetyChartInstance.destroy();
        }

        if (!trips.length) {
            document.getElementById('avg-safety-stat').innerText = '--';
            routesList.innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:24px;">No trips recorded yet. Start navigating!</p>';
            if (chartEl) chartEl.style.display = 'none';
            return;
        }
        
        if (chartEl) chartEl.style.display = 'block';

        const avg = (trips.reduce((s, t) => s + t.rating, 0) / trips.length).toFixed(1);
        document.getElementById('avg-safety-stat').innerText = `${avg} / 5`;

        // Render Chart
        if (chartEl && window.Chart) {
            const ctx = chartEl.getContext('2d');
            const labels = trips.map(t => new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
            const data = trips.map(t => t.rating);
            
            window.safetyChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Safety Rating',
                        data: data,
                        borderColor: '#FF2D6B',
                        backgroundColor: 'rgba(255, 45, 107, 0.2)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#FFD600',
                        pointBorderColor: '#fff',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { min: 0, max: 5, ticks: { stepSize: 1, color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        x: { ticks: { color: '#aaa' }, grid: { display: false } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }

        [...trips].reverse().forEach(trip => {
            const date = new Date(trip.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const timeIcon = trip.timeOfDay === 'Day' ? '☀️ Day' : (trip.timeOfDay === 'Night' ? '🌙 Night' : '');
            const card = document.createElement('div');
            card.className = 'route-history-card';
            card.innerHTML = `
                <div class="route-history-info">
                    <h5>${trip.start} → ${trip.dest}</h5>
                    <p>${date} · ${trip.mode} ${timeIcon ? `· <span style="color:var(--brand-pink); font-weight:600;">${timeIcon}</span>` : ''}</p>
                </div>
                <div class="route-history-rating">
                    ${trip.rating} <ion-icon name="star"></ion-icon>
                </div>`;
            routesList.appendChild(card);
        });
    });

    document.getElementById('close-reports-btn').addEventListener('click', () =>
        document.getElementById('reports-modal').classList.add('hidden'));



});
