//////////////////////////////////////////////////////////////////////////////
/**
 * @module geo
 */

/*jslint devel: true, forin: true, newcap: true, plusplus: true*/
/*jslint white: true, indent: 2*/

/*global geo, ogs, inherit, document$*/
//////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////
/**
 * Create a new instance of class feature
 *
 * @class
 * @returns {geo.feature}
 */
//////////////////////////////////////////////////////////////////////////////
geo.feature = function(arg) {
  "use strict";
  if (!(this instanceof geo.feature)) {
    return new geo.feature(arg);
  }
  geo.object.call(this);

  ////////////////////////////////////////////////////////////////////////////
  /**
   * @private
   */
  ////////////////////////////////////////////////////////////////////////////
  arg = arg || {};

  var m_style = {},
      m_gcs = arg.gcs === undefined ? "EPSG:4326" : arg.gcs,
      m_renderer = null,
      m_dataTime = vgl.timestamp(),
      m_updateTime = vgl.timestamp();

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Get/Set style used by the feature
   */
  ////////////////////////////////////////////////////////////////////////////
  this.style = function(val) {
    if (val === undefined ) {
      return m_style;
    } else {
      m_style = $.extend({}, m_style, val);
      this.modified();
      return this;
    }
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Get/Set renderer used by the feature
   */
  ////////////////////////////////////////////////////////////////////////////
  this.renderer = function(val) {
    if (val === undefined ) {
      return m_renderer;
    } else {
      m_renderer = val
      this.modified();
      return this;
    }
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Get/Set projection of the feature
   */
  ////////////////////////////////////////////////////////////////////////////
  this.gcs = function(val) {
    if (val === undefined ) {
      return m_gcs;
    } else {
      m_gcs = val;
      this.modified();
      return this;
    }
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Get/Set timestamp of data change
   */
  ////////////////////////////////////////////////////////////////////////////
  this.dataTime = function(val) {
    if (val === undefined ) {
      return m_dataTime;
    } else {
      m_dataTime = val;
      this.modified();
      return this;
    }
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Get/Set timestamp of last time update happened
   */
  ////////////////////////////////////////////////////////////////////////////
  this.updateTime = function(val) {
    if (val === undefined ) {
      return m_updateTime;
    } else {
      m_updateTime = val;
      this.modified();
      return this;
    }
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Initialize
   *
   * Derived class should implement this
   */
  ////////////////////////////////////////////////////////////////////////////
  this._init = function(arg) {
    m_style = $.extend({},
                {"opacity": 1.0}, arg.style === undefined ? {} :
                arg.style);
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Build
   *
   * Derived class should implement this
   */
  ////////////////////////////////////////////////////////////////////////////
  this._build = function() {
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Update
   *
   * Derived class should implement this
   */
  ////////////////////////////////////////////////////////////////////////////
  this._update = function() {
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Destroy
   *
   * Derived class should implement this
   */
  ////////////////////////////////////////////////////////////////////////////
  this._exit = function() {
  };

  this._init(arg);
  return this;
};

inherit(geo.feature, geo.object);
