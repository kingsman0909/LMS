import { useEffect, useState, useRef } from "react";
import "./styles/Student.css";

const Student = () => {

    // =========================================================
    // STATE
    // =========================================================

    const [students, setStudents] = useState([]);

    const [page, setPage] = useState(1);

    const [totalStudents, setTotalStudents] = useState(0);

    const [hasMore, setHasMore] = useState(true);

    const [loading, setLoading] = useState(false);

    // SEARCH
    const [search, setSearch] = useState("");

    // STATUS FILTER
    const [statusFilter, setStatusFilter] = useState("all");


    // =========================================================
    // REFS
    // =========================================================

    const loadingRef = useRef(false);

    const observerRef = useRef(null);

    const loadMoreRef = useRef(null);


    // =========================================================
    // FETCH STUDENTS
    // =========================================================

    const fetchStudents = async (
        pageNumber = 1,
        searchValue = ""
    ) => {

        // Prevent duplicate requests
        if (loadingRef.current) {
            return;
        }

        // Don't request if there are no more students
        if (pageNumber !== 1 && !hasMore) {
            return;
        }

        loadingRef.current = true;
        setLoading(true);

        try {

            const token =
                localStorage.getItem("admin_token");

            const response = await fetch(
                `http://localhost:3000/api/auth/admin/getStudents?page=${pageNumber}&limit=50&search=${encodeURIComponent(searchValue)}`,
                {
                    method: "GET",

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to fetch students"
                );
            }


            console.log(
                "PAGE:",
                pageNumber,
                "RECEIVED:",
                data.students?.length
            );


            // =================================================
            // FIRST PAGE
            // =================================================

            if (pageNumber === 1) {

                setStudents(
                    data.students || []
                );

            }


            // =================================================
            // NEXT PAGE
            // =================================================

            else {

                setStudents(prev => {

                    const existingIds =
                        new Set(
                            prev.map(
                                student => student.id
                            )
                        );


                    const newStudents =
                        (data.students || [])
                            .filter(
                                student =>
                                    !existingIds.has(
                                        student.id
                                    )
                            );


                    return [
                        ...prev,
                        ...newStudents
                    ];

                });

            }


            // =================================================
            // PAGINATION INFO
            // =================================================

            setTotalStudents(
                data.total || 0
            );

            setHasMore(
                data.hasMore ?? false
            );


            setPage(
                pageNumber
            );


        } catch (error) {

            console.error(
                "Failed to fetch students:",
                error
            );

        } finally {

            loadingRef.current = false;

            setLoading(false);

        }

    };


    // =========================================================
    // INITIAL LOAD
    // =========================================================

    useEffect(() => {

        fetchStudents(
            1,
            ""
        );

    }, []);


    // =========================================================
    // SERVER-SIDE SEARCH
    // =========================================================

    useEffect(() => {

        const timeout = setTimeout(() => {

            setPage(1);

            setHasMore(true);

            fetchStudents(
                1,
                search
            );

        }, 400);

        return () => {
            clearTimeout(timeout);
        };

    }, [search]);


    // =========================================================
    // INFINITE SCROLL
    // =========================================================

    useEffect(() => {

        const observer =
            new IntersectionObserver(
                entries => {

                    const target =
                        entries[0];


                    if (
                        target.isIntersecting &&
                        !loadingRef.current &&
                        hasMore
                    ) {

                        fetchStudents(
                            page + 1,
                            search
                        );

                    }

                },
                {
                    rootMargin: "300px"
                }
            );


        observerRef.current =
            observer;


        if (loadMoreRef.current) {

            observer.observe(
                loadMoreRef.current
            );

        }


        return () => {

            observer.disconnect();

        };

    }, [
        page,
        hasMore,
        search
    ]);


    // =========================================================
    // FILTERING
    // =========================================================

    // Search is already handled by backend.
    // Only status filtering remains local.

    const filteredStudents =
        students.filter(student => {

            const matchesStatus =
                statusFilter === "all" ||
                student.status === statusFilter;


            return matchesStatus;

        });


    // =========================================================
    // STATISTICS
    // =========================================================

    const activeStudents =
        students.filter(
            student =>
                student.status === "active"
        ).length;


    const inactiveStudents =
        students.filter(
            student =>
                student.status === "inactive"
        ).length;


    // =========================================================
    // RENDER
    // =========================================================

    return (

        <div className="student-dashboard">


            {/* =================================================
                HEADER
            ================================================= */}

            <div className="student-header">

                <div>

                    <h1>
                        Students
                    </h1>

                    <p>
                        Manage all registered students
                    </p>

                </div>


                <button
                    className="add-student-btn"
                >
                    + Add Student
                </button>

            </div>


            {/* =================================================
                STATISTICS
            ================================================= */}

            <div className="student-stats">


                <div className="student-stat-card">

                    <span>
                        Total Students
                    </span>

                    <h2>
                        {totalStudents}
                    </h2>

                </div>


                <div className="student-stat-card">

                    <span>
                        Active Students
                    </span>

                    <h2>
                        {totalStudents}
                    </h2>

                </div>


                <div className="student-stat-card">

                    <span>
                        Inactive Students
                    </span>

                    <h2>
                        {inactiveStudents}
                    </h2>

                </div>


                <div className="student-stat-card">

                    <span>
                        Pending Applications
                    </span>

                    <h2>
                        0
                    </h2>

                </div>


            </div>


            {/* =================================================
                STUDENT CONTENT
            ================================================= */}

            <div className="student-content">


                {/* =================================================
                    TOOLS
                ================================================= */}

                <div className="student-tools">


                    {/* SEARCH */}

                    <input
                        type="text"
                        placeholder="Search student..."
                        value={search}
                        onChange={(e) =>
                            setSearch(e.target.value)
                        }
                    />


                    {/* STATUS */}

                    <select
                        value={statusFilter}
                        onChange={(e) =>
                            setStatusFilter(
                                e.target.value
                            )
                        }
                    >

                        <option value="all">
                            All Status
                        </option>

                        <option value="active">
                            Active
                        </option>

                        <option value="inactive">
                            Inactive
                        </option>

                    </select>

                </div>


                {/* =================================================
                    TABLE
                ================================================= */}

                <div className="student-table-container">


                    <table>


                        <thead>

                            <tr>

                                <th>
                                    Student ID
                                </th>

                                <th>
                                    Name
                                </th>

                                <th>
                                    Email
                                </th>

                                <th>
                                    Course
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


                            {filteredStudents.length > 0 ? (

                                filteredStudents.map(
                                    student => (

                                        <tr
                                            key={student.id}
                                        >


                                            <td>

                                                {
                                                    student.student_id
                                                }

                                            </td>


                                            <td>

                                                {
                                                    student.firstname
                                                }{" "}

                                                {
                                                    student.lastname
                                                }

                                            </td>


                                            <td>

                                                {
                                                    student.email
                                                }

                                            </td>


                                            <td>

                                                {
                                                    student.course ||
                                                    "N/A"
                                                }

                                            </td>


                                            <td>

                                                <span
                                                    className={
                                                        `student-status ${student.status}`
                                                    }
                                                >

                                                    {
                                                        student.status
                                                    }

                                                </span>

                                            </td>


                                            <td>

                                                <button
                                                    className="view-student-btn"
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
                                        colSpan="6"
                                        className="no-students"
                                    >

                                        {
                                            loading
                                                ? "Loading students..."
                                                : "No students found"
                                        }

                                    </td>

                                </tr>

                            )}


                        </tbody>


                    </table>


                    {/* =================================================
                        INFINITE SCROLL TRIGGER
                    ================================================= */}

                    <div
                        ref={loadMoreRef}
                        style={{
                            height: "50px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center"
                        }}
                    >

                        {loading && (

                            <span>
                                Loading more students...
                            </span>

                        )}


                        {!loading &&
                            !hasMore &&
                            students.length > 0 && (

                                <span>
                                    No more students
                                </span>

                            )}

                    </div>


                </div>


            </div>


        </div>

    );

};


export default Student;