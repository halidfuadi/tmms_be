const table = require('../../config/table')
const { queryPOST, queryPUT, queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const idToUuid = require('../../helpers/idToUuid')
const security = require('../../helpers/security')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const attrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const queryHandler = require('../queryhandler.function')
const condDataNotDeleted = `WHERE deleted_dt IS NULL`


module.exports = {
    getData: async(req, res) => {
        try {
            let containerFilter = queryHandler(req.query)
            const lines = await queryGET(table.tb_m_lines, `${condDataNotDeleted}`)
            response.success(res, 'ok', lines)
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