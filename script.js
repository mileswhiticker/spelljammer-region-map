const GRID_SIZE = 30;
const HEX_DIAMETER_KM = 13000;
const HEX_RADIUS = 22;
const HEX_WIDTH = Math.sqrt(3) * HEX_RADIUS;
const HEX_HEIGHT = 2 * HEX_RADIUS;
const OFFSET_X = 90;
const OFFSET_Y = 60;
const SVG_NS = 'http://www.w3.org/2000/svg';

const svg = document.getElementById('hex-map');
const exportButton = document.getElementById('export-pdf');
const rulerToggle = document.getElementById('ruler-toggle');
const moveToggle = document.getElementById('move-toggle');
const engageToggle = document.getElementById('engage-toggle');
const rulerStatus = document.getElementById('ruler-status');
const rulerMessage = document.getElementById('ruler-message');
const currentLocation = document.getElementById('current-location');
const moveCounter = document.getElementById('move-counter');
const diceResult = document.getElementById('dice-result');
const encounterAlert = document.getElementById('encounter-alert');
const encounterClose = document.getElementById('encounter-close');
const hexLookup = new Map();
const poiByHex = new Map();
const shipPosition = { row: 0, col: 0 };
const defaultEncounterState = { randomEncounterEnabled: '1' };
let encounterState = { ...defaultEncounterState };
let shipGroup;
let isDraggingShip = false;
let rulerGroup;
let rulerStart;
let rulerDestination;
let rulerEnabled = false;
let moveEnabled = false;
let isEngaging = false;

function syncEngageButton() {
  if (engageToggle) {
    engageToggle.disabled = isEngaging || !(moveEnabled && rulerDestination);
  }
}

function setRulerStatus(message) {
  if (rulerMessage) {
    rulerMessage.textContent = message;
    return;
  }

  rulerStatus.textContent = message;
}

function setMoveCounter(traversed, total) {
  if (moveCounter) {
    moveCounter.textContent = `Traversed: ${traversed} / ${total} hex${total === 1 ? '' : 'es'}`;
  }
}

function clearMoveCounter() {
  if (moveCounter) {
    moveCounter.textContent = '';
  }
}

function updateCurrentLocation() {
  if (!currentLocation) {
    return;
  }

  const poi = poiByHex.get(`${shipPosition.row},${shipPosition.col}`);
  currentLocation.textContent = poi ? `Current location: ${poi.title}` : '';
}

function hexToPixel(row, col) {
  const x = HEX_WIDTH * (col + row / 2) + OFFSET_X;
  const y = HEX_HEIGHT * 0.75 * row + OFFSET_Y;
  return { x, y };
}

function createHexPolygon(cx, cy) {
  const points = [];

  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const px = cx + HEX_RADIUS * Math.cos(angle);
    const py = cy + HEX_RADIUS * Math.sin(angle);
    points.push(`${px},${py}`);
  }

  return points.join(' ');
}

function makeSvgElement(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function calculateMapBounds() {
  const lastCell = hexToPixel(GRID_SIZE - 1, GRID_SIZE - 1);
  const width = lastCell.x + HEX_RADIUS + 120;
  const height = lastCell.y + HEX_RADIUS + 120;

  return { width, height };
}

function drawGrid() {
  const bounds = calculateMapBounds();
  svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const { x, y } = hexToPixel(row, col);
      const hex = makeSvgElement('polygon', {
        points: createHexPolygon(x, y),
        class: 'hex',
        'data-row': row,
        'data-col': col,
      });

      hexLookup.set(`${row},${col}`, hex);
      hex.addEventListener('click', () => handleHexClick(row, col));
      svg.appendChild(hex);
    }
  }
}

function drawPoi(poi) {
  const { x, y } = hexToPixel(poi.row, poi.col);
  poiByHex.set(`${poi.row},${poi.col}`, poi);
  const targetHex = hexLookup.get(`${poi.row},${poi.col}`);

  if (targetHex) {
    targetHex.classList.add('poi');

    if (poi.type === 'friendly-base') {
      targetHex.classList.add('poi-friendly-base');
    }
  }

  const poiGroup = makeSvgElement('g', {
    transform: `translate(${x} ${y})`,
    class: 'poi-group',
  });

  const badge = makeSvgElement('circle', {
    class: 'poi-badge',
    cx: 0,
    cy: 0,
    r: 14,
  });

  const icon = makeSvgElement('text', {
    class: 'poi-icon',
    x: 0,
    y: 0,
  });
  icon.textContent = poi.icon;

  const title = makeSvgElement('text', {
    class: 'poi-title',
    x: 0,
    y: 30,
  });
  title.textContent = poi.title;

  poiGroup.appendChild(badge);
  poiGroup.appendChild(icon);
  poiGroup.appendChild(title);
  svg.appendChild(poiGroup);
}

