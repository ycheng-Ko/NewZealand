// -------------------------------------------------------------
// 紐西蘭自駕冒險指南 - Apple Premium Aesthetic App Logic
// State Management, Leaflet Map, Interactive Inline Editing
// -------------------------------------------------------------

let itinerary = [];
let currentDay = null; // null = Overview, Number = active Day
const EXCHANGE_RATE = 20; // 1 NZD = 20 TWD
let currencyMode = localStorage.getItem('nz_currency_mode') || 'NZD';

// DOM Cache
const overviewPage = document.getElementById('overview-page');
const detailPage = document.getElementById('detail-page');
const itineraryList = document.getElementById('itinerary-list');

// Dashboard Widgets
const statTotalDays = document.getElementById('stat-total-days');
const statProgressVal = document.getElementById('stat-progress-val');
const statProgressFill = document.getElementById('stat-progress-fill');
const statCostCompare = document.getElementById('stat-cost-compare');

// Detail Inputs
const detailDayNum = document.getElementById('detail-day-num');
const detailDayDateInput = document.getElementById('detail-day-date-input');
const detailDayTitleInput = document.getElementById('detail-day-title-input');
const detailStartLocInput = document.getElementById('detail-start-loc-input');
const detailEndLocInput = document.getElementById('detail-end-loc-input');
const detailAttractionsList = document.getElementById('detail-attractions-list');
const detailNotesInput = document.getElementById('detail-notes-input');

const detailEstTimeInput = document.getElementById('detail-est-time-input');
const detailActTimeInput = document.getElementById('detail-act-time-input');
const detailEstCostInput = document.getElementById('detail-est-cost-input');
const detailActCostInput = document.getElementById('detail-act-cost-input');
const detailBudgetStatus = document.getElementById('detail-budget-status');

// Coordinates validator
function isNZCoord(coord) {
  if (!coord || coord.length < 2) return false;
  const lat = coord[0];
  const lng = coord[1];
  return lat >= -48 && lat <= -34 && lng >= 165 && lng <= 179;
}

// Storage Handles
function loadItinerary() {
  const stored = localStorage.getItem('nz_roadtrip_itinerary');
  if (stored) {
    try {
      itinerary = JSON.parse(stored);
    } catch (e) {
      console.error("Error loading localStorage, reverting to default.", e);
      itinerary = JSON.parse(JSON.stringify(defaultItinerary));
    }
  } else {
    itinerary = JSON.parse(JSON.stringify(defaultItinerary));
    saveItinerary();
  }
  sortItinerary();
}

function saveItinerary() {
  localStorage.setItem('nz_roadtrip_itinerary', JSON.stringify(itinerary));
}

function sortItinerary() {
  itinerary.sort((a, b) => a.day - b.day);
}

// -------------------------------------------------------------
// MAP ENGINE
// -------------------------------------------------------------
let map;
let mapLayers = {};
let activeLayer = 'satellite';
let routeFeatureGroup;

// Free public Nominatim geocoding helper (looks up coordinates by name in NZ)
async function geocodeLocation(locationName) {
  if (!locationName || locationName.trim() === '') return null;
  // Append New Zealand to scope geocoder results
  const query = encodeURIComponent(`${locationName.trim()}, New Zealand`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'NZ-RoadTrip-Planner-App/2.0 (ycheng-ko@github)'
      }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      return [lat, lon];
    }
  } catch (e) {
    console.error("Geocoding failed for:", locationName, e);
  }
  return null;
}

