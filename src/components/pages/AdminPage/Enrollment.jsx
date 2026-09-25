
import React, { useEffect, useState, useRef } from "react";
import { API_BASE_URL } from "../../../config.js";
import "./styles/Enrollment.css";
import StudentModal from "./studentModal/Student";

const Enrollment = ({ term }) => {
    // =========================================================
    // STATE
    // =========================================================

    const [showStudent, setShowStudent] = useState({
        state: false,
        student: null
    });

    const [programs, setPrograms] = useState([]);
    const [selectedProgram, setSelectedProgram] = useState("");
    const [selectedYear, setSelectedYear] = useState("all");

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [students, setStudents] = useState([]);
    const [page, setPage] = useState(1);
    const [limit] = useState(50);

    const [totalStudents, setTotalStudents] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    const [loading, setLoading] = useState(false);
    const [programLoading, setProgramLoading] = useState(false);

    const [error, setError] = useState("");
    const [programError, setProgramError] = useState("");

    const [refreshKey, setRefreshKey] = useState(0);

    const requestId = useRef(0);

    // =========================================================
    // FETCH PROGRAMS
    // =========================================================

    useEffect(() => {
        let isMounted = true;

        const fetchPrograms = async () => {
            if (!term?.id) {
                setPrograms([]);
                setSelectedProgram("");
                setStudents([]);
                setTotalStudents(0);
                setHasMore(false);
                setPage(1);
                return;
            }

            setProgramLoading(true);
            setProgramError("");

            setPrograms([]);
            setSelectedProgram("");
            setStudents([]);
            setTotalStudents(0);
            setHasMore(false);
            setPage(1);

            try {
                const token = localStorage.getItem("admin_token");

                if (!token) {
                    throw new Error("Admin authentication token not found.");
                }

                const params = new URLSearchParams({
                    academicTermId: String(term.id)
                });

                const response = await fetch(
                    `${API_BASE_URL}/api/auth/admin/getProgramsWithSections?${params.toString()}`,
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
                        data.message || "Failed to fetch programs."
                    );
                }

                const programList = Array.isArray(data.programs)
                    ? data.programs
                    : Array.isArray(data.result)
                    ? data.result
                    : [];

                if (!isMounted) return;

                setPrograms(programList);

                if (programList.length > 0) {
                    setSelectedProgram(String(programList[0].id));
                } else {
                    setSelectedProgram("");
                    setStudents([]);
                    setTotalStudents(0);
                    setHasMore(false);
                }

            } catch (err) {
                if (!isMounted) return;

                console.error("Error fetching programs:", err);

                setProgramError(
                    err.message || "Failed to load programs."
                );

                setPrograms([]);
                setSelectedProgram("");

            } finally {
                if (isMounted) {
                    setProgramLoading(false);
                }
            }
        };

        fetchPrograms();

        return () => {
            isMounted = false;
        };
    }, [term?.id]);

    // =========================================================
    // SEARCH DEBOUNCE
    // =========================================================

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedSearch(search.trim());
        }, 400);

        return () => clearTimeout(timeout);
    }, [search]);

    // =========================================================
    // RESET PAGE WHEN FILTERS CHANGE
    // =========================================================

    useEffect(() => {
        setPage(1);
    }, [
        selectedProgram,
        selectedYear,
        debouncedSearch,
        term?.id
    ]);

    // =========================================================
    // FETCH STUDENTS
    // =========================================================

    useEffect(() => {
        const currentRequest = ++requestId.current;
        const controller = new AbortController();

        const fetchStudents = async () => {
            if (!term?.id || !selectedProgram) {
                setStudents([]);
                setTotalStudents(0);
                setHasMore(false);
                setLoading(false);
                setError("");
                return;
            }

            setLoading(true);
            setError("");

            try {
                const token = localStorage.getItem("admin_token");

                if (!token) {
                    throw new Error("Admin authentication token not found.");
                }

                const params = new URLSearchParams({
                    academicTermId: String(term.id),
                    programId: String(selectedProgram),
                    page: String(page),
                    limit: String(limit)
                });

                if (selectedYear !== "all") {
                    params.set("yearLevel", String(selectedYear));
                }

                if (debouncedSearch) {
                    params.set("search", debouncedSearch);
                }

                const response = await fetch(
                    `${API_BASE_URL}/api/auth/admin/getCurrentlyEnrolledStudents?${params.toString()}`,
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        signal: controller.signal
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || "Failed to fetch students."
                    );
                }

                const result = data.result || {};

                const studentList = Array.isArray(result.students)
                    ? result.students
                    : [];

                if (currentRequest !== requestId.current) return;

                setStudents(studentList);
                setTotalStudents(Number(result.total) || 0);
                setHasMore(Boolean(result.hasMore));

            } catch (err) {
                if (
                    err.name === "AbortError" ||
                    currentRequest !== requestId.current
                ) {
                    return;
                }

                console.error("Error fetching enrolled students:", err);

                setError(
                    err.message || "Failed to load students."
                );

                setStudents([]);
                setTotalStudents(0);
                setHasMore(false);

            } finally {
                if (currentRequest === requestId.current) {
                    setLoading(false);
                }
            }
        };

        fetchStudents();

        return () => {
            controller.abort();
        };
    }, [
        term?.id,
        selectedProgram,
        selectedYear,
        debouncedSearch,
        page,
        limit,
        refreshKey
    ]);

    // =========================================================
    // REFRESH
    // =========================================================

    const refreshStudents = () => {
        setRefreshKey((previous) => previous + 1);
    };

    // =========================================================
    // STUDENT MODAL
    // =========================================================

    const handleViewStudent = (student) => {
        setShowStudent({
            state: true,
            student
        });
    };

    const handleCloseStudent = () => {
        setShowStudent({
            state: false,
            student: null
        });
    };

    // =========================================================
    // PAGINATION
    // =========================================================

    const totalPages = Math.ceil(totalStudents / limit);

    const nextPage = () => {
        if (hasMore && !loading) {
            setPage((currentPage) => currentPage + 1);
        }
    };

    const previousPage = () => {
        if (page > 1 && !loading) {
            setPage((currentPage) => currentPage - 1);
        }
    };

    // =========================================================
    // SELECTED PROGRAM
    // =========================================================

    const currentProgram = programs.find(
        (program) =>
            String(program.id) === String(selectedProgram)
    );

    // =========================================================
    // CLEAR FILTERS
    // =========================================================

    const clearFilters = () => {
        setSearch("");
        setDebouncedSearch("");
        setSelectedYear("all");
        setPage(1);
    };

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <div className="enrollment-page">

            {/* STUDENT MODAL */}

            {showStudent.state && (
                <StudentModal
                    selectedStudent={showStudent.student}
                    onClose={handleCloseStudent}
                />
            )}

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="enrollment-header">

                <div>
                    <h1>Current Enrollment</h1>

                    <p>
                        Manage students currently enrolled
                        for the selected academic term.
                    </p>
                </div>

                <button
                    type="button"
                    className="enrollment-refresh"
                    onClick={refreshStudents}
                    disabled={loading || !selectedProgram}
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
                        <span>Academic Year</span>
                        <strong>{term.school_year || "—"}</strong>
                    </div>

                    <div>
                        <span>Semester</span>
                        <strong>{term.semester || "—"}</strong>
                    </div>

                    <div>
                        <span>Enrollment</span>
                        <strong>
                            {term.enrollment_open ? "Open" : "Closed"}
                        </strong>
                    </div>

                </div>
            )}

            {/* =================================================
                STATISTICS
            ================================================= */}

            <div className="enrollment-stats">

                <div className="enrollment-stat">
                    <span>Selected Program</span>
                    <strong>
                        {currentProgram?.program_code || "—"}
                    </strong>
                </div>

                <div className="enrollment-stat">
                    <span>Program</span>
                    <strong>
                        {currentProgram?.program_name || "—"}
                    </strong>
                </div>

                <div className="enrollment-stat">
                    <span>Total Enrolled</span>
                    <strong>
                        {totalStudents.toLocaleString()}
                    </strong>
                </div>

                <div className="enrollment-stat">
                    <span>Showing</span>
                    <strong>{students.length}</strong>
                </div>

            </div>

            {/* =================================================
                FILTER BAR
            ================================================= */}

            <div className="enrollment-filters">

                {/* PROGRAM */}

                <div className="filter-group">
                    <label htmlFor="enrollment-program">
                        Program
                    </label>

                    <select
                        id="enrollment-program"
                        value={selectedProgram}
                        onChange={(e) => {
                            setSelectedProgram(e.target.value);
                            setPage(1);
                        }}
                        disabled={programLoading}
                    >
                        <option value="">
                            {programLoading
                                ? "Loading Programs..."
                                : "Select Program"}
                        </option>

                        {programs.map((program) => (
                            <option
                                key={program.id}
                                value={String(program.id)}
                            >
                                {program.program_code}
                                {" — "}
                                {program.program_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* YEAR */}

                <div className="filter-group">
                    <label htmlFor="enrollment-year">
                        Year Level
                    </label>

                    <select
                        id="enrollment-year"
                        value={selectedYear}
                        onChange={(e) => {
                            setSelectedYear(e.target.value);
                            setPage(1);
                        }}
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
                    <label htmlFor="enrollment-search">
                        Search
                    </label>

                    <input
                        id="enrollment-search"
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                        }}
                        placeholder="Search student ID or name..."
                    />
                </div>

                {/* CLEAR */}

                <button
                    type="button"
                    className="clear-filter"
                    onClick={clearFilters}
                    disabled={
                        search === "" &&
                        selectedYear === "all"
                    }
                >
                    Clear
                </button>

            </div>

            {/* =================================================
                ERROR
            ================================================= */}

            {programError && (
                <div className="enrollment-error" role="alert">
                    {programError}
                </div>
            )}

            {error && (
                <div className="enrollment-error" role="alert">
                    {error}
                </div>
            )}

            {/* =================================================
                TABLE
            ================================================= */}

            <div className="enrollment-table-card">

                <div className="table-header">
                    <div>
                        <h2>Enrolled Students</h2>

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
                                <th>#</th>
                                <th>Student ID</th>
                                <th>Name</th>
                                <th>Year</th>
                                <th>Section</th>
                                <th>Status</th>
                                <th>Action</th>
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
                                students.map((student, index) => (
                                    <tr
                                        key={
                                            student.enrollment_id ??
                                            student.student_id ??
                                            student.school_student_id ??
                                            index
                                        }
                                    >
                                        <td>
                                            {(page - 1) * limit + index + 1}
                                        </td>

                                        <td>
                                            <strong>
                                                {student.school_student_id || "—"}
                                            </strong>
                                        </td>

                                        <td>
                                            <div className="student-name">
                                                <strong>
                                                    {[
                                                        student.firstname,
                                                        student.lastname
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" ") || "N/A"}
                                                </strong>

                                                {student.middlename && (
                                                    <small>
                                                        {student.middlename}
                                                    </small>
                                                )}
                                            </div>
                                        </td>

                                        <td>
                                            {student.year_level
                                                ? `${student.year_level}${
                                                    student.year_level === 1
                                                        ? "st"
                                                        : student.year_level === 2
                                                        ? "nd"
                                                        : student.year_level === 3
                                                        ? "rd"
                                                        : "th"
                                                } Year`
                                                : "—"}
                                        </td>

                                        <td>
                                            {student.section?.section_name || "—"}
                                        </td>

                                        <td>
                                            <span
                                                className={`enrollment-status ${
                                                    String(
                                                        student.enrollment_status || ""
                                                    ).toLowerCase()
                                                }`}
                                            >
                                                {student.enrollment_status ||
                                                    "Enrolled"}
                                            </span>
                                        </td>

                                        <td>
                                            <button
                                                type="button"
                                                className="view-student"
                                                onClick={() =>
                                                    handleViewStudent(student)
                                                }
                                            >
                                                View
                                            </button>
                                        </td>

                                    </tr>
                                ))
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
                                : (page - 1) * limit + 1}
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
                            type="button"
                            onClick={previousPage}
                            disabled={page <= 1 || loading}
                        >
                            ← Previous
                        </button>

                        <span>
                            Page{" "}
                            <strong>{page}</strong>
                            {" "}of{" "}
                            <strong>{totalPages || 1}</strong>
                        </span>

                        <button
                            type="button"
                            onClick={nextPage}
                            disabled={!hasMore || loading}
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