sap.ui.define([
    "sap/ui/core/UIComponent",
    "sacde/abm/pce/centro/ui5/model/models",
    "sap/ui/model/json/JSONModel",
    "sacde/abm/pce/centro/ui5/service/Service"
], (UIComponent, models, JSONModel, Service) => {
    "use strict";

    return UIComponent.extend("sacde.abm.pce.centro.ui5.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            const oManifest = this.getManifestObject();
            Service.init(oManifest.resolveUri("abm-contexto/"));

            this.setModel(new JSONModel({
                PceCentroLogistico: [],
                PmAprobadorCentro: [],
                ValueHelp: []
            }), "OServiceModel");
            this._loadData();

            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        },

        _loadData: async function () {
            const rawData = await Service.getData();

            const cleanData = {};

            Object.keys(rawData).forEach(key => {
                const entry = rawData[key];

                if (entry.success && entry.data) {
                    cleanData[key] = entry.data.value || entry.data;
                } else {
                    cleanData[key] = [];
                }
            });

            this.getModel("OServiceModel").setData(cleanData);
            this.getModel("OServiceModel").fireEvent("dataLoaded");
        },

        refreshData: async function () {
            const rawData = await Service.getData();

            const cleanData = {};

            Object.keys(rawData).forEach(key => {
                const entry = rawData[key];

                if (entry.success && entry.data) {
                    cleanData[key] = entry.data.value || entry.data;
                } else {
                    cleanData[key] = [];
                }
            });

            this.getModel("OServiceModel").setData(cleanData);
            this.getModel("OServiceModel").fireEvent("dataLoaded");
        },

        getI18nText: function (sKey, aArgs) {
            const oBundle = this.getModel("i18n").getResourceBundle();
            return oBundle.getText(sKey, aArgs);
        }
    });
});
