const db = require("../config/db");

/*
|--------------------------------------------------------------------------
| CAPACITY CHECKER SERVICE
|--------------------------------------------------------------------------
|
| PURPOSE
|--------------------------------------------------------------------------
|
| This service DOES NOT run the scheduler.
|
| It checks whether the university has enough professor capacity for the
| existing sections of a selected academic term.
|
| Calculation:
|
|   Curriculum
|   + Actual Sections
|   + Subject Lecture/Lab Units
|   + professor_subjects qualification
|   + professor.max_weekly_hours
|
|--------------------------------------------------------------------------
| IMPORTANT
|--------------------------------------------------------------------------
|
| academicTermId is passed as a SIMPLE ID.
|
| Example:
|
|     checkUniversityCapacity(1)
|
| NOT:
|
|     checkUniversityCapacity({ academicTermId: 1 })
|
|--------------------------------------------------------------------------
*/

const DEFAULT_MAX_WEEKLY_HOURS = 18;


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const num = value => {

    const n = Number(value);

    return Number.isFinite(n) ? n : 0;
};


const positiveInt = value => {

    const n = Number(value);

    return Number.isInteger(n) && n > 0
        ? n
        : 0;
};


const normalizeText = value =>
    String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");


const round2 = value =>
    Number(
        Number(value || 0).toFixed(2)
    );


/*
|--------------------------------------------------------------------------
| YEAR LEVEL NORMALIZATION
|--------------------------------------------------------------------------
|
| Prevents:
|
| "1st Year"
| "1st year"
| "1st  Year"
|
| from becoming different Map keys.
|
|--------------------------------------------------------------------------
*/

const normalizeYearLevel = value => {

    const text =
        normalizeText(value);

    if (!text) {
        return "";
    }


    const compact =
        text
            .replace(/year/g, "")
            .replace(/\s+/g, "")
            .trim();


    const aliases = {

        "1": "1st",
        "1st": "1st",
        "1styear": "1st",

        "2": "2nd",
        "2nd": "2nd",
        "2ndyear": "2nd",

        "3": "3rd",
        "3rd": "3rd",
        "3rdyear": "3rd",

        "4": "4th",
        "4th": "4th",
        "4thyear": "4th"

    };


    if (aliases[compact]) {
        return aliases[compact];
    }


    return text
        .replace(/\s*year\s*/i, "")
        .trim();
};


/*
|--------------------------------------------------------------------------
| GET PROGRAMS
|--------------------------------------------------------------------------
*/

const getPrograms = async () => {

    const [rows] = await db.query(`
        SELECT
            id,
            program_name
        FROM programs
        ORDER BY id ASC
    `);


    return rows.map(row => ({

        id:
            positiveInt(row.id),

        name:
            row.program_name

    }));
};


/*
|--------------------------------------------------------------------------
| GET PROGRAM SECTIONS
|--------------------------------------------------------------------------
|
| Uses ACTUAL sections for the selected academic term.
|
|--------------------------------------------------------------------------
*/

const getProgramSections = async (
    programId,
    academicTermId
) => {

    const [rows] = await db.query(`
        SELECT
            year_level,
            COUNT(*) AS section_count
        FROM sections
        WHERE program_id = ?
          AND academic_term_id = ?
        GROUP BY year_level
        ORDER BY year_level ASC
    `, [
        programId,
        academicTermId
    ]);


    const sectionsByYearLevel =
        new Map();


    let totalSections = 0;


    for (const row of rows) {

        const yearLevel =
            String(
                row.year_level ?? ""
            ).trim();


        const normalizedYear =
            normalizeYearLevel(
                yearLevel
            );


        const sectionCount =
            positiveInt(
                row.section_count
            );


        if (
            !normalizedYear ||
            sectionCount <= 0
        ) {
            continue;
        }


        sectionsByYearLevel.set(
            normalizedYear,
            (
                sectionsByYearLevel.get(
                    normalizedYear
                ) || 0
            ) + sectionCount
        );


        totalSections +=
            sectionCount;
    }


    return {

        rows,

        sectionsByYearLevel,

        totalSections

    };
};


/*
|--------------------------------------------------------------------------
| GET PROGRAM CURRICULUM
|--------------------------------------------------------------------------
*/

const getProgramCurriculum = async (
    programId
) => {

    const [rows] = await db.query(`
        SELECT

            cs.id AS curriculum_subject_id,

            cs.subject_id,

            cs.year_level,

            cs.semester,

            sub.subject_code,

            sub.subject_name,

            sub.lecture_units,

            sub.lab_units

        FROM curriculum_subjects cs

        INNER JOIN subjects sub
            ON sub.id = cs.subject_id

        WHERE cs.program_id = ?

        ORDER BY
            cs.year_level ASC,
            cs.semester ASC,
            sub.subject_code ASC
    `, [
        programId
    ]);


    return rows.map(row => ({

        curriculumSubjectId:
            positiveInt(
                row.curriculum_subject_id
            ),

        subjectId:
            positiveInt(
                row.subject_id
            ),

        yearLevel:
            String(
                row.year_level ?? ""
            ).trim(),

        normalizedYearLevel:
            normalizeYearLevel(
                row.year_level
            ),

        semester:
            String(
                row.semester ?? ""
            ).trim(),

        subjectCode:
            row.subject_code,

        subjectName:
            row.subject_name,

        lectureUnits:
            Math.max(
                0,
                num(
                    row.lecture_units
                )
            ),

        labUnits:
            Math.max(
                0,
                num(
                    row.lab_units
                )
            )

    }));
};


/*
|--------------------------------------------------------------------------
| SUBJECT WEEKLY HOURS
|--------------------------------------------------------------------------
|
| 1 lecture unit = 1 hour/week
| 1 laboratory unit = 3 hours/week
|
|--------------------------------------------------------------------------
*/

const getSubjectWeeklyHours = subject => {

    const lectureHours =
        Math.max(
            0,
            num(
                subject.lectureUnits
            )
        );


    const laboratoryHours =
        Math.max(
            0,
            num(
                subject.labUnits
            )
        ) * 3;


    return {

        lectureHours,

        laboratoryHours,

        totalHours:
            lectureHours +
            laboratoryHours

    };
};


