const table = require('../../config/table')
const { queryPOST, queryPUT, queryGET, queryCustom } = require('../../helpers/query')
const queryHandler = require('../queryhandler.function')
const response = require('../../helpers/response');

async function uuidToId(table, col, uuid) {
    console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
    // `SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`
    let rawId = await queryGET(table, `WHERE uuid = '${uuid}'`, [col])
    return rawId[0][col]
}

module.exports = {
    getHistory: async(req, res) => {
        try {
            let containerFilter = queryHandler(req.query)
            containerFilter.length > 0 ? containerFilter = 'WHERE ' + containerFilter.join(" AND ") : containerFilter = ""
            const historyData = await queryGET(table.v_tpm_history, containerFilter + ' ORDER BY plan_check_dt DESC')
            response.success(res, 'success to get history', historyData)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get history')
        }
    },

    getNewItem: async(req, res) => {
        try {
            let q = `
                SELECT
                    trla.*,
                    tmm.machine_nm,
                    tmp.period_nm,
                    CASE
                        WHEN trla.approval = TRUE THEN 'APPROVED'
                        ELSE 'NOT APPROVED'
                    END AS approval_status
                FROM tb_r_ledger_added trla
                JOIN tb_m_machines tmm ON tmm.machine_id = trla.ledger_id
                JOIN tb_m_periodics tmp ON tmp.period_id = trla.period_id
            `
            const newItemData = (await queryCustom(q)).rows
            console.log(newItemData);
            response.success(res, 'success to get history added item', newItemData)
        } catch (error) {            
            console.log(error);
        }
    },
    getEditItem: async(req, res) => {
        try {
            let q = `
                SELECT
                    trlc.*,
                    tmm.machine_nm,
                    tmp.period_nm,
                    CASE
                        WHEN trlc.approval = TRUE THEN 'APPROVED'
                        ELSE 'NOT APPROVED'
                    END AS approval_status
                FROM tb_r_ledger_changes trlc
                JOIN tb_m_machines tmm ON tmm.machine_id = trlc.ledger_id
                JOIN tb_m_periodics tmp ON tmp.period_id = trlc.period_id_old
            `
            const newItemData = (await queryCustom(q)).rows
            console.log(newItemData);
            response.success(res, 'success to get history added item', newItemData)
        } catch (error) {            
            console.log(error);
        }
    }
}