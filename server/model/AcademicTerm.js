const db = require('../config/db');

const getAcademicTerm = async () => {

    const [rows] = await db.query(`
    SELECT * from academic_terms

`);
    return rows[0];
};

const getActiveAcademicTerm = async () => {
    const [rows] = await db.query(`
        select * from academic_terms
        where status = 'active';
        `);

        return rows[0];
}

module.exports = {
    getAcademicTerm,
    getActiveAcademicTerm
};