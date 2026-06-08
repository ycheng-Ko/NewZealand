// -------------------------------------------------------------
// 紐西蘭自駕冒險指南 App Logic
// State Management, Leaflet Map, Dialog control, LocalStorage Sync
// -------------------------------------------------------------

// 1. STATE & DATA INITIALIZATION
let itinerary = [];
let currentDay = null; // null = Overview page, number = active Day

// DOM elements
const overviewPage = document.getElementById('overview-page');
const detailPage = document.getElementById('detail-page');
const itineraryList = document.getElementById('itinerary-list');

// Stat DOM elements
const statTotalDays = document.getElementById('stat-total-days');
const statProgressVal = document.getElementById('stat-progress-val');
const statProgressFill = document.getElementById('stat-progress-fill');
const statCostCompare = document.getElementById('stat-cost-compare');

// Detail page DOM elements
const detailDayNum = document.getElementById('detail-day-num');
const detailDayDate = document.getElementById('detail-day-date');
const detailDayTitle = document.getElementById('detail-day-title');
const detailStartLoc = document.getElementById('detail-start-loc');
const detailEndLoc = document.getElementById('detail-end-loc');
const detailAttractionsList = document.getElementById('detail-attractions-list');
const detailNotes = document.getElementById('detail-notes');
const detailEstTime = document.getElementById('detail-est-time');
const detailActTime = document.getElementById('detail-act-time');
const detailEstCost = document.getElementById('detail-est-cost');
const detailActCost = document.getElementById('detail-act-cost');
const detailBudgetStatus = document.getElementById('detail-budget-status');

// Dialog elements
const editDialog = document.getElementById('edit-dialog');
const editForm = document.getElementById('edit-form');
const dialogTitle = document.getElementById('dialog-title');
const dialogCloseBtn = document.getElementById('dialog-close-btn');
const dialogCancelBtn = document.getElementById('dialog-cancel-btn');

// Helper: Is the coordinate in New Zealand (roughly)?
function isNZCoord(coord) {
  if (!coord || coord.length < 2) return false;
  const lat = coord[0];
  const lng = coord[1];
  return lat >= -48 && lat <= -34 && lng >= 165 && lng <= 179;
}

// Load itinerary from localStorage or fallback to default
function loadItinerary() {
  const stored = localStorage.getItem('nz_roadtrip_itinerary');
  if (stored) {
    try {
      itinerary = JSON.parse(stored);
    } catch (e) {
      console.error("Error parsing stored itinerary, resetting to default.", e);
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

// 2. LEAFLET MAP CONFIGURATION
let map;
let mapLayers = {};
let activeLayer = 'satellite';
let routeFeatureGroup;

function initMap() {
  map = L.map('map', {
    center: [-44.2000, 171.2000],
    zoom: 6,
    zoomControl: true
  });

  // Layer 1: Esri World Imagery (Satellite)
  mapLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri'
  });

  // Layer 2: OpenStreetMap (Street map)
  mapLayers.street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });

  mapLayers.satellite.addTo(map);
  routeFeatureGroup = L.featureGroup().addTo(map);
}

// Layer switches
document.getElementById('layer-sat-btn').addEventListener('click', () => {
  switchMapLayer('satellite');
});
document.getElementById('layer-street-btn').addEventListener('click', () => {
  switchMapLayer('street');
});

function switchMapLayer(layerKey) {
  if (activeLayer === layerKey) return;
  map.removeLayer(mapLayers[activeLayer]);
  mapLayers[layerKey].addTo(map);
  activeLayer = layerKey;
  document.getElementById('layer-sat-btn').classList.toggle('active', layerKey === 'satellite');
  document.getElementById('layer-street-btn').classList.toggle('active', layerKey === 'street');
}

