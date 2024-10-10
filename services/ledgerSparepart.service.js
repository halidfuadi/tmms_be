const {queryTransaction, mapBulkValues} = require("../helpers/query");
const table = require("../config/table");
const {v4} = require("uuid");
const {getCurrentDateTime} = require("../functions/getCurrentDateTime");
const uuidToId = require("../helpers/uuidToId");


const ledgerSparepartInsertBulk = async (db, data) => {
    const arr = [];

    for (let i = 0; i < data.length; i++) {
        const ledgerItemCheckId = data[i].ledger_itemcheck_id ? (await uuidToId(table.tb_r_ledger_itemchecks, 'ledger_itemcheck_id', data[i].ledger_itemcheck_id)) : null;

        const rawFindExists = `select * from ${table.tb_r_ledger_spareparts} where sparepart_id = ${data[i].sparepart_id} and ledger_itemcheck_id = ${ledgerItemCheckId}`;
        const findExists = (await db.query(rawFindExists)).rows;
        if (findExists.length > 0) {
            continue;
        }

        const values = {
            sparepart_id: data[i].sparepart_id,
            uuid: v4(),
            ledger_itemcheck_id: /^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(data[i].ledger_itemcheck_id)
                ? ledgerItemCheckId
                : data[i].ledger_itemcheck_id,
            created_dt:
                getCurrentDateTime(),
            created_by:
                'USER',
            changed_dt:
                getCurrentDateTime(),
            changed_by:
                'USER',
        };

        if (data[i].ledger_id) {
            values.ledger_id = data[i].ledger_id;
        }

        arr.push(values);
    }

    const {columns, values} = mapBulkValues(arr);
    const rawInsert = `insert into ${table.tb_r_ledger_spareparts} (${columns.join(', ')}) values ${values.join(', ')}`;
    await db.query(rawInsert);
};

module.exports = {
    ledgerSparepartInsertBulk: ledgerSparepartInsertBulk
}