function drawShip() {
  const { x, y } = hexToPixel(shipPosition.row, shipPosition.col);
  shipGroup = makeSvgElement('g', {
    class: 'ship-marker',
    transform: `translate(${x} ${y})`,
    tabindex: '0',
    role: 'img',
    'aria-label': 'Player ship',
  });

  const halo = makeSvgElement('circle', {
    class: 'ship-halo',
    cx: 0,
    cy: 0,
    r: 15,
  });
  const hull = makeSvgElement('path', {
    class: 'ship-hull',
    d: 'M -14 3 Q -8 10 7 8 L 14 2 L 8 -5 L -9 -5 Z',
  });
  const stern = makeSvgElement('path', {
    class: 'ship-stern',
    d: 'M -9 -5 L -7 -11 L 1 -10 L 2 -5 Z',
  });
  const deck = makeSvgElement('path', {
    class: 'ship-deck',
    d: 'M -10 -4 L 8 -4 L 11 -1 L -12 -1 Z',
  });
  const cabin = makeSvgElement('path', {
    class: 'ship-cabin',
    d: 'M -8 -5 L -5 -9 L 1 -9 L 4 -5 Z',
  });
  const rearSail = makeSvgElement('path', {
    class: 'ship-sail ship-sail-rear',
    d: 'M -5 -11 L -5 0 L -12 -1 Z',
  });
  const frontSail = makeSvgElement('path', {
    class: 'ship-sail ship-sail-front',
    d: 'M 4 -15 L 4 0 L 13 -1 Z',
  });
  const rigging = makeSvgElement('path', {
    class: 'ship-rigging',
    d: 'M -5 -13 L 4 -16 L 13 -1 M 4 -16 L 4 4',
  });

  shipGroup.append(halo, hull, stern, deck, cabin, rearSail, frontSail, rigging);
  svg.appendChild(shipGroup);
  shipGroup.addEventListener('pointerdown', startShipDrag);
}

function axialHexDistance(start, destination) {
  const columnDistance = Math.abs(start.col - destination.col);
  const rowDistance = Math.abs(start.row - destination.row);
  const diagonalDistance = Math.abs(
    (start.col + start.row) - (destination.col + destination.row),
  );

  return Math.max(columnDistance, rowDistance, diagonalDistance);
}

function clearRuler() {
  rulerStart = undefined;
  rulerDestination = undefined;
  rulerGroup?.remove();
  rulerGroup = undefined;
  syncEngageButton();
  clearMoveCounter();
  setRulerStatus(rulerEnabled
    ? moveEnabled
      ? 'Move on: choose a destination hex'
      : 'Ruler on: click a hex to set the start'
    : 'Ruler off: toggle it on to measure distance');
}

function showDistance(distance) {
  const distanceKm = distance * HEX_DIAMETER_KM;
  setRulerStatus(`${moveEnabled ? 'Move distance' : 'Distance'}: ${distanceKm.toLocaleString()} km (${distance} hex${distance === 1 ? '' : 'es'})`);
}

function drawRuler() {
  rulerGroup?.remove();
  rulerGroup = makeSvgElement('g', {
    class: `ruler-overlay${moveEnabled ? ' move-ruler' : ''}`,
  });

  const startPoint = hexToPixel(rulerStart.row, rulerStart.col);
  const startMarker = makeSvgElement('circle', {
    class: 'ruler-start',
    cx: startPoint.x,
    cy: startPoint.y,
    r: 9,
  });
  rulerGroup.appendChild(startMarker);

  if (rulerDestination) {
    const destinationPoint = hexToPixel(rulerDestination.row, rulerDestination.col);
    const line = makeSvgElement('line', {
      class: 'ruler-line',
      x1: startPoint.x,
      y1: startPoint.y,
      x2: destinationPoint.x,
      y2: destinationPoint.y,
    });
    const destinationMarker = makeSvgElement('circle', {
      class: 'ruler-destination',
      cx: destinationPoint.x,
      cy: destinationPoint.y,
      r: 8,
    });
    rulerGroup.prepend(line);
    rulerGroup.appendChild(destinationMarker);
  }

  svg.insertBefore(rulerGroup, shipGroup || null);
  syncEngageButton();
}