// Draw paths & markers on the map
function updateMap() {
  if (!map) return;
  routeFeatureGroup.clearLayers();
  if (itinerary.length === 0) return;

  const allNZCoords = [];

  if (currentDay === null) {
    // OVERVIEW: Draw all NZ-based routes
    itinerary.forEach((item, index) => {
      const routePoints = item.routeCoords && item.routeCoords.length > 0
        ? item.routeCoords
        : [item.startCoords, item.endCoords];

      // Filter for NZ-only coordinates for map bounds
      const nzRoutePoints = routePoints.filter(c => isNZCoord(c));
      nzRoutePoints.forEach(c => allNZCoords.push(c));

      // Only draw polyline if we have NZ coords
      if (nzRoutePoints.length >= 2) {
        L.polyline(nzRoutePoints, {
          color: '#10b981',
          weight: 4,
          opacity: 0.8,
          lineJoin: 'round'
        }).addTo(routeFeatureGroup);
      }

      // Draw starting markers for NZ points only
      if (isNZCoord(item.startCoords)) {
        const markerColor = index === 0 || !isNZCoord(itinerary[index - 1]?.endCoords) ? '#f59e0b' : '#10b981';
        L.circleMarker(item.startCoords, {
          radius: 7,
          fillColor: markerColor,
          color: '#ffffff',
          weight: 1.5,
          fillOpacity: 1
        }).addTo(routeFeatureGroup)
          .bindPopup(`<strong>Day ${item.day}</strong><br>${item.startLoc}`);
      }

      // Last day's end marker
      const isLast = index === itinerary.length - 1;
      if (isLast && isNZCoord(item.endCoords)) {
        L.circleMarker(item.endCoords, {
          radius: 9,
          fillColor: '#f59e0b',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 1
        }).addTo(routeFeatureGroup)
          .bindPopup(`<strong>終點</strong><br>${item.endLoc}`);
      }
    });

    if (allNZCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allNZCoords), { padding: [40, 40] });
    }
  } else {
    // DAILY DETAIL VIEW
    const dayItem = itinerary.find(d => d.day === currentDay);
    if (!dayItem) return;

    const routePoints = dayItem.routeCoords && dayItem.routeCoords.length > 0
      ? dayItem.routeCoords
      : [dayItem.startCoords, dayItem.endCoords];

    const nzRoutePoints = routePoints.filter(c => isNZCoord(c));
    nzRoutePoints.forEach(c => allNZCoords.push(c));

    if (nzRoutePoints.length >= 2) {
      L.polyline(nzRoutePoints, {
        color: '#10b981',
        weight: 5,
        opacity: 0.9,
        lineJoin: 'round'
      }).addTo(routeFeatureGroup);
    }

    if (isNZCoord(dayItem.startCoords)) {
      L.circleMarker(dayItem.startCoords, {
        radius: 9,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
      }).addTo(routeFeatureGroup)
        .bindPopup(`<strong>起點:</strong> ${dayItem.startLoc}`)
        .openPopup();
    }

    if (isNZCoord(dayItem.endCoords)) {
      L.circleMarker(dayItem.endCoords, {
        radius: 9,
        fillColor: '#f59e0b',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
      }).addTo(routeFeatureGroup)
        .bindPopup(`<strong>終點:</strong> ${dayItem.endLoc}`);
    }

    if (allNZCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allNZCoords), { padding: [50, 50] });
    } else {
      // Non-NZ day (e.g. flying) — show full NZ overview
      map.setView([-44.2, 171.2], 5);
    }
  }
}

// 3. UI RENDERING & PAGE TRANSITIONS
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
      <div class="card" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
        <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--primary);"></i>
        <p>目前沒有任何行程天數，請點擊上方「新增一天」按鈕開始規劃！</p>
      </div>
    `;
    return;
  }

  itinerary.forEach(item => {
    const card = document.createElement('div');
    card.className = 'itinerary-card card';
    card.setAttribute('data-day', item.day);
    card.id = `itinerary-card-${item.day}`;

    const spotsPreview = item.attractions && item.attractions.length > 0
      ? item.attractions.slice(0, 3).map(a => `
          <span class="spot-pill ${a.visited ? 'visited' : ''}">
            <i class="fa-solid ${a.visited ? 'fa-circle-check' : 'fa-circle-dot'}"></i> ${a.name.length > 12 ? a.name.substring(0, 12) + '…' : a.name}
          </span>
        `).join('')
      : '<span class="spot-pill"><i class="fa-solid fa-triangle-exclamation"></i> 無規劃景點</span>';

    const extraSpotsCount = item.attractions && item.attractions.length > 3
      ? `<span class="spot-pill">+${item.attractions.length - 3}</span>`
      : '';

    const dateLabel = item.date ? `<span class="card-day-date">${item.date}</span>` : '';

    card.innerHTML = `
      <div class="card-day-badge">
        <span class="card-day-lbl">DAY</span>
        <span class="card-day-val">${item.day}</span>
        ${dateLabel}
      </div>
      <div class="card-body">
        <div class="card-title-row">
          <h3>${item.title}</h3>
          <i class="fa-solid fa-chevron-right card-arrow"></i>
        </div>
        <div class="card-spots-preview">
          ${spotsPreview}
          ${extraSpotsCount}
        </div>
        <div class="card-footer-metrics">
          <div class="card-metric">
            <i class="fa-solid fa-clock"></i> <span>${item.estDuration || '未計'}</span>
          </div>
          <div class="card-metric">
            <i class="fa-solid fa-wallet"></i> <span>NZ$ ${item.estCost || 0}</span>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      switchPage('detail', item.day);
    });

    itineraryList.appendChild(card);
  });
}

