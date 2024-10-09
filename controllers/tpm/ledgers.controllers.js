const table = require('../../config/table')
const {queryPOST, queryPUT, queryGET, queryCustom, queryBulkPOST} = require('../../helpers/query')

const response = require('../../helpers/response')
const {groupFunction} = require('../../functions/groupFunction')
const queryHandler = require('../queryhandler.function')
const getLastIdData = require('../../helpers/getLastIdData')
const {v4} = require('uuid')
const {uuid} = require('uuidv4')
const {getCurrentDateTime} = require('../../functions/getCurrentDateTime')

async function uuidToId(table, col, uuid) {
    console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
    // `SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`
    let rawId = await queryGET(table, `WHERE uuid = '${uuid}'`, [col])
    return rawId[0][col]
}

const ledgerRawSql = (containerFilter, paginate = {}) => {
    const rawAll = `tmm.uuid  as machine_id,
                            tml.uuid  as line_id,
                            tmls.uuid as ledger_id,
                            tmm.machine_nm,
                            tml.line_nm,
                            trli.num_item_checks,
                            tmm.created_dt`;

    let rowNumb = paginate ? `row_number() over(order by created_dt desc)::INTEGER as no,` : '';
    const sql = (isCount = false) => (
        `select 
            ${isCount ? 'count(*)' : rowNumb + '*'}  
            from (
                select
                    ${rawAll} 
                from
                    ${table.tb_m_machines} tmm
                    join ${table.tb_m_ledgers} tmls on tmls.machine_id = tmm.machine_id
                    join ${table.tb_m_lines} tml on tml.line_id = tmm.line_id
                    left join lateral (select
                                           count(*) as num_item_checks
                                       from
                                           ${table.tb_r_ledger_itemchecks} trli1
                                       where
                                             trli1.ledger_id = tmm.machine_id
                                             and trli1.deleted_dt is null) trli on true
                where tmm.deleted_by is null
            ) a`
    );

    const where = `where 1 = 1 ${containerFilter ? `and ${containerFilter}` : ''}`;

    let orderBy = ``;
    if (paginate && Object.keys(paginate).length > 0) {
        orderBy = `order by created_dt desc limit ${paginate.limit} offset ${paginate.offset}`;
    }

    return {
        sql: sql,
        where,
        orderBy
    }
}

const newLedgerRawSql = (containerFilter, paginate = {}) => {
    const rawAll = `tmm.uuid  as machine_id,
                            tml.uuid  as line_id,
                            tmls.uuid as ledger_id,
                            tmm.machine_nm,
                            tml.line_nm,
                            trli.num_item_checks,
                            tmm.created_dt`;

    let rowNumb = paginate ? `row_number() over(order by created_dt desc)::INTEGER as no,` : '';
    const sql = (isCount = false) => (
        `select 
            ${isCount ? 'count(*)' : rowNumb + '*'}  
            from (
                select
                    ${rawAll} 
                from
                    ${table.tb_m_machines} tmm
                    join ${table.tb_m_ledgers} tmls on tmls.machine_id = tmm.machine_id
                    join ${table.tb_m_lines} tml on tml.line_id = tmm.line_id
                    left join lateral (select
                                           count(*) as num_item_checks
                                       from
                                           ${table.tb_r_ledger_itemchecks} trli1
                                       where
                                             trli1.ledger_id = tmm.machine_id
                                             and trli1.deleted_dt is null) trli on true
                where tmm.deleted_by is null
            ) a`
    );

    const where = `where 1 = 1 ${containerFilter ? `and ${containerFilter}` : ''}`;

    let orderBy = ``;
    if (paginate && Object.keys(paginate).length > 0) {
        orderBy = `order by created_dt desc limit ${paginate.limit} offset ${paginate.offset}`;
    }

    return {
        sql: sql,
        where,
        orderBy
    }
};

