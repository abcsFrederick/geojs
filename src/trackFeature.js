var inherit = require('./inherit');
var feature = require('./feature');

/**
 * Track feature specification.
 *
 * @typedef {geo.feature.spec} geo.trackFeature.spec
 * @property {geo.geoPosition|function} [position] Position of the data.
 *   Default is (data).
 * @property {float|function} [time] Time of the data.  Default is `(data).t`.
 * @property {object|function} [track] Tracks from the data.  Default is
 *   (data).  Typically, the data is an array of tracks, each of which is an
 *   array of points, each of which has a position and time.  The position and
 *   time functions are called for each point as `position(trackPoint,
 *   pointIndex, trackEntry, trackEntryIndex)`.
 * @property {float|null} [startTime=null] Start time.  Used for styling.  If
 *   `null`, this is the duration before the end time if `duration` is not
 *  `null` and the minimum time in any track if `duration` is `null`.
 * @property {float} [endTime=null] End time.  Used for styling and position of
 *   the track head.  If `null` and either of `startTime` or `duration` are
 *   `null`, this is the maximum time in any track.
 * @property {float} [duration=null] Duration between start and end times.
 *   Ignored if both start and end times are specified.
 * @property {float|function} [text] Text to use for the head of the track.  If
 *   specified, the track head is rendered as text.  If `undefined` or `null` a
 *   marker is used instead.
 * @property {geo.trackFeature.styleSpec} [style] Style object with default
 *   style options.
 * @property {geo.trackFeature.headStyleSpec} [headStyle] Style object with
 *   default style options for the track head.
 */

/**
 * Style specification for a track feature.  Extends
 * {@link geo.lineFeasture.styleSpec}.
 *
 * @typedef {geo.feature.styleSpec} geo.trackFeature.styleSpec
 * @extends geo.feature.styleSpec
 * @extends geo.lineFeature.styleSpec
 */

/**
 * Style specification for a track feature.  Extends
 * {@link geo.markerFeasture.styleSpec} and {@link geo.textFeasture.styleSpec}.
 *
 * @typedef {geo.feature.styleSpec} geo.trackFeature.styleSpec
 * @extends geo.feature.styleSpec
 * @extends geo.markerFeature.styleSpec
 * @extends geo.textFeature.styleSpec
 */

/**
 * Create a new instance of class trackFeature.
 *
 * @class
 * @alias geo.trackFeature
 * @extends geo.feature
 * @param {geo.trackFeature.spec} arg
 * @returns {geo.trackFeature}
 */