function renderDetailPage(dayNum) {
  const dayItem = itinerary.find(d => d.day === dayNum);
  if (!dayItem) {
    switchPage('overview');
    return;
  }

  detailDayNum.textContent = dayItem.day;
  detailDayDate.textContent = dayItem.date || '';
  detailDayTitle.textContent = dayItem.title;
  detailStartLoc.textContent = dayItem.startLoc || '未設定';
  detailEndLoc.textContent = dayItem.endLoc || '未設定';
  detailEstTime.textContent = dayItem.estDuration || '未設定';
  detailActTime.textContent = dayItem.actDuration || '未設定';
  detailEstCost.textContent = `NZ$ ${(dayItem.estCost || 0).toLocaleString()}`;
  detailActCost.textContent = `NZ$ ${(dayItem.actCost || 0).toLocaleString()}`;

  // Budget Status indicator
  const diff = (dayItem.actCost || 0) - (dayItem.estCost || 0);
  detailBudgetStatus.className = 'budget-status-indicator';
  if (diff > 0) {
    detailBudgetStatus.classList.add('over');
    detailBudgetStatus.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> 超出預算 NZ$ ${diff.toLocaleString()}`;
  } else if (diff < 0) {
    detailBudgetStatus.classList.add('under');
    detailBudgetStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> 省下預算 NZ$ ${Math.abs(diff).toLocaleString()}`;
  } else {
    detailBudgetStatus.classList.add('under');
    detailBudgetStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> 符合預算範圍`;
  }

  // Render attractions checklist
  detailAttractionsList.innerHTML = '';
  if (dayItem.attractions && dayItem.attractions.length > 0) {
    dayItem.attractions.forEach((attr, idx) => {
      const li = document.createElement('li');
      li.className = `checklist-item ${attr.visited ? 'checked' : ''}`;
      li.innerHTML = `
        <input type="checkbox" id="attr-chk-${idx}" ${attr.visited ? 'checked' : ''}>
        <span>${attr.name}</span>
      `;

      const chk = li.querySelector('input');
      chk.addEventListener('change', () => {
        attr.visited = chk.checked;
        li.classList.toggle('checked', chk.checked);
        saveItinerary();
        renderDashboard();
      });

      li.addEventListener('click', (e) => {
        if (e.target !== chk) {
          chk.checked = !chk.checked;
          attr.visited = chk.checked;
          li.classList.toggle('checked', chk.checked);
          saveItinerary();
          renderDashboard();
        }
      });

      detailAttractionsList.appendChild(li);
    });
  } else {
    detailAttractionsList.innerHTML = `
      <li style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem; text-align: center;">
        今日暫無踩點景點，點擊上方編輯按鈕來新增。
      </li>
    `;
  }

  // Notes
  if (dayItem.notes && dayItem.notes.trim()) {
    detailNotes.textContent = dayItem.notes;
  } else {
    detailNotes.innerHTML = `<span style="color: var(--text-muted);">無自駕備註說明。</span>`;
  }
}

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

// Navigation
document.getElementById('back-to-overview-btn').addEventListener('click', () => {
  switchPage('overview');
});

// Swipe Back (Left to Right) gesture detection on Detail Page
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
  handleSwipeGesture(e);
}, { passive: true });

function handleSwipeGesture(e) {
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;
  
  // 必須是由左向右滑 (正向)，且水平位移大於 60px，垂直位移小於 40px (防上下滑動時誤觸)
  // 同時，為了防範地圖干涉，我們主要偵測「從螢幕左邊邊緣（例如左側 80px 內）開始」的滑動手勢
  const isSwipeRight = diffX > 60 && Math.abs(diffY) < 40;
  const startedNearLeftEdge = touchStartX < 90;
  
  if (isSwipeRight && startedNearLeftEdge && currentDay !== null) {
    switchPage('overview');
  }
}


// 4. DIALOG EDIT/ADD & FORM HANDLING
function openEditDialog(dayNum = null) {
  editForm.reset();

  if (dayNum === null) {
    // ADD NEW DAY
    dialogTitle.textContent = "新增行程天數";
    document.getElementById('form-day-original').value = "";
    const nextDay = itinerary.length > 0 ? (itinerary[itinerary.length - 1].day + 1) : 1;
    document.getElementById('form-day-num').value = nextDay;

    if (itinerary.length > 0) {
      const lastDay = itinerary[itinerary.length - 1];
      document.getElementById('form-start-loc').value = lastDay.endLoc;
      if (lastDay.endCoords) {
        document.getElementById('form-start-lat').value = lastDay.endCoords[0];
        document.getElementById('form-start-lng').value = lastDay.endCoords[1];
      }
    }
  } else {
    // EDIT EXISTING DAY
    const dayItem = itinerary.find(d => d.day === dayNum);
    if (!dayItem) return;

    dialogTitle.textContent = `編輯 Day ${dayItem.day} 行程`;
    document.getElementById('form-day-original').value = dayItem.day;
    document.getElementById('form-day-num').value = dayItem.day;
    document.getElementById('form-date').value = dayItem.date || "";
    document.getElementById('form-title').value = dayItem.title;
    document.getElementById('form-start-loc').value = dayItem.startLoc || "";
    document.getElementById('form-end-loc').value = dayItem.endLoc || "";

    if (dayItem.startCoords) {
      document.getElementById('form-start-lat').value = dayItem.startCoords[0];
      document.getElementById('form-start-lng').value = dayItem.startCoords[1];
    }
    if (dayItem.endCoords) {
      document.getElementById('form-end-lat').value = dayItem.endCoords[0];
      document.getElementById('form-end-lng').value = dayItem.endCoords[1];
    }

    const attractionsText = dayItem.attractions
      ? dayItem.attractions.map(a => a.name).join('\n')
      : "";
    document.getElementById('form-attractions').value = attractionsText;
    document.getElementById('form-est-duration').value = dayItem.estDuration || "";
    document.getElementById('form-act-duration').value = dayItem.actDuration || "";
    document.getElementById('form-est-cost').value = dayItem.estCost || 0;
    document.getElementById('form-act-cost').value = dayItem.actCost || 0;
    document.getElementById('form-notes').value = dayItem.notes || "";
  }

  editDialog.showModal();
}

function closeEditDialog() {
  editDialog.close();
}

[dialogCloseBtn, dialogCancelBtn].forEach(btn => {
  btn.addEventListener('click', closeEditDialog);
});

// Light-dismiss fallback for Safari
if (!('closedBy' in HTMLDialogElement.prototype)) {
  editDialog.addEventListener('click', (event) => {
    if (event.target !== editDialog) return;
    const rect = editDialog.getBoundingClientRect();
    const isDialogContent = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );
    if (!isDialogContent) closeEditDialog();
  });
}

// Header buttons
document.getElementById('add-day-btn').addEventListener('click', () => openEditDialog(null));
document.getElementById('edit-day-btn').addEventListener('click', () => {
  if (currentDay !== null) openEditDialog(currentDay);
});

// Delete Day
document.getElementById('delete-day-btn').addEventListener('click', () => {
  if (currentDay === null) return;
  if (confirm(`您確定要刪除 Day ${currentDay} 的所有行程嗎？`)) {
    const deletedDay = currentDay;
    itinerary = itinerary.filter(d => d.day !== deletedDay);
    saveItinerary();
    switchPage('overview');
  }
});

// Form submission
editForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const originalDayVal = document.getElementById('form-day-original').value;
  const newDayNum = Number(document.getElementById('form-day-num').value);
  const date = document.getElementById('form-date').value;
  const title = document.getElementById('form-title').value;
  const startLoc = document.getElementById('form-start-loc').value;
  const endLoc = document.getElementById('form-end-loc').value;

  let startLat = parseFloat(document.getElementById('form-start-lat').value);
  let startLng = parseFloat(document.getElementById('form-start-lng').value);
  let endLat = parseFloat(document.getElementById('form-end-lat').value);
  let endLng = parseFloat(document.getElementById('form-end-lng').value);

  let startCoords, endCoords;

  if (isNaN(startLat) || isNaN(startLng)) {
    const prevDay = itinerary.find(d => d.day === (newDayNum - 1));
    if (prevDay && prevDay.endCoords) {
      startCoords = [...prevDay.endCoords];
    } else {
      startCoords = [-43.5321, 172.6362];
    }
  } else {
    startCoords = [startLat, startLng];
  }

  if (isNaN(endLat) || isNaN(endLng)) {
    endCoords = [startCoords[0] - 0.4, startCoords[1] - 0.4];
  } else {
    endCoords = [endLat, endLng];
  }

  // Parse Attractions per-line
  const attractionsRaw = document.getElementById('form-attractions').value.split('\n');
  const attractions = attractionsRaw
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(name => {
      let visited = false;
      if (originalDayVal) {
        const originalDay = itinerary.find(d => d.day === Number(originalDayVal));
        if (originalDay && originalDay.attractions) {
          const matchedAttr = originalDay.attractions.find(a => a.name === name);
          if (matchedAttr) visited = matchedAttr.visited;
        }
      }
      return { name, visited };
    });

  const estDuration = document.getElementById('form-est-duration').value;
  const actDuration = document.getElementById('form-act-duration').value;
  const estCost = Number(document.getElementById('form-est-cost').value) || 0;
  const actCost = Number(document.getElementById('form-act-cost').value) || 0;
  const notes = document.getElementById('form-notes').value;

  // Preserve original routeCoords if editing and coords haven't changed
  let routeCoords = [startCoords, endCoords];
  if (originalDayVal) {
    const origItem = itinerary.find(d => d.day === Number(originalDayVal));
    if (origItem && origItem.routeCoords &&
        origItem.startCoords[0] === startCoords[0] &&
        origItem.startCoords[1] === startCoords[1] &&
        origItem.endCoords[0] === endCoords[0] &&
        origItem.endCoords[1] === endCoords[1]) {
      routeCoords = origItem.routeCoords;
    }
  }

  const newDayData = {
    day: newDayNum,
    date,
    title,
    startLoc,
    endLoc,
    startCoords,
    endCoords,
    routeCoords,
    attractions,
    estDuration,
    actDuration,
    estCost,
    actCost,
    notes
  };

  if (originalDayVal === "") {
    if (itinerary.some(d => d.day === newDayNum)) {
      alert(`天數 Day ${newDayNum} 已存在！請選擇其他天數。`);
      return;
    }
    itinerary.push(newDayData);
  } else {
    const origDay = Number(originalDayVal);
    if (origDay !== newDayNum && itinerary.some(d => d.day === newDayNum)) {
      alert(`無法變更天數：Day ${newDayNum} 已存在！`);
      return;
    }
    itinerary = itinerary.filter(d => d.day !== origDay);
    itinerary.push(newDayData);
  }

  sortItinerary();
  saveItinerary();
  closeEditDialog();

  if (currentDay !== null) {
    currentDay = newDayNum;
    switchPage('detail', currentDay);
  } else {
    switchPage('overview');
  }
});

// 5. IMPORT, EXPORT, AND RESET HANDLERS

document.getElementById('reset-btn').addEventListener('click', () => {
  if (confirm("您確定要恢復成預設的 16 天行程表嗎？這將會覆蓋您目前所有的修改。")) {
    localStorage.removeItem('nz_roadtrip_itinerary');
    loadItinerary();
    switchPage('overview');
  }
});

document.getElementById('export-btn').addEventListener('click', () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(itinerary, null, 2));
  const a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", "nz-roadtrip-itinerary.json");
  document.body.appendChild(a);
  a.click();
  a.remove();
});

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
        alert("格式錯誤：匯入的 JSON 檔案內容結構不符合行程格式。");
      }
    } catch (error) {
      alert("讀取檔案失敗，請確保是正確的 JSON 格式。");
      console.error(error);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// 6. STARTUP
window.addEventListener('DOMContentLoaded', () => {
  loadItinerary();
  initMap();
  switchPage('overview');

  // Bind Brand Header Click to Overview page
  const brandHeader = document.querySelector('.brand');
  if (brandHeader) {
    brandHeader.addEventListener('click', () => {
      switchPage('overview');
    });
  }
});
