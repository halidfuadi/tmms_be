const pg = require("pg");
pg.types.setTypeParser(1082, function(stringValue) {
    return stringValue; //1082 for date type
});
require("dotenv").config();
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: false,
    timezone: "Asia/Jakarta",
};

const database = new pg.Client(config);

const databasePool = new pg.Pool(config);

const types = pg.types;
types.setTypeParser(1114, (stringValue) => {
    return stringValue; //1114 for time without timezone type
});

types.setTypeParser(1082, (stringValue) => {
    return stringValue; //1082 for date type
});

module.exports = {
    database,
    databasePool,
};