/*
|--------------------------------------------------------------------------
| GET PROFESSOR QUALIFICATIONS
|--------------------------------------------------------------------------
|
| professor_subjects is the ONLY qualification source.
|
|--------------------------------------------------------------------------
*/

const getProfessorQualifications = async (
    subjects
) => {

    if (
        !Array.isArray(subjects) ||
        subjects.length === 0
    ) {

        return {

            professors: [],

            qualificationsBySubject:
                new Map(),

            qualificationsByProfessor:
                new Map()

        };
    }


    const subjectIds =
        [
            ...new Set(
                subjects
                    .map(
                        subject =>
                            positiveInt(
                                subject.subjectId
                            )
                    )
                    .filter(
                        id => id > 0
                    )
            )
        ];


    if (
        subjectIds.length === 0
    ) {

        return {

            professors: [],

            qualificationsBySubject:
                new Map(),

            qualificationsByProfessor:
                new Map()

        };
    }


    const placeholders =
        subjectIds
            .map(() => "?")
            .join(",");


    const [rows] = await db.query(`
        SELECT DISTINCT

            p.id AS professor_id,

            p.employee_id,

            p.firstname,

            p.lastname,

            p.max_weekly_hours,

            ps.subject_id

        FROM professor_subjects ps

        INNER JOIN profesor p
            ON p.id = ps.professor_id

        WHERE ps.subject_id IN (${placeholders})

        ORDER BY
            p.id ASC,
            ps.subject_id ASC
    `, subjectIds);


    const professorMap =
        new Map();


    const qualificationsBySubject =
        new Map();


    const qualificationsByProfessor =
        new Map();


    for (const row of rows) {

        const professorId =
            positiveInt(
                row.professor_id
            );


        const subjectId =
            positiveInt(
                row.subject_id
            );


        if (
            professorId <= 0 ||
            subjectId <= 0
        ) {
            continue;
        }


        if (
            !professorMap.has(
                professorId
            )
        ) {

            professorMap.set(
                professorId,
                {

                    professorId,

                    employeeId:
                        row.employee_id,

                    firstname:
                        row.firstname,

                    lastname:
                        row.lastname,

                    name:
                        `${row.firstname || ""} ${row.lastname || ""}`
                            .trim(),

                    maxWeeklyHours:
                        row.max_weekly_hours == null
                            ? DEFAULT_MAX_WEEKLY_HOURS
                            : Math.max(
                                0,
                                num(
                                    row.max_weekly_hours
                                )
                            ),

                    qualifiedSubjectIds:
                        new Set()

                }
            );
        }


        const professor =
            professorMap.get(
                professorId
            );


        /*
        |--------------------------------------------------------------------------
        | SAFETY FIX
        |--------------------------------------------------------------------------
        |
        | Never assume qualifiedSubjectIds already exists.
        |
        |--------------------------------------------------------------------------
        */

        if (
            !(professor.qualifiedSubjectIds instanceof Set)
        ) {

            professor.qualifiedSubjectIds =
                new Set();
        }


        professor.qualifiedSubjectIds.add(
            subjectId
        );


        /*
        |--------------------------------------------------------------------------
        | SUBJECT -> PROFESSORS
        |--------------------------------------------------------------------------
        */

        if (
            !qualificationsBySubject.has(
                subjectId
            )
        ) {

            qualificationsBySubject.set(
                subjectId,
                new Set()
            );
        }


        qualificationsBySubject
            .get(subjectId)
            .add(
                professorId
            );


        /*
        |--------------------------------------------------------------------------
        | PROFESSOR -> SUBJECTS
        |--------------------------------------------------------------------------
        */

        if (
            !qualificationsByProfessor.has(
                professorId
            )
        ) {

            qualificationsByProfessor.set(
                professorId,
                new Set()
            );
        }


        qualificationsByProfessor
            .get(professorId)
            .add(
                subjectId
            );
    }


    const professors =
        [...professorMap.values()]
            .map(professor => ({

                ...professor,

                /*
                |--------------------------------------------------------------------------
                | IMPORTANT
                |--------------------------------------------------------------------------
                |
                | Guarantee this is ALWAYS a Set.
                |
                |--------------------------------------------------------------------------
                */

                qualifiedSubjectIds:
                    professor.qualifiedSubjectIds instanceof Set
                        ? professor.qualifiedSubjectIds
                        : new Set()

            }));


    return {

        professors,

        qualificationsBySubject,

        qualificationsByProfessor

    };
};


/*
|--------------------------------------------------------------------------
| BUILD SUBJECT REQUIREMENTS
|--------------------------------------------------------------------------
|
| REQUIRED HOURS:
|
|     number of sections for year level
|     ×
|     subject weekly hours
|
|--------------------------------------------------------------------------
*/

const buildSubjectRequirements = ({
    curriculum,
    sectionsByYearLevel,
    qualificationsBySubject
}) => {

    const requirements = [];


    for (const subject of curriculum) {

        const weekly =
            getSubjectWeeklyHours(
                subject
            );


        const yearKey =
            subject.normalizedYearLevel ||
            normalizeYearLevel(
                subject.yearLevel
            );


        const sectionCount =
            positiveInt(
                sectionsByYearLevel.get(
                    yearKey
                )
            );


        const requiredHours =
            sectionCount *
            weekly.totalHours;


        const qualifiedSet =
            qualificationsBySubject instanceof Map
                ? qualificationsBySubject.get(
                    subject.subjectId
                )
                : null;


        const qualifiedProfessorIds =
            qualifiedSet instanceof Set
                ? [...qualifiedSet]
                : [];


        requirements.push({

            curriculumSubjectId:
                subject.curriculumSubjectId,

            subjectId:
                subject.subjectId,

            subjectCode:
                subject.subjectCode,

            subjectName:
                subject.subjectName,

            yearLevel:
                subject.yearLevel,

            normalizedYearLevel:
                yearKey,

            semester:
                subject.semester,

            lectureUnits:
                subject.lectureUnits,

            labUnits:
                subject.labUnits,

            lectureHours:
                weekly.lectureHours,

            laboratoryHours:
                weekly.laboratoryHours,

            weeklyHoursPerSection:
                weekly.totalHours,

            sectionCount,

            requiredHours,

            qualifiedProfessorIds,

            qualifiedProfessorCount:
                qualifiedProfessorIds.length,

            hasQualifiedProfessor:
                qualifiedProfessorIds.length > 0,

            missingProfessor:
                requiredHours > 0 &&
                qualifiedProfessorIds.length === 0

        });
    }


    return requirements;
};


