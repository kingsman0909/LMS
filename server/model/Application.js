
const db = require('../config/db');

const StudentApplication = {

    createApplication: async (data) => {

        const {
            email,
            username,
            password,
            firstname,
            middlename,
            lastname,
            program_id,
            year_level,
            section,
            phone,
            gender,
            birthdate,
            address
        } = data;

        const [result] = await db.execute(

            `INSERT INTO student_applications (
                email,
                username,
                password,
                firstname,
                middlename,
                lastname,
                course_id,
                year_level,
                phone,
                gender,
                birthdate,
                address
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [
                email,
                username,
                password,
                firstname,
                middlename,
                lastname,
                program_id,
                year_level,
                phone,
                gender,
                birthdate,
                address
            ]

        );

        return result;

    },


    findByUsername: async (username) => {

        const [rows] = await db.execute(

            `SELECT *
             FROM student_applications
             WHERE username = ?`,

            [username]

        );

        return rows[0];

    },


    findByEmail: async (email) => {

        const [rows] = await db.execute(

            `SELECT *
             FROM student_applications
             WHERE email = ?`,

            [email]

        );

        return rows[0];

    },


    findById: async (id) => {

        const [rows] = await db.execute(

            `SELECT *
             FROM student_applications
             WHERE id = ?`,

            [id]

        );

        return rows[0];

    },

    countPendingApplications: async () => {

        const [rows] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM student_applications
            WHERE status = 'pending'
        `);

        return rows[0].total;
    },

    // ==================================================
    // GET PENDING APPLICATIONS IN BATCH
    // ==================================================

    getPendingApplicationsBatch: async (
        limit,
        lastId = 0
    ) => {

        const [rows] = await db.execute(
            `
            SELECT
                sa.*,
                p.program_code,
                p.program_name
            FROM student_applications sa

            JOIN programs p
                ON sa.course_id = p.id

            WHERE sa.status = 'pending'
            AND sa.id > ?

            ORDER BY sa.id ASC

            LIMIT ?
            `,
            [
                lastId,
                limit
            ]
        );

        return rows;
    },

    updateStatus: async (
        id,
        status,
        reviewedBy
    ) => {

        const [result] = await db.execute(

            `UPDATE student_applications
             SET
                status = ?,
                reviewed_by = ?,
                reviewed_at = CURRENT_TIMESTAMP
             WHERE id = ?`,

            [
                status,
                reviewedBy,
                id
            ]

        );

        return result;

    },


    // ==================================================
    // GET PENDING APPLICATIONS IN BATCH
    // ==================================================

    getPendingApplicationsBatch: async (
        limit,
        lastId = 0
    ) => {

        const [rows] = await db.execute(

            `SELECT *
             FROM student_applications
             WHERE status = 'pending'
             AND id > ?
             ORDER BY id ASC
             LIMIT ?`,

            [
                lastId,
                limit
            ]

        );

        return rows;

    },


    // ==================================================
    // BULK APPROVE APPLICATIONS
    // ==================================================

    approveBatch: async (
        ids,
        reviewedBy
    ) => {

        if (!ids || ids.length === 0) {

            return {
                affectedRows: 0
            };

        }


        const placeholders =
            ids.map(() => '?').join(',');


        const [result] = await db.execute(

            `UPDATE student_applications
             SET
                status = 'approved',
                reviewed_by = ?,
                reviewed_at = CURRENT_TIMESTAMP
             WHERE status = 'pending'
             AND id IN (${placeholders})`,

            [
                reviewedBy,
                ...ids
            ]

        );


        return result;

    }

};


module.exports = StudentApplication;
