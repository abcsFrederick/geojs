var inherit = require('./inherit');
var feature = require('./feature');
var pointFeature = require('./pointFeature');

/**
 * Object specification for a marker feature.
 *
 * @typedef {geo.feature.spec} geo.markerFeature.spec
 * @property {geo.geoPosition|function} [position] Position of the data.
 *   Default is (data).
 * @property {geo.markerFeature.styleSpec} [style] Style object with default
 *   style options.
 */

/**
 * Style specification for a marker feature.
 *
 * @typedef {geo.feature.styleSpec} geo.markerFeature.styleSpec
 * @extends geo.feature.styleSpec
 * @property {number|function} [radius=5] Radius of each marker in pixels.
 *   This includes the stroke width and the fill.
 * @property {geo.geoColor|function} [strokeColor] Color to stroke each marker.
 * @property {number|function} [strokeOpacity=1] Opacity for each marker's
 *   stroke.  Opacity is on a [0-1] scale.  Set this or `strokeWidth` to zero
 *   to not have a stroke.
 * @property {number|function} [strokeWidth=1.25] The weight of the marker's
 *   stroke in pixels.  Set this or `strokeOpacity` to zero to not have a
 *   stroke.
 * @property {geo.geoColor|function} [fillColor] Color to fill each marker.
 * @property {number|function} [fillOpacity=1] Opacity for each marker.  Opacity
 *   is on a [0-1] scale.  Set to zero to have no fill.
 * @property {number|function} [symbol=0] One of the predefined symbol numbers.
 * @property {number|function} [symbolValue=0] A value the affects the
 *   appearance of the symbol.
 * @property {number|function} [rotation=0] The rotation of the symbol in
 *   clockwise radians.
 * @property {geo.markerFeature.scaleMode|function} [scaleWithZoom='none'] This
 *   determines if the fill, stroke, or both scale with zoom.  If set, the
 *   values for radius and strokeWidth are the values at zoom-level zero.
 * @property {boolean|function} [rotateWithMap=false] If truthy, rotate symbols
 *   with the map.  If falsy, symbol orientation is absolute.
 * @property {number[]|function} [origin] Origin in map gcs coordinates used
 *   for to ensure high precision drawing in this location.  When called as a
 *   function, this is passed the maker positions as a single continuous array
 *   in map gcs coordinates.  It defaults to the first marker's position.
 */

/**
 * Create a new instance of class markerFeature.
 *
 * @class
 * @alias geo.markerFeature
 * @extends geo.feature
 * @param {geo.markerFeature.spec} arg
 * @returns {geo.markerFeature}
 */
