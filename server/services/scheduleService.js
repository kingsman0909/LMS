const db = require("../config/db");

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const DAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
];

const DAY_INDEX = new Map(
    DAY_ORDER.map((day, index) => [day, index])
);

/*
|--------------------------------------------------------------------------
| SEARCH LIMITS
|--------------------------------------------------------------------------
*/

const DEFAULT_SEARCH_LIMITS = {
    MAX_BACKTRACK_NODES_PER_SECTION: 20000,
    MAX_TIME_MS_PER_SECTION: 3000,
    GREEDY_MAX_CANDIDATES_PER_REQUIREMENT: 100,
    BACKTRACK_MAX_CANDIDATES_PER_REQUIREMENT: 150,
    MAX_MRV_CANDIDATE_SCAN: 150,
    MAX_MRV_RAW_SCAN: 600,
    MAX_BOTTLENECK_SCAN: 3000
};

const FAST_SIMULATION_LIMITS = {
    MAX_BACKTRACK_NODES_PER_SECTION: 2500,
    MAX_TIME_MS_PER_SECTION: 700,
    GREEDY_MAX_CANDIDATES_PER_REQUIREMENT: 50,
    BACKTRACK_MAX_CANDIDATES_PER_REQUIREMENT: 80,
    MAX_MRV_CANDIDATE_SCAN: 80,
    MAX_MRV_RAW_SCAN: 220,
    MAX_BOTTLENECK_SCAN: 1000
};

const getSearchLimits = simulation => {
    return simulation
        ? FAST_SIMULATION_LIMITS
        : DEFAULT_SEARCH_LIMITS;
};

/*
|--------------------------------------------------------------------------
| LOGGING
|--------------------------------------------------------------------------
*/

const logSchedule = (message, meta = {}) => {
    const detail =
        Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";

    console.log(`[schedule] ${message}${detail}`);
};

const warnSchedule = (message, meta = {}) => {
    const detail =
        Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";

    console.warn(`[schedule] ${message}${detail}`);
};

/*
|--------------------------------------------------------------------------
| PROFESSOR
|--------------------------------------------------------------------------
*/

const DEFAULT_MAX_PROFESSOR_HOURS = 18;

/*
|--------------------------------------------------------------------------
| DAY DISTRIBUTION
|--------------------------------------------------------------------------
*/

const NEW_DAY_BONUS = 18000;
const SECTION_DAY_LOAD_WEIGHT = 1200;
const SECTION_LONG_DAY_WEIGHT = 3500;

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const num = value => Number(value);

const normalizeTime = value => {
    if (value == null) {
        return "";
    }

    return String(value)
        .split(".")[0]
        .trim();
};

const uniqueNumbers = values => [
    ...new Set(
        values
            .map(num)
            .filter(Number.isFinite)
    )
];

/*
|--------------------------------------------------------------------------
| OCCUPANCY
|--------------------------------------------------------------------------
*/

const createOccupancy = () => ({
    sectionSlots: new Map(),
    professorSlots: new Map(),
    roomSlots: new Map(),

    sectionDayHours: new Map(),

    professorWeeklyHours: new Map(),
    professorMaxWeeklyHours: new Map(),

    _version: 0
});

const getOccupiedSet = (map, key) => {
    return map.get(num(key)) || null;
};

const hasSlotConflict = (map, key, slotIds) => {
    const occupied = getOccupiedSet(map, key);

    if (!occupied) {
        return false;
    }

    for (const slotId of slotIds) {
        if (occupied.has(num(slotId))) {
            return true;
        }
    }

    return false;
};

const reserveSlotIds = (map, key, slotIds) => {
    key = num(key);

    let occupied = map.get(key);

    if (!occupied) {
        occupied = new Set();
        map.set(key, occupied);
    }

    for (const slotId of slotIds) {
        occupied.add(num(slotId));
    }
};

const releaseSlotIds = (map, key, slotIds) => {
    key = num(key);

    const occupied = map.get(key);

    if (!occupied) {
        return;
    }

    for (const slotId of slotIds) {
        occupied.delete(num(slotId));
    }

    if (occupied.size === 0) {
        map.delete(key);
    }
};

/*
|--------------------------------------------------------------------------
| PROFESSOR HOURS
|--------------------------------------------------------------------------
*/

const getProfessorWeeklyHours = (
    occupancy,
    professorId
) => {
    return (
        occupancy.professorWeeklyHours.get(
            num(professorId)
        ) || 0
    );
};

const getProfessorMaxWeeklyHours = (
    occupancy,
    professorId
) => {
    return (
        occupancy.professorMaxWeeklyHours.get(
            num(professorId)
        ) ??
        DEFAULT_MAX_PROFESSOR_HOURS
    );
};

const getProfessorRemainingHours = (
    occupancy,
    professorId
) => {
    const used = getProfessorWeeklyHours(
        occupancy,
        professorId
    );

    const max = getProfessorMaxWeeklyHours(
        occupancy,
        professorId
    );

    return Math.max(0, max - used);
};

const canProfessorTakeHours = (
    occupancy,
    professorId,
    hours
) => {
    const max = getProfessorMaxWeeklyHours(
        occupancy,
        professorId
    );

    const current = getProfessorWeeklyHours(
        occupancy,
        professorId
    );

    return current + num(hours) <= num(max);
};

const addProfessorWeeklyHours = (
    occupancy,
    professorId,
    hours
) => {
    professorId = num(professorId);

    const current = getProfessorWeeklyHours(
        occupancy,
        professorId
    );

    occupancy.professorWeeklyHours.set(
        professorId,
        current + num(hours)
    );
};

const removeProfessorWeeklyHours = (
    occupancy,
    professorId,
    hours
) => {
    professorId = num(professorId);

    const current = getProfessorWeeklyHours(
        occupancy,
        professorId
    );

    const next = current - num(hours);

    if (next <= 0) {
        occupancy.professorWeeklyHours.delete(
            professorId
        );
    } else {
        occupancy.professorWeeklyHours.set(
            professorId,
            next
        );
    }
};

/*
|--------------------------------------------------------------------------
| PROFESSOR PRIORITY
|--------------------------------------------------------------------------
*/

const getProfessorWorkloadPriority = (
    occupancy,
    professorId,
    assignmentHours
) => {
    const current = getProfessorWeeklyHours(
        occupancy,
        professorId
    );

    const max = getProfessorMaxWeeklyHours(
        occupancy,
        professorId
    );

    const hours = num(assignmentHours);

    const remainingBefore = Math.max(
        0,
        max - current
    );

    const remainingAfter =
        remainingBefore - hours;

    if (remainingAfter < 0) {
        return {
            eligible: false,
            current,
            max,
            remainingBefore,
            remainingAfter,
            exactFill: false
        };
    }

    return {
        eligible: true,
        current,
        max,
        remainingBefore,
        remainingAfter,
        exactFill:
            remainingAfter === 0
    };
};

const getProfessorPriorityRank = ({
    occupancy,
    professorId,
    assignmentHours,
    requirement = null,
    professorMap = null
}) => {
    const current = getProfessorWeeklyHours(
        occupancy,
        professorId
    );

    const max = getProfessorMaxWeeklyHours(
        occupancy,
        professorId
    );

    const hours = num(assignmentHours);

    const remainingBefore = Math.max(
        0,
        max - current
    );

    const remainingAfter =
        remainingBefore - hours;

    if (remainingAfter < 0) {
        return {
            eligible: false,
            priority: Number.MAX_SAFE_INTEGER,
            current,
            max,
            remainingBefore,
            remainingAfter,
            exactFill: false
        };
    }

    let qualifiedCount = 1;

    if (requirement && professorMap) {
        qualifiedCount = (
            professorMap.get(
                num(requirement.subject_id)
            ) || []
        ).length;
    }

    const scarcityPenalty =
        qualifiedCount <= 1
            ? 900000
            : qualifiedCount === 2
                ? 220000
                : qualifiedCount === 3
                    ? 55000
                    : 0;

    const exactFillBonus =
        remainingAfter === 0
            ? -8000000
            : 0;

    const workloadSlackPenalty =
        Math.max(0, remainingAfter) * 50000;

    const currentLoadPreference =
        (
            (max - current) /
            Math.max(1, max)
        ) * 20000;

    const priority =
        scarcityPenalty +
        workloadSlackPenalty +
        currentLoadPreference +
        exactFillBonus;

    return {
        eligible: true,
        priority,
        current,
        max,
        remainingBefore,
        remainingAfter,
        exactFill:
            remainingAfter === 0
    };
};

const sortProfessorsByWorkload = (
    professors,
    occupancy,
    assignmentHours,
    requirement = null,
    professorMap = null
) => {
    return [...professors].sort((a, b) => {
        const pa = getProfessorPriorityRank({
            occupancy,
            professorId: a.id,
            assignmentHours,
            requirement,
            professorMap
        });

        const pb = getProfessorPriorityRank({
            occupancy,
            professorId: b.id,
            assignmentHours,
            requirement,
            professorMap
        });

        if (pa.eligible !== pb.eligible) {
            return pa.eligible ? -1 : 1;
        }

        if (!pa.eligible) {
            return num(a.id) - num(b.id);
        }

        if (pa.priority !== pb.priority) {
            return pa.priority - pb.priority;
        }

        if (pa.exactFill !== pb.exactFill) {
            return pa.exactFill ? -1 : 1;
        }

        if (pa.remainingAfter !== pb.remainingAfter) {
            return pa.remainingAfter - pb.remainingAfter;
        }

        if (pa.current !== pb.current) {
            return pb.current - pa.current;
        }

        return num(a.id) - num(b.id);
    });
};

/*
|--------------------------------------------------------------------------
| SECTION DAY HOURS
|--------------------------------------------------------------------------
*/

const getSectionDayHours = (
    occupancy,
    sectionId,
    day
) => {
    const sectionMap =
        occupancy.sectionDayHours.get(
            num(sectionId)
        );

    if (!sectionMap) {
        return 0;
    }

    return sectionMap.get(day) || 0;
};

const addSectionDayHours = (
    occupancy,
    sectionId,
    day,
    hours
) => {
    sectionId = num(sectionId);

    let sectionMap =
        occupancy.sectionDayHours.get(
            sectionId
        );

    if (!sectionMap) {
        sectionMap = new Map();

        occupancy.sectionDayHours.set(
            sectionId,
            sectionMap
        );
    }

    sectionMap.set(
        day,
        (sectionMap.get(day) || 0) +
        num(hours)
    );
};