function cubeRound(q, r, s) {
  let roundedQ = Math.round(q);
  let roundedR = Math.round(r);
  let roundedS = Math.round(s);
  const qDifference = Math.abs(roundedQ - q);
  const rDifference = Math.abs(roundedR - r);
  const sDifference = Math.abs(roundedS - s);

  if (qDifference > rDifference && qDifference > sDifference) {
    roundedQ = -roundedR - roundedS;
  } else if (rDifference > sDifference) {
    roundedR = -roundedQ - roundedS;
  } else {
    roundedS = -roundedQ - roundedR;
  }

  return { col: roundedQ, row: roundedR };
}

function createHexPath(start, destination) {
  const distance = axialHexDistance(start, destination);
  const path = [];

  for (let step = 1; step <= distance; step += 1) {
    const progress = step / distance;
    const q = start.col + (destination.col - start.col) * progress;
    const r = start.row + (destination.row - start.row) * progress;
    const rounded = cubeRound(q, r, -q - r);
    path.push(rounded);
  }

  return path;
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function showDiceRoll(roll) {
  if (!diceResult) {
    return;
  }

  diceResult.textContent = `d20: ${roll}`;
  diceResult.classList.remove('rolling');
  void diceResult.offsetWidth;
  diceResult.classList.add('rolling');
  await delay(450);
}

function showEncounterAlert() {
  if (!encounterAlert) {
    return;
  }

  encounterAlert.classList.remove('visible');
  void encounterAlert.offsetWidth;
  encounterAlert.classList.add('visible');
}

function clearDiceResult() {
  if (!diceResult) {
    return;
  }

  diceResult.classList.remove('rolling');
  diceResult.textContent = '';
}

function canTriggerRandomEncounter() {
  return String(encounterState.randomEncounterEnabled) === '1';
}

async function loadEncounterState() {
  try {
    const response = await fetch('/api/encounter-state', { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    const jsonState = await response.json();
    if (jsonState && Object.prototype.hasOwnProperty.call(jsonState, 'randomEncounterEnabled')) {
      encounterState = { ...defaultEncounterState, ...jsonState };
    }
  } catch (error) {
    console.warn('Unable to load encounter state from server:', error);
  }
}

async function saveEncounterState(value) {
  encounterState = { ...defaultEncounterState, randomEncounterEnabled: String(value) };

  try {
    const response = await fetch('/api/encounter-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encounterState),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const jsonState = await response.json();
    if (jsonState && Object.prototype.hasOwnProperty.call(jsonState, 'randomEncounterEnabled')) {
      encounterState = { ...defaultEncounterState, ...jsonState };
    }
  } catch (error) {
    console.warn('Unable to persist encounter state via server:', error);
  }
}

async function engageMove() {
  if (isEngaging || !moveEnabled || !rulerDestination) {
    return;
  }

  isEngaging = true;
  syncEngageButton();
  encounterAlert?.classList.remove('visible');

  const destination = { ...rulerDestination };
  const path = createHexPath(shipPosition, destination);
  setMoveCounter(0, path.length);

  for (let stepIndex = 0; stepIndex < path.length; stepIndex += 1) {
    const nextHex = path[stepIndex];
    const roll = Math.floor(Math.random() * 20) + 1;
    await showDiceRoll(roll);
    moveShipToHex({ ...nextHex, ...hexToPixel(nextHex.row, nextHex.col) });
    setMoveCounter(stepIndex + 1, path.length);
    await delay(350);

    if (canTriggerRandomEncounter() && roll <= 2) {
      await saveEncounterState(0);
      rulerStart = { ...shipPosition };
      rulerDestination = undefined;
      drawRuler();
      clearDiceResult();
      showEncounterAlert();
      setRulerStatus('Random encounter!');
      break;
    }
  }

  if (rulerDestination?.row === destination.row && rulerDestination?.col === destination.col) {
    rulerStart = { ...shipPosition };
    rulerDestination = undefined;
    drawRuler();
    clearDiceResult();
    clearMoveCounter();
    setRulerStatus('Move complete');
  }

  isEngaging = false;
  syncEngageButton();
}

function handleHexClick(row, col) {
  if (!rulerEnabled) {
    return;
  }

  const clickedHex = { row, col };

  if (moveEnabled) {
    rulerStart = { ...shipPosition };

    if (rulerDestination?.row === row && rulerDestination?.col === col) {
      rulerDestination = undefined;
      setRulerStatus('Move on: choose a destination hex');
      drawRuler();
      return;
    }

    rulerDestination = clickedHex;
    showDistance(axialHexDistance(rulerStart, rulerDestination));
    drawRuler();
    return;
  }

  if (!rulerStart) {
    rulerStart = clickedHex;
    setRulerStatus('Ruler start set. Choose a destination.');
    drawRuler();
    return;
  }

  if (rulerStart.row === row && rulerStart.col === col) {
    clearRuler();
    return;
  }

  if (rulerDestination?.row === row && rulerDestination?.col === col) {
    rulerDestination = undefined;
    setRulerStatus('Ruler start set. Choose a destination.');
    drawRuler();
    return;
  }

  rulerDestination = clickedHex;
  showDistance(axialHexDistance(rulerStart, rulerDestination));
  drawRuler();
}

function pointerToSvgPoint(event) {
  const point = new DOMPoint(event.clientX, event.clientY);
  const inverse = svg.getScreenCTM().inverse();
  return point.matrixTransform(inverse);
}

function nearestHex(point) {
  let closest = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const center = hexToPixel(row, col);
      const distance = ((point.x - center.x) ** 2) + ((point.y - center.y) ** 2);

      if (distance < closestDistance) {
        closest = { row, col, ...center };
        closestDistance = distance;
      }
    }
  }

  return closest;
}

function moveShipToHex(hex) {
  shipPosition.row = hex.row;
  shipPosition.col = hex.col;
  shipGroup.setAttribute('transform', `translate(${hex.x} ${hex.y})`);
  updateCurrentLocation();

  if (moveEnabled) {
    rulerStart = { ...shipPosition };
    if (rulerDestination) {
      showDistance(axialHexDistance(rulerStart, rulerDestination));
    }
    drawRuler();
  }
}

function dragShip(event) {
  if (!isDraggingShip) {
    return;
  }

  const hex = nearestHex(pointerToSvgPoint(event));
  moveShipToHex(hex);
}

function stopShipDrag(event) {
  if (!isDraggingShip) {
    return;
  }

  isDraggingShip = false;
  shipGroup.releasePointerCapture(event.pointerId);
  shipGroup.classList.remove('dragging');
  shipGroup.removeEventListener('pointermove', dragShip);
  shipGroup.removeEventListener('pointerup', stopShipDrag);
  shipGroup.removeEventListener('pointercancel', stopShipDrag);
}

function startShipDrag(event) {
  if (isEngaging) {
    return;
  }

  event.preventDefault();
  isDraggingShip = true;
  shipGroup.classList.add('dragging');
  shipGroup.setPointerCapture(event.pointerId);
  shipGroup.addEventListener('pointermove', dragShip);
  shipGroup.addEventListener('pointerup', stopShipDrag);
  shipGroup.addEventListener('pointercancel', stopShipDrag);
}

async function renderMap() {
  drawGrid();

  await loadEncounterState();

  const poisResponse = await fetch('data/pois.json', { cache: 'no-store' });
  const pois = await poisResponse.json();

  pois.forEach(drawPoi);
  drawShip();
  updateCurrentLocation();
}

if (exportButton) {
  exportButton.addEventListener('click', () => {
    window.print();
  });
}

if (rulerToggle) {
  rulerToggle.addEventListener('click', () => {
    const shouldEnableRuler = moveEnabled || !rulerEnabled;
    rulerEnabled = shouldEnableRuler;
    moveEnabled = false;
    moveToggle?.setAttribute('aria-pressed', 'false');
    rulerToggle.setAttribute('aria-pressed', String(rulerEnabled));

    if (!rulerEnabled) {
      clearRuler();
      return;
    }

    clearRuler();
    setRulerStatus('Ruler on: click a hex to set the start');
  });
}

if (moveToggle) {
  moveToggle.addEventListener('click', () => {
    moveEnabled = !moveEnabled;
    rulerEnabled = moveEnabled;
    rulerToggle?.setAttribute('aria-pressed', 'false');
    moveToggle.setAttribute('aria-pressed', String(moveEnabled));

    if (!moveEnabled) {
      clearRuler();
      return;
    }

    rulerStart = { ...shipPosition };
    rulerDestination = undefined;
    setRulerStatus('Move on: choose a destination hex');
    drawRuler();
  });
}

if (engageToggle) {
  engageToggle.addEventListener('click', engageMove);
}

if (encounterClose) {
  encounterClose.addEventListener('click', () => {
    encounterAlert?.classList.remove('visible');
  });
}

renderMap().catch((error) => {
  console.error('Failed to render map:', error);
});
