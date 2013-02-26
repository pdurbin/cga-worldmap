/**
 * Copyright (c) 2009-2010 The Open Planning Project
 *
 * @requires GeoExplorer.js
 */

/** api: (define)
 *  module = GeoExplorer
 *  class = Embed
 *  base_link = GeoExplorer
 */
Ext.namespace("gxp");

/** api: constructor
 *  ..class:: GeoExplorer.Viewer(config)
 *
 *  Create a GeoExplorer application suitable for embedding in larger pages.
 */
GeoExplorer.ViewerMobile = Ext.extend(GeoExplorer, {
    
    /** api: config[useCapabilities]
     *  ``Boolean`` If set to false, no Capabilities document will be loaded.
     */
    
    /** api: config[useToolbar]
     *  ``Boolean`` If set to false, no top toolbar will be rendered.
     */

	
    initMapPanel: function() {
        this.mapItems = [];

        OpenLayers.IMAGE_RELOAD_ATTEMPTS = 5;
        OpenLayers.Util.onImageLoadErrorColor = "transparent";

        GeoExplorer.superclass.initMapPanel.apply(this, arguments);

        var incrementLayerStats = function(layer) {
            Ext.Ajax.request({
                url: "/data/layerstats/",
                method: "POST",
                params: {layername:layer.params.LAYERS}
            });
        }
        this.mapPlugins = [{
            ptype: "gxp_loadingindicator",
            onlyShowOnFirstLoad: true
        }];

        this.mapPanel.map.events.register("preaddlayer", this, function(e) {
            var layer = e.layer;
            if (layer instanceof OpenLayers.Layer.WMS) {
                layer.events.on({
                    "loadend": function() {
                        incrementLayerStats(layer);
                        layer.events.unregister("loadend", this, arguments.callee);
                    },
                    scope: this
                });
            }
        });

    },	
	
	
    loadConfig: function(config) {
        var source;
        for (var s in config.sources) {
            source = config.sources[s];
            if (!source.ptype || /wmsc?source/.test(source.ptype)) {
                source.forceLazy = config.useCapabilities === false;
            }
            if (config.useToolbar === false) {
                var remove = true, layer;
                for (var i=config.map.layers.length-1; i>=0; --i) {
                    layer = config.map.layers[i];
                    if (layer.source == s) {
                        if (layer.visibility === false) {
                            config.map.layers.remove(layer);
                        } else {
                            remove = false;
                        }
                    }
                }
                if (remove) {
                    delete config.sources[s];
                }
            }
        }
        if (config.useToolbar !== false) {
            config.tools = (config.tools || []).concat({
                ptype: "gxp_styler",
                id: "styler",
                rasterStyling: true,
                actionTarget: undefined
            });
        }
        // load the super's super, because we don't want the default tools from
        // GeoExplorer
        GeoExplorer.superclass.loadConfig.apply(this, arguments);
    },

    /** private: method[initPortal]
     * Create the various parts that compose the layout.
     */
    initPortal: function() {

        // TODO: make a proper component out of this
        if (this.useMapOverlay !== false) {
            this.mapPanel.add(this.createMapOverlay());
        }

        if(this.useToolbar !== false) {
            this.toolbar = new Ext.Toolbar({
                xtype: "toolbar",
                region: "north",
                autoHeight: false,
                height: '50px',
                disabled: true,
                items: this.createTools()
            });
            this.on("ready", function() {this.toolbar.enable();}, this);
        }

        this.mapPanelContainer = new Ext.Panel({
            layout: "card",
            region: "center",
            ref: "../main",
            tbar: this.toolbar,
            defaults: {
                border: false
            },
            items: [
                this.mapPanel
            ],
            ref: "../main",
            activeItem: 0
        });
        if (window.google && google.earth) {
            this.mapPanelContainer.add(
                new gxp.GoogleEarthPanel({
                    mapPanel: this.mapPanel,
                    listeners: {
                        beforeadd: function(record) {
                            return record.get("group") !== "background";
                        }
                    }
                })
            );
        }

        this.portalItems = [
            this.mapPanelContainer
        ];
        
        var gridWinPanel = new Ext.Panel({
            id: 'gridWinPanel',
            collapseMode: "mini",
            title: 'Identify Results',
            region: "west",
            autoScroll: true,
            split: true,
            items: []
        });

        var gridResultsPanel = new Ext.Panel({
            id: 'gridResultsPanel',
            title: 'Feature Details',
            region: "center",
            collapseMode: "mini",
            autoScroll: true,
            split: true,
            items: []
        });


        var identifyWindow = new Ext.Window({
            id: 'queryPanel',
            layout: "border",
            closeAction: "hide",
            items: [gridWinPanel, gridResultsPanel],
            width: "100%",
            height: 400
        });
        
        GeoExplorer.superclass.initPortal.apply(this, arguments);

    },
    
    /**
     * private: method[addLayerSource]
     */
    addLayerSource: function(options) {
        // use super's super instead of super - we don't want to issue
        // DescribeLayer requests because we neither need to style layers
        // nor to show a capabilities grid.
        var source = GeoExplorer.superclass.addLayerSource.apply(this, arguments);
    },

    /**
     * api: method[createTools]
     * Create the various parts that compose the layout.
     */
    createTools: function() {
        var tools = GeoExplorer.Viewer.superclass.createTools.apply(this, arguments);

        var layerChooser = new Ext.Button({
            tooltip: 'Layer Switcher',
            //iconCls: 'icon-layer-switcher',
            text: "Layers",
            menu: new gxp.menu.LayerMenu({
                layers: this.mapPanel.layers
            })
        });

        tools.unshift("-");
        tools.unshift(layerChooser);

        var aboutButton = new Ext.Button({
            tooltip: "About this map",
            //iconCls: "icon-about",
            text: "About",
            handler: this.displayAppInfo,
            scope: this
        });

        tools.push("->");
        tools.push(aboutButton);

        return tools;
    }
});