sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sacde/abm/pce/centro/ui5/service/Service"
],
function(
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    Fragment,
    MessageBox,
    MessageToast,
    Service
) {

    "use strict";

    return Controller.extend(
        "sacde.abm.pce.centro.ui5.controller.PmAprobador",
        {

            onInit: function () {
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.getRoute("RoutePmAprobador").attachPatternMatched(this._onRouteMatched, this);

                const oModel = this.getOwnerComponent().getModel("OServiceModel");
                if (oModel) {
                    oModel.attachEventOnce("dataLoaded", () => {
                        this._actualizarContador(this.byId("idTablePmAprobador").getBinding("items"));
                    });
                }

                this._actualizarContador();
            },

            _onRouteMatched: function () {
                const oIconTabBar = this.byId("idPmIconTabBar");
                if (oIconTabBar && oIconTabBar.getSelectedKey() !== "pmAprobador") {
                    oIconTabBar.setSelectedKey("pmAprobador");
                }

                this._actualizarContador(this.byId("idTablePmAprobador")?.getBinding("items"));
            },

            formatDateTime: function (sValue) {
                if (!sValue) {
                    return "";
                }

                const oDate = new Date(sValue);
                if (isNaN(oDate.getTime())) {
                    return sValue;
                }

                const options = {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                };

                return oDate.toLocaleString("es-AR", options);
            },

            onTabSelect: function (oEvent) {
                const sKey = oEvent.getParameter("key");

                if (sKey === "pceCentro") {
                    this.getOwnerComponent().getRouter().navTo("RouteMain");
                } else if (sKey === "auditoria") {
                    this.getOwnerComponent().getRouter().navTo("RouteAuditoria");
                }
            },

            onSearch: function () {
                const aFilters = [];

                const oCentroInput = this.byId("idPmFilterCentroLogistico");
                const sCentro = oCentroInput?.getValue()?.trim();
                if (sCentro) {
                    aFilters.push(new Filter("centroLogistico", FilterOperator.Contains, sCentro));
                }

                const oAprobadorInput = this.byId("idPmFilterAprobador");
                const sAprobador = oAprobadorInput?.getValue()?.trim();
                if (sAprobador) {
                    aFilters.push(
                        new Filter({
                            filters: [
                                new Filter("aprobadorUsuario", FilterOperator.Contains, sAprobador),
                                new Filter("aprobadorNombre", FilterOperator.Contains, sAprobador),
                                new Filter("aprobadorEmail", FilterOperator.Contains, sAprobador)
                            ],
                            and: false
                        })
                    );
                }

                const oEstadoSelect = this.byId("idPmFilterEstado");
                const sEstado = oEstadoSelect?.getSelectedKey();
                if (sEstado === "activos") {
                    aFilters.push(new Filter("activo", FilterOperator.EQ, true));
                } else if (sEstado === "inactivos") {
                    aFilters.push(new Filter("activo", FilterOperator.EQ, false));
                }

                const oTable = this.byId("idTablePmAprobador");
                const oBinding = oTable.getBinding("items");
                oBinding.filter(aFilters);

                this._actualizarContador(oBinding);
            },

            _actualizarContador: function (oBinding) {
                const oI18nModel = this.getView()?.getModel("i18n");
                if (!oI18nModel) {
                    return;
                }

                const oResourceBundle = oI18nModel.getResourceBundle();
                const oServiceModel = this.getView()?.getModel("OServiceModel") || this.getOwnerComponent()?.getModel("OServiceModel");
                const aData = oServiceModel ? oServiceModel.getProperty("/PmAprobadorCentro") || [] : [];
                const iTotal = aData.length;

                let iFiltrados = iTotal;
                if (oBinding) {
                    const aContexts = oBinding.getContexts();
                    iFiltrados = aContexts.length;
                }

                const sRegistrosTitle = oResourceBundle.getText("title.registros");
                this.byId("idPmRegistrosTitle").setText(`${sRegistrosTitle} (${iFiltrados})`);
                this.byId("idPmMostrandoRegistrosText").setText(`${oResourceBundle.getText("text.mostrando")} ${iFiltrados} ${oResourceBundle.getText("text.de")} ${iTotal}`);
            },

            onExportExcel: function () {
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                const aData = this.getView().getModel("OServiceModel").getProperty("/PmAprobadorCentro");

                if (!aData || aData.length === 0) {
                    MessageToast.show(oResourceBundle.getText("message.nodata"));
                    return;
                }

                const aHeaders = [
                    oResourceBundle.getText("column.centro.logistico"),
                    oResourceBundle.getText("column.descripcion"),
                    oResourceBundle.getText("column.aprobador"),
                    oResourceBundle.getText("column.aprobador.suplente"),
                    oResourceBundle.getText("column.aprobador.suplente.activo"),
                    oResourceBundle.getText("column.estado")
                ];

                const aRows = aData.map(oItem => [
                    oItem.centroLogistico || "",
                    oItem.descripcion || "",
                    `${oItem.aprobadorNombre || ""} (${oItem.aprobadorUsuario || ""}) - ${oItem.aprobadorEmail || ""}`,
                    oItem.aprobadorSuplenteUsuario
                        ? `${oItem.aprobadorSuplenteNombre || ""} (${oItem.aprobadorSuplenteUsuario || ""}) - ${oItem.aprobadorSuplenteEmail || ""}`
                        : "—",
                    oItem.aprobadorSuplenteActivo ? oResourceBundle.getText("text.si") : oResourceBundle.getText("text.no"),
                    oItem.activo ? oResourceBundle.getText("estado.activo") : oResourceBundle.getText("estado.inactivo")
                ]);

                const csvContent = "data:text/csv;charset=utf-8,"
                    + [aHeaders, ...aRows]
                        .map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
                        .join("\n");

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "PM_aprobador_por_centro_logistico.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            },

            onValueHelpRequest: function (oEvent) {
                const oInput = oEvent.getSource();
                this._vhInput = oInput;
                this._vhEntitySet = oInput.data("entitySet");
                this._vhField = oInput.data("field");

                this.getView().getModel("OServiceModel").setProperty("/ValueHelp", []);

                const oSearchField = this.byId("idValueHelpSearchField");
                if (oSearchField) {
                    oSearchField.setValue("");
                }

                this._openValueHelp();
            },

            onValueHelpItemPress: function (oEvent) {
                const oObj = oEvent.getSource()
                    .getBindingContext("OServiceModel")
                    .getObject();

                const oBinding = this._vhInput.getBinding("value");

                if (oBinding && oBinding.getPath) {
                    const sPath = oBinding.getPath();
                    const oModel = oBinding.getModel();

                    if (oModel && sPath) {
                        oModel.setProperty(sPath, oObj.codigo);
                    } else {
                        this._vhInput.setValue(oObj.codigo);
                    }
                } else {
                    this._vhInput.setValue(oObj.codigo);
                }

                const sDependentField = this._vhInput.data("dependentField");
                if (sDependentField) {
                    this._populateDependentField(sDependentField, oObj);
                }

                if (this._vhInput.getId().endsWith("idPmDialogAprobadorUsuario")) {
                    this._populateAprobadorData(oObj);
                }

                if (this._vhInput.getId().endsWith("idPmDialogSuplenteUsuario")) {
                    this._populateSuplenteData(oObj);
                }

                this._oValueHelpDialog.close();
            },

            _populateAprobadorData: function (oUsuario) {
                const oDialogModel = this.getView().getModel("dialog");

                if (!oDialogModel || !oUsuario) {
                    return;
                }

                oDialogModel.setProperty("/aprobadorNombre", oUsuario.descripcion || "");
                oDialogModel.setProperty("/aprobadorEmail", oUsuario.email || "");
            },

            _populateSuplenteData: function (oUsuario) {
                const oDialogModel = this.getView().getModel("dialog");

                if (!oDialogModel || !oUsuario) {
                    return;
                }

                oDialogModel.setProperty("/aprobadorSuplenteNombre", oUsuario.descripcion || "");
                oDialogModel.setProperty("/aprobadorSuplenteEmail", oUsuario.email || "");
            },

            _populateDependentField: function (sDependentField, oObj) {
                const oDialogModel = this.getView().getModel("dialog");

                if (!oDialogModel) {
                    return;
                }

                let sValue = "";

                if (this._vhEntitySet === "CentroLogisticoVHSet") {
                    sValue = oObj.descripcion || "";
                } else if (this._vhEntitySet === "ZI_COA_USUARIO_VH") {
                    if (sDependentField === "aprobadorNombre" || sDependentField === "aprobadorSuplenteNombre") {
                        sValue = oObj.descripcion || "";
                    } else if (sDependentField === "aprobadorEmail" || sDependentField === "aprobadorSuplenteEmail") {
                        sValue = oObj.email || "";
                    }
                }

                oDialogModel.setProperty("/" + sDependentField, sValue);
            },

            _openValueHelp: async function () {
                if (!this._oValueHelpDialog) {
                    this._oValueHelpDialog = await Fragment.load({
                        id: this.getView().getId(),
                        name: "sacde.abm.pce.centro.ui5.fragment.ValueHelp",
                        controller: this
                    });

                    this.getView().addDependent(this._oValueHelpDialog);
                }

                this._oValueHelpDialog.open();
            },

            onSearchFieldLiveChange: async function (oEvent) {
                const sValue = oEvent.getParameter("newValue");

                if (!sValue || sValue.length < 2) {
                    this.getView()
                        .getModel("OServiceModel")
                        .setProperty("/ValueHelp", []);

                    return;
                }

                try {
                    const aRows = await Service.searchVH(
                        this._vhEntitySet,
                        this._vhField,
                        sValue
                    );

                    this.getView()
                        .getModel("OServiceModel")
                        .setProperty("/ValueHelp", aRows);

                    if (this._vhEntitySet === "ZI_COA_USUARIO_VH" && this._vhInput.getId().endsWith("idPmDialogAprobadorUsuario")) {
                        const sValueUpper = sValue.toUpperCase();
                        const oExacto = aRows.find(oRow => oRow.codigo && oRow.codigo.toUpperCase() === sValueUpper);
                        if (oExacto) {
                            this._populateAprobadorData(oExacto);
                        }
                    }

                    if (this._vhEntitySet === "ZI_COA_USUARIO_VH" && this._vhInput.getId().endsWith("idPmDialogSuplenteUsuario")) {
                        const sValueUpper = sValue.toUpperCase();
                        const oExacto = aRows.find(oRow => oRow.codigo && oRow.codigo.toUpperCase() === sValueUpper);
                        if (oExacto) {
                            this._populateSuplenteData(oExacto);
                        }
                    }
                } catch {
                    this.getView()
                        .getModel("OServiceModel")
                        .setProperty("/ValueHelp", []);
                }
            },

            onCerrarValueHelp: function () {
                this._oValueHelpDialog.close();
            },

            onClearFilters: function () {
                const aFields = [
                    { id: "idPmFilterCentroLogistico" },
                    { id: "idPmFilterAprobador" }
                ];

                aFields.forEach(function (oField) {
                    const oControl = this.byId(oField.id);
                    if (oControl) {
                        oControl.setValue("");
                    }
                }.bind(this));

                this.byId("idPmFilterEstado").setSelectedKey("activos");

                const oTable = this.byId("idTablePmAprobador");
                const oBinding = oTable.getBinding("items");
                oBinding.filter([]);

                this._actualizarContador(oBinding);
            },

            _openDialog: async function(oData){
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                const bIsEditing = !!oData;
                const oModel = new JSONModel({
                    title: oData ? oResourceBundle.getText("dialog.pm.aprobador.title.edit") : oResourceBundle.getText("dialog.pm.aprobador.title.new"),
                    isEditing: bIsEditing,

                    centroLogistico:"",
                    descripcion:"",
                    aprobadorUsuario:"",
                    aprobadorNombre:"",
                    aprobadorEmail:"",
                    aprobadorSuplenteUsuario:"",
                    aprobadorSuplenteNombre:"",
                    aprobadorSuplenteEmail:"",
                    aprobadorSuplenteActivo:false,
                    activo:true
                });

                if(oData){
                    oModel.setData({
                        ...oData,
                        title: oResourceBundle.getText("dialog.pm.aprobador.title.edit"),
                        isEditing: true
                    });
                }

                this.getView().setModel(oModel,"dialog");

                if(!this._oDialog){
                    this._oDialog = await Fragment.load({
                        id: this.getView().getId(),
                        name: "sacde.abm.pce.centro.ui5.fragment.PmAprobadorDialog",
                        controller: this
                    });

                    this.getView().addDependent(this._oDialog);
                }

                this._oDialog.open();
            },

            onCreatePress:function(){
                this._openDialog();
            },

            onEditPress:function(oEvent){
                const oData = oEvent
                    .getSource()
                    .getBindingContext("OServiceModel")
                    .getObject();

                this._openDialog(oData);
            },

            onPersonFieldChange: function (oEvent) {
                const oSource = oEvent.getSource();
                const sValue = oEvent.getParameter("value")?.trim();
                const sDependentField = oSource.data("dependentField");

                if (!sValue && sDependentField) {
                    this.getView()
                        .getModel("dialog")
                        .setProperty("/" + sDependentField, "");
                }

                if (oSource.getId().endsWith("idPmDialogAprobadorUsuario") && !sValue) {
                    const oDialogModel = this.getView().getModel("dialog");
                    oDialogModel.setProperty("/aprobadorNombre", "");
                    oDialogModel.setProperty("/aprobadorEmail", "");
                }
            },

            onSuplenteFieldChange: function (oEvent) {
                const oSource = oEvent.getSource();
                const sValue = oEvent.getParameter("value")?.trim();
                const sDependentField = oSource.data("dependentField");

                if (!sValue && sDependentField) {
                    this.getView()
                        .getModel("dialog")
                        .setProperty("/" + sDependentField, "");
                }

                if (oSource.getId().endsWith("idPmDialogSuplenteUsuario") && !sValue) {
                    const oDialogModel = this.getView().getModel("dialog");
                    oDialogModel.setProperty("/aprobadorSuplenteNombre", "");
                    oDialogModel.setProperty("/aprobadorSuplenteEmail", "");
                    oDialogModel.setProperty("/aprobadorSuplenteActivo", false);
                }
            },

            onSaveDialog:async function(){
                const oData = this.getView()
                    .getModel("dialog")
                    .getData();

                if(!this._validateDialogData(oData)){
                    return;
                }

                try{
                    const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                    if(oData.ID){
                        await Service.actualizarPmAprobadorCentro(oData);
                        MessageToast.show(oResourceBundle.getText("message.success.updated"));
                    }else{
                        await Service.crearPmAprobadorCentro(oData);
                        MessageToast.show(oResourceBundle.getText("message.success.created"));
                    }

                    this._oDialog.close();
                    await this._reloadPmAprobadorData();

                }catch(e){
                    const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                    let sErrorMsg = oResourceBundle.getText("message.error.save");

                    if (e.message?.includes("{")) {
                        try {
                            const sJson = e.message.substring(e.message.indexOf("{"));
                            const oError = JSON.parse(sJson);

                            if (oError.error?.details?.length) {
                                sErrorMsg = oError.error.details
                                    .map(detail => `• ${detail.message}`)
                                    .join("\n");
                            } else if (oError.error?.message) {
                                sErrorMsg = oError.error.message;
                            }
                        } catch {
                            // Silencio: no se pudo parsear el mensaje del backend.
                        }
                    }

                    MessageBox.error(sErrorMsg, {
                        title: oResourceBundle.getText("message.error.save.title")
                    });
                }
            },

            _validateDialogData: function(oData){
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                const aRequired = [
                    {
                        field:"centroLogistico",
                        label: oResourceBundle.getText("validation.field.centro.logistico")
                    },
                    {
                        field:"aprobadorUsuario",
                        label: oResourceBundle.getText("validation.field.usuario")
                    },
                    {
                        field:"aprobadorNombre",
                        label: oResourceBundle.getText("validation.field.nombre")
                    },
                    {
                        field:"aprobadorEmail",
                        label: oResourceBundle.getText("validation.field.email")
                    }
                ];

                for(const item of aRequired){
                    if(!oData[item.field] || !String(oData[item.field]).trim()){
                        const sValidationMessage = oResourceBundle.getText("validation.field.required", [item.label]);
                        MessageBox.error(sValidationMessage);
                        return false;
                    }
                }

                return true;
            },

            onCloseDialog:function(){
                this._oDialog.close();
            },

            onDeletePress:function(oEvent){
                const oData = oEvent
                    .getSource()
                    .getBindingContext("OServiceModel")
                    .getObject();

                const sID = oData.ID;
                const sClave = `${oData.centroLogistico}`;

                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                MessageBox.confirm(
                    oResourceBundle.getText("message.confirm.delete") + ` \"${sClave}\"?`,
                    {
                        title: oResourceBundle.getText("dialog.confirm.title"),
                        onClose: async (sAction) => {
                            if(sAction === MessageBox.Action.OK){
                                try{
                                    await Service.eliminarRegistro("PmAprobadorCentro", sID);
                                    const oRB = this.getView().getModel("i18n").getResourceBundle();
                                    MessageToast.show(oRB.getText("message.success.deleted"));

                                    await this._reloadPmAprobadorData();
                                }catch(e){
                                    const oRB = this.getView().getModel("i18n").getResourceBundle();
                                    let sErrorMsg = oRB.getText("message.error.delete");

                                    if(e.message){
                                        sErrorMsg = e.message;

                                        if(e.message.includes("HTTP")){
                                            sErrorMsg = oRB.getText("message.error.server") + e.message;
                                        }
                                    }

                                    MessageBox.error(sErrorMsg, {
                                        title: oRB.getText("message.error.delete.title")
                                    });
                                }
                            }
                        }
                    }
                );
            },

            _reloadPmAprobadorData: async function(){
                try{
                    const aData = await Service.getPmAprobadorCentroData();

                    this.getView()
                        .getModel("OServiceModel")
                        .setProperty("/PmAprobadorCentro", aData);

                    this._actualizarContador(this.byId("idTablePmAprobador").getBinding("items"));
                }catch{
                    const sMessage = this.getView().getModel("i18n").getResourceBundle().getText("message.error.reload");
                    MessageBox.error(sMessage);
                }
            }
        }
    );
});