// Free public OSRM routing helper (supports passing multiple waypoints)
async function fetchDrivingRoute(coordsArray) {
  if (!coordsArray || coordsArray.length < 2) return null;
  const validCoords = coordsArray.filter(c => isNZCoord(c));
  if (validCoords.length < 2) return null;
  
  // OSRM expects longitude,latitude format
  const coordString = validCoords.map(c => `${c[1]},${c[0]}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const routeData = data.routes[0];
      const geojsonCoords = routeData.geometry.coordinates; // array of [lng, lat]
      // Convert to [lat, lng] for Leaflet
      return {
        coordinates: geojsonCoords.map(coord => [coord[1], coord[0]]),
        distance: routeData.distance, // meters
        duration: routeData.duration  // seconds
      };
    }
  } catch (e) {
    console.error("Failed to fetch driving route from OSRM:", e);
  }
  return null;
}

// Background utility to populate actual driving routes on startup
async function populateMissingDrivingRoutes() {
  let updated = false;
  for (let i = 0; i < itinerary.length; i++) {
    const item = itinerary[i];
    // Check if we have at least 2 valid coordinates, and routeCoords is short (under 15 points, meaning it's a rough draft)
    const baseCoords = (item.routeCoords && item.routeCoords.length > 0) ? item.routeCoords : [item.startCoords, item.endCoords];
    const validNZCoords = baseCoords.filter(c => isNZCoord(c));
    
    if (validNZCoords.length >= 2 && (!item.routeCoords || item.routeCoords.length < 15 || item.routeDistance === undefined)) {
      console.log(`Busting and fetching high-detail driving route for Day ${item.day}...`);
      const routeResult = await fetchDrivingRoute(validNZCoords);
      if (routeResult) {
        item.routeCoords = routeResult.coordinates;
        item.routeDistance = routeResult.distance;
        item.routeDuration = routeResult.duration;
        updated = true;
        // Delay to prevent rate-limiting on open source routing servers
        await new Promise(r => setTimeout(r, 600));
      }
    }
  }
  if (updated) {
    saveItinerary();
    if (map) {
      updateMap();
    }
  }
}

function initMap() {
  map = L.map('map', {
    center: [-44.2000, 171.2000],
    zoom: 6,
    zoomControl: true
  });

  // Google Hybrid Satellite Layer (Satellite imagery + Labels/Roads overlay, sharp retina tiles)
  mapLayers.satellite = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&scale=2', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps'
  });

  // Google Standard RoadMap Layer (Sharp retina tiles)
  mapLayers.street = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=2', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps'
  });

  mapLayers.satellite.addTo(map);
  routeFeatureGroup = L.featureGroup().addTo(map);
}

function switchMapLayer(layerKey) {
  if (activeLayer === layerKey) return;
  map.removeLayer(mapLayers[activeLayer]);
  mapLayers[layerKey].addTo(map);
  activeLayer = layerKey;
  document.getElementById('layer-sat-btn').classList.toggle('active', layerKey === 'satellite');
  document.getElementById('layer-street-btn').classList.toggle('active', layerKey === 'street');
}

// Setup Map switcher
document.getElementById('layer-sat-btn').addEventListener('click', () => switchMapLayer('satellite'));
document.getElementById('layer-street-btn').addEventListener('click', () => switchMapLayer('street'));

function updateMap() {
  if (!map) return;
  routeFeatureGroup.clearLayers();
  if (itinerary.length === 0) return;

  const allNZCoords = [];

  if (currentDay === null) {
    // Overview path
    itinerary.forEach((item, index) => {
      const routePoints = item.routeCoords && item.routeCoords.length > 0
        ? item.routeCoords
        : [item.startCoords, item.endCoords];

      const nzRoutePoints = routePoints.filter(c => isNZCoord(c));
      nzRoutePoints.forEach(c => allNZCoords.push(c));

      if (nzRoutePoints.length >= 2) {
        L.polyline(nzRoutePoints, {
          color: '#007aff',
          weight: 4,
          opacity: 0.8,
          lineJoin: 'round'
        }).addTo(routeFeatureGroup);
      }

      if (isNZCoord(item.startCoords)) {
        const marker = L.circleMarker(item.startCoords, {
          radius: 8,
          fillColor: '#ffffff',
          color: '#5c9df5',
          weight: 2.5,
          fillOpacity: 1,
          className: 'map-clickable-marker'
        }).addTo(routeFeatureGroup);

        marker.bindTooltip(`Day ${item.day}: ${item.title}`, {
          direction: 'top',
          offset: [0, -5],
          opacity: 0.9
        });

        // Click marker on map to go directly to that day's detail page
        marker.on('click', () => {
          switchPage('detail', item.day);
        });
      }
    });

    if (allNZCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allNZCoords), { padding: [40, 40] });
    }
  } else {
    // Detailed day map
    const dayItem = itinerary.find(d => d.day === currentDay);
    if (!dayItem) return;

    const routePoints = dayItem.routeCoords && dayItem.routeCoords.length > 0
      ? dayItem.routeCoords
      : [dayItem.startCoords, dayItem.endCoords];

    const nzRoutePoints = routePoints.filter(c => isNZCoord(c));
    nzRoutePoints.forEach(c => allNZCoords.push(c));

    if (nzRoutePoints.length >= 2) {
      L.polyline(nzRoutePoints, {
        color: '#89b093', // Morandi green
        weight: 5,
        opacity: 0.9,
        lineJoin: 'round'
      }).addTo(routeFeatureGroup);
    }

    if (isNZCoord(dayItem.startCoords)) {
      L.circleMarker(dayItem.startCoords, {
        radius: 7,
        fillColor: '#5c9df5', // Sky Blue
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
      }).addTo(routeFeatureGroup).bindPopup(`起點: ${dayItem.startLoc}`);
    }

    if (isNZCoord(dayItem.endCoords)) {
      L.circleMarker(dayItem.endCoords, {
        radius: 8,
        fillColor: '#e0985c', // Morandi Orange
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
      }).addTo(routeFeatureGroup).bindPopup(`終點: ${dayItem.endLoc}`);
    }

    if (allNZCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allNZCoords), { padding: [50, 50] });
    }
  }
}

// -------------------------------------------------------------
// RENDER & FLOW
// -------------------------------------------------------------

function renderDashboard() {
  statTotalDays.textContent = itinerary.length;

  let totalAttractions = 0;
  let visitedAttractions = 0;
  let totalEstCost = 0;
  let totalActCost = 0;

  itinerary.forEach(day => {
    if (day.attractions) {
      totalAttractions += day.attractions.length;
      visitedAttractions += day.attractions.filter(a => a.visited).length;
    }
    totalEstCost += Number(day.estCost) || 0;
    totalActCost += Number(day.actCost) || 0;
  });

  statProgressVal.textContent = `${visitedAttractions} / ${totalAttractions}`;
  const pct = totalAttractions > 0 ? (visitedAttractions / totalAttractions) * 100 : 0;
  statProgressFill.style.width = `${pct}%`;
  
  const displayEstTotal = currencyMode === 'TWD' ? totalEstCost * EXCHANGE_RATE : totalEstCost;
  const displayActTotal = currencyMode === 'TWD' ? totalActCost * EXCHANGE_RATE : totalActCost;
  const displayUnit = currencyMode === 'TWD' ? 'NT$' : 'NZ$';
  statCostCompare.textContent = `${displayUnit} ${displayEstTotal.toLocaleString()} / ${displayUnit} ${displayActTotal.toLocaleString()}`;
}

function renderOverviewPage() {
  itineraryList.innerHTML = '';

  if (itinerary.length === 0) {
    itineraryList.innerHTML = `
      <div class="ios-card" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
        <i class="fa-solid fa-plane-tail" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--primary);"></i>
        <p>目前沒有任何規劃天數。請點選上方「新增一天」開始自駕規劃！</p>
      </div>
    `;
    return;
  }

  itinerary.forEach(item => {
    const card = document.createElement('div');
    card.className = 'ios-card itinerary-card-item';
    
    const countTotal = item.attractions ? item.attractions.length : 0;
    const countVisited = item.attractions ? item.attractions.filter(a => a.visited).length : 0;

    const estCostVal = Number(item.estCost) || 0;
    const displayCost = currencyMode === 'TWD' ? estCostVal * EXCHANGE_RATE : estCostVal;
    const displayUnit = currencyMode === 'TWD' ? 'NT$' : 'NZ$';

    card.innerHTML = `
      <div class="card-badge">
        <span class="card-badge-lbl">DAY</span>
        <span class="card-badge-val">${item.day}</span>
      </div>
      <div class="card-main-info">
        <h3>${item.title}</h3>
        <span class="card-date-lbl">${item.date || '未排日期'}</span>
      </div>
      <div class="card-indicators">
        <span class="indicator-pill">${countVisited}/${countTotal} 景點</span>
        <span class="indicator-pill cost">${displayUnit} ${displayCost.toLocaleString()}</span>
      </div>
      <i class="fa-solid fa-chevron-right chevron-right-arrow"></i>
    `;

    card.addEventListener('click', () => switchPage('detail', item.day));
    itineraryList.appendChild(card);
  });
}

function formatCalcDuration(seconds) {
  if (seconds === undefined || seconds === null) return "-";
  const mins = Math.round(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hrs > 0) {
    return `${hrs} 小時 ${remainingMins} 分鐘`;
  }
  return `${mins} 分鐘`;
}

function formatCalcDistance(meters) {
  if (meters === undefined || meters === null) return "-";
  return `${(meters / 1000).toFixed(1)} 公里`;
}

function renderDetailPage(dayNum) {
  const dayItem = itinerary.find(d => d.day === dayNum);
  if (!dayItem) {
    switchPage('overview');
    return;
  }

  // Populate inputs with values
  detailDayNum.textContent = dayItem.day;
  detailDayDateInput.value = dayItem.date || '';
  detailDayTitleInput.value = dayItem.title || '';
  detailStartLocInput.value = dayItem.startLoc || '';
  detailEndLocInput.value = dayItem.endLoc || '';
  detailNotesInput.value = dayItem.notes || '';
  
  detailEstTimeInput.value = dayItem.estDuration || '';
  detailActTimeInput.value = dayItem.actDuration || '';

  // Populate map calculation metrics
  document.getElementById('detail-calc-distance').textContent = formatCalcDistance(dayItem.routeDistance);
  document.getElementById('detail-calc-duration').textContent = formatCalcDuration(dayItem.routeDuration);

  // On-demand fetch if missing
  if (isNZCoord(dayItem.startCoords) && isNZCoord(dayItem.endCoords) && (dayItem.routeDistance === undefined || dayItem.routeDistance === null)) {
    fetchDrivingRoute([dayItem.startCoords, dayItem.endCoords]).then(res => {
      if (res) {
        dayItem.routeCoords = res.coordinates;
        dayItem.routeDistance = res.distance;
        dayItem.routeDuration = res.duration;
        saveItinerary();
        updateMap();
        
        if (currentDay === dayItem.day) {
          const distEl = document.getElementById('detail-calc-distance');
          const durEl = document.getElementById('detail-calc-duration');
          if (distEl) distEl.textContent = formatCalcDistance(dayItem.routeDistance);
          if (durEl) durEl.textContent = formatCalcDuration(dayItem.routeDuration);
        }
      }
    });
  }

  // Update labels
  document.getElementById('label-est-cost').textContent = `預計金額 (${currencyMode === 'TWD' ? 'NT$' : 'NZ$'})`;
  document.getElementById('label-act-cost').textContent = `實際金額 (${currencyMode === 'TWD' ? 'NT$' : 'NZ$'})`;

  // Populate cost inputs
  const estCostVal = Number(dayItem.estCost) || 0;
  const actCostVal = Number(dayItem.actCost) || 0;
  detailEstCostInput.value = currencyMode === 'TWD' ? Math.round(estCostVal * EXCHANGE_RATE) : estCostVal;
  detailActCostInput.value = currencyMode === 'TWD' ? Math.round(actCostVal * EXCHANGE_RATE) : actCostVal;

  // Render Budget indicator
  renderBudgetStatus(dayItem);

  // Render attractions list
  renderAttractionsChecklist(dayItem);
}

function renderBudgetStatus(dayItem) {
  const est = Number(dayItem.estCost) || 0;
  const act = Number(dayItem.actCost) || 0;
  
  detailBudgetStatus.className = 'budget-status-tag';
  if (act === 0) {
    detailBudgetStatus.classList.remove('show');
    return;
  }
  
  detailBudgetStatus.classList.add('show');
  const diff = act - est;
  const displayDiff = currencyMode === 'TWD' ? diff * EXCHANGE_RATE : diff;
  const displayUnit = currencyMode === 'TWD' ? 'NT$' : 'NZ$';
  
  if (diff > 0) {
    detailBudgetStatus.classList.add('over');
    detailBudgetStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> 超出預算 ${displayUnit} ${Math.abs(displayDiff).toLocaleString()}`;
  } else if (diff < 0) {
    detailBudgetStatus.classList.add('under');
    detailBudgetStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> 省下預算 ${displayUnit} ${Math.abs(displayDiff).toLocaleString()}`;
  } else {
    detailBudgetStatus.classList.add('under');
    detailBudgetStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> 符合預算範圍`;
  }
}

