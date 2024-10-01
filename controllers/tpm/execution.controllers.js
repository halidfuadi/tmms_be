const table = require("../../config/table");
const {
    queryPOST,
    queryPUT,
    queryGET,
    queryCustom,
} = require("../../helpers/query");
const queryHandler = require("../queryhandler.function");
const response = require("../../helpers/response");
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData");
const getLastIdData = require("../../helpers/getLastIdData");
const { v4 } = require("uuid");
const idToUuid = require("../../helpers/idToUuid");

async function uuidToId(table, col, uuid) {
    console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
    // `SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`
    let rawId = await queryGET(table, `WHERE uuid = '${uuid}'`, [col]);
    return rawId[0][col];
}

async function execFinding(res, data) {
    // SUB_PROGRAM_FINDING
    // UPDATE tb_r_schedules SET status_id = 2(FINDING), actual_check_dt = payload.date WHERE schedule_id = req.body.schedule_id
    // UPDATE tb_r_schedule_checker actual_user_id = payload.user_id WHERE schedule_id = req.body.schedule_id
    // INSERT INTO tb_r_history_checks(schedule_id, checked_val, uuid) VALUES(req.body.schedule_id, payload.checked_val, v4)
    // INSERT INTO tb_r_finding_checks
    //     (history_check_id, user_id, problem, action_plan, plan_check_dt)
    // VALUES
    //     (history_id, payload.finding.user_id, payload.finding.problem, payload.finding.action_plan, payload.finding.plan_check_dt)
    try {
        const lastIdHistoryExec = await getLastIdData(
            table.tb_r_history_checks,
            "history_check_id"
        );
        const lastIdFinding = await getLastIdData(
            table.tb_r_finding_checks,
            "finding_id"
        );

        const ledger_itemcheck_id = await uuidToId(
            table.tb_r_ledger_itemchecks,
            `ledger_itemcheck_id`,
            data.ledger_itemcheck_id
        );
        const schedule_id = await uuidToId(
            table.tb_r_schedules,
            `schedule_id`,
            data.schedule_id
        );

        const finding_user_id = await uuidToId(
            table.tb_m_users,
            `user_id`,
            data.finding.user_id
        );

        // Start: Map User Id Converted
        const actual_user_ids = await data.actual_user_ids.map(
            async(act_user_id, i) => {
                let conv_act_user_id = await uuidToId(
                    table.tb_m_users,
                    `user_id`,
                    act_user_id
                );
                let conv_plan_user_id = await uuidToId(
                    table.tb_m_users,
                    `user_id`,
                    data.plan_user_ids[i]
                );
                return {
                    actual_user_id: conv_act_user_id,
                    user_id: conv_plan_user_id,
                };
            }
        );
        const wait_users_ids = await Promise.all(actual_user_ids);

        for (let idx = 0; idx < wait_users_ids.length; idx++) {
            const userIds = wait_users_ids[idx];
            await queryPUT(
                table.tb_r_schedule_checker,
                userIds,
                `WHERE schedule_id = ${schedule_id} AND user_id = '${userIds.user_id}'`
            );
        }
        // End: Map User Id Converted

        const objSchedule = {
            status_id: 2, // for FINDING
            actual_check_dt: data.actual_check_dt,
        };

        const objCheckedExec = {
            history_check_id: lastIdHistoryExec,
            schedule_id: schedule_id,
            uuid: v4(),
            checked_val: data.checked_val,
        };
        const updtItemcheckLastDt = {
            last_check_dt: data.actual_check_dt,
        };

        await queryPUT(
            table.tb_r_schedules,
            objSchedule,
            `WHERE schedule_id = ${schedule_id}`
        );

        let historyInstRes = await queryPOST(
            table.tb_r_history_checks,
            objCheckedExec
        );

        const objFinding = {
            finding_id: lastIdFinding,
            history_check_id: historyInstRes.rows[0].history_check_id,
            uuid: v4(),
            user_id: finding_user_id,
            problem: data.finding.problem,
            action_plan: data.finding.action_plan,
            status_id: 0,
            plan_check_dt: data.finding.plan_check_dt,
        };

        await queryPOST(table.tb_r_finding_checks, objFinding);
        await queryPUT(
            table.tb_r_ledger_itemchecks,
            updtItemcheckLastDt,
            `WHERE ledger_itemcheck_id = ${ledger_itemcheck_id}`
        );
        return response.success(res, "Success to execution schedule check");
    } catch (error) {
        console.log(error);
        return response.failed(res, "Error to execution schedule check");
    }
}

