const table = require('../../config/table')
const { queryPOST, queryPUT, queryGET, queryCustom } = require('../../helpers/query')
const response = require('../../helpers/response')
const queryHandler = require('../queryhandler.function')


module.exports = {
    statusTpm: async(req, res) => {
        try {
            let containerFilter = queryHandler(req.query)
            containerFilter.length > 0 ? containerFilter = containerFilter.join(" AND ") : containerFilter = ""
            let status = await queryGET(table.tb_m_status, `WHERE deleted_dt is null ORDER BY created_dt ASC`, ['status_id, status_nm, color_tag'])
            let mapStatus = status.map(async(status) => {
                let count = await queryCustom(`SELECT COUNT(ledger_itemcheck_id) FROM v_schedules_monthly WHERE status_nm = '${status.status_nm}' AND ${containerFilter}`)
                status.count = +count.rows[0].count
                return status
            })
            let waitStatus = await Promise.all(mapStatus)
            response.success(res, 'Success to get status tpm', waitStatus)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get status tpm')
        }
    },
    statusTpmOpt: async(req, res) => {
        try {
            let status = await queryGET(table.tb_m_status, 'WHERE deleted_dt is null ORDER BY created_dt ASC', ['uuid as status_id', 'status_nm, color_tag'])
            response.success(res, 'Success to get status', status)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get status')
        }
    }
}