function renderAttractionsChecklist(dayItem) {
  detailAttractionsList.innerHTML = '';
  
  if (!dayItem.attractions || dayItem.attractions.length === 0) {
    detailAttractionsList.innerHTML = `
      <li style="color: var(--text-secondary); font-size: 0.8rem; text-align: center; padding: 1rem 0;">
        無踩點景點，點擊上方按鈕新增
      </li>
    `;
    return;
  }

  dayItem.attractions.forEach((attr, idx) => {
    const li = document.createElement('li');
    li.className = `ios-checklist-item ${attr.visited ? 'checked' : ''}`;
    
    li.innerHTML = `
      <div class="ios-chk"><i class="fa-solid fa-check"></i></div>
      <input type="text" class="ios-item-input" value="${attr.name}" placeholder="景點名稱">
      <button class="ios-item-delete-btn" title="刪除景點"><i class="fa-solid fa-xmark"></i></button>
    `;

    // 點選 Checkbox 切換 visited
    const chk = li.querySelector('.ios-chk');
    chk.addEventListener('click', (e) => {
      e.stopPropagation();
      attr.visited = !attr.visited;
      li.classList.toggle('checked', attr.visited);
      saveItinerary();
      renderDashboard();
    });

    // 景點修改事件
    const input = li.querySelector('.ios-item-input');
    input.addEventListener('change', () => {
      attr.name = input.value.trim();
      if (!attr.name) {
        // Remove empty
        dayItem.attractions.splice(idx, 1);
        saveItinerary();
        renderDetailPage(dayItem.day);
      } else {
        saveItinerary();
        renderDashboard();
      }
    });

    // 刪除景點事件
    const delBtn = li.querySelector('.ios-item-delete-btn');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dayItem.attractions.splice(idx, 1);
      saveItinerary();
      renderDetailPage(dayItem.day);
      renderDashboard();
    });

    detailAttractionsList.appendChild(li);
  });
}

