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
                trli.current_counter,
                tmin.incharge_nm`;

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
                                                    and (trli.ledger_itemcheck_id = ${ledgerItemCheckIdRaw(req)})
                                                    and (lower(tmi.itemcheck_nm) like '%${req.body.itemcheck_nm.toLowerCase()}%')`;

    let whereLedgerAddedRaw = `and (ledger_id = ${ledgerIdRaw(req)} and itemcheck_id = ${itemCheckIdRaw(req)})
                                                    and (ledger_itemcheck_id = ${ledgerItemCheckIdRaw(req)})
                                                    and (lower(itemcheck_nm) like '%${req.body.itemcheck_nm.toLowerCase()}%')`;

    if (!isNew) {
        whereLedgerItemCheckRaw = `or (lower(tmi.itemcheck_nm) like '%${req.body.itemcheck_nm.toLowerCase()}%')`;
        whereLedgerAddedRaw = `or (lower(itemcheck_nm) like '%${req.body.itemcheck_nm.toLowerCase()}%')`;
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
        const findLedger = req.body.ledger_id ? (await queryGET(table.tb_m_ledgers, `WHERE uuid = '${req.body.ledger_id}'`)) : [];

        newItem = {
            ...newItem,
            itemcheck_nm: req.body.itemcheck_nm,
            ledger_id: req.body.ledger_id ? ledgerIdRaw(req) : null,
            itemcheck_id: req.body.itemcheck_id ? itemCheckIdRaw(req) : null,
            ledger_itemcheck_id: req.body.ledger_itemcheck_id ? ledgerItemCheckIdRaw(req) : null,
            init_counter: findLedger.length > 0 ? findLedger[0].last_counter : req.body.init_counter,
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

                const data = await mappedItemCheckFromBody(req, true);
                const added = (await queryPostTransaction(db, table.tb_r_ledger_added, data)).rows
                return added;
            });

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
    getNewItemRequest: async (req, res) => {
        try {
            const isCount = req.query.count && req.query.count === "true";

            const rawAll = `trla.uuid as ledger_added_id,
                tmi.uuid  as itemcheck_id,
                tml.uuid  as ledger_id,
                tmll.uuid as line_id,
                tmm.uuid  as machine_id,
                tmp.uuid  as periodic_id,
                trla.itemcheck_nm,
                trla.itemcheck_loc,
                trla.reasons,
                trla.changed_by,
                trla.changed_dt,
                tmm.machine_nm`;
            let q = `
                            select 
                                ${isCount ? 'count(*) as total' : rawAll}
                            from
                                tb_r_ledger_added trla
                                    left join tb_m_itemchecks tmi ON tmi.itemcheck_id = trla.itemcheck_id
                                    left join tb_m_ledgers tml ON tml.ledger_id = trla.ledger_id
                                    left join tb_m_machines tmm ON tmm.machine_id = tml.machine_id
                                    left join tb_m_lines tmll on tmll.line_id = tmm.line_id
                                    left join tb_m_periodics tmp ON tmi.period_id = tmp.period_id 
                            where 
                                (trla.approval = false or trla.approval is null)`
            let updateData = (await queryCustom(q)).rows
            console.log(updateData);
            response.success(res, 'succes to get new item request', updateData);
        } catch (e) {
            console.log(e);
            response.failed(res, {
                message: 'Error to get new item request',
                error: e,
            });
        }
    },
    getChangeItemRequest: async (req, res) => {
        try {
            const isCount = req.query.count && req.query.count === "true";

            const rawAll = `trla.uuid as ledger_changes_id,
                                        tmi.uuid  as itemcheck_id,
                                        tml.uuid  as ledger_id,
                                        tmll.uuid as line_id,
                                        tmm.uuid  as machine_id,
                                        trla.itemcheck_nm_new,
                                        trla.itemcheck_nm_old,
                                        trla.itemcheck_loc_old,
                                        trla.itemcheck_loc_new,
                                        trla.method_check_new,
                                        trla.method_check_old,
                                        trla.duration_new,
                                        trla.duration_old,
                                        trla.mp_new,
                                        trla.mp_old,
                                        trla.reason,
                                        trla.changed_by,
                                        tmp_old.period_nm as period_nm_old,
                                        tmp_new.period_nm as period_nm_new,
                                        trla.standard_measurement_new,
                                        trla.standard_measurement_old,
                                        trla.upper_limit_new,
                                        trla.upper_limit_old,
                                        trla.lower_limit_new,
                                        trla.lower_limit_old,
                                        tmm.machine_nm`;

            let q = `select
                                        ${isCount ? 'count(*) as total' : rawAll}            
                                    from
                                        tb_r_ledger_changes trla
                                            left join tb_m_itemchecks tmi ON tmi.itemcheck_id = trla.itemcheck_id
                                            left join tb_m_ledgers tml ON tml.ledger_id = trla.ledger_id
                                            left join tb_m_machines tmm ON tmm.machine_id = tml.machine_id
                                            left join tb_m_lines tmll on tmll.line_id = tmm.line_id
                                            left join tb_m_periodics tmp_old ON trla.period_id_old = tmp_old.period_id
                                            left join tb_m_periodics tmp_new ON trla.period_id_new = tmp_new.period_id
                                    where (trla.approval = false or trla.approval is null)`;
            let updated = (await queryCustom(q)).rows
            response.success(res, 'succes to get updated item', updated)
        } catch (error) {
            console.log(error);
            response.failed(res, {
                message: 'Error to get new item request',
                error: error,
            });
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
    approvedChangeItem: async (req, res) => {
        try {
            let findChanges = (await queryCustom(`select * from ${table.tb_r_ledger_changes} where uuid = '${req.body.ledger_changes_id}'`)).rows;
            if (findChanges && findChanges.length === 0) {
                response.error(res, 'Item change request not found');
                return;
            }

            findChanges = findChanges[0];

            const result = await queryTransaction(async (db) => {
                await queryPutTransaction(
                    db,
                    table.tb_r_ledger_changes,
                    {
                        approval: true,
                        changed_by: 'approval',
                        changed_dt: 'now()',
                    },
                    `WHERE ledger_changes_id = ${findChanges.ledger_changes_id}`
                );

                let newData = {
                    period_id: findChanges.period_id_new,
                    itemcheck_nm: findChanges.itemcheck_nm_new,
                    itemcheck_loc: findChanges.itemcheck_loc_new,
                    method_check: findChanges.method_check_new,
                    duration: parseInt(findChanges.duration_new),
                    mp: parseInt(findChanges.mp_new),
                    val_periodic: findChanges.val_periodic_new,
                    initial_date: findChanges.initial_date,
                    changed_by: 'approval',
                    changed_dt: 'now()',
                    incharge_id: findChanges.incharge_id_new,
                    standard_measurement: findChanges.standard_measurement_new,
                    upper_limit: findChanges.upper_limit_new ? parseInt(findChanges.upper_limit_new) : null,
                    lower_limit: findChanges.lower_limit_new ? parseInt(findChanges.lower_limit_new) : null,
                    details: findChanges.details_new,
                }

                await queryPutTransaction(
                    db,
                    table.tb_m_itemchecks,
                    newData,
                    `WHERE uuid = ${findChanges.itemcheck_id}`
                );
            });

            response.success(res, 'Success to approve item check', result);
        } catch (error) {
            console.log(error);
            response.error(res, {
                message: `Error to approve item check`,
                error: error,
            })
        }
    },
    approvedNewItem: async (req, res) => {
        try {
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

            let addedItemChecks = (await queryCustom(addedItemCheckRaw)).rows;

            if (!addedItemChecks || addedItemChecks.length === 0) {
                response.error(res, "Data not found");
                return;
            }

            addedItemChecks = addedItemChecks[0];

            const result = await queryTransaction(async (db) => {
                await queryPutTransaction(
                    db,
                    table.tb_r_ledger_added,
                    {
                        approval: true,
                        changed_by: 'approval',
                        changed_dt: 'now()',
                    },
                    `where ledger_added_id = '${addedItemChecks.ledger_added_id}'`
                );

                if (!addedItemChecks.itemcheck_id) {
                    let item = {
                        uuid: v4(),
                        itemcheck_nm: addedItemChecks.itemcheck_nm,
                        itemcheck_loc: addedItemChecks.itemcheck_loc,
                        method_check: addedItemChecks.method_check,
                        duration: addedItemChecks.duration,
                        mp: addedItemChecks.mp,
                        period_id: addedItemChecks.period_id,
                        val_periodic: addedItemChecks.val_periodic,
                        lifespan_counter: +addedItemChecks.lifespan_counter,
                        initial_date: addedItemChecks.initial_date,
                        created_by: 'approval',
                        created_dt: getCurrentDateTime(),
                        changed_by: 'approval',
                        changed_dt: getCurrentDateTime(),
                        incharge_id: addedItemChecks.incharge_id,
                        last_check_dt: addedItemChecks.last_check_dt,
                        itemcheck_std_id: addedItemChecks.itemcheck_std_id,
                        standard_measurement: addedItemChecks.standard_measurement,
                        details: addedItemChecks.details,
                        lower_limit: addedItemChecks.lower_limit ? +addedItemChecks.lower_limit : 0,
                        upper_limit: addedItemChecks.upper_limit ? +addedItemChecks.upper_limit : 0,
                    };

                    await queryPostTransaction(
                        db,
                        table.tb_m_itemchecks,
                        item
                    );
                }

                const rawFindExistsLedgerItemCheck = `select * from ${table.tb_r_ledger_itemchecks} where ledger_id = ${addedItemChecks.ledger_id} and itemcheck_id = ${addedItemChecks.itemcheck_id}`;
                const findExistsLedgerItemCheck = (await db.query(rawFindExistsLedgerItemCheck)).rows;
                if (findExistsLedgerItemCheck && findExistsLedgerItemCheck.length > 0) {
                    throw "Ledger item check exists";
                }

                const ledgerItem = {
                    uuid: v4(),
                    is_counter: addedItemChecks.is_counter,
                    ledger_id: addedItemChecks.ledger_id,
                    itemcheck_id: addedItemChecks.itemcheck_id,
                    created_by: 'approval',
                    created_dt: getCurrentDateTime(),
                    changed_by: 'approval',
                    changed_dt: getCurrentDateTime(),
                    //last_check_dt: "2000-01-01 00:00:00",
                    lifespan_counter: addedItemChecks.lifespan_counter ? +addedItemChecks.lifespan_counter : 0,
                    init_counter: addedItemChecks.init_counter ? +addedItemChecks.init_counter : 0,
                    init_counter_dt: addedItemChecks.init_counter_dt,
                };

                await queryPostTransaction(
                    db,
                    table.tb_r_ledger_itemchecks,
                    ledgerItem
                );
            });

            response.success(res, "Succes to approve item request")
        } catch (error) {
            console.log(error);
            response.error(res, {
                message: "Error to approve item request",
                error: error,
            })
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
    denyNewItem: async (req, res) => {
        try {
            let deny = req.body
            let q = `
                UPDATE tb_r_ledger_added
                SET approval = true, condition = 'Denied'
                WHERE uuid = '${deny.ledger_added_id}'
            `
            const denied = await queryCustom(q)
            response.success(res, 'Request Denied', denied)
        } catch (error) {
            console.log(error);
            response.error(res, 'error deny new item request')
        }
    },
    denyChangeItem: async (req, res) => {
        try {
            let deny = req.body
            let q = `
                UPDATE tb_r_ledger_changes
                SET approval = true, condition = 'Denied'
                WHERE uuid = '${deny.ledger_changes_id}'
            `
            const denied = await queryCustom(q)
            response.success(res, 'Request Denied', denied)
        } catch (error) {
            console.log(error);
            response.error(res, 'Error')
        }
    },
}