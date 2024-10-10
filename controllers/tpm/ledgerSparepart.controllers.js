const table = require('../../config/table')
const {
    queryPOST,
    queryPUT,
    queryGET,
    queryCustom,
    queryBulkPOST,
    queryDELETE,
    querySoftDELETE, queryTransaction, mapBulkValues
} = require('../../helpers/query')
const response = require('../../helpers/response')
const {groupFunction} = require('../../functions/groupFunction')
const queryHandler = require('../queryhandler.function')
const getLastIdData = require('../../helpers/getLastIdData')
const {getCurrentDateTime} = require('../../functions/getCurrentDateTime')
const {v4} = require('uuid')
const moment = require('moment');

const ledgerSparepartServices = require("../../services/ledgerSparepart.service");


module.exports = {
    ledgerSparepartGet: async (req, res) => {
        try {
            let containerFilter = queryHandler(req.query);
            containerFilter.length > 0
                ? (containerFilter = containerFilter.join(" AND "))
                : (containerFilter = "");

            const result = await queryGET(table.v_sparepart_detail, `WHERE deleted_dt is null ${containerFilter ? `and ${containerFilter}` : ''}`)
            response.success(res, "Success to get ledger sparepart", result)
        } catch (error) {
            console.log(error);
            response.failed(res, "failed get ledger sparepart")
        }
    },
    ledgerSparepartGetSingle: async (req, res) => {
        try {
            let filter = req.query
            console.log(filter);
            let q = `
                select 
                tms.*
                from 
                    tb_r_ledger_spareparts trls
                    join tb_m_spareparts tms on tms.sparepart_id = trls.sparepart_id
                    join tb_r_ledger_itemchecks trli on trls.ledger_itemcheck_id = trli.ledger_itemcheck_id
                    join tb_m_ledgers tml on trli.ledger_id = tml.ledger_id
                where ${/^-?\d+$/.test(filter.ledger_id) ? `tml.ledger_id = ${filter.ledger_id}` : `tml.uuid = '${filter.ledger_id}'`}
            `

            let dataSparepart = (await queryCustom(q)).rows
            console.log(dataSparepart);
            response.success(res, "success to get data", dataSparepart)
        } catch (error) {
            console.log(error);
            response.failed(res, "failed get sparepart data")
        }
    },
    ledgerSparepartDelete: async (req, res) => {
        try {
            let wCond = `where uuid = '${req.params.uuid}'`

            const findExists = await queryGET(
                table.tb_r_ledger_spareparts,
                wCond
            );

            if (findExists && findExists.length === 0) {
                response.error(res, "Error to delete item check, item check not found");
                return;
            }

            await querySoftDELETE(
                table.tb_r_ledger_spareparts,
                wCond.replace("where", " "),
                'user'
            )

            response.success(res, 'Success to delete sparepart item check')
        } catch (error) {
            console.log(error);
            response.failed(res, {
                message: "Error to delete sparepart item check",
                error: error,
            });
        }
    },
    ledgerSparepartCreate: async (req, res) => {
        try {
            let data = req.body
            if (Array.isArray(data) && data.length === 0) {
                response.error(res, "Masukkan data yang ingin ditambahkan");
                return;
            }

            await queryTransaction(async (db) => {
                await ledgerSparepartServices.ledgerSparepartInsertBulk(db, data);
            });

            response.success(res, 'sucess add sparepart')
        } catch (error) {
            console.log(error);
            response.error(res, error)
        }
    }
}