// -------------------------------------------------------------
// INLINE EVENT LISTENERS (Save on Blur / Change)
// -------------------------------------------------------------
function setupInlineChangeHandlers() {
  const saveField = (fieldKey, valueGetter) => {
    if (currentDay === null) return;
    const dayItem = itinerary.find(d => d.day === currentDay);
    if (dayItem) {
      const newVal = valueGetter();
      dayItem[fieldKey] = newVal;
      saveItinerary();
      renderDashboard();
      if (fieldKey === 'estCost' || fieldKey === 'actCost') {
        renderBudgetStatus(dayItem);
      }
    }
  };

  detailDayDateInput.addEventListener('change', () => saveField('date', () => detailDayDateInput.value));
  detailDayTitleInput.addEventListener('change', () => saveField('title', () => detailDayTitleInput.value));
  
  detailStartLocInput.addEventListener('change', () => {
    saveField('startLoc', () => detailStartLocInput.value);
    syncMapPoints();
  });
  
  detailEndLocInput.addEventListener('change', () => {
    saveField('endLoc', () => detailEndLocInput.value);
    syncMapPoints();
  });

  detailEstTimeInput.addEventListener('change', () => saveField('estDuration', () => detailEstTimeInput.value));
  detailActTimeInput.addEventListener('change', () => saveField('actDuration', () => detailActTimeInput.value));
  
  detailEstCostInput.addEventListener('change', () => saveField('estCost', () => {
    const raw = Number(detailEstCostInput.value) || 0;
    return currencyMode === 'TWD' ? Math.round(raw / EXCHANGE_RATE) : raw;
  }));
  detailActCostInput.addEventListener('change', () => saveField('actCost', () => {
    const raw = Number(detailActCostInput.value) || 0;
    return currencyMode === 'TWD' ? Math.round(raw / EXCHANGE_RATE) : raw;
  }));
  
  detailNotesInput.addEventListener('change', () => saveField('notes', () => detailNotesInput.value));
}