module.exports = {
    getLedgers: async (req, res) => {
        try {
            let containerFilter = queryHandler(req.query)
            /*console.log(data.length);
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

            console.log(whereCond);*/

            containerFilter.length > 0
                ? (containerFilter = containerFilter.join(" AND "))
                : (containerFilter = "");

            const limit = req.query.limit ? parseInt(req.query.limit) : null; // Default limit is 10
            const page = req.query.page ? parseInt(req.query.page) : null; // Default page is 1
            const offset = limit && page ? (page - 1) * limit : null;

            const {sql, where, orderBy} = ledgerRawSql(containerFilter, limit && page ? {
                limit,
                offset
            } : null);

            const raw = `${sql()} ${where} ${orderBy}`;
            let qtyItemcheckAtLedger = (await queryCustom(raw)).rows

            if (limit && page) {
                const rawCount = `${sql(true)} ${where}`;
                const countRows = await queryCustom(rawCount);

                response.successPaginate(
                    res,
                    "success to get ledgers",
                    qtyItemcheckAtLedger,
                    {
                        page,
                        limit,
                        totalPages: Math.ceil(parseInt(countRows?.rows ? countRows.rows[0].count : 0) / limit),
                        total: parseInt(countRows?.rows ? countRows.rows[0].count : 0),
                    }
                );
            } else {
                response.success(res, "success to get ledgers", qtyItemcheckAtLedger)
            }
        } catch (error) {
            console.log(error);
            response.failed(res, {
                message: 'Error to get ledgers',
                error: error,
            })
        }
    },
    getDetail: async (req, res) => {
        try {
            let idLedger = req.query.ledger_id;
            let q = `
            SELECT 
                trli.uuid as ledger_itemcheck_id,
                tmm.uuid as machine_id,
                tml.uuid as ledger_id,
                tmi.uuid as itemcheck_id,
                tmp.uuid as periodic_id,
                tmn.uuid as incharge_id,
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
                -- trli.ledger_itemcheck_id,
                -- COALESCE(CAST(trs.plan_check_dt AS DATE), '0001-01-01') AS plan_check_dt,
                tmn.incharge_nm,                
                trli.lifespan_counter,
                trli.is_counter
                ,tmlns.line_nm
                ,tmi.lower_limit
                ,tmi.upper_limit
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
            JOIN 
                tb_m_lines tmlns on tmlns.line_id = tmm.line_id
            -- LEFT JOIN 
            --    tb_r_schedules trs ON trli.ledger_itemcheck_id = trs.ledger_itemcheck_id
            WHERE 
              ${/^-?\d+$/.test(idLedger) ? `tml.ledger_id = ${idLedger}` : `tml.uuid = '${idLedger}'`} AND trli.deleted_by IS NULL
            ORDER BY 
                tmi.itemcheck_nm
        
            `
            console.log(q);
            let detailsIc = (await queryCustom(q)).rows;
            console.log(detailsIc);
            response.success(res, 'Success to get ItemChecks', detailsIc)
        } catch (error) {
            console.log(error);
            response.failed(
                res,
                {
                    message: 'Error to get ItemChecks',
                    error: error
                }
            )
        }
    },
    getUpdate: async (req, res) => {
        try {
            const isCount = req.query.count && req.query.count === true;

            const rawAll = `*, tmm.machine_nm, tmp.period_nm`;
            let q = `
            SELECT 
                ${isCount ? 'count(*) as total' : rawAll}
            FROM tb_r_ledger_added trla
            JOIN tb_m_machines tmm ON trla.ledger_id = tmm.machine_id
            LEFT JOIN tb_m_periodics tmp ON tmp.period_id = trla.period_id
            WHERE trla.approval = false
        `
            let updateData = (await queryCustom(q)).rows
            console.log(updateData);
            response.success(res, 'succes to get new item request', updateData)
        } catch (e) {
            console.log(e);
            response.failed(res, {
                message: 'Error to get new item request',
                error: e,
            })
        }
    },
    newLedger: async (req, res) => {
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