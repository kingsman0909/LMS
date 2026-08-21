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

/*
 * HARD WEEKLY RANGE
 *
 * Monday 07:00 AM
 *        ↓
 * Sunday 10:00 PM
 *
 * The scheduler can use ANY day inside this range.
 */

const SCHEDULE_START = "07:00:00";
const SCHEDULE_END = "22:00:00";


/*
|--------------------------------------------------------------------------
| SOLVER CONFIG
|--------------------------------------------------------------------------
|
| Keep these bounded so a difficult section cannot freeze
| the whole API.
|
*/

const MAX_BACKTRACK_NODES_PER_SECTION = 50000;
const MAX_TIME_MS_PER_SECTION = 8000;

const GREEDY_MAX_ATTEMPTS_PER_REQUIREMENT = 120;
const BACKTRACK_MAX_CANDIDATES_PER_REQUIREMENT = 120;

const MAX_MRV_CANDIDATE_SCAN = 250;


/*
|--------------------------------------------------------------------------
| YEAR LEVEL
|--------------------------------------------------------------------------
*/

const yearLevelMap = {
    1: "1st Year",
    2: "2nd Year",
    3: "3rd Year",
    4: "4th Year"
};


/*
|--------------------------------------------------------------------------
| BASIC HELPERS
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


const timeToMinutes = value => {
    const normalized = normalizeTime(value);

    if (!normalized) {
        return 0;
    }

    const parts = normalized.split(":");

    return (
        Number(parts[0] || 0) * 60 +
        Number(parts[1] || 0)
    );
};


const getOccupiedSet = (
    map,
    key
) => {
    return map.get(num(key)) || null;
};


const hasSlotConflict = (
    map,
    key,
    slotIds
) => {
    const occupied =
        getOccupiedSet(
            map,
            key
        );

    if (!occupied) {
        return false;
    }

    for (const slotId of slotIds) {
        if (
            occupied.has(
                num(slotId)
            )
        ) {
            return true;
        }
    }

    return false;
};


const reserveSlotIds = (
    map,
    key,
    slotIds
) => {
    key = num(key);

    let occupied =
        map.get(key);

    if (!occupied) {
        occupied = new Set();

        map.set(
            key,
            occupied
        );
    }

    for (const slotId of slotIds) {
        occupied.add(
            num(slotId)
        );
    }
};


const releaseSlotIds = (
    map,
    key,
    slotIds
) => {
    key = num(key);

    const occupied =
        map.get(key);

    if (!occupied) {
        return;
    }

    for (const slotId of slotIds) {
        occupied.delete(
            num(slotId)
        );
    }

    if (occupied.size === 0) {
        map.delete(key);
    }
};


/*
|--------------------------------------------------------------------------
| OCCUPANCY
|--------------------------------------------------------------------------
*/

const createOccupancy = () => {
    return {

        sectionSlots:
            new Map(),

        professorSlots:
            new Map(),

        roomSlots:
            new Map(),

        /*
         * sectionId -> Map(day -> occupied hourly slots)
         *
         * This prevents repeatedly scanning all section slots
         * when scoring candidates.
         */

        sectionDayLoad:
            new Map(),

        /*
         * sectionId -> total occupied slots
         */

        sectionTotalLoad:
            new Map()
    };
};


const updateSectionDayLoad = (
    occupancy,
    sectionId,
    day,
    amount
) => {
    sectionId = num(sectionId);

    let dayMap =
        occupancy.sectionDayLoad.get(
            sectionId
        );

    if (!dayMap) {
        dayMap = new Map();

        occupancy.sectionDayLoad.set(
            sectionId,
            dayMap
        );
    }

    const current =
        dayMap.get(day) || 0;

    const next =
        current + amount;

    if (next <= 0) {
        dayMap.delete(day);
    } else {
        dayMap.set(
            day,
            next
        );
    }

    if (dayMap.size === 0) {
        occupancy.sectionDayLoad.delete(
            sectionId
        );
    }
};


const getSectionDayLoad = (
    occupancy,
    sectionId,
    day
) => {
    return (
        occupancy.sectionDayLoad
            .get(num(sectionId))
            ?.get(day) || 0
    );
};


const getSectionTotalLoad = (
    occupancy,
    sectionId
) => {
    return (
        occupancy.sectionTotalLoad
            .get(num(sectionId)) || 0
    );
};