async function syncMapPoints() {
  const dayItem = itinerary.find(d => d.day === currentDay);
  if (!dayItem) return;
  
  // Geocode start location if the user changed the text
  if (dayItem.startLoc) {
    const coords = await geocodeLocation(dayItem.startLoc);
    if (coords && isNZCoord(coords)) {
      dayItem.startCoords = coords;
    }
  }
  
  // Geocode end location if the user changed the text
  if (dayItem.endLoc) {
    const coords = await geocodeLocation(dayItem.endLoc);
    if (coords && isNZCoord(coords)) {
      dayItem.endCoords = coords;
    }
  }

  // Fallbacks if not valid NZ coords
  if (!isNZCoord(dayItem.startCoords)) {
    dayItem.startCoords = [-43.5321, 172.6362]; // Christchurch
  }
  if (!isNZCoord(dayItem.endCoords)) {
    dayItem.endCoords = [-44.0047, 170.4771]; // Tekapo
  }
  
  const routeResult = await fetchDrivingRoute([dayItem.startCoords, dayItem.endCoords]);
  if (routeResult) {
    dayItem.routeCoords = routeResult.coordinates;
    dayItem.routeDistance = routeResult.distance;
    dayItem.routeDuration = routeResult.duration;
  } else {
    dayItem.routeCoords = [dayItem.startCoords, dayItem.endCoords];
    dayItem.routeDistance = null;
    dayItem.routeDuration = null;
  }
  saveItinerary();
  updateMap();
  if (currentDay === dayItem.day) {
    renderDetailPage(currentDay);
  }
}

// Add New Attraction
document.getElementById('add-attraction-btn').addEventListener('click', () => {
  const dayItem = itinerary.find(d => d.day === currentDay);
  if (!dayItem) return;
  
  if (!dayItem.attractions) {
    dayItem.attractions = [];
  }
  
  dayItem.attractions.push({ name: '新增景點景區', visited: false });
  saveItinerary();
  renderDetailPage(currentDay);
  renderDashboard();
});

// -------------------------------------------------------------
// PAGE TRANSITIONS
// -------------------------------------------------------------
function switchPage(pageId, dayNum = null) {
  if (pageId === 'overview') {
    currentDay = null;
    renderOverviewPage();
    detailPage.classList.remove('active');
    overviewPage.classList.add('active');
  } else if (pageId === 'detail' && dayNum !== null) {
    currentDay = Number(dayNum);
    renderDetailPage(currentDay);
    overviewPage.classList.remove('active');
    detailPage.classList.add('active');
  }

  renderDashboard();

  setTimeout(() => {
    if (map) {
      map.invalidateSize();
      updateMap();
    }
  }, 100);
}

