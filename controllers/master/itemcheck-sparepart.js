const table = require('../../config/table')
const { queryPOST, queryPUT, queryGET, queryCustom, queryBulkPOST, queryDELETE, querySoftDELETE } = require('../../helpers/query')
const moment = require('moment')
const response = require('../../helpers/response')
const { groupFunction } = require('../../functions/groupFunction')
const queryHandler = require('../queryhandler.function')
const getLastIdData = require('../../helpers/getLastIdData')
const { v4 } = require('uuid')

async function uuidToId(table, col, uuid) {
    console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
    // `SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`
    let rawId = await queryGET(table, `WHERE uuid = '${uuid}'`, [col])
    return rawId[0][col]
}


module.exports = {
    addItemCheckSparepart: async (req, res) => {
        try {
            let created_dt = moment().format('YYYY-MM-DD');
            req.body.created_dt = created_dt;
            await queryPOST(table.tb_m_itemcheck_spareparts, req.body)
            response.success(res, 'sucess add data')

        } catch (error) {
            console.log(error);
            response.failed(res, "failed to add itemchek parts")
        }
    }

}