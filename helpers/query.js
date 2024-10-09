const {database, databasePool} = require("../config/database");
const moment = require("moment");

const _defaultCallbackTrans = async (db = databasePool) => {
};

module.exports = {
    queryGET: async (table, whereCond = false, cols = null, limit = null) => {
        return new Promise(async (resolve, reject) => {
            let limit = "";

            let selectedCols = "*";
            if (cols) {
                selectedCols = cols.join(",");
            }
            if (!whereCond) {
                whereCond = "";
            }
            let q = `SELECT row_number() over()::INTEGER as no, ${selectedCols} FROM ${table} ${whereCond}`;
            console.log(q);
            await database
                .query(q)
                .then((result) => {
                    resolve(result.rows);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    },
    queryPOSTWhereCond: async (table, data, whereCond = "") => {
        return new Promise(async (resolve, reject) => {
            let containerColumn = [];
            let containerValues = [];
            for (const key in data) {
                containerColumn.push(key);
                console.log(data[key]);
                if (typeof data[key] == "string" && data[key].includes("SELECT")) {
                    containerValues.push(data[key]);
                } else {
                    containerValues.push(`'${data[key]}'`);
                }
            }
            // INSERT INTO tb_r_schedules (schedule_id, uuid, ledger_itemcheck_id, plan_duration, plan_check_dt, status_id, created_by)
            // SELECT
            //     COALESCE((SELECT MAX(schedule_id) FROM tb_r_schedules), 0) + 2030,
            //     '0e9c814d-2bcc-469b-b532-b49f68cb4dab',
            //     '1251',
            //     '20',
            //     '2024-07-06',
            //     '0',
            //     'GENERATOR'
            // WHERE NOT EXISTS (
            //     SELECT 1
            //     FROM tb_r_schedules
            //     WHERE plan_check_dt = '2024-07-06'
            //       AND actual_check_dt IS NULL
            //       AND ledger_itemcheck_id = '1251'
            // );
            let q = `INSERT INTO ${table}(${containerColumn.join(",")}) 
      SELECT
          ${containerValues.join(",")}
      WHERE NOT EXISTS (
          ${whereCond}
      );`;
            console.log(q);
            await database
                .query(q)
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    },
    queryPOST: async (table, data, whereCond = "") => {
        console.log(data);
        return new Promise(async (resolve, reject) => {
            let containerColumn = [];
            let containerValues = [];
            // handles data.length > 0
            let isArray = data.length > 0;
            if (isArray) {
                for (const key in data[0]) {
                    containerColumn.push(key);
                }
                for (let i = 0; i < data.length; i++) {
                    const element = data[i];
                    let val = [];
                    for (const key in element) {
                        val.push(`'${element[key]}'`);
                    }
                    containerValues.push(`(${val.join(",")})`);
                }
            } else {
                for (const key in data) {
                    containerColumn.push(key);
                    let value = data[key];
                    if (typeof value === "string" && (value.includes("select") || value.toLowerCase().includes('now'))) {
                        value = `${data[key]}`;
                    } else {
                        value = `'${data[key]}'`;
                    }

                    containerValues.push(
                        data[key] && data[key] != "null"
                            ? `${value}`
                            : "NULL"
                    );
                }
            }

            let q = `INSERT INTO ${table}(${containerColumn.join(
        ","
      )}) VALUES (${containerValues.join(",")}) ${whereCond} RETURNING *`;
            console.log(q);
            await database
                .query(q)
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    console.log(err);
                    reject(err);
                });
        });
    },
    queryBulkPOST: async (table, data) => {
        return new Promise(async (resolve, reject) => {
            let containerColumn = [];
            let containerValues = [];
            let mapBulkData = await data.map((item) => {
                containerValues = [];
                for (const key in item) {
                    if (key != "childs") {
                        if (item[key] || typeof item[key] === "number") {
                            console.log();
                            if (typeof item[key] == "object") {
                                containerValues.push(`'{${item[key].join(",")}}'`);
                            } else {
                                containerValues.push(`'${item[key]}'`);
                            }
                        } else {
                            containerValues.push(`NULL`);
                        }
                    }
                }
                return `(${containerValues.join(",")})`;
            });
            for (const key in data[0]) {
                containerColumn.push(key);
            }
            let q = `INSERT INTO ${table} (${containerColumn.join(
        ","
      )}) VALUES ${mapBulkData.join(",")} RETURNING *`;
            // console.log(q);
            await database
                .query(q)
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    console.log(err);
                    reject(err);
                });
        });
    },
    queryPUT: async (table, data, whereCond = "") => {
        return new Promise(async (resolve, reject) => {
            let containerSetValues = [];
            // console.log(data);
            for (const key in data) {
                // console.log(data[key] == 0);
                if (
                    (data[key] && data[key] != "" && data[key] != "null") ||
                    data[key] == 0
                ) {
                    containerSetValues.push(`${key} = '${data[key]}'`);
                }
            }

            let q = `UPDATE ${table} SET ${containerSetValues.join(
        ","
      )} ${whereCond} RETURNING *`;
            // console.log(q);
            await database
                .query(q)
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    },
    queryDELETE: async (table, whereCond = "") => {
        return new Promise(async (resolve, reject) => {
            let q = `DELETE FROM ${table} ${whereCond}`;
            await database
                .query(q)
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    },
    queryCustom: async (sql) => {
        return new Promise(async (resolve, reject) => {
            let q = sql;
            // console.log(q);
            await database
                .query(q)
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    },
    querySoftDELETE: async (table, whereCond = "", deleted_by) => {
        console.log(deleted_by);
        return new Promise(async (resolve, reject) => {
            let deleted_dt = moment().format("YYYY-MM-DD");
            let q = `UPDATE ${table} 
                    SET 
                        deleted_by = '${deleted_by}',
                        deleted_dt = '${deleted_dt}'
                    where 
                        ${whereCond}`;
            console.log(q);
            await database
                .query(q)
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    },
    queryTransaction: async (callback = _defaultCallbackTrans) => {
        const db = await databasePool.connect();

        const finish = async () => {
            await db.query(`SET session_replication_role = 'origin'`);
            db.release();
        };

        try {
            await db.query(`SET session_replication_role = 'replica'`);
            await db.query("BEGIN");

            const r = await callback(db);
            await db.query("COMMIT");
            await finish();
            return r;
        } catch (error) {
            //console.log('error transaction', error)
            await db.query("ROLLBACK");
            await finish();
            throw error;
        }
    },
    queryGetTransaction: async (
        db,
        table,
        whereCond = false,
        cols = null,
        limit = null
    ) => {
        // async (table, whereCond = false, cols = null, limit = null) => {
        return new Promise(async (resolve, reject) => {
            let limit = "";

            let selectedCols = "*";
            if (cols) {
                selectedCols = cols.join(",");
            }
            if (!whereCond) {
                whereCond = "";
            }
            let q = `SELECT row_number() over()::INTEGER as no, ${selectedCols} FROM ${table} ${whereCond}`;
            console.log(q);
            await db
                .query(q)
                .then((result) => {
                    resolve(result.rows);
                })
                .catch((err) => {
                    reject(err);
                });
        });
        // },
    },
    queryPostTransaction: async (dbPool, table, data) => {
        return new Promise(async (resolve, reject) => {
            let containerColumn = [];
            let containerValues = [];
            for (const key in data) {
                containerColumn.push(key);

                let value = data[key];
                if (typeof value === "string" && (value.toLowerCase().includes("select") || value.toLowerCase().includes('now'))) {
                    value = `${data[key]}`;
                } else {
                    value = `'${data[key]}'`;
                }

                containerValues.push(
                    data[key] && data[key] != "null" ? `${value}` : "NULL"
                );
            }
            let q = `INSERT INTO ${table}(${containerColumn.join(
        ","
      )}) VALUES (${containerValues.join(",")}) RETURNING *`;
            console.log(q);
            //logger(q)
            await dbPool
                .query(q)
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    console.log(err);
                    reject(err);
                });
        });
    },
    queryPutTransaction: async (dbPool, table, data, whereCond = "") => {
        return new Promise(async (resolve, reject) => {
            let containerSetValues = [];
            for (const key in data) {
                if (typeof data[key] === 'string' && data[key].toLowerCase().includes('now')) {
                    containerSetValues.push(`${key} = ${data[key]}`);
                } else if (data[key] == "CURRENT_TIMESTAMP") {
                    containerSetValues.push(`${key} = CURRENT_TIMESTAMP`);
                } else if (data[key] && data[key] != "null") {
                    let value = data[key];
                    if (typeof value === "string" && value.includes("select")) {
                        value = `${data[key]}`;
                    } else if (typeof value === "string") {
                        value = `'${data[key]}'`;
                    } else {
                        value = `${data[key]}`;
                    }

                    containerSetValues.push(`${key} = ${value}`);
                }
            }

            let q = `UPDATE ${table} SET ${containerSetValues.join(
        ","
      )} ${whereCond} RETURNING *`;
            console.log(q);
            await dbPool
                .query(q)
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    },
};