// Navigation Events
document.getElementById('back-to-overview-btn').addEventListener('click', () => switchPage('overview'));
document.querySelector('.brand').addEventListener('click', () => switchPage('overview'));

// Swipe Back (Left to Right) gesture on mobile
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

detailPage.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].clientX;
  touchStartY = e.changedTouches[0].clientY;
}, { passive: true });

detailPage.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].clientX;
  touchEndY = e.changedTouches[0].clientY;
  
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;
  
  if (diffX > 60 && Math.abs(diffY) < 40 && touchStartX < 90) {
    if (currentDay !== null) switchPage('overview');
  }
}, { passive: true });

// -------------------------------------------------------------
// ACTIONS (ADD, DELETE, IMPORT, EXPORT, RESET)
// -------------------------------------------------------------

// Add Day
document.getElementById('add-day-btn').addEventListener('click', () => {
  const nextDay = itinerary.length > 0 ? (itinerary[itinerary.length - 1].day + 1) : 1;
  const newDayData = {
    day: nextDay,
    date: `Day ${nextDay}`,
    title: `新自駕規劃起點 → 終點`,
    startLoc: itinerary.length > 0 ? itinerary[itinerary.length - 1].endLoc : '基督城',
    endLoc: '蒂卡波湖',
    startCoords: itinerary.length > 0 ? [...itinerary[itinerary.length - 1].endCoords] : [-43.5321, 172.6362],
    endCoords: [-44.0047, 170.4771],
    routeCoords: [],
    attractions: [],
    estDuration: '3 小時',
    actDuration: '',
    estCost: 100,
    actCost: 0,
    notes: '在此輸入旅程注意事項...'
  };
  newDayData.routeCoords = [newDayData.startCoords, newDayData.endCoords];
  itinerary.push(newDayData);
  saveItinerary();
  switchPage('detail', nextDay);
});

// Delete Day
document.getElementById('delete-day-btn').addEventListener('click', () => {
  if (currentDay === null) return;
  if (confirm(`確認要移除 Day ${currentDay} 的旅程資料嗎？`)) {
    itinerary = itinerary.filter(d => d.day !== currentDay);
    saveItinerary();
    switchPage('overview');
  }
});

// Reset Default
document.getElementById('reset-btn').addEventListener('click', () => {
  if (confirm("確認要恢復成預設的 16 天經典行程表嗎？這會覆蓋目前所有的修改。")) {
    localStorage.removeItem('nz_roadtrip_itinerary');
    loadItinerary();
    switchPage('overview');
    populateMissingDrivingRoutes();
  }
});



// Coordinate Mapping Dictionary for common locations in NZ to avoid geocoder rate limits
const KNOWN_COORDS = {
  "桃園機場": [25.0797, 121.2342],
  "桃園機場報到": [25.0797, 121.2342],
  "台灣桃園機場": [25.0797, 121.2342],
  "台北": [25.0797, 121.2342],
  "台灣": [25.0797, 121.2342],
  "飛行中": [25.0797, 121.2342],
  "飛機": [25.0797, 121.2342],
  "搭飛機": [25.0797, 121.2342],
  "搭飛機出發": [25.0797, 121.2342],
  "基督城": [-43.5321, 172.6362],
  "基督城機場": [-43.4894, 172.5322],
  "基督城市區": [-43.5321, 172.6362],
  "蒂卡波湖": [-44.0047, 170.4771],
  "好牧羊人教堂": [-44.0047, 170.4771],
  "庫克山": [-43.7342, 170.1030],
  "庫克山村": [-43.7342, 170.1030],
  "普卡基湖": [-44.1751, 170.1557],
  "瓦納卡": [-44.6934, 169.1413],
  "克倫威爾": [-45.0389, 169.1960],
  "皇后鎮": [-45.0312, 168.6626],
  "蒂阿瑙": [-45.4144, 167.7176],
  "米佛峽灣": [-44.6716, 167.9255],
  "但尼丁": [-45.8788, 170.5028],
  "奧馬魯": [-45.1000, 170.9667],
  "抵達台灣": [25.0797, 121.2342]
};

function findKnownCoords(locName) {
  if (!locName) return null;
  const clean = locName.trim();
  if (KNOWN_COORDS[clean]) return KNOWN_COORDS[clean];
  for (const key of Object.keys(KNOWN_COORDS)) {
    if (clean.includes(key) || key.includes(clean)) {
      return KNOWN_COORDS[key];
    }
  }
  return null;
}

