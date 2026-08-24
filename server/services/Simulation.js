const db = require("../config/db");

const {
    runSingleSimulation
} = require("./scheduleService");


/*
|--------------------------------------------------------------------------
| SIMULATION CAPACITY SERVICE
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| This simulator receives NO configuration parameters.
|
| Everything that describes the real scheduling environment is obtained
| from the database:
|
|   academicTermId
|   programId
|   sections
|   max_students
|
| The ONLY changing value during simulation is the number of students
| being tested.
|
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| LOGGING
|--------------------------------------------------------------------------
*/

const log = (message, meta = {}) => {

    const extra =
        Object.keys(meta).length > 0
            ? ` ${JSON.stringify(meta)}`
            : "";

    console.log(
        `[simulation] ${message}${extra}`
    );
};


const warn = (message, meta = {}) => {

    const extra =
        Object.keys(meta).length > 0
            ? ` ${JSON.stringify(meta)}`
            : "";

    console.warn(
        `[simulation] ${message}${extra}`
    );
};


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const number = value => {

    const n =
        Number(value);

    return Number.isFinite(n)
        ? n
        : 0;
};


/*
|--------------------------------------------------------------------------
| GET ACADEMIC TERM
|--------------------------------------------------------------------------
|
| No request parameter.
|
| The latest academic term represented in the sections table is used.
|
|--------------------------------------------------------------------------
*/

const getAcademicTermId = async () => {

    const [rows] =
        await db.query(`
            SELECT
                MAX(academic_term_id) AS academicTermId
            FROM sections
            WHERE academic_term_id IS NOT NULL
        `);


    const academicTermId =
        number(
            rows?.[0]?.academicTermId
        );


    if (academicTermId <= 0) {

        throw new Error(
            "No academic term was found in the sections table."
        );
    }


    return academicTermId;
};


/*
|--------------------------------------------------------------------------
| GET PROGRAMS
|--------------------------------------------------------------------------
|
| Programs are discovered from the real sections table.
|
|--------------------------------------------------------------------------
*/

const getPrograms = async academicTermId => {

    const [rows] =
        await db.query(
            `
            SELECT DISTINCT
                program_id AS programId
            FROM sections
            WHERE academic_term_id = ?
              AND program_id IS NOT NULL
            ORDER BY program_id
            `,
            [
                academicTermId
            ]
        );


    return rows
        .map(
            row =>
                number(
                    row.programId
                )
        )
        .filter(
            programId =>
                programId > 0
        );
};


/*
|--------------------------------------------------------------------------
| GET REAL SECTIONS FOR PROGRAM
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| max_students comes directly from sections.
|
|--------------------------------------------------------------------------
*/

const getProgramSections = async ({
    programId,
    academicTermId
}) => {

    const [rows] =
        await db.query(
            `
            SELECT
                id,
                program_id AS programId,
                academic_term_id AS academicTermId,
                year_level AS yearLevel,
                section_name AS sectionName,
                max_students AS maxStudents
            FROM sections
            WHERE program_id = ?
              AND academic_term_id = ?
            ORDER BY
                year_level,
                section_name
            `,
            [
                programId,
                academicTermId
            ]
        );


    return rows;
};


/*
|--------------------------------------------------------------------------
| GET TOTAL REAL DATABASE CAPACITY
|--------------------------------------------------------------------------
*/

const getDatabaseCapacity = sections => {

    return sections.reduce(
        (
            total,
            section
        ) => {

            return (
                total +
                Math.max(
                    0,
                    number(
                        section.maxStudents
                    )
                )
            );

        },
        0
    );
};


/*
|--------------------------------------------------------------------------
| CHECK SCHEDULER RESULT
|--------------------------------------------------------------------------
*/

const schedulerSuccess = result => {

    if (!result) {
        return false;
    }


    if (
        result.success !== true
    ) {
        return false;
    }


    if (
        number(
            result.failedSections
        ) > 0
    ) {
        return false;
    }


    return true;
};


