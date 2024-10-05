const table = require("../../config/table");
const {
    queryPOST,
    queryPUT,
    queryGET,
    queryCustom,
    queryBulkPOST,
    queryTransaction,
    queryGetTransaction,
    queryPutTransaction,
} = require("../../helpers/query");
const moment = require("moment");

const response = require("../../helpers/response");
const {groupFunction} = require("../../functions/groupFunction");
const queryHandler = require("../queryhandler.function");
const getLastIdData = require("../../helpers/getLastIdData");
const {v4} = require("uuid");
const {getRounds} = require("bcryptjs");
let timestampDay = 24 * 60 * 60 * 1000;

async function uuidToId(table, col, uuid) {
    console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
    // `SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`
    let rawId = await queryGET(table, `WHERE uuid = '${uuid}'`, [col]);
    return rawId[0][col];
}

function getPreviousMonthRange() {
    let now = new Date();
    let firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let firstDayOfPreviousMonth = new Date(
        firstDayOfCurrentMonth.setMonth(firstDayOfCurrentMonth.getMonth() - 1)
    );
    let lastDayOfPreviousMonth = new Date(
        firstDayOfPreviousMonth.getFullYear(),
        firstDayOfPreviousMonth.getMonth() + 1,
        0
    );

    // Format the dates as 'YYYY-MM-DD'
    let formatDate = (date) => {
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        let day = date.getDate();
        if (month < 10) month = "0" + month;
        if (day < 10) day = "0" + day;
        return `${year}-${month}-${day}`;
    };

    return {
        firstDay: formatDate(firstDayOfPreviousMonth),
        lastDay: formatDate(lastDayOfPreviousMonth),
    };
}

const scheduleRawSql = (containerFilter, paginate = {}) => {
    const lastCheckedRaw =
        `(
        select 
            trrcc.actual_check_dt 
        from 
            ${table.tb_r_schedules} trrcc
        where 
            trrcc.plan_check_dt::date < vsm.plan_check_dt::date 
            and trrcc.actual_check_dt is not null 
        order by trrcc.schedule_id desc limit 1
    )`;

    const rawAll = `vsm.*, 
    row_number() over(order by itemcheck_nm, machine_nm)::INTEGER as no, 
    trsc.schedule_checker_id,
    ${lastCheckedRaw} as last_checked_dt,
    trhc.checked_id,
    case 
        when trfc.finding_id is not null then
            'NG' 
        else    
            'OK' 
    end as checked_val`;

    const sql = (isCount = false) => (
        `select 
            ${isCount ? 'count(*)' : rawAll} 
          from 
            ${table.v_schedules_monthly} vsm
            left join lateral (
                                   select 
                                        uuid as schedule_checker_id  
                                   from ${table.tb_r_schedule_checker}
                                   where 
                                        schedule_id = vsm.id
                                   limit 1
                                   ) trsc on true
            left join lateral (select checked_val, uuid as checked_id from ${table.tb_r_history_checks} where schedule_id = vsm.id order by history_check_id desc limit 1) trhc on true
            left join lateral (select uuid as finding_id, problem, action_plan from ${table.tb_r_finding_checks} where schedule_id = vsm.id limit 1) trfc on true`
    );
    const where = `where vsm.deleted_dt is null ${containerFilter ? `and ${containerFilter}` : ''}`;

    let orderBy = '';
    if (paginate && Object.keys(paginate).length > 0) {
        orderBy = `order by itemcheck_nm, machine_nm limit ${paginate.limit} offset ${paginate.offset}`;
    }

    return {
        sql,
        where,
        orderBy
    }
};