const removeSectionDayHours = (
    occupancy,
    sectionId,
    day,
    hours
) => {
    sectionId = num(sectionId);

    const sectionMap =
        occupancy.sectionDayHours.get(
            sectionId
        );

    if (!sectionMap) {
        return;
    }

    const current =
        sectionMap.get(day) || 0;

    const next =
        current - num(hours);

    if (next <= 0) {
        sectionMap.delete(day);
    } else {
        sectionMap.set(day, next);
    }

    if (sectionMap.size === 0) {
        occupancy.sectionDayHours.delete(
            sectionId
        );
    }
};

const getSectionUsedDayCount = (
    occupancy,
    sectionId
) => {
    const sectionMap =
        occupancy.sectionDayHours.get(
            num(sectionId)
        );

    return sectionMap
        ? sectionMap.size
        : 0;
};

/*
|--------------------------------------------------------------------------
| RESERVATION
|--------------------------------------------------------------------------
*/

const reserveAssignment = (
    assignment,
    occupancy
) => {
    const hours =
        assignment.slotIds.length;

    reserveSlotIds(
        occupancy.sectionSlots,
        assignment.sectionId,
        assignment.slotIds
    );

    reserveSlotIds(
        occupancy.professorSlots,
        assignment.professorId,
        assignment.slotIds
    );

    reserveSlotIds(
        occupancy.roomSlots,
        assignment.roomId,
        assignment.slotIds
    );

    addProfessorWeeklyHours(
        occupancy,
        assignment.professorId,
        hours
    );

    addSectionDayHours(
        occupancy,
        assignment.sectionId,
        assignment.day,
        hours
    );
};

const releaseAssignment = (
    assignment,
    occupancy
) => {
    const hours =
        assignment.slotIds.length;

    releaseSlotIds(
        occupancy.sectionSlots,
        assignment.sectionId,
        assignment.slotIds
    );

    releaseSlotIds(
        occupancy.professorSlots,
        assignment.professorId,
        assignment.slotIds
    );

    releaseSlotIds(
        occupancy.roomSlots,
        assignment.roomId,
        assignment.slotIds
    );

    removeProfessorWeeklyHours(
        occupancy,
        assignment.professorId,
        hours
    );

    removeSectionDayHours(
        occupancy,
        assignment.sectionId,
        assignment.day,
        hours
    );
};

const releaseAssignments = (
    assignments,
    occupancy
) => {
    for (
        let i = assignments.length - 1;
        i >= 0;
        i--
    ) {
        releaseAssignment(
            assignments[i],
            occupancy
        );
    }
};

/*
|--------------------------------------------------------------------------
| CONFLICT
|--------------------------------------------------------------------------
*/

const candidateConflictMask = (
    candidate,
    occupancy
) => {
    let mask = 0;

    if (
        hasSlotConflict(
            occupancy.sectionSlots,
            candidate.sectionId,
            candidate.slotIds
        )
    ) {
        mask |= 1;
    }

    if (
        hasSlotConflict(
            occupancy.professorSlots,
            candidate.professorId,
            candidate.slotIds
        )
    ) {
        mask |= 2;
    }

    if (
        hasSlotConflict(
            occupancy.roomSlots,
            candidate.roomId,
            candidate.slotIds
        )
    ) {
        mask |= 4;
    }

    if (
        !canProfessorTakeHours(
            occupancy,
            candidate.professorId,
            candidate.slotIds.length
        )
    ) {
        mask |= 8;
    }

    return mask;
};

const assignmentHasConflict = (
    assignment,
    occupancy
) => {
    return (
        candidateConflictMask(
            assignment,
            occupancy
        ) !== 0
    );
};

/*
|--------------------------------------------------------------------------
| DATABASE - SECTIONS
|--------------------------------------------------------------------------
*/

const getSections = async (
    programId,
    academicTermId
) => {
    const [rows] = await db.query(`
        SELECT
            id,
            program_id,
            year_level,
            section_name,
            academic_term_id,
            max_students
        FROM sections
        WHERE program_id = ?
          AND academic_term_id = ?
        ORDER BY
            year_level ASC,
            section_name ASC
    `, [
        programId,
        academicTermId
    ]);

    return rows.map(row => ({
        ...row,

        id: num(row.id),
        program_id: num(row.program_id),
        year_level: num(row.year_level),
        academic_term_id:
            num(row.academic_term_id),
        max_students:
            num(row.max_students)
    }));
};

/*
|--------------------------------------------------------------------------
| STUDENT COUNTS
|--------------------------------------------------------------------------
*/

const getSectionStudentCounts = async (
    sectionIds,
    academicTermId
) => {
    const map = new Map();

    if (sectionIds.length === 0) {
        return map;
    }

    const placeholders =
        sectionIds.map(() => "?").join(",");

    const [rows] = await db.query(`
        SELECT
            section_id,
            COUNT(*) AS student_count
        FROM student_sections
        WHERE academic_term_id = ?
          AND section_id IN (${placeholders})
        GROUP BY section_id
    `, [
        academicTermId,
        ...sectionIds
    ]);

    for (const row of rows) {
        map.set(
            num(row.section_id),
            num(row.student_count)
        );
    }

    return map;
};

/*
|--------------------------------------------------------------------------
| SUBJECTS
|--------------------------------------------------------------------------
*/

const getAllSectionSubjects = async (
    sections,
    academicTermId
) => {
    const map = new Map();

    if (sections.length === 0) {
        return map;
    }

    const sectionIds =
        sections.map(section =>
            num(section.id)
        );

    const placeholders =
        sectionIds.map(() => "?").join(",");

    const [rows] = await db.query(`
        SELECT
            s.id AS section_id,
            s.section_name,
            s.program_id,
            s.year_level,

            cs.subject_id,

            sub.subject_code,
            sub.subject_name,
            sub.units,
            sub.lecture_units,
            sub.lab_units,

            at.semester

        FROM sections s

        JOIN academic_terms at
            ON at.id =
                s.academic_term_id

        JOIN curriculum_subjects cs
            ON cs.program_id =
                s.program_id

           AND cs.year_level =
                CASE
                    WHEN s.year_level = 1
                        THEN '1st Year'
                    WHEN s.year_level = 2
                        THEN '2nd Year'
                    WHEN s.year_level = 3
                        THEN '3rd Year'
                    WHEN s.year_level = 4
                        THEN '4th Year'
                END

           AND cs.semester =
                at.semester

        JOIN subjects sub
            ON sub.id =
                cs.subject_id

        WHERE s.id IN (${placeholders})
          AND s.academic_term_id = ?

        ORDER BY
            s.id,
            sub.subject_code ASC
    `, [
        ...sectionIds,
        academicTermId
    ]);

    for (const row of rows) {
        const sectionId =
            num(row.section_id);

        if (!map.has(sectionId)) {
            map.set(
                sectionId,
                []
            );
        }

        map.get(sectionId).push(row);
    }

    return map;
};

const getSectionSubjects = async (
    sectionId,
    academicTermId
) => {
    const [rows] = await db.query(`
        SELECT
            s.id AS section_id,
            s.section_name,
            s.program_id,
            s.year_level,

            cs.subject_id,

            sub.subject_code,
            sub.subject_name,
            sub.units,
            sub.lecture_units,
            sub.lab_units,

            at.semester

        FROM sections s

        JOIN academic_terms at
            ON at.id =
                s.academic_term_id

        JOIN curriculum_subjects cs
            ON cs.program_id =
                s.program_id

           AND cs.year_level =
                CASE
                    WHEN s.year_level = 1
                        THEN '1st Year'
                    WHEN s.year_level = 2
                        THEN '2nd Year'
                    WHEN s.year_level = 3
                        THEN '3rd Year'
                    WHEN s.year_level = 4
                        THEN '4th Year'
                END

           AND cs.semester =
                at.semester

        JOIN subjects sub
            ON sub.id =
                cs.subject_id

        WHERE s.id = ?
          AND s.academic_term_id = ?

        ORDER BY
            sub.subject_code ASC
    `, [
        sectionId,
        academicTermId
    ]);

    return rows;
};

/*
|--------------------------------------------------------------------------
| REQUIREMENTS
|--------------------------------------------------------------------------
*/

const buildRequirements = subjects => {
    const requirements = [];

    let requirementId = 0;

    for (const subject of subjects) {
        const lectureUnits =
            num(subject.lecture_units || 0);

        const labUnits =
            num(subject.lab_units || 0);

        if (lectureUnits > 0) {
            requirements.push({
                id: requirementId++,

                subject_id:
                    num(subject.subject_id),

                subject_code:
                    subject.subject_code,

                subject_name:
                    subject.subject_name,

                type: "lecture",

                hours: lectureUnits
            });
        }

        if (labUnits > 0) {
            requirements.push({
                id: requirementId++,

                subject_id:
                    num(subject.subject_id),

                subject_code:
                    subject.subject_code,

                subject_name:
                    subject.subject_name,

                type: "laboratory",

                hours: labUnits * 3
            });
        }
    }

    return requirements;
};

/*
|--------------------------------------------------------------------------
| TIME SLOTS
|--------------------------------------------------------------------------
*/

const getTimeSlots = async () => {
    const [rows] = await db.query(`
        SELECT
            id,
            day,
            start_time,
            end_time
        FROM time_slots
        WHERE status = 'available'
        ORDER BY
            FIELD(
                day,
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday',
                'Sunday'
            ),
            start_time
    `);

    return rows.map(row => ({
        id: num(row.id),

        day: row.day,

        start_time:
            normalizeTime(row.start_time),

        end_time:
            normalizeTime(row.end_time)
    }));
};

const groupSlotsByDay = slots => {
    const map = new Map();

    for (const day of DAY_ORDER) {
        map.set(day, []);
    }

    for (const slot of slots) {
        if (!map.has(slot.day)) {
            map.set(slot.day, []);
        }

        map.get(slot.day).push(slot);
    }

    return map;
};

/*
|--------------------------------------------------------------------------
| WINDOWS
|--------------------------------------------------------------------------
*/

const buildWindows = (
    slotsByDay,
    hours
) => {
    hours = num(hours);

    if (hours <= 0) {
        return [];
    }

    const windows = [];

    for (const day of DAY_ORDER) {
        const daySlots =
            slotsByDay.get(day) || [];

        if (daySlots.length < hours) {
            continue;
        }

        for (
            let i = 0;
            i <= daySlots.length - hours;
            i++
        ) {
            const candidate =
                daySlots.slice(
                    i,
                    i + hours
                );

            let consecutive = true;

            for (
                let j = 1;
                j < candidate.length;
                j++
            ) {
                if (
                    normalizeTime(
                        candidate[j - 1].end_time
                    ) !==
                    normalizeTime(
                        candidate[j].start_time
                    )
                ) {
                    consecutive = false;
                    break;
                }
            }

            if (!consecutive) {
                continue;
            }

            windows.push({
                day,

                dayIndex:
                    DAY_INDEX.get(day) ?? 99,

                slots: candidate,

                slotIds:
                    candidate.map(slot =>
                        num(slot.id)
                    ),

                start_time:
                    candidate[0].start_time,

                end_time:
                    candidate[
                        candidate.length - 1
                    ].end_time
            });
        }
    }

    return windows;
};