/*
|--------------------------------------------------------------------------
| RUN ONE REAL SCHEDULER SIMULATION
|--------------------------------------------------------------------------
|
| IMPORTANT FIX:
|
| We imported:
|
|     runScheduler: runSingleSimulation
|
| therefore we MUST call:
|
|     runSingleSimulation(...)
|
| NOT:
|
|     runScheduler(...)
|
|--------------------------------------------------------------------------
*/

const runCapacityTest = async ({
    programId,
    academicTermId,
    students
}) => {

    const started =
        Date.now();


    log(
        "scheduler simulation attempt",
        {
            programId,
            students
        }
    );


    try {

        /*
        |--------------------------------------------------------------------------
        | REAL SCHEDULER
        |--------------------------------------------------------------------------
        |
        | The scheduler itself is responsible for:
        |
        |   - loading curriculum
        |   - loading professors
        |   - loading rooms
        |   - loading sections
        |   - loading time slots
        |   - generating schedules
        |
        | We only tell it how many students are being simulated.
        |
        |--------------------------------------------------------------------------
        */

        const result =
            await runSingleSimulation({

                programId,

                academicTermId,

                simulation: true,

                students,

                saveToDatabase: false

            });


        const success =
            schedulerSuccess(
                result
            );


        const elapsed =
            Date.now() -
            started;


        const scheduledStudents =
            number(
                result?.scheduledStudents
            );


        const failedStudents =
            number(
                result?.failedStudents
            );


        const totalSections =
            number(
                result?.totalSections
            );


        const scheduledSections =
            number(
                result?.scheduledSections
            );


        const failedSections =
            number(
                result?.failedSections
            );


        log(
            success
                ? "capacity PASS"
                : "capacity FAIL",
            {
                programId,
                students,
                scheduledStudents,
                failedStudents,
                totalSections,
                scheduledSections,
                failedSections,
                elapsed
            }
        );


        return {

            success,

            students,

            scheduledStudents,

            failedStudents,

            totalSections,

            scheduledSections,

            failedSections,

            elapsed,

            result

        };

    } catch (error) {

        warn(
            "scheduler simulation error",
            {
                programId,
                students,
                error:
                    error.message
            }
        );


        return {

            success: false,

            students,

            scheduledStudents: 0,

            failedStudents:
                students,

            totalSections: 0,

            scheduledSections: 0,

            failedSections: 0,

            elapsed:
                Date.now() -
                started,

            error:
                error.message,

            result: null

        };
    }
};


/*
|--------------------------------------------------------------------------
| FIND MAXIMUM CAPACITY
|--------------------------------------------------------------------------
|
| ALGORITHM
|
| Example:
|
|   500  PASS
|   1000 PASS
|   1500 PASS
|   2000 PASS
|   2500 PASS
|   3000 PASS
|   3500 PASS
|   4000 FAIL
|
| At this exact moment:
|
|   lower = 3500
|   upper = 4000
|
| 4000 becomes a HARD UPPER BOUND.
|
| NEVER:
|
|   4500
|   5000
|
| Instead:
|
|   3750
|   3875
|   3937
|   3968
|   ...
|
|--------------------------------------------------------------------------
*/