/*
|--------------------------------------------------------------------------
| CALCULATE REQUIRED HOURS
|--------------------------------------------------------------------------
*/

const calculateRequiredHours = requirements => {

    return requirements.reduce(
        (
            total,
            requirement
        ) =>
            total +
            num(
                requirement.requiredHours
            ),
        0
    );
};


/*
|--------------------------------------------------------------------------
| CALCULATE PROFESSOR CAPACITY
|--------------------------------------------------------------------------
|
| A professor's max_weekly_hours is counted ONCE.
|
|--------------------------------------------------------------------------
*/

const calculateProfessorCapacities = ({
    professors,
    requirements
}) => {

    return professors.map(
        professor => {

            const qualifiedSubjectIds =
                professor.qualifiedSubjectIds instanceof Set
                    ? professor.qualifiedSubjectIds
                    : new Set();


            const qualifiedRequirements =
                requirements.filter(
                    requirement =>
                        requirement.requiredHours > 0 &&
                        requirement
                            .qualifiedProfessorIds
                            .includes(
                                professor.professorId
                            )
                );


            const qualifiedRequiredHours =
                qualifiedRequirements.reduce(
                    (
                        total,
                        requirement
                    ) =>
                        total +
                        num(
                            requirement.requiredHours
                        ),
                    0
                );


            const maxWeeklyHours =
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                );


            return {

                professorId:
                    professor.professorId,

                employeeId:
                    professor.employeeId,

                name:
                    professor.name,

                maxWeeklyHours,

                qualifiedSubjects:
                    [...qualifiedSubjectIds],

                qualifiedSubjectIds:
                    [...qualifiedSubjectIds],

                qualifiedSubjectCount:
                    qualifiedSubjectIds.size,

                qualifiedRequiredHours,

                availableCapacity:
                    maxWeeklyHours,

                utilizationIfFullyUsed:
                    maxWeeklyHours > 0
                        ? round2(
                            Math.min(
                                100,
                                (
                                    qualifiedRequiredHours /
                                    maxWeeklyHours
                                ) * 100
                            )
                        )
                        : 0

            };
        }
    );
};


/*
|--------------------------------------------------------------------------
| CALCULATE SUBJECT BOTTLENECKS
|--------------------------------------------------------------------------
*/

const calculateSubjectBottlenecks = ({
    requirements,
    professors
}) => {

    const bottlenecks = [];


    for (
        const requirement
        of requirements
    ) {

        if (
            requirement.requiredHours <= 0
        ) {
            continue;
        }


        const qualified =
            professors.filter(
                professor =>
                    requirement
                        .qualifiedProfessorIds
                        .includes(
                            professor.professorId
                        )
            );


        const qualifiedCapacity =
            qualified.reduce(
                (
                    total,
                    professor
                ) =>
                    total +
                    Math.max(
                        0,
                        num(
                            professor.maxWeeklyHours
                        )
                    ),
                0
            );


        const capacityShortage =
            Math.max(
                0,
                requirement.requiredHours -
                qualifiedCapacity
            );


        if (
            requirement.qualifiedProfessorCount === 0
        ) {

            bottlenecks.push({

                subjectId:
                    requirement.subjectId,

                subjectCode:
                    requirement.subjectCode,

                subjectName:
                    requirement.subjectName,

                yearLevel:
                    requirement.yearLevel,

                sectionCount:
                    requirement.sectionCount,

                weeklyHoursPerSection:
                    requirement.weeklyHoursPerSection,

                requiredHours:
                    requirement.requiredHours,

                qualifiedProfessorCount:
                    0,

                qualifiedCapacity:
                    0,

                capacityShortage:
                    requirement.requiredHours,

                reason:
                    "NO_QUALIFIED_PROFESSOR"

            });

            continue;
        }


        if (
            capacityShortage > 0
        ) {

            bottlenecks.push({

                subjectId:
                    requirement.subjectId,

                subjectCode:
                    requirement.subjectCode,

                subjectName:
                    requirement.subjectName,

                yearLevel:
                    requirement.yearLevel,

                sectionCount:
                    requirement.sectionCount,

                weeklyHoursPerSection:
                    requirement.weeklyHoursPerSection,

                requiredHours:
                    requirement.requiredHours,

                qualifiedProfessorCount:
                    requirement.qualifiedProfessorCount,

                qualifiedCapacity,

                capacityShortage,

                reason:
                    "INSUFFICIENT_QUALIFIED_CAPACITY"

            });
        }
    }


    return bottlenecks;
};


/*
|--------------------------------------------------------------------------
| CALCULATE MINIMUM PROFESSORS
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| This is a qualification-aware lower-bound calculation.
|
| We do NOT pretend that simply:
|
|     total hours / max professor hours
|
| is enough.
|
|--------------------------------------------------------------------------
*/

