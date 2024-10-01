const moment = require("moment");
const { queryGET, queryPOST, queryPUT } = require("../helpers/query");
const table = require("../config/table");

async function cronCheckDelayStatus() {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  let itemchecks = await queryGET(
    table.v_schedules_monthly,
    ` WHERE deleted_dt IS NULL AND EXTRACT(MONTH FROM plan_check_dt) = ${month}
    AND EXTRACT(YEAR FROM plan_check_dt) = ${year};`
  );
  // console.log(itemchecks);
  for (let index = 0; index < itemchecks.length; index++) {
    const element = itemchecks[index];
    // console.log(element);
    let sethours =
      new Date(element.plan_check_dt).setHours(23, 59, 59, 999) +
      7 * 60 * 60 * 1000;
    let timePlan = new Date(sethours).getTime();
    let currentTime = new Date().getTime();

    if (new Date(timePlan).getDate() == 25) {
      console.log(new Date(timePlan));
      console.log(new Date(currentTime));
      console.log(timePlan - currentTime);
    }
    const isDelay = timePlan - currentTime < 0 && !element.actual_check_dt;
    const schedule_id = element.schedule_id;
    const findingData = await queryGET(
      table.v_tpm_findings,
      `WHERE schedule_id = '${schedule_id}'`
    );
    const is_any_finding = findingData.length > 0;
    // 0: planning
    // 1: delay
    // 2: finding
    // 3: revisi
    // 4: done
    if (isDelay) {
      await queryPUT(
        table.tb_r_schedules,
        { status_id: 1 },
        `WHERE uuid = '${schedule_id}'`
      );
    } else if (element.actual_check_dt && !is_any_finding) {
      await queryPUT(
        table.tb_r_schedules,
        { status_id: 4 },
        `WHERE uuid = '${schedule_id}'`
      );
    } else if (is_any_finding) {
      await queryPUT(
        table.tb_r_schedules,
        { status_id: 2 },
        `WHERE uuid = '${schedule_id}'`
      );
    } else {
      await queryPUT(
        table.tb_r_schedules,
        { status_id: 0 },
        `WHERE uuid = '${schedule_id}'`
      );
    }
  }
}

module.exports = cronCheckDelayStatus;
