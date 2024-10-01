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
    getFindings: async(req, res) => {
        try {
            let containerFilter = queryHandler(req.query)
            containerFilter.length > 0 ? containerFilter = 'WHERE ' + containerFilter.join(" AND ") : containerFilter = ""
            const findingsData = await queryGET(table.v_tpm_findings, containerFilter)
            response.success(res, 'Success to get findings', findingsData)
        } catch (error) {
            response.failed(res, 'Error to get findings')
        }
    },
    editFinding: async(req, res) => {
        try {
            let data = req.body
            const finding_id = await uuidToId(table.tb_r_finding_checks, 'finding_id', req.params.finding_id)
            console.log(data);
            console.log(finding_id);
            // STATUS done
            data.status_id = 4
            const findingRes = await queryPUT(table.tb_r_finding_checks, data, `WHERE finding_id = ${finding_id}`)
            response.success(res, 'Success to get findings', findingRes)
        } catch (error) {
            response.failed(res, 'Error to edit findings')
        }
    }
}