const calculateMinimumProfessorRequirement = ({
    professors,
    requirements
}) => {

    const activeRequirements =
        requirements.filter(
            requirement =>
                requirement.requiredHours > 0
        );


    if (
        activeRequirements.length === 0
    ) {

        return {

            feasible: true,

            minimumProfessorsNeeded: 0,

            lowerBound: 0,

            missingSubjects: [],

            reason:
                "No teaching hours are required."

        };
    }


    const missingSubjects =
        activeRequirements.filter(
            requirement =>
                requirement
                    .qualifiedProfessorIds
                    .length === 0
        );


    if (
        missingSubjects.length > 0
    ) {

        return {

            feasible: false,

            minimumProfessorsNeeded: null,

            lowerBound: null,

            missingSubjects,

            reason:
                "One or more required subjects have no qualified professor."

        };
    }


    const usefulProfessors =
        professors.filter(
            professor =>
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                ) > 0 &&
                activeRequirements.some(
                    requirement =>
                        requirement
                            .qualifiedProfessorIds
                            .includes(
                                professor.professorId
                            )
                )
        );


    if (
        usefulProfessors.length === 0
    ) {

        return {

            feasible: false,

            minimumProfessorsNeeded: null,

            lowerBound: null,

            missingSubjects:
                activeRequirements,

            reason:
                "No professor with usable weekly capacity is qualified for the required subjects."

        };
    }


    const totalRequiredHours =
        calculateRequiredHours(
            activeRequirements
        );


    const totalCapacity =
        usefulProfessors.reduce(
            (
                total,
                professor
            ) =>
                total +
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                ),
            0
        );


    if (
        totalCapacity <
        totalRequiredHours
    ) {

        return {

            feasible: false,

            minimumProfessorsNeeded: null,

            lowerBound:
                Math.ceil(
                    totalRequiredHours /
                    Math.max(
                        ...usefulProfessors.map(
                            professor =>
                                Math.max(
                                    0,
                                    num(
                                        professor.maxWeeklyHours
                                    )
                                )
                        )
                    )
                ),

            missingSubjects: [],

            reason:
                "Total qualified professor capacity is insufficient.",

            totalRequiredHours,

            totalQualifiedCapacity:
                totalCapacity

        };
    }


    /*
    |--------------------------------------------------------------------------
    | SUBJECT QUALIFICATION LOWER BOUND
    |--------------------------------------------------------------------------
    */

    let qualificationLowerBound = 1;


    for (
        const requirement
        of activeRequirements
    ) {

        const qualified =
            usefulProfessors.filter(
                professor =>
                    requirement
                        .qualifiedProfessorIds
                        .includes(
                            professor.professorId
                        )
            );


        const qualifiedCapacity =
            qualified.reduce(
                (
                    total,
                    professor
                ) =>
                    total +
                    professor.maxWeeklyHours,
                0
            );


        if (
            qualifiedCapacity <
            requirement.requiredHours
        ) {

            return {

                feasible: false,

                minimumProfessorsNeeded: null,

                lowerBound: null,

                missingSubjects: [],

                reason:
                    `Qualified professor capacity is insufficient for ${requirement.subjectCode}.`,

                insufficientSubject:
                    requirement,

                qualifiedCapacity

            };
        }


        let accumulated = 0;
        let needed = 0;


        qualified
            .sort(
                (
                    a,
                    b
                ) =>
                    b.maxWeeklyHours -
                    a.maxWeeklyHours
            );


        for (
            const professor
            of qualified
        ) {

            accumulated +=
                professor.maxWeeklyHours;

            needed++;


            if (
                accumulated >=
                requirement.requiredHours
            ) {
                break;
            }
        }


        qualificationLowerBound =
            Math.max(
                qualificationLowerBound,
                needed
            );
    }


    const highestCapacity =
        Math.max(
            ...usefulProfessors.map(
                professor =>
                    professor.maxWeeklyHours
            )
        );


    const globalLowerBound =
        Math.max(
            qualificationLowerBound,
            Math.ceil(
                totalRequiredHours /
                highestCapacity
            )
        );


    /*
    |--------------------------------------------------------------------------
    | EXACT SEARCH
    |--------------------------------------------------------------------------
    |
    | Search only when professor count is manageable.
    |
    |--------------------------------------------------------------------------
    */

    const MAX_EXACT_PROFESSORS = 24;


    const canAllocate =
        selectedProfessors => {

            const remainingCapacity =
                new Map();


            for (
                const professor
                of selectedProfessors
            ) {

                remainingCapacity.set(
                    professor.professorId,
                    Math.max(
                        0,
                        num(
                            professor.maxWeeklyHours
                        )
                    )
                );
            }


            const orderedRequirements =
                [...activeRequirements]
                    .sort(
                        (
                            a,
                            b
                        ) => {

                            const aCount =
                                selectedProfessors.filter(
                                    professor =>
                                        a
                                            .qualifiedProfessorIds
                                            .includes(
                                                professor.professorId
                                            )
                                ).length;


                            const bCount =
                                selectedProfessors.filter(
                                    professor =>
                                        b
                                            .qualifiedProfessorIds
                                            .includes(
                                                professor.professorId
                                            )
                                ).length;


                            if (
                                aCount !== bCount
                            ) {

                                return (
                                    aCount -
                                    bCount
                                );
                            }


                            return (
                                b.requiredHours -
                                a.requiredHours
                            );
                        }
                    );


            for (
                const requirement
                of orderedRequirements
            ) {

                let remaining =
                    requirement.requiredHours;


                const qualified =
                    selectedProfessors
                        .filter(
                            professor =>
                                requirement
                                    .qualifiedProfessorIds
                                    .includes(
                                        professor.professorId
                                    )
                        )
                        .sort(
                            (
                                a,
                                b
                            ) =>
                                (
                                    remainingCapacity.get(
                                        b.professorId
                                    ) || 0
                                ) -
                                (
                                    remainingCapacity.get(
                                        a.professorId
                                    ) || 0
                                )
                        );


                for (
                    const professor
                    of qualified
                ) {

                    if (
                        remaining <= 0
                    ) {
                        break;
                    }


                    const available =
                        Math.max(
                            0,
                            num(
                                remainingCapacity.get(
                                    professor.professorId
                                )
                            )
                        );


                    const allocation =
                        Math.min(
                            available,
                            remaining
                        );


                    remaining -=
                        allocation;


                    remainingCapacity.set(
                        professor.professorId,
                        available -
                        allocation
                    );
                }


                if (
                    remaining > 0
                ) {

                    return false;
                }
            }


            return true;
        };


    if (
        usefulProfessors.length <=
        MAX_EXACT_PROFESSORS
    ) {

        const sortedProfessors =
            [...usefulProfessors]
                .sort(
                    (
                        a,
                        b
                    ) =>
                        b.maxWeeklyHours -
                        a.maxWeeklyHours
                );


        let solution = null;


        const search =
            (
                startIndex,
                targetCount,
                selected
            ) => {

                if (solution) {
                    return;
                }


                if (
                    selected.length ===
                    targetCount
                ) {

                    if (
                        canAllocate(
                            selected
                        )
                    ) {

                        solution =
                            [...selected];
                    }

                    return;
                }


                const needed =
                    targetCount -
                    selected.length;


                for (
                    let i =
                        startIndex;

                    i <
                    sortedProfessors.length;

                    i++
                ) {

                    if (
                        sortedProfessors.length -
                        i <
                        needed
                    ) {
                        break;
                    }


                    selected.push(
                        sortedProfessors[i]
                    );


                    search(
                        i + 1,
                        targetCount,
                        selected
                    );


                    selected.pop();


                    if (solution) {
                        return;
                    }
                }
            };


        for (
            let count =
                globalLowerBound;

            count <=
            sortedProfessors.length;

            count++
        ) {

            solution = null;


            search(
                0,
                count,
                []
            );


            if (solution) {
                break;
            }
        }


        if (solution) {

            return {

                feasible: true,

                minimumProfessorsNeeded:
                    solution.length,

                lowerBound:
                    globalLowerBound,

                exact: true,

                method:
                    "qualification-aware exact subset search",

                selectedProfessors:
                    solution.map(
                        professor => ({

                            professorId:
                                professor.professorId,

                            name:
                                professor.name,

                            maxWeeklyHours:
                                professor.maxWeeklyHours

                        })
                    ),

                missingSubjects: [],

                reason:
                    "Minimum professor count was calculated using professor-subject qualifications and max_weekly_hours."

            };
        }


        return {

            feasible: false,

            minimumProfessorsNeeded: null,

            lowerBound:
                globalLowerBound,

            exact: true,

            method:
                "qualification-aware exact subset search",

            selectedProfessors: [],

            missingSubjects: [],

            reason:
                "No professor subset with sufficient qualified capacity could cover all required teaching hours."

        };
    }


    /*
    |--------------------------------------------------------------------------
    | GREEDY FALLBACK
    |--------------------------------------------------------------------------
    */

    const selected = [];

    const remaining =
        new Map(
            activeRequirements.map(
                requirement => [
                    requirement.curriculumSubjectId,
                    requirement.requiredHours
                ]
            )
        );


    const remainingProfessorIds =
        new Set(
            usefulProfessors.map(
                professor =>
                    professor.professorId
            )
        );


    while (
        [...remaining.values()]
            .some(
                hours =>
                    hours > 0
            ) &&
        remainingProfessorIds.size > 0
    ) {

        let bestProfessor = null;
        let bestScore = 0;


        for (
            const professor
            of usefulProfessors
        ) {

            if (
                !remainingProfessorIds.has(
                    professor.professorId
                )
            ) {
                continue;
            }


            let score = 0;


            for (
                const requirement
                of activeRequirements
            ) {

                const left =
                    num(
                        remaining.get(
                            requirement.curriculumSubjectId
                        )
                    );


                if (
                    left <= 0
                ) {
                    continue;
                }


                if (
                    requirement
                        .qualifiedProfessorIds
                        .includes(
                            professor.professorId
                        )
                ) {

                    score +=
                        Math.min(
                            left,
                            professor.maxWeeklyHours
                        );
                }
            }


            if (
                score > bestScore
            ) {

                bestScore =
                    score;

                bestProfessor =
                    professor;
            }
        }


        if (!bestProfessor) {
            break;
        }


        selected.push(
            bestProfessor
        );


        remainingProfessorIds.delete(
            bestProfessor.professorId
        );


        let capacity =
            bestProfessor.maxWeeklyHours;


        const applicable =
            [...activeRequirements]
                .filter(
                    requirement =>
                        num(
                            remaining.get(
                                requirement
                                    .curriculumSubjectId
                            )
                        ) > 0 &&
                        requirement
                            .qualifiedProfessorIds
                            .includes(
                                bestProfessor.professorId
                            )
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        a
                            .qualifiedProfessorIds
                            .length -
                        b
                            .qualifiedProfessorIds
                            .length
                );


        for (
            const requirement
            of applicable
        ) {

            if (
                capacity <= 0
            ) {
                break;
            }


            const current =
                num(
                    remaining.get(
                        requirement
                            .curriculumSubjectId
                    )
                );


            const used =
                Math.min(
                    current,
                    capacity
                );


            remaining.set(
                requirement
                    .curriculumSubjectId,
                current - used
            );


            capacity -= used;
        }
    }


    const feasible =
        ![...remaining.values()]
            .some(
                hours =>
                    hours > 0
            );


    return {

        feasible,

        minimumProfessorsNeeded:
            feasible
                ? selected.length
                : null,

        lowerBound:
            globalLowerBound,

        exact: false,

        method:
            "qualification-aware greedy",

        selectedProfessors:
            selected.map(
                professor => ({

                    professorId:
                        professor.professorId,

                    name:
                        professor.name,

                    maxWeeklyHours:
                        professor.maxWeeklyHours

                })
            ),

        missingSubjects: [],

        reason:
            feasible
                ? "A qualification-aware professor capacity allocation was found."
                : "Available qualified professor capacity could not cover all required teaching hours."

    };
};


