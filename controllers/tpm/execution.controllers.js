const table = require("../../config/table");
const {
    queryPOST,
    queryPUT,
    queryGET,
    queryCustom, queryTransaction, queryPutTransaction, queryPostTransaction,
} = require("../../helpers/query");
const queryHandler = require("../queryhandler.function");
const response = require("../../helpers/response");
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");
const getLastIdData = require("../../helpers/getLastIdData");
const {v4} = require("uuid");
const idToUuid = require("../../helpers/idToUuid");
const fs = require('fs');
const moment = require('moment');

async function uuidToId(table, col, uuid) {
    console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
    // `SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`
    let rawId = await queryGET(table, `WHERE uuid = '${uuid}'`, [col]);
    return rawId[0][col];
}

module.exports = {
    getExecHistory: async (req, res) => {
        try {
            let schedule_id = await uuidToId(
                table.tb_r_schedules,
                "schedule_id",
                req.query.schedule_id
            );
            req.query.schedule_id = schedule_id;
            let containerFilter = queryHandler(req.query);
            containerFilter.length > 0 ?
                (containerFilter = "WHERE " + containerFilter.join(" AND ")) :
                (containerFilter = "");
            const scheduleData = await queryGET(
                table.tb_r_schedules,
                containerFilter, [
                    "uuid as schedule_id",
                    "plan_check_dt",
                    "actual_check_dt",
                    "plan_duration",
                    "actual_duration",
                ]
            );
            const executions = await queryGET(
                table.tb_r_history_checks,
                containerFilter
            );
            const pic_check = await queryGET(
                table.tb_r_schedule_checker,
                containerFilter, ["actual_user_id ,user_id"]
            );
            scheduleData[0].execution = executions;
            const changesIdToUUID = await pic_check.map(async (user, i) => {
                console.log(user);
                let userData = await queryGET(
                    table.tb_m_users,
                    `WHERE user_id = ${user.user_id}`, ["uuid as user_id", "user_nm", "noreg"]
                );
                return userData[0];
            });
            scheduleData[0].pic_check = await Promise.all(changesIdToUUID);
            response.success(res, "success to get execution details", scheduleData);
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to get execution details");
        }
    },
    addTpmExecution: async (req, res) => {
        let uploadPath = null;

        try {
            if (
                !req.body.schedule_id
                || !req.body.actual_check_dt
                || !req.body.actual_duration
                || !req.body.actual_user_id
                || !req.body.ledger_itemcheck_id
                || !req.body.checked_val
            ) {
                response.failed(res, "Data parameter tidak lengkap, lengkapi data terlebih dahulu");
                return;
            }

            console.log(req.body);

            const isFinding = (+req.body.is_number && (+req.body.checked_val > +req.body.ok_val ||
                +req.body.checked_val < +req.body.ng_val)) || req.body.checked_val === req.body.ng_val;

            let findStatus = await queryGET(
                table.tb_m_status,
                `where ${isFinding ? `lower(status_nm) = 'finding'` : `lower(status_nm) = 'done'`}`
            );

            if (!findStatus || findStatus.length === 0) {
                response.failed(res, "Item check status tidak ditemukan, silahkan hubungi pengembang");
                return;
            }

            findStatus = findStatus[0];

            const result = await queryTransaction(async (db) => {
                const objSchedule = {
                    status_id: findStatus.status_id,
                    actual_check_dt: req.body.actual_check_dt,
                    actual_duration: req.body.actual_duration,
                    changed_dt: moment().format('YYYY-MM-DD'),
                    changed_by: 'update pengecekan'
                };

                let scheduleUpdated = await queryPutTransaction(
                    db,
                    table.tb_r_schedules,
                    objSchedule,
                    `WHERE schedule_id = (select schedule_id from ${table.tb_r_schedules} where uuid ='${req.body.schedule_id}')`
                );

                if (!scheduleUpdated || scheduleUpdated.rows.length === 0) {
                    throw new Error("Gagal update schedule");
                }

                scheduleUpdated = scheduleUpdated.rows[0];

                await db.query(`
                    update ${table.tb_r_schedule_checker}
                        set
                            actual_user_id = (
                                                 select user_id from ${table.tb_m_users} where uuid = '${req.body.actual_user_id}'
                                             )
                        where
                            schedule_id = ${scheduleUpdated.schedule_id}
                `);

                await queryPutTransaction(
                    db,
                    table.tb_r_ledger_itemchecks,
                    {
                        last_check_dt: req.body.actual_check_dt,
                    },
                    `WHERE ledger_itemcheck_id = (select ledger_itemcheck_id from ${table.tb_r_ledger_itemchecks} where uuid = '${req.body.ledger_itemcheck_id}')`
                );

                const findFinding = await db.query(`select * from ${table.tb_r_finding_checks} where schedule_id = '${scheduleUpdated.schedule_id}'`);

                if (isFinding) {
                    if (!req.file) {
                        throw new Error("File harus di masukkan");
                    }

                    uploadPath = `${req.query.dest}/${req.file.filename}`;

                    const findingObj = typeof req.body.finding === 'string' ? JSON.parse(req.body.finding) : req.body.finding;

                    const objFinding = {
                        uuid: v4(),
                        schedule_id: scheduleUpdated.schedule_id,
                        user_id: `(select  user_id from ${table.tb_m_users} where uuid = '${findingObj.user_id}')`,
                        problem: findingObj.problem,
                        action_plan: findingObj.action_plan,
                        status_id: findStatus.status_id,
                        plan_check_dt: scheduleUpdated.plan_check_dt,
                        finding_image: `./uploads/${uploadPath}`,
                    };

                    if (findFinding.rows.length > 0) {
                        await queryPutTransaction(
                            db,
                            table.tb_r_finding_checks,
                            objFinding,
                            `WHERE finding_check_id = '${findFinding.rows[0].finding_check_id}'`
                        );
                    } else {
                        await queryPostTransaction(
                            db,
                            table.tb_r_finding_checks,
                            objFinding
                        );
                    }
                } else {
                    if (findFinding.rows.length > 0) {
                        await db.query(`delete from ${table.tb_r_finding_checks } where schedule_id = '${scheduleUpdated.schedule_id}'`);
                        const fullPath = appRoot + findFinding.rows[0].finding_image.substring(1);
                        if (findFinding.rows[0].finding_image && fs.existsSync(fullPath)) {
                            fs.unlinkSync(fullPath)
                        }
                    }

                    const objCheckedExec = {
                        uuid: v4(),
                        schedule_id: scheduleUpdated.schedule_id,
                        checked_val: req.body.checked_val,
                    };

                    if (req.body.actual_measurement) {
                        objCheckedExec.act_measurement = +req.body.actual_measurement;
                    }

                    const findHistoryChecks = await db.query(`select * from ${table.tb_r_history_checks} where schedule_id = '${scheduleUpdated.schedule_id}'`);
                    if (findHistoryChecks.rows.length > 0) {
                        await queryPutTransaction(
                            db,
                            table.tb_r_history_checks,
                            objCheckedExec,
                            `WHERE history_check_id = '${findHistoryChecks.rows[0].history_check_id}'`
                        );
                    } else {
                        await queryPostTransaction(
                            db,
                            table.tb_r_history_checks,
                            objCheckedExec
                        );
                    }
                }
            });

            response.success(res, "Success to execution schedule check", result);
        } catch (error) {
            if (uploadPath) {
                const fullPath = appRoot + `/uploads/${uploadPath}`;
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath)
                }
            }

            console.log(error);
            response.failed(res, "Error to execution schedule check");
        }
    },
};