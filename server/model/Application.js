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

    

    getPendingApplications: async () => {

    console.log("🔥 GET PENDING APPLICATIONS CALLED");

    const [dbInfo] = await db.execute(`
        SELECT
            DATABASE() AS db_name,
            @@hostname AS hostname,
            @@port AS port
    `);

    console.log("🔥 DB INFO:", dbInfo);

    const [count] = await db.execute(`
        SELECT COUNT(*) AS total
        FROM student_applications
    `);

    console.log("🔥 TOTAL APPLICATIONS:", count);

    const [info] = await db.execute(`
    SELECT
        DATABASE() AS db,
        @@hostname AS host,
        @@port AS port,
        @@server_uuid AS uuid,
        @@datadir AS datadir
`);

console.log(info);

    const [rows] = await db.execute(`
        SELECT
            sa.*,
            p.program_code,
            p.program_name
        FROM student_applications sa
        JOIN programs p
            ON sa.course_id = p.id
        WHERE sa.status = 'pending'
        ORDER BY sa.created_at DESC
    `);

    console.log("🔥 PENDING:", rows);

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

    }

};

module.exports = StudentApplication;