/*
|--------------------------------------------------------------------------
| PROFESSOR DETAILS
|--------------------------------------------------------------------------
*/

const buildProfessorDetails = ({
    professors,
    requirements
}) => {

    return professors.map(
        professor => {

            const qualifiedSubjectIds =
                professor.qualifiedSubjectIds instanceof Set
                    ? [...professor.qualifiedSubjectIds]
                    : [];


            const qualifiedSubjects =
                requirements.filter(
                    requirement =>
                        requirement
                            .qualifiedProfessorIds
                            .includes(
                                professor.professorId
                            )
                );


            const potentialProgramHours =
                qualifiedSubjects.reduce(
                    (
                        total,
                        requirement
                    ) =>
                        total +
                        num(
                            requirement.requiredHours
                        ),
                    0
                );


            const maxWeeklyHours =
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                );


            return {

                professorId:
                    professor.professorId,

                employeeId:
                    professor.employeeId,

                name:
                    professor.name,

                maxWeeklyHours,

                qualifiedSubjectCount:
                    qualifiedSubjectIds.length,

                qualifiedSubjectIds,

                potentialProgramHours,

                maxUsableHours:
                    Math.min(
                        maxWeeklyHours,
                        potentialProgramHours
                    ),

                potentialUtilization:
                    maxWeeklyHours > 0
                        ? round2(
                            (
                                Math.min(
                                    maxWeeklyHours,
                                    potentialProgramHours
                                ) /
                                maxWeeklyHours
                            ) * 100
                        )
                        : 0

            };
        }
    );
};


/*
|--------------------------------------------------------------------------
| CALCULATE PROFESSOR CAPACITY
|--------------------------------------------------------------------------
*/