const candidateConflictMask = (
    candidate,
    occupancy
) => {
    let mask = 0;

    /*
     * 1 = section
     * 2 = professor
     * 4 = room
     */

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


const reserveAssignment = (
    assignment,
    occupancy
) => {
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

    const hours =
        assignment.slotIds.length;

    updateSectionDayLoad(
        occupancy,
        assignment.sectionId,
        assignment.day,
        hours
    );

    const sectionId =
        num(assignment.sectionId);

    occupancy.sectionTotalLoad.set(
        sectionId,
        getSectionTotalLoad(
            occupancy,
            sectionId
        ) + hours
    );
};


const releaseAssignment = (
    assignment,
    occupancy
) => {
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

    const hours =
        assignment.slotIds.length;

    updateSectionDayLoad(
        occupancy,
        assignment.sectionId,
        assignment.day,
        -hours
    );

    const sectionId =
        num(assignment.sectionId);

    const current =
        getSectionTotalLoad(
            occupancy,
            sectionId
        );

    const next =
        current - hours;

    if (next <= 0) {
        occupancy.sectionTotalLoad.delete(
            sectionId
        );
    } else {
        occupancy.sectionTotalLoad.set(
            sectionId,
            next
        );
    }
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
| SECTIONS
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

    return rows;
};


/*
|--------------------------------------------------------------------------
| STUDENT COUNT
|--------------------------------------------------------------------------
*/

const getSectionStudentCount = async (
    sectionId,
    academicTermId
) => {
    const [rows] = await db.query(`
        SELECT
            COUNT(*) AS student_count
        FROM student_sections
        WHERE section_id = ?
        AND academic_term_id = ?
    `, [
        sectionId,
        academicTermId
    ]);

    return num(
        rows[0]?.student_count || 0
    );
};


/*
|--------------------------------------------------------------------------
| SECTION SUBJECTS
|--------------------------------------------------------------------------
*/

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
            ON at.id = s.academic_term_id

        JOIN curriculum_subjects cs
            ON cs.program_id = s.program_id
            AND cs.year_level =
                CASE
                    WHEN s.year_level = 1 THEN '1st Year'
                    WHEN s.year_level = 2 THEN '2nd Year'
                    WHEN s.year_level = 3 THEN '3rd Year'
                    WHEN s.year_level = 4 THEN '4th Year'
                END
            AND cs.semester = at.semester

        JOIN subjects sub
            ON sub.id = cs.subject_id

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
| BUILD REQUIREMENTS
|--------------------------------------------------------------------------
*/

const buildRequirements = (
    subjects
) => {
    const requirements = [];

    let requirementId = 0;

    for (const subject of subjects) {

        const lectureUnits =
            num(
                subject.lecture_units || 0
            );

        const labUnits =
            num(
                subject.lab_units || 0
            );

        /*
         * 1 lecture unit = 1 hour
         */

        if (lectureUnits > 0) {

            requirements.push({

                id:
                    requirementId++,

                subject_id:
                    num(subject.subject_id),

                subject_code:
                    subject.subject_code,

                subject_name:
                    subject.subject_name,

                type:
                    "lecture",

                hours:
                    lectureUnits
            });
        }

        /*
         * 1 laboratory unit = 3 hours
         */

        if (labUnits > 0) {

            requirements.push({

                id:
                    requirementId++,

                subject_id:
                    num(subject.subject_id),

                subject_code:
                    subject.subject_code,

                subject_name:
                    subject.subject_name,

                type:
                    "laboratory",

                hours:
                    labUnits * 3
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

        id:
            num(row.id),

        day:
            row.day,

        start_time:
            normalizeTime(row.start_time),

        end_time:
            normalizeTime(row.end_time)
    }));
};


/*
|--------------------------------------------------------------------------
| GROUP SLOTS BY DAY
|--------------------------------------------------------------------------
*/

const groupSlotsByDay = (
    slots
) => {
    const map = new Map();

    for (const day of DAY_ORDER) {
        map.set(
            day,
            []
        );
    }

    for (const slot of slots) {

        if (
            !map.has(slot.day)
        ) {
            map.set(
                slot.day,
                []
            );
        }

        map.get(
            slot.day
        ).push(slot);
    }

    for (const day of map.keys()) {
        map.get(day).sort(
            (a, b) =>
                timeToMinutes(a.start_time) -
                timeToMinutes(b.start_time)
        );
    }

    return map;
};


/*
|--------------------------------------------------------------------------
| BUILD WINDOWS
|--------------------------------------------------------------------------
|
| A 3-hour requirement:
|
| 07-08
| 08-09
| 09-10
|
| becomes:
|
| 07-10
|
| IMPORTANT:
| Windows are generated for EVERY DAY.
|
| Monday
| Tuesday
| Wednesday
| Thursday
| Friday
| Saturday
| Sunday
|
| within 07:00-22:00.
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

        if (
            daySlots.length < hours
        ) {
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

                const previousEnd =
                    normalizeTime(
                        candidate[j - 1].end_time
                    );

                const currentStart =
                    normalizeTime(
                        candidate[j].start_time
                    );

                if (
                    previousEnd !==
                    currentStart
                ) {
                    consecutive = false;
                    break;
                }
            }

            if (!consecutive) {
                continue;
            }

            const startTime =
                candidate[0].start_time;

            const endTime =
                candidate[
                    candidate.length - 1
                ].end_time;

            /*
             * HARD WEEKLY DAILY BOUNDARIES
             */

            if (
                timeToMinutes(startTime) <
                timeToMinutes(SCHEDULE_START)
            ) {
                continue;
            }

            if (
                timeToMinutes(endTime) >
                timeToMinutes(SCHEDULE_END)
            ) {
                continue;
            }

            windows.push({

                day,

                slots:
                    candidate,

                slotIds:
                    candidate.map(
                        slot =>
                            num(slot.id)
                    ),

                start_time:
                    startTime,

                end_time:
                    endTime
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

    if (
        subjectIds.length === 0
    ) {
        return map;
    }

    const placeholders =
        subjectIds
            .map(() => "?")
            .join(",");

    const [rows] =
        await db.query(`
            SELECT
                ps.subject_id,

                p.id,
                p.employee_id,
                p.firstname,
                p.lastname,
                p.department

            FROM professor_subjects ps

            JOIN profesor p
                ON p.id = ps.professor_id

            WHERE ps.subject_id IN (${placeholders})

            ORDER BY
                ps.subject_id,
                p.id
        `, subjectIds);

    for (const row of rows) {

        const subjectId =
            num(row.subject_id);

        if (
            !map.has(subjectId)
        ) {
            map.set(
                subjectId,
                []
            );
        }

        map.get(subjectId).push({

            id:
                num(row.id),

            employee_id:
                row.employee_id,

            firstname:
                row.firstname,

            lastname:
                row.lastname,

            department:
                row.department
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

        id:
            num(room.id),

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

    const [rows] =
        await db.query(`
            SELECT
                cs.id,
                cs.section_id,
                cs.subject_id,
                cs.professor_id,
                cs.room_id,
                cs.time_slot_id,
                cs.academic_term_id,

                r.room_type

            FROM class_schedules cs

            JOIN rooms r
                ON r.id = cs.room_id

            WHERE cs.academic_term_id = ?
        `, [
            academicTermId
        ]);

    return rows.map(row => ({

        ...row,

        section_id:
            num(row.section_id),

        subject_id:
            num(row.subject_id),

        professor_id:
            num(row.professor_id),

        room_id:
            num(row.room_id),

        time_slot_id:
            num(row.time_slot_id)
    }));
};


/*
|--------------------------------------------------------------------------
| RESERVE EXISTING
|--------------------------------------------------------------------------
*/

const reserveExistingSchedules = (
    rows,
    occupancy,
    slotLookup
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

        /*
         * Existing section schedule also contributes
         * to weekly day balancing.
         */

        const slot =
            slotLookup.get(slotId);

        if (slot) {

            updateSectionDayLoad(
                occupancy,
                row.section_id,
                slot.day,
                1
            );

            const sectionId =
                num(row.section_id);

            occupancy.sectionTotalLoad.set(
                sectionId,
                getSectionTotalLoad(
                    occupancy,
                    sectionId
                ) + 1
            );
        }
    }
};


/*
|--------------------------------------------------------------------------
| EXISTING REQUIREMENT COUNTS
|--------------------------------------------------------------------------
*/

const getExistingRequirementCounts = (
    existingRows
) => {

    const map = new Map();

    for (const row of existingRows) {

        const sectionId =
            num(row.section_id);

        const subjectId =
            num(row.subject_id);

        if (
            !map.has(sectionId)
        ) {
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
            (
                sectionMap.get(key) || 0
            ) + 1
        );
    }

    return map;
};


/*
|--------------------------------------------------------------------------
| MISSING REQUIREMENTS
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| SECTION STATUS
|--------------------------------------------------------------------------
*/

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
            count >= requirement.hours
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
| RESOURCE LOAD
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


/*
|--------------------------------------------------------------------------
| VALID ROOMS
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

    return rooms.filter(room => {

        if (
            room.room_type !==
            requiredType
        ) {
            return false;
        }

        if (
            room.capacity <
            num(section.student_count)
        ) {
            return false;
        }

        return true;
    });
};


/*
|--------------------------------------------------------------------------
| CREATE CANDIDATE
|--------------------------------------------------------------------------
*/

const makeCandidate = (
    section,
    requirement,
    professor,
    room,
    window
) => {

    return {

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

        start_time:
            window.start_time,

        end_time:
            window.end_time,

        studentCount:
            num(section.student_count),

        roomWaste:
            room.capacity -
            num(section.student_count)
    };
};


/*
|--------------------------------------------------------------------------
| CANDIDATE SCORE
|--------------------------------------------------------------------------
|
| IMPORTANT CHANGE:
|
| OLD:
| Monday = always preferred.
|
| NEW:
| The scheduler prefers the DAY WITH LESS LOAD
| for this section.
|
| This distributes subjects across the whole week.
|--------------------------------------------------------------------------
*/

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

    /*
     * Professor scarcity remains important.
     */

    const scarcityPenalty =
        professorCount <= 1
            ? 100000
            : professorCount <= 2
                ? 30000
                : professorCount <= 3
                    ? 10000
                    : 0;

    /*
     * WEEKLY BALANCING
     */

    const dayLoad =
        getSectionDayLoad(
            occupancy,
            candidate.sectionId,
            candidate.day
        );

    /*
     * Strongly discourage stacking
     * everything on the same day.
     */

    const dayBalancePenalty =
        dayLoad * 8000;

    /*
     * If two days have equal load,
     * spread toward the day with the
     * lower index only slightly.
     *
     * This is NOT a strong Monday preference.
     */

    const dayIndex =
        DAY_ORDER.indexOf(
            candidate.day
        );

    const tinyDayTieBreaker =
        dayIndex * 0.01;

    /*
     * Avoid wasting large rooms.
     */

    const roomWaste =
        candidate.room.capacity -
        num(candidate.studentCount);

    /*
     * Slightly prefer earlier time within
     * the selected day.
     */

    const startMinute =
        timeToMinutes(
            candidate.start_time
        );

    return (
        dayBalancePenalty +
        professorLoad * 10000 +
        roomLoad * 1000 +
        scarcityPenalty +
        roomWaste * 5 +
        startMinute * 0.01 +
        tinyDayTieBreaker
    );
};


/*
|--------------------------------------------------------------------------
| LAZY CANDIDATE GENERATOR
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

    const candidates = [];

    const validRooms =
        getValidRooms(
            requirement,
            section,
            rooms
        );

    if (
        validRooms.length === 0
    ) {

        return {
            candidates,
            totalValid: 0
        };
    }

    /*
     * Smaller adequate rooms first.
     */

    const sortedRooms =
        [...validRooms].sort(
            (a, b) => {

                const capacityDifference =
                    a.capacity -
                    b.capacity;

                if (
                    capacityDifference !== 0
                ) {
                    return capacityDifference;
                }

                return a.id - b.id;
            }
        );

    let totalValid = 0;

    /*
     * IMPORTANT:
     *
     * Windows are already ordered Monday-Sunday,
     * but the candidate SCORE decides which
     * candidates actually survive.
     */

    for (
        const window
        of windows
    ) {

        /*
         * Section conflict can reject the
         * entire window immediately.
         */

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
            of professors
        ) {

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
                of sortedRooms
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

                const candidate =
                    makeCandidate(
                        section,
                        requirement,
                        professor,
                        room,
                        window
                    );

                totalValid++;

                /*
                 * Keep only the best candidates.
                 */

                if (
                    candidates.length <
                    limit
                ) {

                    candidates.push(
                        candidate
                    );

                } else {

                    let worstIndex = 0;

                    let worstScore =
                        scoreCandidate(
                            candidates[0],
                            occupancy,
                            requirement,
                            professorMap
                        );

                    for (
                        let i = 1;
                        i < candidates.length;
                        i++
                    ) {

                        const currentScore =
                            scoreCandidate(
                                candidates[i],
                                occupancy,
                                requirement,
                                professorMap
                            );

                        if (
                            currentScore >
                            worstScore
                        ) {

                            worstScore =
                                currentScore;

                            worstIndex =
                                i;
                        }
                    }

                    const newScore =
                        scoreCandidate(
                            candidate,
                            occupancy,
                            requirement,
                            professorMap
                        );

                    if (
                        newScore <
                        worstScore
                    ) {

                        candidates[
                            worstIndex
                        ] = candidate;
                    }
                }
            }
        }
    }

    candidates.sort(
        (a, b) =>
            scoreCandidate(
                a,
                occupancy,
                requirement,
                professorMap
            )
            -
            scoreCandidate(
                b,
                occupancy,
                requirement,
                professorMap
            )
    );

    return {

        candidates,

        totalValid
    };
};


/*
|--------------------------------------------------------------------------
| REQUIREMENT WINDOWS
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
| REQUIREMENT FLEXIBILITY
|--------------------------------------------------------------------------
*/

const estimateRequirementFlexibility = ({
    section,
    requirement,
    windowsByHours,
    professorMap,
    rooms,
    occupancy
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

    if (
        windows.length === 0 ||
        professors.length === 0
    ) {
        return 0;
    }

    const validRooms =
        getValidRooms(
            requirement,
            section,
            rooms
        );

    if (
        validRooms.length === 0
    ) {
        return 0;
    }

    let valid = 0;
    let scanned = 0;

    /*
     * Sample rather than scanning every combination.
     */

    outer:
    for (
        const window
        of windows
    ) {

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
            of professors
        ) {

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
                }

                if (
                    scanned >=
                    MAX_MRV_CANDIDATE_SCAN
                ) {
                    break outer;
                }
            }
        }
    }

    return valid;
};