function splitBySegments(str) {
  const segments = [];
  let current = "";
  let parenDepth = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(' || char === '（') {
      parenDepth++;
      current += char;
    } else if (char === ')' || char === '）') {
      parenDepth--;
      current += char;
    } else if (parenDepth === 0 && (char === '-' || char === '→' || char === '至')) {
      if (current.trim()) {
        segments.push(current.trim());
      }
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    segments.push(current.trim());
  }
  return segments;
}

function parseSegment(segment) {
  const parenRegex = /[\(（]([^\)）]+)[\)）]/;
  const match = segment.match(parenRegex);
  let location = segment;
  let detailText = "";
  if (match) {
    location = segment.replace(parenRegex, "").trim();
    detailText = match[1].trim();
  }
  return {
    location: location.trim(),
    detailText: detailText
  };
}

function splitDetails(text) {
  if (!text) return [];
  return text.split(/[,，、;；]/).map(t => t.trim()).filter(Boolean);
}

async function parsePlaintextItinerary(text) {
  const lines = text.split(/\r?\n/);
  const parsedDays = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const mainRegex = /^[\s\u200b\ufeff]*([0-9\ufe0f\u20e3\ud83d\udd1f]+)[\s]*([0-9]{1,2}\/[0-9]{1,2}(?:\s*[\u4e00-\u9fa5]+)?)[\s]*(.*)$/;
    const fallbackRegex = /^[\s\u200b\ufeff]*([0-9\ufe0f\u20e3\ud83d\udd1f]+)[\s\.\、]*(.*)$/;

    let match = line.match(mainRegex);
    let rawDay = "";
    let rawDate = "";
    let contentStr = "";

    if (match) {
      rawDay = match[1];
      rawDate = match[2];
      contentStr = match[3];
    } else {
      let fMatch = line.match(fallbackRegex);
      if (fMatch) {
        rawDay = fMatch[1];
        contentStr = fMatch[2];
      } else {
        continue;
      }
    }

    let cleanDayStr = rawDay.replace(/🔟/g, '10');
    cleanDayStr = cleanDayStr.replace(/[^0-9]/g, '');
    const dayVal = parseInt(cleanDayStr, 10);
    if (isNaN(dayVal)) continue;

    let formattedDate = rawDate;
    if (rawDate) {
      const dateMatch = rawDate.match(/^([0-9]{1,2}\/[0-9]{1,2})\s*([\u4e00-\u9fa5]+)?$/);
      if (dateMatch) {
        const baseDate = dateMatch[1];
        const weekday = dateMatch[2] ? dateMatch[2].trim() : "";
        formattedDate = weekday ? `${baseDate} (${weekday})` : baseDate;
      }
    }

    const rawSegments = splitBySegments(contentStr);
    if (rawSegments.length === 0) continue;

    const segments = rawSegments.map(s => parseSegment(s));
    const startLoc = segments[0].location || "起點";
    const endLoc = segments[segments.length - 1].location || "終點";

    let startCoords = findKnownCoords(startLoc);
    if (!startCoords && startLoc !== "起點") {
      startCoords = await geocodeLocation(startLoc);
    }
    if (!startCoords) startCoords = [-43.5321, 172.6362];

    let endCoords = findKnownCoords(endLoc);
    if (!endCoords && endLoc !== "終點") {
      endCoords = await geocodeLocation(endLoc);
    }
    if (!endCoords) endCoords = startCoords;

    const attractions = [];
    const addedAttractions = new Set();

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (i > 0 && i < segments.length - 1 && seg.location) {
        const attractionName = seg.location;
        if (!addedAttractions.has(attractionName)) {
          attractions.push({ name: attractionName, visited: false });
          addedAttractions.add(attractionName);
        }
      }

      if (seg.detailText) {
        const items = splitDetails(seg.detailText);
        for (const item of items) {
          if (!addedAttractions.has(item)) {
            attractions.push({ name: item, visited: false });
            addedAttractions.add(item);
          }
        }
      }
    }

    let title = "";
    if (segments.length > 1) {
      title = segments.map(s => s.location).join(" → ");
    } else {
      title = segments[0].location;
      if (line.includes("✈️") || line.includes("飛機")) {
        title += " ✈️";
      } else if (line.includes("🏠") || line.includes("台灣") || line.includes("回家")) {
        title += " 🏠";
      }
    }

    parsedDays.push({
      day: dayVal,
      date: formattedDate || `Day ${dayVal}`,
      title: title,
      startLoc: startLoc,
      endLoc: endLoc,
      startCoords: startCoords,
      endCoords: endCoords,
      routeCoords: [startCoords, endCoords],
      attractions: attractions,
      estDuration: "未設定",
      actDuration: "",
      estCost: 0,
      actCost: 0,
      notes: line
    });
  }
  return parsedDays;
}

