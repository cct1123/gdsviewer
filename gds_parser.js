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

    function int16s(start, end) {
      const values = [];
      for (let position = start; position + 1 < end; position += 2) {
        values.push(view.getInt16(position));
      }
      return values;
    }

    function int32s(start, end) {
      const values = [];
      for (let position = start; position + 3 < end; position += 4) {
        values.push(view.getInt32(position));
      }
      return values;
    }

    function coordinates(start, end) {
      const values = int32s(start, end);
      const points = [];
      for (let index = 0; index + 1 < values.length; index += 2) {
        points.push([values[index] * coordinateScale, values[index + 1] * coordinateScale]);
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
        const points = element.points.slice();
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

      switch (recordType) {
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
            element.layer = int16s(dataStart, end)[0] || 0;
          }
          break;
        case RECORD.DATATYPE:
        case RECORD.TEXTTYPE:
        case RECORD.BOXTYPE:
          if (element) {
            element.datatype = int16s(dataStart, end)[0] || 0;
          }
          break;
        case RECORD.WIDTH:
          if (element) {
            element.width = (int32s(dataStart, end)[0] || 0) * coordinateScale;
          }
          break;
        case RECORD.PATHTYPE:
          if (element) {
            element.pathType = int16s(dataStart, end)[0] || 0;
          }
          break;
        case RECORD.BGNEXTN:
          if (element) {
            element.beginExtension = (int32s(dataStart, end)[0] || 0) * coordinateScale;
          }
          break;
        case RECORD.ENDEXTN:
          if (element) {
            element.endExtension = (int32s(dataStart, end)[0] || 0) * coordinateScale;
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
            const values = int16s(dataStart, end);
            element.columns = values[0] || 1;
            element.rows = values[1] || 1;
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
    }

    if (currentCell || element) {
      throw new Error("GDSII input ended before the current structure or element was closed.");
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
    return Math.round((value + Number.EPSILON) * 1000) / 1000;
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
    const cellNodes = new Map();
    const visitedCellNames = new Set();
    const rootNames = [];
    const groups = [];
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
        template.polygons.push({ polygon: polygon.points.flatMap((point) => point.map(roundCoordinate)) });
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
      if (visitedCellNames.has(cell.name)) {
        return;
      }
      visitedCellNames.add(cell.name);
      if (maxDepth != null && depth >= maxDepth) {
        return;
      }
      const seen = new Set();
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

    function walkGeometry(cell, cellId, transform, offset, depth) {
      const bundle = cellTemplates(cell);
      if (bundle.boundsMin && bundle.boundsMax) {
        const corners = [
          [bundle.boundsMin[0], bundle.boundsMin[1]],
          [bundle.boundsMin[0], bundle.boundsMax[1]],
          [bundle.boundsMax[0], bundle.boundsMin[1]],
          [bundle.boundsMax[0], bundle.boundsMax[1]],
        ];
        for (const corner of corners) {
          const transformed = transformPoint(transform, corner);
          extendBounds([transformed[0] + offset[0], transformed[1] + offset[1]]);
        }
      }
      for (const template of bundle.templates) {
        groups.push({
          id: `${cellId}::${template.layer}:${template.datatype}`,
          cellId,
          cellName: cell.name,
          layer: template.layer,
          datatype: template.datatype,
          layerKey: template.layerKey,
          cssColor: template.cssColor,
          count: template.polygonCount,
          templateId: template.id,
          transform: transform.slice(),
          offset: offset.slice(),
        });
      }
      if (maxDepth != null && depth >= maxDepth) {
        return;
      }
      cell.references.forEach((reference, referenceIndex) => {
        const child = cellsByName.get(reference.cellName);
        if (!child) {
          return;
        }
        const childTransform = multiplyTransforms(transform, referenceTransform(reference));
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
    }

    roots.forEach((cell, index) => {
      if (!rootNames.includes(cell.name)) {
        rootNames.push(cell.name);
      }
      walkTree(cell, 0);
      walkGeometry(cell, `root:${index}`, [1, 0, 0, 1], [0, 0], 0);
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

  return { buildGdsViewModel, parseGds, pathToPolygon };
});
