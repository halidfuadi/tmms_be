const moment = require("moment");
const {
  queryGET,
  queryPOST,
  queryPUT,
  queryCustom,
} = require("../helpers/query");
const table = require("../config/table");
const axios = require("axios");

async function cronCounterLedger() {
  try {
    console.log("CHECKING COUNTER...");

    const data = await queryGET(table.v_generator_counter, "");
    const containerQueryUpdateCt = await data.map(async (item) => {
      // try {
      let content = await axios
        .get(
          process.env.VUE_APP_REDNODE_API_URL + "/counter/" + item.machine_nm
        )
        .then((response) => {
          return response;
        })
        .catch((error) => {
          return error;
        });

      if (content.data?.data) {
        // return item
        if (content.data.data.counter != item.last_counter) {
          item.current_counter = content.data.data.counter;
          return `UPDATE ${table.tb_m_ledgers} SET last_counter = ${content.data.data.counter} WHERE machine_id = ${item.machine_id}`;
        }
      }
    });
    console.log("------------------------------------------");
    let waitResponse = await Promise.all(containerQueryUpdateCt);
    const filteringData = waitResponse.filter((data) => data !== undefined);
        
    if (filteringData.length > 0) {
      const responseInserted = await queryCustom(`${filteringData.join(";")}`);
      // console.log(responseInserted);
      return true;
    }
    console.log("no counter updated!");
    return false;
  } catch {
    console.log(error);
  }
}

async function cronEstimationDate() {
  try {
    console.log("Count Estimation Data...");

    const data = await queryGET(table.v_generator_counter_est_date, "");    
    const currentDate = moment();    
    const updates = [];
    
    data.forEach(item => {
      const counter = +item.last_counter - +item.init_counter;
      const initialDate = moment(item.init_counter_dt);
      
      const daysElapsed = currentDate.diff(initialDate, 'days');
      if (daysElapsed <= 0 || counter <= 0) {
        // Skip invalid data
        return;
      }

      const usageRate = counter / daysElapsed;
      
      const remainedCycle = item.lifespan_counter - counter;
      let remainedDay = Math.floor(remainedCycle / usageRate);
      
      // Ensure remainedDay is not negative and that the estimation makes sense
      if (remainedDay < 0) {
        remainedDay = 0; // Set a minimum of 0 days if negative
      }

      let estimatedEndDate = currentDate.clone().add(remainedDay, 'days');

      // Ensure the estimated date is not before the current date
      if (estimatedEndDate.isBefore(currentDate)) {
        estimatedEndDate = currentDate; // Set the estimation to today if it's in the past
      }

      console.log({
        ledger_itemcheck_id: item.ledger_itemcheck_id,
        counter,
        initialDate: initialDate.format("YYYY-MM-DD HH:mm:ss"),
        currentDate: currentDate.format("YYYY-MM-DD HH:mm:ss"),
        daysElapsed,
        usageRate,
        remainedCycle,
        remainedDay,
        estimatedEndDate: estimatedEndDate.format("YYYY-MM-DD HH:mm:ss")
      });

      // Add the update to the updates array
      updates.push({
        ledger_itemcheck_id: item.ledger_itemcheck_id,
        est_dt: estimatedEndDate.format("YYYY-MM-DD HH:mm:ss")
      });
    });

    // Perform batch update if there are updates to process
    if (updates.length > 0) {
      await Promise.all(
        updates.map(update =>
          queryPUT(table.tb_r_ledger_itemchecks, { est_dt: update.est_dt }, `WHERE ledger_itemcheck_id = ${update.ledger_itemcheck_id}`)
        )
      );
      console.log(`${updates.length} records updated.`);
    }

  } catch (error) {
    console.error("Error:", error);
  }
}




module.exports = { cronCounterLedger, cronEstimationDate };