const findMaximumCapacity = async ({
    programId,
    academicTermId,
    databaseCapacity,
    sectionCount
}) => {

    /*
    |--------------------------------------------------------------------------
    | NO REAL SECTION CAPACITY
    |--------------------------------------------------------------------------
    */

    if (
        databaseCapacity <= 0
    ) {

        return {

            success: false,

            programId,

            academicTermId,

            maximumCapacity: 0,

            nextFailedCapacity: null,

            exact: true,

            databaseCapacity,

            sectionCount,

            lastSuccessfulTest: null,

            firstFailedTest: null,

            tests: [],

            testCount: 0,

            message:
                "Database section capacity is zero."

        };
    }


    /*
    |--------------------------------------------------------------------------
    | TEST CACHE
    |--------------------------------------------------------------------------
    */

    const tests =
        new Map();


    const test = async students => {

        students =
            Math.floor(
                number(
                    students
                )
            );


        students =
            Math.max(
                1,
                students
            );


        /*
        |--------------------------------------------------------------------------
        | HARD DATABASE LIMIT
        |--------------------------------------------------------------------------
        */

        students =
            Math.min(
                students,
                databaseCapacity
            );


        if (
            tests.has(
                students
            )
        ) {

            return tests.get(
                students
            );
        }


        const result =
            await runCapacityTest({

                programId,

                academicTermId,

                students

            });


        tests.set(
            students,
            result
        );


        return result;
    };


    /*
    |--------------------------------------------------------------------------
    | PHASE 1
    |--------------------------------------------------------------------------
    |
    | Start at 500.
    |
    | Increase by 500 ONLY while everything is passing.
    |
    |--------------------------------------------------------------------------
    */

    let lower = 0;

    let upper = null;

    let lastPass = null;

    let firstFail = null;


    let current =
        Math.min(
            500,
            databaseCapacity
        );


    log(
        "capacity search started",
        {
            programId,
            databaseCapacity,
            sectionCount,
            startingStudents: current
        }
    );


    while (
        current <=
        databaseCapacity
    ) {

        const result =
            await test(
                current
            );


        /*
        |--------------------------------------------------------------------------
        | PASS
        |--------------------------------------------------------------------------
        */

        if (
            result.success
        ) {

            lower =
                current;

            lastPass =
                result;


            /*
            |--------------------------------------------------------------------------
            | DATABASE CAPACITY ITSELF PASSED
            |--------------------------------------------------------------------------
            */

            if (
                current ===
                databaseCapacity
            ) {

                log(
                    "database capacity accepted",
                    {
                        programId,
                        students:
                            current
                    }
                );

                break;
            }


            /*
            |--------------------------------------------------------------------------
            | ONLY HERE MAY WE ADD 500
            |--------------------------------------------------------------------------
            |
            | There has NEVER been a failure yet.
            |
            |--------------------------------------------------------------------------
            */

            const next =
                Math.min(
                    current + 500,
                    databaseCapacity
                );


            current =
                next;


            continue;
        }


        /*
        |--------------------------------------------------------------------------
        | FAIL
        |--------------------------------------------------------------------------
        |
        | THIS IS THE CRITICAL RULE.
        |
        | Once this happens:
        |
        |   upper = current
        |
        | The failed number is LOCKED.
        |
        | We DO NOT add 500 anymore.
        |
        |--------------------------------------------------------------------------
        */

        upper =
            current;

        firstFail =
            result;


        log(
            "failure boundary locked",
            {
                programId,

                workingStudents:
                    lower,

                failedStudents:
                    upper,

                nextTestRange:
                    `${lower}-${upper}`
            }
        );


        /*
        |--------------------------------------------------------------------------
        | STOP PHASE 1 IMMEDIATELY.
        |--------------------------------------------------------------------------
        */

        break;
    }


    /*
    |--------------------------------------------------------------------------
    | EVERYTHING PASSED
    |--------------------------------------------------------------------------
    |
    | Example:
    |
    | database capacity = 3900
    |
    | 3900 PASS
    |
    | There is no failed boundary.
    |
    |--------------------------------------------------------------------------
    */

    if (
        upper === null
    ) {

        const finalTest =
            await test(
                databaseCapacity
            );


        log(
            "maximum database capacity accepted",
            {
                programId,

                maximumCapacity:
                    databaseCapacity
            }
        );


        return {

            success:
                finalTest.success,

            programId,

            academicTermId,

            maximumCapacity:
                databaseCapacity,

            nextFailedCapacity:
                null,

            exact: false,

            databaseCapacity,

            sectionCount,

            lastSuccessfulTest:
                finalTest,

            firstFailedTest:
                null,

            tests:
                [...tests.values()]
                    .sort(
                        (a, b) =>
                            a.students -
                            b.students
                    ),

            testCount:
                tests.size,

            message:
                `Maximum schedulable capacity is ${databaseCapacity} students.`

        };
    }


    /*
    |--------------------------------------------------------------------------
    | PHASE 2 - BINARY SEARCH
    |--------------------------------------------------------------------------
    |
    | VERY IMPORTANT:
    |
    | upper is the FIRST FAILED NUMBER.
    |
    | It can ONLY MOVE DOWN.
    |
    | lower is the LAST WORKING NUMBER.
    |
    | It can ONLY MOVE UP.
    |
    | Neither boundary is allowed to cross.
    |
    |--------------------------------------------------------------------------
    */

    log(
        "binary search started",
        {
            programId,

            working:
                lower,

            failing:
                upper
        }
    );


    while (
        upper -
        lower >
        1
    ) {

        const middle =
            Math.floor(
                (
                    lower +
                    upper
                ) / 2
            );


        const result =
            await test(
                middle
            );


        if (
            result.success
        ) {

            /*
            |--------------------------------------------------------------------------
            | PASS
            |
            | New working boundary.
            |--------------------------------------------------------------------------
            */

            lower =
                middle;

            lastPass =
                result;

        } else {

            /*
            |--------------------------------------------------------------------------
            | FAIL
            |
            | New failure boundary.
            |
            | Notice:
            |
            | upper = middle
            |
            | NEVER:
            |
            | upper = upper + something
            |--------------------------------------------------------------------------
            */

            upper =
                middle;

            firstFail =
                result;
        }


        log(
            "binary search boundary",
            {
                programId,

                tested:
                    middle,

                passed:
                    result.success,

                working:
                    lower,

                failing:
                    upper
            }
        );
    }


    /*
    |--------------------------------------------------------------------------
    | FINAL WORKING VALUE
    |--------------------------------------------------------------------------
    */

    const finalTest =
        await test(
            lower
        );


    const maximumCapacity =
        finalTest.success
            ? lower
            : 0;


    /*
    |--------------------------------------------------------------------------
    | EXACT
    |--------------------------------------------------------------------------
    |
    | Exact means:
    |
    | maximumCapacity PASS
    |
    | maximumCapacity + 1 FAIL
    |
    |--------------------------------------------------------------------------
    */

    const exact =
        upper ===
        maximumCapacity + 1;


    log(
        "maximum capacity found",
        {
            programId,

            maximumCapacity,

            firstFailed:
                upper,

            exact
        }
    );


    return {

        success:
            maximumCapacity > 0,

        programId,

        academicTermId,

        maximumCapacity,

        nextFailedCapacity:
            upper,

        exact,

        databaseCapacity,

        sectionCount,

        lastSuccessfulTest:
            finalTest,

        firstFailedTest:
            firstFail,

        tests:
            [...tests.values()]
                .sort(
                    (a, b) =>
                        a.students -
                        b.students
                ),

        testCount:
            tests.size,

        message:
            maximumCapacity > 0
                ? `Maximum schedulable capacity is ${maximumCapacity} students.`
                : "No schedulable capacity found."

    };
};