/*
|--------------------------------------------------------------------------
| PROFESSORS
|--------------------------------------------------------------------------
*/

const getProfessorMap = async (
    subjectIds
) => {
    const map = new Map();

    if (subjectIds.length === 0) {
        return map;
    }

    const placeholders =
        subjectIds.map(() => "?").join(",");

    const [rows] = await db.query(`
        SELECT
            ps.subject_id,

            p.id,
            p.employee_id,
            p.firstname,
            p.lastname,
            p.max_weekly_hours

        FROM professor_subjects ps

        JOIN profesor p
            ON p.id =
                ps.professor_id

        WHERE ps.subject_id
            IN (${placeholders})

        ORDER BY
            ps.subject_id,
            p.id
    `, subjectIds);

    for (const row of rows) {
        const subjectId =
            num(row.subject_id);

        if (!map.has(subjectId)) {
            map.set(
                subjectId,
                []
            );
        }

        map.get(subjectId).push({
            id: num(row.id),

            employee_id:
                row.employee_id,

            firstname:
                row.firstname,

            lastname:
                row.lastname,

            max_hours_per_week:
                row.max_weekly_hours == null
                    ? DEFAULT_MAX_PROFESSOR_HOURS
                    : num(
                        row.max_weekly_hours
                    )
        });
    }

    return map;
};

/*
|--------------------------------------------------------------------------
| ROOMS
|--------------------------------------------------------------------------
*/

const getRooms = async () => {
    const [rows] = await db.query(`
        SELECT
            id,
            room_name,
            room_type,
            capacity
        FROM rooms
        WHERE status = 'available'
        ORDER BY
            capacity ASC,
            id ASC
    `);

    return rows.map(room => ({
        id: num(room.id),

        room_name:
            room.room_name,

        room_type:
            room.room_type,

        capacity:
            num(room.capacity)
    }));
};

/*
|--------------------------------------------------------------------------
| EXISTING SCHEDULES
|--------------------------------------------------------------------------
*/

const loadExistingSchedules = async (
    academicTermId
) => {
    const [rows] = await db.query(`
        SELECT
            cs.id,
            cs.section_id,
            cs.subject_id,
            cs.professor_id,
            cs.room_id,
            cs.time_slot_id,
            cs.academic_term_id,

            ts.day,

            r.room_type

        FROM class_schedules cs

        JOIN rooms r
            ON r.id =
                cs.room_id

        JOIN time_slots ts
            ON ts.id =
                cs.time_slot_id

        WHERE cs.academic_term_id = ?
    `, [academicTermId]);

    return rows.map(row => ({
        ...row,

        id: num(row.id),
        section_id: num(row.section_id),
        subject_id: num(row.subject_id),
        professor_id: num(row.professor_id),
        room_id: num(row.room_id),
        time_slot_id: num(row.time_slot_id)
    }));
};

/*
|--------------------------------------------------------------------------
| PROFESSOR MAX HOURS
|--------------------------------------------------------------------------
*/

const loadProfessorMaxHours = async (
    occupancy,
    professorIds
) => {
    if (professorIds.length === 0) {
        return;
    }

    const ids =
        uniqueNumbers(professorIds);

    if (ids.length === 0) {
        return;
    }

    const placeholders =
        ids.map(() => "?").join(",");

    const [rows] = await db.query(`
        SELECT
            id,
            max_weekly_hours
        FROM profesor
        WHERE id IN (${placeholders})
    `, ids);

    for (const row of rows) {
        occupancy
            .professorMaxWeeklyHours
            .set(
                num(row.id),
                row.max_weekly_hours == null
                    ? DEFAULT_MAX_PROFESSOR_HOURS
                    : num(
                        row.max_weekly_hours
                    )
            );
    }
};

/*
|--------------------------------------------------------------------------
| EXISTING OCCUPANCY
|--------------------------------------------------------------------------
*/

const reserveExistingSchedules = (
    rows,
    occupancy
) => {
    for (const row of rows) {
        const slotId =
            num(row.time_slot_id);

        reserveSlotIds(
            occupancy.sectionSlots,
            row.section_id,
            [slotId]
        );

        reserveSlotIds(
            occupancy.professorSlots,
            row.professor_id,
            [slotId]
        );

        reserveSlotIds(
            occupancy.roomSlots,
            row.room_id,
            [slotId]
        );

        addProfessorWeeklyHours(
            occupancy,
            row.professor_id,
            1
        );

        addSectionDayHours(
            occupancy,
            row.section_id,
            row.day,
            1
        );
    }
};

/*
|--------------------------------------------------------------------------
| EXISTING REQUIREMENT COUNTS
|--------------------------------------------------------------------------
*/

const getExistingRequirementCounts = rows => {
    const map = new Map();

    for (const row of rows) {
        const sectionId =
            num(row.section_id);

        const subjectId =
            num(row.subject_id);

        if (!map.has(sectionId)) {
            map.set(
                sectionId,
                new Map()
            );
        }

        const sectionMap =
            map.get(sectionId);

        const type =
            row.room_type === "laboratory"
                ? "laboratory"
                : "lecture";

        const key =
            `${subjectId}:${type}`;

        sectionMap.set(
            key,
            (sectionMap.get(key) || 0) + 1
        );
    }

    return map;
};

const getMissingRequirements = (
    section,
    existingRequirementCounts
) => {
    const sectionCounts =
        existingRequirementCounts.get(
            num(section.id)
        ) || new Map();

    const missing = [];

    for (
        const requirement
        of section.requirements
    ) {
        const key =
            `${requirement.subject_id}:${requirement.type}`;

        const existingCount =
            sectionCounts.get(key) || 0;

        if (
            existingCount >=
            requirement.hours
        ) {
            continue;
        }

        missing.push({
            ...requirement,

            remainingHours:
                requirement.hours -
                existingCount
        });
    }

    return missing;
};

const getSectionStatus = (
    section,
    existingRequirementCounts
) => {
    const sectionCounts =
        existingRequirementCounts.get(
            num(section.id)
        ) || new Map();

    let completed = 0;

    for (
        const requirement
        of section.requirements
    ) {
        const key =
            `${requirement.subject_id}:${requirement.type}`;

        const count =
            sectionCounts.get(key) || 0;

        if (
            count >=
            requirement.hours
        ) {
            completed++;
        }
    }

    return {
        complete:
            completed ===
            section.requirements.length,

        completedRequirements:
            completed,

        totalRequirements:
            section.requirements.length
    };
};

/*
|--------------------------------------------------------------------------
| ROOMS
|--------------------------------------------------------------------------
*/

const getValidRooms = (
    requirement,
    section,
    rooms
) => {
    const requiredType =
        requirement.type === "laboratory"
            ? "laboratory"
            : "lecture";

    const studentCount =
        num(section.student_count);

    return rooms.filter(room =>
        room.room_type === requiredType &&
        room.capacity >= studentCount
    );
};

/*
|--------------------------------------------------------------------------
| CANDIDATE SCORING
|--------------------------------------------------------------------------
*/

const getResourceLoad = (
    map,
    id
) => {
    return (
        map.get(num(id))?.size || 0
    );
};

const scoreCandidate = (
    candidate,
    occupancy,
    requirement,
    professorMap
) => {
    const professorLoad =
        getResourceLoad(
            occupancy.professorSlots,
            candidate.professorId
        );

    const professorWeeklyHours =
        getProfessorWeeklyHours(
            occupancy,
            candidate.professorId
        );

    const professorMaxHours =
        getProfessorMaxWeeklyHours(
            occupancy,
            candidate.professorId
        );

    const assignmentHours =
        candidate.slotIds.length;

    const remainingBefore =
        Math.max(
            0,
            professorMaxHours -
            professorWeeklyHours
        );

    const remainingAfter =
        remainingBefore -
        assignmentHours;

    const exactFill =
        remainingAfter === 0;

    const workloadFillScore =
        Math.max(
            0,
            remainingAfter
        ) * 100000;

    const exactFillBonus =
        exactFill
            ? -10000000
            : 0;

    const currentWorkloadPreference =
        Math.max(
            0,
            professorMaxHours -
            professorWeeklyHours
        ) * 100;

    const roomLoad =
        getResourceLoad(
            occupancy.roomSlots,
            candidate.roomId
        );

    const professorCount =
        (
            professorMap.get(
                num(requirement.subject_id)
            ) || []
        ).length;

    const scarcityPenalty =
        professorCount <= 1
            ? 100000
            : professorCount === 2
                ? 30000
                : professorCount === 3
                    ? 10000
                    : 0;

    const roomWaste =
        candidate.room.capacity -
        num(candidate.studentCount);

    const existingDayHours =
        getSectionDayHours(
            occupancy,
            candidate.sectionId,
            candidate.day
        );

    const projectedDayHours =
        existingDayHours +
        assignmentHours;

    const usedDayCount =
        getSectionUsedDayCount(
            occupancy,
            candidate.sectionId
        );

    const newDayPenalty =
        existingDayHours === 0
            ? -NEW_DAY_BONUS
            : 0;

    const dayLoadPenalty =
        Math.pow(
            existingDayHours,
            2
        ) * SECTION_DAY_LOAD_WEIGHT;

    const longDayPenalty =
        projectedDayHours > 6
            ? Math.pow(
                projectedDayHours - 6,
                2
            ) * SECTION_LONG_DAY_WEIGHT
            : 0;

    const spreadBonus =
        existingDayHours === 0
            ? -Math.min(
                5000,
                usedDayCount * 500
            )
            : 0;

    const professorPriority =
        getProfessorPriorityRank({
            occupancy,
            professorId:
                candidate.professorId,
            assignmentHours,
            requirement,
            professorMap
        });

    const professorPriorityScore =
        professorPriority.eligible
            ? professorPriority.priority
            : Number.MAX_SAFE_INTEGER;

    return (
        exactFillBonus +
        workloadFillScore +
        currentWorkloadPreference +
        scarcityPenalty +
        roomLoad * 1000 +
        roomWaste * 5 +
        dayLoadPenalty +
        longDayPenalty +
        newDayPenalty +
        spreadBonus +
        candidate.dayIndex * 2 +
        candidate.roomId +
        professorLoad +
        professorPriorityScore
    );
};

