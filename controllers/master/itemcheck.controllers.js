const table = require('../../config/table');
const getLastIdData = require('../../helpers/getLastIdData');
const {
    queryPOST,
    queryPUT,
    queryGET,
    queryCustom,
    queryTransaction,
    queryPostTransaction, queryPutTransaction
} = require('../../helpers/query')
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
                tmll.uuid as line_id,
                tmin.uuid as incharge_id,
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
                            left join ${table.tb_m_incharge} tmin on tmin.incharge_id = tmi.incharge_id
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

const ledgerIdRaw = (req) => (`(select ledger_id from ${table.tb_m_ledgers} where uuid = '${req.body.ledger_id}')`);
const itemCheckIdRaw = (req) => (`(select itemcheck_id from ${table.tb_m_itemchecks} where uuid = '${req.body.itemcheck_id}')`);
const ledgerItemCheckIdRaw = (req) => (`(select ledger_itemcheck_id from ${table.tb_r_ledger_itemchecks} where uuid = '${req.body.ledger_itemcheck_id}')`);

const findExistsAddedOrChanges = async (db, req, isNew) => {
    let whereLedgerItemCheckRaw = `and (trli.ledger_id = ${ledgerIdRaw(req)} and trli.itemcheck_id = ${itemCheckIdRaw(req)})
                                                    or (trli.ledger_itemcheck_id = ${ledgerItemCheckIdRaw(req)})
                                                    or (lower(tmi.item_check_nm) like '%${req.body.itemcheck_nm.toLowerCase()}%')`;

    let whereLedgerAddedRaw = `and (ledger_id = ${ledgerIdRaw(req)} and itemcheck_id = ${itemCheckIdRaw(req)})
                                                    or (ledger_itemcheck_id = ${ledgerItemCheckIdRaw(req)})
                                                    or (lower(item_check_nm) like '%${req.body.itemcheck_nm.toLowerCase()}%')`;

    let whereLedgerChangesRaw = ``;
    if (!isNew) {
        whereLedgerItemCheckRaw = `or (lower(tmi.item_check_nm) like '%${req.body.itemcheck_nm.toLowerCase()}%')`;
        whereLedgerAddedRaw = `or (lower(item_check_nm) like '%${req.body.itemcheck_nm.toLowerCase()}%')`;
    }

    const findExistsLedgerItemCheckRaw = `select 
                                                    trli.* 
                                                   from 
                                                    ${table.tb_r_ledger_itemchecks} trli
                                                    join ${table.tb_m_itemchecks} tmi ON tmi.itemcheck_id = trli.itemcheck_id 
                                                   where 
                                                    1 = 1 ${whereLedgerItemCheckRaw}`;

    let findExists = await db.query(findExistsLedgerItemCheckRaw);
    if (findExists.rows && findExists.rows.length > 0) {
        return true;
    }

    const findExistsLedgerAddedRaw = `select 
                                                    * 
                                                   from 
                                                    ${table.tb_r_ledger_added} 
                                                   where 
                                                    1 = 1 ${whereLedgerAddedRaw}`;

    findExists = await db.query(findExistsLedgerAddedRaw);

    if (findExists.rows && findExists.rows.length > 0) {
        return true;
    }

    /*const findExistsLedgerChangesRaw = `select
                                                    * 
                                                   from 
                                                    ${table.tb_r_ledger_changes} 
                                                   where 
                                                    1 = 1 ${whereLedgerAddedRaw}`;*/

    return false;
}

