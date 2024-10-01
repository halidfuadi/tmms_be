const table = require('../../config/table')
const { queryPOST, queryPUT, queryGET, queryCustom } = require('../../helpers/query')
const response = require('../../helpers/response')
const queryHandler = require('../queryhandler.function')

async function uuidToId(table, col, uuid) {
    console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
    // `SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`
    let rawId = await queryGET(table, `WHERE uuid = '${uuid}'`, [col])
    return rawId[0][col]
}

module.exports = {
    getData: async(req, res) => {
        try {
            let containerFilter = await queryHandler(req.query)
            containerFilter.length > 0 ? containerFilter = 'WHERE ' + containerFilter.join(" AND ") : containerFilter = ""
            let itemcheckStd = await queryGET(table.tb_m_itemcheck_std, containerFilter, ['uuid as itemcheck_std_id, ok_val, ng_val, is_number'])
            response.success(res, 'Success to get Data itemcheck std', itemcheckStd)
        } catch (error) {
            console.error(error)
            response.failed(res, 'Error to get Data itemcheck std')
        }
    }
}