/*
|--------------------------------------------------------------------------
| SELECT MRV
|--------------------------------------------------------------------------
*/

const selectMRVRequirement = ({
    section,
    requirements,
    assignedIds,
    windowsByHours,
    professorMap,
    rooms,
    occupancy
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

                occupancy
            });

        if (
            flexibility === 0
        ) {

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

        requirement:
            selected,

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
    occupancy
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

                occupancy
            });

        if (
            flexibility === 0
        ) {
            return false;
        }
    }

    return true;
};


/*
|--------------------------------------------------------------------------
| GREEDY SOLVER
|--------------------------------------------------------------------------
*/

const solveGreedy = ({
    section,
    requirements,
    windowsByHours,
    professorMap,
    rooms,
    occupancy
}) => {

    console.log(
        `[GREEDY] Starting ${section.section_name}`
    );

    const assignments = [];

    const assignedIds =
        new Set();

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

                occupancy
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
                    selected.requirement || null
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
                    GREEDY_MAX_ATTEMPTS_PER_REQUIREMENT
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

        /*
         * BEST candidate after weekly balancing.
         */

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

        assignments.push(
            candidate
        );

        assignedIds.add(
            requirement.id
        );

        console.log(
            `[GREEDY] ${section.section_name} | ` +
            `${requirement.subject_code} ` +
            `${requirement.type} | ` +
            `${candidate.day} ` +
            `${candidate.start_time}-` +
            `${candidate.end_time} | ` +
            `${candidate.room.room_name} | ` +
            `${candidate.professor.firstname} ` +
            `${candidate.professor.lastname}`
        );
    }

    return {

        success: true,

        assignments
    };
};