const mappedItemCheckFromBody = async (req, isNew) => {
    let newItem = {
        uuid: v4(),
        itemcheck_std_id: 1,
        period_id: req.body.period_id ? req.body.period_id : null,
        incharge_id: req.body.incharge_id ? `(select incharge_id from ${table.tb_m_incharge} where uuid = '${req.body.incharge_id}')` : null,
        val_periodic: req.body.period_id ? req.body.val_period : null,
        itemcheck_loc: req.body.itemcheck_loc,
        method_check: req.body.method_check,
        duration: req.body.duration,
        mp: +req.body.mp,
        is_counter: req.body.period_id == null || req.body.is_counter,
        approval: false,
        reasons: req.body.reasons,
        standard_measurement: req.body.standard_measurement,
        condition: 'Waiting',
        lifespan_counter: +req.body.lifespan_counter,
        init_counter_dt: 'now()',
        upper_limit: req.body.upper_limit ? +req.body.upper_limit : null,
        lower_limit: req.body.lower_limit ? +req.body.lower_limit : null,
        details: req.body.details ? req.body.details : null,
        created_by: 'system',
        created_dt: 'now()',
        changed_by: 'system',
        changed_dt: 'now()',
    }

    if (isNew) {
        newItem = {
            ...newItem,
            itemcheck_nm: req.body.itemcheck_nm,
            ledger_id: req.body.ledger_id ? ledgerIdRaw(req) : null,
            itemcheck_id: req.body.itemcheck_id ? itemCheckIdRaw(req) : null,
            ledger_itemcheck_id: req.body.ledger_itemcheck_id ? ledgerItemCheckIdRaw(req) : null,
            init_counter: req.body.ledger_id ? (await queryGET(table.tb_m_ledgers, `WHERE uuid = '${req.body.ledger_id}'`))[0].last_counter : req.body.init_counter,
        };
    }

    return newItem;
}