const calculateProfessorCapacity = ({
    sections,
    curriculum,
    professors,
    qualificationsBySubject
}) => {

    const requirements =
        buildSubjectRequirements({

            curriculum,

            sectionsByYearLevel:
                sections.sectionsByYearLevel,

            qualificationsBySubject

        });


    const totalRequiredHours =
        calculateRequiredHours(
            requirements
        );


    const professorDetails =
        calculateProfessorCapacities({

            professors,

            requirements

        });


    const totalAvailableCapacity =
        professorDetails.reduce(
            (
                total,
                professor
            ) =>
                total +
                num(
                    professor.maxWeeklyHours
                ),
            0
        );


    const totalPotentialQualifiedCapacity =
        professorDetails.reduce(
            (
                total,
                professor
            ) =>
                total +
                Math.min(
                    num(
                        professor.maxWeeklyHours
                    ),
                    num(
                        professor.qualifiedRequiredHours
                    )
                ),
            0
        );


    const activeRequirements =
        requirements.filter(
            requirement =>
                requirement.requiredHours > 0
        );


    const subjectBottlenecks =
        calculateSubjectBottlenecks({

            requirements,

            professors

        });


    const minimumRequirement =
        calculateMinimumProfessorRequirement({

            professors,

            requirements

        });


    const professorDetailsWithPotential =
        buildProfessorDetails({

            professors,

            requirements

        });


    /*
    |--------------------------------------------------------------------------
    | STATUS
    |--------------------------------------------------------------------------
    */

    let status = "SUFFICIENT";


    if (
        sections.totalSections === 0
    ) {

        status =
            "NO_SECTIONS";

    } else if (
        activeRequirements.length === 0
    ) {

        /*
        |--------------------------------------------------------------------------
        | IMPORTANT
        |--------------------------------------------------------------------------
        |
        | If sections exist but ZERO curriculum demand was generated,
        | this is NOT automatically sufficient.
        |
        |--------------------------------------------------------------------------
        */

        status =
            curriculum.length === 0
                ? "NO_CURRICULUM"
                : "NO_ACTIVE_CURRICULUM";

    } else if (
        subjectBottlenecks.length > 0
    ) {

        status =
            "INSUFFICIENT_QUALIFIED_CAPACITY";

    } else if (
        !minimumRequirement.feasible
    ) {

        status =
            "INSUFFICIENT_PROFESSORS";

    } else if (
        totalPotentialQualifiedCapacity <
        totalRequiredHours
    ) {

        status =
            "INSUFFICIENT_QUALIFIED_CAPACITY";
    }


    const sufficient =
        status === "SUFFICIENT";


    const minimumProfessorsNeeded =
        minimumRequirement.feasible
            ? minimumRequirement.minimumProfessorsNeeded
            : (
                minimumRequirement.lowerBound ??
                null
            );


    const availableProfessorCount =
        professors.length;


    const professorShortage =
        minimumProfessorsNeeded == null
            ? null
            : Math.max(
                0,
                minimumProfessorsNeeded -
                availableProfessorCount
            );


    const maxProfessorHours =
        professors.length > 0
            ? Math.max(
                ...professors.map(
                    professor =>
                        Math.max(
                            0,
                            num(
                                professor.maxWeeklyHours
                            )
                        )
                )
            )
            : 0;


    const hoursOnlyMinimum =
        maxProfessorHours > 0 &&
        totalRequiredHours > 0
            ? Math.ceil(
                totalRequiredHours /
                maxProfessorHours
            )
            : 0;


    return {

        status,

        sufficient,

        sectionCount:
            sections.totalSections,

        subjectsAnalyzed:
            curriculum.length,

        activeSubjects:
            activeRequirements.length,

        requiredTeachingHours:
            totalRequiredHours,

        totalRequiredProfessorHours:
            totalRequiredHours,

        availableProfessorCapacity:
            totalAvailableCapacity,

        totalPotentialQualifiedCapacity,

        qualifiedProfessorCapacity:
            totalPotentialQualifiedCapacity,

        professorsAvailable:
            availableProfessorCount,

        minimumProfessorsNeeded,

        minimumProfessorsLowerBound:
            minimumRequirement.lowerBound,

        hoursOnlyMinimumProfessors:
            hoursOnlyMinimum,

        professorShortage,

        subjectBottlenecks,

        minimumProfessorCalculation:
            minimumRequirement,

        professors:
            professorDetailsWithPotential,

        requirements,

        sectionsByYearLevel:
            Object.fromEntries(
                sections.sectionsByYearLevel
            )

    };
};


/*
|--------------------------------------------------------------------------
| CHECK SINGLE PROGRAM
|--------------------------------------------------------------------------
*/

