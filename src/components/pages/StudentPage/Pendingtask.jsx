import React, {
  useEffect,
  useState,
} from "react";

import "../../../styles/StudentPage.css";
import PdfPreview from "./PdfPreview";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3000";

function PendingTask({
  user,
  academicTerm,
  section_id,
  role,
}) {
  const [assignments, setAssignments] =
    useState([]);

  const [subjects, setSubjects] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [subjectFilter, setSubjectFilter] =
    useState("all");

  const [selectedAssignment, setSelectedAssignment] =
    useState(null);

  const [uploadedFiles, setUploadedFiles] =
    useState({});

  const [submittingId, setSubmittingId] =
    useState(null);

  /*
  |--------------------------------------------------------------------------
  | GET TOKEN
  |--------------------------------------------------------------------------
  */

  const getToken = () => {
    return (
      localStorage.getItem(
        `${role}_token`
      ) ||
      localStorage.getItem(
        "student_token"
      )
    );
  };

  /*
  |--------------------------------------------------------------------------
  | FETCH SUBJECTS
  |--------------------------------------------------------------------------
  */

  const fetchSubjects = async () => {
    try {
      if (!academicTerm?.id) {
        throw new Error(
          "Academic term ID is missing."
        );
      }

      if (!user?.profile?.id) {
        throw new Error(
          "Student ID is missing."
        );
      }

      const token = getToken();

      const params =
        new URLSearchParams();

      params.append(
        "academicTermId",
        academicTerm.id
      );

      params.append(
        "studentId",
        user.profile.id
      );

      const response = await fetch(
        `${API_BASE_URL}/api/auth/getStudentSubjects?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json",

            ...(token && {
              Authorization:
                `Bearer ${token}`,
            }),
          },
        }
      );

      const result =
        await response.json();

      console.log(
        "Student subjects response:",
        result
      );

      if (
        !response.ok ||
        result.success === false
      ) {
        throw new Error(
          result.message ||
          "Failed to fetch subjects."
        );
      }

      const data =
        result.subjects ||
        result.courses ||
        result.data ||
        [];

      setSubjects(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (err) {
      console.error(
        "Failed to load subjects:",
        err
      );

      setSubjects([]);

      setError(
        err.message ||
        "Unable to load subjects."
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | FETCH ASSIGNMENTS
  |--------------------------------------------------------------------------
  */

  const fetchAssignments = async (
    selectedSubjectId = "all"
  ) => {
    try {
      setLoading(true);
      setError("");

      if (!section_id) {
        throw new Error(
          "Student section ID is missing."
        );
      }

      const token = getToken();

      const params =
        new URLSearchParams();

      params.append(
        "sectionId",
        section_id
      );

      if (
        selectedSubjectId &&
        selectedSubjectId !== "all"
      ) {
        params.append(
          "subjectId",
          selectedSubjectId
        );
      }

      const response = await fetch(
        `${API_BASE_URL}/api/auth/student/getStudentAssignments?${params.toString()}`,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",

            ...(token && {
              Authorization:
                `Bearer ${token}`,
            }),
          },
        }
      );

      const result =
        await response.json();

      if (
        !response.ok ||
        result.success === false
      ) {
        throw new Error(
          result.message ||
          "Failed to fetch assignments."
        );
      }

      const data =
        result.assignments ||
        result.data ||
        (
          Array.isArray(result)
            ? result
            : []
        );

      setAssignments(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (err) {
      console.error(
        "Failed to load assignments:",
        err
      );

      setAssignments([]);

      setError(
        err.message ||
        "Unable to load assignments."
      );

    } finally {
      setLoading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | INITIAL LOAD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!section_id) {
      setLoading(false);

      console.log(
        "Student section ID is missing."
      );

      return;
    }

    if (!academicTerm?.id) {
      setLoading(false);

      console.log(
        "Academic term ID is missing."
      );

      return;
    }

    if (!user?.profile?.id) {
      setLoading(false);

      console.log(
        "Student ID is missing."
      );

      return;
    }

    console.log(
      "Loading student assignments and subjects..."
    );

    fetchSubjects();
    fetchAssignments("all");

  }, [
    section_id,
    user?.profile?.id,
    academicTerm?.id,
  ]);

  /*
  |--------------------------------------------------------------------------
  | SUBJECT CHANGE
  |--------------------------------------------------------------------------
  */

  const handleSubjectChange = (
    event
  ) => {
    const subjectId =
      event.target.value;

    setSubjectFilter(
      subjectId
    );

    fetchAssignments(
      subjectId
    );
  };

  /*
  |--------------------------------------------------------------------------
  | FILTER ASSIGNMENTS
  |--------------------------------------------------------------------------
  */

  const filteredAssignments =
    assignments.filter(
      (assignment) => {
        const value =
          search
            .toLowerCase()
            .trim();

        const matchesSearch =
          !value ||
          assignment.title
            ?.toLowerCase()
            .includes(value) ||
          assignment.description
            ?.toLowerCase()
            .includes(value) ||
          assignment.subject_name
            ?.toLowerCase()
            .includes(value) ||
          assignment.subject_code
            ?.toLowerCase()
            .includes(value) ||
          assignment.professor_name
            ?.toLowerCase()
            .includes(value);

        const matchesStatus =
          statusFilter === "all" ||
          assignment.status ===
            statusFilter;

        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );

  /*
  |--------------------------------------------------------------------------
  | DATE HELPERS
  |--------------------------------------------------------------------------
  */

  const formatDueDate = (
    date
  ) => {
    if (!date) {
      return "No due date";
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

    return parsed.toLocaleDateString(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      }
    );
  };

  const formatDueTime = (
    date
  ) => {
    if (!date) {
      return "";
    }

    const parsed =
      new Date(date);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return "";
    }

    return parsed.toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );
  };

  const isPastDue = (
    date
  ) => {
    if (!date) {
      return false;
    }

    const parsed =
      new Date(date);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return false;
    }

    return new Date() > parsed;
  };

  /*
  |--------------------------------------------------------------------------
  | FILE PARSER
  |--------------------------------------------------------------------------
  |
  | New format:
  |
  | ACTIVITY1.1.pdf|https://res.cloudinary.com/...
  |
  | Legacy format:
  |
  | https://...
  | OR
  | ACTIVITY1.1.pdf
  |
  */

  const parseFilePath = (
    filePath
  ) => {
    if (!filePath) {
      return {
        fileName: "",
        fileUrl: null,
      };
    }

    /*
    | New format:
    | filename|url
    */

    if (
      filePath.includes("|")
    ) {
      const separatorIndex =
        filePath.indexOf("|");

      const fileName =
        filePath
          .substring(
            0,
            separatorIndex
          )
          .trim();

      const fileUrl =
        filePath
          .substring(
            separatorIndex + 1
          )
          .trim();

      return {
        fileName,
        fileUrl,
      };
    }

    /*
    | Legacy format
    */

    const cleanPath =
      filePath
        .split("?")[0]
        .split("#")[0];

    const fileName =
      cleanPath
        .split("/")
        .pop() || "";

    let fileUrl = null;

    if (
      filePath.startsWith(
        "http://"
      ) ||
      filePath.startsWith(
        "https://"
      )
    ) {
      fileUrl =
        filePath;
    } else {
      fileUrl =
        `${API_BASE_URL}/uploads/${filePath}`;
    }

    return {
      fileName,
      fileUrl,
    };
  };

  /*
  |--------------------------------------------------------------------------
  | FILE URL
  |--------------------------------------------------------------------------
  */

  const getFileUrl = (
    filePath
  ) => {
    return parseFilePath(
      filePath
    ).fileUrl;
  };

  /*
  |--------------------------------------------------------------------------
  | FILE NAME
  |--------------------------------------------------------------------------
  */

  const getFileName = (
    filePath
  ) => {
    return parseFilePath(
      filePath
    ).fileName;
  };

  /*
  |--------------------------------------------------------------------------
  | FILE EXTENSION
  |--------------------------------------------------------------------------
  */

  const getFileExtension = (
    filePath
  ) => {
    const fileName =
      getFileName(
        filePath
      );

    if (!fileName) {
      return "";
    }

    const cleanName =
      fileName
        .split("?")[0]
        .split("#")[0]
        .toLowerCase();

    if (
      cleanName.endsWith(".pdf")
    ) {
      return "pdf";
    }

    if (
      cleanName.endsWith(".docx")
    ) {
      return "docx";
    }

    if (
      cleanName.endsWith(".doc")
    ) {
      return "doc";
    }

    if (
      cleanName.endsWith(".pptx")
    ) {
      return "pptx";
    }

    if (
      cleanName.endsWith(".ppt")
    ) {
      return "ppt";
    }

    if (
      cleanName.endsWith(".xlsx")
    ) {
      return "xlsx";
    }

    if (
      cleanName.endsWith(".xls")
    ) {
      return "xls";
    }

    if (
      cleanName.endsWith(".txt")
    ) {
      return "txt";
    }

    if (
      cleanName.endsWith(".csv")
    ) {
      return "csv";
    }

    return "";
  };

  /*
  |--------------------------------------------------------------------------
  | FILE TYPE LABEL
  |--------------------------------------------------------------------------
  */

  const getFileTypeLabel = (
    filePath
  ) => {
    const extension =
      getFileExtension(
        filePath
      );

    switch (extension) {
      case "pdf":
        return "PDF";

      case "doc":
      case "docx":
        return "Word";

      case "ppt":
      case "pptx":
        return "PowerPoint";

      case "xls":
      case "xlsx":
        return "Excel";

      case "txt":
        return "TXT";

      case "csv":
        return "CSV";

      default:
        return "Document";
    }
  };

  /*
  |--------------------------------------------------------------------------
  | SELECT FILE
  |--------------------------------------------------------------------------
  */

  const handleFileChange = (
    assignmentId,
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadedFiles(
      (previous) => ({
        ...previous,

        [assignmentId]:
          file,
      })
    );

    event.target.value = "";
  };

  /*
  |--------------------------------------------------------------------------
  | REMOVE FILE
  |--------------------------------------------------------------------------
  */

  const handleRemoveFile = (
    assignmentId
  ) => {
    setUploadedFiles(
      (previous) => {
        const updated = {
          ...previous,
        };

        delete updated[
          assignmentId
        ];

        return updated;
      }
    );
  };

  /*
  |--------------------------------------------------------------------------
  | SUBMIT ASSIGNMENT
  |--------------------------------------------------------------------------
  */

  const handleSubmitAssignment =
    async (
      assignment
    ) => {
      const file =
        uploadedFiles[
          assignment.id
        ];

      if (!file) {
        alert(
          "Please select a file first."
        );

        return;
      }

      try {
        setSubmittingId(
          assignment.id
        );

        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        const token =
          getToken();

        const response =
          await fetch(
            `${API_BASE_URL}/api/student/assignments/${assignment.id}/submit`,
            {
              method: "POST",

              headers: {
                Accept:
                  "application/json",

                ...(token && {
                  Authorization:
                    `Bearer ${token}`,
                }),
              },

              body: formData,
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.message ||
            "Failed to submit assignment."
          );
        }

        const submission =
          result.submission ||
          result.data;

        setAssignments(
          (previous) =>
            previous.map(
              (item) =>
                item.id ===
                assignment.id
                  ? {
                      ...item,
                      submission,
                    }
                  : item
            )
        );

        handleRemoveFile(
          assignment.id
        );

        alert(
          "Assignment submitted successfully."
        );

      } catch (err) {
        console.error(
          "Submission error:",
          err
        );

        alert(
          err.message ||
          "Failed to submit assignment."
        );

      } finally {
        setSubmittingId(
          null
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | FILE SIZE
  |--------------------------------------------------------------------------
  */

  const formatFileSize = (
    bytes
  ) => {
    if (!bytes) {
      return "0 KB";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    const kb =
      bytes / 1024;

    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }

    const mb =
      kb / 1024;

    return `${mb.toFixed(2)} MB`;
  };

  /*
  |--------------------------------------------------------------------------
  | CLEAR FILTERS
  |--------------------------------------------------------------------------
  */

  const clearFilters = () => {
    setSearch("");

    setStatusFilter(
      "all"
    );

    setSubjectFilter(
      "all"
    );

    fetchAssignments(
      "all"
    );
  };

  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="student-assignments">

        <div className="student-assignment-state">

          <div className="student-loading-spinner" />

          <p>
            Loading assignments...
          </p>

        </div>

      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | SELECTED SUBJECT
  |--------------------------------------------------------------------------
  */

  const selectedSubject =
    subjects.find(
      (subject) =>
        String(
          subject.id ||
          subject.subject_id
        ) ===
        String(
          subjectFilter
        )
    );

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className="student-assignments">

      {/* HEADER */}

      <div className="student-assignments-header">

        <div>

          <h1>
            Assignments
          </h1>

          <p>
            View your assignments,
            deadlines, and submission
            requirements.
          </p>

        </div>

        <div className="assignment-summary-box">

          <strong>
            {assignments.length}
          </strong>

          <span>
            Total Assignments
          </span>

        </div>

      </div>

      {/* FILTER PANEL */}

      <div className="student-assignment-filter-panel">

        <div className="student-assignment-search">

          <span className="student-search-icon">
            ⌕
          </span>

          <input
            type="text"
            placeholder="Search assignments..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />

          {search && (
            <button
              type="button"
              className="student-clear-search"
              onClick={() =>
                setSearch("")
              }
            >
              ×
            </button>
          )}

        </div>

        <div className="student-subject-filter">

          <label>
            Subject
          </label>

          <select
            value={subjectFilter}
            onChange={
              handleSubjectChange
            }
          >

            <option value="all">
              All Subjects
            </option>

            {subjects.map(
              (subject) => {
                const id =
                  subject.id ||
                  subject.subject_id;

                const name =
                  subject.subject_name ||
                  subject.name ||
                  "Unknown Subject";

                const code =
                  subject.subject_code ||
                  subject.code ||
                  "";

                return (
                  <option
                    key={id}
                    value={id}
                  >
                    {code
                      ? `${code} - `
                      : ""}
                    {name}
                  </option>
                );
              }
            )}

          </select>

        </div>

        <div className="student-status-filter">

          <label>
            Status
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >

            <option value="all">
              All Status
            </option>

            <option value="open">
              Open
            </option>

            <option value="closed">
              Closed
            </option>

          </select>

        </div>

        {(search ||
          subjectFilter !==
            "all" ||
          statusFilter !==
            "all") && (

          <button
            type="button"
            className="student-clear-filters"
            onClick={
              clearFilters
            }
          >
            Clear Filters
          </button>

        )}

      </div>

      {/* RESULTS */}

      <div className="student-assignment-results">

        <span>
          Showing{" "}
          <strong>
            {
              filteredAssignments.length
            }
          </strong>{" "}
          of{" "}
          <strong>
            {assignments.length}
          </strong>{" "}
          assignments
        </span>

        {subjectFilter !==
          "all" &&
          selectedSubject && (

          <span className="active-subject-label">

            {selectedSubject.subject_name ||
              selectedSubject.name ||
              "Selected Subject"}

          </span>

        )}

      </div>

      {/* ERROR */}

      {error && (

        <div className="student-assignment-state error-state">

          <div className="student-state-icon">
            !
          </div>

          <h3>
            Something went wrong
          </h3>

          <p>
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              fetchAssignments(
                subjectFilter
              )
            }
          >
            Try Again
          </button>

        </div>

      )}

      {/* EMPTY */}

      {!error &&
        filteredAssignments.length ===
          0 && (

        <div className="student-assignment-state">

          <div className="student-state-icon">
            📚
          </div>

          <h3>
            No assignments found
          </h3>

          <p>
            {search ||
            subjectFilter !==
              "all" ||
            statusFilter !==
              "all"
              ? "Try changing your search or filters."
              : "You currently have no assignments."}
          </p>

          {(search ||
            subjectFilter !==
              "all" ||
            statusFilter !==
              "all") && (

            <button
              type="button"
              onClick={
                clearFilters
              }
            >
              Clear Filters
            </button>

          )}

        </div>

      )}

      {/* ASSIGNMENT LIST */}

      {!error &&
        filteredAssignments.length >
          0 && (

        <div className="student-assignment-list">

          {filteredAssignments.map(
            (assignment) => {

              const file =
                uploadedFiles[
                  assignment.id
                ];

              const submitted =
                Boolean(
                  assignment.submission
                );

              const pastDue =
                isPastDue(
                  assignment.due_date
                );

              /*
              | Parse professor file
              */

              const professorFileUrl =
                getFileUrl(
                  assignment.file_path
                );

              const professorFileName =
                getFileName(
                  assignment.file_path
                );

              const professorFileExtension =
                getFileExtension(
                  assignment.file_path
                );

              const isSubmitting =
                submittingId ===
                assignment.id;

              console.log(
                "================================"
              );

              console.log(
                "Assignment:",
                assignment.title
              );

              console.log(
                "FILE PATH:",
                assignment.file_path
              );

              console.log(
                "FILE NAME:",
                professorFileName
              );

              console.log(
                "FILE URL:",
                professorFileUrl
              );

              console.log(
                "FILE EXTENSION:",
                professorFileExtension
              );

              console.log(
                "================================"
              );

              return (
                <article
                  className="student-assignment-card"
                  key={
                    assignment.id
                  }
                >

                  {/* CARD TOP */}

                  <div className="student-card-top">

                    <div className="student-assignment-icon">
                      📄
                    </div>

                    <div className="student-assignment-info">

                      <div className="student-assignment-title-row">

                        <div>

                          <span className="student-assignment-subject-tag">

                            {assignment.subject_code ||
                              assignment.subject_name ||
                              "Subject"}

                          </span>

                          <h2>
                            {
                              assignment.title
                            }
                          </h2>

                        </div>

                        <span
                          className={`student-assignment-status ${
                            assignment.status ===
                            "open"
                              ? "student-status-open"
                              : "student-status-closed"
                          }`}
                        >

                          <span className="status-dot" />

                          {assignment.status ===
                          "open"
                            ? "Open"
                            : "Closed"}

                        </span>

                      </div>

                      {/* PROFESSOR */}

                      <div className="student-assignment-professor">

                        <span className="professor-avatar">

                          {(
                            assignment.professor_name ||
                            "P"
                          )
                            .charAt(0)
                            .toUpperCase()}

                        </span>

                        <span>
                          {assignment.professor_name ||
                            "Unknown Professor"}
                        </span>

                      </div>

                      {/* DESCRIPTION */}

                      {assignment.description && (

                        <p className="student-assignment-description">

                          {
                            assignment.description
                          }

                        </p>

                      )}

                      {/* META */}

                      <div className="student-assignment-meta">

                        <span>

                          <strong>
                            {
                              assignment.points
                            }
                          </strong>{" "}
                          points

                        </span>

                        <span className="meta-divider" />

                        <span>

                          Due{" "}

                          <strong>
                            {formatDueDate(
                              assignment.due_date
                            )}
                          </strong>

                        </span>

                        <span className="meta-divider" />

                        <span>

                          {formatDueTime(
                            assignment.due_date
                          )}

                        </span>

                      </div>

                    </div>

                  </div>

                  {/* PROFESSOR FILE */}

                  {assignment.file_path && (

                    <div className="student-assignment-file-preview">

                      <div className="assignment-preview-header">

                        <div>

                          <span className="file-label">
                            Assignment File
                          </span>

                          <strong className="file-name">

                            {
                              professorFileName ||
                              "Assignment File"
                            }

                          </strong>

                        </div>

                        <span className="file-type-badge">

                          {getFileTypeLabel(
                            assignment.file_path
                          )}

                        </span>

                      </div>

                      {professorFileUrl &&
                        professorFileExtension ===
                          "pdf" ? (

                        <PdfPreview
                          url={
                            professorFileUrl
                          }
                        />

                      ) : (

                        <div
                          className="generic-document-preview"
                          onClick={() => {

                            if (
                              professorFileUrl
                            ) {
                              window.open(
                                professorFileUrl,
                                "_blank",
                                "noopener,noreferrer"
                              );
                            }

                          }}
                        >

                          <div className="generic-document-icon">

                            {professorFileExtension ===
                              "doc" ||
                            professorFileExtension ===
                              "docx"
                              ? "📝"
                              : professorFileExtension ===
                                  "ppt" ||
                                professorFileExtension ===
                                  "pptx"
                              ? "📊"
                              : professorFileExtension ===
                                  "xls" ||
                                professorFileExtension ===
                                  "xlsx"
                              ? "📈"
                              : professorFileExtension ===
                                  "txt"
                              ? "📃"
                              : professorFileExtension ===
                                  "csv"
                              ? "📑"
                              : "📄"}

                          </div>

                          <strong>
                            {getFileTypeLabel(
                              assignment.file_path
                            )}
                          </strong>

                          <span>
                            Click to view file
                          </span>

                        </div>

                      )}

                    </div>

                  )}

                  {/* SUBMISSION */}

                  {!submitted &&
                    assignment.status ===
                      "open" &&
                    !pastDue && (

                    <div className="student-submit-area">

                      <div className="student-submit-label">
                        Your Submission
                      </div>

                      <div className="student-upload-row">

                        <label className="add-file-button">

                          <input
                            type="file"
                            hidden
                            onChange={(
                              event
                            ) =>
                              handleFileChange(
                                assignment.id,
                                event
                              )
                            }
                          />

                          <span className="add-file-plus">
                            +
                          </span>

                          Add File

                        </label>

                        {file && (

                          <div className="student-selected-file">

                            <span className="selected-file-icon">
                              📄
                            </span>

                            <div className="selected-file-details">

                              <strong>
                                {
                                  file.name
                                }
                              </strong>

                              <span>
                                {formatFileSize(
                                  file.size
                                )}
                              </span>

                            </div>

                            <button
                              type="button"
                              className="remove-file-button"
                              onClick={() =>
                                handleRemoveFile(
                                  assignment.id
                                )
                              }
                              disabled={
                                isSubmitting
                              }
                            >
                              ×
                            </button>

                          </div>

                        )}

                        <button
                          type="button"
                          className={`submit-assignment-button ${
                            file
                              ? "submit-ready"
                              : "submit-disabled"
                          }`}
                          disabled={
                            !file ||
                            isSubmitting
                          }
                          onClick={() =>
                            handleSubmitAssignment(
                              assignment
                            )
                          }
                        >

                          {isSubmitting
                            ? "Submitting..."
                            : "Submit Assignment"}

                        </button>

                      </div>

                      {!file && (

                        <span className="upload-helper-text">

                          Add your completed
                          assignment file before
                          submitting.

                        </span>

                      )}

                    </div>

                  )}

                  {/* PAST DUE */}

                  {!submitted &&
                    assignment.status ===
                      "open" &&
                    pastDue && (

                    <div className="student-past-due">

                      <span>
                        ⚠
                      </span>

                      This assignment is
                      past due.

                    </div>

                  )}

                  {/* SUBMITTED */}

                  {submitted && (

                    <div className="student-submission-info">

                      <div className="student-submission-header">

                        <span className="submission-check">
                          ✓
                        </span>

                        <strong>
                          Assignment Submitted
                        </strong>

                      </div>

                      <div className="student-submitted-file">

                        <span>
                          📄
                        </span>

                        <div>

                          <strong>

                            {
                              assignment
                                .submission
                                .file_name
                            }

                          </strong>

                          <small>

                            Submitted{" "}

                            {new Date(
                              assignment
                                .submission
                                .submitted_at
                            ).toLocaleString()}

                          </small>

                        </div>

                      </div>

                    </div>

                  )}

                  {/* FOOTER */}

                  <div className="student-assignment-actions">

                    <button
                      type="button"
                      className="student-view-btn"
                      onClick={() =>
                        setSelectedAssignment(
                          assignment
                        )
                      }
                    >
                      View Details
                    </button>

                    {submitted && (

                      <span className="student-submitted-badge">
                        ✓ Submitted
                      </span>

                    )}

                  </div>

                </article>
              );
            }
          )}

        </div>

      )}

      {/* DETAILS MODAL */}

      {selectedAssignment && (

        <div
          className="student-assignment-modal-overlay"
          onClick={() =>
            setSelectedAssignment(
              null
            )
          }
        >

          <div
            className="student-assignment-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="student-modal-header">

              <div>

                <span className="modal-subject-label">

                  {selectedAssignment.subject_code ||
                    selectedAssignment.subject_name}

                </span>

                <h2>
                  {
                    selectedAssignment.title
                  }
                </h2>

                <p>
                  {
                    selectedAssignment.subject_name
                  }
                </p>

              </div>

              <button
                type="button"
                className="student-modal-close"
                onClick={() =>
                  setSelectedAssignment(
                    null
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="student-modal-body">

              <div className="student-detail-grid">

                <div className="student-detail-row">

                  <span>
                    Professor
                  </span>

                  <strong>
                    {
                      selectedAssignment.professor_name ||
                      "Unknown Professor"
                    }
                  </strong>

                </div>

                <div className="student-detail-row">

                  <span>
                    Section
                  </span>

                  <strong>
                    {
                      selectedAssignment.section_name ||
                      "N/A"
                    }
                  </strong>

                </div>

                <div className="student-detail-row">

                  <span>
                    Points
                  </span>

                  <strong>
                    {
                      selectedAssignment.points
                    }
                  </strong>

                </div>

                <div className="student-detail-row">

                  <span>
                    Status
                  </span>

                  <strong>
                    {
                      selectedAssignment.status
                    }
                  </strong>

                </div>

                <div className="student-detail-row">

                  <span>
                    Due Date
                  </span>

                  <strong>
                    {formatDueDate(
                      selectedAssignment.due_date
                    )}
                  </strong>

                </div>

                <div className="student-detail-row">

                  <span>
                    Due Time
                  </span>

                  <strong>
                    {formatDueTime(
                      selectedAssignment.due_date
                    )}
                  </strong>

                </div>

              </div>

              {/* INSTRUCTIONS */}

              <div className="student-detail-description">

                <h3>
                  Instructions
                </h3>

                <p>

                  {
                    selectedAssignment.description ||
                    "No additional instructions provided."
                  }

                </p>

              </div>

              {/* MODAL FILE */}

              {selectedAssignment.file_path && (

                <div className="modal-assignment-file">

                  <div className="modal-file-header">

                    <div>

                      <small>
                        Assignment File
                      </small>

                      <strong>

                        {
                          getFileName(
                            selectedAssignment.file_path
                          ) ||
                          "Assignment File"
                        }

                      </strong>

                    </div>

                    <span className="file-type-badge">

                      {getFileTypeLabel(
                        selectedAssignment.file_path
                      )}

                    </span>

                  </div>

                  {getFileExtension(
                    selectedAssignment.file_path
                  ) === "pdf" ? (

                    <PdfPreview
                      url={getFileUrl(
                        selectedAssignment.file_path
                      )}
                    />

                  ) : (

                    <div
                      className="generic-document-preview"
                      onClick={() => {

                        const url =
                          getFileUrl(
                            selectedAssignment.file_path
                          );

                        if (url) {
                          window.open(
                            url,
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }

                      }}
                    >

                      <div className="generic-document-icon">

                        {getFileExtension(
                          selectedAssignment.file_path
                        ) ===
                          "doc" ||
                        getFileExtension(
                          selectedAssignment.file_path
                        ) ===
                          "docx"
                          ? "📝"
                          : getFileExtension(
                              selectedAssignment.file_path
                            ) ===
                              "ppt" ||
                            getFileExtension(
                              selectedAssignment.file_path
                            ) ===
                              "pptx"
                          ? "📊"
                          : getFileExtension(
                              selectedAssignment.file_path
                            ) ===
                              "xls" ||
                            getFileExtension(
                              selectedAssignment.file_path
                            ) ===
                              "xlsx"
                          ? "📈"
                          : getFileExtension(
                              selectedAssignment.file_path
                            ) ===
                              "txt"
                          ? "📃"
                          : getFileExtension(
                              selectedAssignment.file_path
                            ) ===
                              "csv"
                          ? "📑"
                          : "📄"}

                      </div>

                      <strong>
                        {getFileTypeLabel(
                          selectedAssignment.file_path
                        )}
                      </strong>

                      <span>
                        Click to view file
                      </span>

                    </div>

                  )}

                </div>

              )}

            </div>

            <div className="student-modal-footer">

              <button
                type="button"
                className="student-modal-cancel"
                onClick={() =>
                  setSelectedAssignment(
                    null
                  )
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default PendingTask;
