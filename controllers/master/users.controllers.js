const table = require('../../config/table')
const { queryPOST, queryPUT, queryGET } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const uuidToId = require('../../helpers/uuidToId')
const idToUuid = require('../../helpers/idToUuid')
const security = require('../../helpers/security')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const attrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')
const condDataNotDeleted = `deleted_dt IS NULL`

const moment = require('moment')
const queryHandler = require('../queryhandler.function')

module.exports = {
    getData: async(req, res) => {
        try {
            let cols = ['uuid as user_id', 'user_nm', 'noreg']

            let containerFilter = queryHandler(req.query)
            containerFilter.length > 0 ? containerFilter = "WHERE " + containerFilter.join(" AND ") : containerFilter = ""

            const users = await queryGET(table.tb_m_users, `${containerFilter}`, cols)
            response.success(res, 'Success to get users', users)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get users')
        }
    },
    postUser: async(req, res) => {
        try {
            console.log(req.body);
            let idLast = await getLastIdData(table.tb_m_users, 'user_id') + 1
            req.body.user_id = idLast
            req.body.uuid = req.uuid()
            let unreadPassword = await security.encryptPassword(req.body.user_password)
            req.body.user_password = unreadPassword
            let attrsUserInsert = await attrsUserInsertData(req, req.body)
            const result = await queryPOST(table.tb_m_users, attrsUserInsert)
            response.success(res, 'Success to add user', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    editUser: async(req, res) => {
        try {
            console.log(req.body);
            let id = await uuidToId(table.tb_m_users, 'user_id', req.params.id)
            let idLine = await uuidToId(table.tb_m_lines, 'line_id', req.body.line_id)
            let idGroup = await uuidToId(table.tb_m_groups, 'group_id', req.body.group_id)
            req.body.line_id = idLine
            req.body.group_id = idGroup
                // let unreadPassword = await security.encryptPassword(req.body.password)
                // req.body.password = unreadPassword

            const attrsUserUpdate = await attrsUserUpdateData(req, req.body)
            const result = await queryPUT(table.tb_m_users, attrsUserUpdate, `WHERE user_id = '${id}'`)
            response.success(res, 'Success to edit user', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    },
    deleteUser: async(req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_users, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)
            response.success(res, 'Success to soft delete user', result)
        } catch (error) {
            console.log(error);
            response.failed(res, error)
        }
    }
}