const checkProgram = async ({
    program,
    academicTermId
}) => {

    console.log(
        "\n----------------------------------------"
    );

    console.log(
        "PROGRAM CAPACITY CHECK"
    );

    console.log(
        `Program ID: ${program.id}`
    );

    console.log(
        `Program: ${program.name}`
    );

    console.log(
        `Academic Term: ${academicTermId}`
    );

    console.log(
        "----------------------------------------"
    );


    try {

        const sections =
            await getProgramSections(
                program.id,
                academicTermId
            );


        /*
        |--------------------------------------------------------------------------
        | NO SECTIONS
        |--------------------------------------------------------------------------
        */

        if (
            sections.totalSections === 0
        ) {

            console.log(
                `[CAPACITY] ${program.name} | NO SECTIONS`
            );


            return {

                programId:
                    program.id,

                programName:
                    program.name,

                passed:
                    true,

                skipped:
                    true,

                reason:
                    "No sections found for this program in the selected academic term.",

                failureType:
                    null,

                sectionCount:
                    0,

                professorCapacity: {

                    status:
                        "NO_SECTIONS",

                    sufficient:
                        true,

                    sectionCount:
                        0,

                    subjectsAnalyzed:
                        0,

                    activeSubjects:
                        0,

                    requiredTeachingHours:
                        0,

                    totalRequiredProfessorHours:
                        0,

                    availableProfessorCapacity:
                        0,

                    totalPotentialQualifiedCapacity:
                        0,

                    qualifiedProfessorCapacity:
                        0,

                    professorsAvailable:
                        0,

                    minimumProfessorsNeeded:
                        0,

                    minimumProfessorsLowerBound:
                        0,

                    hoursOnlyMinimumProfessors:
                        0,

                    professorShortage:
                        0,

                    subjectBottlenecks:
                        [],

                    minimumProfessorCalculation:
                        null,

                    professors:
                        [],

                    requirements:
                        [],

                    sectionsByYearLevel:
                        {}

                }

            };
        }


        /*
        |--------------------------------------------------------------------------
        | CURRICULUM
        |--------------------------------------------------------------------------
        */

        const curriculum =
            await getProgramCurriculum(
                program.id
            );


        if (
            curriculum.length === 0
        ) {

            console.log(
                `[CAPACITY] ${program.name} | NO CURRICULUM`
            );


            return {

                programId:
                    program.id,

                programName:
                    program.name,

                passed:
                    false,

                skipped:
                    false,

                reason:
                    "Program has sections but no curriculum subjects.",

                failureType:
                    "NO_CURRICULUM",

                sectionCount:
                    sections.totalSections,

                professorCapacity: {

                    status:
                        "NO_CURRICULUM",

                    sufficient:
                        false,

                    sectionCount:
                        sections.totalSections,

                    subjectsAnalyzed:
                        0,

                    activeSubjects:
                        0,

                    requiredTeachingHours:
                        0,

                    totalRequiredProfessorHours:
                        0,

                    availableProfessorCapacity:
                        0,

                    totalPotentialQualifiedCapacity:
                        0,

                    qualifiedProfessorCapacity:
                        0,

                    professorsAvailable:
                        0,

                    minimumProfessorsNeeded:
                        null,

                    minimumProfessorsLowerBound:
                        null,

                    hoursOnlyMinimumProfessors:
                        0,

                    professorShortage:
                        null,

                    subjectBottlenecks:
                        [],

                    minimumProfessorCalculation:
                        null,

                    professors:
                        [],

                    requirements:
                        [],

                    sectionsByYearLevel:
                        Object.fromEntries(
                            sections.sectionsByYearLevel
                        )

                }

            };
        }


        /*
        |--------------------------------------------------------------------------
        | PROFESSOR QUALIFICATIONS
        |--------------------------------------------------------------------------
        */

        const qualificationData =
            await getProfessorQualifications(
                curriculum
            );


        const professors =
            qualificationData.professors;


        /*
        |--------------------------------------------------------------------------
        | CALCULATE
        |--------------------------------------------------------------------------
        */

        const professorCapacity =
            calculateProfessorCapacity({

                sections,

                curriculum,

                professors,

                qualificationsBySubject:
                    qualificationData
                        .qualificationsBySubject

            });


        /*
        |--------------------------------------------------------------------------
        | DEBUG YEAR MATCHING
        |--------------------------------------------------------------------------
        |
        | This is useful if required hours unexpectedly become zero.
        |
        |--------------------------------------------------------------------------
        */

        const activeRequirements =
            professorCapacity.requirements
                .filter(
                    requirement =>
                        requirement.requiredHours > 0
                );


        if (
            activeRequirements.length === 0 &&
            sections.totalSections > 0
        ) {

            console.warn(
                `[WARNING] ${program.name}: sections exist but no curriculum subject matched a section year level.`
            );


            console.warn(
                "Section year levels:",
                [...sections.sectionsByYearLevel.entries()]
            );


            console.warn(
                "Curriculum year levels:",
                [
                    ...new Set(
                        curriculum.map(
                            subject =>
                                subject.yearLevel
                        )
                    )
                ]
            );
        }


        /*
        |--------------------------------------------------------------------------
        | LOG RESULT
        |--------------------------------------------------------------------------
        */

        console.log(
            `\n[CAPACITY RESULT] ${program.name}`
        );

        console.log(
            `Sections: ${professorCapacity.sectionCount}`
        );

        console.log(
            `Subjects analyzed: ${professorCapacity.subjectsAnalyzed}`
        );

        console.log(
            `Active subjects: ${professorCapacity.activeSubjects}`
        );

        console.log(
            `Required teaching hours: ${professorCapacity.requiredTeachingHours}`
        );

        console.log(
            `Available professor capacity: ${professorCapacity.availableProfessorCapacity}`
        );

        console.log(
            `Qualified professor capacity: ${professorCapacity.totalPotentialQualifiedCapacity}`
        );

        console.log(
            `Professors available: ${professorCapacity.professorsAvailable}`
        );

        console.log(
            `Minimum professors needed: ${professorCapacity.minimumProfessorsNeeded ?? "N/A"}`
        );

        console.log(
            `Professor shortage: ${professorCapacity.professorShortage ?? "N/A"}`
        );

        console.log(
            `Subject bottlenecks: ${professorCapacity.subjectBottlenecks.length}`
        );

        console.log(
            `Status: ${professorCapacity.status}`
        );


        const passed =
            professorCapacity.sufficient;


        return {

            programId:
                program.id,

            programName:
                program.name,

            passed,

            skipped:
                false,

            reason:
                passed
                    ? "Professor capacity is sufficient for all active curriculum requirements."
                    : `Professor capacity check failed: ${professorCapacity.status}.`,

            failureType:
                passed
                    ? null
                    : "PROFESSOR_CAPACITY_FAILURE",

            sectionCount:
                professorCapacity.sectionCount,

            professorCapacity

        };

    } catch (error) {

        console.error(
            `[PROGRAM ERROR] ${program.name}:`,
            error
        );


        return {

            programId:
                program.id,

            programName:
                program.name,

            passed:
                false,

            skipped:
                false,

            reason:
                error?.message ||
                String(error),

            failureType:
                "PROGRAM_CHECK_ERROR",

            sectionCount:
                0,

            professorCapacity:
                null

        };
    }
};


/*
|--------------------------------------------------------------------------
| CHECK UNIVERSITY CAPACITY
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| This receives ONLY academicTermId.
|
|--------------------------------------------------------------------------
*/

