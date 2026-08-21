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
 * Scheduler philosophy:
 *
 * 1. Existing schedules become global reservations.
 * 2. Sections are solved one at a time.
 * 3. Scarce professors/rooms are preferred intelligently.
 * 4. Classes of the SAME SECTION are distributed across the week.
 * 5. A section is NOT considered occupied for the entire day.
 * 6. Only actual assigned time slots are reserved.
 * 7. Greedy attempts the best candidates first.
 * 8. If greedy fails, temporary reservations are rolled back.
 * 9. Bounded backtracking starts from a clean state.
 * 10. Candidate objects are generated lazily.
 *
 * IMPORTANT:
 *
 * The scheduler assumes the time_slots table contains the actual
 * available university hours.
 *
 * For your desired setup:
 *
 * Monday    7:00 AM - 10:00 PM
 * Tuesday   7:00 AM - 10:00 PM
 * Wednesday 7:00 AM - 10:00 PM
 * Thursday  7:00 AM - 10:00 PM
 * Friday    7:00 AM - 10:00 PM
 * Saturday  7:00 AM - 10:00 PM
 * Sunday    7:00 AM - 10:00 PM
 *
 * The scheduler does NOT reserve 7 AM - 10 PM automatically.
 * It only reserves the actual selected time slots.
 */

const MAX_BACKTRACK_NODES_PER_SECTION = 50000;
const MAX_TIME_MS_PER_SECTION = 8000;

const GREEDY_MAX_ATTEMPTS_PER_REQUIREMENT = 250;
const BACKTRACK_MAX_CANDIDATES_PER_REQUIREMENT = 250;

const MAX_MRV_CANDIDATE_SCAN = 500;


/*
|--------------------------------------------------------------------------
| SECTION DAY DISTRIBUTION CONFIG
|--------------------------------------------------------------------------
*/

/*
 * Desired maximum daily academic hours before the scheduler
 * starts applying a strong penalty.
 *
 * This is NOT a hard limit.
 *
 * Example:
 *
 * 6 hours = acceptable
 * 7 hours = possible but strongly discouraged
 * 8 hours = heavily discouraged
 * 9+ hours = very heavily discouraged
 */
const SECTION_TARGET_DAILY_HOURS = 6;

/*
 * Strongly encourage using a new day instead of stacking
 * more classes on an already-used day.
 */
const NEW_DAY_BONUS = 25000;

/*
 * Penalty for already having hours on the same day.
 *
 * Quadratic means:
 *
 * 1 hour  -> small
 * 3 hours -> larger
 * 6 hours -> much larger
 * 9 hours -> extremely large
 */
const SECTION_DAY_LOAD_WEIGHT = 5000;

/*
 * Additional penalty after the target daily workload.
 */
