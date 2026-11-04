    sap.ui.define([], function () {
    "use strict";

    let _baseContexto = "/abm-contexto/";

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
        console.log(cleanData)
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
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
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
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(cleanData)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
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
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
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
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(cleanData)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
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
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
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

        return cleanData;
    }

    async function searchVH(sEntitySet, sField, sValue) {
        const sValueUpper = sValue.toUpperCase();

        const response = await fetch(
            `${_baseContexto}${sEntitySet}?$filter=contains(${sField},'${encodeURIComponent(sValueUpper)}')`
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

    return {
        init: function (base) { _baseContexto = base; },
        crearPceCentroLogistico: crearPceCentroLogistico,
        actualizarPceCentroLogistico: actualizarPceCentroLogistico,
        crearPmAprobadorCentro: crearPmAprobadorCentro,
        actualizarPmAprobadorCentro: actualizarPmAprobadorCentro,
        eliminarRegistro: eliminarRegistro,
        searchVH: searchVH,

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