/*
|--------------------------------------------------------------------------
| CANDIDATE
|--------------------------------------------------------------------------
*/

const makeCandidate = (
    section,
    requirement,
    professor,
    room,
    window
) => ({
    sectionId:
        num(section.id),

    requirementId:
        num(requirement.id),

    requirement,

    professor,

    professorId:
        num(professor.id),

    room,

    roomId:
        num(room.id),

    window,

    slotIds:
        window.slotIds,

    day:
        window.day,

    dayIndex:
        window.dayIndex,

    start_time:
        window.start_time,

    end_time:
        window.end_time,

    studentCount:
        num(section.student_count),

    roomWaste:
        room.capacity -
        num(section.student_count)
});

/*
|--------------------------------------------------------------------------
| CANDIDATE POOL
|--------------------------------------------------------------------------
*/

const getCandidatePool = ({
    section,
    requirement,
    windows,
    professors,
    rooms,
    occupancy,
    professorMap,
    limit
}) => {
    const validRooms =
        getValidRooms(
            requirement,
            section,
            rooms
        );

    if (
        validRooms.length === 0 ||
        professors.length === 0 ||
        windows.length === 0
    ) {
        return {
            candidates: [],
            totalValid: 0,
            professorCapacityBlocked: 0
        };
    }

    const candidates = [];

    let totalValid = 0;
    let professorCapacityBlocked = 0;

    const sortedProfessors =
        sortProfessorsByWorkload(
            professors,
            occupancy,
            requirement.remainingHours ||
                requirement.hours,
            requirement,
            professorMap
        );

    const insertBoundedCandidate =
        candidate => {
            if (
                candidates.length <
                limit
            ) {
                candidates.push(candidate);

                let i =
                    candidates.length - 1;

                while (
                    i > 0 &&
                    candidates[i].score <
                    candidates[i - 1].score
                ) {
                    const temp =
                        candidates[i];

                    candidates[i] =
                        candidates[i - 1];

                    candidates[i - 1] =
                        temp;

                    i--;
                }

                return;
            }

            const lastIndex =
                candidates.length - 1;

            if (
                candidate.score >=
                candidates[lastIndex].score
            ) {
                return;
            }

            candidates[lastIndex] =
                candidate;

            let i = lastIndex;

            while (
                i > 0 &&
                candidates[i].score <
                candidates[i - 1].score
            ) {
                const temp =
                    candidates[i];

                candidates[i] =
                    candidates[i - 1];

                candidates[i - 1] =
                    temp;

                i--;
            }
        };

    for (const window of windows) {
        if (
            hasSlotConflict(
                occupancy.sectionSlots,
                section.id,
                window.slotIds
            )
        ) {
            continue;
        }

        for (
            const professor
            of sortedProfessors
        ) {
            if (
                !canProfessorTakeHours(
                    occupancy,
                    professor.id,
                    window.slotIds.length
                )
            ) {
                professorCapacityBlocked++;
                continue;
            }

            if (
                hasSlotConflict(
                    occupancy.professorSlots,
                    professor.id,
                    window.slotIds
                )
            ) {
                continue;
            }

            for (
                const room
                of validRooms
            ) {
                if (
                    hasSlotConflict(
                        occupancy.roomSlots,
                        room.id,
                        window.slotIds
                    )
                ) {
                    continue;
                }

                totalValid++;

                const candidate =
                    makeCandidate(
                        section,
                        requirement,
                        professor,
                        room,
                        window
                    );

                candidate.score =
                    scoreCandidate(
                        candidate,
                        occupancy,
                        requirement,
                        professorMap
                    );

                const workload =
                    getProfessorWorkloadPriority(
                        occupancy,
                        professor.id,
                        window.slotIds.length
                    );

                candidate.professorWorkload = {
                    before:
                        workload.current,

                    max:
                        workload.max,

                    remainingBefore:
                        workload.remainingBefore,

                    remainingAfter:
                        workload.remainingAfter,

                    exactFill:
                        workload.exactFill
                };

                candidate.professorPriority =
                    getProfessorPriorityRank({
                        occupancy,
                        professorId:
                            professor.id,
                        assignmentHours:
                            window.slotIds.length,
                        requirement,
                        professorMap
                    });

                insertBoundedCandidate(
                    candidate
                );
            }
        }
    }

    return {
        candidates,
        totalValid,
        professorCapacityBlocked
    };
};

/*
|--------------------------------------------------------------------------
| WINDOWS
|--------------------------------------------------------------------------
*/

const getRequirementWindows = (
    requirement,
    windowsByHours
) => {
    const hours =
        num(
            requirement.remainingHours ||
            requirement.hours
        );

    return (
        windowsByHours.get(hours) ||
        []
    );
};

/*
|--------------------------------------------------------------------------
| FLEXIBILITY
|--------------------------------------------------------------------------
*/

const createFlexibilityCache = () =>
    new Map();

const makeFlexibilityKey = (
    section,
    requirement,
    occupancy
) => {
    return (
        `${section.id}:` +
        `${requirement.id}:` +
        `${occupancy._version || 0}`
    );
};

const estimateRequirementFlexibility = ({
    section,
    requirement,
    windowsByHours,
    professorMap,
    rooms,
    occupancy,
    flexibilityCache,
    searchLimits
}) => {
    const cacheKey =
        makeFlexibilityKey(
            section,
            requirement,
            occupancy
        );

    if (
        flexibilityCache &&
        flexibilityCache.has(cacheKey)
    ) {
        return flexibilityCache.get(
            cacheKey
        );
    }

    const windows =
        getRequirementWindows(
            requirement,
            windowsByHours
        );

    const professors =
        professorMap.get(
            num(requirement.subject_id)
        ) || [];

    if (
        windows.length === 0 ||
        professors.length === 0
    ) {
        if (flexibilityCache) {
            flexibilityCache.set(
                cacheKey,
                0
            );
        }

        return 0;
    }

    const validRooms =
        getValidRooms(
            requirement,
            section,
            rooms
        );

    if (validRooms.length === 0) {
        if (flexibilityCache) {
            flexibilityCache.set(
                cacheKey,
                0
            );
        }

        return 0;
    }

    let valid = 0;
    let scanned = 0;

    const maxCandidateScan =
        searchLimits
            ? searchLimits.MAX_MRV_CANDIDATE_SCAN
            : 150;

    const maxRawScan =
        searchLimits
            ? searchLimits.MAX_MRV_RAW_SCAN
            : 600;

    const sortedProfessors =
        sortProfessorsByWorkload(
            professors,
            occupancy,
            requirement.remainingHours ||
                requirement.hours,
            requirement,
            professorMap
        );

    for (const window of windows) {
        if (
            hasSlotConflict(
                occupancy.sectionSlots,
                section.id,
                window.slotIds
            )
        ) {
            continue;
        }

        for (
            const professor
            of sortedProfessors
        ) {
            if (
                !canProfessorTakeHours(
                    occupancy,
                    professor.id,
                    window.slotIds.length
                )
            ) {
                continue;
            }

            if (
                hasSlotConflict(
                    occupancy.professorSlots,
                    professor.id,
                    window.slotIds
                )
            ) {
                continue;
            }

            for (
                const room
                of validRooms
            ) {
                scanned++;

                if (
                    !hasSlotConflict(
                        occupancy.roomSlots,
                        room.id,
                        window.slotIds
                    )
                ) {
                    valid++;

                    if (
                        valid >=
                        maxCandidateScan
                    ) {
                        if (flexibilityCache) {
                            flexibilityCache.set(
                                cacheKey,
                                valid
                            );
                        }

                        return valid;
                    }
                }

                if (
                    scanned >=
                    maxRawScan
                ) {
                    if (flexibilityCache) {
                        flexibilityCache.set(
                            cacheKey,
                            valid
                        );
                    }

                    return valid;
                }
            }
        }

        if (
            scanned >= maxRawScan
        ) {
            break;
        }
    }

    if (flexibilityCache) {
        flexibilityCache.set(
            cacheKey,
            valid
        );
    }

    return valid;
};

/*
|--------------------------------------------------------------------------
| MRV
|--------------------------------------------------------------------------
*/

const selectMRVRequirement = ({
    section,
    requirements,
    assignedIds,
    windowsByHours,
    professorMap,
    rooms,
    occupancy,
    flexibilityCache,
    searchLimits
}) => {
    let selected = null;
    let selectedFlexibility =
        Infinity;

    for (
        const requirement
        of requirements
    ) {
        if (
            assignedIds.has(
                requirement.id
            )
        ) {
            continue;
        }

        const flexibility =
            estimateRequirementFlexibility({
                section,
                requirement,
                windowsByHours,
                professorMap,
                rooms,
                occupancy,
                flexibilityCache,
                searchLimits
            });

        if (flexibility === 0) {
            return {
                requirement,
                flexibility: 0
            };
        }

        if (
            flexibility <
            selectedFlexibility
        ) {
            selected =
                requirement;

            selectedFlexibility =
                flexibility;
        }
    }

    return {
        requirement: selected,
        flexibility:
            selectedFlexibility
    };
};

/*
|--------------------------------------------------------------------------
| FORWARD CHECK
|--------------------------------------------------------------------------
*/

const forwardCheck = ({
    section,
    requirements,
    assignedIds,
    windowsByHours,
    professorMap,
    rooms,
    occupancy,
    flexibilityCache,
    searchLimits
}) => {
    for (
        const requirement
        of requirements
    ) {
        if (
            assignedIds.has(
                requirement.id
            )
        ) {
            continue;
        }

        const flexibility =
            estimateRequirementFlexibility({
                section,
                requirement,
                windowsByHours,
                professorMap,
                rooms,
                occupancy,
                flexibilityCache,
                searchLimits
            });

        if (flexibility === 0) {
            return false;
        }
    }

    return true;
};

const bumpOccupancyVersion =
    occupancy => {
        occupancy._version =
            (occupancy._version || 0) + 1;
    };

/*
|--------------------------------------------------------------------------
| GREEDY
|--------------------------------------------------------------------------
*/