/*
|--------------------------------------------------------------------------
| BACKTRACK SOLVER
|--------------------------------------------------------------------------
*/

const solveBacktracking = ({
    section,
    requirements,
    windowsByHours,
    professorMap,
    rooms,
    occupancy
}) => {

    console.log(
        `[BACKTRACK] Starting ${section.section_name}`
    );

    const start =
        Date.now();

    let nodes = 0;

    let timeout = false;

    let nodeLimit = false;

    const assignments = [];

    const assignedIds =
        new Set();


    const backtrack = () => {

        nodes++;

        if (
            Date.now() - start >=
            MAX_TIME_MS_PER_SECTION
        ) {

            timeout = true;

            return false;
        }

        if (
            nodes >
            MAX_BACKTRACK_NODES_PER_SECTION
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

                occupancy
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
                    BACKTRACK_MAX_CANDIDATES_PER_REQUIREMENT
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

                    occupancy
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
        }

        return false;
    };


    const success =
        backtrack();

    if (
        !success
    ) {

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
| HYBRID SOLVER
|--------------------------------------------------------------------------
*/

const solveHybrid = async ({
    section,
    requirements,
    windowsByHours,
    professorMap,
    rooms,
    occupancy
}) => {

    console.log(
        `\n[HYBRID] Solving ` +
        `${section.section_name}`
    );

    /*
     * FAST PATH
     */

    const greedy =
        solveGreedy({

            section,

            requirements,

            windowsByHours,

            professorMap,

            rooms,

            occupancy
        });

    if (
        greedy.success
    ) {

        console.log(
            `[HYBRID] Greedy succeeded for ` +
            `${section.section_name}`
        );

        return {

            success: true,

            method: "GREEDY",

            assignments:
                greedy.assignments,

            nodes: 0,

            elapsed: 0
        };
    }

    /*
     * Greedy already rolled back.
     */

    console.log(
        `[HYBRID] Greedy failed for ` +
        `${section.section_name}`
    );

    /*
     * EXPENSIVE PATH
     */

    const backtrack =
        solveBacktracking({

            section,

            requirements,

            windowsByHours,

            professorMap,

            rooms,

            occupancy
        });

    console.log(
        `[BACKTRACK] ${section.section_name} | ` +
        `success=${backtrack.success} | ` +
        `nodes=${backtrack.nodes} | ` +
        `time=${backtrack.elapsed}ms`
    );

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
| BOTTLENECK ANALYSIS
|--------------------------------------------------------------------------
*/

const analyzeRequirement = ({
    section,
    requirement,
    windowsByHours,
    professorMap,
    rooms,
    occupancy
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

    let roomBlocked = 0;

    let sectionBlocked = 0;

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

                const roomConflict =
                    hasSlotConflict(
                        occupancy.roomSlots,
                        room.id,
                        window.slotIds
                    );

                if (
                    !sectionConflict &&
                    !profConflict &&
                    !roomConflict
                ) {

                    available++;

                    continue;
                }

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
                    roomConflict
                ) {
                    roomBlocked++;
                }
            }
        }
    }

    let bottleneck =
        "MULTIPLE RESOURCES";

    if (
        available > 0
    ) {

        bottleneck =
            "COMBINATION / BACKTRACKING CONSTRAINT";

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

        roomBlocked,

        sectionBlocked,

        bottleneck
    };
};