const checkUniversityCapacity = async (
    academicTermId
) => {

    const termId =
        positiveInt(
            academicTermId
        );


    if (
        termId <= 0
    ) {

        throw new Error(
            "A valid academicTermId is required."
        );
    }


    const programs =
        await getPrograms();


    console.log(
        "\n========================================"
    );

    console.log(
        "UNIVERSITY PROFESSOR CAPACITY CHECK"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Academic Term: ${termId}`
    );

    console.log(
        `Programs: ${programs.length}`
    );

    console.log(
        "Scheduler: NOT USED"
    );

    console.log(
        "Calculation: CURRICULUM + SECTIONS + PROFESSOR MAX HOURS"
    );

    console.log(
        "Professor qualification: professor_subjects"
    );


    const results = [];


    for (
        let index = 0;
        index < programs.length;
        index++
    ) {

        const program =
            programs[index];


        console.log(
            `\n[PROGRAM ${index + 1}/${programs.length}] ` +
            `${program.name}`
        );


        const result =
            await checkProgram({

                program,

                academicTermId:
                    termId

            });


        results.push(
            result
        );
    }


    const skipped =
        results.filter(
            result =>
                result.skipped === true
        );


    const failed =
        results.filter(
            result =>
                result.passed === false &&
                result.skipped === false
        );


    const passed =
        results.filter(
            result =>
                result.passed === true &&
                result.skipped === false
        );


    const totalRequiredProfessorHours =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                num(
                    result
                        ?.professorCapacity
                        ?.requiredTeachingHours
                ),
            0
        );


    const totalAvailableProfessorCapacity =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                num(
                    result
                        ?.professorCapacity
                        ?.availableProfessorCapacity
                ),
            0
        );


    const totalQualifiedProfessorCapacity =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                num(
                    result
                        ?.professorCapacity
                        ?.totalPotentialQualifiedCapacity
                ),
            0
        );


    const totalProgramProfessorRequirement =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                num(
                    result
                        ?.professorCapacity
                        ?.minimumProfessorsNeeded
                ),
            0
        );


    const totalProgramProfessorShortage =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                num(
                    result
                        ?.professorCapacity
                        ?.professorShortage
                ),
            0
        );


    const universityPassed =
        failed.length === 0;


    /*
    |--------------------------------------------------------------------------
    | FINAL LOG
    |--------------------------------------------------------------------------
    */

    console.log(
        "\n========================================"
    );

    console.log(
        "UNIVERSITY PROFESSOR CAPACITY FINISHED"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Academic Term: ${termId}`
    );

    console.log(
        `Total Programs: ${programs.length}`
    );

    console.log(
        `Checked: ${passed.length}`
    );

    console.log(
        `Skipped: ${skipped.length}`
    );

    console.log(
        `Failed: ${failed.length}`
    );

    console.log(
        `Required Professor Hours: ${totalRequiredProfessorHours}`
    );

    console.log(
        `Available Professor Capacity: ${totalAvailableProfessorCapacity}`
    );

    console.log(
        `Qualified Professor Capacity: ${totalQualifiedProfessorCapacity}`
    );

    console.log(
        `Program Professor Requirement: ${totalProgramProfessorRequirement}`
    );

    console.log(
        `Program Professor Shortage: ${totalProgramProfessorShortage}`
    );


    /*
    |--------------------------------------------------------------------------
    | FAILED PROGRAMS
    |--------------------------------------------------------------------------
    */

    if (
        failed.length > 0
    ) {

        console.log(
            "\nFAILED PROGRAMS"
        );


        for (
            const result
            of failed
        ) {

            console.log(
                `- ${result.programName} ` +
                `(${result.programId})`
            );


            console.log(
                `  Reason: ${result.reason}`
            );


            if (
                result.professorCapacity
            ) {

                console.log(
                    `  Required hours: ` +
                    `${result.professorCapacity.requiredTeachingHours}`
                );

                console.log(
                    `  Available capacity: ` +
                    `${result.professorCapacity.availableProfessorCapacity}`
                );

                console.log(
                    `  Qualified capacity: ` +
                    `${result.professorCapacity.totalPotentialQualifiedCapacity}`
                );

                console.log(
                    `  Professors available: ` +
                    `${result.professorCapacity.professorsAvailable}`
                );

                console.log(
                    `  Minimum professors needed: ` +
                    `${result.professorCapacity.minimumProfessorsNeeded ?? "N/A"}`
                );

                console.log(
                    `  Professor shortage: ` +
                    `${result.professorCapacity.professorShortage ?? "N/A"}`
                );

                console.log(
                    `  Subject bottlenecks: ` +
                    `${result.professorCapacity.subjectBottlenecks.length}`
                );
            }
        }
    }


    return {

        passed:
            universityPassed,

        academicTermId:
            termId,

        totalPrograms:
            programs.length,

        checkedPrograms:
            passed.length,

        skippedPrograms:
            skipped.length,

        passedPrograms:
            passed.length,

        failedPrograms:
            failed.length,


        professorSummary: {

            totalRequiredProfessorHours,

            totalAvailableProfessorCapacity,

            totalQualifiedProfessorCapacity,

            totalProgramProfessorRequirement,

            totalProgramProfessorShortage,

            programsWithProfessorProblems:
                failed.length

        },


        results,


        failed:
            failed.map(
                result => ({

                    programId:
                        result.programId,

                    programName:
                        result.programName,

                    reason:
                        result.reason,

                    failureType:
                        result.failureType,

                    sectionCount:
                        result.sectionCount,

                    professorCapacity:
                        result.professorCapacity

                })
            ),


        skipped:
            skipped.map(
                result => ({

                    programId:
                        result.programId,

                    programName:
                        result.programName,

                    reason:
                        result.reason,

                    sectionCount:
                        result.sectionCount,

                    professorCapacity:
                        result.professorCapacity

                })
            ),


        passed:
            passed.map(
                result => ({

                    programId:
                        result.programId,

                    programName:
                        result.programName,

                    sectionCount:
                        result.sectionCount,

                    professorCapacity:
                        result.professorCapacity

                })
            ),


        message:
            universityPassed

                ? skipped.length > 0

                    ? `University professor capacity is sufficient. ` +
                      `${skipped.length} program(s) had no sections and were skipped.`

                    : `University professor capacity is sufficient for all programs.`

                : `University professor capacity is insufficient for ` +
                  `${failed.length} program(s).`

    };
};


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {

    checkUniversityCapacity,

    /*
    |----------------------------------------------------------------------
    | Backward compatibility
    |----------------------------------------------------------------------
    |
    | Existing code calling:
    |
    |     checkEnrollmentCapacity(academicTermId)
    |
    | will continue to work.
    |
    |----------------------------------------------------------------------
    */

    checkEnrollmentCapacity:
        checkUniversityCapacity,

    checkProgram,

    getPrograms

};