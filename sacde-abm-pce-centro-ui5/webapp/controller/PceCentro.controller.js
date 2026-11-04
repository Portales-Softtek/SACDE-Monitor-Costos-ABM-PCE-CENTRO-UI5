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
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                const iTotal = this.getView().getModel("OServiceModel").getProperty("/PceCentroLogistico").length;

                let iFiltrados = iTotal;
                if (oBinding) {
                    const aContexts = oBinding.getContexts();
                    iFiltrados = aContexts.length;
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

                const csvContent = "data:text/csv;charset=utf-8,"
                    + [aHeaders, ...aRows]
                        .map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
                        .join("\n");

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "PCE_por_centro_logistico.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
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

                this._oValueHelpDialog.close();
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

                if(!this._oDialog){
                    this._oDialog = await Fragment.load({
                        id: this.getView().getId(),
                        name: "sacde.abm.pce.centro.ui5.fragment.PceCentroDialog",
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
                const sValue = oEvent.getParameter("value")?.trim();
                const sDependentField = oEvent.getSource().data("dependentField");

                if (!sValue && sDependentField) {
                    this.getView()
                        .getModel("dialog")
                        .setProperty("/" + sDependentField, "");
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

            onDeletePress:function(oEvent){
                const oData = oEvent
                    .getSource()
                    .getBindingContext("OServiceModel")
                    .getObject();

                const sID = oData.ID;
                const sClave = `${oData.centroLogistico} - ${oData.usuario}`;

                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                MessageBox.confirm(
                    oResourceBundle.getText("message.confirm.delete") + ` \"${sClave}\"?`,
                    {
                        title: oResourceBundle.getText("dialog.confirm.title"),
                        onClose: async (sAction) => {
                            if(sAction === MessageBox.Action.OK){
                                try{
                                    await Service.eliminarRegistro("PceCentroLogistico", sID);
                                    const oRB = this.getView().getModel("i18n").getResourceBundle();
                                    MessageToast.show(oRB.getText("message.success.deleted"));

                                    await this._reloadPceCentroData();
                                }catch(e){
                                    console.error("Error deleting PCE:", e);

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

            _reloadPceCentroData: async function(){
                try{
                    const aData = await Service.getPceCentroLogisticoData();

                    console.log("Registros traidos para la tabla PceCentroLogistico:", aData.length, aData);

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
