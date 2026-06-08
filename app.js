// -------------------------------------------------------------
// 紐西蘭自駕冒險指南 - Apple Premium Aesthetic App Logic
// State Management, Leaflet Map, Interactive Inline Editing
// -------------------------------------------------------------

let itinerary = [];
let currentDay = null; // null = Overview, Number = active Day

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
      const geojsonCoords = data.routes[0].geometry.coordinates; // array of [lng, lat]
      // Convert to [lat, lng] for Leaflet
      return geojsonCoords.map(coord => [coord[1], coord[0]]);
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
    
    if (validNZCoords.length >= 2 && (!item.routeCoords || item.routeCoords.length < 15)) {
      console.log(`Busting and fetching high-detail driving route for Day ${item.day}...`);
      const route = await fetchDrivingRoute(validNZCoords);
      if (route) {
        item.routeCoords = route;
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
  statCostCompare.textContent = `NZ$ ${totalEstCost.toLocaleString()} / NZ$ ${totalActCost.toLocaleString()}`;
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
        <span class="indicator-pill cost">NZ$ ${item.estCost || 0}</span>
      </div>
      <i class="fa-solid fa-chevron-right chevron-right-arrow"></i>
    `;

    card.addEventListener('click', () => switchPage('detail', item.day));
    itineraryList.appendChild(card);
  });
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
  detailEstCostInput.value = dayItem.estCost || 0;
  detailActCostInput.value = dayItem.actCost || 0;

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
  if (diff > 0) {
    detailBudgetStatus.classList.add('over');
    detailBudgetStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> 超出預算 NZ$ ${diff.toLocaleString()}`;
  } else if (diff < 0) {
    detailBudgetStatus.classList.add('under');
    detailBudgetStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> 省下預算 NZ$ ${Math.abs(diff).toLocaleString()}`;
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
  
  detailEstCostInput.addEventListener('change', () => saveField('estCost', () => Number(detailEstCostInput.value) || 0));
  detailActCostInput.addEventListener('change', () => saveField('actCost', () => Number(detailActCostInput.value) || 0));
  
  detailNotesInput.addEventListener('change', () => saveField('notes', () => detailNotesInput.value));
}

async function syncMapPoints() {
  const dayItem = itinerary.find(d => d.day === currentDay);
  if (!dayItem) return;
  // If user changed names, default coords
  if (!isNZCoord(dayItem.startCoords)) {
    dayItem.startCoords = [-43.5321, 172.6362]; // Christchurch
  }
  if (!isNZCoord(dayItem.endCoords)) {
    dayItem.endCoords = [-44.0047, 170.4771]; // Tekapo
  }
  
  const route = await fetchDrivingRoute([dayItem.startCoords, dayItem.endCoords]);
  dayItem.routeCoords = route ? route : [dayItem.startCoords, dayItem.endCoords];
  saveItinerary();
  updateMap();
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
  }
});

// Export JSON
document.getElementById('export-btn').addEventListener('click', () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(itinerary, null, 2));
  const a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", "nz-itinerary-premium.json");
  document.body.appendChild(a);
  a.click();
  a.remove();
});

// Import JSON
document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const parsed = JSON.parse(event.target.result);
      if (Array.isArray(parsed) && parsed.every(item => item.day && item.title)) {
        itinerary = parsed;
        sortItinerary();
        saveItinerary();
        switchPage('overview');
        alert("行程匯入成功！");
      } else {
        alert("錯誤：匯入的資料格式不符。");
      }
    } catch (err) {
      alert("讀取失敗，請確認是否為標準 JSON。");
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// -------------------------------------------------------------
// STARTUP
// -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  loadItinerary();
  initMap();
  setupInlineChangeHandlers();
  switchPage('overview');
  populateMissingDrivingRoutes();

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
