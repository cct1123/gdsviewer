(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.GdsParser = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const RECORD = Object.freeze({
    HEADER: 0x00,
    BGNLIB: 0x01,
    LIBNAME: 0x02,
    UNITS: 0x03,
    ENDLIB: 0x04,
    BGNSTR: 0x05,
    STRNAME: 0x06,
    ENDSTR: 0x07,
    BOUNDARY: 0x08,
    PATH: 0x09,
    SREF: 0x0a,
    AREF: 0x0b,
    TEXT: 0x0c,
    LAYER: 0x0d,
    DATATYPE: 0x0e,
    WIDTH: 0x0f,
    XY: 0x10,
    ENDEL: 0x11,
    SNAME: 0x12,
    COLROW: 0x13,
    TEXTTYPE: 0x16,
    PRESENTATION: 0x17,
    STRING: 0x19,
    STRANS: 0x1a,
    MAG: 0x1b,
    ANGLE: 0x1c,
    PATHTYPE: 0x21,
    BOX: 0x2d,
    BOXTYPE: 0x2e,
    BGNEXTN: 0x30,
    ENDEXTN: 0x31,
  });

  const recordFormats = {
    [RECORD.HEADER]: [2, 2], [RECORD.BGNLIB]: [2, 24], [RECORD.LIBNAME]: [6],
    [RECORD.UNITS]: [5, 16], [RECORD.ENDLIB]: [0, 0], [RECORD.BGNSTR]: [2, 24],
    [RECORD.STRNAME]: [6], [RECORD.ENDSTR]: [0, 0], [RECORD.BOUNDARY]: [0, 0],
    [RECORD.PATH]: [0, 0], [RECORD.SREF]: [0, 0], [RECORD.AREF]: [0, 0],
    [RECORD.LAYER]: [2, 2], [RECORD.DATATYPE]: [2, 2], [RECORD.WIDTH]: [3, 4],
    [RECORD.TEXTTYPE]: [2, 2], [RECORD.BOXTYPE]: [2, 2],
    [RECORD.XY]: [3], [RECORD.ENDEL]: [0, 0], [RECORD.SNAME]: [6],
    [RECORD.COLROW]: [2, 4], [RECORD.STRANS]: [1, 2], [RECORD.MAG]: [5, 8],
    [RECORD.ANGLE]: [5, 8], [RECORD.PATHTYPE]: [2, 2],
    [RECORD.BGNEXTN]: [3, 4], [RECORD.ENDEXTN]: [3, 4],
  };

  function asBytes(input) {
    if (input instanceof Uint8Array) {
      return input;
    }
    if (input instanceof ArrayBuffer) {
      return new Uint8Array(input);
    }
    if (ArrayBuffer.isView(input)) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    throw new TypeError("parseGds expects an ArrayBuffer or byte array.");
  }

  function decodeReal8(bytes, offset) {
    const first = bytes[offset];
    if (first === 0) {
      return 0;
    }
    const sign = (first & 0x80) === 0 ? 1 : -1;
    const exponent = (first & 0x7f) - 64;
    let fraction = 0;
    let divisor = 256;
    for (let index = 1; index < 8; index += 1) {
      fraction += bytes[offset + index] / divisor;
      divisor *= 256;
    }
    return sign * fraction * 16 ** exponent;
  }

  function decodeString(bytes, start, end) {
    let value = "";
    for (let index = start; index < end && bytes[index] !== 0; index += 1) {
      value += String.fromCharCode(bytes[index]);
    }
    return value;
  }

  function samePoint(first, second) {
    return first && second && first[0] === second[0] && first[1] === second[1];
  }

  function parseGds(input) {
    const bytes = asBytes(input);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const library = { name: "", unit: 1e-6, precision: 1e-9, cells: [] };
    let coordinateScale = 1;
    let currentCell = null;
    let element = null;
    let offset = 0;
    let hasHeader = false;
    let hasUnits = false;
    let hasEnd = false;

    function coordinates(start, end) {
      const points = [];
      for (let position = start; position < end; position += 8) {
        points.push([view.getInt32(position) * coordinateScale, view.getInt32(position + 4) * coordinateScale]);
      }
      return points;
    }

    function beginElement(kind) {
      if (!currentCell) {
        throw new Error(`GDSII ${kind} element appears outside a structure at byte ${offset}.`);
      }
      element = {
        kind,
        layer: 0,
        datatype: 0,
        points: [],
        width: 0,
        pathType: 0,
        beginExtension: 0,
        endExtension: 0,
        cellName: "",
        columns: 1,
        rows: 1,
        xReflection: false,
        magnification: 1,
        angle: 0,
      };
    }

    function finishElement() {
      if (!element || !currentCell) {
        element = null;
        return;
      }
      if (element.kind === "boundary") {
        const points = element.points;
        if (points.length > 1 && samePoint(points[0], points[points.length - 1])) {
          points.pop();
        }
        if (points.length >= 3) {
          currentCell.polygons.push({ layer: element.layer, datatype: element.datatype, points });
        }
      } else if (element.kind === "path") {
        if (element.points.length >= 2) {
          currentCell.paths.push({
            layer: element.layer,
            datatype: element.datatype,
            points: element.points,
            width: element.width,
            pathType: element.pathType,
            beginExtension: element.beginExtension,
            endExtension: element.endExtension,
          });
        }
      } else if (element.kind === "sref" || element.kind === "aref") {
        if (element.cellName && element.points.length > 0) {
          currentCell.references.push({
            cellName: element.cellName,
            origin: element.points[0],
            columns: element.columns,
            rows: element.rows,
            columnVector:
              element.kind === "aref" && element.points[1]
                ? [
                    (element.points[1][0] - element.points[0][0]) / element.columns,
                    (element.points[1][1] - element.points[0][1]) / element.columns,
                  ]
                : [0, 0],
            rowVector:
              element.kind === "aref" && element.points[2]
                ? [
                    (element.points[2][0] - element.points[0][0]) / element.rows,
                    (element.points[2][1] - element.points[0][1]) / element.rows,
                  ]
                : [0, 0],
            xReflection: element.xReflection,
            magnification: element.magnification,
            angle: element.angle,
          });
        }
      }
      element = null;
    }

    while (offset < bytes.length) {
      if (offset + 4 > bytes.length) {
        throw new Error(`Incomplete GDSII record header at byte ${offset}.`);
      }
      const length = view.getUint16(offset);
      const recordType = bytes[offset + 2];
      if (length < 4) {
        throw new Error(`Invalid GDSII record length ${length} at byte ${offset}.`);
      }
      const end = offset + length;
      if (end > bytes.length) {
        throw new Error(`GDSII record at byte ${offset} extends beyond the input.`);
      }
      const dataStart = offset + 4;
      const dataLength = length - 4;
      const format = bytes[offset + 3];
      // Validate supported payloads before reading them, independent of filename/MIME.
      const expected = recordFormats[recordType];
      if (length % 2 || (expected && (format !== expected[0] ||
          (expected[1] != null && dataLength !== expected[1]))) ||
          (recordType === RECORD.XY && (dataLength === 0 || dataLength % 8))) {
        throw new Error(`Invalid GDSII ${recordType === RECORD.ENDLIB ? "ENDLIB" : "record payload"} at byte ${offset}.`);
      }

      switch (recordType) {
        case RECORD.HEADER:
          if (offset !== 0) throw new Error(`Unexpected GDSII HEADER at byte ${offset}.`);
          hasHeader = true;
          break;
        case RECORD.LIBNAME:
          library.name = decodeString(bytes, dataStart, end);
          break;
        case RECORD.UNITS: {
          if (end - dataStart !== 16) {
            throw new Error(`Invalid GDSII UNITS record at byte ${offset}.`);
          }
          coordinateScale = decodeReal8(bytes, dataStart);
          library.precision = decodeReal8(bytes, dataStart + 8);
          library.unit = coordinateScale === 0 ? 0 : library.precision / coordinateScale;
          if (!(coordinateScale > 0 && library.precision > 0 && Number.isFinite(library.unit))) {
            throw new Error(`Invalid GDSII UNITS at byte ${offset}.`);
          }
          hasUnits = true;
          break;
        }
        case RECORD.BGNSTR:
          currentCell = { name: "", polygons: [], paths: [], references: [] };
          break;
        case RECORD.STRNAME:
          if (currentCell) {
            currentCell.name = decodeString(bytes, dataStart, end);
          }
          break;
        case RECORD.ENDSTR:
          if (currentCell) {
            library.cells.push(currentCell);
          }
          currentCell = null;
          break;
        case RECORD.BOUNDARY:
          beginElement("boundary");
          break;
        case RECORD.PATH:
          beginElement("path");
          break;
        case RECORD.SREF:
          beginElement("sref");
          break;
        case RECORD.AREF:
          beginElement("aref");
          break;
        case RECORD.TEXT:
        case RECORD.BOX:
          beginElement("ignored");
          break;
        case RECORD.LAYER:
          if (element) {
            element.layer = view.getInt16(dataStart);
          }
          break;
        case RECORD.DATATYPE:
        case RECORD.TEXTTYPE:
        case RECORD.BOXTYPE:
          if (element) {
            element.datatype = view.getInt16(dataStart);
          }
          break;
        case RECORD.WIDTH:
          if (element) {
            element.width = view.getInt32(dataStart) * coordinateScale;
          }
          break;
        case RECORD.PATHTYPE:
          if (element) {
            element.pathType = view.getInt16(dataStart);
          }
          break;
        case RECORD.BGNEXTN:
          if (element) {
            element.beginExtension = view.getInt32(dataStart) * coordinateScale;
          }
          break;
        case RECORD.ENDEXTN:
          if (element) {
            element.endExtension = view.getInt32(dataStart) * coordinateScale;
          }
          break;
        case RECORD.XY:
          if (element) {
            element.points = coordinates(dataStart, end);
          }
          break;
        case RECORD.SNAME:
          if (element) {
            element.cellName = decodeString(bytes, dataStart, end);
          }
          break;
        case RECORD.COLROW: {
          if (element) {
            element.columns = view.getInt16(dataStart);
            element.rows = view.getInt16(dataStart + 2);
            if (element.columns <= 0 || element.rows <= 0) {
              throw new Error(`Invalid GDSII array dimensions at byte ${offset}.`);
            }
          }
          break;
        }
        case RECORD.STRANS:
          if (element) {
            element.xReflection = (view.getUint16(dataStart) & 0x8000) !== 0;
          }
          break;
        case RECORD.MAG:
          if (element) {
            element.magnification = decodeReal8(bytes, dataStart);
          }
          break;
        case RECORD.ANGLE:
          if (element) {
            element.angle = decodeReal8(bytes, dataStart);
          }
          break;
        case RECORD.ENDEL:
          finishElement();
          break;
        default:
          break;
      }
      offset = end;
      if (recordType === RECORD.ENDLIB) {
        hasEnd = true;
        if (length !== 4 || bytes[dataStart - 1] !== 0) {
          throw new Error("Invalid GDSII ENDLIB record.");
        }
        // Some writers pad the final tape block with null bytes.
        for (; offset < bytes.length; offset += 1) {
          if (bytes[offset] !== 0) {
            throw new Error(`Unexpected data after GDSII ENDLIB at byte ${offset}.`);
          }
        }
      }
    }

    if (currentCell || element) {
      throw new Error("GDSII input ended before the current structure or element was closed.");
    }
    if (!hasHeader || !hasUnits || !hasEnd) {
      throw new Error("Invalid GDSII content: HEADER, UNITS, and ENDLIB records are required.");
    }
    return library;
  }

  function lineIntersection(firstPoint, firstDirection, secondPoint, secondDirection) {
    const determinant = firstDirection[0] * secondDirection[1] - firstDirection[1] * secondDirection[0];
    if (Math.abs(determinant) < 1e-12) {
      return firstPoint;
    }
    const dx = secondPoint[0] - firstPoint[0];
    const dy = secondPoint[1] - firstPoint[1];
    const amount = (dx * secondDirection[1] - dy * secondDirection[0]) / determinant;
    return [firstPoint[0] + amount * firstDirection[0], firstPoint[1] + amount * firstDirection[1]];
  }

  function pathToPolygon(path) {
    const points = path.points.filter((point, index, all) => index === 0 || !samePoint(point, all[index - 1]));
    if (points.length < 2 || path.width === 0) {
      return null;
    }
    if (path.pathType === 1) {
      throw new Error("Round-ended GDSII paths are not supported by the JavaScript parser yet.");
    }
    if (![0, 2, 4].includes(path.pathType)) {
      throw new Error(`Unsupported GDSII path type ${path.pathType}.`);
    }

    const halfWidth = Math.abs(path.width) / 2;
    const directions = [];
    const normals = [];
    for (let index = 0; index + 1 < points.length; index += 1) {
      const dx = points[index + 1][0] - points[index][0];
      const dy = points[index + 1][1] - points[index][1];
      const length = Math.hypot(dx, dy);
      const direction = [dx / length, dy / length];
      directions.push(direction);
      normals.push([-direction[1] * halfWidth, direction[0] * halfWidth]);
    }

    const beginExtension = path.pathType === 2 ? halfWidth : path.pathType === 4 ? path.beginExtension : 0;
    const endExtension = path.pathType === 2 ? halfWidth : path.pathType === 4 ? path.endExtension : 0;
    const firstCenter = [
      points[0][0] - directions[0][0] * beginExtension,
      points[0][1] - directions[0][1] * beginExtension,
    ];
    const lastDirection = directions[directions.length - 1];
    const lastCenter = [
      points[points.length - 1][0] + lastDirection[0] * endExtension,
      points[points.length - 1][1] + lastDirection[1] * endExtension,
    ];
    const left = [[firstCenter[0] + normals[0][0], firstCenter[1] + normals[0][1]]];
    const right = [[firstCenter[0] - normals[0][0], firstCenter[1] - normals[0][1]]];

    for (let index = 1; index + 1 < points.length; index += 1) {
      const previousDirection = directions[index - 1];
      const nextDirection = directions[index];
      const previousNormal = normals[index - 1];
      const nextNormal = normals[index];
      left.push(
        lineIntersection(
          [points[index][0] + previousNormal[0], points[index][1] + previousNormal[1]],
          previousDirection,
          [points[index][0] + nextNormal[0], points[index][1] + nextNormal[1]],
          nextDirection,
        ),
      );
      right.push(
        lineIntersection(
          [points[index][0] - previousNormal[0], points[index][1] - previousNormal[1]],
          previousDirection,
          [points[index][0] - nextNormal[0], points[index][1] - nextNormal[1]],
          nextDirection,
        ),
      );
    }

    const lastNormal = normals[normals.length - 1];
    left.push([lastCenter[0] + lastNormal[0], lastCenter[1] + lastNormal[1]]);
    right.push([lastCenter[0] - lastNormal[0], lastCenter[1] - lastNormal[1]]);
    return left.concat(right.reverse());
  }

  const PALETTE = Object.freeze([
    "#ff6b6b", "#4dabf7", "#51cf66", "#ffd43b", "#845ef7", "#ff922b",
    "#f06595", "#20c997", "#339af0", "#94d82d", "#fcc419", "#5c7cfa",
    "#ff8787", "#74c0fc", "#69db7c", "#ffe066", "#b197fc", "#ffa94d",
    "#faa2c1", "#63e6be", "#a5d8ff", "#c0eb75", "#ffec99", "#d0bfff",
  ]);

  function groupColor(layer, datatype) {
    return PALETTE[(layer * 11 + datatype * 17) % PALETTE.length];
  }

  function roundCoordinate(value) {
    return Math.round((value + Number.EPSILON) * 1000) / 1000 || 0;
  }

  function referenceTransform(reference) {
    const radians = (reference.angle * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const reflection = reference.xReflection ? -1 : 1;
    return [
      reference.magnification * cosine,
      reference.magnification * -sine * reflection,
      reference.magnification * sine,
      reference.magnification * cosine * reflection,
    ];
  }

  function multiplyTransforms(first, second) {
    return [
      first[0] * second[0] + first[1] * second[2],
      first[0] * second[1] + first[1] * second[3],
      first[2] * second[0] + first[3] * second[2],
      first[2] * second[1] + first[3] * second[3],
    ];
  }

  function transformPoint(transform, point) {
    return [
      transform[0] * point[0] + transform[1] * point[1],
      transform[2] * point[0] + transform[3] * point[1],
    ];
  }

  function visibleRoots(library, cellsByName) {
    const referenced = new Set();
    for (const cell of library.cells) {
      for (const reference of cell.references) {
        if (cellsByName.has(reference.cellName)) {
          referenced.add(reference.cellName);
        }
      }
    }
    const topLevel = library.cells.filter((cell) => !referenced.has(cell.name));
    const designCells = topLevel.filter((cell) => !cell.name.startsWith("$$$"));
    return designCells.length > 0 ? designCells : topLevel;
  }

  function buildGdsViewModel(library, options = {}) {
    const cellsByName = new Map(library.cells.map((cell) => [cell.name, cell]));
    let roots;
    if (options.cellName != null) {
      const selected = cellsByName.get(options.cellName);
      if (!selected) {
        throw new Error(`Cell '${options.cellName}' was not found.`);
      }
      roots = [selected];
    } else {
      roots = visibleRoots(library, cellsByName);
    }
    if (roots.length === 0 && library.cells.length > 0) {
      roots = [library.cells[0]];
    }
    if (roots.length === 0) {
      throw new Error("No cells were found in the GDSII library.");
    }

    const maxDepth = options.maxDepth == null ? null : options.maxDepth;
    if (maxDepth !== null && (!Number.isSafeInteger(maxDepth) || maxDepth < 0)) {
      throw new Error("Hierarchy depth must be a non-negative whole number.");
    }
    const cellNodes = new Map();
    const visitedCellNames = new Map();
    const rootNames = [];
    const groups = [];
    const sceneRoots = [];
    const layerInfo = new Map();
    const templateInfo = new Map();
    const cellTemplateCache = new Map();
    let boundsMin = null;
    let boundsMax = null;

    function ensureCellNode(name) {
      if (!cellNodes.has(name)) {
        cellNodes.set(name, { id: name, name, children: [] });
      }
      return cellNodes.get(name);
    }

    function cellTemplates(cell) {
      if (cellTemplateCache.has(cell.name)) {
        return cellTemplateCache.get(cell.name);
      }
      const grouped = new Map();
      let localMin = null;
      let localMax = null;
      const geometry = cell.polygons.concat(
        cell.paths.map((path) => ({
          layer: path.layer,
          datatype: path.datatype,
          points: pathToPolygon(path),
        })),
      );
      for (const polygon of geometry) {
        if (!polygon.points || polygon.points.length < 3) {
          continue;
        }
        const pairKey = `${polygon.layer}:${polygon.datatype}`;
        let template = grouped.get(pairKey);
        if (!template) {
          const layerKey = `L${polygon.layer}/D${polygon.datatype}`;
          const cssColor = groupColor(polygon.layer, polygon.datatype);
          template = {
            id: `${cell.name}::${polygon.layer}:${polygon.datatype}`,
            cellName: cell.name,
            layer: polygon.layer,
            datatype: polygon.datatype,
            layerKey,
            cssColor,
            polygonCount: 0,
            polygons: [],
          };
          grouped.set(pairKey, template);
          templateInfo.set(`${cell.name}\u0000${String(polygon.layer).padStart(5, "0")}\u0000${String(polygon.datatype).padStart(5, "0")}`, template);
          if (!layerInfo.has(layerKey)) {
            layerInfo.set(layerKey, {
              key: layerKey,
              label: layerKey,
              layer: polygon.layer,
              datatype: polygon.datatype,
              cssColor,
            });
          }
        }
        template.polygonCount += 1;
        const coordinates = new Array(polygon.points.length * 2);
        for (let index = 0; index < polygon.points.length; index += 1) {
          coordinates[index * 2] = roundCoordinate(polygon.points[index][0]);
          coordinates[index * 2 + 1] = roundCoordinate(polygon.points[index][1]);
        }
        template.polygons.push({ polygon: coordinates });
        for (const point of polygon.points) {
          if (!localMin) {
            localMin = point.slice();
            localMax = point.slice();
          } else {
            localMin[0] = Math.min(localMin[0], point[0]);
            localMin[1] = Math.min(localMin[1], point[1]);
            localMax[0] = Math.max(localMax[0], point[0]);
            localMax[1] = Math.max(localMax[1], point[1]);
          }
        }
      }
      const templates = Array.from(grouped.values()).sort((first, second) =>
        first.layer - second.layer || first.datatype - second.datatype,
      );
      const bundle = { templates, boundsMin: localMin, boundsMax: localMax };
      cellTemplateCache.set(cell.name, bundle);
      return bundle;
    }

    function extendBounds(point) {
      if (!boundsMin) {
        boundsMin = point.slice();
        boundsMax = point.slice();
      } else {
        boundsMin[0] = Math.min(boundsMin[0], point[0]);
        boundsMin[1] = Math.min(boundsMin[1], point[1]);
        boundsMax[0] = Math.max(boundsMax[0], point[0]);
        boundsMax[1] = Math.max(boundsMax[1], point[1]);
      }
    }

    function walkTree(cell, depth) {
      const node = ensureCellNode(cell.name);
      if (visitedCellNames.has(cell.name) && visitedCellNames.get(cell.name) <= depth) {
        return;
      }
      visitedCellNames.set(cell.name, depth);
      if (maxDepth != null && depth >= maxDepth) {
        return;
      }
      const seen = new Set(node.children);
      for (const reference of cell.references) {
        const child = cellsByName.get(reference.cellName);
        if (!child) {
          continue;
        }
        ensureCellNode(child.name);
        if (!seen.has(child.name)) {
          node.children.push(child.name);
          seen.add(child.name);
        }
        walkTree(child, depth + 1);
      }
    }

    const ancestors = new Set();
    function walkGeometry(cell, cellId, transform, offset, depth, repetitions = []) {
      const scene = { groups: [], children: [] };
      if (ancestors.has(cell.name) && maxDepth === null) {
        throw new Error(`Cyclic GDSII reference involving '${cell.name}'. Choose a finite hierarchy depth.`);
      }
      const wasAncestor = ancestors.has(cell.name);
      ancestors.add(cell.name);
      const bundle = cellTemplates(cell);
      const repeatMin = [0, 0];
      const repeatMax = [0, 0];
      let instanceCount = 1;
      for (const repetition of repetitions) {
        instanceCount *= repetition.columns * repetition.rows;
        for (let axis = 0; axis < 2; axis += 1) {
          const column = repetition.columnVector[axis] * (repetition.columns - 1);
          const row = repetition.rowVector[axis] * (repetition.rows - 1);
          repeatMin[axis] += Math.min(0, column) + Math.min(0, row);
          repeatMax[axis] += Math.max(0, column) + Math.max(0, row);
        }
      }
      if (!Number.isSafeInteger(instanceCount)) throw new Error("GDSII repetition count exceeds safe integer precision.");
      if (bundle.boundsMin && bundle.boundsMax) {
        const corners = [
          [bundle.boundsMin[0], bundle.boundsMin[1]],
          [bundle.boundsMin[0], bundle.boundsMax[1]],
          [bundle.boundsMax[0], bundle.boundsMin[1]],
          [bundle.boundsMax[0], bundle.boundsMax[1]],
        ];
        for (const corner of corners) {
          const transformed = transformPoint(transform, corner);
          extendBounds([transformed[0] + offset[0] + repeatMin[0], transformed[1] + offset[1] + repeatMin[1]]);
          extendBounds([transformed[0] + offset[0] + repeatMax[0], transformed[1] + offset[1] + repeatMax[1]]);
        }
      }
      for (const template of bundle.templates) {
        if (!Number.isSafeInteger(template.polygonCount * instanceCount)) {
          throw new Error("GDSII polygon count exceeds safe integer precision.");
        }
        const group = {
          id: `${cellId}::${template.layer}:${template.datatype}`,
          cellId,
          cellName: cell.name,
          layer: template.layer,
          datatype: template.datatype,
          layerKey: template.layerKey,
          cssColor: template.cssColor,
          count: template.polygonCount * instanceCount,
          templateId: template.id,
          transform: transform.slice(),
          offset: offset.slice(),
          ...(options.compact ? { repetitions, instanceCount } : {}),
        };
        groups.push(group);
        if (options.compact) scene.groups.push(group);
      }
      if (maxDepth != null && depth >= maxDepth) {
        if (!wasAncestor) ancestors.delete(cell.name);
        return scene;
      }
      cell.references.forEach((reference, referenceIndex) => {
        const child = cellsByName.get(reference.cellName);
        if (!child) {
          return;
        }
        const childTransform = multiplyTransforms(transform, referenceTransform(reference));
        if (options.compact) {
          const origin = transformPoint(transform, reference.origin);
          const repetition = {
            columns: reference.columns,
            rows: reference.rows,
            columnVector: transformPoint(transform, reference.columnVector),
            rowVector: transformPoint(transform, reference.rowVector),
          };
          const repeats = reference.columns * reference.rows > 1 ? [...repetitions, repetition] : repetitions;
          const childScene = walkGeometry(child, `${cellId}/${child.name}[${referenceIndex}:0]`, childTransform,
            [origin[0] + offset[0], origin[1] + offset[1]], depth + 1, repeats);
          scene.children.push({ scene: childScene, repetition });
          return;
        }
        let repetitionIndex = 0;
        for (let column = 0; column < reference.columns; column += 1) {
          for (let row = 0; row < reference.rows; row += 1) {
            const repetitionOffset = [
              reference.columnVector[0] * column + reference.rowVector[0] * row,
              reference.columnVector[1] * column + reference.rowVector[1] * row,
            ];
            const localOrigin = [
              reference.origin[0] + repetitionOffset[0],
              reference.origin[1] + repetitionOffset[1],
            ];
            const transformedOrigin = transformPoint(transform, localOrigin);
            walkGeometry(
              child,
              `${cellId}/${child.name}[${referenceIndex}:${repetitionIndex}]`,
              childTransform,
              [transformedOrigin[0] + offset[0], transformedOrigin[1] + offset[1]],
              depth + 1,
            );
            repetitionIndex += 1;
          }
        }
      });
      if (!wasAncestor) ancestors.delete(cell.name);
      return scene;
    }

    roots.forEach((cell, index) => {
      if (!rootNames.includes(cell.name)) {
        rootNames.push(cell.name);
      }
      walkTree(cell, 0);
      sceneRoots.push(walkGeometry(cell, `root:${index}`, [1, 0, 0, 1], [0, 0], 0));
    });

    const bounds = boundsMin && boundsMax
      ? {
          xmin: roundCoordinate(boundsMin[0]),
          ymin: roundCoordinate(boundsMin[1]),
          xmax: roundCoordinate(boundsMax[0]),
          ymax: roundCoordinate(boundsMax[1]),
        }
      : { xmin: -1, ymin: -1, xmax: 1, ymax: 1 };
    const nodes = Array.from(cellNodes.values()).sort((first, second) => first.name.localeCompare(second.name));
    return {
      title: options.title || "GDS Viewer",
      cellName: options.cellName != null ? roots[0].name : "GDS Library",
      bounds,
      groups,
      ...(options.compact ? { sceneRoots } : {}),
      templates: Array.from(templateInfo.entries())
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([, template]) => template),
      cellTree: { roots: rootNames, nodes },
      cells: nodes,
      layers: Array.from(layerInfo.values()).sort((first, second) =>
        first.layer - second.layer || first.datatype - second.datatype,
      ),
    };
  }

  // Expand only while consuming instances; array products never become model objects.
  function* instanceOffsets(group, index = 0, x = group.offset[0], y = group.offset[1]) {
    const repetition = group.repetitions?.[index];
    if (!repetition) {
      yield [x, y];
      return;
    }
    for (let column = 0; column < repetition.columns; column += 1) {
      for (let row = 0; row < repetition.rows; row += 1) {
        yield* instanceOffsets(group, index + 1,
          x + column * repetition.columnVector[0] + row * repetition.rowVector[0],
          y + column * repetition.columnVector[1] + row * repetition.rowVector[1]);
      }
    }
  }

  // Maintain the original painter order even when arrays contain overlapping,
  // nested cells on the same layer. Do not group expanded instances by template.
  function* sceneInstances(model, layerKey) {
    const included = new WeakMap();
    function hasGeometry(scene) {
      if (!included.has(scene)) {
        included.set(scene, scene.groups.some((group) => layerKey == null || group.layerKey === layerKey) ||
          scene.children.some((child) => hasGeometry(child.scene)));
      }
      return included.get(scene);
    }
    function* visit(scene, x, y) {
      if (!hasGeometry(scene)) return;
      for (const group of scene.groups) {
        if (layerKey == null || group.layerKey === layerKey) {
          yield { group, offset: [group.offset[0] + x, group.offset[1] + y] };
        }
      }
      for (const child of scene.children) {
        // Prune empty/off-layer subtrees before entering their repetition loops.
        if (!hasGeometry(child.scene)) continue;
        const offsets = { offset: [x, y], repetitions: [child.repetition] };
        for (const [ox, oy] of instanceOffsets(offsets)) yield* visit(child.scene, ox, oy);
      }
    }
    for (const root of model.sceneRoots) yield* visit(root, 0, 0);
  }

  return { buildGdsViewModel, parseGds, pathToPolygon, instanceOffsets, sceneInstances };
});