var markerFeature = function (arg) {
  'use strict';
  if (!(this instanceof markerFeature)) {
    return new markerFeature(arg);
  }
  arg = arg || {};
  pointFeature.call(this, arg);

  var $ = require('jquery');
  var timestamp = require('./timestamp');
  var util = require('./util');
  var KDBush = require('kdbush');

  /**
   * @private
   */
  var m_this = this,
      s_init = this._init,
      m_rangeTree = null,
      m_rangeTreeTime = timestamp(),
      m_maxFixedRadius = 0,
      m_maxZoomRadius = 0,
      m_maxZoomStroke = 0;

  this.featureType = 'marker';

  /**
   * Update the current range tree object.  Should be called whenever the
   * data changes.
   */
  this._updateRangeTree = function () {
    if (m_rangeTreeTime.timestamp() >= m_this.dataTime().timestamp() && m_rangeTreeTime.timestamp() >= m_this.timestamp()) {
      return;
    }
    var pts, position,
        radius = m_this.style.get('radius'),
        strokeWidth = m_this.style.get('strokeWidth'),
        scaleWithZoom = m_this.style.get('scaleWithZoom');

    position = m_this.position();

    m_maxFixedRadius = 0;
    m_maxZoomRadius = 0;
    m_maxZoomStroke = 0;

    // create an array of positions in geo coordinates
    pts = m_this.data().map(function (d, i) {
      var pt = position(d, i);

      let r = radius(d, i), s = strokeWidth(d, i);
      switch (scaleWithZoom(d, i)) {
        case markerFeature.scaleMode.stroke:
          if (r - s > m_maxFixedRadius) {
            m_maxFixedRadius = r - s;
          }
          if (s > m_maxZoomStroke) {
            m_maxZoomStroke = s;
          }
          break;
        case markerFeature.scaleMode.fill:
        case markerFeature.scaleMode.all:
          if (r > m_maxZoomRadius) {
            m_maxZoomRadius = r;
          }
          break;
        default:
          if (r > m_maxFixedRadius) {
            m_maxFixedRadius = r;
          }
          break;
      }
      return [pt.x, pt.y];
    });

    m_rangeTree = new KDBush(pts);
    m_rangeTreeTime.modified();
  };

  /**
   * Returns an array of datum indices that contain the given marker.
   *
   * @param {geo.geoPosition} p marker to search for in map interface gcs.
   * @returns {object} An object with `index`: a list of marker indices, and
   *    `found`: a list of markers that contain the specified coordinate.
   */
  this.pointSearch = function (p) {
    var min, max, data, idx = [], found = [], ifound = [],
        fgcs = m_this.gcs(), // this feature's gcs
        corners,
        radius = m_this.style.get('radius'),
        strokeWidth = m_this.style.get('strokeWidth'),
        scaleWithZoom = m_this.style.get('scaleWithZoom');

    data = m_this.data();
    if (!data || !data.length) {
      return {
        found: [],
        index: []
      };
    }

    // We need to do this before we find corners, since the max radius is
    // determined then
    m_this._updateRangeTree();

    var map = m_this.layer().map(),
        pt = map.gcsToDisplay(p),
        zoom = map.zoom(),
        zfactor = Math.pow(2, zoom),
        maxr = Math.max(m_maxFixedRadius + m_maxZoomStroke * zfactor, m_maxZoomRadius * zfactor);

    // check all corners to make sure we handle rotations
    corners = [
      map.displayToGcs({x: pt.x - maxr, y: pt.y - maxr}, fgcs),
      map.displayToGcs({x: pt.x + maxr, y: pt.y - maxr}, fgcs),
      map.displayToGcs({x: pt.x - maxr, y: pt.y + maxr}, fgcs),
      map.displayToGcs({x: pt.x + maxr, y: pt.y + maxr}, fgcs)
    ];
    min = {
      x: Math.min(corners[0].x, corners[1].x, corners[2].x, corners[3].x),
      y: Math.min(corners[0].y, corners[1].y, corners[2].y, corners[3].y)
    };
    max = {
      x: Math.max(corners[0].x, corners[1].x, corners[2].x, corners[3].x),
      y: Math.max(corners[0].y, corners[1].y, corners[2].y, corners[3].y)
    };

    // Find markers inside the bounding box
    idx = m_rangeTree.range(min.x, min.y, max.x, max.y);

    idx.sort((a, b) => a - b);
    // Filter by circular region
    idx.forEach(function (i) {
      var d = data[i],
          rad = radius(data[i], i),
          swz = scaleWithZoom(data[i], i),
          s = swz ? strokeWidth(data[i], i) : 0;
      var p = m_this.position()(d, i),
          dx, dy, rad2;
      switch (swz) {
        case markerFeature.scaleMode.fill:
          rad = (rad - s) * zfactor + s;
          break;
        case markerFeature.scaleMode.stroke:
          rad = (rad - s) + s * zfactor;
          break;
        case markerFeature.scaleMode.all:
          rad *= zfactor;
          break;
      }

      if (rad) {
        rad2 = rad * rad;
        p = map.gcsToDisplay(p, fgcs);
        dx = p.x - pt.x;
        dy = p.y - pt.y;
        if (dx * dx + dy * dy <= rad2) {
          found.push(d);
          ifound.push(i);
        }
      }
    });

    return {
      found: found,
      index: ifound
    };
  };

  /**
   * Returns an array of datum indices that are contained in the given polygon.
   * This does not take clustering into account.
   *
   * @param {geo.polygonObject} poly A polygon as an array of coordinates or an
   *    object with `outer` and optionally `inner` parameters.  All coordinates
   *    are in map interface gcs.
   * @param {object} [opts] Additional search options.
   * @param {boolean} [opts.partial=false] If truthy, include markers that are
   *    partially in the polygon, otherwise only include markers that are fully
   *    within the region.  If 'center', only markers whose centers are inside
   *    the polygon are returned.
   * @returns {object} An object with `index`: a list of marker indices,
   *    `found`: a list of markers within the polygon, and `extra`: an object
   *    with index keys containing an object with a `partial` key and a boolean
   *    value to indicate if the marker is on the polygon's border and a
   *    `distance` key to indicate how far within the polygon the marker is
   *    located.
   */
  this.polygonSearch = function (poly, opts) {
    var fgcs = m_this.gcs(), // this feature's gcs
        found = [],
        ifound = [],
        extra = {},
        map = m_this.layer().map(),
        data = m_this.data(),
        radius = m_this.style.get('radius'),
        strokeWidth = m_this.style.get('strokeWidth'),
        scaleWithZoom = m_this.style.get('scaleWithZoom'),
        idx, min, max, corners,
        zoom = map.zoom(),
        zfactor = Math.pow(2, zoom),
        maxr = Math.max(m_maxFixedRadius + m_maxZoomStroke * zfactor, m_maxZoomRadius * zfactor);

    if (!poly.outer) {
      poly = {outer: poly, inner: []};
    }
    if (poly.outer.length < 3 || !data || !data.length) {
      return {
        found: [],
        index: [],
        extra: {}
      };
    }
    opts = opts || {};
    opts.partial = opts.partial || false;
    poly = {outer: map.gcsToDisplay(poly.outer), inner: (poly.inner || []).map(inner => map.gcsToDisplay(inner))};
    poly.outer.forEach(p => {
      if (!min) {
        min = {x: p.x, y: p.y};
        max = {x: p.x, y: p.y};
      }
      if (p.x < min.x) { min.x = p.x; }
      if (p.x > max.x) { max.x = p.x; }
      if (p.y < min.y) { min.y = p.y; }
      if (p.y > max.y) { max.y = p.y; }
    });
    // We need to do this before we find corners, since the max radius is
    // determined then
    m_this._updateRangeTree();
    corners = [
      map.displayToGcs({x: min.x - maxr, y: min.y - maxr}, fgcs),
      map.displayToGcs({x: max.x + maxr, y: min.y - maxr}, fgcs),
      map.displayToGcs({x: max.x + maxr, y: max.y + maxr}, fgcs),
      map.displayToGcs({x: min.x - maxr, y: max.y + maxr}, fgcs)
    ];
    min = {
      x: Math.min(corners[0].x, corners[1].x, corners[2].x, corners[3].x),
      y: Math.min(corners[0].y, corners[1].y, corners[2].y, corners[3].y)
    };
    max = {
      x: Math.max(corners[0].x, corners[1].x, corners[2].x, corners[3].x),
      y: Math.max(corners[0].y, corners[1].y, corners[2].y, corners[3].y)
    };
    // Find markers inside the bounding box.  Only these could be in the polygon
    idx = m_rangeTree.range(min.x, min.y, max.x, max.y);
    // sort by index
    idx.sort((a, b) => a - b);
    // filter markers within the polygon
    idx.forEach(function (i) {
      var d = data[i];
      let p = m_this.position()(d, i);
      let rad = radius(data[i], i),
          swz = scaleWithZoom(data[i], i),
          s = swz ? strokeWidth(data[i], i) : 0;
      switch (swz) {
        case markerFeature.scaleMode.fill:
          rad = (rad - s) * zfactor + s;
          break;
        case markerFeature.scaleMode.stroke:
          rad = (rad - s) + s * zfactor;
          break;
        case markerFeature.scaleMode.all:
          rad *= zfactor;
          break;
      }
      if (rad) {
        p = map.gcsToDisplay(p, fgcs);
        let dist = util.distanceToPolygon2d(p, poly);
        if (dist >= rad || (dist >= 0 && opts.partial === 'center') || (dist >= -rad && opts.partial && opts.partial !== 'center')) {
          found.push(d);
          ifound.push(i);
          extra[i] = {partial: dist < rad, distance: dist};
        }
      }
    });
    return {
      found: found,
      index: ifound,
      extra: extra
    };
  };

  /**
   * Initialize.
   *
   * @param {geo.markerFeature.spec} arg The feature specification.
   * @returns {this}
   */
  this._init = function (arg) {
    arg = $.extend(
      true,
      {},
      {
        style: $.extend(
          {},
          {
            radius: 5.0,
            strokeColor: { r: 0.851, g: 0.604, b: 0.0 },
            strokeOpacity: 1.0,
            strokeWidth: 1.25,
            fillColor: { r: 1.0, g: 0.839, b: 0.439 },
            fillOpacity: 0.8,
            symbol: 0,
            symbolValue: 0,
            rotation: 0,
            scaleWithZoom: markerFeature.scaleMode.none,
            rotateWithMap: false
            // position and origin are the same as the pointFeature
          },
          arg && arg.style === undefined ? {} : arg.style
        )
      },
      arg
    );
    s_init.call(m_this, arg);
    return m_this;
  };

  return m_this;
};

