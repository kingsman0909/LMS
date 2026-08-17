const db = require('../config/db');

const getCourses = async () => {

    const [rows] = await db.query(`
    SELECT * from courses

`);
    return rows;
};

const findById = async (id) => {

    const [rows] = await db.query(

        `SELECT *
         FROM courses
         WHERE id = ?`,

        [id]

    );

    return rows[0];

};

module.exports = {
    getCourses,
    findById
};