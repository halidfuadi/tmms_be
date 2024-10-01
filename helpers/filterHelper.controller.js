const table = require("../config/table");
const { queryPOST, queryPUT, queryGET, queryCustom } = require("./query");
const response = require("./response");
const queryHandler = require("../controllers/queryhandler.function");

module.exports = {
  inchargeTpmOpt: async (req, res) => {
    try {
      let incharge = await queryGET(
        table.tb_m_incharge,
        "ORDER BY created_dt ASC",
        ["uuid as incharge_id", "incharge_nm"]
      );
      response.success(res, "Success to get incharge", incharge);
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to get incharge");
    }
  },

  machineTpmOpt: async (req, res) => {
    try {
      let is_query = Object.keys(req.body).length > 0;

      let machine = await queryGET(
        table.tb_m_machines,
        `WHERE deleted_dt IS NULL ${
          is_query
            ? `AND line_id = (SELECT line_id FROM tb_m_lines WHERE uuid = '${req.body.line_id}')`
            : ""
        } ORDER BY machine_nm ASC`,
        ["uuid as machine_id", "machine_nm"]
      );
      response.success(res, "Success to get machine", machine);
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to get machine");
    }
  },
  lineTpmOpt: async (req, res) => {
    try {
      let line = await queryGET(table.tb_m_lines, "ORDER BY line_nm ASC", [
        "uuid as line_id",
        "line_nm",
      ]);
      response.success(res, "Success to get line", line);
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to get line");
    }
  },
  itemcheckTpmOpt: async (req, res) => {
    try {
      let itemcheck = await queryGET(table.tb_m_itemchecks, "ORDER BY created_dt ASC", [
        "uuid",
        "itemcheck_nm",
      ]);
      console.log(itemcheck);
      response.success(res, "Success to get itemcheck", itemcheck);
    } catch (error) {
      console.log(error);
      response.failed(res, "Error to get itemcheck");
    }
  },
};