const SECTION_LONG_DAY_WEIGHT = 15000;


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

    for (
        const slotId
        of slotIds
    ) {

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

    for (
        const slotId
        of slotIds
    ) {

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

    for (
        const slotId
        of slotIds
    ) {

        occupied.delete(
            num(slotId)
        );
    }

    if (
        occupied.size === 0
    ) {

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

        /*
         * Actual occupied time slots of a section.
         *
         * sectionId -> Set(slotId)
         */
        sectionSlots:
            new Map(),

        /*
         * Actual occupied time slots of professors.
         *
         * professorId -> Set(slotId)
         */
        professorSlots:
            new Map(),

        /*
         * Actual occupied time slots of rooms.
         *
         * roomId -> Set(slotId)
         */
        roomSlots:
            new Map(),

        /*
         * Number of scheduled hours per SECTION per DAY.
         *
         * sectionId -> Map(day -> hours)
         *
         * Example:
         *
         * 10 -> {
         *     Monday: 3,
         *     Tuesday: 2,
         *     Wednesday: 3
         * }
         */
        sectionDayHours:
            new Map()
    };
};


/*
|--------------------------------------------------------------------------
| SECTION DAY LOAD
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
        (
            sectionMap.get(day) || 0
        ) + num(hours)
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

    if (
        next <= 0
    ) {

        sectionMap.delete(day);

    } else {

        sectionMap.set(
            day,
            next
        );
    }

    if (
        sectionMap.size === 0
    ) {

        occupancy.sectionDayHours.delete(
            sectionId
        );
    }
};


const getSectionTotalScheduledHours = (
    occupancy,
    sectionId
) => {

    const sectionMap =
        occupancy.sectionDayHours.get(
            num(sectionId)
        );

    if (!sectionMap) {
        return 0;
    }

    let total = 0;

    for (
        const hours
        of sectionMap.values()
    ) {

        total += hours;
    }

    return total;
};


const getSectionUsedDayCount = (
    occupancy,
    sectionId
) => {

    const sectionMap =
        occupancy.sectionDayHours.get(
            num(sectionId)
        );

    if (!sectionMap) {
        return 0;
    }

    return sectionMap.size;
};


/*
|--------------------------------------------------------------------------
| CANDIDATE CONFLICT
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| RESERVE ASSIGNMENT
|--------------------------------------------------------------------------
*/

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


    /*
     * IMPORTANT:
     *
     * Only the actual assignment hours are added.
     *
     * Example:
     *
     * Monday 8-10
     *
     * adds only 2 hours to Monday.
     *
     * It does NOT make the section occupied
     * from 7 AM until 10 PM.
     */
    addSectionDayHours(
        occupancy,
        assignment.sectionId,
        assignment.day,
        assignment.slotIds.length
    );
};


