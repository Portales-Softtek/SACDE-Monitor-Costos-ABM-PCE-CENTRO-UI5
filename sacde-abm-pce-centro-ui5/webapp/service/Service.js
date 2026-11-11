    sap.ui.define([], function () {
    "use strict";

    let _baseContexto = "/abm-contexto/";
    const LIMITE_AUDITORIA = 500;

    // Extrae el mensaje legible de una respuesta de error OData (JSON {error:{message}}).
    // Si el cuerpo no es JSON, devuelve el texto tal cual.
    async function _errorDeRespuesta(response) {
        const sTexto = await response.text();
        let sMensaje = sTexto;
        try {
            const oJson = JSON.parse(sTexto);
            sMensaje = oJson?.error?.message?.value ?? oJson?.error?.message ?? sTexto;
        } catch (e) {
            // cuerpo no JSON: se usa el texto
        }
        return new Error(`HTTP ${response.status}: ${sMensaje}`);
    }

    async function fetchEndpoint(endpoint) {
        try {
            const response = await fetch(endpoint);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            return {
                success: true,
                data: data
            };

        } catch (error) {
            console.error(`Error en ${endpoint}:`, error.message);

            return {
                success: false,
                error: error.message
            };
        }
    }

    async function crearPceCentroLogistico(oData) {
        const cleanData = _cleanPayload(oData);
        const response = await fetch(
            `${_baseContexto}PceCentroLogistico`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(cleanData)
            }
        );

        if (!response.ok) {
            throw await _errorDeRespuesta(response);
        }

        return await response.json();
    }

    async function actualizarPceCentroLogistico(oData) {
        const sID = oData.ID;
        if (!sID) {
            throw new Error("ID is required for update operation");
        }

        const cleanData = _cleanPayload(oData, true, ['centroLogistico', 'usuario']);

        const response = await fetch(
            `${_baseContexto}PceCentroLogistico('${sID}')`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(cleanData)
            }
        );

        if (!response.ok) {
            throw await _errorDeRespuesta(response);
        }

        return await response.json();
    }

    async function crearPmAprobadorCentro(oData) {
        const cleanData = _cleanPayload(oData);

        const response = await fetch(
            `${_baseContexto}PmAprobadorCentro`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(cleanData)
            }
        );

        if (!response.ok) {
            throw await _errorDeRespuesta(response);
        }

        return await response.json();
    }

    async function actualizarPmAprobadorCentro(oData) {
        const sID = oData.ID;
        if (!sID) {
            throw new Error("ID is required for update operation");
        }

        const cleanData = _cleanPayload(oData, true, ['centroLogistico']);

        const response = await fetch(
            `${_baseContexto}PmAprobadorCentro('${sID}')`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(cleanData)
            }
        );

        if (!response.ok) {
            throw await _errorDeRespuesta(response);
        }

        return await response.json();
    }

    async function eliminarRegistro(sEntitySet, sID) {
        if (!sID) {
            throw new Error("ID is required for delete operation");
        }

        const response = await fetch(
            `${_baseContexto}${sEntitySet}('${sID}')`,
            {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        if (!response.ok) {
            throw await _errorDeRespuesta(response);
        }

        return { success: true };
    }

    // Baja/alta lógica: PATCH solo del flag "activo". Reemplaza el DELETE, que el backend no permite.
    async function cambiarActivo(sEntitySet, sID, bActivo) {
        if (!sID) {
            throw new Error("ID is required for status change");
        }

        const response = await fetch(
            `${_baseContexto}${sEntitySet}('${sID}')`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ activo: bActivo })
            }
        );

        if (!response.ok) {
            throw await _errorDeRespuesta(response);
        }

        return { success: true };
    }

    function _cleanPayload(oData, bIsUpdate = false, aImmutableFields = []) {
        const aFieldsToExclude = [
            "createdAt", "createdBy", "modifiedAt", "modifiedBy", "ID",
            "title", "isEditing", "descripcion"
        ];

        if (bIsUpdate) {
            aFieldsToExclude.push(...aImmutableFields);
        }

        const cleanData = {};

        Object.keys(oData).forEach(key => {
            if (!aFieldsToExclude.includes(key) && oData[key] !== undefined) {
                cleanData[key] = oData[key];
            }
        });

        // Normalizar strings a mayúsculas para campos clave.
        if (cleanData.centroLogistico) {
            cleanData.centroLogistico = String(cleanData.centroLogistico).trim().toUpperCase();
        }
        if (cleanData.usuario) {
            cleanData.usuario = String(cleanData.usuario).trim().toUpperCase();
        }
        if (cleanData.aprobadorUsuario) {
            cleanData.aprobadorUsuario = String(cleanData.aprobadorUsuario).trim().toUpperCase();
        }
        if (cleanData.aprobadorSuplenteUsuario) {
            cleanData.aprobadorSuplenteUsuario = String(cleanData.aprobadorSuplenteUsuario).trim().toUpperCase();
        }

        return cleanData;
    }

    async function searchVH(sEntitySet, sField, sValue) {
        const sValueUpper = sValue.toUpperCase();

        const response = await fetch(
            `${_baseContexto}${sEntitySet}?$filter=contains(${sField},'${encodeURIComponent(sValueUpper.replace(/'/g, "''"))}')`
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        let aRows = data.value || [];

        if (sEntitySet === "CentroLogisticoVHSet") {
            aRows = aRows.map(oItem => ({
                codigo: oItem.Centro,
                descripcion: oItem.TextoBreve
            }));
        } else if (sEntitySet === "ZI_COA_USUARIO_VH") {
            aRows = aRows.map(oItem => ({
                codigo: oItem.Usuario,
                descripcion: oItem.NombreApellido,
                email: oItem.Email || ""
            }));
        }

        return aRows;
    }

    async function getAuditoria(oFiltros = {}) {
        const aCondiciones = [];

        if (oFiltros.usuario) {
            aCondiciones.push(`contains(ejecutadoPor,'${_escaparOData(oFiltros.usuario)}')`);
        }
        if (oFiltros.desde) {
            aCondiciones.push(`fecha ge ${oFiltros.desde}`);
        }
        if (oFiltros.hasta) {
            aCondiciones.push(`fecha le ${oFiltros.hasta}`);
        }
        if (oFiltros.tabla) {
            aCondiciones.push(`tabla eq '${_escaparOData(oFiltros.tabla)}'`);
        }
        if (oFiltros.centroLogistico) {
            aCondiciones.push(`contains(centroLogistico,'${_escaparOData(oFiltros.centroLogistico)}')`);
        }

        // Tope de filas para que el log no crezca sin límite en la vista.
        let sUrl = `${_baseContexto}ContextoAuditoria?$orderby=fecha%20desc&$top=${LIMITE_AUDITORIA}`;
        if (aCondiciones.length) {
            sUrl += `&$filter=${encodeURIComponent(aCondiciones.join(" and "))}`;
        }

        const response = await fetch(sUrl);
        if (!response.ok) {
            throw await _errorDeRespuesta(response);
        }

        const data = await response.json();
        return data.value || [];
    }

    function _escaparOData(sValor) {
        return String(sValor).trim().replace(/'/g, "''");
    }

    return {
        init: function (base) { _baseContexto = base; },
        crearPceCentroLogistico: crearPceCentroLogistico,
        actualizarPceCentroLogistico: actualizarPceCentroLogistico,
        crearPmAprobadorCentro: crearPmAprobadorCentro,
        actualizarPmAprobadorCentro: actualizarPmAprobadorCentro,
        eliminarRegistro: eliminarRegistro,
        cambiarActivo: cambiarActivo,
        searchVH: searchVH,
        getAuditoria: getAuditoria,
        LIMITE_AUDITORIA: LIMITE_AUDITORIA,
        getPermisos: async function () {
            const response = await fetch(`${_baseContexto}Permisos`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            return data.value || [];
        },

        getPceCentroLogisticoData: async function () {
            try {
                const response = await fetch(`${_baseContexto}PceCentroLogistico`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                return data.value || [];
            } catch (error) {
                console.error("Error fetching PceCentroLogistico data:", error);
                throw error;
            }
        },

        getPmAprobadorCentroData: async function () {
            try {
                const response = await fetch(`${_baseContexto}PmAprobadorCentro`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                return data.value || [];
            } catch (error) {
                console.error("Error fetching PmAprobadorCentro data:", error);
                throw error;
            }
        },

        getData: async function () {
            const endpoints = [
                { base: _baseContexto, off: "PceCentroLogistico" },
                { base: _baseContexto, off: "PmAprobadorCentro" }
            ];

            const results = await Promise.all(
                endpoints.map(endpoint => fetchEndpoint(endpoint.base + endpoint.off))
            );

            const formattedData = {};

            endpoints.forEach((endpoint, index) => {
                formattedData[endpoint.off] = results[index];
            });

            return formattedData;
        }
    };
});
