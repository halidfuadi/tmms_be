const {queryGET, queryCustom} = require("./query");
const table = require("../config/table");
const updateSchedule = async (ledger_itemcheck_id) => {
    let scheduleData = await queryGET(
        table.tb_r_schedules,
        `where 
                    plan_check_dt::date between date_trunc('MONTH', now())::date 
                        and (date_trunc('month', now()::date) + interval '1 month' - interval '1 day')::date -- determine first date and last date in month
                    and ledger_itemcheck_id = '${ledger_itemcheck_id}'`
    );

    const findGreatherThanSchedule = ``;

    if (scheduleData.length > 0) {

    }
};