/*
|--------------------------------------------------------------------------
| RELEASE ASSIGNMENT
|--------------------------------------------------------------------------
*/

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


    removeSectionDayHours(
        occupancy,
        assignment.sectionId,
        assignment.day,
        assignment.slotIds.length
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
| SECTIONS
|--------------------------------------------------------------------------
*/

const getSections = async (
    programId,
    academicTermId
) => {

    const [rows] =
        await db.query(`
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

    const [rows] =
        await db.query(`
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

    const [rows] =
        await db.query(`
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


    for (
        const subject
        of subjects
    ) {

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

        if (
            lectureUnits > 0
        ) {

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

        if (
            labUnits > 0
        ) {

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

    const [rows] =
        await db.query(`
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
| GROUP TIME SLOTS
|--------------------------------------------------------------------------
*/

const groupSlotsByDay = (
    slots
) => {

    const map = new Map();


    for (
        const day
        of DAY_ORDER
    ) {

        map.set(
            day,
            []
        );
    }


    for (
        const slot
        of slots
    ) {

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


    return map;
};


/*
|--------------------------------------------------------------------------
| BUILD WINDOWS
|--------------------------------------------------------------------------
|
| A 3-hour class becomes 3 consecutive hourly slots.
|
| A 6-hour laboratory becomes 6 consecutive hourly slots.
|
| This remains ONE atomic assignment.
|
| The scheduler can choose any valid day from Monday-Sunday.
|
|--------------------------------------------------------------------------
*/

const buildWindows = (
    slotsByDay,
    hours
) => {

    hours = num(hours);

    const windows = [];


    if (
        hours <= 0
    ) {

        return windows;
    }


    for (
        const day
        of DAY_ORDER
    ) {

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


            let consecutive =
                true;


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


            if (
                !consecutive
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


    for (
        const row
        of rows
    ) {

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

    const [rows] =
        await db.query(`
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

                ts.day,

                r.room_type

            FROM class_schedules cs

            JOIN rooms r
                ON r.id = cs.room_id

            JOIN time_slots ts
                ON ts.id = cs.time_slot_id

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
    occupancy
) => {

    for (
        const row
        of rows
    ) {

        const slotId =
            num(row.time_slot_id);


        /*
         * Actual section reservation.
         */
        reserveSlotIds(
            occupancy.sectionSlots,
            row.section_id,
            [slotId]
        );


        /*
         * Actual professor reservation.
         */
        reserveSlotIds(
            occupancy.professorSlots,
            row.professor_id,
            [slotId]
        );


        /*
         * Actual room reservation.
         */
        reserveSlotIds(
            occupancy.roomSlots,
            row.room_id,
            [slotId]
        );


        /*
         * Existing schedule contributes one hour
         * to the section's daily workload.
         */
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

const getExistingRequirementCounts = (
    existingRows
) => {

    const map = new Map();


    for (
        const row
        of existingRows
    ) {

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
| PROFESSOR SCARCITY
|--------------------------------------------------------------------------
*/

const getProfessorScarcity = (
    professor,
    requirement,
    professorMap
) => {

    const list =
        professorMap.get(
            num(requirement.subject_id)
        ) || [];


    /*
     * Fewer professors = more scarce.
     */

    return Math.max(
        1,
        100 - list.length * 10
    );
};


/*
|--------------------------------------------------------------------------
| CANDIDATE SCORE
|--------------------------------------------------------------------------
|
| LOWER = BETTER
|
| Major priorities:
|
| 1. Avoid professor conflicts.
| 2. Avoid room conflicts.
| 3. Prefer scarce professors.
| 4. Prefer appropriately sized rooms.
| 5. DISTRIBUTE SECTION CLASSES ACROSS DAYS.
| 6. Avoid very long days.
|
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


    const scarcityPenalty =
        professorCount <= 1
            ? 100000
            : professorCount <= 2
                ? 30000
                : professorCount <= 3
                    ? 10000
                    : 0;


    /*
     * Prefer smaller adequate rooms.
     */
    const roomWaste =
        candidate.room.capacity -
        num(candidate.studentCount);


    const dayIndex =
        DAY_ORDER.indexOf(
            candidate.day
        );


    /*
     |--------------------------------------------------------------------------
     | SECTION DAY DISTRIBUTION
     |--------------------------------------------------------------------------
     */

    const existingDayHours =
        getSectionDayHours(
            occupancy,
            candidate.sectionId,
            candidate.day
        );


    const assignmentHours =
        candidate.slotIds.length;


    const projectedDayHours =
        existingDayHours +
        assignmentHours;


    /*
     * Number of days already used by this section.
     */
    const usedDayCount =
        getSectionUsedDayCount(
            occupancy,
            candidate.sectionId
        );


    /*
     * New-day bonus.
     *
     * If the section has not used this day yet,
     * strongly prefer it.
     *
     * This is what causes classes to spread
     * across Monday-Sunday instead of stacking
     * everything on Monday.
     */
    const newDayBonus =
        existingDayHours === 0
            ? -NEW_DAY_BONUS
            : 0;


    /*
     * Quadratic day-load penalty.
     *
     * Example:
     *
     * 1 hour  -> 5,000
     * 2 hours -> 20,000
     * 3 hours -> 45,000
     * 6 hours -> 180,000
     *
     * This heavily discourages stacking.
     */
    const sectionDayLoadPenalty =
        Math.pow(
            existingDayHours,
            2
        ) *
        SECTION_DAY_LOAD_WEIGHT;


    /*
     * Long-day penalty.
     *
     * Up to 6 hours/day is relatively acceptable.
     *
     * Beyond 6 hours gets increasingly expensive.
     */
    const excessDailyHours =
        Math.max(
            0,
            projectedDayHours -
            SECTION_TARGET_DAILY_HOURS
        );


    const longDayPenalty =
        excessDailyHours > 0
            ? Math.pow(
                excessDailyHours,
                2
            ) *
            SECTION_LONG_DAY_WEIGHT
            : 0;


    /*
     * Small balancing bonus for using more days.
     *
     * We don't make this stronger than hard resource
     * constraints, because professor/room availability
     * must still win when necessary.
     */
    const spreadBonus =
        usedDayCount < DAY_ORDER.length &&
        existingDayHours === 0
            ? -Math.min(
                10000,
                usedDayCount * 1000
            )
            : 0;


    return (

        /*
         * Professor utilization.
         */
        professorLoad * 10000

        +

        /*
         * Room utilization.
         */
        roomLoad * 1000

        +

        /*
         * Scarce professor protection.
         */
        scarcityPenalty

        +

        /*
         * Avoid excessive room capacity waste.
         */
        roomWaste * 5

        +

        /*
         * Strong section-day distribution.
         */
        sectionDayLoadPenalty

        +

        /*
         * Strong penalty for long days.
         */
        longDayPenalty

        +

        /*
         * Prefer unused days.
         */
        newDayBonus

        +

        /*
         * Additional spread preference.
         */
        spreadBonus

        +

        /*
         * Stable day ordering.
         */
        dayIndex * 2

        +

        /*
         * Stable room ordering.
         */
        candidate.roomId
    );
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
     * Prefer smaller adequate rooms.
     */
    validRooms.sort(
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


    for (
        const window
        of windows
    ) {

        /*
         * Actual windows are generated Monday-Sunday.
         *
         * We intentionally don't stop at Monday.
         */
        for (
            const professor
            of professors
        ) {

            /*
             * Fast professor conflict check.
             */
            if (
                hasSlotConflict(
                    occupancy.professorSlots,
                    professor.id,
                    window.slotIds
                )
            ) {

                continue;
            }


            /*
             * Section conflict.
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
                const room
                of validRooms
            ) {

                /*
                 * Room conflict.
                 */
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
                 * Keep candidate list bounded.
                 */
                if (
                    candidates.length <
                    limit
                ) {

                    candidates.push(
                        candidate
                    );

                    continue;
                }


                /*
                 * Find current worst candidate.
                 */
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

                    const score =
                        scoreCandidate(
                            candidates[i],
                            occupancy,
                            requirement,
                            professorMap
                        );


                    if (
                        score >
                        worstScore
                    ) {

                        worstScore =
                            score;

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
| GET REQUIREMENT WINDOWS
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


        /*
         * Zero = immediate failure.
         */
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

            console.log(
                `[GREEDY] No candidate for ` +
                `${selected.requirement?.subject_code || "unknown"}`
            );


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

            console.log(
                `[GREEDY] No candidate for ` +
                `${requirement.subject_code} ` +
                `${requirement.type}`
            );


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
         * Candidate #1 is the best according to:
         *
         * professor load
         * room load
         * professor scarcity
         * room waste
         * section day distribution
         * long-day penalty
         * day spread
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


        /*
         * MRV / fail-first.
         */
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


        /*
         * Candidates are sorted using the same
         * distribution-aware scoring used by greedy.
         */
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


            console.log(
                `[BACKTRACK] ${section.section_name} | ` +
                `${requirement.subject_code} ` +
                `${requirement.type} | ` +
                `${candidate.day} ` +
                `${candidate.start_time}-` +
                `${candidate.end_time} | ` +
                `${candidate.room.room_name} | ` +
                `${candidate.professor.firstname} ` +
                `${candidate.professor.lastname}`
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
     * STEP 1
     * Greedy
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


    console.log(
        `[HYBRID] Greedy failed for ` +
        `${section.section_name}`
    );


    /*
     * Greedy already rolled back its
     * temporary reservations.
     */


    /*
     * STEP 2
     * Bounded backtracking
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

            /*
             * One atomic multi-hour assignment
             * becomes multiple class_schedules rows.
             */

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
        "HYBRID GLOBAL RESOURCE-AWARE SCHEDULER"
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
        "Scheduling range: Monday-Sunday"
    );


    console.log(
        "Daily range depends on available time_slots"
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


    /*
     * Print actual day availability.
     */
    for (
        const day
        of DAY_ORDER
    ) {

        const daySlots =
            slotsByDay.get(day) || [];


        if (
            daySlots.length === 0
        ) {

            console.log(
                `[TIME] ${day}: NO AVAILABLE SLOTS`
            );

            continue;
        }


        console.log(
            `[TIME] ${day}: ` +
            `${daySlots[0].start_time} - ` +
            `${daySlots[daySlots.length - 1].end_time} | ` +
            `${daySlots.length} slots`
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
        `Available time slots: ` +
        `${timeSlots.length}`
    );


    console.log(
        `Available rooms: ` +
        `${rooms.length}`
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


    /*
     * Existing schedules occupy only their
     * actual professor/room/section/time slots.
     */
    reserveExistingSchedules(
        existingSchedules,
        occupancy
    );


    /*
     * --------------------------------------------------------------
     * EXISTING REQUIREMENTS
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
     * BUILD WINDOWS
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
        ];


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


        /*
         * Show distribution.
         */
        const windowsByDay =
            new Map();


        for (
            const day
            of DAY_ORDER
        ) {

            windowsByDay.set(
                day,
                0
            );
        }


        for (
            const window
            of windows
        ) {

            windowsByDay.set(
                window.day,
                (
                    windowsByDay.get(
                        window.day
                    ) || 0
                ) + 1
            );
        }


        console.log(
            `[WINDOWS] ${hours}-hour: ` +
            `${windows.length}`
        );


        console.log(
            `[WINDOWS] ${hours}-hour distribution: ` +
            DAY_ORDER.map(
                day =>
                    `${day}=${windowsByDay.get(day) || 0}`
            ).join(" | ")
        );
    }


    /*
     * --------------------------------------------------------------
     * SECTION ORDERING
     * --------------------------------------------------------------
     *
     * Hardest sections first.
     * --------------------------------------------------------------
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
                     * harder section.
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
     * SOLVE GLOBAL SEQUENCE
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
         * HYBRID SOLVE
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
                 * Reservations remain in global occupancy.
                 *
                 * Therefore the NEXT section cannot use:
                 *
                 * same professor + same time
                 * same room + same time
                 * same section + same time
                 *
                 * The current section's daily hours also remain
                 * tracked, but ONLY for that section.
                 */

                await saveSectionSchedules(
                    result.assignments,
                    academicTermId
                );


                scheduledSections.push(
                    section.section_name
                );


                /*
                 * Build response schedules.
                 */
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


                /*
                 * Print section weekly distribution.
                 */
                const weeklyLoad = {};


                for (
                    const day
                    of DAY_ORDER
                ) {

                    weeklyLoad[day] =
                        getSectionDayHours(
                            occupancy,
                            section.id,
                            day
                        );
                }


                console.log(
                    `[RESULT] ${section.section_name} | ` +
                    `success=true | ` +
                    `method=${result.method}`
                );


                console.log(
                    `[WEEKLY LOAD] ${section.section_name} | ` +
                    DAY_ORDER.map(
                        day =>
                            `${day}=${weeklyLoad[day]}h`
                    ).join(" | ")
                );


                console.log(
                    `[WEEKLY TOTAL] ` +
                    `${getSectionTotalScheduledHours(
                        occupancy,
                        section.id
                    )} hours`
                );


                console.log(
                    `[SAVED] ${section.section_name} ✅`
                );


            } catch (saveError) {

                /*
                 * DB save failed.
                 *
                 * Roll back the global reservations.
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


        let worst =
            null;


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


        if (
            worst
        ) {

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
            bottleneck === "MULTIPLE RESOURCES"
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
                "HYBRID_LAZY_GREEDY_MRV_BACKTRACK_WEEKLY_DISTRIBUTION",

            schedulingDays:
                [...DAY_ORDER],

            targetDailyHours:
                SECTION_TARGET_DAILY_HOURS,

            weeklyDistribution:
                true,

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

            totalTimeSlots:
                timeSlots.length,

            existingScheduleRows:
                existingSchedules.length
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