const table = require('../../config/table')
const { queryPOST, queryPUT, queryGET, queryCustom, queryBulkPOST } = require('../../helpers/query')

const response = require('../../helpers/response')
const { groupFunction } = require('../../functions/groupFunction')
const queryHandler = require('../queryhandler.function')
const getLastIdData = require('../../helpers/getLastIdData')
const { v4 } = require('uuid')
const { uuid } = require('uuidv4')
const {getCurrentDateTime} = require('../../functions/getCurrentDateTime')

async function uuidToId(table, col, uuid) {
    console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
    // `SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`
    let rawId = await queryGET(table, `WHERE uuid = '${uuid}'`, [col])
    return rawId[0][col]
}

module.exports = {
    getLedgers: async (req, res) => {
        try {
            let data = queryHandler(req.query)
            console.log(data.length);
            let line_id = req.query.line_id
            let machine_id = req.query.machine_id
            console.log(line_id, machine_id);
            if(line_id!='null' && machine_id!='null' && data.length != 0){
                let line_id = await uuidToId(table.tb_m_lines, 'line_id', req.query.line_id)            
                let machine_id = await uuidToId(table.tb_m_machines, 'machine_id', req.query.machine_id)
                whereCond = `AND tml.line_id=${line_id} AND tmm.machine_id=${machine_id}`
            }else if(line_id != 'null' && machine_id == 'null' && data.length != 0){
                let line_id = await uuidToId(table.tb_m_lines, 'line_id', req.query.line_id)            
                whereCond = `AND tml.line_id=${line_id}`
            }else if(line_id == 'null' && machine_id != 'null' && data.length != 0){
                let machine_id = await uuidToId(table.tb_m_machines, 'machine_id', req.query.machine_id)
                whereCond = `AND tmm.machine_id=${machine_id}`
            }else if(data.length == 0){
                whereCond = ``
            }

            console.log(whereCond);            

            let q = `
            SELECT
                tmls.ledger_id,
                tmm.machine_nm,
                tml.line_id,
                tml.line_nm,
                COUNT(itemcheck_id)::int AS num_item_checks          
            FROM
                tb_m_machines tmm
            JOIN
                tb_m_ledgers tmls ON tmls.machine_id = tmm.machine_id
            LEFT JOIN
                tb_r_ledger_itemchecks trli  ON trli.ledger_id = tmm.machine_id	
            JOIN
                tb_m_lines tml ON tml.line_id = tmm.line_id 
            WHERE
                tmm.deleted_by IS NULL ${whereCond} AND trli.deleted_by IS NULL
            GROUP BY
                tmls.ledger_id, 
                tmm.machine_nm,
                tml.line_id, 
                tml.line_nm              
            ORDER BY 
                tmls.ledger_id
            `

            let qtyItemcheckAtLedger = (await queryCustom(q)).rows
            response.success(res, "success to get ledgers", qtyItemcheckAtLedger)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get schedules')
        }
    },
    getDetail: async(req, res) => {
        try {
            let idLedger = Number(req.query.ledger_id);
            let q = `
            SELECT 
                tmi.*,
                tmm.machine_nm, 
                tmi.itemcheck_nm, 
                tmi.val_periodic, 
                tmp.period_nm, 
                tmi.duration, 
                tmi.standard_measurement, 
                tmi.method_check,
                tmi.itemcheck_loc,
                tmi.mp,
                tmi.details,
                tmi.period_id,
                trli.ledger_itemcheck_id,
                -- COALESCE(CAST(trs.plan_check_dt AS DATE), '0001-01-01') AS plan_check_dt,
                tmi.itemcheck_id,
                tmn.incharge_nm,                
                trli.lifespan_counter,
                trli.is_counter
                -- trs.schedule_id 
            FROM 
                tb_r_ledger_itemchecks trli 
            JOIN 
                tb_m_ledgers tml ON trli.ledger_id = tml.ledger_id 
            JOIN 
                tb_m_machines tmm ON tml.machine_id = tmm.machine_id 
            JOIN 
                tb_m_itemchecks tmi ON trli.itemcheck_id = tmi.itemcheck_id 
            LEFT JOIN 
                tb_m_periodics tmp ON tmi.period_id = tmp.period_id
            JOIN
                tb_m_incharge tmn ON tmi.incharge_id = tmn.incharge_id
            -- LEFT JOIN 
            --    tb_r_schedules trs ON trli.ledger_itemcheck_id = trs.ledger_itemcheck_id
            WHERE 
                tml.ledger_id = ${idLedger} AND trli.deleted_by IS NULL
            ORDER BY 
                tmi.itemcheck_nm
        
            `
            console.log(q);
            let detailsIc = (await queryCustom(q)).rows;            
            console.log(detailsIc);
            response.success(res, 'Success to get ItemChecks', detailsIc)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get schedules')
        }
    },
    getUpdate: async(req, res) => {
        let q = `
            SELECT*,
                tmm.machine_nm,
                tmp.period_nm
            FROM tb_r_ledger_added trla
            JOIN tb_m_machines tmm ON trla.ledger_id = tmm.machine_id
            LEFT JOIN tb_m_periodics tmp ON tmp.period_id = trla.period_id
            WHERE trla.approval = false
        `
        let updateData = (await queryCustom(q)).rows
        console.log(updateData);
        response.success(res, 'succes to get updated item', updateData)
    },
    newLedger: async(req, res) => {
        try {
            let ledgerData = req.body
            ledgerData.changed_dt = getCurrentDateTime()
            ledgerData.created_dt = getCurrentDateTime()
            ledgerData.machine_id = await getLastIdData(table.tb_m_machines, 'machine_id')
            ledgerData.changed_by = 'USER'
            ledgerData.created_by = 'USER'

            let newMachine = {
                machine_id: ledgerData.machine_id,
                machine_nm: ledgerData.machine_nm,
                changed_dt: getCurrentDateTime(),
                created_dt: getCurrentDateTime(),
                changed_by: 'USER',
                created_by: 'USER',
                uuid: v4(),
                line_id: ledgerData.line_id
            }

            const machine = await queryPOST(table.tb_m_machines, newMachine)

            let newLedger = {
                ledger_id: ledgerData.machine_id,
                machine_id: ledgerData.machine_id,
                changed_dt: getCurrentDateTime(),
                created_dt: getCurrentDateTime(),
                changed_by: 'USER',
                created_by: 'USER',
                uuid: v4(),
                last_counter: 0,
            }

            console.log(newMachine);
            console.log(newLedger);

            const ledger = await queryPOST(table.tb_m_ledgers, newLedger)

        } catch (error) {
            console.log(error);
        }
    }
}