import React, { useMemo, useState } from "react";
import "./styles/Submission.css";

/*
|--------------------------------------------------------------------------
| MOCK DATA
|--------------------------------------------------------------------------
| This structure is designed to match the data your Node.js backend can
| eventually return from:
|
| sections
| subjects
| assignments
| student
| assignment_submissions
|
*/

const MOCK_SECTIONS = [
  {
    id: 8,
    name: "BSCS 2-A",
    year_level: 2,
    student_count: 28,
  },
  {
    id: 9,
    name: "BSCS 2-B",
    year_level: 2,
    student_count: 30,
  },
  {
    id: 12,
    name: "BSCS 3-A",
    year_level: 3,
    student_count: 25,
  },
];

const MOCK_SUBJECTS = [
  {
    id: 12,
    code: "CS203",
    name: "Web Development",
  },
  {
    id: 15,
    code: "CS204",
    name: "Database Management",
  },
  {
    id: 18,
    code: "CS205",
    name: "Object-Oriented Programming",
  },
];

const MOCK_ASSIGNMENTS = [
  {
    id: 1,
    section_id: 8,
    subject_id: 12,
    title: "Programming Exercise 03",
    points: 75,
    due_date: "2026-09-12T23:59:00",
    status: "open",
  },
  {
    id: 2,
    section_id: 8,
    subject_id: 12,
    title: "HTML and CSS Layout Activity",
    points: 50,
    due_date: "2026-09-18T23:59:00",
    status: "open",
  },
  {
    id: 3,
    section_id: 8,
    subject_id: 15,
    title: "Database Design Exercise",
    points: 100,
    due_date: "2026-09-20T23:59:00",
    status: "open",
  },
  {
    id: 4,
    section_id: 9,
    subject_id: 12,
    title: "JavaScript DOM Activity",
    points: 80,
    due_date: "2026-09-25T23:59:00",
    status: "open",
  },
  {
    id: 5,
    section_id: 12,
    subject_id: 18,
    title: "OOP Programming Exercise",
    points: 100,
    due_date: "2026-09-22T23:59:00",
    status: "open",
  },
];

/*
|--------------------------------------------------------------------------
| STUDENT SUBMISSIONS
|--------------------------------------------------------------------------
|
| A student only gets a record here when they actually submit.
|
| Students with no record = Pending
|
*/

const MOCK_SUBMISSIONS = [
  {
    id: 1,
    assignment_id: 1,
    student_id: 101,
    section_id: 8,
    subject_id: 12,

    student_name: "Juan Dela Cruz",
    student_number: "2026-00001",

    file_name: "juan-programming-exercise-03.pdf",
    file_path: "submissions/juan-programming-exercise-03.pdf",

    submitted_at: "2026-09-10T20:42:00",

    status: "submitted",

    grade: 72,
    feedback:
      "Good implementation. Improve the responsive layout.",
  },

  {
    id: 2,
    assignment_id: 1,
    student_id: 102,
    section_id: 8,
    subject_id: 12,

    student_name: "Maria Santos",
    student_number: "2026-00002",

    file_name: "maria-programming-exercise-03.pdf",
    file_path: "submissions/maria-programming-exercise-03.pdf",

    submitted_at: "2026-09-11T18:21:00",

    status: "submitted",

    grade: null,
    feedback: null,
  },

  {
    id: 3,
    assignment_id: 1,
    student_id: 103,
    section_id: 8,
    subject_id: 12,

    student_name: "Pedro Reyes",
    student_number: "2026-00003",

    file_name: "pedro-programming-exercise-03.pdf",
    file_path: "submissions/pedro-programming-exercise-03.pdf",

    submitted_at: "2026-09-12T21:14:00",

    status: "submitted",

    grade: 65,
    feedback:
      "Complete, but some JavaScript functions need improvement.",
  },

  {
    id: 4,
    assignment_id: 2,
    student_id: 101,
    section_id: 8,
    subject_id: 12,

    student_name: "Juan Dela Cruz",
    student_number: "2026-00001",

    file_name: "juan-html-css.pdf",
    file_path: "submissions/juan-html-css.pdf",

    submitted_at: "2026-09-16T14:30:00",

    status: "submitted",

    grade: 45,
    feedback: "Good work.",
  },

  {
    id: 5,
    assignment_id: 2,
    student_id: 104,
    section_id: 8,
    subject_id: 12,

    student_name: "Anna Cruz",
    student_number: "2026-00004",

    file_name: "anna-html-css.pdf",
    file_path: "submissions/anna-html-css.pdf",

    submitted_at: "2026-09-17T19:10:00",

    status: "submitted",

    grade: null,
    feedback: null,
  },
];

