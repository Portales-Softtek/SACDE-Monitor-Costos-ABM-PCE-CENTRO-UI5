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
        "sacde.abm.pce.centro.ui5.controller.PceCentro",
        {

            onInit: function () {
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.getRoute("RouteMain").attachPatternMatched(this._onRouteMatched, this);

                const oModel = this.getOwnerComponent().getModel("OServiceModel");
                if (oModel) {
                    oModel.attachEventOnce("dataLoaded", () => {
                        this._actualizarContador(this.byId("idTablePceCentro").getBinding("items"));
                    });
                }

                // Inicializar contador en 0 para evitar el placeholder (5)
                this._actualizarContador();
            },

            _onRouteMatched: function () {
                const oIconTabBar = this.byId("idIconTabBar");
                if (oIconTabBar && oIconTabBar.getSelectedKey() !== "pceCentro") {
                    oIconTabBar.setSelectedKey("pceCentro");
                }

                this._actualizarContador(this.byId("idTablePceCentro")?.getBinding("items"));
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

            onSearch: function () {
                const aFilters = [];

                // Filtros de texto libre
                const oCentroInput = this.byId("idFilterCentroLogistico");
                const sCentro = oCentroInput?.getValue()?.trim();
                if (sCentro) {
                    aFilters.push(new Filter("centroLogistico", FilterOperator.Contains, sCentro));
                }

                const oUsuarioInput = this.byId("idFilterUsuario");
                const sUsuario = oUsuarioInput?.getValue()?.trim();
                if (sUsuario) {
                    aFilters.push(
                        new Filter({
                            filters: [
                                new Filter("usuario", FilterOperator.Contains, sUsuario),
                                new Filter("nombre", FilterOperator.Contains, sUsuario),
                                new Filter("email", FilterOperator.Contains, sUsuario)
                            ],
                            and: false
                        })
                    );
                }

                // Filtro de estado
                const oEstadoSelect = this.byId("idFilterEstado");
                const sEstado = oEstadoSelect?.getSelectedKey();
                if (sEstado === "activos") {
                    aFilters.push(new Filter("activo", FilterOperator.EQ, true));
                } else if (sEstado === "inactivos") {
                    aFilters.push(new Filter("activo", FilterOperator.EQ, false));
                }

                const oTable = this.byId("idTablePceCentro");
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
                const aData = oServiceModel ? oServiceModel.getProperty("/PceCentroLogistico") || [] : [];
                const iTotal = aData.length;

                let iFiltrados = iTotal;
                if (oBinding) {
                    // getLength() no está limitado por el sizeLimit del modelo (getContexts() sí).
                    iFiltrados = oBinding.getLength();
                }

                const sRegistrosTitle = oResourceBundle.getText("title.registros");
                this.byId("idRegistrosTitle").setText(`${sRegistrosTitle} (${iFiltrados})`);
                this.byId("idMostrandoRegistrosText").setText(`${oResourceBundle.getText("text.mostrando")} ${iFiltrados} ${oResourceBundle.getText("text.de")} ${iTotal}`);
            },

            onExportExcel: function () {
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                const aData = this.getView().getModel("OServiceModel").getProperty("/PceCentroLogistico");

                if (!aData || aData.length === 0) {
                    MessageToast.show(oResourceBundle.getText("message.nodata"));
                    return;
                }

                const aHeaders = [
                    oResourceBundle.getText("column.centro.logistico"),
                    oResourceBundle.getText("column.descripcion"),
                    oResourceBundle.getText("column.pce"),
                    oResourceBundle.getText("column.estado"),
                    oResourceBundle.getText("column.modified.at")
                ];

                const aRows = aData.map(oItem => [
                    oItem.centroLogistico || "",
                    oItem.descripcion || "",
                    `${oItem.nombre || ""} (${oItem.usuario || ""}) - ${oItem.email || ""}`,
                    oItem.activo ? oResourceBundle.getText("estado.activo") : oResourceBundle.getText("estado.inactivo"),
                    oItem.modifiedAt ? new Date(oItem.modifiedAt).toLocaleString("es-AR") : ""
                ]);

                // BOM para que Excel respete los acentos; celdas que empiezan con = + - @ se neutralizan.
                const csvContent = "\uFEFF" + [aHeaders, ...aRows]
                    .map(e => e.map(cell => {
                        let s = String(cell).replace(/"/g, '""');
                        if (/^[=+\-@]/.test(s)) s = `'${s}`;
                        return `"${s}"`;
                    }).join(";"))
                    .join("\n");

                const url = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8" }));
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", "PCE_por_centro_logistico.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            },

            onTabSelect: function (oEvent) {
                const sKey = oEvent.getParameter("key");

                if (sKey === "pmAprobador") {
                    this.getOwnerComponent().getRouter().navTo("RoutePmAprobador");
                } else if (sKey === "auditoria") {
                    this.getOwnerComponent().getRouter().navTo("RouteAuditoria");
                }
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

                if (this._vhInput.getId().endsWith("idDialogUsuario")) {
                    this._populateUsuarioData(oObj);
                }

                this._oValueHelpDialog.close();
            },

            _populateUsuarioData: function (oUsuario) {
                const oDialogModel = this.getView().getModel("dialog");

                if (!oDialogModel || !oUsuario) {
                    return;
                }

                oDialogModel.setProperty("/nombre", oUsuario.descripcion || "");
                oDialogModel.setProperty("/email", oUsuario.email || "");
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
                    if (sDependentField === "nombre") {
                        sValue = oObj.descripcion || "";
                    } else if (sDependentField === "email") {
                        sValue = oObj.email || "";
                    }
                }

                oDialogModel.setProperty("/" + sDependentField, sValue);
            },

            _openValueHelp: async function () {
                // Se guarda la promesa: dos aperturas rápidas no cargan el fragmento dos veces.
                if (!this._pValueHelpDialog) {
                    this._pValueHelpDialog = Fragment.load({
                        id: this.getView().getId(),
                        name: "sacde.abm.pce.centro.ui5.fragment.ValueHelp",
                        controller: this
                    }).then((oDialog) => {
                        this._oValueHelpDialog = oDialog;
                        this.getView().addDependent(oDialog);
                        return oDialog;
                    });
                }
                await this._pValueHelpDialog;

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

                    if (this._vhEntitySet === "ZI_COA_USUARIO_VH" && this._vhInput.getId().endsWith("idDialogUsuario")) {
                        const sValueUpper = sValue.toUpperCase();
                        const oExacto = aRows.find(oRow => oRow.codigo && oRow.codigo.toUpperCase() === sValueUpper);
                        if (oExacto) {
                            this._populateUsuarioData(oExacto);
                        }
                    }
                } catch (error) {
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
                    { id: "idFilterCentroLogistico" },
                    { id: "idFilterUsuario" }
                ];

                aFields.forEach(function (oField) {
                    const oControl = this.byId(oField.id);
                    if (oControl) {
                        oControl.setValue("");
                    }
                }.bind(this));

                this.byId("idFilterEstado").setSelectedKey("activos");

                const oTable = this.byId("idTablePceCentro");
                const oBinding = oTable.getBinding("items");
                oBinding.filter([]);

                this._actualizarContador(oBinding);
            },

            _openDialog: async function(oData){
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                const bIsEditing = !!oData;
                const oModel = new JSONModel({
                    title: oData ? oResourceBundle.getText("dialog.pce.centro.title.edit") : oResourceBundle.getText("dialog.pce.centro.title.new"),
                    isEditing: bIsEditing,

                    centroLogistico:"",
                    usuario:"",
                    nombre:"",
                    email:"",
                    activo:true
                });

                if(oData){
                    oModel.setData({
                        ...oData,
                        title: oResourceBundle.getText("dialog.pce.centro.title.edit"),
                        isEditing: true
                    });
                }

                this.getView().setModel(oModel,"dialog");

                if(!this._pDialog){
                    this._pDialog = Fragment.load({
                        id: this.getView().getId(),
                        name: "sacde.abm.pce.centro.ui5.fragment.PceCentroDialog",
                        controller: this
                    }).then((oDialog) => {
                        this._oDialog = oDialog;
                        this.getView().addDependent(oDialog);
                        return oDialog;
                    });
                }

                await this._pDialog;
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

                if (oSource.getId().endsWith("idDialogUsuario") && !sValue) {
                    const oDialogModel = this.getView().getModel("dialog");
                    oDialogModel.setProperty("/nombre", "");
                    oDialogModel.setProperty("/email", "");
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
                        await Service.actualizarPceCentroLogistico(oData);
                        MessageToast.show(oResourceBundle.getText("message.success.updated"));
                    }else{
                        await Service.crearPceCentroLogistico(oData);
                        MessageToast.show(oResourceBundle.getText("message.success.created"));
                    }

                    this._oDialog.close();
                    await this._reloadPceCentroData();

                }catch(e){
                    console.error("Error saving PCE:", e);

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
                        } catch (parseError) {
                            console.error("Error parsing backend message:", parseError);
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
                        field:"usuario",
                        label: oResourceBundle.getText("validation.field.usuario")
                    },
                    {
                        field:"nombre",
                        label: oResourceBundle.getText("validation.field.nombre")
                    },
                    {
                        field:"email",
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

            onToggleActivoPress:function(oEvent){
                const oData = oEvent
                    .getSource()
                    .getBindingContext("OServiceModel")
                    .getObject();

                const sID = oData.ID;
                const bNuevoActivo = !oData.activo;
                const sClave = `${oData.centroLogistico} - ${oData.usuario}`;

                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                const sAccion = oResourceBundle.getText(bNuevoActivo ? "button.reactivate" : "button.deactivate");
                MessageBox.confirm(
                    `${sAccion} \"${sClave}\"?`,
                    {
                        title: oResourceBundle.getText("dialog.confirm.title"),
                        onClose: async (sAction) => {
                            if(sAction === MessageBox.Action.OK){
                                try{
                                    await Service.cambiarActivo("PceCentroLogistico", sID, bNuevoActivo);
                                    const oRB = this.getView().getModel("i18n").getResourceBundle();
                                    MessageToast.show(oRB.getText("message.success.updated"));

                                    await this._reloadPceCentroData();
                                }catch(e){
                                    console.error("Error changing PCE status:", e);

                                    const oRB = this.getView().getModel("i18n").getResourceBundle();
                                    let sErrorMsg = oRB.getText("message.error.save");

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

            _reloadPceCentroData: async function(){
                try{
                    const aData = await Service.getPceCentroLogisticoData();

                    this.getView()
                        .getModel("OServiceModel")
                        .setProperty("/PceCentroLogistico", aData);

                    this._actualizarContador(this.byId("idTablePceCentro").getBinding("items"));
                }catch(e){
                    console.error("Error reloading PceCentroLogistico data:", e);
                    const sMessage = this.getView().getModel("i18n").getResourceBundle().getText("message.error.reload");
                    MessageBox.error(sMessage);
                }
            }
        }
    );
});