/*
|--------------------------------------------------------------------------
| RUN ALL PROGRAMS
|--------------------------------------------------------------------------
|
| CONTROLLER DOES:
|
|     checkAllProgramCapacities()
|
| NO ARGUMENTS.
|
|--------------------------------------------------------------------------
*/

const checkAllProgramCapacities = async () => {

    const overallStarted =
        Date.now();


    /*
    |--------------------------------------------------------------------------
    | 1. GET ACADEMIC TERM
    |--------------------------------------------------------------------------
    */

    const academicTermId =
        await getAcademicTermId();


    log(
        "academic term loaded",
        {
            academicTermId
        }
    );


    /*
    |--------------------------------------------------------------------------
    | 2. GET PROGRAMS
    |--------------------------------------------------------------------------
    */

    const programIds =
        await getPrograms(
            academicTermId
        );


    if (
        programIds.length === 0
    ) {

        return {

            success: false,

            academicTermId,

            totalPrograms: 0,

            programs: [],

            elapsed:
                Date.now() -
                overallStarted,

            message:
                "No programs found for the academic term."

        };
    }


    log(
        "programs loaded",
        {
            academicTermId,

            programs:
                programIds
        }
    );


    const results = [];


    /*
    |--------------------------------------------------------------------------
    | 3. RUN EACH PROGRAM SEQUENTIALLY
    |--------------------------------------------------------------------------
    |
    | Program 1
    |   ↓
    | complete
    |   ↓
    | Program 2
    |   ↓
    | complete
    |   ↓
    | Program 3
    |
    | This prevents multiple expensive scheduler simulations from
    | running at the same time.
    |
    |--------------------------------------------------------------------------
    */

    for (
        const programId
        of programIds
    ) {

        const started =
            Date.now();


        log(
            "program simulation started",
            {
                programId,

                academicTermId
            }
        );


        try {

            /*
            |--------------------------------------------------------------------------
            | GET REAL SECTIONS
            |--------------------------------------------------------------------------
            */

            const sections =
                await getProgramSections({

                    programId,

                    academicTermId

                });


            if (
                sections.length === 0
            ) {

                warn(
                    "program has no sections",
                    {
                        programId,

                        academicTermId
                    }
                );


                results.push({

                    success: false,

                    programId,

                    academicTermId,

                    maximumCapacity: 0,

                    nextFailedCapacity: null,

                    exact: true,

                    databaseCapacity: 0,

                    sectionCount: 0,

                    sectionsData: [],

                    tests: [],

                    testCount: 0,

                    message:
                        "No sections found for this program.",

                    elapsed:
                        Date.now() -
                        started

                });


                continue;
            }


            /*
            |--------------------------------------------------------------------------
            | SUM max_students FROM REAL SECTIONS
            |--------------------------------------------------------------------------
            */

            const databaseCapacity =
                getDatabaseCapacity(
                    sections
                );


            log(
                "database section capacity loaded",
                {
                    programId,

                    sectionCount:
                        sections.length,

                    databaseCapacity
                }
            );


            /*
            |--------------------------------------------------------------------------
            | FIND REAL SCHEDULER CAPACITY
            |--------------------------------------------------------------------------
            */

            const result =
                await findMaximumCapacity({

                    programId,

                    academicTermId,

                    databaseCapacity,

                    sectionCount:
                        sections.length

                });


            /*
            |--------------------------------------------------------------------------
            | ATTACH REAL SECTION DATA
            |--------------------------------------------------------------------------
            */

            result.sectionsData =
                sections;


            result.elapsed =
                Date.now() -
                started;


            results.push(
                result
            );


            log(
                "program simulation completed",
                {
                    programId,

                    maximumCapacity:
                        result.maximumCapacity,

                    nextFailedCapacity:
                        result.nextFailedCapacity,

                    elapsed:
                        result.elapsed
                }
            );

        } catch (error) {

            warn(
                "program simulation failed",
                {
                    programId,

                    academicTermId,

                    error:
                        error.message
                }
            );


            results.push({

                success: false,

                programId,

                academicTermId,

                maximumCapacity: 0,

                nextFailedCapacity: null,

                exact: false,

                databaseCapacity: 0,

                sectionCount: 0,

                sectionsData: [],

                tests: [],

                testCount: 0,

                error:
                    error.message,

                elapsed:
                    Date.now() -
                    started

            });
        }
    }


    /*
    |--------------------------------------------------------------------------
    | FINAL RESULT
    |--------------------------------------------------------------------------
    */

    const successfulPrograms =
        results.filter(
            result =>
                result.success === true
        );


    const elapsed =
        Date.now() -
        overallStarted;


    log(
        "all program simulations completed",
        {
            totalPrograms:
                results.length,

            successfulPrograms:
                successfulPrograms.length,

            elapsed
        }
    );


    return {

        success:
            successfulPrograms.length ===
            results.length,

        academicTermId,

        totalPrograms:
            results.length,

        successfulPrograms:
            successfulPrograms.length,

        failedPrograms:
            results.length -
            successfulPrograms.length,

        programs:
            results,

        elapsed,

        message:
            "Student capacity simulation completed."

    };
};


/*
|--------------------------------------------------------------------------
| CONTROLLER-FRIENDLY FUNCTION
|--------------------------------------------------------------------------
|
| NO PARAMETERS.
|
|--------------------------------------------------------------------------
*/

const checkEnrollmentCapacityV2 = async () => {

    return checkAllProgramCapacities();

};


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {

    findMaximumCapacity,

    runCapacityTest,

    checkAllProgramCapacities,

    checkEnrollmentCapacityV2

};