var trackFeature = function (arg) {
  'use strict';
  if (!(this instanceof trackFeature)) {
    return new trackFeature(arg);
  }

  var $ = require('jquery');
  /*
  var transform = require('./transform');
  var geo_event = require('./event');
  var lineFeature = require('./lineFeature');
  var markerFeature = require('./markerFeature');
  var textFeature = require('./textFeature');
  */

  arg = arg || {};
  feature.call(this, arg);

  /**
   * @private
   */
  var m_this = this,
      m_styles = {},
      m_tracks = {
        // user specified
        startTime: arg.startTime !== undefined ? arg.startTime : null,
        endTime: arg.endTime !== undefined ? arg.endTime : null,
        duration: arg.duration !== undefined ? arg.duration : null,
        // internal
        start: 0,
        end: 0
      },
      m_lineFeature,
      m_headLayer,
      m_markerFeature,
      m_textFeature,
      s_draw = this.draw,
      s_exit = this._exit,
      s_init = this._init,
      s_modified = this.modified,
      s_update = this._update;

  this.featureType = 'track';

  //DWM::
  this._linePosition = function (d, i, l, j) {
    var trackIdx = Math.floor(j / 3),
        segment = j % 3,
        time = m_tracks.timeFunc(d, i, l, trackIdx);
    if ((!segment && time >= m_tracks.start) ||
        (segment === 1 && time < m_tracks.start)) {
      return m_tracks.startPosition[trackIdx];
    }
    if ((segment === 1 && time > m_tracks.end) ||
        (segment === 2 && time < m_tracks.end)) {
      return m_tracks.endPosition[trackIdx];
    }
    return m_tracks.positionFunc(d, i, l, trackIdx);
  };

  //DWM::
  this._updateTimeRange = function () {
    if (m_tracks.endTime !== null || (m_tracks.endTime === null && (m_tracks.startTime === null || m_tracks.duration == null))) {
      m_tracks.end = m_tracks.endTime !== null ? m_tracks.endTime : m_tracks.timeExtents.end;
      if (m_tracks.startTime !== null) {
        m_tracks.start = m_tracks.startTime;
      } else if (m_tracks.duration !== null) {
        m_tracks.start = m_tracks.end - m_tracks.duration;
      } else {
        m_tracks.start = m_tracks.timeExtents.start;
      }
    } else {
      m_tracks.start = m_tracks.startTime;
      m_tracks.end = m_tracks.start + m_tracks.duration;
    }
  };

  //DWM::
  this._calculateTimePosition = function (time) {
    var data = m_this.data();
    return data.map((d, i) => {
      var track = m_tracks.trackFunc(d, i);
      if (!track.length) {
        return null;
      }
      var lowidx = 0, lowt, highidx = track.length - 1, hight, testidx, testt;
      if (track.length === 1) {
        return m_tracks.positionFunc(track[lowidx], lowidx, d, i);
      }
      lowt = m_tracks.timeFunc(track[lowidx], lowidx, d, i);
      if (lowt >= time) {
        return m_tracks.positionFunc(track[lowidx], lowidx, d, i);
      }
      hight = m_tracks.timeFunc(track[highidx], highidx, d, i);
      if (hight <= time) {
        return m_tracks.positionFunc(track[highidx], highidx, d, i);
      }
      while (highidx - lowidx > 1) {
        testidx = Math.floor(highidx + lowidx) / 2;
        testt = m_tracks.timeFunc(track[lowidx], lowidx, d, i);
        if (testt === time) {
          return m_tracks.positionFunc(track[testidx], testidx, d, i);
        }
        if (testt < time) {
          lowt = testt;
          lowidx = testidx;
        } else {
          hight = testt;
          highidx = testidx;
        }
      }
      var lowpos = m_tracks.positionFunc(track[lowidx], lowidx, d, i);
      var highpos = m_tracks.positionFunc(track[highidx], highidx, d, i);
      var fh = (time - lowt) / (hight - lowt), fl = 1 - fh;
      return {
        x: lowpos.x * fl + highpos.x * fh,
        y: lowpos.y * fl + highpos.y * fh,
        z: (lowpos.z || 0) * fl + (highpos.z || 0) * fh
      };
    });
  };

  /**
   * Build.  Generate the tracks.  Create sub-features if necessary and
   * update it.
   *
   * @returns {this}
   */
  this._build = function () {
    if (!m_lineFeature) {
      m_lineFeature = m_this.layer().createFeature('line', {
        gcs: m_this.gcs(),
        line: (d, i) => {
          return m_tracks.trackFunc(d, Math.floor(i / 3));
        }
      });
      m_this.dependentFeatures([m_lineFeature]);
    }
    var data = m_this.data();
    m_tracks.lines = {length: data.length * 3};
    m_tracks.trackFunc = m_this.style.get('track');
    m_tracks.timeFunc = m_this.style.get('time');
    m_tracks.positionFunc = m_this.style.get('position');
    m_lineFeature
      .gcs(m_this.gcs())
      .data(m_tracks.lines)
      .style(m_this.style())
      .position(m_this._linePosition);
    var timeExtents = {};
    data.forEach((d, i) => {
      var track = m_tracks.trackFunc(d, i);
      var time;
      if (track.length) {
        time = m_tracks.timeFunc(track[0], 0, d, i);
        if (timeExtents.start === undefined || time < timeExtents.start) {
          timeExtents.start = time;
        }
        if (track.length > 1) {
          time = m_tracks.timeFunc(track[track.length - 1], track.length - 1, d, i);
        }
        if (timeExtents.end === undefined || time < timeExtents.end) {
          timeExtents.end = time;
        }
      }
    });
    m_tracks.timeExtents = timeExtents;
    m_this._updateTimeRange();
    m_tracks.startPosition = m_this._calculateTimePosition(m_this.start);
    m_tracks.endPosition = m_this._calculateTimePosition(m_this.end);

    // create markers or text
    /* //DWM::
    m_tracks = m_this._createTracks();
    if (m_tracks && m_tracks.lines && m_tracks.lines.length) {
      if (!m_lineFeature) {
        m_lineFeature = m_this.layer().createFeature('line', {
          selectionAPI: false,
          gcs: m_this.gcs(),
          visible: m_this.visible(undefined, true),
          style: {
            closed: function (d) { return d.closed; }
          }
        });
        m_this.dependentFeatures([m_lineFeature]);
      }
      var style = m_this.style();
      m_lineFeature.data(m_tracks.lines).style({
        antialiasing: style.antialiasing,
        lineCap: style.lineCap,
        lineJoin: style.lineJoin,
        miterLimit: style.miterLimit,
        strokeWidth: style.strokeWidth,
        strokeStyle: style.strokeStyle,
        strokeColor: style.strokeColor,
        strokeOffset: style.strokeOffset,
        strokeOpacity: style.strokeOpacity
      });
      if (m_tracks.hasLabels) {
        if (!m_labelFeature) {
          if (!(registry.registries.features[m_this.layer().rendererName()] || {}).text) {
            var renderer = registry.rendererForFeatures(['text']);
            m_labelLayer = registry.createLayer('feature', m_this.layer().map(), {renderer: renderer});
            m_this.layer().addChild(m_labelLayer);
            m_this.layer().node().append(m_labelLayer.node());
          }
          m_labelFeature = (m_labelLayer || m_this.layer()).createFeature('text', {
            selectionAPI: false,
            gcs: m_this.gcs(),
            visible: m_this.visible(undefined, true),
            style: {
              text: function (d) { return d.line.label; }
            }
          }).geoOn(geo_event.pan, m_this._updateLabelPositions);
        }
        textFeature.usedStyles.forEach(function (styleName) {
          if (styleName !== 'visible') {
            m_labelFeature.style(styleName, style[styleName]);
          }
        });
        m_this.dependentFeatures([m_lineFeature, m_labelFeature]);
      }
    } else if (m_lineFeature) {
      m_lineFeature.data([]);
    }
    m_this.buildTime().modified();
     * Update label positions after setting the build time.  The labelPositions
     * method will build if necessary, and this prevents it from looping. *
    m_this.labelPositions();
    */
    return m_this;
  };

  /**
   * Update.  Rebuild if necessary.
   *
   * @returns {this}
   */
  this._update = function () {
    s_update.call(m_this);

    if (m_this.dataTime().timestamp() >= m_this.buildTime().timestamp() ||
        m_this.updateTime().timestamp() <= m_this.timestamp()) {
      m_this._build();
    }
    m_this.updateTime().modified();
    return m_this;
  };

  /**
   * Redraw the object.
   *
   * @returns {object} The results of the superclass draw function.
   */
  this.draw = function () {
    var result = s_draw();
    if (m_lineFeature) {
      m_lineFeature.draw();
    }
    if (m_markerFeature) {
      m_markerFeature.draw();
    }
    if (m_textFeature) {
      m_textFeature.draw();
    }
    return result;
  };

  /**
   * Update the timestamp to the next global timestamp value.  Mark
   * sub-features as modified, too.
   *
   * @returns {object} The results of the superclass modified function.
   */
  this.modified = function () {
    var result = s_modified();
    if (m_lineFeature) {
      m_lineFeature.modified();
    }
    if (m_markerFeature) {
      m_markerFeature.modified();
    }
    if (m_textFeature) {
      m_textFeature.modified();
    }
    return result;
  };

  /**
   * Set or get style.
   *
   * @param {string|object} [arg1] If `undefined`, return the current style
   *    object.  If a string and `arg2` is undefined, return the style
   *    associated with the specified key.  If a string and `arg2` is defined,
   *    set the named style to the specified value.  Otherwise, extend the
   *    current style with the values in the specified object.
   * @param {*} [arg2] If `arg1` is a string, the new value for that style.
   * @param {string} [styleType='style'] The name of the style type, such as
   *    `createStyle`, `editStyle`, `editHandleStyle`, `labelStyle`, or
   *    `highlightStyle`.
   * @returns {object|this} Either the entire style object, the value of a
   *    specific style, or the current class instance.
   */
  this.style = function (arg1, arg2, styleType) {
    styleType = styleType || 'style';
    if (arg1 === undefined) {
      return m_styles[styleType];
    }
    if (typeof arg1 === 'string' && arg2 === undefined) {
      return (m_styles[styleType] || {})[arg1];
    }
    if (m_styles[styleType] === undefined) {
      m_styles[styleType] = {};
    }
    if (arg2 === undefined) {
      m_styles[styleType] = $.extend(true, m_styles[styleType], arg1);
    } else {
      m_styles[styleType][arg1] = arg2;
    }
    m_this.modified();
    return m_this;
  };

  /**
   * Calls {@link geo.annotation#style} with `styleType='headStyle'`.
   * @function createStyle
   * @memberof geo.trackFeature
   * @instance
   */
  ['headStyle'].forEach(function (styleType) {
    m_this[styleType] = function (arg1, arg2) {
      return m_this.style(arg1, arg2, styleType);
    };
  });

  /**
   * Get/set track accessor.
   *
   * @param {object|function} [val] If not specified, return the current track
   *    accessor.  If specified, use this for the track accessor and return
   *    `this`.  If a function is given, the function is passed `(dataElement,
   *    dataIndex)` and returns an array of vertex elements.
   * @returns {object|function|this} The current track accessor or this feature.
   */
  this.track = function (val) {
    if (val === undefined) {
      return m_this.style('track');
    } else {
      m_this.style('track', val);
      m_this.dataTime().modified();
      m_this.modified();
    }
    return m_this;
  };

  /**
   * Get/Set position accessor.
   *
   * @param {geo.geoPosition|function} [val] If not specified, return the
   *    current position accessor.  If specified, use this for the position
   *    accessor and return `this`.  If a function is given, this is called
   *    with `(vertexElement, vertexIndex, dataElement, dataIndex)`.
   * @returns {geo.geoPosition|function|this} The current position or this
   *    feature.
   */
  this.position = function (val) {
    if (val === undefined) {
      return m_this.style('position');
    } else {
      m_this.style('position', val);
      m_this.dataTime().modified();
      m_this.modified();
    }
    return m_this;
  };

  /**
   * Get/Set time accessor.
   *
   * @param {float} [val] If not specified, return the current time accessor.
   *    If specified, use this for the time accessor and return `this`.  If a
   *    function is given, this is called with `(vertexElement, vertexIndex,
   *    dataElement, dataIndex)`.
   * @returns {float|function|this} The current time or this feature.
   */
  this.time = function (val) {
    if (val === undefined) {
      return m_this.style('time');
    } else {
      m_this.style('time', val);
      m_this.dataTime().modified();
      m_this.modified();
    }
    return m_this;
  };

  // TODO: startTime, endTime, duration  or  timeRange

  /**
   * Destroy.
   */
  this._exit = function () {
    if (m_markerFeature || m_textFeature) {
      if (m_headLayer || m_this.layer()) {
        if (m_markerFeature) {
          (m_headLayer || m_this.layer()).deleteFeature(m_markerFeature);
        }
        if (m_textFeature) {
          (m_headLayer || m_this.layer()).deleteFeature(m_textFeature);
        }
      }
      if (m_headLayer && m_this.layer()) {
        m_this.layer().removeChild(m_headLayer);
      }
    }
    if (m_lineFeature && m_this.layer()) {
      m_this.layer().deleteFeature(m_lineFeature);
    }
    m_markerFeature = null;
    m_textFeature = null;
    m_headLayer = null;
    m_lineFeature = null;
    m_this.dependentFeatures([]);

    s_exit();
  };

  /**
   * Initialize.
   *
   * @param {geo.trackFeature.spec} arg The track feature specification.
   */
  this._init = function (arg) {
    arg = arg || {};
    s_init.call(m_this, arg);

    var style = $.extend(
      true,
      {},
      {
        track: (d) => d,
        position: (d) => d,
        time: (d) => d.t
      },
      arg.style === undefined ? {} : arg.style
    );
    var headStyle = $.extend(
      true,
      {},
      {
        // defaults go here
      },
      arg.headStyle === undefined ? {} : arg.headStyle
    );
    ['track', 'position', 'time'].forEach((key) => {
      if (arg[key] !== undefined) {
        style[key] = arg[key];
      }
    });

    m_this.style(style);
    m_this.headStyle(headStyle);
  };

  return this;
};

inherit(trackFeature, feature);
module.exports = trackFeature;