/**
 * Create a markerFeature from an object.
 * @see {@link geo.feature.create}
 * @param {geo.layer} layer The layer to add the feature to
 * @param {geo.markerFeature.spec} spec The object specification
 * @returns {geo.markerFeature|null}
 */
markerFeature.create = function (layer, spec) {
  'use strict';

  spec = spec || {};
  spec.type = 'marker';
  return feature.create(layer, spec);
};

markerFeature.capabilities = {
  /* core feature name -- support in any manner */
  feature: 'marker'
};

markerFeature.primitiveShapes = pointFeature.primitiveShapes;

/**
 * Marker symbols
 * @enum
 */
markerFeature.symbols = {
  // for circle (alias ellipse), the symbolValue is the ratio of the minor to
  // major axes
  circle: 0,
  ellipse: 0,
  // for triangle, the symbolValue is the ratio of the base to the other sides
  triangle: 1,
  // for square (alias rectangle), the symbolValue is the ratio of the minor to
  // major axes
  square: 2,
  rectangle: 2,
  // for ovals, the symbolValue is the ratio of the minor to major axes
  oval: 3,
  // for drops, the symbol value is the ratio of the arc to the main radius
  drop: 4,
  // for crosses, the symbolValue is the width of the arm compared to the
  // length of the cross
  crossBase: 5,
  crossMax: 16,
  flowerBase: 20,
  flowerMax: 16,
  diamond: 35,
  starBase: 35,
  starMax: 16,
  jackBase: 50,
  jackMax: 16,
  dropBase: 65,
  dropMax: 16,
  length: 80
  // possible other symbols:
  // half inner stellations (bowtie/hourglass), hash (#), inner curved shapes
};
['cross', 'flower', 'star', 'jack', 'drop'].forEach(key => {
  for (let i = 2; i <= markerFeature.symbols[key + 'Max']; i += 1) {
    markerFeature.symbols[key + i] = markerFeature.symbols[key + 'Base'] - 2 + i;
  }
});

/**
 * Marker scale modes
 * @enum
 */
markerFeature.scaleMode = {
  none: 0,
  fill: 1,
  stroke: 2,
  all: 3
};

inherit(markerFeature, pointFeature);
module.exports = markerFeature;