const solveGreedy = ({
    section,
    requirements,
    windowsByHours,
    professorMap,
    rooms,
    occupancy,
    searchLimits
}) => {
    const assignments = [];

    const assignedIds =
        new Set();

    const flexibilityCache =
        createFlexibilityCache();

    while (
        assignedIds.size <
        requirements.length
    ) {
        const selected =
            selectMRVRequirement({
                section,
                requirements,
                assignedIds,
                windowsByHours,
                professorMap,
                rooms,
                occupancy,
                flexibilityCache,
                searchLimits
            });

        if (
            !selected.requirement ||
            selected.flexibility === 0
        ) {
            releaseAssignments(
                assignments,
                occupancy
            );

            return {
                success: false,
                assignments: [],
                failedRequirement:
                    selected.requirement ||
                    null
            };
        }

        const requirement =
            selected.requirement;

        const windows =
            getRequirementWindows(
                requirement,
                windowsByHours
            );

        const professors =
            professorMap.get(
                num(requirement.subject_id)
            ) || [];

        const pool =
            getCandidatePool({
                section,
                requirement,
                windows,
                professors,
                rooms,
                occupancy,
                professorMap,
                limit:
                    searchLimits
                        .GREEDY_MAX_CANDIDATES_PER_REQUIREMENT
            });

        if (
            pool.candidates.length === 0
        ) {
            releaseAssignments(
                assignments,
                occupancy
            );

            return {
                success: false,
                assignments: [],
                failedRequirement:
                    requirement
            };
        }

        const candidate =
            pool.candidates[0];

        if (
            assignmentHasConflict(
                candidate,
                occupancy
            )
        ) {
            releaseAssignments(
                assignments,
                occupancy
            );

            return {
                success: false,
                assignments: [],
                failedRequirement:
                    requirement
            };
        }

        reserveAssignment(
            candidate,
            occupancy
        );

        bumpOccupancyVersion(
            occupancy
        );

        assignments.push(candidate);

        assignedIds.add(
            requirement.id
        );
    }

    return {
        success: true,
        assignments
    };
};

/*
|--------------------------------------------------------------------------
| BACKTRACK
|--------------------------------------------------------------------------
*/

const solveBacktracking = ({
    section,
    requirements,
    windowsByHours,
    professorMap,
    rooms,
    occupancy,
    searchLimits
}) => {
    const start =
        Date.now();

    let nodes = 0;
    let timeout = false;
    let nodeLimit = false;

    const assignments = [];

    const assignedIds =
        new Set();

    const flexibilityCache =
        createFlexibilityCache();

    const backtrack = () => {
        nodes++;

        if (
            Date.now() - start >=
            searchLimits.MAX_TIME_MS_PER_SECTION
        ) {
            timeout = true;
            return false;
        }

        if (
            nodes >
            searchLimits.MAX_BACKTRACK_NODES_PER_SECTION
        ) {
            nodeLimit = true;
            return false;
        }

        if (
            assignedIds.size ===
            requirements.length
        ) {
            return true;
        }

        const selected =
            selectMRVRequirement({
                section,
                requirements,
                assignedIds,
                windowsByHours,
                professorMap,
                rooms,
                occupancy,
                flexibilityCache,
                searchLimits
            });

        if (
            !selected.requirement ||
            selected.flexibility === 0
        ) {
            return false;
        }

        const requirement =
            selected.requirement;

        const windows =
            getRequirementWindows(
                requirement,
                windowsByHours
            );

        const professors =
            professorMap.get(
                num(requirement.subject_id)
            ) || [];

        const pool =
            getCandidatePool({
                section,
                requirement,
                windows,
                professors,
                rooms,
                occupancy,
                professorMap,
                limit:
                    searchLimits
                        .BACKTRACK_MAX_CANDIDATES_PER_REQUIREMENT
            });

        if (
            pool.candidates.length === 0
        ) {
            return false;
        }

        for (
            const candidate
            of pool.candidates
        ) {
            if (
                timeout ||
                nodeLimit
            ) {
                return false;
            }

            if (
                assignmentHasConflict(
                    candidate,
                    occupancy
                )
            ) {
                continue;
            }

            reserveAssignment(
                candidate,
                occupancy
            );

            bumpOccupancyVersion(
                occupancy
            );

            assignments.push(
                candidate
            );

            assignedIds.add(
                requirement.id
            );

            const possible =
                forwardCheck({
                    section,
                    requirements,
                    assignedIds,
                    windowsByHours,
                    professorMap,
                    rooms,
                    occupancy,
                    flexibilityCache,
                    searchLimits
                });

            if (
                possible &&
                backtrack()
            ) {
                return true;
            }

            assignedIds.delete(
                requirement.id
            );

            assignments.pop();

            releaseAssignment(
                candidate,
                occupancy
            );

            bumpOccupancyVersion(
                occupancy
            );
        }

        return false;
    };

    const success =
        backtrack();

    if (!success) {
        releaseAssignments(
            assignments,
            occupancy
        );
    }

    return {
        success,

        assignments:
            success
                ? [...assignments]
                : [],

        nodes,

        elapsed:
            Date.now() - start,

        timeout,

        nodeLimit,

        failureType:
            success
                ? null
                : timeout
                    ? "SEARCH_TIMEOUT"
                    : nodeLimit
                        ? "NODE_LIMIT"
                        : "CONSTRAINT_FAILURE"
    };
};

/*
|--------------------------------------------------------------------------
| HYBRID
|--------------------------------------------------------------------------
*/

const solveHybrid = async ({
    section,
    requirements,
    windowsByHours,
    professorMap,
    rooms,
    occupancy,
    searchLimits
}) => {
    const greedy =
        solveGreedy({
            section,
            requirements,
            windowsByHours,
            professorMap,
            rooms,
            occupancy,
            searchLimits
        });

    if (greedy.success) {
        return {
            success: true,
            method: "GREEDY",
            assignments:
                greedy.assignments,
            nodes: 0,
            elapsed: 0,
            failedRequirement:
                null
        };
    }

    const backtrack =
        solveBacktracking({
            section,
            requirements,
            windowsByHours,
            professorMap,
            rooms,
            occupancy,
            searchLimits
        });

    return {
        success:
            backtrack.success,

        method:
            "BACKTRACK",

        assignments:
            backtrack.assignments,

        nodes:
            backtrack.nodes,

        elapsed:
            backtrack.elapsed,

        timeout:
            backtrack.timeout,

        nodeLimit:
            backtrack.nodeLimit,

        failureType:
            backtrack.failureType,

        failedRequirement:
            greedy.failedRequirement
    };
};

/*
|--------------------------------------------------------------------------
| SAVE
|--------------------------------------------------------------------------
*/

const saveSectionSchedules = async (
    assignments,
    academicTermId
) => {
    if (assignments.length === 0) {
        return;
    }

    const values = [];

    for (
        const assignment
        of assignments
    ) {
        for (
            const slot
            of assignment.window.slots
        ) {
            values.push([
                assignment.sectionId,

                assignment
                    .requirement
                    .subject_id,

                assignment.professorId,

                assignment.roomId,

                num(slot.id),

                academicTermId
            ]);
        }
    }

    if (values.length === 0) {
        return;
    }

    const placeholders =
        values
            .map(
                () =>
                    "(?, ?, ?, ?, ?, ?)"
            )
            .join(",");

    await db.query(`
        INSERT INTO class_schedules
        (
            section_id,
            subject_id,
            professor_id,
            room_id,
            time_slot_id,
            academic_term_id
        )
        VALUES ${placeholders}
    `, values.flat());
};

/*
|--------------------------------------------------------------------------
| PROGRAM CURRICULUM
|--------------------------------------------------------------------------
*/

const getProgramCurriculum = async (
    programId,
    academicTermId
) => {
    const [rows] = await db.query(`
        SELECT
            cs.program_id,
            cs.year_level,
            cs.subject_id,

            sub.subject_code,
            sub.subject_name,
            sub.units,
            sub.lecture_units,
            sub.lab_units,

            at.semester

        FROM curriculum_subjects cs

        JOIN academic_terms at
            ON at.id = ?

        JOIN subjects sub
            ON sub.id =
                cs.subject_id

        WHERE cs.program_id = ?
          AND cs.semester =
                at.semester

        ORDER BY
            FIELD(
                cs.year_level,
                '1st Year',
                '2nd Year',
                '3rd Year',
                '4th Year'
            ),
            sub.subject_code ASC
    `, [
        academicTermId,
        programId
    ]);

    return rows.map(row => ({
        program_id:
            num(row.program_id),

        year_level:
            row.year_level,

        subject_id:
            num(row.subject_id),

        subject_code:
            row.subject_code,

        subject_name:
            row.subject_name,

        units:
            num(row.units || 0),

        lecture_units:
            num(row.lecture_units || 0),

        lab_units:
            num(row.lab_units || 0),

        semester:
            row.semester
    }));
};

/*
|--------------------------------------------------------------------------
| SIMULATED SECTIONS
|--------------------------------------------------------------------------
*/

const buildSimulatedSections = async ({
    programId,
    academicTermId,
    simulateStudents,
    simulateSectionCapacity
}) => {
    const students =
        num(simulateStudents);

    const capacity =
        num(simulateSectionCapacity) ||
        50;

    if (students <= 0) {
        throw new Error(
            "simulateStudents must be greater than 0."
        );
    }

    const curriculum =
        await getProgramCurriculum(
            programId,
            academicTermId
        );

    if (curriculum.length === 0) {
        throw new Error(
            "No curriculum subjects found for the selected program."
        );
    }

    const yearOrder = [
        "1st Year",
        "2nd Year",
        "3rd Year",
        "4th Year"
    ];

    const years =
        yearOrder.filter(year =>
            curriculum.some(
                row =>
                    row.year_level ===
                    year
            )
        );

    if (years.length === 0) {
        throw new Error(
            "No valid curriculum year levels found."
        );
    }

    /*
     * IMPORTANT
     *
     * Simulation sections are distributed
     * across the actual curriculum year levels.
     */

    const totalSections =
        Math.max(
            1,
            Math.ceil(
                students / capacity
            )
        );

    const simulatedSections = [];

    let remainingStudents =
        students;

    /*
     * Better distribution than blindly
     * cycling 1st -> 2nd -> 3rd -> 4th.
     */

    const basePerYear =
        Math.floor(
            totalSections /
            years.length
        );

    const extra =
        totalSections %
        years.length;

    let sectionIndex = 0;

    for (
        let yearIndex = 0;
        yearIndex < years.length;
        yearIndex++
    ) {
        const year =
            years[yearIndex];

        const count =
            basePerYear +
            (
                yearIndex < extra
                    ? 1
                    : 0
            );

        const yearSubjects =
            curriculum.filter(
                row =>
                    row.year_level ===
                    year
            );

        for (
            let i = 0;
            i < count;
            i++
        ) {
            if (
                remainingStudents <= 0
            ) {
                break;
            }

            const sectionStudentCount =
                Math.min(
                    capacity,
                    remainingStudents
                );

            remainingStudents -=
                sectionStudentCount;

            sectionIndex++;

            const section = {
                id:
                    -sectionIndex,

                program_id:
                    num(programId),

                year_level:
                    num(
                        year.match(
                            /\d+/
                        )?.[0] || 1
                    ),

                section_name:
                    `SIM-${sectionIndex}`,

                academic_term_id:
                    num(
                        academicTermId
                    ),

                max_students:
                    capacity,

                student_count:
                    sectionStudentCount,

                subjects:
                    yearSubjects.map(
                        row => ({
                            subject_id:
                                row.subject_id,

                            subject_code:
                                row.subject_code,

                            subject_name:
                                row.subject_name,

                            units:
                                row.units,

                            lecture_units:
                                row.lecture_units,

                            lab_units:
                                row.lab_units,

                            year_level:
                                row.year_level,

                            semester:
                                row.semester
                        })
                    )
            };

            section.requirements =
                buildRequirements(
                    section.subjects
                );

            section.missingRequirements =
                section.requirements.map(
                    requirement => ({
                        ...requirement,

                        remainingHours:
                            requirement.hours
                    })
                );

            section.isComplete =
                false;

            simulatedSections.push(
                section
            );
        }
    }

    return simulatedSections;
};