// Import JSON or Text Draft
document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(event) {
    const content = event.target.result;
    
    // 1. Try JSON
    if (file.name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.every(item => item.day && item.title)) {
          itinerary = parsed;
          sortItinerary();
          saveItinerary();
          switchPage('overview');
          populateMissingDrivingRoutes();
          alert("JSON 行程匯入成功！");
          return;
        }
      } catch (err) {
        console.log("Not a valid JSON, falling back to plaintext parser...");
      }
    }

    // 2. Try Plaintext Parser
    try {
      const parsed = await parsePlaintextItinerary(content);
      if (parsed && parsed.length > 0) {
        itinerary = parsed;
        sortItinerary();
        saveItinerary();
        switchPage('overview');
        await populateMissingDrivingRoutes();
        alert("行程草稿匯入成功！已自動解析景點、日期與繪製導航路線。");
      } else {
        alert("錯誤：無法解析行程草稿。請確認檔案格式是否包含 Day 與日期。");
      }
    } catch (err) {
      console.error(err);
      alert("讀取失敗，請確認檔案內容與格式。");
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// -------------------------------------------------------------
// CURRENCY SWITCHER
// -------------------------------------------------------------
function initCurrencyControl() {
  const currNzdBtn = document.getElementById('curr-nzd-btn');
  const currTwdBtn = document.getElementById('curr-twd-btn');

  function switchCurrencyMode(mode) {
    currencyMode = mode;
    localStorage.setItem('nz_currency_mode', mode);
    
    currNzdBtn.classList.toggle('active', mode === 'NZD');
    currTwdBtn.classList.toggle('active', mode === 'TWD');
    
    renderDashboard();
    renderOverviewPage();
    if (currentDay !== null) {
      renderDetailPage(currentDay);
    }
  }

  currNzdBtn.classList.toggle('active', currencyMode === 'NZD');
  currTwdBtn.classList.toggle('active', currencyMode === 'TWD');

  currNzdBtn.addEventListener('click', () => switchCurrencyMode('NZD'));
  currTwdBtn.addEventListener('click', () => switchCurrencyMode('TWD'));
}

// -------------------------------------------------------------
// WORKSPACE RESIZER / SPLITTER
// -------------------------------------------------------------
function initWorkspaceResizer() {
  const workspace = document.querySelector('.app-workspace');
  const mapPanel = document.querySelector('.workspace-map-panel');
  const resizeHandle = document.getElementById('resize-handle');

  let isDragging = false;

  resizeHandle.addEventListener('mousedown', startDrag);
  resizeHandle.addEventListener('touchstart', startDrag, { passive: true });

  function startDrag(e) {
    isDragging = true;
    document.body.style.userSelect = 'none';
    document.body.classList.add('resizing');
    
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
  }

  function onDrag(e) {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const isLandscape = window.matchMedia("(orientation: landscape)").matches;

    if (isLandscape) {
      const rect = workspace.getBoundingClientRect();
      const newWidth = clientX - rect.left;
      const clampedWidth = Math.max(200, Math.min(newWidth, rect.width - 200));
      mapPanel.style.width = `${clampedWidth}px`;
      mapPanel.style.flex = 'none';
    } else {
      const rect = workspace.getBoundingClientRect();
      const newHeight = clientY - rect.top;
      const clampedHeight = Math.max(150, Math.min(newHeight, rect.height - 150));
      mapPanel.style.height = `${clampedHeight}px`;
      mapPanel.style.flex = 'none';
    }

    if (map) {
      map.invalidateSize();
    }
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = '';
    document.body.classList.remove('resizing');
    
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', endDrag);

    if (map) {
      setTimeout(() => { map.invalidateSize(); }, 50);
    }
  }

  // Double click reset to original layout
  resizeHandle.addEventListener('dblclick', resetLayout);
  resizeHandle.addEventListener('dblclick', resetLayout); // Bind double click

  function resetLayout() {
    mapPanel.style.width = '';
    mapPanel.style.height = '';
    mapPanel.style.flex = '';
    if (map) {
      setTimeout(() => { map.invalidateSize(); }, 100);
    }
  }
}

// -------------------------------------------------------------
// STARTUP
// -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  loadItinerary();
  initMap();
  setupInlineChangeHandlers();
  switchPage('overview');
  populateMissingDrivingRoutes();
  initCurrencyControl();
  initWorkspaceResizer();

  // Force Leaflet to resize correctly on rotating screen (Portrait/Landscape toggle)
  window.addEventListener('resize', () => {
    if (map) {
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }
  });

  window.addEventListener('orientationchange', () => {
    if (map) {
      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    }
  });
});
