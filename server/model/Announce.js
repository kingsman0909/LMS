const db = require('../config/db');

const getAnnouncementsByRole = async (role) => {

    const [rows] = await db.query(`
    SELECT 
        a.*,
        p.firstname AS firstname,
        p.lastname AS lastname
    FROM announcements a
    LEFT JOIN profesor p
        ON a.created_by = p.id
    WHERE a.target_role = ?
       OR a.target_role = 'all'
    ORDER BY a.created_at DESC
`, [role]);
    return rows;
    console.log(rows);
};

const createAnnouncement = async (announce) => {
    const sql = `
    insert into announcements(title, content, created_by, created_role, target_role)
    values(?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(sql, [
        announce.title, announce.content,
        announce.created_by, announce.created_role,
        announce.target_role
    ]);

    return result;
};

module.exports = {
    getAnnouncementsByRole,
    createAnnouncement
};