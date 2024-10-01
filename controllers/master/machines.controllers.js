const table = require('../../config/table')
const { queryPOST, queryPUT, queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
    // const uuidToId = require('../../helpers/uuidToId')
const idToUuid = require('../../helpers/idToUuid')
const security = require('../../helpers/security')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const attrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const queryHandler = require('../queryhandler.function')
const { database } = require('../../config/database')
const condDataNotDeleted = `WHERE deleted_dt IS NULL`

const uuidToId = async(table, col, uuid) => {
    console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
    let rawId = await database.query(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`)
    return rawId.rows[0][col]
}

module.exports = {
    getData: async(req, res) => {
        try {
            req.body.line_id = req.body.line_id != -1 ? await uuidToId(table.tb_m_lines, 'line_id', req.body.line_id) : -1;
            let containerFilter = queryHandler(req.body)
            const machines = await queryGET(table.tb_m_machines, `${condDataNotDeleted} ${containerFilter.length > 0 ? 'AND ' + containerFilter.join(" AND ") : ''}`)
            response.success(res, 'ok', machines)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    addData: async(req, res) => {
        try {
            // 
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editData: async(req, res) => {
        try {
            // 
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deleteData: async(req, res) => {
        try {
            // 
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }
}