/*
|--------------------------------------------------------------------------
| RUN ONE SCHEDULER SIMULATION
|--------------------------------------------------------------------------
|
| THIS IS IMPORTANT:
|
| This function performs exactly ONE test.
|
| The binary-search simulation controller
| below decides whether to test higher/lower.
|--------------------------------------------------------------------------
*/

const runSingleSimulation = async ({
    programId,
    academicTermId,
    students,
    sectionCapacity = 50
}) => {
    logSchedule(
        "single simulation start",
        {
            students,
            sections:
                Math.ceil(
                    students /
                    sectionCapacity
                )
        }
    );

    const result =
        await generateSchedulesCore({
            programId,
            academicTermId,

            simulation: true,

            simulateStudents:
                students,

            simulateSectionCapacity:
                sectionCapacity,

            simulationBatch:
                0,

            simulationReduction:
                0,

            internalSimulation:
                true
        });

    return result;
};

/*
|--------------------------------------------------------------------------
| V2 SIMULATION SEARCH
|--------------------------------------------------------------------------
|
| RULE:
|
| GOOD = lower bound
| FAIL = upper bound
|
| NEVER test above the known failed value.
|
| Example:
|
| 4000 FAIL
| 3900 GOOD
|
| next = floor((3900 + 4000) / 2)
|      = 3950
|
| 3950 GOOD
|
| next = 3975
|
| 3975 FAIL
|
| next = 3962
|
|--------------------------------------------------------------------------
*/

const simulateCapacityV2 = async ({
    programId,
    academicTermId,
    startingStudents,
    sectionCapacity,
    batch = 500,
    reduction = 100
}) => {
    let workingStudents = null;
    let failedStudents = null;

    let attempt = 0;

    const history = [];

    /*
     * Initial target.
     *
     * If there is already a known successful
     * state, start there.
     */

    let targetStudents =
        Math.max(
            1,
            num(startingStudents)
        );

    /*
     * FIRST PHASE
     *
     * Expand by batch ONLY while there is
     * NO failed upper bound yet.
     *
     * Once a failure happens, expansion is
     * permanently disabled.
     */

    while (true) {
        attempt++;

        const targetSections =
            Math.ceil(
                targetStudents /
                sectionCapacity
            );

        logSchedule(
            "simulation attempt",
            {
                attempt,
                students:
                    targetStudents,
                sections:
                    targetSections
            }
        );

        const result =
            await runSingleSimulation({
                programId,
                academicTermId,

                students:
                    targetStudents,

                sectionCapacity
            });

        const success =
            result.success === true &&
            result.failedSections === 0;

        history.push({
            attempt,

            students:
                targetStudents,

            sections:
                targetSections,

            success,

            scheduledSections:
                result.scheduledSections,

            failedSections:
                result.failedSections
        });

        if (success) {
            /*
             * GOOD POINT
             */

            workingStudents =
                targetStudents;

            logSchedule(
                "simulation capacity accepted",
                {
                    students:
                        workingStudents,

                    sections:
                        Math.ceil(
                            workingStudents /
                            sectionCapacity
                        ),

                    attempts:
                        attempt
                }
            );

            /*
             * If there is NO failed upper
             * boundary yet, continue upward.
             */

            if (
                failedStudents === null
            ) {
                targetStudents =
                    workingStudents +
                    batch;

                continue;
            }

            /*
             * We now have:
             *
             * working < failed
             *
             * Find midpoint.
             */

            const gap =
                failedStudents -
                workingStudents;

            /*
             * Minimum resolution reached.
             */

            if (
                gap <= reduction
            ) {
                break;
            }

            /*
             * BINARY SEARCH.
             *
             * NEVER exceeds failedStudents.
             */

            const midpoint =
                Math.floor(
                    (
                        workingStudents +
                        failedStudents
                    ) / 2
                );

            targetStudents =
                Math.min(
                    midpoint,
                    failedStudents - 1
                );

            continue;
        }

        /*
         * FAILURE
         *
         * This becomes the new upper bound.
         */

        failedStudents =
            targetStudents;

        logSchedule(
            "simulation failed; upper bound locked",
            {
                failedStudents,
                workingStudents,
                gap:
                    workingStudents === null
                        ? null
                        : failedStudents -
                            workingStudents
            }
        );

        /*
         * If there is no working point yet,
         * reduce from the failed value.
         *
         * This is only for the first failure.
         */

        if (
            workingStudents === null
        ) {
            const reduced =
                Math.max(
                    1,
                    targetStudents -
                    reduction
                );

            /*
             * IMPORTANT:
             *
             * Never allow the next target
             * to be >= failedStudents.
             */

            targetStudents =
                Math.min(
                    reduced,
                    failedStudents - 1
                );

            continue;
        }

        /*
         * We have both:
         *
         * GOOD
         * FAIL
         *
         * So binary search.
         */

        const gap =
            failedStudents -
            workingStudents;

        if (
            gap <= reduction
        ) {
            break;
        }

        const midpoint =
            Math.floor(
                (
                    workingStudents +
                    failedStudents
                ) / 2
            );

        targetStudents =
            Math.min(
                midpoint,
                failedStudents - 1
            );
    }

    /*
     * FINAL RESULT
     */

    const finalStudents =
        workingStudents ?? 0;

    const finalSections =
        Math.ceil(
            finalStudents /
            sectionCapacity
        );

    logSchedule(
        "simulation search finished",
        {
            workingStudents,
            failedStudents,
            finalStudents,
            finalSections,
            attempts:
                attempt
        }
    );

    return {
        success:
            workingStudents !== null,

        students:
            finalStudents,

        sections:
            finalSections,

        workingStudents,

        failedStudents,

        attempts:
            attempt,

        resolution:
            failedStudents !== null &&
            workingStudents !== null
                ? failedStudents -
                    workingStudents
                : null,

        history
    };
};

/*
|--------------------------------------------------------------------------
| CORE SCHEDULER
|--------------------------------------------------------------------------
*/

