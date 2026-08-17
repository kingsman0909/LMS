import React, { useEffect, useMemo, useState } from "react";
import {
  HiSearch,
  HiOutlineFilter,
  HiOutlineDotsVertical,
  HiOutlineUserGroup,
  HiOutlineAcademicCap,
  HiOutlineClipboardList,
  HiOutlineCalendar,
  HiOutlineMail,
  HiOutlineExclamation,
  HiOutlineEye,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineDownload,
  HiX
} from "react-icons/hi";

import "../../../styles/ProfPage.css";

const ProfStudent = () => {

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);

  const [showFilters, setShowFilters] = useState(false);
  const [showMenu, setShowMenu] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | TEMPORARY DATA
  |--------------------------------------------------------------------------
  | Palitan mo ito ng fetch() sa backend kapag ready na.
  */

  useEffect(() => {

    const loadStudents = async () => {

      try {

        // Example future API:
        // const token = localStorage.getItem("token");

        // const response = await fetch(
        //   "http://localhost:3000/api/professor/students",
        //   {
        //     headers: {
        //       Authorization: `Bearer ${token}`
        //     }
        //   }
        // );

        // const data = await response.json();
        // setStudents(data.students);

        const demoStudents = [
          {
            id: 1,
            name: "Juan Dela Cruz",
            studentId: "2026-0001",
            email: "juan@example.com",
            course: "BS Computer Science",
            yearLevel: "2nd Year",
            averageGrade: 89,
            attendance: 94,
            missingAssignments: 1,
            status: "active",
            lastActivity: "Today",
            avatar: "JD"
          },
          {
            id: 2,
            name: "Maria Santos",
            studentId: "2026-0002",
            email: "maria@example.com",
            course: "BS Information Technology",
            yearLevel: "2nd Year",
            averageGrade: 76,
            attendance: 82,
            missingAssignments: 3,
            status: "active",
            lastActivity: "Yesterday",
            avatar: "MS"
          },
          {
            id: 3,
            name: "Pedro Reyes",
            studentId: "2026-0003",
            email: "pedro@example.com",
            course: "BS Computer Science",
            yearLevel: "1st Year",
            averageGrade: 64,
            attendance: 68,
            missingAssignments: 5,
            status: "at-risk",
            lastActivity: "5 days ago",
            avatar: "PR"
          }
        ];

        setStudents(demoStudents);

      } catch (error) {

        console.error("Failed to load students:", error);

      } finally {

        setLoading(false);

      }

    };

    loadStudents();

  }, []);


  /*
  |--------------------------------------------------------------------------
  | FILTERING
  |--------------------------------------------------------------------------
  */

  const filteredStudents = useMemo(() => {

    return students.filter(student => {

      const matchesSearch =
        student.name.toLowerCase().includes(search.toLowerCase()) ||
        student.studentId.toLowerCase().includes(search.toLowerCase()) ||
        student.email.toLowerCase().includes(search.toLowerCase());

      const matchesCourse =
        courseFilter === "all" ||
        student.course === courseFilter;

      const matchesStatus =
        statusFilter === "all" ||
        student.status === statusFilter;

      return matchesSearch && matchesCourse && matchesStatus;

    });

  }, [students, search, courseFilter, statusFilter]);


  /*
  |--------------------------------------------------------------------------
  | SELECTION
  |--------------------------------------------------------------------------
  */

  const toggleStudent = (id) => {

    setSelectedStudents(prev => {

      if (prev.includes(id)) {
        return prev.filter(studentId => studentId !== id);
      }

      return [...prev, id];

    });

  };


  const toggleAll = () => {

    if (selectedStudents.length === filteredStudents.length) {

      setSelectedStudents([]);

    } else {

      setSelectedStudents(
        filteredStudents.map(student => student.id)
      );

    }

  };


  /*
  |--------------------------------------------------------------------------
  | PROFESSOR ACTIONS
  |--------------------------------------------------------------------------
  */

  const markAsAtRisk = (studentId) => {

    setStudents(prev =>
      prev.map(student =>
        student.id === studentId
          ? { ...student, status: "at-risk" }
          : student
      )
    );

    setShowMenu(null);

  };


  const removeStudent = (studentId) => {

    const confirmed = window.confirm(
      "Are you sure you want to remove this student from your class?"
    );

    if (!confirmed) return;

    setStudents(prev =>
      prev.filter(student => student.id !== studentId)
    );

    setShowMenu(null);

  };


  const exportStudents = () => {

    const csv = [
      [
        "Name",
        "Student ID",
        "Email",
        "Course",
        "Year Level",
        "Average Grade",
        "Attendance"
      ],

      ...filteredStudents.map(student => [
        student.name,
        student.studentId,
        student.email,
        student.course,
        student.yearLevel,
        student.averageGrade,
        student.attendance
      ])

    ]
      .map(row => row.join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv"
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "students.csv";

    link.click();

    URL.revokeObjectURL(url);

  };


  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  if (loading) {

    return (
      <div className="students-loading">
        Loading students...
      </div>
    );

  }


  return (

    <div className="students-page">

      {/* HEADER */}

      <div className="students-header">

        <div>

          <span className="page-label">
            PROFESSOR CONTROL
          </span>

          <h1>
            My Students
          </h1>

          <p>
            Monitor, manage, and support students assigned to your classes.
          </p>

        </div>

        <button
          className="export-btn"
          onClick={exportStudents}
        >
          <HiOutlineDownload />
          Export
        </button>

      </div>


      {/* STATISTICS */}

      <div className="student-stats">

        <div className="student-stat-card">

          <div className="stat-icon">
            <HiOutlineUserGroup />
          </div>

          <div>
            <span>Total Students</span>
            <strong>{students.length}</strong>
          </div>

        </div>


        <div className="student-stat-card">

          <div className="stat-icon">
            <HiOutlineAcademicCap />
          </div>

          <div>
            <span>Average Grade</span>

            <strong>
              {
                students.length
                  ? Math.round(
                      students.reduce(
                        (total, student) =>
                          total + student.averageGrade,
                        0
                      ) / students.length
                    )
                  : 0
              }%
            </strong>

          </div>

        </div>


        <div className="student-stat-card">

          <div className="stat-icon">
            <HiOutlineCalendar />
          </div>

          <div>

            <span>Avg. Attendance</span>

            <strong>
              {
                students.length
                  ? Math.round(
                      students.reduce(
                        (total, student) =>
                          total + student.attendance,
                        0
                      ) / students.length
                    )
                  : 0
              }%
            </strong>

          </div>

        </div>


        <div className="student-stat-card danger">

          <div className="stat-icon">
            <HiOutlineExclamation />
          </div>

          <div>

            <span>At Risk</span>

            <strong>
              {
                students.filter(
                  student => student.status === "at-risk"
                ).length
              }
            </strong>

          </div>

        </div>

      </div>


      {/* TOOLBAR */}

      <div className="students-toolbar">

        <div className="search-box">

          <HiSearch />

          <input
            type="text"
            placeholder="Search name, student ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

        </div>


        <button
          className="filter-btn"
          onClick={() => setShowFilters(!showFilters)}
        >

          <HiOutlineFilter />

          Filters

        </button>


        {selectedStudents.length > 0 && (

          <div className="bulk-actions">

            <span>
              {selectedStudents.length} selected
            </span>

            <button>
              <HiOutlineMail />
              Message
            </button>

            <button>
              Mark At Risk
            </button>

          </div>

        )}

      </div>


      {/* FILTERS */}

      {showFilters && (

        <div className="filter-panel">

          <div>

            <label>
              Course
            </label>

            <select
              value={courseFilter}
              onChange={(e) =>
                setCourseFilter(e.target.value)
              }
            >

              <option value="all">
                All Courses
              </option>

              <option value="BS Computer Science">
                BS Computer Science
              </option>

              <option value="BS Information Technology">
                BS Information Technology
              </option>

            </select>

          </div>


          <div>

            <label>
              Status
            </label>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
            >

              <option value="all">
                All Students
              </option>

              <option value="active">
                Active
              </option>

              <option value="at-risk">
                At Risk
              </option>

            </select>

          </div>

        </div>

      )}


      {/* TABLE */}

      <div className="students-table-wrapper">

        <table className="students-table">

          <thead>

            <tr>

              <th>

                <input
                  type="checkbox"
                  checked={
                    filteredStudents.length > 0 &&
                    selectedStudents.length ===
                    filteredStudents.length
                  }
                  onChange={toggleAll}
                />

              </th>

              <th>
                Student
              </th>

              <th>
                Course
              </th>

              <th>
                Performance
              </th>

              <th>
                Attendance
              </th>

              <th>
                Assignments
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

            {filteredStudents.map(student => (

              <tr key={student.id}>

                <td>

                  <input
                    type="checkbox"
                    checked={
                      selectedStudents.includes(student.id)
                    }
                    onChange={() =>
                      toggleStudent(student.id)
                    }
                  />

                </td>


                <td>

                  <div className="student-info">

                    <div className="student-avatar">
                      {student.avatar}
                    </div>

                    <div>

                      <strong>
                        {student.name}
                      </strong>

                      <small>
                        {student.studentId}
                      </small>

                    </div>

                  </div>

                </td>


                <td>

                  <span className="course-name">
                    {student.course}
                  </span>

                  <small>
                    {student.yearLevel}
                  </small>

                </td>


                <td>

                  <div className="progress-info">

                    <strong>
                      {student.averageGrade}%
                    </strong>

                    <div className="progress-bar">

                      <div
                        style={{
                          width: `${student.averageGrade}%`
                        }}
                      />

                    </div>

                  </div>

                </td>


                <td>

                  <span
                    className={
                      student.attendance < 75
                        ? "attendance danger-text"
                        : "attendance"
                    }
                  >

                    {student.attendance}%

                  </span>

                </td>


                <td>

                  <span
                    className={
                      student.missingAssignments > 2
                        ? "missing danger-text"
                        : "missing"
                    }
                  >

                    {student.missingAssignments}
                    {" "}missing

                  </span>

                </td>


                <td>

                  <span
                    className={`status ${student.status}`}
                  >

                    {student.status === "at-risk"
                      ? "At Risk"
                      : "Active"
                    }

                  </span>

                </td>


                <td>

                  <div className="action-wrapper">

                    <button
                      className="view-btn"
                      onClick={() =>
                        setSelectedStudent(student)
                      }
                    >

                      <HiOutlineEye />

                      View

                    </button>


                    <button
                      className="more-btn"
                      onClick={() =>
                        setShowMenu(
                          showMenu === student.id
                            ? null
                            : student.id
                        )
                      }
                    >

                      <HiOutlineDotsVertical />

                    </button>


                    {showMenu === student.id && (

                      <div className="student-menu">

                        <button
                          onClick={() =>
                            setSelectedStudent(student)
                          }
                        >

                          <HiOutlineEye />

                          View Profile

                        </button>


                        <button>

                          <HiOutlineMail />

                          Message Student

                        </button>


                        <button
                          onClick={() =>
                            markAsAtRisk(student.id)
                          }
                        >

                          <HiOutlineExclamation />

                          Mark At Risk

                        </button>


                        <button>

                          <HiOutlinePencil />

                          Add Private Note

                        </button>


                        <button
                          className="danger-action"
                          onClick={() =>
                            removeStudent(student.id)
                          }
                        >

                          <HiOutlineTrash />

                          Remove Student

                        </button>

                      </div>

                    )}

                  </div>

                </td>

              </tr>

            ))}

          </tbody>

        </table>


        {filteredStudents.length === 0 && (

          <div className="empty-students">

            <HiOutlineUserGroup />

            <h3>
              No students found
            </h3>

            <p>
              Try changing your search or filters.
            </p>

          </div>

        )}

      </div>


      {/* STUDENT DETAILS MODAL */}

      {selectedStudent && (

        <div
          className="student-modal-overlay"
          onClick={() =>
            setSelectedStudent(null)
          }
        >

          <div
            className="student-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="close-modal"
              onClick={() =>
                setSelectedStudent(null)
              }
            >

              <HiX />

            </button>


            <div className="profile-header">

              <div className="large-avatar">

                {selectedStudent.avatar}

              </div>

              <div>

                <h2>
                  {selectedStudent.name}
                </h2>

                <p>
                  {selectedStudent.studentId}
                </p>

                <span
                  className={`status ${selectedStudent.status}`}
                >

                  {selectedStudent.status === "at-risk"
                    ? "At Risk"
                    : "Active"}

                </span>

              </div>

            </div>


            <div className="profile-grid">

              <div>

                <span>
                  Email
                </span>

                <strong>
                  {selectedStudent.email}
                </strong>

              </div>


              <div>

                <span>
                  Course
                </span>

                <strong>
                  {selectedStudent.course}
                </strong>

              </div>


              <div>

                <span>
                  Average Grade
                </span>

                <strong>
                  {selectedStudent.averageGrade}%
                </strong>

              </div>


              <div>

                <span>
                  Attendance
                </span>

                <strong>
                  {selectedStudent.attendance}%
                </strong>

              </div>


              <div>

                <span>
                  Missing Assignments
                </span>

                <strong>
                  {selectedStudent.missingAssignments}
                </strong>

              </div>


              <div>

                <span>
                  Last Activity
                </span>

                <strong>
                  {selectedStudent.lastActivity}
                </strong>

              </div>

            </div>


            <div className="profile-actions">

              <button>
                <HiOutlineMail />
                Message Student
              </button>

              <button>
                <HiOutlineClipboardList />
                View Grades
              </button>

              <button>
                <HiOutlineCalendar />
                View Attendance
              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

};

export default ProfStudent;