import { useEffect, useState } from "react";
import "./styles/Student.css";

const AllProfessor = () => {

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
                "http://localhost:3000/api/auth/admin/getProfessor",
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (response.ok) {
                setStudents(data.professor);
            }
            else{
                console.log("error")
            }

        } catch (error) {
            console.error(error);
        }

    };

    useEffect(() => {
        fetchStudents();
    }, []);

    const totalStudents = students.length;

    return (

        <div className="student-dashboard">

            <div className="student-header">

                <div>
                    <h1>Professors</h1>
                    <p>Manage all registered students</p>
                </div>

                <button className="add-student-btn">
                    + Add Professor
                </button>

            </div>


            {/* STATISTICS */}

            <div className="student-stats">

                <div className="student-stat-card">
                    <span>Total Professor</span>
                    <h2>{totalStudents}</h2>
                </div>

                <div className="student-stat-card">
                    <span>Pending Applications</span>
                    <h2>0</h2>
                </div>

            </div>


            {/* STUDENT TABLE */}

            <div className="student-content"> 
                


                <div className="student-table-container">

                    <table>

                        <thead>

                            <tr>
                                <th>Professor ID</th>
                                <th>Name</th>
                                <th>Contact no.</th>
                                <th>Department</th>
                                <th>Action</th>
                            </tr>

                        </thead>


                        <tbody>

                            {students.length > 0 ? (

                                students.map((student) => (

                                    <tr key={student.id}>

                                        <td>
                                            {student.employee_id}
                                        </td>

                                        <td>
                                            {student.firstname} {student.lastname}
                                        </td>

                                        <td>
                                            {student.phone}
                                        </td>

                                        <td>
                                            {student.department || "N/A"}
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
                                        No Professor found
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

export default AllProfessor;