const schedulePic = async (schedule_id, isActual = false) => {
    let q = `SELECT 
                  trsc.uuid as schedule_checker_id,
                  ${isActual ? 'tmu_actual' : 'tmu'}.uuid as user_id,
                  ${isActual ? 'tmu_actual' : 'tmu'}.user_nm,
                  ${isActual ? 'tmu_actual' : 'tmu'}.noreg
                  FROM tb_r_schedule_checker trsc
                  LEFT JOIN tb_m_users tmu ON tmu.user_id = trsc.user_id
                  LEFT JOIN tb_m_users tmu_actual on trsc.actual_user_id = tmu_actual.user_id
                  WHERE trsc.schedule_id = ${schedule_id}`;

    return (await queryCustom(q)).rows;
}


module.exports = {
    getSchedule: async (req, res) => {
        try {
            let containerFilter = queryHandler(req.query);
            /*containerFilter.pop()
            containerFilter.pop()*/
            console.log(containerFilter);

            containerFilter.length > 0
                ? (containerFilter = containerFilter.join(" AND "))
                : (containerFilter = "");

            // Get pagination parameters from the request
            const limit = parseInt(req.query.limit) || 10; // Default limit is 10
            const page = parseInt(req.query.page) || 1; // Default page is 1
            const offset = (page - 1) * limit;

            const {sql, where, orderBy} = scheduleRawSql(containerFilter, {
                limit,
                offset
            })

            // Modify the query to include pagination
            const schedulesData = (await queryCustom(`${sql()} ${where} ${orderBy}`)).rows;

            let mapSchedulesPics = schedulesData.map(async (schedule) => {
                let schedule_id = await uuidToId(
                    table.tb_r_schedules,
                    "schedule_id",
                    schedule.schedule_id
                );

                let q = `SELECT 
                  trsc.uuid as schedule_checker_id,
                  tmu.uuid as user_id,
                  tmu.user_nm,
                  tmu.noreg
                  FROM tb_r_schedule_checker trsc
                  LEFT JOIN tb_m_users tmu ON tmu.user_id = trsc.user_id
                  WHERE trsc.schedule_id = ${schedule_id}`;
                let checkers = (await queryCustom(q)).rows;
                let dateOffset =
                    new Date(
                        schedule.val_periodic * schedule.prec_val * timestampDay
                    ).getTime() +
                    new Date(
                        schedule.actual_check_dt
                            ? schedule.actual_check_dt
                            : schedule.plan_check_dt
                    ).getTime();
                schedule.next_check = new Date(dateOffset);
                schedule.checkers = checkers ? checkers[0] : {};
                schedule.manual_book_file = schedule.manual_book_file ? `${process.env.APP_HOST}/file?path=${schedule.manual_book_file}` : null;
                return schedule;
            });

            const waitMapSchedule = await Promise.all(mapSchedulesPics);
            /*const keyGroup = req.query.schedule_id
                ? "schedule_id"
                : "ledger_itemcheck_id";*/
            //const groupByItemcheck = await groupFunction(waitMapSchedule, keyGroup);

            // Send the total number of schedules for pagination
            const countRows = await queryCustom(`${sql(true)} ${where}`);

            response.success(res, "Success to get schedules", {
                //schedules: groupByItemcheck,
                schedules: waitMapSchedule.map((item) => {
                    item.day_idx = +item.day_idx // convert string to number
                    item.day_idx_act = +item.day_idx_act // convert string to number
                    return item;
                }),
                total: parseInt(countRows?.rows ? countRows.rows[0].count : 0),  // Total number of schedules
                page,
                limit,
                totalPages: Math.ceil(parseInt(countRows?.rows ? countRows.rows[0].count : 0) / limit),
            });
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to get schedules");
        }
    },
    getDetailSchedule: async (req, res) => {
        try {
            const {sql, where} = scheduleRawSql(`schedule_id = '${req.params.id}'`)
            const raw = `${sql()} ${where}`;
            let scheduleRows = (await queryCustom(raw)).rows;
            if (scheduleRows.length === 0) {
                response.success(res, "success to get detail schedule", null);
                return;
            }

            scheduleRows = scheduleRows[0];

            const checkerPic = await schedulePic(scheduleRows.id, false);
            const actualPic = await schedulePic(scheduleRows.id, true);
            scheduleRows.checkers = checkerPic ? checkerPic[0] : null;
            scheduleRows.actualPic = actualPic ? actualPic[0] : null;
            scheduleRows.manual_book_file = scheduleRows.manual_book_file ? `${process.env.APP_HOST}/file?path=${scheduleRows.manual_book_file}` : null;

            response.success(res, "success to get detail schedule", scheduleRows);
        } catch (e) {
            console.log(e);
            response.failed(res, {message: "Error to get detail schedules", detail: e,});
        }
    },
    getTodayActivities: async (req, res) => {
        try {
            /*
                      DATA MAP:
                      1. GET SCHEDULES ALL BASED ON FILTER optional CURRENT DATE, LINE, STATUS
                  */
            console.log(req.body);
            let containerFilter = queryHandler(req.body);
            containerFilter.length > 0
                ? (containerFilter = containerFilter.join(" AND "))
                : (containerFilter = "");
            let schedulesData = await queryGET(
                table.v_schedules_monthly,
                `WHERE ${containerFilter} ORDER BY day_idx`
            );
            let mapSchedulesPics = await schedulesData.map(async (schedule) => {
                let schedule_id = await uuidToId(
                    table.tb_r_schedules,
                    "schedule_id",
                    schedule.schedule_id
                ); //table, col, uuid
                let q = `SELECT 
                trsc.uuid as schedule_checker_id,
                tmu.uuid as user_id,
                tmu.user_nm,
                tmu.noreg
                FROM tb_r_schedule_checker trsc
                JOIN tb_m_users tmu ON tmu.user_id = trsc.user_id
                WHERE trsc.schedule_id = ${schedule_id}`;
                let checkers = await queryCustom(q);
                let dateOffset =
                    new Date(
                        schedule.val_periodic * schedule.prec_val * timestampDay
                    ).getTime() +
                    new Date(
                        schedule.actual_check_dt
                            ? schedule.actual_check_dt
                            : schedule.plan_check_dt
                    ).getTime();
                schedule.next_check = new Date(dateOffset);
                schedule.checkers = checkers.rows;
                return schedule;
            });
            const waitMapSchedule = await Promise.all(mapSchedulesPics);
            response.success(res, "success to get today activities", waitMapSchedule);
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to get today activities");
        }
    },
    addPlanPic: async (req, res) => {
        // Assign PIC convert UUID to ID
        // tb_r_schedule_checker (user_id, schedule_id)
        let isUpdate = false;

        try {
            let {user_ids, schedule_id, user_id, schedule_checker_id} = req.body;
            if (user_ids) {
                response.failed(res, "this action is no longer work");
                return;
            } else if (user_id) {
                const findExists = schedule_checker_id ? (await queryGET(table.tb_r_schedule_checker, `where uuid = '${schedule_checker_id}'`)) : [];
                if (findExists.length > 0) {
                    isUpdate = true;
                    const updateScheduleCheckerRawSql = `update ${table.tb_r_schedule_checker} 
                                                                set 
                                                                    user_id = (select user_id from ${table.tb_m_users} where uuid = '${user_id}') 
                                                                where 
                                                                    uuid = '${schedule_checker_id}'`;
                    await queryCustom(updateScheduleCheckerRawSql);
                } else {
                    const insertScheduleCheckerRawSql = `insert into ${table.tb_r_schedule_checker} 
                                                                    (uuid, user_id, schedule_id, created_by, created_dt)
                                                                values (
                                                                            '${v4()}', 
                                                                            (select user_id from ${table.tb_m_users} where uuid = '${user_id}'), 
                                                                            (select schedule_id from ${table.tb_r_schedules} where uuid = '${schedule_id}'),
                                                                            'modify schedule',
                                                                            now()
                                                                       )`;
                    await queryCustom(insertScheduleCheckerRawSql);

                }
            }

            response.success(res, `success to ${isUpdate ? 'update' : 'add'} pic`, []);
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to add pic");
        }
    },
    editPlanDate: async (req, res) => {
        // Edit Plan Date
        //Update convert uuid to id schedule
        //Update table
        //tb_r_schedules plan_check_dt
        try {
            console.log(req.body);
            const RUNNING_TASK = await queryTransaction(async (db) => {
                let {plan_check_dts, schedule_id} = req.body;
                console.log(req.body);
                // schedule_id = `(SELECT schedule_id FROM ${table.tb_r_schedules} WHERE uuid = '${schedule_id}')`
                let ledger_itemcheck_id = `(SELECT ledger_itemcheck_id FROM ${table.tb_r_schedules} WHERE uuid = '${schedule_id}')`;

                // substract_reschdule:
                // SELECT val_periodic, prec_val FROM v_generator_itemchecks where ledger_itemcheck_id = ${ledger_itemcheck_id} (val_periodic * prec_val)
                const substract_reschdule = await queryGetTransaction(
                    db,
                    table.v_generator_itemchecks,
                    ` WHERE ledger_itemcheck_id = ${ledger_itemcheck_id}`
                );
                console.log(substract_reschdule);
                const last_check_dt = {
                    last_check_dt: moment(plan_check_dts)
                        .subtract(
                            substract_reschdule[0].val_periodic *
                            substract_reschdule[0].prec_val,
                            "days"
                        )
                        .format("YYYY-MM-DD"),
                };
                console.log(last_check_dt);

                // // UPDATE tb_r_ledger_itemchecks set last_check_dt = '${moment().subtract(substract_reschdule, 'days').format("YYYY-MM-DD")}' where ledger_itemcheck_id = ${ledger_itemcheck_id} // substract with periodic

                // lastcheck_editted
                await queryPutTransaction(
                    db,
                    table.tb_r_ledger_itemchecks,
                    last_check_dt,
                    ` WHERE ledger_itemcheck_id = ${ledger_itemcheck_id}`
                );
                // reschedule_changes
                let changes_plan_check_dt = {
                    plan_check_dt: plan_check_dts,
                    status_id: `(select status_id from ${table.tb_m_status} where lower(status_nm) = 'revisi')`,
                };

                await queryPutTransaction(
                    db,
                    table.tb_r_schedules,
                    changes_plan_check_dt,
                    ` WHERE schedule_id = (SELECT schedule_id FROM ${table.tb_r_schedules} WHERE uuid = '${schedule_id}')`
                );
                return "Success to edit plan date";
            });
            response.success(res, "success to edit plan date", RUNNING_TASK);
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to edit plan date");
        }
    },
    getDelayedItem: async (rea, res) => {
        try {
            // Get the previous month date range
            let previousMonthRange = getPreviousMonthRange();

            // Fetch delayed data
            let delayedData = await queryGET(
                table.v_schedules_monthly,
                `WHERE status_nm = 'DELAY' AND val_periodic != 1 AND period_nm != 'Month' AND plan_check_dt >= '${previousMonthRange.firstDay}' AND plan_check_dt <= '${previousMonthRange.lastDay}'`
            );

            let groupedData = delayedData.reduce((acc, item) => {
                if (!acc[item.line_nm]) {
                    acc[item.line_nm] = {items: [], count: 0};
                }
                acc[item.line_nm].items.push(item);
                acc[item.line_nm].count++;
                return acc;
            }, {});

            let result = Object.keys(groupedData).map((key) => ({
                line_nm: key,
                items: groupedData[key].items,
                count: groupedData[key].count,
            }));

            // Output the result
            console.log(result);
            response.success(res, "berhasil", result);
        } catch (error) {
            console.log(error);
        }
    },
    getVisualize: async (req, res) => {
        try {
            let containerFilter = queryHandler(req.body);
            containerFilter.length > 0
                ? (containerFilter = containerFilter.join(" AND "))
                : (containerFilter = "");
            let schedulesData = await queryGET(
                table.v_schedules_monthly,
                `WHERE ${containerFilter} ORDER BY day_idx`
            );
            let mapScheduleVisualize = await schedulesData.map(async (schedule) => {
                let schedule_id = await uuidToId(
                    table.tb_r_schedules,
                    "schedule_id",
                    schedule.schedule_id
                ); //table, col, uuid
                // Add plan_duration and actual_duration columns from tb_r_schedules table
                let scheduleData = await queryGET(
                    table.tb_r_schedules,
                    `WHERE schedule_id = ${schedule_id}`
                );
                if (scheduleData.length > 0) {
                    schedule.plan_duration = scheduleData[0].plan_duration;
                    schedule.actual_duration = scheduleData[0].actual_duration;
                } else {
                    schedule.plan_duration = null;
                    schedule.actual_duration = null;
                }
                return schedule;
            });
            const waitMapSchedule = await Promise.all(mapScheduleVisualize);

            let series = [
                {
                    name: "actual duration",
                    type: "column",
                    data: [],
                },
                {
                    name: "plan duration",
                    type: "line",
                    data: [],
                },
            ];
            let labels = [];

            waitMapSchedule.forEach((schedule) => {
                series[0].data.push(schedule.actual_duration ?? 0);
                series[1].data.push(schedule.plan_duration);
                labels.push(schedule.itemcheck_nm.slice(0, 10));
                // console.log(schedule);
            });

            const visualizeData = {
                series,
                labels,
            };

            response.success(
                res,
                "success to get visualization of item check",
                visualizeData
            );
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to get visualization of item check");
        }
    },
    getVisualizeStatus: async (req, res) => {
        try {
            const containerFilter = queryHandler(req.body).join(" AND ") || "1=1";

            const q = `
        SELECT 
          line_nm,
          SUM(CASE WHEN status_nm = 'DONE' THEN 1 ELSE 0 END) AS done,
          SUM(CASE WHEN status_nm = 'PLANNING' THEN 1 ELSE 0 END) AS planning,
          SUM(CASE WHEN status_nm = 'DELAY' THEN 1 ELSE 0 END) AS delay,
          COUNT(*) AS total
        FROM v_schedules_monthly vsm
        WHERE ${containerFilter} AND period_nm != 'Day'
        GROUP BY line_nm
      `;

            const cons = (await queryCustom(q)).rows;

            const series = [
                {name: "Planned", type: "column", data: []},
                {name: "Done", type: "column", data: []},
                {name: "Total Item", type: "line", data: []},
                {name: "Delay", type: "column", data: []},
            ];

            const labels = cons.map((row) => {
                series[0].data.push(row.planning ?? 0);
                series[1].data.push(row.done ?? 0);
                series[2].data.push(row.total ?? 0);
                series[3].data.push(row.delay ?? 0);
                return row.line_nm;
            });

            const visualizeData = {series, labels};
            response.success(res, "berhasil", visualizeData);

        } catch (error) {
            console.error(error);
            response.failed(res, "Error to get visualization of item check");
        }
    },
    getVisualizeLine: async (req, res) => {
        try {
            let containerFilter = queryHandler(req.body);
            containerFilter.length > 0
                ? (containerFilter = containerFilter.join(" AND "))
                : (containerFilter = "");

            let q = `
                SELECT line_nm, 
                COUNT(*) AS item_count,
                SUM(duration) AS total_duration
                FROM v_schedules_monthly vsm
                WHERE ${containerFilter}
                GROUP BY line_nm;                        
            `;
            cons = (await queryCustom(q)).rows;

            let series = [
                {
                    name: "Total Item",
                    type: "column",
                    data: [],
                },
                {
                    name: "Total Duration",
                    type: "column",
                    data: [],
                },
            ];
            let labels = [];

            cons.forEach((cons) => {
                series[0].data.push(cons.item_count ?? 0);
                series[1].data.push(Math.round((cons.total_duration ?? 0) / 60));
                labels.push(cons.line_nm);
                // console.log(schedule);
            });

            const visualizeData = {
                series,
                labels,
            };

            response.success(res, "berhasil", visualizeData);
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to get visualization of item check");
        }
    },
    getVusualizeYearly: async (req, res) => {
        try {
            let containerFilter = queryHandler(req.body);
            console.log(containerFilter);
            containerFilter.length > 0
                ? (containerFilter = containerFilter.join(" AND "))
                : (containerFilter = "");

            let dataset = [];
            for (let i = 1; i <= 12; i++) {
                let q = `
                SELECT line_nm, 
                COUNT(*) AS item_count,                
                SUM(duration) AS total_duration
                FROM v_schedules_monthly vsm
                WHERE ${containerFilter} AND EXTRACT('month' from plan_check_dt) = ${i}
                GROUP BY line_nm;                        
            `;
                console.log(q);
                cons = (await queryCustom(q)).rows;

                let series = [
                    {
                        name: "Total Item",
                        type: "column",
                        data: [],
                    },
                    {
                        name: "Total Duration",
                        type: "column",
                        data: [],
                    },
                ];
                let labels = [];

                cons.forEach((cons) => {
                    series[0].data.push(cons.item_count ?? 0);
                    series[1].data.push(Math.round((cons.total_duration ?? 0) / 60));
                    // series[2].data.push(cons.total_item_count ?? 0);
                    labels.push(cons.line_nm);
                });

                const visualizeData = {
                    series,
                    labels,
                };
                dataset[i] = visualizeData;
            }
            response.success(res, "berhasil", dataset);
        } catch (error) {
            console.log(error);
            response.failed(res, "Error to get visualization of item check");
        }
    },
    getVisualTrendMH: async (req, res) => {
        try {
            let containerFilter = queryHandler(req.body);
            console.log(containerFilter);
            containerFilter.length > 0
                ? (containerFilter = containerFilter.join(" AND "))
                : (containerFilter = "");

            let dataset = [];
            let series = [
                {
                    name: "> 3 Hour",
                    group: "duration",
                    data: [],
                },
                {
                    name: "MH Weekend",
                    group: "manhour",
                    data: [],
                },
                {
                    name: "< 3 Hour",
                    group: "duration",
                    data: [],
                },
                {
                    name: "MH Weekday",
                    group: "manhour",
                    data: [],
                },
            ];
            const monthNames = [
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
            ];

            let labels = [];
            for (let i = 1; i <= 12; i++) {
                let q = `
                SELECT
                    SUM(total_duration_above) AS sum_greater_than_3_hours,
                    SUM(total_duration_below) AS sum_less_than_or_equal_3_hours
                FROM (
                    SELECT
                        SUM(CASE WHEN duration > 180 THEN duration ELSE 0 END)/60 AS total_duration_above,
                        SUM(CASE WHEN duration <= 180 THEN duration ELSE 0 END)/60 AS total_duration_below
                    FROM v_schedules_monthly vsm
                    WHERE EXTRACT('month' FROM plan_check_dt) = ${i}
                      AND EXTRACT('year' FROM plan_check_dt) = 2025  -- Filter for the current year
                    GROUP BY plan_check_dt
                ) AS subquery;
            `;
                console.log(q);
                durationMonth = (await queryCustom(q)).rows;

                durationMonth.forEach((cons) => {
                    series[0].data.push(Number(cons.sum_greater_than_3_hours) ?? 0);
                    series[1].data.push(8 * 5 * 8);
                    series[2].data.push(Number(cons.sum_less_than_or_equal_3_hours) ?? 0);
                    series[3].data.push(22 * 7);
                    labels.push(monthNames[i - 1]);
                });
            }
            const visualizeData = {
                series,
                labels,
            };
            dataset = visualizeData;
            response.success(res, "berhasil", dataset);
        } catch (error) {
            console.log(error);
        }
    },
};
