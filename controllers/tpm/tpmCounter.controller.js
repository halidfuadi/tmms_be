const table = require("../../config/table");
const {
  queryPOST,
  queryPUT,
  queryGET,
  queryCustom,
  queryBulkPOST,
} = require("../../helpers/query");

const response = require("../../helpers/response");
const { groupFunction } = require("../../functions/groupFunction");
const queryHandler = require("../queryhandler.function");
const getLastIdData = require("../../helpers/getLastIdData");
const { v4 } = require("uuid");
const { uuid } = require("uuidv4");
const { getCurrentDateTime } = require("../../functions/getCurrentDateTime");

async function uuidToId(table, col, uuid) {
  console.log(`SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`);
  // `SELECT ${col} FROM ${table} WHERE uuid = '${uuid}'`
  let rawId = await queryGET(table, `WHERE uuid = '${uuid}'`, [col]);
  return rawId[0][col];
}

module.exports = {
  getCounter: async (req, res) => {
    try {
      let filter = queryHandler(req.query);
      // console.log(filter);
      let data = await queryGET(
        table.v_tpm_counter,
        filter + "WHERE deleted_by IS NULL ORDER BY est_dt ASC"
      );
      data.forEach((item) => {
        item.percentage = Math.round(
          ((item.last_counter - item.init_counter) / item.lifespan_counter) *
            100
        );
      });
      data.sort((a, b) => b.percentage - a.percentage);      
      response.success(res, "success", data);
    } catch (error) {
      console.log(error);
    }
  },

  getDetail: async (req, res) => {
    try {
      let filter = queryHandler(req.query);      
      filter.length > 0 ? (filter = filter.join(" AND ")) : (filter = "");            
      let data = await queryGET(table.v_counter_detail, `WHERE ${filter}`);
      data.forEach((item) => {
        item.percentage = Math.round(
          ((item.last_counter - item.init_counter) / item.lifespan_counter) * 100
        );
      });
      console.log(data);
      response.success(res, "success", data);
    } catch (error) {
      console.log(error);
    }
  },

  postExecute: async (req, res) => {
    try {
      let data = req.body
      console.log(data);    
      let okData = {}
      let ngData = {}

      let ledger_itemcheck_id = await uuidToId(table.tb_r_ledger_itemchecks, 'ledger_itemcheck_id', data.ledger_itemcheck_id)
      let ledger_id = (await queryGET(table.tb_r_ledger_itemchecks, `where ledger_itemcheck_id = ${ledger_itemcheck_id}`, ['ledger_id']))[0].ledger_id
      console.log(ledger_id);
      

      if(data.judgement){              
        ngData = {
          finding_id: await getLastIdData(table.tb_r_finding_counter, 'finding_id'),
          uuid: v4(),
          user_id: (await queryGET(table.tb_m_users, `where uuid = '${data.pic}'`, ['user_id']))[0].user_id,
          problem: data.problem_nm,
          action_plan: data.problem_detail,
          plan_check_dt: data.plan_check_dt,
          created_dt: getCurrentDateTime(),
          created_by: 'SYSTEM',
          status_id: 2,
          ledger_itemcheck_id: ledger_itemcheck_id,      
        }

        let postedNG = await queryPOST(table.tb_r_finding_counter, ngData)

        response.success(res, 'updated finding', postedNG)
        
      }else{
        okData = {
          history_counter_id: await getLastIdData(table.tb_r_history_counter, 'history_counter_id'),
          uuid: v4(),
          ledger_itemcheck_id: ledger_itemcheck_id,
          counter_changed: data.counter_changed,
          initial_counter: data.initial_counter,
          initial_counter_dt: data.initial_counter_dt,
          counter_changed_dt: data.counter_changed_dt,
          created_dt: getCurrentDateTime(),
          created_by: 'SYSTEM',
          start_time: data.start_time,
          end_time: data.end_time,
          pic_nm: (await queryGET(table.tb_m_users, `where uuid = '${data.pic_nm}'`, ['user_nm']))[0].user_nm
        }

        let postedOK = await queryPOST(table.tb_r_history_counter, okData)        

        resetCounter = {
          init_counter: (await queryGET(table.tb_m_ledgers, `where ledger_id = ${ledger_id}`, ['last_counter']))[0].last_counter,
          init_counter_dt: getCurrentDateTime(),
          est_dt: null,          
        }

        let reset = await queryPUT(table.tb_r_ledger_itemchecks, resetCounter, `where ledger_itemcheck_id = ${ledger_itemcheck_id}`)
        
        response.success(res, 'data inputed', {postedOK, reset})

      }

      console.log(okData);
      console.log(ngData);
      

    } catch (error) {
      console.log(error);
      response.error(res, error)
    }
  },

  
};