const generateSchedulesCore = async ({
    programId,
    academicTermId,

    simulation = false,

    simulateStudents = 0,

    simulateSectionCapacity = 50,

    simulationBatch = 0,

    simulationReduction = 0,

    internalSimulation = false
}) => {
    const writeToDatabase =
        !simulation;

    logSchedule(
        "start schedule generation",
        {
            programId,
            academicTermId,
            simulation,
            simulateStudents,
            simulateSectionCapacity,
            simulationBatch,
            simulationReduction
        }
    );

    if (
        !programId ||
        !academicTermId
    ) {
        throw new Error(
            "programId and academicTermId are required."
        );
    }

    const searchLimits =
        getSearchLimits(
            simulation
        );

    let sections;

    if (simulation) {
        sections =
            await buildSimulatedSections({
                programId,
                academicTermId,

                simulateStudents,

                simulateSectionCapacity
            });
    } else {
        sections =
            await getSections(
                programId,
                academicTermId
            );
    }

    if (sections.length === 0) {
        throw new Error(
            "No sections found for selected program."
        );
    }

    const timeSlots =
        await getTimeSlots();

    if (timeSlots.length === 0) {
        throw new Error(
            "No available time slots."
        );
    }

    const slotsByDay =
        groupSlotsByDay(
            timeSlots
        );

    const rooms =
        await getRooms();

    if (rooms.length === 0) {
        throw new Error(
            "No available rooms."
        );
    }

    const existingSchedules =
        simulation
            ? []
            : await loadExistingSchedules(
                academicTermId
            );

    const occupancy =
        createOccupancy();

    if (!simulation) {
        reserveExistingSchedules(
            existingSchedules,
            occupancy
        );
    }

    const existingRequirementCounts =
        simulation
            ? new Map()
            : getExistingRequirementCounts(
                existingSchedules
            );

    let studentCounts =
        new Map();

    let subjectsBySection =
        new Map();

    if (simulation) {
        for (
            const section
            of sections
        ) {
            section.student_count =
                num(
                    section.student_count
                ) || 0;

            section.subjects =
                Array.isArray(
                    section.subjects
                )
                    ? section.subjects
                    : [];

            studentCounts.set(
                num(section.id),
                num(
                    section.student_count
                )
            );

            subjectsBySection.set(
                num(section.id),
                section.subjects
            );
        }
    } else {
        const sectionIds =
            sections.map(
                section =>
                    num(section.id)
            );

        studentCounts =
            await getSectionStudentCounts(
                sectionIds,
                academicTermId
            );

        subjectsBySection =
            await getAllSectionSubjects(
                sections,
                academicTermId
            );
    }

    const preparedSections = [];

    const allSubjectIds =
        new Set();

    for (
        const section
        of sections
    ) {
        if (simulation) {
            section.student_count =
                num(
                    section.student_count
                ) || 0;

            section.subjects =
                Array.isArray(
                    section.subjects
                )
                    ? section.subjects
                    : [];

            section.requirements =
                buildRequirements(
                    section.subjects
                );

            section.missingRequirements =
                section.requirements.map(
                    requirement => ({
                        ...requirement,

                        remainingHours:
                            requirement.hours
                    })
                );

            section.isComplete =
                false;
        } else {
            section.student_count =
                studentCounts.get(
                    num(section.id)
                ) || 0;

            section.subjects =
                subjectsBySection.get(
                    num(section.id)
                ) || [];

            if (
                section.subjects.length === 0
            ) {
                continue;
            }

            section.requirements =
                buildRequirements(
                    section.subjects
                );

            section.missingRequirements =
                getMissingRequirements(
                    section,
                    existingRequirementCounts
                );

            const status =
                getSectionStatus(
                    section,
                    existingRequirementCounts
                );

            section.isComplete =
                status.complete;

            if (
                section.isComplete
            ) {
                continue;
            }
        }

        for (
            const requirement
            of section.missingRequirements
        ) {
            allSubjectIds.add(
                num(
                    requirement.subject_id
                )
            );
        }

        preparedSections.push(
            section
        );
    }

    if (
        preparedSections.length === 0
    ) {
        return {
            success: true,

            partial: false,

            programId,

            academicTermId,

            simulation,

            mode:
                simulation
                    ? "SIMULATION"
                    : "LIVE",

            databaseWrite:
                writeToDatabase,

            sectionCount:
                sections.length,

            newSections: 0,

            scheduledSections: 0,

            failedSections: 0,

            scheduled: [],

            failed: [],

            schedules: [],

            message:
                "No sections to schedule."
        };
    }

    const professorMap =
        await getProfessorMap(
            [...allSubjectIds]
        );

    const professorIds = [];

    for (
        const professors
        of professorMap.values()
    ) {
        for (
            const professor
            of professors
        ) {
            professorIds.push(
                professor.id
            );
        }
    }

    await loadProfessorMaxHours(
        occupancy,
        professorIds
    );

    for (
        const professors
        of professorMap.values()
    ) {
        for (
            const professor
            of professors
        ) {
            if (
                !occupancy
                    .professorMaxWeeklyHours
                    .has(
                        professor.id
                    )
            ) {
                occupancy
                    .professorMaxWeeklyHours
                    .set(
                        professor.id,

                        professor
                            .max_hours_per_week ??
                        DEFAULT_MAX_PROFESSOR_HOURS
                    );
            }
        }
    }

    const uniqueHours = [
        ...new Set(
            preparedSections.flatMap(
                section =>
                    section
                        .missingRequirements
                        .map(
                            requirement =>
                                num(
                                    requirement
                                        .remainingHours ||
                                    requirement.hours
                                )
                        )
            )
        )
    ].sort(
        (a, b) => a - b
    );

    const windowsByHours =
        new Map();

    for (
        const hours
        of uniqueHours
    ) {
        windowsByHours.set(
            hours,
            buildWindows(
                slotsByDay,
                hours
            )
        );
    }

    const sectionJobs =
        preparedSections.map(
            section => {
                let difficulty = 0;

                for (
                    const requirement
                    of section
                        .missingRequirements
                ) {
                    const flexibility =
                        estimateRequirementFlexibility({
                            section,
                            requirement,
                            windowsByHours,
                            professorMap,
                            rooms,
                            occupancy,
                            flexibilityCache:
                                null,
                            searchLimits
                        });

                    difficulty +=
                        flexibility;
                }

                return {
                    section,
                    difficulty
                };
            }
        );

    sectionJobs.sort(
        (a, b) =>
            a.difficulty -
            b.difficulty
    );

    logSchedule(
        "section processing started",
        {
            totalSections:
                sectionJobs.length,

            simulation,

            databaseWrite:
                writeToDatabase
        }
    );

    const scheduledSections = [];

    const failedSections = [];

    const generatedSchedules = [];

    for (
        let index = 0;
        index < sectionJobs.length;
        index++
    ) {
        const {
            section
        } = sectionJobs[index];

        const current =
            index + 1;

        const total =
            sectionJobs.length;

        if (
            current % 10 === 0 ||
            current === total
        ) {
            logSchedule(
                "processing section batch",
                {
                    current,
                    total,
                    section:
                        section.section_name,

                    requirements:
                        section
                            .missingRequirements
                            .length
                }
            );
        }

        const result =
            await solveHybrid({
                section,

                requirements:
                    section.missingRequirements,

                windowsByHours,

                professorMap,

                rooms,

                occupancy,

                searchLimits
            });

        if (result.success) {
            try {
                if (writeToDatabase) {
                    await saveSectionSchedules(
                        result.assignments,
                        academicTermId
                    );
                }

                scheduledSections.push(
                    section.section_name
                );

                for (
                    const assignment
                    of result.assignments
                ) {
                    for (
                        const slot
                        of assignment
                            .window
                            .slots
                    ) {
                        generatedSchedules.push({
                            section:
                                section.section_name,

                            sectionId:
                                section.id,

                            yearLevel:
                                section.year_level,

                            subject:
                                assignment
                                    .requirement
                                    .subject_code,

                            subjectId:
                                assignment
                                    .requirement
                                    .subject_id,

                            type:
                                assignment
                                    .requirement
                                    .type,

                            professor:
                                `${assignment.professor.firstname} ${assignment.professor.lastname}`,

                            professorId:
                                assignment.professorId,

                            professorMaxHours:
                                getProfessorMaxWeeklyHours(
                                    occupancy,
                                    assignment.professorId
                                ),

                            professorCurrentWeeklyHours:
                                getProfessorWeeklyHours(
                                    occupancy,
                                    assignment.professorId
                                ),

                            professorRemainingHours:
                                getProfessorRemainingHours(
                                    occupancy,
                                    assignment.professorId
                                ),

                            professorExactFill:
                                getProfessorRemainingHours(
                                    occupancy,
                                    assignment.professorId
                                ) === 0,

                            room:
                                assignment
                                    .room
                                    .room_name,

                            roomId:
                                assignment.roomId,

                            roomType:
                                assignment
                                    .room
                                    .room_type,

                            day:
                                assignment.day,

                            start:
                                assignment
                                    .start_time,

                            end:
                                assignment
                                    .end_time
                        });
                    }
                }
            } catch (saveError) {
                releaseAssignments(
                    result.assignments,
                    occupancy
                );

                failedSections.push({
                    sectionId:
                        section.id,

                    section:
                        section.section_name,

                    reason:
                        `Database save failed: ${saveError.message}`,

                    failureType:
                        "DATABASE_SAVE_FAILURE",

                    bottleneck:
                        "DATABASE",

                    bottleneckAnalysis: []
                });
            }

            continue;
        }

        /*
         * IMPORTANT:
         *
         * We DO NOT stop the simulation after
         * 2 failed sections anymore.
         *
         * A simulation attempt is considered
         * failed if even one section cannot
         * be scheduled.
         */

        const analyses = [];

        for (
            const requirement
            of section.missingRequirements
        ) {
            analyses.push(
                analyzeRequirement({
                    section,
                    requirement,
                    windowsByHours,
                    professorMap,
                    rooms,
                    occupancy,
                    searchLimits
                })
            );
        }

        let worst = null;

        let worstScore =
            -Infinity;

        for (
            const analysis
            of analyses
        ) {
            let score = 0;

            if (
                analysis.availableCandidates ===
                0
            ) {
                score += 100000;
            }

            score +=
                analysis.professorBlocked;

            score +=
                analysis
                    .professorWeeklyLimitBlocked *
                2;

            score +=
                analysis.roomBlocked;

            score +=
                analysis.sectionBlocked;

            if (
                score >
                worstScore
            ) {
                worstScore =
                    score;

                worst =
                    analysis;
            }
        }

        const reason =
            worst
                ? `Unable to schedule ${worst.subjectCode} ${worst.type}. Likely bottleneck: ${worst.bottleneck}.`
                : `Unable to find a valid schedule for section ${section.section_name}.`;

        failedSections.push({
            sectionId:
                section.id,

            section:
                section.section_name,

            reason,

            failureType:
                result.failureType ||
                "CONSTRAINT_FAILURE",

            bottleneck:
                worst?.bottleneck ||
                "UNKNOWN",

            bottleneckAnalysis:
                analyses
        });

        warnSchedule(
            "section failed",
            {
                section:
                    section.section_name,

                failureType:
                    result.failureType ||
                    "CONSTRAINT_FAILURE",

                bottleneck:
                    worst?.bottleneck ||
                    "UNKNOWN"
            }
        );

        /*
         * ONE FAILED SECTION IS ENOUGH
         * TO FAIL THE ENTIRE SIMULATION.
         *
         * No need to spend time scheduling
         * the remaining sections.
         */

        if (simulation) {
            break;
        }
    }

    const completeSuccess =
        failedSections.length === 0;

    const partial =
        scheduledSections.length > 0 &&
        failedSections.length > 0;

    const professorWorkload =
        buildProfessorWorkloadSummary(
            occupancy
        );

    const bottleneckSummary = {
        professor: 0,
        professorWeeklyHours: 0,
        room: 0,
        sectionTimeslot: 0,
        multipleResources: 0,
        combination: 0,
        searchTimeout: 0,
        nodeLimit: 0,
        unknown: 0
    };

    for (
        const failed
        of failedSections
    ) {
        const bottleneck =
            failed.bottleneck;

        if (
            bottleneck ===
            "PROFESSOR"
        ) {
            bottleneckSummary.professor++;
        } else if (
            bottleneck ===
            "PROFESSOR WEEKLY HOURS"
        ) {
            bottleneckSummary
                .professorWeeklyHours++;
        } else if (
            bottleneck === "ROOM"
        ) {
            bottleneckSummary.room++;
        } else if (
            bottleneck ===
            "SECTION/TIMESLOT"
        ) {
            bottleneckSummary
                .sectionTimeslot++;
        } else if (
            bottleneck ===
            "MULTIPLE RESOURCES"
        ) {
            bottleneckSummary
                .multipleResources++;
        } else if (
            bottleneck ===
            "COMBINATION / BACKTRACKING CONSTRAINT"
        ) {
            bottleneckSummary
                .combination++;
        } else if (
            failed.failureType ===
            "SEARCH_TIMEOUT"
        ) {
            bottleneckSummary
                .searchTimeout++;
        } else if (
            failed.failureType ===
            "NODE_LIMIT"
        ) {
            bottleneckSummary
                .nodeLimit++;
        } else {
            bottleneckSummary
                .unknown++;
        }
    }

    logSchedule(
        "schedule generation finished",
        {
            success:
                completeSuccess,

            partial,

            scheduled:
                scheduledSections.length,

            failed:
                failedSections.length,

            simulation
        }
    );

    return {
        success:
            completeSuccess,

        partial,

        programId,

        academicTermId,

        simulation,

        mode:
            simulation
                ? "SIMULATION"
                : "LIVE",

        databaseWrite:
            writeToDatabase,

        sectionCount:
            sections.length,

        newSections:
            preparedSections.length,

        scheduledSections:
            scheduledSections.length,

        failedSections:
            failedSections.length,

        scheduled:
            scheduledSections,

        failed:
            failedSections,

        bottleneckSummary,

        professorWorkload,

        schedules:
            generatedSchedules,

        simulationConfig: {
            enabled:
                simulation,

            algorithm:
                "V2_HYBRID_MRV_BINARY_SEARCH_SIMULATION",

            scheduler:
                "HYBRID_MRV_FILL_FIRST_PROFESSOR_WORKLOAD",

            databaseWrite:
                writeToDatabase,

            schedulingDays:
                [...DAY_ORDER],

            professorWeeklyHoursEnabled:
                true,

            defaultProfessorMaxHoursPerWeek:
                DEFAULT_MAX_PROFESSOR_HOURS,

            maxBacktrackNodesPerSection:
                searchLimits
                    .MAX_BACKTRACK_NODES_PER_SECTION,

            maxTimeMsPerSection:
                searchLimits
                    .MAX_TIME_MS_PER_SECTION,

            greedyCandidatesPerRequirement:
                searchLimits
                    .GREEDY_MAX_CANDIDATES_PER_REQUIREMENT,

            backtrackCandidatesPerRequirement:
                searchLimits
                    .BACKTRACK_MAX_CANDIDATES_PER_REQUIREMENT,

            maxMRVCandidateScan:
                searchLimits
                    .MAX_MRV_CANDIDATE_SCAN,

            maxBottleneckScan:
                searchLimits
                    .MAX_BOTTLENECK_SCAN,

            totalRooms:
                rooms.length,

            lectureRooms:
                rooms.filter(
                    room =>
                        room.room_type ===
                        "lecture"
                ).length,

            laboratoryRooms:
                rooms.filter(
                    room =>
                        room.room_type ===
                        "laboratory"
                ).length,

            totalTimeSlots:
                timeSlots.length,

            existingScheduleRows:
                existingSchedules.length
        },

        message:
            completeSuccess
                ? simulation
                    ? "Simulation passed. No database rows were inserted."
                    : "All incomplete sections were scheduled successfully."

                : partial
                    ? "Simulation partially completed."

                    : simulation
                        ? "Simulation failed."

                        : "No incomplete sections could be scheduled."
    };
};