/*
|--------------------------------------------------------------------------
| STUDENTS
|--------------------------------------------------------------------------
|
| These are students belonging to the selected section.
|
*/

const MOCK_STUDENTS = [
  {
    id: 101,
    section_id: 8,
    student_number: "2026-00001",
    firstname: "Juan",
    lastname: "Dela Cruz",
  },
  {
    id: 102,
    section_id: 8,
    student_number: "2026-00002",
    firstname: "Maria",
    lastname: "Santos",
  },
  {
    id: 103,
    section_id: 8,
    student_number: "2026-00003",
    firstname: "Pedro",
    lastname: "Reyes",
  },
  {
    id: 104,
    section_id: 8,
    student_number: "2026-00004",
    firstname: "Anna",
    lastname: "Cruz",
  },
  {
    id: 105,
    section_id: 8,
    student_number: "2026-00005",
    firstname: "Carlos",
    lastname: "Garcia",
  },
  {
    id: 106,
    section_id: 8,
    student_number: "2026-00006",
    firstname: "Sofia",
    lastname: "Mendoza",
  },
];


function Submission() {
  /*
  |--------------------------------------------------------------------------
  | FILTERS
  |--------------------------------------------------------------------------
  */

  const [selectedSection, setSelectedSection] =
    useState("");

  const [selectedSubject, setSelectedSubject] =
    useState("");

  const [selectedAssignment, setSelectedAssignment] =
    useState("");

  const [search, setSearch] = useState("");

  const [submissionFilter, setSubmissionFilter] =
    useState("all");

  /*
  |--------------------------------------------------------------------------
  | CHECKING MODAL
  |--------------------------------------------------------------------------
  */

  const [selectedSubmission, setSelectedSubmission] =
    useState(null);

  const [grade, setGrade] = useState("");

  const [feedback, setFeedback] = useState("");

  const [savingGrade, setSavingGrade] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | SECTION CHANGE
  |--------------------------------------------------------------------------
  */

  const handleSectionChange = (event) => {
    const value = event.target.value;

    setSelectedSection(value);

    /*
     * Reset dependent filters.
     */
    setSelectedSubject("");
    setSelectedAssignment("");
    setSelectedSubmission(null);
  };

  /*
  |--------------------------------------------------------------------------
  | SUBJECT CHANGE
  |--------------------------------------------------------------------------
  */

  const handleSubjectChange = (event) => {
    const value = event.target.value;

    setSelectedSubject(value);

    setSelectedAssignment("");
    setSelectedSubmission(null);
  };

  /*
  |--------------------------------------------------------------------------
  | ASSIGNMENT CHANGE
  |--------------------------------------------------------------------------
  */

  const handleAssignmentChange = (event) => {
    const value = event.target.value;

    setSelectedAssignment(value);

    setSelectedSubmission(null);
  };

  /*
  |--------------------------------------------------------------------------
  | AVAILABLE SUBJECTS
  |--------------------------------------------------------------------------
  |
  | In the real backend this should come from professor_subjects and
  | the professor's assigned section.
  |
  */

  const availableSubjects = useMemo(() => {
    if (!selectedSection) {
      return [];
    }

    /*
     * Mock:
     * Return subjects that have assignments in this section.
     */

    const subjectIds = [
      ...new Set(
        MOCK_ASSIGNMENTS
          .filter(
            (assignment) =>
              assignment.section_id ===
              Number(selectedSection)
          )
          .map(
            (assignment) =>
              assignment.subject_id
          )
      ),
    ];

    return MOCK_SUBJECTS.filter((subject) =>
      subjectIds.includes(subject.id)
    );
  }, [selectedSection]);

  /*
  |--------------------------------------------------------------------------
  | AVAILABLE ASSIGNMENTS
  |--------------------------------------------------------------------------
  */

  const availableAssignments = useMemo(() => {
    if (
      !selectedSection ||
      !selectedSubject
    ) {
      return [];
    }

    return MOCK_ASSIGNMENTS.filter(
      (assignment) =>
        assignment.section_id ===
          Number(selectedSection) &&
        assignment.subject_id ===
          Number(selectedSubject)
    );
  }, [
    selectedSection,
    selectedSubject,
  ]);

  /*
  |--------------------------------------------------------------------------
  | SELECTED ASSIGNMENT
  |--------------------------------------------------------------------------
  */

  const currentAssignment = useMemo(() => {
    if (!selectedAssignment) {
      return null;
    }

    return (
      MOCK_ASSIGNMENTS.find(
        (assignment) =>
          assignment.id ===
          Number(selectedAssignment)
      ) || null
    );
  }, [selectedAssignment]);

  /*
  |--------------------------------------------------------------------------
  | BUILD STUDENT SUBMISSION LIST
  |--------------------------------------------------------------------------
  |
  | This is important.
  |
  | We start with all students in the section.
  |
  | Then we check if each student has a submission.
  |
  | No submission record = pending.
  |
  */

  const studentSubmissionList = useMemo(() => {
    if (
      !selectedSection ||
      !selectedSubject ||
      !selectedAssignment
    ) {
      return [];
    }

    const students = MOCK_STUDENTS.filter(
      (student) =>
        student.section_id ===
        Number(selectedSection)
    );

    const submissions =
      MOCK_SUBMISSIONS.filter(
        (submission) =>
          submission.section_id ===
            Number(selectedSection) &&
          submission.subject_id ===
            Number(selectedSubject) &&
          submission.assignment_id ===
            Number(selectedAssignment)
      );

    return students.map((student) => {
      const submission =
        submissions.find(
          (item) =>
            item.student_id ===
            student.id
        );

      return {
        student,
        submission: submission || null,

        status: submission
          ? "submitted"
          : "pending",
      };
    });
  }, [
    selectedSection,
    selectedSubject,
    selectedAssignment,
  ]);

  /*
  |--------------------------------------------------------------------------
  | FILTER STUDENTS
  |--------------------------------------------------------------------------
  */

  const filteredSubmissions = useMemo(() => {
    const searchValue =
      search.toLowerCase().trim();

    return studentSubmissionList.filter(
      (item) => {
        const fullName =
          `${item.student.firstname} ${item.student.lastname}`
            .toLowerCase();

        const studentNumber =
          item.student.student_number.toLowerCase();

        const matchesSearch =
          !searchValue ||
          fullName.includes(searchValue) ||
          studentNumber.includes(searchValue);

        const matchesStatus =
          submissionFilter === "all" ||
          item.status === submissionFilter;

        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );
  }, [
    studentSubmissionList,
    search,
    submissionFilter,
  ]);

  /*
  |--------------------------------------------------------------------------
  | STATISTICS
  |--------------------------------------------------------------------------
  */

  const totalStudents =
    studentSubmissionList.length;

  const submittedCount =
    studentSubmissionList.filter(
      (item) =>
        item.status === "submitted"
    ).length;

  const pendingCount =
    totalStudents -
    submittedCount;

  const gradedCount =
    studentSubmissionList.filter(
      (item) =>
        item.submission &&
        item.submission.grade !== null
    ).length;

  /*
  |--------------------------------------------------------------------------
  | OPEN CHECKING MODAL
  |--------------------------------------------------------------------------
  */

  const openSubmission = (item) => {
    if (!item.submission) {
      return;
    }

    setSelectedSubmission(item);

    setGrade(
      item.submission.grade ??
        ""
    );

    setFeedback(
      item.submission.feedback ||
        ""
    );
  };

  /*
  |--------------------------------------------------------------------------
  | SAVE GRADE
  |--------------------------------------------------------------------------
  */

  const handleSaveGrade = async () => {
    if (!selectedSubmission) {
      return;
    }

    const numericGrade =
      Number(grade);

    if (
      grade === "" ||
      Number.isNaN(numericGrade)
    ) {
      alert("Please enter a valid grade.");
      return;
    }

    if (
      currentAssignment &&
      numericGrade >
        Number(currentAssignment.points)
    ) {
      alert(
        `Grade cannot exceed ${currentAssignment.points} points.`
      );

      return;
    }

    try {
      setSavingGrade(true);

      /*
       * MOCK
       */

      await new Promise((resolve) =>
        setTimeout(resolve, 700)
      );

      /*
       * In the real application:
       *
       * PATCH
       * /api/professor/submissions/:id
       *
       * body:
       * {
       *   grade,
       *   feedback
       * }
       */

      console.log(
        "Saving grade:",
        {
          submission_id:
            selectedSubmission
              .submission.id,

          grade: numericGrade,

          feedback,
        }
      );

      alert(
        "Grade saved successfully."
      );

      setSelectedSubmission(null);
    } catch (error) {
      console.error(error);

      alert(
        "Failed to save grade."
      );
    } finally {
      setSavingGrade(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | DATE
  |--------------------------------------------------------------------------
  */

  const formatDateTime = (date) => {
    if (!date) {
      return "—";
    }

    const parsed =
      new Date(date);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return date;
    }

    return parsed.toLocaleString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    );
  };

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className="professor-submissions">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="submissions-page-header">

        <div>
          <h1>
            Student Submissions
          </h1>

          <p>
            Review, grade, and provide
            feedback on student assignments.
          </p>
        </div>

      </div>


      {/* =====================================================
          FILTER PANEL
          ===================================================== */}

      <div className="submission-filter-panel">

        <div className="filter-heading">
          <span className="filter-icon">
            ☰
          </span>

          <div>
            <strong>
              Filter Submissions
            </strong>

            <small>
              Select a section and subject
              to view assignments.
            </small>
          </div>
        </div>


        <div className="filter-grid">

          {/* SECTION */}

          <div className="filter-field">

            <label>
              Section
            </label>

            <select
              value={selectedSection}
              onChange={
                handleSectionChange
              }
            >
              <option value="">
                Select section
              </option>

              {MOCK_SECTIONS.map(
                (section) => (
                  <option
                    key={section.id}
                    value={section.id}
                  >
                    {section.name}
                  </option>
                )
              )}
            </select>

          </div>


          {/* SUBJECT */}

          <div className="filter-field">

            <label>
              Subject
            </label>

            <select
              value={selectedSubject}
              onChange={
                handleSubjectChange
              }
              disabled={
                !selectedSection
              }
            >
              <option value="">
                {selectedSection
                  ? "Select subject"
                  : "Select section first"}
              </option>

              {availableSubjects.map(
                (subject) => (
                  <option
                    key={subject.id}
                    value={subject.id}
                  >
                    {subject.code} —{" "}
                    {subject.name}
                  </option>
                )
              )}
            </select>

          </div>


          {/* ASSIGNMENT */}

          <div className="filter-field">

            <label>
              Assignment
            </label>

            <select
              value={
                selectedAssignment
              }
              onChange={
                handleAssignmentChange
              }
              disabled={
                !selectedSubject
              }
            >
              <option value="">
                {selectedSubject
                  ? "Select assignment"
                  : "Select subject first"}
              </option>

              {availableAssignments.map(
                (assignment) => (
                  <option
                    key={assignment.id}
                    value={assignment.id}
                  >
                    {assignment.title}
                  </option>
                )
              )}
            </select>

          </div>

        </div>

      </div>


      {/* =====================================================
          NO SELECTION
          ===================================================== */}

      {!selectedAssignment && (
        <div className="submission-empty">

          <div className="empty-icon">
            📋
          </div>

          <h2>
            Select an assignment
          </h2>

          <p>
            Choose a section, subject,
            and assignment above to
            view student submissions.
          </p>

        </div>
      )}


      {/* =====================================================
          ASSIGNMENT CONTENT
          ===================================================== */}

      {selectedAssignment &&
        currentAssignment && (
          <>

            {/* ASSIGNMENT HEADER */}

            <div className="assignment-summary">

              <div className="assignment-summary-main">

                <div className="assignment-document-icon">
                  📄
                </div>

                <div>

                  <div className="assignment-title-line">

                    <h2>
                      {
                        currentAssignment.title
                      }
                    </h2>

                    <span
                      className={`assignment-status ${
                        currentAssignment.status
                      }`}
                    >
                      {
                        currentAssignment.status
                      }
                    </span>

                  </div>

                  <p>
                    {
                      MOCK_SUBJECTS.find(
                        (subject) =>
                          subject.id ===
                          currentAssignment.subject_id
                      )?.name
                    }
                  </p>

                </div>

              </div>


              <div className="assignment-summary-meta">

                <div>
                  <span>
                    Points
                  </span>

                  <strong>
                    {
                      currentAssignment.points
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Due
                  </span>

                  <strong>
                    {formatDateTime(
                      currentAssignment.due_date
                    )}
                  </strong>
                </div>

              </div>

            </div>


            {/* =================================================
                STATISTICS
                ================================================= */}

            <div className="submission-stats">

              <div className="submission-stat">

                <span className="stat-number">
                  {totalStudents}
                </span>

                <span className="stat-label">
                  Total Students
                </span>

              </div>

              <div className="submission-stat">

                <span className="stat-number">
                  {submittedCount}
                </span>

                <span className="stat-label">
                  Submitted
                </span>

              </div>

              <div className="submission-stat">

                <span className="stat-number">
                  {pendingCount}
                </span>

                <span className="stat-label">
                  Pending
                </span>

              </div>

              <div className="submission-stat">

                <span className="stat-number">
                  {gradedCount}
                </span>

                <span className="stat-label">
                  Graded
                </span>

              </div>

            </div>


            {/* =================================================
                TABLE TOOLBAR
                ================================================= */}

            <div className="submissions-toolbar">

              <div className="submission-search">

                <span>
                  ⌕
                </span>

                <input
                  type="text"
                  placeholder="Search student..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                />

              </div>


              <div className="submission-status-filter">

                <button
                  type="button"
                  className={
                    submissionFilter ===
                    "all"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setSubmissionFilter(
                      "all"
                    )
                  }
                >
                  All
                </button>

                <button
                  type="button"
                  className={
                    submissionFilter ===
                    "submitted"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setSubmissionFilter(
                      "submitted"
                    )
                  }
                >
                  Submitted
                </button>

                <button
                  type="button"
                  className={
                    submissionFilter ===
                    "pending"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setSubmissionFilter(
                      "pending"
                    )
                  }
                >
                  Pending
                </button>

              </div>

            </div>


            {/* =================================================
                SUBMISSION TABLE
                ================================================= */}

            <div className="submissions-table-wrapper">

              <table className="submissions-table">

                <thead>

                  <tr>

                    <th>
                      Student
                    </th>

                    <th>
                      Submission
                    </th>

                    <th>
                      Submitted
                    </th>

                    <th>
                      Grade
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

                  {filteredSubmissions.length ===
                    0 && (
                    <tr>

                      <td
                        colSpan="6"
                        className="table-empty"
                      >
                        No students found.
                      </td>

                    </tr>
                  )}


                  {filteredSubmissions.map(
                    (item) => {

                      const submission =
                        item.submission;

                      return (
                        <tr
                          key={
                            item.student.id
                          }
                        >

                          {/* STUDENT */}

                          <td>

                            <div className="student-cell">

                              <div className="student-avatar">
                                {item.student.firstname
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div>

                                <strong>
                                  {
                                    item.student
                                      .firstname
                                  }{" "}
                                  {
                                    item.student
                                      .lastname
                                  }
                                </strong>

                                <span>
                                  {
                                    item.student
                                      .student_number
                                  }
                                </span>

                              </div>

                            </div>

                          </td>


                          {/* FILE */}

                          <td>

                            {submission ? (
                              <div className="submission-file-cell">

                                <span className="table-file-icon">
                                  📄
                                </span>

                                <div>

                                  <strong>
                                    {
                                      submission.file_name
                                    }
                                  </strong>

                                  <span>
                                    Submitted file
                                  </span>

                                </div>

                              </div>
                            ) : (
                              <span className="not-submitted">
                                No submission
                              </span>
                            )}

                          </td>


                          {/* DATE */}

                          <td>

                            <span className="submitted-date">

                              {submission
                                ? formatDateTime(
                                    submission.submitted_at
                                  )
                                : "—"}

                            </span>

                          </td>


                          {/* GRADE */}

                          <td>

                            {submission ? (
                              submission.grade !==
                              null ? (
                                <span className="grade-value">

                                  {
                                    submission.grade
                                  }

                                  <small>
                                    /
                                    {
                                      currentAssignment.points
                                    }
                                  </small>

                                </span>
                              ) : (
                                <span className="not-graded">
                                  Not graded
                                </span>
                              )
                            ) : (
                              <span>
                                —
                              </span>
                            )}

                          </td>


                          {/* STATUS */}

                          <td>

                            <span
                              className={`student-submission-status ${item.status}`}
                            >

                              <span className="status-circle" />

                              {item.status ===
                              "submitted"
                                ? "Submitted"
                                : "Pending"}

                            </span>

                          </td>


                          {/* ACTION */}

                          <td>

                            {submission ? (
                              <button
                                type="button"
                                className="check-submission-button"
                                onClick={() =>
                                  openSubmission(
                                    item
                                  )
                                }
                              >
                                {submission.grade !==
                                null
                                  ? "Review"
                                  : "Check"}
                              </button>
                            ) : (
                              <span className="no-action">
                                —
                              </span>
                            )}

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

          </>
        )}


      {/* =====================================================
          CHECK / GRADE MODAL
          ===================================================== */}

      {selectedSubmission && (
        <div
          className="submission-modal-overlay"
          onClick={() =>
            !savingGrade &&
            setSelectedSubmission(
              null
            )
          }
        >

          <div
            className="submission-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div className="submission-modal-header">

              <div>

                <span>
                  Student Submission
                </span>

                <h2>
                  {
                    selectedSubmission
                      .student.firstname
                  }{" "}
                  {
                    selectedSubmission
                      .student.lastname
                  }
                </h2>

                <p>
                  {
                    selectedSubmission
                      .student
                      .student_number
                  }
                </p>

              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setSelectedSubmission(
                    null
                  )
                }
                disabled={
                  savingGrade
                }
              >
                ×
              </button>

            </div>


            {/* MODAL BODY */}

            <div className="submission-modal-body">

              {/* ASSIGNMENT */}

              <div className="modal-assignment-info">

                <span>
                  Assignment
                </span>

                <strong>
                  {
                    currentAssignment.title
                  }
                </strong>

              </div>


              {/* FILE */}

              <div className="modal-file-section">

                <label>
                  Submitted File
                </label>

                <div className="modal-file">

                  <div className="modal-file-icon">
                    📄
                  </div>

                  <div className="modal-file-info">

                    <strong>
                      {
                        selectedSubmission
                          .submission
                          .file_name
                      }
                    </strong>

                    <span>
                      Submitted{" "}
                      {formatDateTime(
                        selectedSubmission
                          .submission
                          .submitted_at
                      )}
                    </span>

                  </div>

                  <button
                    type="button"
                    className="view-submission-file"
                    onClick={() =>
                      alert(
                        "File viewer/download will connect to your Node.js file endpoint."
                      )
                    }
                  >
                    View
                  </button>

                </div>

              </div>


              {/* GRADE */}

              <div className="grading-section">

                <label>
                  Grade
                </label>

                <div className="grade-input-wrapper">

                  <input
                    type="number"
                    min="0"
                    max={
                      currentAssignment.points
                    }
                    value={grade}
                    onChange={(event) =>
                      setGrade(
                        event.target.value
                      )
                    }
                    placeholder="0"
                  />

                  <span>
                    /{" "}
                    {
                      currentAssignment.points
                    }
                  </span>

                </div>

              </div>


              {/* FEEDBACK */}

              <div className="feedback-section">

                <label>
                  Feedback
                </label>

                <textarea
                  value={feedback}
                  onChange={(event) =>
                    setFeedback(
                      event.target.value
                    )
                  }
                  placeholder="Write feedback for the student..."
                  rows="5"
                />

              </div>

            </div>


            {/* MODAL FOOTER */}

            <div className="submission-modal-footer">

              <button
                type="button"
                className="modal-cancel-button"
                onClick={() =>
                  setSelectedSubmission(
                    null
                  )
                }
                disabled={
                  savingGrade
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="save-grade-button"
                onClick={
                  handleSaveGrade
                }
                disabled={
                  savingGrade
                }
              >
                {savingGrade
                  ? "Saving..."
                  : "Save Grade"}
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default Submission;
