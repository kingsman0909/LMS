require("dotenv").config();

const mysql = require("mysql2/promise");

/*
|--------------------------------------------------------------------------
| DATABASE MODE
|--------------------------------------------------------------------------
|
| DEVELOPMENT=true  + DEBUGGER=false
|     -> AIVEN
|
| DEVELOPMENT=false + DEBUGGER=true
|     -> LOCALHOST
|
*/

const isDevelopment =
    String(process.env.DEVELOPMENT).toLowerCase() === "true";

const isDebugger =
    String(process.env.DEBUGGER).toLowerCase() === "true";


/*
|--------------------------------------------------------------------------
| DATABASE CONFIG
|--------------------------------------------------------------------------
*/

let dbConfig;
let dbMode;

if (isDevelopment && !isDebugger) {

    // ==============================================================
    // AIVEN
    // ==============================================================

    dbMode = "AIVEN";

    dbConfig = {
        host: process.env.AIVEN_DB_HOST,
        port: Number(process.env.AIVEN_DB_PORT),
        user: process.env.AIVEN_DB_USER,
        password: process.env.AIVEN_DB_PASSWORD,
        database: process.env.AIVEN_DB_NAME,

        ssl: {
            rejectUnauthorized: false
        }
    };

} else if (!isDevelopment && isDebugger) {

    // ==============================================================
    // LOCALHOST
    // ==============================================================

    dbMode = "LOCALHOST";

    dbConfig = {
        host: process.env.LOCAL_DB_HOST || "localhost",
        port: Number(process.env.LOCAL_DB_PORT || 3306),
        user: process.env.LOCAL_DB_USER || "root",
        password: process.env.LOCAL_DB_PASSWORD,
        database: process.env.LOCAL_DB_NAME || "lms_db"
    };

} else {

    throw new Error(
        `[DB] Invalid database mode. ` +
        `DEVELOPMENT=${isDevelopment}, ` +
        `DEBUGGER=${isDebugger}. ` +
        `Use either DEVELOPMENT=true + DEBUGGER=false ` +
        `or DEVELOPMENT=false + DEBUGGER=true.`
    );
}


/*
|--------------------------------------------------------------------------
| DISPLAY DATABASE INFORMATION
|--------------------------------------------------------------------------
*/

console.log("");
console.log("========================================");
console.log("         DATABASE CONFIGURATION");
console.log("========================================");
console.log(`[DB] Mode       : ${dbMode}`);
console.log(`[DB] Host       : ${dbConfig.host}`);
console.log(`[DB] Port       : ${dbConfig.port}`);
console.log(`[DB] User       : ${dbConfig.user}`);
console.log(`[DB] Database   : ${dbConfig.database}`);
console.log(
    `[DB] SSL        : ${dbMode === "AIVEN" ? "ENABLED" : "DISABLED"}`
);
console.log("========================================");
console.log("");


/*
|--------------------------------------------------------------------------
| MYSQL CONNECTION POOL
|--------------------------------------------------------------------------
*/

const pool = mysql.createPool({

    ...dbConfig,

    waitForConnections: true,

    connectionLimit: 10,

    queueLimit: 0,

    enableKeepAlive: true,

    keepAliveInitialDelay: 0
});


/*
|--------------------------------------------------------------------------
| TRACK INITIALIZED CONNECTIONS
|--------------------------------------------------------------------------
|
| WeakSet prevents us from repeatedly executing SET SESSION
| on the same physical connection.
|
*/

const initializedConnections = new WeakSet();


/*
|--------------------------------------------------------------------------
| INITIALIZE CONNECTION
|--------------------------------------------------------------------------
*/

async function initializeConnection(connection) {

    if (dbMode !== "AIVEN") {
        return;
    }

    if (initializedConnections.has(connection)) {
        return;
    }

    await connection.query(`
        SET SESSION sql_mode = REPLACE(
            @@SESSION.sql_mode,
            'ANSI_QUOTES',
            ''
        )
    `);

    initializedConnections.add(connection);
}


/*
|--------------------------------------------------------------------------
| QUERY WRAPPER
|--------------------------------------------------------------------------
|
| Existing models can continue using:
|
|     db.query(...)
|
| No model refactoring required.
|
*/

const db = {

    /*
    |--------------------------------------------------------------------------
    | QUERY
    |--------------------------------------------------------------------------
    */

    async query(sql, values) {

        let connection;

        try {

            connection = await pool.getConnection();

            await initializeConnection(connection);

            return await connection.query(sql, values);

        } finally {

            if (connection) {
                connection.release();
            }

        }
    },


    /*
    |--------------------------------------------------------------------------
    | EXECUTE
    |--------------------------------------------------------------------------
    */

    async execute(sql, values) {

        let connection;

        try {

            connection = await pool.getConnection();

            await initializeConnection(connection);

            return await connection.execute(sql, values);

        } finally {

            if (connection) {
                connection.release();
            }

        }
    },


    /*
    |--------------------------------------------------------------------------
    | GET CONNECTION
    |--------------------------------------------------------------------------
    |
    | For code that manually obtains a connection.
    |
    */

    async getConnection() {

        const connection = await pool.getConnection();

        await initializeConnection(connection);

        return connection;
    }

};


/*
|--------------------------------------------------------------------------
| TEST DATABASE CONNECTION
|--------------------------------------------------------------------------
*/

(async () => {

    let connection;

    try {

        connection = await pool.getConnection();

        /*
         * IMPORTANT:
         * Wait until SQL mode is actually configured.
         */

        await initializeConnection(connection);

        await connection.query("SELECT 1");

        const [modeRows] = await connection.query(
            "SELECT @@SESSION.sql_mode AS sql_mode"
        );

        const sqlMode = modeRows[0].sql_mode || "";

        console.log(
            `[DB] MySQL connection successful → ${dbMode}`
        );

        console.log(
            `[DB] SQL Mode → ${sqlMode}`
        );

        console.log(
            `[DB] ANSI_QUOTES → ${
                sqlMode.includes("ANSI_QUOTES")
                    ? "ENABLED"
                    : "DISABLED"
            }`
        );

    } catch (error) {

        console.error("");
        console.error("========================================");
        console.error("       DATABASE CONNECTION ERROR");
        console.error("========================================");
        console.error(`[DB] Mode : ${dbMode}`);
        console.error(`[DB] Host : ${dbConfig.host}`);
        console.error(`[DB] Port : ${dbConfig.port}`);
        console.error(`[DB] DB   : ${dbConfig.database}`);
        console.error(`[DB] Error: ${error.message}`);
        console.error("========================================");
        console.error("");

    } finally {

        if (connection) {
            connection.release();
        }

    }

})();


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = db;