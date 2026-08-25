import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../../config.js";
import './styles/Enrollment.css'

const Enrollment = ({ term }) => {

    // =========================================================
    // STATE
    // =========================================================

    const [programs, setPrograms] = useState([]);

    const [selectedProgram, setSelectedProgram] = useState("");

    const [selectedYear, setSelectedYear] = useState("all");

    const [search, setSearch] = useState("");

    const [students, setStudents] = useState([]);

    const [page, setPage] = useState(1);

    const [limit] = useState(50);

    const [totalStudents, setTotalStudents] = useState(0);

    const [hasMore, setHasMore] = useState(false);

    const [loading, setLoading] = useState(false);

    const [programLoading, setProgramLoading] = useState(false);

    const [error, setError] = useState("");

    // =========================================================
    // FETCH PROGRAMS
    // =========================================================

    const fetchPrograms = async () => {

        if (!term?.id) return;

        setProgramLoading(true);
        setError("");

        try {

            const token =
                localStorage.getItem("admin_token");

            const response = await fetch(
                `${API_BASE_URL}/api/auth/admin/getProgramsWithSections?academicTermId=${term.id}`,
                {
                    method: "GET",

                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to fetch programs"
                );
            }

            const programList =
                data.programs ||
                data.result ||
                [];

            setPrograms(programList);

            // Automatically select first program
            if (programList.length > 0) {
                setSelectedProgram(
                    String(programList[0].id)
                );
            }

        } catch (err) {

            console.error(err);

            setError(
                err.message ||
                "Failed to load programs"
            );

        } finally {

            setProgramLoading(false);

        }
    };


    // =========================================================
    // FETCH STUDENTS
    // =========================================================

    const fetchStudents = async (
        pageNumber = 1
    ) => {

        if (!term?.id || !selectedProgram) {
            return;
        }

        setLoading(true);
        setError("");

        try {

            const token =
                localStorage.getItem("admin_token");


            const params =
                new URLSearchParams({

                    academicTermId:
                        String(term.id),

                    programId:
                        String(selectedProgram),

                    page:
                        String(pageNumber),

                    limit:
                        String(limit),

                    ...(selectedYear !== "all" && {
                        yearLevel:
                            selectedYear
                    }),

                    ...(search.trim() && {
                        search:
                            search.trim()
                    })

                });

            console.log("YEAR:", selectedYear);
console.log("REQUEST:", params.toString());
            const response = await fetch(
                `${API_BASE_URL}/api/auth/admin/getCurrentlyEnrolledStudents?${params}`,
                {
                    method: "GET",

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );


            const data =
                await response.json();

            console.log("all enrolled students: ",data)
            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to fetch students"
                );
            }


            const result =
                data.result;


            setStudents(
                result.students || []
            );


            setTotalStudents(
                Number(result.total || 0)
            );


            setHasMore(
                result.hasMore ?? false
            );


            setPage(
                Number(result.page || pageNumber)
            );


        } catch (err) {

            console.error(err);

            setError(
                err.message ||
                "Failed to load students"
            );

            setStudents([]);

        } finally {

            setLoading(false);

        }
    };


    // =========================================================
    // INITIAL PROGRAM LOAD
    // =========================================================

    useEffect(() => {

        setPrograms([]);
        setSelectedProgram("");
        setStudents([]);
        setPage(1);

        fetchPrograms();

    }, [term?.id]);


    // =========================================================
    // FETCH WHEN FILTER CHANGES
    // =========================================================

    useEffect(() => {

        if (!selectedProgram) {
            return;
        }

        fetchStudents(1);

    }, [
        selectedProgram,
        selectedYear
    ]);


    // =========================================================
    // SEARCH DEBOUNCE
    // =========================================================

    useEffect(() => {

        if (!selectedProgram) {
            return;
        }

        const timeout =
            setTimeout(() => {

                fetchStudents(1);

            }, 400);


        return () => {
            clearTimeout(timeout);
        };

    }, [search]);


    // =========================================================
    // PAGINATION
    // =========================================================

    const totalPages =
        Math.ceil(
            totalStudents / limit
        );


    const nextPage = () => {

        if (
            hasMore &&
            !loading
        ) {

            fetchStudents(
                page + 1
            );

        }
    };


    const previousPage = () => {

        if (
            page > 1 &&
            !loading
        ) {

            fetchStudents(
                page - 1
            );

        }
    };


    // =========================================================
    // SELECTED PROGRAM
    // =========================================================

    const currentProgram =
        programs.find(
            program =>
                String(program.id) ===
                String(selectedProgram)
        );


    // =========================================================
    // RENDER
    // =========================================================

    return (

        <div className="enrollment-page">


            {/* =================================================
                HEADER
            ================================================= */}

            <div className="enrollment-header">

                <div>

                    <h1>
                        Current Enrollment
                    </h1>

                    <p>
                        Manage students currently enrolled
                        for the selected academic term.
                    </p>

                </div>


                <button
                    className="enrollment-refresh"
                    onClick={() =>
                        fetchStudents(page)
                    }
                    disabled={loading}
                >
                    ↻ Refresh
                </button>

            </div>


            {/* =================================================
                TERM
            ================================================= */}

            {term && (

                <div className="enrollment-term">

                    <div>

                        <span>
                            Academic Year
                        </span>

                        <strong>
                            {term.school_year}
                        </strong>

                    </div>


                    <div>

                        <span>
                            Semester
                        </span>

                        <strong>
                            {term.semester}
                        </strong>

                    </div>


                    <div>

                        <span>
                            Enrollment
                        </span>

                        <strong>
                            {term.enrollment_open
                                ? "Open"
                                : "Closed"
                            }
                        </strong>

                    </div>

                </div>

            )}


            {/* =================================================
                STATISTICS
            ================================================= */}

            <div className="enrollment-stats">

                <div className="enrollment-stat">

                    <span>
                        Selected Program
                    </span>

                    <strong>
                        {currentProgram?.program_code ||
                            "—"}
                    </strong>

                </div>


                <div className="enrollment-stat">

                    <span>
                        Program
                    </span>

                    <strong>
                        {currentProgram?.program_name ||
                            "—"}
                    </strong>

                </div>


                <div className="enrollment-stat">

                    <span>
                        Total Enrolled
                    </span>

                    <strong>
                        {totalStudents.toLocaleString()}
                    </strong>

                </div>


                <div className="enrollment-stat">

                    <span>
                        Showing
                    </span>

                    <strong>
                        {students.length}
                    </strong>

                </div>

            </div>


            {/* =================================================
                FILTER BAR
            ================================================= */}

            <div className="enrollment-filters">


                {/* PROGRAM */}

                <div className="filter-group">

                    <label>
                        Program
                    </label>

                    <select
                        value={selectedProgram}
                        onChange={(e) => {

                            setSelectedProgram(
                                e.target.value
                            );

                            setPage(1);

                        }}
                        disabled={
                            programLoading
                        }
                    >

                        <option value="">
                            Select Program
                        </option>

                        {programs.map(
                            program => (

                                <option
                                    key={program.id}
                                    value={program.id}
                                >
                                    {program.program_code}
                                    {" — "}
                                    {program.program_name}
                                </option>

                            )
                        )}

                    </select>

                </div>


                {/* YEAR */}

                <div className="filter-group">

                    <label>
                        Year Level
                    </label>

                    <select
                        value={selectedYear}
                        onChange={(e) =>
                            setSelectedYear(
                                e.target.value
                            )
                        }
                    >
                        <option value="all">All Year Levels</option>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                    </select>

                </div>


                {/* SEARCH */}

                <div className="filter-group search-group">

                    <label>
                        Search
                    </label>

                    <input
                        type="text"
                        value={search}
                        onChange={(e) =>
                            setSearch(
                                e.target.value
                            )
                        }
                        placeholder="Search student ID or name..."
                    />

                </div>


                {/* CLEAR */}

                <button
                    className="clear-filter"
                    onClick={() => {

                        setSearch("");

                        setSelectedYear("all");

                    }}
                >
                    Clear
                </button>

            </div>


            {/* =================================================
                ERROR
            ================================================= */}

            {error && (

                <div className="enrollment-error">

                    {error}

                </div>

            )}


            {/* =================================================
                TABLE
            ================================================= */}

            <div className="enrollment-table-card">


                <div className="table-header">

                    <div>

                        <h2>
                            Enrolled Students
                        </h2>

                        <p>

                            {totalStudents.toLocaleString()}
                            {" "}
                            students found

                        </p>

                    </div>

                </div>


                <div className="table-wrapper">

                    <table>

                        <thead>

                            <tr>

                                <th>
                                    #
                                </th>

                                <th>
                                    Student ID
                                </th>

                                <th>
                                    Name
                                </th>

                                <th>
                                    Year
                                </th>

                                <th>
                                    Section
                                </th>

                                <th>
                                    Status
                                </th>

                                <th>
                                    Action
                                </th>

                            </tr>

                        </thead>


                        <tbody>


                            {loading ? (

                                <tr>

                                    <td
                                        colSpan="7"
                                        className="table-loading"
                                    >
                                        Loading students...
                                    </td>

                                </tr>

                            ) : students.length > 0 ? (

                                students.map(
                                    (student, index) => (

                                        <tr
                                            key={
                                                student.enrollment_id
                                            }
                                        >

                                            <td>
                                                {
                                                    (
                                                        page -
                                                        1
                                                    ) *
                                                        limit +
                                                    index +
                                                    1
                                                }
                                            </td>


                                            <td>

                                                <strong>
                                                    {
                                                        student.school_student_id
                                                    }
                                                </strong>

                                            </td>


                                            <td>

                                                <div className="student-name">

                                                    <strong>

                                                        {
                                                            student.firstname
                                                        }
                                                        {" "}
                                                        {
                                                            student.lastname
                                                        }

                                                    </strong>

                                                    {student.middlename && (

                                                        <small>
                                                            {
                                                                student.middlename
                                                            }
                                                        </small>

                                                    )}

                                                </div>

                                            </td>


                                            <td>
                                                {
                                                    student.year_level
                                                }
                                            </td>


                                            <td>

                                                {
                                                    student.section
                                                        ?.section_name ||
                                                    "—"
                                                }

                                            </td>


                                            <td>

                                                <span
                                                    className={
                                                        `enrollment-status ${
                                                            student.enrollment_status
                                                        }`
                                                    }
                                                >
                                                    {
                                                        student.enrollment_status
                                                    }
                                                </span>

                                            </td>


                                            <td>

                                                <button
                                                    className="view-student"
                                                >
                                                    View
                                                </button>

                                            </td>

                                        </tr>

                                    )
                                )

                            ) : (

                                <tr>

                                    <td
                                        colSpan="7"
                                        className="empty-table"
                                    >

                                        <div>

                                            <strong>
                                                No students found
                                            </strong>

                                            <p>
                                                Try changing your
                                                filters or search.
                                            </p>

                                        </div>

                                    </td>

                                </tr>

                            )}

                        </tbody>

                    </table>

                </div>


                {/* =================================================
                    PAGINATION
                ================================================= */}

                <div className="enrollment-pagination">


                    <div>

                        Showing{" "}

                        <strong>

                            {totalStudents === 0
                                ? 0
                                : (
                                    (page - 1) *
                                        limit +
                                    1
                                )
                            }

                        </strong>

                        {" "}–{" "}

                        <strong>

                            {Math.min(
                                page * limit,
                                totalStudents
                            )}

                        </strong>

                        {" "}of{" "}

                        <strong>
                            {totalStudents.toLocaleString()}
                        </strong>

                    </div>


                    <div className="pagination-buttons">

                        <button
                            onClick={
                                previousPage
                            }
                            disabled={
                                page === 1 ||
                                loading
                            }
                        >
                            ← Previous
                        </button>


                        <span>

                            Page{" "}

                            <strong>
                                {page}
                            </strong>

                            {" "}of{" "}

                            <strong>
                                {totalPages || 1}
                            </strong>

                        </span>


                        <button
                            onClick={
                                nextPage
                            }
                            disabled={
                                !hasMore ||
                                loading
                            }
                        >
                            Next →
                        </button>

                    </div>

                </div>

            </div>

        </div>
    );
};

export default Enrollment;