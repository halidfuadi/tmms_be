const table = require('../../config/table');
const getLastIdData = require('../../helpers/getLastIdData');
const {queryPOST, queryPUT, queryGET, queryCustom} = require('../../helpers/query')
const response = require('../../helpers/response')
const queryHandler = require('../queryhandler.function')
const {v4} = require('uuid');
const idToUuid = require('../../helpers/idToUuid');
const {cronGeneratorSchedule} = require('../../functions/cronGeneratorSchedule');
const {getCurrentDateTime} = require('../../functions/getCurrentDateTime')

async function uuidToId(table, col, uuid) {
    console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
    // `SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`
    let rawId = await queryGET(table, `WHERE uuid = '${uuid}'`, [col])
    return rawId[0][col]
}

const itemCheckRawSql = (containerFilter, paginate = {}) => {
    const rawAll = `tmi.uuid as itemcheck_id,
                trli.uuid as ledger_itemcheck_id,
                tmm.uuid as machine_id,
                tml.uuid as ledger_id,
                tmp.uuid as periodic_id,
                tmi.itemcheck_nm,
                tmm.machine_nm,
                tmp.period_nm,
                trli.current_counter,
                trli.lifespan_counter,
                trli.created_dt,
                tmi.val_periodic,
                tmi.duration, 
                tmi.standard_measurement, 
                tmi.method_check,
                tmi.itemcheck_loc,
                tmi.mp,
                tmi.details,
                tmi.lower_limit,
                tmi.upper_limit,
                tmm_1_count.total_machines,
                tmll.line_nm,
                trli.is_counter,
                trli.init_counter,
                trli.init_counter_dt,
                trli.est_dt,
                trli.current_counter`;

    let rowNumb = paginate ? `row_number() over(order by created_dt desc)::INTEGER as no,` : '';

    const sql = (isCount = false) => (
        `select 
            ${isCount ? 'count(*)' : rowNumb + '*'}  
            from (
                     select
                        ${rawAll} 
                    from
                        ${table.tb_r_ledger_itemchecks} trli
                            join ${table.tb_m_itemchecks} tmi ON tmi.itemcheck_id = trli.itemcheck_id
                            join ${table.tb_m_ledgers} tml ON tml.ledger_id = trli.ledger_id
                            join ${table.tb_m_machines} tmm ON tmm.machine_id = tml.machine_id
                            join ${table.tb_m_lines} tmll on tmll.line_id = tmm.line_id
                            left join ${table.tb_m_periodics} tmp ON tmi.period_id = tmp.period_id
                            left join lateral (
                                                select 
                                                    count(*) as total_machines 
                                               from 
                                                    ${table.tb_m_machines} tmm_1
                                               where 
                                                    tmm_1.machine_id = tmm.machine_id
                                                    and tmm_1.deleted_dt is null
                                              ) tmm_1_count on true
                    where 
                        trli.deleted_by is null 
                        and trli.deleted_dt is null
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

module.exports = {
    getItemchecks: async (req, res) => {
        try {
            let containerFilter = queryHandler(req.query)
            containerFilter.length > 0
                ? (containerFilter = containerFilter.join(" AND "))
                : (containerFilter = "");

            const limit = req.query.limit ? parseInt(req.query.limit) : null; // Default limit is 10
            const page = req.query.page ? parseInt(req.query.page) : null; // Default page is 1
            const offset = limit && page ? (page - 1) * limit : null;

            const {sql, where, orderBy} = itemCheckRawSql(containerFilter, limit && page ? {
                limit,
                offset
            } : null);

            const raw = `${sql()} ${where} ${orderBy}`;
            const itemchecks = (await queryCustom(raw)).rows

            if (limit && page) {
                const rawCount = `${sql(true)} ${where}`;
                const countRows = await queryCustom(rawCount);

                response.successPaginate(
                    res,
                    'success to get itemchecks',
                    itemchecks,
                    {
                        page,
                        limit,
                        totalPages: Math.ceil(parseInt(countRows?.rows ? countRows.rows[0].count : 0) / limit),
                        total: parseInt(countRows?.rows ? countRows.rows[0].count : 0),
                    }
                )
            } else {
                response.success(
                    res,
                    'success to get itemchecks',
                    itemchecks
                )
            }
        } catch (error) {
            console.error(error)
            response.failed(res, {
                message: 'Error to get itemchecks',
                error: error,
            })
        }
    },
    getItemcheck: async (req, res) => {
        try {
            let containerFilter = queryHandler(req.query)
            containerFilter.length > 0 ? containerFilter = 'WHERE ' + containerFilter.join(" AND ") : containerFilter = ""
            const itemchecks = await queryGET(table.tb_m_itemchecks, containerFilter)
            response.success(res, 'success to get itemcheck', itemchecks)
        } catch (error) {
            console.error(error)
            response.failed(res, 'Error to get itemcheck')
        }
    },
    addItemCheck: async (req, res) => {
        try {
            let itemCheckData = req.body
            itemCheckData.itemcheck_id = await getLastIdData(table.tb_m_itemchecks, 'itemcheck_id')
            itemCheckData.ledger_itemcheck_id = await getLastIdData(table.tb_r_ledger_itemchecks, 'ledger_itemcheck_id')
            itemCheckData.changed_dt = getCurrentDateTime()
            itemCheckData.created_dt = getCurrentDateTime()
            itemCheckData.changed_by = 'USER'
            itemCheckData.created_by = 'USER'
            itemCheckData.uuid_item = v4()
            itemCheckData.uuid_ledger_item = v4()
            let test = await queryGET(table.tb_m_ledgers, `WHERE ledger_id = ${itemCheckData.ledger_id}`)
            console.log(test);


            let newItem = {}

            if (itemCheckData.period_id == null) {
                newItem = {
                    is_counter: true,
                    ledger_added_id: await getLastIdData(table.tb_r_ledger_added, 'ledger_added_id'),
                    ledger_itemcheck_id: itemCheckData.ledger_itemcheck_id,
                    uuid: itemCheckData.uuid_item,
                    ledger_id: itemCheckData.ledger_id,
                    itemcheck_id: itemCheckData.itemcheck_id,
                    created_by: itemCheckData.created_by,
                    created_dt: itemCheckData.created_dt,
                    changed_by: itemCheckData.changed_by,
                    changed_dt: itemCheckData.changed_dt,
                    // last_check_dt: '2000-01-01 00:00:00',                
                    approval: false,
                    reasons: itemCheckData.reasons,
                    itemcheck_nm: itemCheckData.itemcheck_nm,
                    itemcheck_loc: itemCheckData.itemcheck_loc,
                    method_check: itemCheckData.itemcheck_method,
                    duration: itemCheckData.duration,
                    mp: +itemCheckData.mp,
                    // initial_date: '2000-01-01 00:00:00',
                    itemcheck_std_id: 1,
                    standard_measurement: itemCheckData.standard_measurement,
                    incharge_id: await uuidToId(table.tb_m_incharge, 'incharge_id', itemCheckData.incharge_id),
                    details: itemCheckData.details,
                    condition: 'Waiting',
                    lifespan_counter: +itemCheckData.lifespan_counter,
                    init_counter: (await queryGET(table.tb_m_ledgers, `WHERE ledger_id = ${itemCheckData.ledger_id}`))[0].last_counter,
                    init_counter_dt: getCurrentDateTime(),
                }
            } else {
                newItem = {
                    is_counter: false,
                    ledger_added_id: await getLastIdData(table.tb_r_ledger_added, 'ledger_added_id'),
                    ledger_itemcheck_id: itemCheckData.ledger_itemcheck_id,
                    uuid: itemCheckData.uuid_item,
                    ledger_id: itemCheckData.ledger_id,
                    itemcheck_id: itemCheckData.itemcheck_id,
                    created_by: itemCheckData.created_by,
                    created_dt: itemCheckData.created_dt,
                    changed_by: itemCheckData.changed_by,
                    changed_dt: itemCheckData.changed_dt,
                    last_check_dt: itemCheckData.plan_check_dt,
                    approval: false,
                    reasons: itemCheckData.reasons,
                    period_id: itemCheckData.period_id,
                    itemcheck_nm: itemCheckData.itemcheck_nm,
                    itemcheck_loc: itemCheckData.itemcheck_loc,
                    method_check: itemCheckData.itemcheck_method,
                    duration: itemCheckData.duration,
                    mp: +itemCheckData.mp,
                    val_periodic: itemCheckData.val_period,
                    initial_date: itemCheckData.plan_check_dt,
                    itemcheck_std_id: 1,
                    standard_measurement: itemCheckData.standard_measurement,
                    incharge_id: await uuidToId(table.tb_m_incharge, 'incharge_id', itemCheckData.incharge_id),
                    details: itemCheckData.details,
                    condition: 'Waiting',
                }
            }


            if (itemCheckData.upper_limit) {
                newItem.upper_limit = +itemCheckData.upper_limit;
            }

            if (itemCheckData.lower_limit) {
                newItem.lower_limit = +itemCheckData.lower_limit;
            }

            console.log(newItem);
            const item = await queryPOST(table.tb_r_ledger_added, newItem)

            response.success(res, 'sucess add data')
        } catch (error) {
            console.log(error);
            response.failed(res, {
                message: 'Error to add data',
                error: error,
            })
        }
    },
    editItemCheck: async (req, res) => {
        try {
            let newData = req.body
            console.log(newData);
            let oldData = await queryGET(table.tb_m_itemchecks, `WHERE itemcheck_id = ${newData.itemcheck_id}`)
            console.log(oldData);
            oldData = oldData[0]
            let joinData = {
                ledger_changes_id: await getLastIdData(table.tb_r_ledger_changes, 'ledger_changes_id'),
                itemcheck_id: oldData.itemcheck_id,
                itemcheck_nm_old: oldData.itemcheck_nm,
                itemcheck_nm_new: newData.itemcheck_nm,
                details_new: newData.details,
                details_old: oldData.details,
                itemcheck_loc_old: oldData.itemcheck_loc,
                itemcheck_loc_new: newData.itemcheck_loc,
                mp_old: oldData.mp,
                mp_new: +newData.mp,
                period_id_old: oldData.period_id,
                period_id_new: +newData.period_id,
                method_check_old: oldData.method_check,
                method_check_new: newData.method_check,
                duration_old: oldData.duration,
                duration_new: +newData.duration,
                val_periodic_old: oldData.val_periodic,
                val_periodic_new: +newData.val_periodic,
                // initial_date: Intl.DateTimeFormat('en-US', {timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long'}).format(oldData.initial_date),
                initial_date: oldData.initial_date,
                created_by: 'SYSTEM',
                created_dt: getCurrentDateTime(),
                changed_by: 'USER',
                changed_dt: getCurrentDateTime(),
                incharge_id_old: oldData.incharge_id,
                incharge_id_new: await uuidToId(table.tb_m_incharge, 'incharge_id', newData.incharge_id),
                standard_measurement_old: oldData.standard_measurement,
                standard_measurement_new: newData.standard_measurement,
                approval: false,
                uuid: v4(),
                // last_check_dt: Intl.DateTimeFormat('en-US', {timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long'}).format(oldData.last_check_dt),
                last_check_dt: oldData.last_check_dt,
                itemcheck_std_id: oldData.itemcheck_std_id,
                ledger_id: newData.ledger_id,
                upper_limit_old: oldData.upper_limit !== null ? oldData.upper_limit : 0,
                upper_limit_new: +newData.upper_limit,
                lower_limit_old: oldData.lower_limit !== null ? oldData.lower_limit : 0,
                lower_limit_new: +newData.lower_limit,
                reason: newData.reason,
                is_counter: newData.is_counter
            }

            if (newData.is_counter) {
                joinData.lifespan_counter_new = +newData.lifespan_counter
                joinData.lifespan_counter_old = +oldData.lifespan_counter
            }

            console.log("HERE==================================");
            console.log(joinData);

            const insert = await queryPOST(table.tb_r_ledger_changes, joinData)

            console.log(joinData);

        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to Edit data')
        }
    },
    approveItemCheck: async (req, res) => {
        try {
            let item = req.body
            let q = `
                UPDATE tb_r_ledger_itemchecks
                SET
                    approval = false
                WHERE ledger_itemcheck_id = ${item.ledger_itemcheck_id}
            `
            let hasil = await queryCustom(q)
            response.success(res, 'data approved')
        } catch (error) {

        }
    },
    getUpdate: async (req, res) => {
        try {
            let q = `
                SELECT
                    trlc.*,
                    tmm.machine_nm
                FROM tb_r_ledger_changes trlc
                JOIN tb_m_machines tmm ON tmm.machine_id = trlc.ledger_id
                WHERE trlc.approval = false
            `
            let updated = (await queryCustom(q)).rows
            console.log("disini");
            console.log(updated);
            response.success(res, 'succes to get updated item', updated)
        } catch (error) {
            console.log(error);
        }
    },
    approvedItem: async (req, res) => {
        try {
            let data = req.body

            let newData = {
                period_id: data.period_id_new,
                uuid: await idToUuid(table.tb_m_itemchecks, 'itemcheck_id', data.itemcheck_id),
                itemcheck_nm: data.itemcheck_nm_new,
                itemcheck_loc: data.itemcheck_loc_new,
                method_check: data.method_check_new,
                duration: data.duration_new,
                mp: data.mp_new,
                val_periodic: data.val_periodic_new,
                initial_date: data.initial_date,
                changed_by: 'USER',
                changed_dt: getCurrentDateTime(),
                incharge_id: data.incharge_id_new,
                standard_measurement: data.standard_measurement_new,
                upper_limit: +data.upper_limit_new,
                lower_limit: +data.lower_limit_new,
                details: data.details_new,
                // lifespan_counter: +data.lifespan_counter_new
            }

            if (data.is_counter) {

            }

            const updated = await queryPUT(table.tb_m_itemchecks, newData, `WHERE itemcheck_id = ${data.itemcheck_id}`)
            let approve = {
                approval: true
            }
            const history = await queryPUT(table.tb_r_ledger_changes, approve, `WHERE ledger_changes_id = ${data.ledger_changes_id}`)
            response.success(res, 'Success to Update Data', updated)

        } catch (error) {
            console.log(error);
            response.error(res, `Error to Approve Data : ${error}`)
        }
    },
    approvedNewItem: async (req, res) => {
        try {
            let data = req.body
            console.log(data);

            let item = {}
            if (!data.is_counter) {
                item = {
                    itemcheck_id: await getLastIdData(table.tb_m_itemchecks, 'itemcheck_id'),
                    period_id: data.period_id,
                    uuid: v4(),
                    itemcheck_nm: data.itemcheck_nm,
                    itemcheck_loc: data.itemcheck_loc,
                    method_check: data.method_check,
                    duration: data.duration,
                    mp: data.mp,
                    val_periodic: data.val_periodic,
                    initial_date: data.initial_date,
                    created_by: 'SYSTEM',
                    created_dt: getCurrentDateTime(),
                    changed_by: 'SYSTEM',
                    changed_dt: getCurrentDateTime(),
                    incharge_id: data.incharge_id,
                    last_check_dt: data.last_check_dt,
                    itemcheck_std_id: data.itemcheck_std_id,
                    standard_measurement: data.standard_measurement,
                    details: data.details,
                }
            } else {
                item = {
                    itemcheck_id: await getLastIdData(table.tb_m_itemchecks, 'itemcheck_id'),
                    uuid: v4(),
                    itemcheck_nm: data.itemcheck_nm,
                    itemcheck_loc: data.itemcheck_loc,
                    method_check: data.method_check,
                    duration: data.duration,
                    mp: data.mp,
                    initial_date: "2000-01-01 00:00:00",
                    created_by: 'SYSTEM',
                    created_dt: getCurrentDateTime(),
                    changed_by: 'SYSTEM',
                    changed_dt: getCurrentDateTime(),
                    incharge_id: data.incharge_id,
                    last_check_dt: "2000-01-01 00:00:00",
                    itemcheck_std_id: data.itemcheck_std_id,
                    standard_measurement: data.standard_measurement,
                    details: data.details,
                }
            }

            if (data.lower_limit) {
                item.lower_limit = +data.lower_limit
            }

            if (data.upper_limit) {
                item.upper_limit = +data.upper_limit
            }

            console.log(item);

            const updateItemcheck = await queryPOST(table.tb_m_itemchecks, item)

            let ledgerItem = {}

            if (data.is_counter) {
                ledgerItem = {
                    is_counter: true,
                    ledger_itemcheck_id: await getLastIdData(table.tb_r_ledger_itemchecks, 'ledger_itemcheck_id'),
                    uuid: v4(),
                    ledger_id: data.ledger_id,
                    itemcheck_id: item.itemcheck_id,
                    created_by: 'SYSTEM',
                    created_dt: getCurrentDateTime(),
                    changed_by: 'SYSTEM',
                    changed_dt: getCurrentDateTime(),
                    last_check_dt: "2000-01-01 00:00:00",
                    lifespan_counter: +data.lifespan_counter,
                    init_counter: +data.init_counter,
                    init_counter_dt: data.init_counter_dt,
                }
            } else {
                ledgerItem = {
                    is_counter: false,
                    ledger_itemcheck_id: await getLastIdData(table.tb_r_ledger_itemchecks, 'ledger_itemcheck_id'),
                    uuid: v4(),
                    ledger_id: data.ledger_id,
                    itemcheck_id: item.itemcheck_id,
                    created_by: 'SYSTEM',
                    created_dt: getCurrentDateTime(),
                    changed_by: 'SYSTEM',
                    changed_dt: getCurrentDateTime(),
                    last_check_dt: data.last_check_dt,
                }
            }

            const updatedLedger = await queryPOST(table.tb_r_ledger_itemchecks, ledgerItem)

            let q = `
                UPDATE tb_r_ledger_added
                SET
                    approval = true,
                    itemcheck_id = ${item.itemcheck_id},
                    ledger_itemcheck_id = ${ledgerItem.ledger_itemcheck_id},
                    condition = 'Approved'
                WHERE ledger_added_id = ${data.ledger_added_id}
            `
            const updateTRLA = await queryCustom(q)
            response.success(res, "Succes to add data", updateTRLA)

        } catch (error) {
            console.log(error);
            response.error(res, error)
        }
    },
    deleteItemCheck: async (req, res) => {
        try {
            let deleteItemCheck = req.body
            console.log(deleteItemCheck);
            let q = `
                UPDATE tb_r_ledger_itemchecks
                SET deleted_by = 'HALID', deleted_dt = '${getCurrentDateTime()}', reasons = '${deleteItemCheck.reason}'
                WHERE ledger_itemcheck_id = ${deleteItemCheck.ledger_itemcheck_id};            
            `
            const deleted = await queryCustom(q)

            let deleteSchedule = `
                UPDATE tb_r_schedules
                SET deleted_by = 'HALID', deleted_dt = '${getCurrentDateTime()}'
                WHERE ledger_itemcheck_id = ${deleteItemCheck.ledger_itemcheck_id}
            `
            const deleting = await queryCustom(deleteSchedule)

            let deleteHistory = {
                ledger_deleted_id: await getLastIdData(table.tb_r_ledger_deleted),
                uuid: v4(),
                ledger_id: deleteItemCheck.ledger_id,
                itemcheck_id: deleteItemCheck.itemcheck_id,
                created_by: 'USER',
                created_dt: getCurrentDateTime(),
                changed_by: 'USER',
                changed_dt: getCurrentDateTime(),
                last_check_dt: deleteItemCheck.last_check_dt,
                reasons: deleteItemCheck.reason
            }

            console.log(deleteHistory);

            const set = await queryPOST(table.tb_r_ledger_deleted, deleteHistory)

            response.success(res, 'data deleted', deleted)
        } catch (error) {
            console.log(error);
        }
    },
    denyAdded: async (req, res) => {
        try {
            let deny = req.body
            let q = `
                UPDATE tb_r_ledger_added
                SET approval = TRUE, condition = 'Denied'
                WHERE ledger_added_id = ${deny.ledger_added_id}
            `
            const denied = await queryCustom(q)
            response.success(res, 'Request Denied', denied)
        } catch (error) {
            console.log(error);
            response.error(res, 'Error')
        }
    },
    denyEdit: async (req, res) => {
        try {
            let deny = req.body
            let q = `
                UPDATE tb_r_ledger_changes
                SET approval = TRUE, condition = 'Denied'
                WHERE ledger_changes_id = ${deny.ledger_changes_id}
            `
            const denied = await queryCustom(q)
            response.success(res, 'Request Denied', denied)
        } catch (error) {
            console.log(error);
            response.error(res, 'Error')
        }
    }


}