import { useEffect, useState } from "react";
import "./styles/Student.css";

const Student = () => {

    const [students, setStudents] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const fetchStudents = async () => {

        try {

            const token = localStorage.getItem("admin_token");

            if(!token){
                return <p>No token</p>
            }
            const response = await fetch(
                "http://localhost:3000/api/auth/admin/getStudents",
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (response.ok) {
                setStudents(data.students);
            }

        } catch (error) {
            console.error(error);
        }

    };

    useEffect(() => {
        fetchStudents();
    }, []);


    const filteredStudents = students.filter((student) => {

        const searchValue = search.toLowerCase();

        const matchesSearch =
            student.firstname?.toLowerCase().includes(searchValue) ||
            student.lastname?.toLowerCase().includes(searchValue) ||
            student.email?.toLowerCase().includes(searchValue) ||
            student.student_id?.toLowerCase().includes(searchValue);

        const matchesStatus =
            statusFilter === "all" ||
            student.status === statusFilter;

        return matchesSearch && matchesStatus;

    });


    const totalStudents = students.length;

    const activeStudents = students.filter(
        student => student.status === "active"
    ).length;

    const inactiveStudents = students.filter(
        student => student.status === "inactive"
    ).length;


    return (

        <div className="student-dashboard">

            <div className="student-header">

                <div>
                    <h1>Students</h1>
                    <p>Manage all registered students</p>
                </div>

                <button className="add-student-btn">
                    + Add Student
                </button>

            </div>


            {/* STATISTICS */}

            <div className="student-stats">

                <div className="student-stat-card">
                    <span>Total Students</span>
                    <h2>{totalStudents}</h2>
                </div>

                <div className="student-stat-card">
                    <span>Active Students</span>
                    <h2>{activeStudents}</h2>
                </div>

                <div className="student-stat-card">
                    <span>Inactive Students</span>
                    <h2>{inactiveStudents}</h2>
                </div>

                <div className="student-stat-card">
                    <span>Pending Applications</span>
                    <h2>0</h2>
                </div>

            </div>


            {/* STUDENT TABLE */}

            <div className="student-content"> 
                <div className="student-tools">

                    <input
                        type="text"
                        placeholder="Search student..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
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


                <div className="student-table-container">

                    <table>

                        <thead>

                            <tr>
                                <th>Student ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Course</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>

                        </thead>


                        <tbody>

                            {filteredStudents.length > 0 ? (

                                filteredStudents.map((student) => (

                                    <tr key={student.id}>

                                        <td>
                                            {student.student_id}
                                        </td>

                                        <td>
                                            {student.firstname} {student.lastname}
                                        </td>

                                        <td>
                                            {student.email}
                                        </td>

                                        <td>
                                            {student.course || "N/A"}
                                        </td>

                                        <td>

                                            <span
                                                className={`student-status ${student.status}`}
                                            >
                                                {student.status}
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

                                ))

                            ) : (

                                <tr>

                                    <td
                                        colSpan="6"
                                        className="no-students"
                                    >
                                        No students found
                                    </td>

                                </tr>

                            )}

                        </tbody>

                    </table>

                </div>

            </div>

        </div>

    );

};

export default Student;