;(async () => {
  const warningNode = document.getElementById("warning");
  const statusNode = document.getElementById("status");
  const host = document.getElementById("pixi-host");
  const fileInput = document.getElementById("file-input");
  const loadFileButton = document.getElementById("load-file-button");
  const fitButton = document.getElementById("fit-button");
  const showAllButton = document.getElementById("show-all-button");
  const hideAllButton = document.getElementById("hide-all-button");
  const measureButton = document.getElementById("measure-button");
  const gridButton = document.getElementById("grid-button");
  const cellToggleHost = document.getElementById("cell-toggles");
  const layerToggleHost = document.getElementById("layer-toggles");
  const measurementListNode = document.getElementById("measurement-list");
  const scaleBarNode = document.getElementById("scale-bar");
  const scaleBarLabelNode = document.getElementById("scale-bar-label");
  const scaleBarLineNode = document.getElementById("scale-bar-line");
  const pointerStatusNode = document.getElementById("pointer-status");
  const measureReadoutNode = document.getElementById("measure-readout");
  const stageNode = document.querySelector(".stage");

  let app = null;
  let world = null;
  let gridGraphics = null;
  let cursorGraphics = null;
  let measureGraphics = null;
  let dragState = null;
  let resizeObserver = null;
  let viewModel = null;
  let groupMap = new Map();
  let cellTreeNodes = new Map();
  let templateMap = new Map();
  let templateContextMap = new Map();
  let cellState = {};
  let layerState = {};
  let loadedLayerKeys = new Set();
  let drawCenterX = 0;
  let drawCenterY = 0;
  let spanX = 1;
  let spanY = 1;
  let cellRenderToken = 0;
  let cellHandlersBound = false;
  let sceneRenderToken = 0;
  let measureMode = false;
  let gridVisible = false;
  let measureStart = null;
  let measureEnd = null;
  let measurePointer = null;
  let lastPointerActual = null;
  let lastPointerScreen = null;
  let measurements = [];
  let selectedMeasurementId = null;
  let nextMeasurementId = 1;
  const keyboardZoomStep = 1.2;
  let keyboardZoomDirection = 0;
  let keyboardZoomFrame = null;
  let dragDropDepth = 0;

  function setMeasureMode(nextMode) {
    measureMode = nextMode;
    measureButton.classList.toggle("is-active", measureMode);
    if (!measureMode) {
      measureStart = null;
      measureEnd = null;
      measurePointer = null;
      lastPointerActual = null;
    }
    updateOverlays();
  }

  function formatDistance(valueUm) {
    if (valueUm < 1) {
      return `${(valueUm * 1000).toFixed(valueUm < 0.1 ? 1 : 0)} nm`;
    }
    return `${valueUm.toFixed(valueUm < 10 ? 2 : valueUm < 100 ? 1 : 0)} um`;
  }

  function toActualPoint(screenX, screenY) {
    return {
      x: (screenX - world.position.x) / world.scale.x,
      y: -((screenY - world.position.y) / world.scale.y),
    };
  }

  function toScreenPoint(actualX, actualY) {
    return {
      x: world.position.x + actualX * world.scale.x,
      y: world.position.y - actualY * world.scale.y,
    };
  }

  function lockMeasuredPoint(startPoint, nextPoint, ctrlKey) {
    if (!ctrlKey || !startPoint) {
      return nextPoint;
    }
    const dx = nextPoint.x - startPoint.x;
    const dy = nextPoint.y - startPoint.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: nextPoint.x, y: startPoint.y };
    }
    return { x: startPoint.x, y: nextPoint.y };
  }

  function activeMeasureEnd() {
    return measureEnd || measurePointer;
  }

  function buildMeasurement(id, startPoint, endPoint) {
    return {
      id,
      start: { x: startPoint.x, y: startPoint.y },
      end: { x: endPoint.x, y: endPoint.y },
    };
  }

  function measurementMetrics(measurement) {
    const dx = measurement.end.x - measurement.start.x;
    const dy = measurement.end.y - measurement.start.y;
    return {
      dx,
      dy,
      distance: Math.hypot(dx, dy),
    };
  }

  function distanceSquared(pointA, pointB) {
    const dx = pointA.x - pointB.x;
    const dy = pointA.y - pointB.y;
    return dx * dx + dy * dy;
  }

  function nearestPointOnSegment(point, segmentStart, segmentEnd) {
    const dx = segmentEnd.x - segmentStart.x;
    const dy = segmentEnd.y - segmentStart.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
      return segmentStart;
    }
    const t = Math.max(
      0,
      Math.min(1, ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / lengthSquared),
    );
    return {
      x: segmentStart.x + dx * t,
      y: segmentStart.y + dy * t,
    };
  }

  function forEachVisiblePolygonPoint(callback) {
    for (const group of viewModel.groups || []) {
      if (!isCellVisible(group.cellName) || !layerState[group.layerKey]) {
        continue;
      }
      const template = templateMap.get(group.templateId);
      if (!template) {
        continue;
      }
      const [a, b, c, d] = group.transform;
      const [ox, oy] = group.offset;
      for (const item of template.polygons || []) {
        const coords = item.polygon;
        if (!coords || coords.length < 6) {
          continue;
        }
        let firstPoint = null;
        let previousPoint = null;
        for (let index = 0; index < coords.length; index += 2) {
          const point = {
            x: a * coords[index] + b * coords[index + 1] + ox,
            y: c * coords[index] + d * coords[index + 1] + oy,
          };
          callback(point, previousPoint);
          if (!firstPoint) {
            firstPoint = point;
          }
          previousPoint = point;
        }
        if (firstPoint && previousPoint) {
          callback(firstPoint, previousPoint);
        }
      }
    }
  }

  function snapMeasurePoint(point) {
    if (!viewModel || !world) {
      return point;
    }

    const maxScreenDistance = 12;
    const thresholdUm = maxScreenDistance / Math.max(Math.abs(world.scale.x), 1e-9);
    const thresholdSquared = thresholdUm * thresholdUm;
    let bestPoint = point;
    let bestDistanceSquared = thresholdSquared;

    forEachVisiblePolygonPoint((candidatePoint, segmentStart) => {
      const vertexDistanceSquared = distanceSquared(point, candidatePoint);
      if (vertexDistanceSquared < bestDistanceSquared) {
        bestDistanceSquared = vertexDistanceSquared;
        bestPoint = candidatePoint;
      }
      if (segmentStart) {
        const edgePoint = nearestPointOnSegment(point, segmentStart, candidatePoint);
        const edgeDistanceSquared = distanceSquared(point, edgePoint);
        if (edgeDistanceSquared < bestDistanceSquared) {
          bestDistanceSquared = edgeDistanceSquared;
          bestPoint = edgePoint;
        }
      }
    });

    return bestPoint;
  }

  function showWarning(message) {
    warningNode.style.display = "block";
    warningNode.textContent = message;
  }

  function clearWarning() {
    warningNode.style.display = "none";
    warningNode.textContent = "";
  }

  function hexToNumber(hex) {
    return parseInt(hex.replace("#", ""), 16);
  }

  function clearChildren(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function isCellVisible(cellName) {
    return Boolean(cellState[cellName]);
  }

  function updateStatus() {
    let visibleCells = 0;
    let visibleLayers = 0;
    let visiblePolygons = 0;

    for (const cell of viewModel.cells) {
      if (isCellVisible(cell.name)) {
        visibleCells += 1;
      }
    }
    for (const layer of viewModel.layers) {
      if (layerState[layer.key]) {
        visibleLayers += 1;
      }
    }
    for (const group of viewModel.groups || []) {
      if (isCellVisible(group.cellName) && layerState[group.layerKey]) {
        visiblePolygons += group.count;
      }
    }

    statusNode.textContent =
      `Visible cells: ${visibleCells} / ${viewModel.cells.length} | ` +
      `Visible layers: ${visibleLayers} / ${viewModel.layers.length} | ` +
      `Visible polygons: ${visiblePolygons}`;
  }

  function applyVisibility() {
    for (const group of viewModel.groups || []) {
      const graphics = groupMap.get(group.id);
      if (!graphics) {
        continue;
      }
      graphics.visible = Boolean(isCellVisible(group.cellName) && layerState[group.layerKey]);
    }
    updateStatus();
  }

  function setStatusMessage(message) {
    statusNode.textContent = message;
  }

  function updateScaleBar() {
    if (!world) {
      return;
    }
    const pixelsPerUm = Math.abs(world.scale.x);
    if (!Number.isFinite(pixelsPerUm) || pixelsPerUm <= 0) {
      scaleBarNode.style.display = "none";
      return;
    }

    const targetPixels = 120;
    const targetUm = targetPixels / pixelsPerUm;
    const exponent = Math.floor(Math.log10(Math.max(targetUm, 1e-9)));
    const base = 10 ** exponent;
    const candidates = [1, 2, 5, 10];
    let chosenUm = base;
    for (const candidate of candidates) {
      if (candidate * base >= targetUm) {
        chosenUm = candidate * base;
        break;
      }
    }

    scaleBarLabelNode.textContent = formatDistance(chosenUm);
    scaleBarLineNode.style.width = `${Math.max(24, Math.round(chosenUm * pixelsPerUm))}px`;
    scaleBarNode.style.display = "grid";
  }

  function updateMeasureOverlay() {
    if (!measureGraphics) {
      return;
    }
    measureGraphics.clear();

    function drawMeasurement(measurement, color) {
      const startScreen = toScreenPoint(measurement.start.x, measurement.start.y);
      const endScreen = toScreenPoint(measurement.end.x, measurement.end.y);
      const { dx, dy, distance } = measurementMetrics(measurement);
      const labelColor = color;
      const isSelected = measurement.id === selectedMeasurementId;
      const strokeWidth = isSelected ? 3 : 2;
      const tickWidth = isSelected ? 3 : 2;
      const alpha = isSelected ? 1 : 0.88;
    const lengthScreen = Math.hypot(endScreen.x - startScreen.x, endScreen.y - startScreen.y) || 1;
    const ux = (endScreen.x - startScreen.x) / lengthScreen;
    const uy = (endScreen.y - startScreen.y) / lengthScreen;
    const px = -uy;
    const py = ux;
    const tickSize = 7;
    const arrowLength = Math.min(16, Math.max(10, lengthScreen * 0.18));
    const arrowWidth = 5;

    measureGraphics.moveTo(startScreen.x, startScreen.y);
    measureGraphics.lineTo(endScreen.x, endScreen.y);
      measureGraphics.stroke({ color, alpha, width: strokeWidth });

    measureGraphics.moveTo(startScreen.x - px * tickSize, startScreen.y - py * tickSize);
    measureGraphics.lineTo(startScreen.x + px * tickSize, startScreen.y + py * tickSize);
    measureGraphics.moveTo(endScreen.x - px * tickSize, endScreen.y - py * tickSize);
    measureGraphics.lineTo(endScreen.x + px * tickSize, endScreen.y + py * tickSize);
      measureGraphics.stroke({ color, alpha, width: tickWidth });

    measureGraphics
      .poly(
        [
          startScreen.x,
          startScreen.y,
          startScreen.x + ux * arrowLength + px * arrowWidth,
          startScreen.y + uy * arrowLength + py * arrowWidth,
          startScreen.x + ux * arrowLength - px * arrowWidth,
          startScreen.y + uy * arrowLength - py * arrowWidth,
        ],
        true,
      )
        .fill({ color, alpha });
    measureGraphics
      .poly(
        [
          endScreen.x,
          endScreen.y,
          endScreen.x - ux * arrowLength + px * arrowWidth,
          endScreen.y - uy * arrowLength + py * arrowWidth,
          endScreen.x - ux * arrowLength - px * arrowWidth,
          endScreen.y - uy * arrowLength - py * arrowWidth,
        ],
        true,
      )
        .fill({ color, alpha });

      return {
        labelText:
          `${formatDistance(distance)} | dx ${formatDistance(Math.abs(dx))} | dy ${formatDistance(Math.abs(dy))}`,
        labelX: (startScreen.x + endScreen.x) / 2 + px * 14,
        labelY: (startScreen.y + endScreen.y) / 2 + py * 14,
        labelColor,
      };
    }

    let label = null;
    for (const measurement of measurements) {
      const color = measurement.id === selectedMeasurementId ? 0x0e4ca1 : 0x204d8d;
      const nextLabel = drawMeasurement(measurement, color);
      if (measurement.id === selectedMeasurementId || (!label && !measureMode)) {
        label = nextLabel;
      }
    }

    const endPoint = activeMeasureEnd();
    if (measureMode && measureStart && endPoint) {
      label = drawMeasurement(
        { id: "draft", start: measureStart, end: endPoint },
        0x204d8d,
      );
    }

    if (!label) {
      measureReadoutNode.style.display = "none";
      return;
    }

    measureReadoutNode.textContent = label.labelText;
    measureReadoutNode.style.left = `${Math.round(label.labelX)}px`;
    measureReadoutNode.style.top = `${Math.round(label.labelY)}px`;
    measureReadoutNode.style.borderColor = label.labelColor === 0x0e4ca1 ? "#6f98dd" : "";
    measureReadoutNode.style.display = "block";
  }

  function renderMeasurementList() {
    clearChildren(measurementListNode);
    if (measurements.length === 0) {
      const empty = document.createElement("div");
      empty.className = "measurement-detail";
      empty.textContent = "No measurements yet.";
      measurementListNode.appendChild(empty);
      return;
    }

    for (const measurement of measurements) {
      const { dx, dy, distance } = measurementMetrics(measurement);
      const item = document.createElement("div");
      item.className = "measurement-item";
      if (measurement.id === selectedMeasurementId) {
        item.classList.add("is-selected");
      }

      const main = document.createElement("div");
      main.className = "measurement-main";
      main.addEventListener("click", () => {
        selectedMeasurementId = measurement.id;
        renderMeasurementList();
        updateMeasureOverlay();
      });

      const title = document.createElement("div");
      title.className = "measurement-title";
      title.textContent = formatDistance(distance);
      main.appendChild(title);

      const detail = document.createElement("div");
      detail.className = "measurement-detail";
      detail.textContent = `dx ${formatDistance(Math.abs(dx))} | dy ${formatDistance(Math.abs(dy))}`;
      main.appendChild(detail);
      item.appendChild(main);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "measurement-delete";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        selectedMeasurementId = measurement.id;
        deleteSelectedMeasurement();
      });
      item.appendChild(deleteButton);
      measurementListNode.appendChild(item);
    }
  }

  function deleteSelectedMeasurement() {
    if (selectedMeasurementId == null) {
      return;
    }
    measurements = measurements.filter((entry) => entry.id !== selectedMeasurementId);
    selectedMeasurementId = measurements.length > 0 ? measurements[measurements.length - 1].id : null;
    renderMeasurementList();
    updateMeasureOverlay();
  }

  function updatePointerStatus() {
    if (!measureMode || !lastPointerActual) {
      pointerStatusNode.style.display = "none";
      return;
    }
    pointerStatusNode.textContent =
      `x ${formatDistance(lastPointerActual.x)} | y ${formatDistance(lastPointerActual.y)}`;
    pointerStatusNode.style.display = "block";
  }

  function updateCursorOverlay() {
    if (!cursorGraphics) {
      return;
    }
    cursorGraphics.clear();
    if (!measureMode || !measurePointer) {
      return;
    }
    const screenPoint = toScreenPoint(measurePointer.x, measurePointer.y);
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    const size = 10;
    cursorGraphics.moveTo(screenPoint.x - size, screenPoint.y);
    cursorGraphics.lineTo(screenPoint.x + size, screenPoint.y);
    cursorGraphics.moveTo(screenPoint.x, screenPoint.y - size);
    cursorGraphics.lineTo(screenPoint.x, screenPoint.y + size);
    cursorGraphics.stroke({ color: 0x204d8d, alpha: 0.75, width: 1.5 });
    cursorGraphics.moveTo(0, screenPoint.y);
    cursorGraphics.lineTo(width, screenPoint.y);
    cursorGraphics.moveTo(screenPoint.x, 0);
    cursorGraphics.lineTo(screenPoint.x, height);
    cursorGraphics.stroke({ color: 0x204d8d, alpha: 0.18, width: 1 });
  }

  function updateGridOverlay() {
    if (!gridGraphics) {
      return;
    }
    gridGraphics.clear();
    if (!gridVisible || !world) {
      return;
    }

    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    const pixelsPerUm = Math.abs(world.scale.x);
    if (!Number.isFinite(pixelsPerUm) || pixelsPerUm <= 0) {
      return;
    }

    const minWorld = toActualPoint(0, height);
    const maxWorld = toActualPoint(width, 0);
    const targetPixels = 72;
    const targetUm = targetPixels / pixelsPerUm;
    const exponent = Math.floor(Math.log10(Math.max(targetUm, 1e-9)));
    const base = 10 ** exponent;
    const candidates = [1, 2, 5, 10];
    let spacing = base;
    for (const candidate of candidates) {
      if (candidate * base >= targetUm) {
        spacing = candidate * base;
        break;
      }
    }

    const startX = Math.floor(minWorld.x / spacing) * spacing;
    const endX = Math.ceil(maxWorld.x / spacing) * spacing;
    const startY = Math.floor(minWorld.y / spacing) * spacing;
    const endY = Math.ceil(maxWorld.y / spacing) * spacing;

    for (let x = startX; x <= endX + spacing * 0.5; x += spacing) {
      const screenX = toScreenPoint(x, 0).x;
      gridGraphics.moveTo(screenX, 0);
      gridGraphics.lineTo(screenX, height);
    }
    for (let y = startY; y <= endY + spacing * 0.5; y += spacing) {
      const screenY = toScreenPoint(0, y).y;
      gridGraphics.moveTo(0, screenY);
      gridGraphics.lineTo(width, screenY);
    }
    gridGraphics.stroke({ color: 0xbfc6d4, alpha: 0.35, width: 1 });
  }

  function updateOverlays() {
    updateScaleBar();
    updateGridOverlay();
    updateCursorOverlay();
    updatePointerStatus();
    updateMeasureOverlay();
  }

  function beginDrag(event) {
    dragState = {
      x: event.clientX,
      y: event.clientY,
      startX: world.position.x,
      startY: world.position.y,
    };
  }

  function zoomAtScreenPoint(screenX, screenY, zoomFactor) {
    if (!world || !Number.isFinite(zoomFactor) || zoomFactor <= 0) {
      return;
    }
    const beforeX = (screenX - world.position.x) / world.scale.x;
    const beforeY = (screenY - world.position.y) / world.scale.y;
    const nextScaleX = world.scale.x * zoomFactor;
    const nextScaleY = world.scale.y * zoomFactor;
    world.scale.set(nextScaleX, nextScaleY);
    world.position.set(screenX - beforeX * nextScaleX, screenY - beforeY * nextScaleY);
    updateOverlays();
  }

  function keyboardZoomAnchor() {
    return lastPointerScreen || {
      x: host.clientWidth / 2,
      y: host.clientHeight / 2,
    };
  }

  function stopKeyboardZoom() {
    keyboardZoomDirection = 0;
    if (keyboardZoomFrame != null) {
      window.cancelAnimationFrame(keyboardZoomFrame);
      keyboardZoomFrame = null;
    }
  }

  function tickKeyboardZoom() {
    if (!keyboardZoomDirection) {
      keyboardZoomFrame = null;
      return;
    }
    const anchor = keyboardZoomAnchor();
    const zoom = keyboardZoomDirection > 0 ? keyboardZoomStep : 1 / keyboardZoomStep;
    zoomAtScreenPoint(anchor.x, anchor.y, zoom);
    keyboardZoomFrame = window.requestAnimationFrame(tickKeyboardZoom);
  }

  function startKeyboardZoom(direction) {
    keyboardZoomDirection = direction;
    if (keyboardZoomFrame == null) {
      tickKeyboardZoom();
    }
  }

  function fitView() {
    if (!world) {
      return;
    }
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    const scale = Math.min(width / spanX, height / spanY) * 0.92;
    world.scale.set(scale, scale);
    world.position.set(width / 2 - drawCenterX * scale, height / 2 - drawCenterY * scale);
    updateOverlays();
  }

  function descendantCellNames(cellName) {
    const result = [cellName];
    const queue = [cellName];

    while (queue.length > 0) {
      const currentName = queue.shift();
      const node = cellTreeNodes.get(currentName);
      for (const childName of (node && node.children) || []) {
        if (!result.includes(childName)) {
          result.push(childName);
          queue.push(childName);
        }
      }
    }

    return result;
  }

  function syncCellButtons(cellName, visible) {
    cellToggleHost
      .querySelectorAll(`.cell-chip[data-key="${CSS.escape(cellName)}"]`)
      .forEach((button) => {
        if (button instanceof HTMLElement) {
          button.classList.toggle("is-off", !visible);
          button.setAttribute("aria-pressed", visible ? "true" : "false");
        }
      });
  }

  function setAllVisible(visible) {
    Object.keys(cellState).forEach((key) => {
      cellState[key] = visible;
    });
    Object.keys(layerState).forEach((key) => {
      layerState[key] = visible;
    });
    document.querySelectorAll(".cell-chip").forEach((button) => {
      button.classList.toggle("is-off", !visible);
      button.setAttribute("aria-pressed", visible ? "true" : "false");
    });
    document.querySelectorAll(".layer-chip").forEach((button) => {
      button.classList.toggle("is-off", !visible);
      button.setAttribute("aria-pressed", visible ? "true" : "false");
    });
    const needsRender = visible && viewModel.layers.some((layer) => !loadedLayerKeys.has(layer.key));
    if (needsRender) {
      scheduleSceneRender();
      return;
    }
    applyVisibility();
    updateOverlays();
  }

  function attachCellHandlers() {
    if (cellHandlersBound) {
      return;
    }
    cellHandlersBound = true;
    cellToggleHost.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const button = event.target.closest(".cell-chip");
      if (!(button instanceof HTMLElement)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const { key } = button.dataset;
      const nextVisible = !cellState[key];
      for (const cellName of descendantCellNames(key)) {
        cellState[cellName] = nextVisible;
        syncCellButtons(cellName, nextVisible);
      }
      applyVisibility();
    });
  }

  function createCellNode(cellName, depth) {
    const cell = cellTreeNodes.get(cellName);
    const children = (cell && cell.children) || [];
    const node = document.createElement("div");
    node.className = "tree-node";

    const row = document.createElement("div");
    row.className = "tree-row";

    const marker = document.createElement("span");
    marker.className = "fold-marker";
    marker.textContent = children.length > 0 ? "▾" : "";
    row.appendChild(marker);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell-chip";
    button.dataset.key = cell.name;
    button.setAttribute("aria-pressed", "true");
    button.textContent = cell.name;
    row.appendChild(button);

    if (children.length > 0) {
      const details = document.createElement("details");
      details.className = "tree-folder";
      details.open = depth < 2;

      const summary = document.createElement("summary");
      summary.className = "tree-summary";
      summary.appendChild(row);
      details.appendChild(summary);

      const childHost = document.createElement("div");
      childHost.className = "tree-children";
      details.appendChild(childHost);
      details.addEventListener("toggle", () => {
        marker.textContent = details.open ? "▾" : "▸";
      });
      marker.textContent = "▸";
      node.appendChild(details);
      return { node, childHost, children };
    } else {
      node.appendChild(row);
      return { node, childHost: null, children: [] };
    }
  }

  function buildLayerChip(layer) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "layer-chip";
    button.dataset.key = layer.key;
    button.setAttribute("aria-pressed", "true");

    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.background = layer.cssColor;
    button.appendChild(chip);
    button.appendChild(document.createTextNode(layer.label));

    button.addEventListener("click", () => {
      layerState[layer.key] = !layerState[layer.key];
      button.classList.toggle("is-off", !layerState[layer.key]);
      button.setAttribute("aria-pressed", layerState[layer.key] ? "true" : "false");
      if (layerState[layer.key] && !loadedLayerKeys.has(layer.key)) {
        scheduleSceneRender();
        return;
      }
      applyVisibility();
      updateOverlays();
    });

    return button;
  }

  function drawGroup(group) {
    const template = templateMap.get(group.templateId);
    if (!template || !window.PIXI) {
      const graphics = new PIXI.Graphics();
      groupMap.set(group.id, graphics);
      world.addChild(graphics);
      return;
    }

    const context = templateContextMap.get(template.id);
    if (context && window.PIXI.GraphicsContext) {
      const graphics = new PIXI.Graphics(context);
      const [a, b, c, d] = group.transform;
      const [ox, oy] = group.offset;
      const determinant = a * d - b * c;
      const magnitude = Math.hypot(a, c) || 1;
      const rotation = Math.atan2(-c, a);

      graphics.position.set(ox, -oy);
      graphics.scale.set(magnitude, determinant < 0 ? -magnitude : magnitude);
      graphics.rotation = rotation;
      graphics.eventMode = "none";
      groupMap.set(group.id, graphics);
      world.addChild(graphics);
      return;
    }

    const graphics = new PIXI.Graphics();
    const color = hexToNumber(group.cssColor);
    const outlineColor = 0x8a93a3;
    const [a, b, c, d] = group.transform;
    const [ox, oy] = group.offset;

    for (const item of template.polygons || []) {
      const coords = item.polygon;
      if (!coords || coords.length < 6) {
        continue;
      }
      const firstX = a * coords[0] + b * coords[1] + ox;
      const firstY = c * coords[0] + d * coords[1] + oy;
      graphics.moveTo(firstX, -firstY);
      for (let index = 2; index < coords.length; index += 2) {
        const x = a * coords[index] + b * coords[index + 1] + ox;
        const y = c * coords[index] + d * coords[index + 1] + oy;
        graphics.lineTo(x, -y);
      }
      graphics.closePath();
      graphics.fill({ color, alpha: 0.26 });
      graphics.stroke({ color: outlineColor, alpha: 0.45, width: 0.8 });
    }

    graphics.eventMode = "none";
    groupMap.set(group.id, graphics);
    world.addChild(graphics);
  }

  function buildTemplateContexts(templates) {
    if (!window.PIXI || !window.PIXI.GraphicsContext) {
      return;
    }

    for (const template of templates || []) {
      if (templateContextMap.has(template.id)) {
        continue;
      }
      const context = new PIXI.GraphicsContext();
      const color = hexToNumber(template.cssColor);
      const outlineColor = 0x8a93a3;
      for (const item of template.polygons || []) {
        const coords = item.polygon;
        if (!coords || coords.length < 6) {
          continue;
        }
        const flipped = new Array(coords.length);
        for (let index = 0; index < coords.length; index += 2) {
          flipped[index] = coords[index];
          flipped[index + 1] = -coords[index + 1];
        }
        context.poly(flipped, true).fill({ color, alpha: 0.26 }).stroke({ color: outlineColor, alpha: 0.45, width: 0.8 });
      }
      templateContextMap.set(template.id, context);
    }
  }

  function mergeLayerPayload(layerPayload) {
    if (!layerPayload) {
      return;
    }
    for (const template of layerPayload.templates || []) {
      if (!templateMap.has(template.id)) {
        templateMap.set(template.id, template);
        viewModel.templates.push(template);
      }
    }
    buildTemplateContexts(layerPayload.templates || []);
    for (const group of layerPayload.groups || []) {
      if (!viewModel.groups.find((item) => item.id === group.id)) {
        viewModel.groups.push(group);
      }
    }
    if (layerPayload.layerKey) {
      loadedLayerKeys.add(layerPayload.layerKey);
    }
  }

  async function ensureApp() {
    if (!window.PIXI || !window.PIXI.Application || !window.PIXI.Graphics) {
      throw new Error("PixiJS failed to load.");
    }
    if (app) {
      return;
    }

    app = new PIXI.Application();
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: false,
      preference: "webgl",
    });
    host.appendChild(app.canvas);
    gridGraphics = new PIXI.Graphics();
    cursorGraphics = new PIXI.Graphics();
    measureGraphics = new PIXI.Graphics();
    app.stage.addChild(gridGraphics);
    world = new PIXI.Container();
    app.stage.addChild(world);
    app.stage.addChild(cursorGraphics);
    app.stage.addChild(measureGraphics);

    host.addEventListener("contextmenu", (event) => {
      if (measureMode) {
        event.preventDefault();
      }
    });

    host.addEventListener("pointerdown", (event) => {
      if (measureMode && event.button === 2) {
        event.preventDefault();
        beginDrag(event);
        return;
      }
      if (measureMode) {
        if (event.button !== 0) {
          return;
        }
        const rect = host.getBoundingClientRect();
        const snappedPoint = snapMeasurePoint(
          toActualPoint(event.clientX - rect.left, event.clientY - rect.top),
        );
        const nextPoint = lockMeasuredPoint(
          measureStart,
          snappedPoint,
          event.ctrlKey,
        );
        if (!measureStart || measureEnd) {
          measureStart = nextPoint;
          measureEnd = null;
        } else {
          measureEnd = nextPoint;
          const measurement = buildMeasurement(nextMeasurementId, measureStart, nextPoint);
          nextMeasurementId += 1;
          measurements.push(measurement);
          selectedMeasurementId = measurement.id;
          renderMeasurementList();
          updateMeasureOverlay();
          window.setTimeout(() => setMeasureMode(false), 0);
        }
        measurePointer = nextPoint;
        lastPointerActual = nextPoint;
        updateMeasureOverlay();
        updateCursorOverlay();
        updatePointerStatus();
        return;
      }
      if (event.button !== 0) {
        return;
      }
      beginDrag(event);
    });
    window.addEventListener("pointermove", (event) => {
      const rect = host.getBoundingClientRect();
      const insideHost =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (insideHost) {
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        lastPointerScreen = screenPoint;
        const actualPoint = toActualPoint(screenPoint.x, screenPoint.y);
        lastPointerActual = actualPoint;
        if (measureMode) {
          const snappedPoint = snapMeasurePoint(actualPoint);
          measurePointer = measureStart && !measureEnd
            ? lockMeasuredPoint(measureStart, snappedPoint, event.ctrlKey)
            : snappedPoint;
          updateCursorOverlay();
          updatePointerStatus();
          if (measureStart && !measureEnd) {
            updateMeasureOverlay();
          }
        }
      } else if (measureMode) {
        lastPointerActual = null;
        if (!measureStart) {
          measurePointer = null;
        }
        updateCursorOverlay();
        updatePointerStatus();
      }
      if (!dragState) {
        return;
      }
      world.position.set(
        dragState.startX + (event.clientX - dragState.x),
        dragState.startY + (event.clientY - dragState.y),
      );
      updateOverlays();
    });
    window.addEventListener("pointerup", () => {
      dragState = null;
    });
    host.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const rect = host.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        lastPointerScreen = { x: px, y: py };
        const zoom = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        zoomAtScreenPoint(px, py, zoom);
      },
      { passive: false },
    );

    resizeObserver = new ResizeObserver(() => {
      fitView();
      updateOverlays();
    });
    resizeObserver.observe(host);
  }

  function nextFrame() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }

  function nextIdle() {
    return new Promise((resolve) => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => resolve(), { timeout: 120 });
        return;
      }
      window.setTimeout(() => resolve(), 0);
    });
  }

  async function renderCellTreeProgressively() {
    cellRenderToken += 1;
    const token = cellRenderToken;
    const workQueue = [];

    for (const rootName of viewModel.cellTree.roots) {
      if (!cellTreeNodes.has(rootName)) {
        continue;
      }
      workQueue.push({
        parentHost: cellToggleHost,
        cellName: rootName,
        depth: 0,
        ancestorNames: new Set([rootName]),
      });
    }

    const batchSize = 50;
    while (workQueue.length > 0) {
      if (token !== cellRenderToken) {
        return;
      }

      let processed = 0;

      while (workQueue.length > 0 && processed < batchSize) {
        const { parentHost, cellName, depth, ancestorNames } = workQueue.shift();
        const built = createCellNode(cellName, depth);
        parentHost.appendChild(built.node);
        processed += 1;

        if (built.childHost && built.children.length > 0) {
          for (const childName of built.children) {
            if (ancestorNames.has(childName)) {
              continue;
            }
            workQueue.push({
              parentHost: built.childHost,
              cellName: childName,
              depth: depth + 1,
              ancestorNames: new Set([...ancestorNames, childName]),
            });
          }
        }
      }

      await nextFrame();
    }
  }

  async function rebuildControls() {
    clearChildren(cellToggleHost);
    clearChildren(layerToggleHost);

    cellTreeNodes = new Map(viewModel.cells.map((cell) => [cell.name, cell]));
    templateMap = new Map((viewModel.templates || []).map((template) => [template.id, template]));
    templateContextMap = new Map();
    buildTemplateContexts(viewModel.templates || []);
    cellState = Object.fromEntries(viewModel.cells.map((cell) => [cell.name, true]));
    layerState = Object.fromEntries(viewModel.layers.map((layer) => [layer.key, true]));
    viewModel.layers.forEach((layer) => {
      layerToggleHost.appendChild(buildLayerChip(layer));
    });
    renderMeasurementList();
    attachCellHandlers();
    await renderCellTreeProgressively();
  }

  function rebuildSceneBounds() {
    drawCenterX = (viewModel.bounds.xmin + viewModel.bounds.xmax) / 2;
    drawCenterY = -((viewModel.bounds.ymin + viewModel.bounds.ymax) / 2);
    spanX = Math.max(viewModel.bounds.xmax - viewModel.bounds.xmin, 1);
    spanY = Math.max(viewModel.bounds.ymax - viewModel.bounds.ymin, 1);
    fitView();
  }

  async function renderSceneProgressively() {
    sceneRenderToken += 1;
    const token = sceneRenderToken;
    groupMap = new Map();
    world.removeChildren();
    rebuildSceneBounds();

    const groupsByLayer = new Map();
    for (const group of viewModel.groups || []) {
      if (!groupsByLayer.has(group.layerKey)) {
        groupsByLayer.set(group.layerKey, []);
      }
      groupsByLayer.get(group.layerKey).push(group);
    }

    const layerOrder = viewModel.layers
      .map((layer) => layer.key)
      .filter((layerKey) => layerState[layerKey]);

    if (layerOrder.length === 0) {
      applyVisibility();
      updateOverlays();
      return;
    }

    const firstLayerKey = layerOrder[0];
    setStatusMessage(`Rendering layer 1/${layerOrder.length}: ${firstLayerKey}`);
    for (const group of groupsByLayer.get(firstLayerKey) || []) {
      drawGroup(group);
    }
    applyVisibility();
    await nextFrame();

    for (let layerIndex = 1; layerIndex < layerOrder.length; layerIndex += 1) {
      if (token !== sceneRenderToken) {
        return;
      }
      const layerKey = layerOrder[layerIndex];
      setStatusMessage(`Rendering layer ${layerIndex + 1}/${layerOrder.length}: ${layerKey}`);
      for (const group of groupsByLayer.get(layerKey) || []) {
        drawGroup(group);
      }
      applyVisibility();
      await nextIdle();
    }

    if (token === sceneRenderToken) {
      applyVisibility();
      updateOverlays();
    }
  }

  function scheduleSceneRender() {
    if (!viewModel || !world) {
      return;
    }
    void renderSceneProgressively();
  }

  async function setViewModel(nextViewModel) {
    viewModel = nextViewModel;
    loadedLayerKeys = new Set((viewModel.layers || []).map((layer) => layer.key));
    mergeLayerPayload({ groups: viewModel.groups || [], templates: viewModel.templates || [] });
    measurements = [];
    selectedMeasurementId = null;
    measureStart = null;
    measureEnd = null;
    measurePointer = null;
    document.title = viewModel.title;
    const titleNode = document.querySelector(".title");
    if (titleNode) {
      titleNode.textContent = viewModel.title;
    }
    await ensureApp();
    await rebuildControls();
    await renderSceneProgressively();
    clearWarning();
  }

  async function parseLocalGds(file) {
    return parseArrayBufferGds(await file.arrayBuffer(), { title: `GDS Viewer: ${file.name}` });
  }

  function requireGdsParser() {
    if (!window.GdsParser || !window.GdsParser.parseGds || !window.GdsParser.buildGdsViewModel) {
      throw new Error("The GDS parser script failed to load.");
    }
    return window.GdsParser;
  }

  function buildLocalViewModel(library, options) {
    const parser = requireGdsParser();
    const model = parser.buildGdsViewModel(library, options);
    model.groups = model.groups || [];
    model.templates = model.templates || [];
    return model;
  }

  async function parseArrayBufferGds(arrayBuffer, options) {
    const library = requireGdsParser().parseGds(arrayBuffer);
    return buildLocalViewModel(library, options);
  }

  async function loadPreloadedGds() {
    const configResponse = await fetch("/api/preload");
    if (!configResponse.ok) {
      throw new Error("Failed to fetch preload configuration.");
    }
    const config = await configResponse.json();
    if (!config) {
      return false;
    }

    showWarning("Loading preloaded GDS file...");
    const bytesResponse = await fetch("/api/preloaded-gds");
    const bytesPayload = await bytesResponse.arrayBuffer();
    if (!bytesResponse.ok) {
      let message = "Failed to fetch the preloaded GDS file.";
      try {
        message = JSON.parse(new TextDecoder().decode(bytesPayload)).error || message;
      } catch (_) {
        // keep the generic message
      }
      throw new Error(message);
    }

    const model = await parseArrayBufferGds(bytesPayload, {
      title: config.title || `GDS Viewer: ${config.filename}`,
      cellName: config.cellName || null,
      maxDepth: config.maxDepth ?? null,
    });
    await setViewModel(model);
    return true;
  }

  async function loadGdsFile(file) {
    if (!file) {
      return;
    }
    if (!(file.name || "").toLowerCase().endsWith(".gds")) {
      showWarning("Only .gds files can be loaded.");
      return;
    }
    showWarning("Loading GDS file...");
    try {
      const model = await parseLocalGds(file);
      await setViewModel(model);
    } catch (error) {
      showWarning(String(error));
    }
  }

  function setDragDropActive(active) {
    if (!stageNode) {
      return;
    }
    stageNode.classList.toggle("is-dragover", active);
  }

  loadFileButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const [file] = fileInput.files || [];
    try {
      await loadGdsFile(file);
    } finally {
      fileInput.value = "";
    }
  });
  window.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  stageNode?.addEventListener("dragenter", (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) {
      return;
    }
    event.preventDefault();
    dragDropDepth += 1;
    setDragDropActive(true);
  });
  stageNode?.addEventListener("dragover", (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  stageNode?.addEventListener("dragleave", (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) {
      return;
    }
    event.preventDefault();
    dragDropDepth = Math.max(0, dragDropDepth - 1);
    if (dragDropDepth === 0) {
      setDragDropActive(false);
    }
  });
  stageNode?.addEventListener("drop", async (event) => {
    if (!event.dataTransfer?.files?.length) {
      return;
    }
    event.preventDefault();
    dragDropDepth = 0;
    setDragDropActive(false);
    await loadGdsFile(event.dataTransfer.files[0]);
  });

  fitButton.addEventListener("click", () => fitView());
  showAllButton.addEventListener("click", () => setAllVisible(true));
  hideAllButton.addEventListener("click", () => setAllVisible(false));
  measureButton.addEventListener("click", () => setMeasureMode(!measureMode));
  gridButton.addEventListener("click", () => {
    gridVisible = !gridVisible;
    gridButton.classList.toggle("is-active", gridVisible);
    updateGridOverlay();
  });
  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLElement) {
      const tagName = target.tagName.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || target.isContentEditable) {
        return;
      }
    }
    if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      setMeasureMode(!measureMode);
      return;
    }
    if (event.key.toLowerCase() === "z") {
      event.preventDefault();
      startKeyboardZoom(1);
      return;
    }
    if (event.key.toLowerCase() === "x") {
      event.preventDefault();
      startKeyboardZoom(-1);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      if (selectedMeasurementId != null) {
        event.preventDefault();
        deleteSelectedMeasurement();
      }
    }
  });
  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if ((key === "z" && keyboardZoomDirection > 0) || (key === "x" && keyboardZoomDirection < 0)) {
      stopKeyboardZoom();
    }
  });
  window.addEventListener("blur", () => {
    stopKeyboardZoom();
  });

  try {
    const loadedPreloaded = await loadPreloadedGds();
    if (!loadedPreloaded) {
      showWarning("No initial GDS is loaded yet. Use the Load GDS File button.");
    }
  } catch (error) {
    showWarning(String(error));
  }
})();
