sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sacde/abm/pce/centro/ui5/service/Service"
],
function(
    Controller,
    JSONModel,
    MessageBox,
    MessageToast,
    Service
) {

    "use strict";

    // Campos internos que no se muestran como movimientos.
    const CAMPOS_EXCLUIDOS = ["ID", "centroLogistico"];

    // Campo que identifica al registro en un ALTA.
    const CAMPO_PRINCIPAL_ALTA = {
        PceCentroLogistico: "usuario",
        PmAprobadorCentro: "aprobadorUsuario"
    };

    // Clave i18n de la columna "Tabla".
    const TABLA_I18N = {
        PceCentroLogistico: "aud.tabla.pce",
        PmAprobadorCentro: "aud.tabla.pm"
    };

    // Clave i18n del nombre del campo modificado.
    const CAMPO_I18N = {
        usuario: "aud.campo.pce",
        aprobadorUsuario: "aud.campo.pm",
        aprobadorSuplenteUsuario: "aud.campo.suplente",
        aprobadorSuplenteActivo: "aud.campo.suplente.activo",
        activo: "aud.campo.estado",
        nombre: "aud.campo.nombre",
        email: "aud.campo.email",
        aprobadorNombre: "aud.campo.aprobador.nombre",
        aprobadorEmail: "aud.campo.aprobador.email",
        aprobadorSuplenteNombre: "aud.campo.suplente.nombre",
        aprobadorSuplenteEmail: "aud.campo.suplente.email"
    };

    const ESTADO_ACCION = {
        ALTA: "Information",
        MODIFICACION: "Warning",
        BAJA: "Error"
    };

    function parseJson(sValor) {
        if (!sValor) {
            return null;
        }
        try {
            return JSON.parse(sValor);
        } catch (e) {
            return null;
        }
    }

    function escapeHtml(sValor) {
        return String(sValor)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    return Controller.extend(
        "sacde.abm.pce.centro.ui5.controller.Auditoria",
        {

            onInit: function () {
                this.getView().setModel(new JSONModel({ Movimientos: [] }), "AuditoriaModel");

                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.getRoute("RouteAuditoria").attachPatternMatched(this._onRouteMatched, this);

                this._iTotal = 0;
                this._actualizarContadores();
            },

            _onRouteMatched: function () {
                const oIconTabBar = this.byId("idAuditoriaIconTabBar");
                if (oIconTabBar && oIconTabBar.getSelectedKey() !== "auditoria") {
                    oIconTabBar.setSelectedKey("auditoria");
                }

                this._cargarGeneral();
            },

            onTabSelect: function (oEvent) {
                const sKey = oEvent.getParameter("key");

                if (sKey === "pceCentro") {
                    this.getOwnerComponent().getRouter().navTo("RouteMain");
                } else if (sKey === "pmAprobador") {
                    this.getOwnerComponent().getRouter().navTo("RoutePmAprobador");
                }
            },

            onBuscar: async function () {
                const oFiltros = this._leerFiltros();
                if (oFiltros === null) {
                    return;
                }

                const iCantidad = await this._cargar(oFiltros);
                if (iCantidad !== null) {
                    this._actualizarContadores();
                }
            },

            onLimpiarFiltros: function () {
                this.byId("idAudUsuario").setValue("");
                this.byId("idAudDesde").setValue("");
                this.byId("idAudHasta").setValue("");
                this.byId("idAudTabla").setSelectedKey("todas");
                this.byId("idAudCentro").setValue("");

                this._cargarGeneral();
            },

            onExportExcel: function () {
                const oRB = this._rb();
                const aMovimientos = this.getView().getModel("AuditoriaModel").getProperty("/Movimientos");

                if (!aMovimientos || aMovimientos.length === 0) {
                    MessageToast.show(oRB.getText("message.nodata"));
                    return;
                }

                const aHeaders = [
                    oRB.getText("aud.col.fecha"),
                    oRB.getText("aud.col.usuario"),
                    oRB.getText("aud.col.accion"),
                    oRB.getText("aud.col.tabla"),
                    oRB.getText("aud.col.centro"),
                    oRB.getText("aud.col.campo"),
                    oRB.getText("aud.col.anterior"),
                    oRB.getText("aud.col.nuevo")
                ];

                const aRows = aMovimientos.map(oMov => [
                    oMov.fecha,
                    oMov.usuario,
                    oMov.accionTexto,
                    oMov.tablaTexto,
                    oMov.centroLogistico,
                    oMov.campo,
                    oMov.valorAnterior,
                    oMov.valorNuevo
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
                link.setAttribute("download", "Auditoria_PCE_PM.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            },

            // ── Carga de datos ────────────────────────────────────────────────

            _cargarGeneral: async function () {
                const iCantidad = await this._cargar({});
                if (iCantidad !== null) {
                    this._iTotal = iCantidad;
                    this._actualizarContadores();
                }
            },

            _cargar: async function (oFiltros) {
                const oView = this.getView();
                oView.setBusy(true);

                try {
                    const aRows = await Service.getAuditoria(oFiltros);
                    if (aRows.length >= Service.LIMITE_AUDITORIA) {
                        MessageToast.show(this._rb().getText("aud.message.limite", [Service.LIMITE_AUDITORIA]));
                    }
                    const aMovimientos = this._aplanar(aRows);
                    oView.getModel("AuditoriaModel").setProperty("/Movimientos", aMovimientos);
                    return aMovimientos.length;
                } catch (e) {
                    const oRB = this._rb();
                    MessageBox.error(`${oRB.getText("aud.message.error.load")} ${e.message}`);
                    return null;
                } finally {
                    oView.setBusy(false);
                }
            },

            _leerFiltros: function () {
                const sDesde = this.byId("idAudDesde").getValue();
                const sHasta = this.byId("idAudHasta").getValue();

                if (sDesde && sHasta && sDesde > sHasta) {
                    MessageToast.show(this._rb().getText("aud.message.fechas"));
                    return null;
                }

                const sUsuario = this.byId("idAudUsuario").getValue().trim();
                const sTabla = this.byId("idAudTabla").getSelectedKey();
                const sCentro = this.byId("idAudCentro").getValue().trim();

                return {
                    usuario: sUsuario || undefined,
                    desde: sDesde ? this._inicioDiaLocal(sDesde) : undefined,
                    hasta: sHasta ? this._finDiaLocal(sHasta) : undefined,
                    tabla: sTabla && sTabla !== "todas" ? sTabla : undefined,
                    centroLogistico: sCentro || undefined
                };
            },

            /**
             * Convierte cada registro de ContextoAuditoria en una fila por campo
             * (el mockup muestra un movimiento por campo modificado).
             */
            _aplanar: function (aRows) {
                const aMovimientos = [];

                aRows.forEach(oRow => {
                    const oAnterior = parseJson(oRow.valorAnterior);
                    const oNuevo = parseJson(oRow.valorNuevo) || {};

                    const oBase = {
                        fecha: this._formatFecha(oRow.fecha),
                        usuario: oRow.ejecutadoPor || "",
                        tablaTexto: this._rb().getText(TABLA_I18N[oRow.tabla] || "aud.tabla.pce"),
                        centroLogistico: oRow.centroLogistico || ""
                    };

                    if (oRow.accion === "CREATE") {
                        const sCampoPrincipal = CAMPO_PRINCIPAL_ALTA[oRow.tabla];
                        const sValorNuevo = sCampoPrincipal ? this._formatValor(sCampoPrincipal, oNuevo[sCampoPrincipal]) : "—";

                        aMovimientos.push(this._crearMovimiento(oBase, "ALTA", "—", "—", sValorNuevo));
                        return;
                    }

                    Object.keys(oNuevo)
                        .filter(sCampo => !CAMPOS_EXCLUIDOS.includes(sCampo))
                        .forEach(sCampo => {
                            const bBaja = sCampo === "activo" && oNuevo[sCampo] === false;
                            const sCampoTexto = this._rb().getText(CAMPO_I18N[sCampo] || sCampo);

                            aMovimientos.push(this._crearMovimiento(
                                oBase,
                                bBaja ? "BAJA" : "MODIFICACION",
                                sCampoTexto,
                                this._formatValor(sCampo, oAnterior ? oAnterior[sCampo] : undefined),
                                this._formatValor(sCampo, oNuevo[sCampo])
                            ));
                        });
                });

                return aMovimientos;
            },

            _crearMovimiento: function (oBase, sAccion, sCampo, sValorAnterior, sValorNuevo) {
                return Object.assign({}, oBase, {
                    accion: sAccion,
                    accionTexto: this._rb().getText(`aud.accion.${sAccion.toLowerCase()}`),
                    accionEstado: ESTADO_ACCION[sAccion],
                    campo: sCampo,
                    valorAnterior: sValorAnterior,
                    // Valor anterior tachado, como en el mockup (los "—" no se tachan).
                    valorAnteriorHtml: sValorAnterior === "—"
                        ? "—"
                        : `<s>${escapeHtml(sValorAnterior)}</s>`,
                    valorNuevo: sValorNuevo
                });
            },

            _formatValor: function (sCampo, vValor) {
                const oRB = this._rb();

                if (vValor === null || vValor === undefined || vValor === "") {
                    return "—";
                }
                if (typeof vValor === "boolean") {
                    if (sCampo === "activo") {
                        return oRB.getText(vValor ? "estado.activo" : "estado.inactivo");
                    }
                    return oRB.getText(vValor ? "text.si" : "text.no");
                }
                return String(vValor);
            },

            /**
             * "yyyy-MM-dd" (día local) → ISO UTC del inicio de ese día en hora local.
             * Ej.: en Argentina (UTC-3) "2026-11-11" → "2026-11-11T03:00:00.000Z".
             */
            _inicioDiaLocal: function (sFecha) {
                const [a, m, d] = sFecha.split("-").map(Number);
                return new Date(a, m - 1, d, 0, 0, 0, 0).toISOString();
            },

            /**
             * "yyyy-MM-dd" (día local) → ISO UTC del último milisegundo de ese día en hora local.
             */
            _finDiaLocal: function (sFecha) {
                const [a, m, d] = sFecha.split("-").map(Number);
                return new Date(a, m - 1, d, 23, 59, 59, 999).toISOString();
            },

            _formatFecha: function (sValor) {
                if (!sValor) {
                    return "";
                }
                const oDate = new Date(sValor);
                if (isNaN(oDate.getTime())) {
                    return sValor;
                }
                return oDate.toLocaleString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                });
            },

            _actualizarContadores: function () {
                // En onInit el modelo i18n puede no estar disponible todavía (mismo patrón que PceCentro).
                if (!this.getView()?.getModel("i18n") || !this.byId("idAudTitulo")) {
                    return;
                }

                const oRB = this._rb();
                const iFiltrados = this.getView().getModel("AuditoriaModel").getProperty("/Movimientos").length;

                this.byId("idAudTitulo").setText(`${oRB.getText("aud.title.movimientos")} (${iFiltrados})`);
                this.byId("idAudMostrandoText").setText(`${oRB.getText("text.mostrando")} ${iFiltrados} ${oRB.getText("text.de")} ${this._iTotal}`);
            },

            _rb: function () {
                return this.getView().getModel("i18n").getResourceBundle();
            }
        }
    );
});