async function execNormal(res, data) {
    // UPDATE tb_r_schedules SET status_id = 1(DONE), actual_check_dt = payload.date WHERE schedule_id = req.body.schedule_id
    // UPDATE tb_r_schedule_checker actual_user_id = payload.user_id WHERE schedule_id = req.body.schedule_id
    // INSERT INTO tb_r_history_checks(schedule_id, checked_val, uuid) VALUES(req.body.schedule_id, payload.checked_val, v4)

    try {
        delete data.finding;
        const lastIdHistoryExec = await getLastIdData(
            table.tb_r_history_checks,
            "history_check_id"
        );
        const schedule_id = await uuidToId(
            table.tb_r_schedules,
            `schedule_id`,
            data.schedule_id
        );
        const ledger_itemcheck_id = await uuidToId(
            table.tb_r_ledger_itemchecks,
            `ledger_itemcheck_id`,
            data.ledger_itemcheck_id
        );

        // Start: Map User Id Converted
        const actual_user_ids = await data.actual_user_ids.map(
            async(act_user_id, i) => {
                let conv_act_user_id = await uuidToId(
                    table.tb_m_users,
                    `user_id`,
                    act_user_id
                );
                let conv_plan_user_id = await uuidToId(
                    table.tb_m_users,
                    `user_id`,
                    data.plan_user_ids[i]
                );
                return {
                    actual_user_id: conv_act_user_id,
                    user_id: conv_plan_user_id,
                };
            }
        );
        const wait_users_ids = await Promise.all(actual_user_ids);

        for (let idx = 0; idx < wait_users_ids.length; idx++) {
            const userIds = wait_users_ids[idx];
            await queryPUT(
                table.tb_r_schedule_checker,
                userIds,
                `WHERE schedule_id = ${schedule_id} AND user_id = '${userIds.user_id}'`
            );
        }
        // End: Map User Id Converted

        const objSchedule = {
            status_id: 4, // for DONE
            actual_check_dt: data.actual_check_dt,
            actual_duration: data.actual_duration,
        };
        const objCheckedExec = {
            history_check_id: lastIdHistoryExec,
            schedule_id: schedule_id,
            uuid: v4(),
            checked_val: data.checked_val,
        };
        if (data.actual_measurement) {
            objCheckedExec.act_measurement = +data.actual_measurement;
        }
        const updtItemcheckLastDt = {
            last_check_dt: data.actual_check_dt,
        };
        console.log(objCheckedExec);
        await queryPUT(
            table.tb_r_schedules,
            objSchedule,
            `WHERE schedule_id = ${schedule_id}`
        );
        await queryPOST(table.tb_r_history_checks, objCheckedExec);
        await queryPUT(
            table.tb_r_ledger_itemchecks,
            updtItemcheckLastDt,
            `WHERE ledger_itemcheck_id = ${ledger_itemcheck_id}`
        );
        return response.success(res, "Success to execution schedule check");
    } catch (error) {
        console.log(error);
        return response.failed(res, "Error to execution schedule check");
    }
}

module.exports = {
    getExecHistory: async(req, res) => {
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
            const changesIdToUUID = await pic_check.map(async(user, i) => {
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
    addTpmExecution: async(req, res) => {
        try {
            console.log(req.body);
            if (+req.body.is_number) {
                if (+req.body.checked_val > +req.body.ok_val ||
                    +req.body.checked_val < +req.body.ng_val
                ) {
                    execFinding(res, req.body);
                } else {
                    execNormal(res, req.body);
                }
            } else {
                if (req.body.checked_val === req.body.ng_val)
                    execFinding(res, req.body);
                else execNormal(res, req.body);
            }
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to execution schedule check");
        }
    },
};