/*
|--------------------------------------------------------------------------
| SAVE SECTION
|--------------------------------------------------------------------------
*/

const saveSectionSchedules = async (
    assignments,
    academicTermId
) => {

    if (
        assignments.length === 0
    ) {
        return;
    }

    await db.query(
        "START TRANSACTION"
    );

    try {

        for (
            const assignment
            of assignments
        ) {

            for (
                const slot
                of assignment.window.slots
            ) {

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
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [

                    assignment.sectionId,

                    assignment.requirement
                        .subject_id,

                    assignment.professorId,

                    assignment.roomId,

                    num(slot.id),

                    academicTermId
                ]);
            }
        }

        await db.query(
            "COMMIT"
        );

    } catch (error) {

        await db.query(
            "ROLLBACK"
        );

        throw error;
    }
};


/*
|--------------------------------------------------------------------------
| GENERATE SCHEDULES
|--------------------------------------------------------------------------
*/

const generateSchedules = async (
    req
) => {

    const {
        programId,
        academicTermId
    } = req.body;

    if (
        !programId ||
        !academicTermId
    ) {

        throw new Error(
            "programId and academicTermId are required."
        );
    }

    console.log(
        "\n========================================"
    );

    console.log(
        "BALANCED WEEKLY RESOURCE-AWARE SCHEDULER"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Program: ${programId}`
    );

    console.log(
        `Academic Term: ${academicTermId}`
    );

    console.log(
        "Scheduling range: Monday 07:00 → Sunday 22:00"
    );


    /*
     * --------------------------------------------------------------
     * LOAD SECTIONS
     * --------------------------------------------------------------
     */

    const sections =
        await getSections(
            programId,
            academicTermId
        );

    if (
        sections.length === 0
    ) {

        throw new Error(
            "No sections found for selected program."
        );
    }

    console.log(
        `Total sections: ${sections.length}`
    );


    /*
     * --------------------------------------------------------------
     * TIME SLOTS
     * --------------------------------------------------------------
     */

    const timeSlots =
        await getTimeSlots();

    if (
        timeSlots.length === 0
    ) {

        throw new Error(
            "No available time slots."
        );
    }

    const slotsByDay =
        groupSlotsByDay(
            timeSlots
        );

    const slotLookup =
        new Map();

    for (
        const slot
        of timeSlots
    ) {

        slotLookup.set(
            num(slot.id),
            slot
        );
    }

    console.log(
        `Available time slots: ${timeSlots.length}`
    );

    for (
        const day
        of DAY_ORDER
    ) {

        console.log(
            `[DAY] ${day}: ` +
            `${(slotsByDay.get(day) || []).length} slots`
        );
    }


    /*
     * --------------------------------------------------------------
     * ROOMS
     * --------------------------------------------------------------
     */

    const rooms =
        await getRooms();

    if (
        rooms.length === 0
    ) {

        throw new Error(
            "No available rooms."
        );
    }

    console.log(
        `Available rooms: ${rooms.length}`
    );


    /*
     * --------------------------------------------------------------
     * EXISTING SCHEDULES
     * --------------------------------------------------------------
     */

    const existingSchedules =
        await loadExistingSchedules(
            academicTermId
        );

    console.log(
        `Existing schedule rows: ` +
        `${existingSchedules.length}`
    );


    /*
     * --------------------------------------------------------------
     * GLOBAL OCCUPANCY
     * --------------------------------------------------------------
     */

    const occupancy =
        createOccupancy();

    reserveExistingSchedules(
        existingSchedules,
        occupancy,
        slotLookup
    );


    /*
     * --------------------------------------------------------------
     * EXISTING REQUIREMENT COUNTS
     * --------------------------------------------------------------
     */

    const existingRequirementCounts =
        getExistingRequirementCounts(
            existingSchedules
        );


    /*
     * --------------------------------------------------------------
     * PREPARE SECTIONS
     * --------------------------------------------------------------
     */

    const preparedSections = [];

    const allSubjectIds =
        new Set();

    for (
        const section
        of sections
    ) {

        section.student_count =
            await getSectionStudentCount(
                section.id,
                academicTermId
            );

        section.subjects =
            await getSectionSubjects(
                section.id,
                academicTermId
            );

        if (
            section.subjects.length === 0
        ) {

            console.log(
                `[SKIP] ${section.section_name} ` +
                `has no subjects`
            );

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

            console.log(
                `[LOCKED] ${section.section_name} ` +
                `already complete`
            );

            continue;
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


    /*
     * --------------------------------------------------------------
     * NOTHING TO DO
     * --------------------------------------------------------------
     */

    if (
        preparedSections.length === 0
    ) {

        return {

            success: true,

            partial: false,

            programId,

            academicTermId,

            sectionCount:
                sections.length,

            newSections: 0,

            scheduledSections: 0,

            failedSections: 0,

            scheduled: [],

            failed: [],

            schedules: [],

            message:
                "All sections already have complete schedules."
        };
    }


    /*
     * --------------------------------------------------------------
     * PROFESSORS
     * --------------------------------------------------------------
     */

    const professorMap =
        await getProfessorMap(
            [...allSubjectIds]
        );


    /*
     * --------------------------------------------------------------
     * BUILD WINDOWS ONCE
     * --------------------------------------------------------------
     */

    const uniqueHours =
        [
            ...new Set(
                preparedSections.flatMap(
                    section =>
                        section.missingRequirements.map(
                            requirement =>
                                num(
                                    requirement.remainingHours ||
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

        const windows =
            buildWindows(
                slotsByDay,
                hours
            );

        windowsByHours.set(
            hours,
            windows
        );

        console.log(
            `[WINDOWS] ${hours}-hour: ` +
            `${windows.length}`
        );
    }


    /*
     * --------------------------------------------------------------
     * SECTION ORDERING
     * --------------------------------------------------------------
     *
     * Harder sections first.
     *
     * IMPORTANT:
     * We only calculate flexibility once here.
     */

    const sectionJobs =
        preparedSections.map(
            section => {

                let difficulty = 0;

                for (
                    const requirement
                    of section.missingRequirements
                ) {

                    const flexibility =
                        estimateRequirementFlexibility({

                            section,

                            requirement,

                            windowsByHours,

                            professorMap,

                            rooms,

                            occupancy
                        });

                    /*
                     * Lower flexibility =
                     * harder.
                     */

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


    console.log(
        "\n========================================"
    );

    console.log(
        "SECTION SOLVING ORDER"
    );

    console.log(
        "========================================"
    );

    sectionJobs.forEach(
        (job, index) => {

            console.log(
                `${index + 1}. ` +
                `${job.section.section_name} ` +
                `difficulty=${job.difficulty}`
            );
        }
    );


    /*
     * --------------------------------------------------------------
     * RESULTS
     * --------------------------------------------------------------
     */

    const scheduledSections = [];

    const failedSections = [];

    const generatedSchedules = [];


    /*
     * --------------------------------------------------------------
     * SOLVE
     * --------------------------------------------------------------
     */

    for (
        let index = 0;
        index < sectionJobs.length;
        index++
    ) {

        const job =
            sectionJobs[index];

        const section =
            job.section;

        console.log(
            "\n========================================"
        );

        console.log(
            `[SECTION ${index + 1}/` +
            `${sectionJobs.length}] ` +
            `${section.section_name}`
        );

        console.log(
            `Students: ${section.student_count}`
        );

        console.log(
            `Requirements: ` +
            `${section.missingRequirements.length}`
        );

        console.log(
            "========================================"
        );


        /*
         * ----------------------------------------------------------
         * SOLVE
         * ----------------------------------------------------------
         */

        const result =
            await solveHybrid({

                section,

                requirements:
                    section.missingRequirements,

                windowsByHours,

                professorMap,

                rooms,

                occupancy
            });


        /*
         * ----------------------------------------------------------
         * SUCCESS
         * ----------------------------------------------------------
         */

        if (
            result.success
        ) {

            try {

                /*
                 * IMPORTANT:
                 *
                 * Do NOT release these assignments.
                 *
                 * They become global reservations for
                 * subsequent sections.
                 */

                await saveSectionSchedules(
                    result.assignments,
                    academicTermId
                );

                scheduledSections.push(
                    section.section_name
                );

                for (
                    const assignment
                    of result.assignments
                ) {

                    generatedSchedules.push({

                        section:
                            section.section_name,

                        sectionId:
                            section.id,

                        yearLevel:
                            section.year_level,

                        subject:
                            assignment.requirement
                                .subject_code,

                        subjectId:
                            assignment.requirement
                                .subject_id,

                        type:
                            assignment.requirement
                                .type,

                        professor:
                            `${assignment.professor.firstname} ${assignment.professor.lastname}`,

                        professorId:
                            assignment.professorId,

                        room:
                            assignment.room.room_name,

                        roomId:
                            assignment.roomId,

                        roomType:
                            assignment.room.room_type,

                        day:
                            assignment.day,

                        start:
                            assignment.start_time,

                        end:
                            assignment.end_time
                    });
                }

                console.log(
                    `[RESULT] ${section.section_name} | ` +
                    `success=true | ` +
                    `method=${result.method}`
                );

                console.log(
                    `[SAVED] ${section.section_name} ✅`
                );

            } catch (saveError) {

                /*
                 * DB failed.
                 *
                 * Release the reservations because
                 * they were not successfully persisted.
                 */

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
                        `Database save failed: ` +
                        saveError.message,

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
         * ----------------------------------------------------------
         * FAILURE ANALYSIS
         * ----------------------------------------------------------
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

                    occupancy
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
                analysis.availableCandidates === 0
            ) {
                score += 100000;
            }

            score +=
                analysis.professorBlocked;

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

                ? `Unable to schedule ` +
                  `${worst.subjectCode} ` +
                  `${worst.type}. ` +
                  `Likely bottleneck: ` +
                  `${worst.bottleneck}.`

                : `Unable to find a valid ` +
                  `schedule for section ` +
                  `${section.section_name}.`;


        console.log(
            `[FAILED] ${section.section_name} ❌`
        );

        console.log(
            `[FAILED] ${reason}`
        );


        if (worst) {

            console.log(
                `[ANALYSIS] ${worst.subjectCode} ` +
                `${worst.type}`
            );

            console.log(
                `  windows=${worst.windows}`
            );

            console.log(
                `  professors=${worst.professors}`
            );

            console.log(
                `  validRooms=${worst.validRooms}`
            );

            console.log(
                `  available=${worst.availableCandidates}`
            );

            console.log(
                `  professorBlocked=${worst.professorBlocked}`
            );

            console.log(
                `  roomBlocked=${worst.roomBlocked}`
            );

            console.log(
                `  sectionBlocked=${worst.sectionBlocked}`
            );
        }


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
    }


    /*
     * --------------------------------------------------------------
     * FINAL STATUS
     * --------------------------------------------------------------
     */

    const completeSuccess =
        failedSections.length === 0;

    const partial =
        scheduledSections.length > 0 &&
        failedSections.length > 0;


    /*
     * --------------------------------------------------------------
     * BOTTLENECK SUMMARY
     * --------------------------------------------------------------
     */

    const bottleneckSummary = {

        professor: 0,

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
            bottleneck === "PROFESSOR"
        ) {

            bottleneckSummary.professor++;

        } else if (
            bottleneck === "ROOM"
        ) {

            bottleneckSummary.room++;

        } else if (
            bottleneck === "SECTION/TIMESLOT"
        ) {

            bottleneckSummary.sectionTimeslot++;

        } else if (
            bottleneck ===
            "MULTIPLE RESOURCES"
        ) {

            bottleneckSummary.multipleResources++;

        } else if (
            bottleneck ===
            "COMBINATION / BACKTRACKING CONSTRAINT"
        ) {

            bottleneckSummary.combination++;

        } else if (
            failed.failureType ===
            "SEARCH_TIMEOUT"
        ) {

            bottleneckSummary.searchTimeout++;

        } else if (
            failed.failureType ===
            "NODE_LIMIT"
        ) {

            bottleneckSummary.nodeLimit++;

        } else {

            bottleneckSummary.unknown++;
        }
    }


    /*
     * --------------------------------------------------------------
     * FINAL LOG
     * --------------------------------------------------------------
     */

    console.log(
        "\n========================================"
    );

    console.log(
        "SCHEDULER FINISHED"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Scheduling range: ` +
        `Monday 07:00 → Sunday 22:00`
    );

    console.log(
        `Success: ${completeSuccess}`
    );

    console.log(
        `Partial: ${partial}`
    );

    console.log(
        `Total sections: ${sections.length}`
    );

    console.log(
        `Scheduled: ${scheduledSections.length}`
    );

    console.log(
        `Failed: ${failedSections.length}`
    );


    console.log(
        "\nBOTTLENECK SUMMARY"
    );

    console.log(
        `Professor: ` +
        `${bottleneckSummary.professor}`
    );

    console.log(
        `Room: ` +
        `${bottleneckSummary.room}`
    );

    console.log(
        `Section/Timeslot: ` +
        `${bottleneckSummary.sectionTimeslot}`
    );

    console.log(
        `Multiple resources: ` +
        `${bottleneckSummary.multipleResources}`
    );

    console.log(
        `Combination: ` +
        `${bottleneckSummary.combination}`
    );

    console.log(
        `Search timeout: ` +
        `${bottleneckSummary.searchTimeout}`
    );

    console.log(
        `Node limit: ` +
        `${bottleneckSummary.nodeLimit}`
    );


    /*
     * --------------------------------------------------------------
     * RESPONSE
     * --------------------------------------------------------------
     */

    return {

        success:
            completeSuccess,

        partial,

        programId,

        academicTermId,

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

        schedules:
            generatedSchedules,

        simulation: {

            algorithm:
                "BALANCED_WEEKLY_HYBRID_LAZY_MRV_BACKTRACK",

            scheduleStart:
                "Monday 07:00",

            scheduleEnd:
                "Sunday 22:00",

            days:
                DAY_ORDER,

            maxBacktrackNodesPerSection:
                MAX_BACKTRACK_NODES_PER_SECTION,

            maxTimeMsPerSection:
                MAX_TIME_MS_PER_SECTION,

            greedyAttemptsPerRequirement:
                GREEDY_MAX_ATTEMPTS_PER_REQUIREMENT,

            backtrackCandidatesPerRequirement:
                BACKTRACK_MAX_CANDIDATES_PER_REQUIREMENT,

            totalRooms:
                rooms.length,

            lectureRooms:
                rooms.filter(
                    r =>
                        r.room_type ===
                        "lecture"
                ).length,

            laboratoryRooms:
                rooms.filter(
                    r =>
                        r.room_type ===
                        "laboratory"
                ).length,

            existingScheduleRows:
                existingSchedules.length,

            totalTimeSlots:
                timeSlots.length
        },

        message:
            completeSuccess

                ? `All incomplete sections were ` +
                  `scheduled successfully.`

                : partial

                    ? `Schedule generation partially ` +
                      `completed. ` +
                      `${scheduledSections.length} ` +
                      `section(s) scheduled and ` +
                      `${failedSections.length} ` +
                      `section(s) failed.`

                    : `No incomplete sections could ` +
                      `be scheduled.`
    };
};


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {

    generateSchedules,

    getSectionSubjects,

    buildRequirements,

    getSections
};