/*
|--------------------------------------------------------------------------
| PUBLIC generateSchedules
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Normal scheduler:
|   simulation = false
|
| One-shot simulation:
|   simulation = true
|   simulateStudents = 4000
|
| V2 automatic capacity search:
|   simulationV2 = true
|
|--------------------------------------------------------------------------
*/

const generateSchedules = async req => {
    const {
        programId,
        academicTermId
    } = req.body;

    const simulation =
        req.body.simulation === true ||
        req.body.simulation === "true";

    const simulationV2 =
        req.body.simulationV2 === true ||
        req.body.simulationV2 === "true";

    const simulateStudents =
        num(
            req.body.simulateStudents
        ) || 0;

    const simulateSectionCapacity =
        num(
            req.body.simulateSectionCapacity
        ) || 50;

    const simulationBatch =
        num(
            req.body.simulationBatch
        ) || 500;

    const simulationReduction =
        num(
            req.body.simulationReduction
        ) || 100;

    /*
     * V2 AUTOMATIC SEARCH
     */

    if (
        simulationV2
    ) {
        if (
            !programId ||
            !academicTermId
        ) {
            throw new Error(
                "programId and academicTermId are required."
            );
        }

        const startingStudents =
            simulateStudents ||
            simulationBatch;

        logSchedule(
            "V2 simulation search started",
            {
                programId,
                academicTermId,

                startingStudents,

                sectionCapacity:
                    simulateSectionCapacity,

                batch:
                    simulationBatch,

                reduction:
                    simulationReduction
            }
        );

        const result =
            await simulateCapacityV2({
                programId,

                academicTermId,

                startingStudents,

                sectionCapacity:
                    simulateSectionCapacity,

                batch:
                    simulationBatch,

                reduction:
                    simulationReduction
            });

        return {
            success:
                result.success,

            programId,

            academicTermId,

            simulation:
                true,

            simulationV2:
                true,

            mode:
                "SIMULATION_V2",

            databaseWrite:
                false,

            students:
                result.students,

            sections:
                result.sections,

            workingStudents:
                result.workingStudents,

            failedStudents:
                result.failedStudents,

            attempts:
                result.attempts,

            resolution:
                result.resolution,

            history:
                result.history,

            message:
                result.success
                    ? `Maximum confirmed working capacity is ${result.students} students (${result.sections} sections). Known failed boundary: ${result.failedStudents ?? "none"}.`
                    : "No working student capacity was found."
        };
    }

    /*
     * NORMAL / ONE-SHOT SCHEDULER
     */

    return generateSchedulesCore({
        programId,

        academicTermId,

        simulation,

        simulateStudents,

        simulateSectionCapacity,

        simulationBatch,

        simulationReduction
    });
};

/*
|--------------------------------------------------------------------------
| ANALYSIS
|--------------------------------------------------------------------------
*/

const analyzeRequirement = ({
    section,
    requirement,
    windowsByHours,
    professorMap,
    rooms,
    occupancy,
    searchLimits
}) => {
    const windows =
        getRequirementWindows(
            requirement,
            windowsByHours
        );

    const professors =
        professorMap.get(
            num(requirement.subject_id)
        ) || [];

    const validRooms =
        getValidRooms(
            requirement,
            section,
            rooms
        );

    let available = 0;

    let professorBlocked = 0;

    let professorWeeklyLimitBlocked = 0;

    let roomBlocked = 0;

    let sectionBlocked = 0;

    let scanned = 0;

    const maxBottleneckScan =
        searchLimits
            ? searchLimits.MAX_BOTTLENECK_SCAN
            : 3000;

    for (
        const window
        of windows
    ) {
        const sectionConflict =
            hasSlotConflict(
                occupancy.sectionSlots,
                section.id,
                window.slotIds
            );

        for (
            const professor
            of professors
        ) {
            const professorWeeklyBlocked =
                !canProfessorTakeHours(
                    occupancy,
                    professor.id,
                    window.slotIds.length
                );

            if (
                professorWeeklyBlocked
            ) {
                professorWeeklyLimitBlocked++;
            }

            const profConflict =
                hasSlotConflict(
                    occupancy.professorSlots,
                    professor.id,
                    window.slotIds
                );

            for (
                const room
                of validRooms
            ) {
                scanned++;

                const roomConflict =
                    hasSlotConflict(
                        occupancy.roomSlots,
                        room.id,
                        window.slotIds
                    );

                if (
                    !sectionConflict &&
                    !profConflict &&
                    !roomConflict &&
                    !professorWeeklyBlocked
                ) {
                    available++;
                } else {
                    if (
                        sectionConflict
                    ) {
                        sectionBlocked++;
                    }

                    if (
                        profConflict
                    ) {
                        professorBlocked++;
                    }

                    if (
                        professorWeeklyBlocked
                    ) {
                        professorBlocked++;
                    }

                    if (
                        roomConflict
                    ) {
                        roomBlocked++;
                    }
                }

                if (
                    scanned >=
                    maxBottleneckScan
                ) {
                    break;
                }
            }

            if (
                scanned >=
                maxBottleneckScan
            ) {
                break;
            }
        }

        if (
            scanned >=
            maxBottleneckScan
        ) {
            break;
        }
    }

    let bottleneck =
        "MULTIPLE RESOURCES";

    if (
        professors.length === 0
    ) {
        bottleneck =
            "PROFESSOR";
    } else if (
        available > 0
    ) {
        bottleneck =
            "COMBINATION / BACKTRACKING CONSTRAINT";
    } else if (
        professorWeeklyLimitBlocked > 0 &&
        professorWeeklyLimitBlocked >=
            professors.length
    ) {
        bottleneck =
            "PROFESSOR WEEKLY HOURS";
    } else if (
        professorBlocked >
            roomBlocked &&
        professorBlocked >
            sectionBlocked
    ) {
        bottleneck =
            "PROFESSOR";
    } else if (
        roomBlocked >
            professorBlocked &&
        roomBlocked >
            sectionBlocked
    ) {
        bottleneck =
            "ROOM";
    } else if (
        sectionBlocked >
            professorBlocked &&
        sectionBlocked >
            roomBlocked
    ) {
        bottleneck =
            "SECTION/TIMESLOT";
    }

    return {
        subjectCode:
            requirement.subject_code,

        subjectId:
            requirement.subject_id,

        type:
            requirement.type,

        hours:
            requirement.remainingHours ||
            requirement.hours,

        windows:
            windows.length,

        professors:
            professors.length,

        validRooms:
            validRooms.length,

        availableCandidates:
            available,

        professorBlocked,

        professorWeeklyLimitBlocked,

        roomBlocked,

        sectionBlocked,

        scannedCandidates:
            scanned,

        analysisLimited:
            scanned >=
            maxBottleneckScan,

        bottleneck
    };
};

/*
|--------------------------------------------------------------------------
| PROFESSOR SUMMARY
|--------------------------------------------------------------------------
*/

const buildProfessorWorkloadSummary =
    occupancy => {
        const professorIds =
            new Set([
                ...occupancy
                    .professorWeeklyHours
                    .keys(),

                ...occupancy
                    .professorMaxWeeklyHours
                    .keys()
            ]);

        const summary = [];

        for (
            const professorId
            of professorIds
        ) {
            const used =
                getProfessorWeeklyHours(
                    occupancy,
                    professorId
                );

            const max =
                getProfessorMaxWeeklyHours(
                    occupancy,
                    professorId
                );

            summary.push({
                professorId,

                usedHours:
                    used,

                maxHours:
                    max,

                remainingHours:
                    Math.max(
                        0,
                        max - used
                    ),

                utilizationPercent:
                    max > 0
                        ? Number(
                            (
                                (
                                    used /
                                    max
                                ) *
                                100
                            ).toFixed(2)
                        )
                        : 0
            });
        }

        summary.sort(
            (a, b) => {
                if (
                    b.usedHours !==
                    a.usedHours
                ) {
                    return (
                        b.usedHours -
                        a.usedHours
                    );
                }

                return (
                    a.professorId -
                    b.professorId
                );
            }
        );

        return summary;
    };

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {
    generateSchedules,
    runSingleSimulation,
    simulateCapacityV2,
    getSectionSubjects,
    buildRequirements,
    getSections
};