module.exports = {
    getItemchecks: async (req, res) => {
        try {
            let containerFilter = queryHandler(req.query, 'itemcheck_nm')
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
    getBaseItemcheck: async (req, res) => {
        try {
            let containerFilter = queryHandler(req.query)
            containerFilter.length > 0
                ? containerFilter = containerFilter.join(" AND ")
                : containerFilter = "";

            const limit = req.query.limit ? parseInt(req.query.limit) : null; // Default limit is 10
            const page = req.query.page ? parseInt(req.query.page) : null; // Default page is 1
            const offset = limit && page ? (page - 1) * limit : null;

            const whereRaw = `where 1 = 1 ${containerFilter ? `and ${containerFilter}` : ''}`;
            let rawSql = (isCount = false) => (`select ${isCount ? 'count(*)' : 'row_number() over(order by created_dt desc)::INTEGER as no, *'} from ${table.tb_m_itemchecks} `);

            let orderBy = `order by created_dt desc`;
            if ((limit && page) && Object.keys(limit && page).length > 0) {
                orderBy += ` limit ${limit} offset ${offset}`;
            }

            const result = (await queryCustom(`${rawSql()} ${whereRaw} ${orderBy}`)).rows;

            if (limit && page) {
                const countRows = (await queryCustom(`${rawSql(true)} ${whereRaw} ${orderBy}`));

                response.successPaginate(
                    res,
                    'success to get itemcheck',
                    result,
                    {
                        page,
                        limit,
                        totalPages: Math.ceil(parseInt(countRows?.rows ? countRows.rows[0].count : 0) / limit),
                        total: parseInt(countRows?.rows ? countRows.rows[0].count : 0),
                    }
                );
            } else {
                response.success(res, 'success to get itemcheck', result)
            }
        } catch (error) {
            console.error(error)
            response.failed(res, 'Error to get itemcheck')
        }
    },
    addItemCheck: async (req, res) => {
        try {
            const result = await queryTransaction(async (db) => {
                const findExists = await findExistsAddedOrChanges(db, req, true);
                if (findExists) {
                    throw new Error("Item check ini sudah di tambahkan");
                }

                return (await queryPostTransaction(db, table.tb_r_ledger_added, mappedItemCheckFromBody(req, true))).rows
            });

            response.success(res, 'sucess add data', result)
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

            if (!newData.incharge_id) {
                response.failed(res, 'Incharge is empty, please select incharge first');
                return;
            }

            let oldData = await queryGET(table.tb_m_itemchecks, `WHERE uuid = '${newData.itemcheck_id}'`)
            if (!oldData || oldData?.length === 0) {
                response.failed(res, 'Error to Edit data, Item check not found');
                return;
            }

            oldData = oldData[0]

            let joinData = {
                itemcheck_id: oldData.itemcheck_id,
                itemcheck_nm_old: oldData.itemcheck_nm,
                itemcheck_nm_new: newData.itemcheck_nm,
                details_new: newData.details,
                details_old: oldData.details,
                itemcheck_loc_old: oldData.itemcheck_loc,
                itemcheck_loc_new: newData.itemcheck_loc,
                mp_old: oldData.mp,
                mp_new: +newData.mp,
                period_id_old: oldData.period_id ? oldData.period_id : null,
                period_id_new: newData.period_id ? +newData.period_id : null,
                method_check_old: oldData.method_check,
                method_check_new: newData.method_check,
                duration_old: oldData.duration,
                duration_new: +newData.duration,
                val_periodic_old: oldData.val_periodic ? oldData.val_periodic : null,
                val_periodic_new: newData.val_periodic ? +newData.val_periodic : null,
                initial_date: oldData.initial_date,
                created_by: 'SYSTEM',
                created_dt: getCurrentDateTime(),
                changed_by: 'USER',
                changed_dt: getCurrentDateTime(),
                incharge_id_old: oldData.incharge_id,
                incharge_id_new: newData.incharge_id ? `(select incharge_id from ${table.tb_m_incharge} where uuid = '${req.body.incharge_id}')` : null,
                standard_measurement_old: oldData.standard_measurement,
                standard_measurement_new: newData.standard_measurement,
                approval: false,
                uuid: v4(),
                last_check_dt: oldData.last_check_dt,
                itemcheck_std_id: oldData.itemcheck_std_id,
                ledger_id: req.body.ledger_id ? ledgerIdRaw(req) : null,
                upper_limit_old: oldData.upper_limit !== null ? oldData.upper_limit : 0,
                upper_limit_new: +newData.upper_limit,
                lower_limit_old: oldData.lower_limit !== null ? oldData.lower_limit : 0,
                lower_limit_new: +newData.lower_limit,
                reason: newData.reasons,
                is_counter: newData.is_counter,
                lifespan_counter_old: oldData.lifespan_counter ? +oldData.lifespan_counter : null,
                lifespan_counter_new: newData.lifespan_counter ? +newData.lifespan_counter : null,
            }

            const insert = await queryPOST(table.tb_r_ledger_changes, joinData)
            response.success(res, 'sucess edit item check', insert)
        } catch (error) {
            console.log(error);
            response.failed(res, {
                message: 'Error to item check',
                error: error,
            })
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
                WHERE (trlc.approval = false or trlc.approval is null)
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
                    uuid: v4(),
                    itemcheck_nm: data.itemcheck_nm,
                    itemcheck_loc: data.itemcheck_loc,
                    method_check: data.method_check,
                    duration: data.duration,
                    mp: data.mp,

                    /**/
                    period_id: data.period_id,
                    val_periodic: data.val_periodic,
                    /**/

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

            const result = await queryTransaction(async (db) => {
                const addedItemCheckRaw = `
                    select 
                        trla.ledger_added_id,
                        tmi.itemcheck_id,
                        tml.ledger_id,
                        tmm.machine_id,
                        tmll.line_id,
                        tmp.period_id
                    from
                        tb_r_ledger_added trla
                            left join tb_m_itemchecks tmi ON tmi.itemcheck_id = trla.itemcheck_id
                            left join tb_m_ledgers tml ON tml.ledger_id = trla.ledger_id
                            left join tb_m_machines tmm ON tmm.machine_id = tml.machine_id
                            left join tb_m_lines tmll on tmll.line_id = tmm.line_id
                            left join tb_m_periodics tmp ON tmi.period_id = tmp.period_id
                    where 
                        trla.uuid = '${req.body.ledger_added_id}'
                `;

                const addedItemChecks = (await db.query(addedItemCheckRaw)).rows[0];

                await queryPutTransaction(
                    db,
                    table.tb_r_ledger_added,
                    {
                        approval: true,
                    },
                    ``
                );

                if (!addedItemChecks.itemcheck_id) {
                    queryPostTransaction(
                        db,
                        table.tb_m_itemchecks,
                        {}
                    );
                }
            });

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