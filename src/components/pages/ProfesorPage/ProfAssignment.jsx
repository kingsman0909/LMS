import { useEffect, useMemo, useState } from "react";
import "./styles/ProfAssignment.css";
import { API_BASE_URL } from "../../../config.js";

function ProfAssignment({ user, academicTerm }) {

  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);

  const [form, setForm] = useState({
    title: "",
    subject_id: "",
    section_id: "",
    description: "",
    points: "",
    dueDate: "",
    dueTime: "23:59",
    status: "open",
    file: null,
  });

  /*
  |--------------------------------------------------------------------------
  | TOKEN
  |--------------------------------------------------------------------------
  */

  const getToken = () => {
    return (
      localStorage.getItem("professor_token") ||
      localStorage.getItem("profesor_token")
    );
  };

  /*
  |--------------------------------------------------------------------------
  | LOAD INITIAL DATA
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    if (!user?.profile?.id || !academicTerm?.id) {

      console.log(
        "Waiting for user and academic term...",
        {
          user,
          academicTerm,
        }
      );

      return;
    }

    loadData();

  }, [
    user?.profile?.id,
    academicTerm?.id,
  ]);

  const loadData = async () => {

    const professorId =
      user?.profile?.id;

    const academicTermId =
      academicTerm?.id;

    if (!professorId || !academicTermId) {
      setLoading(false);
      return;
    }

    try {

      setLoading(true);

      const token = getToken();

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      /*
      |--------------------------------------------------------------------------
      | GET ASSIGNMENTS
      |--------------------------------------------------------------------------
      */

      const assignmentResponse =
        await fetch(
          `${API_BASE_URL}/api/auth/professor/getAssignments?profId=${professorId}`,
          {
            method: "GET",
            headers,
          }
        );

      const assignmentData =
        await assignmentResponse.json();

      if (!assignmentResponse.ok) {

        throw new Error(
          assignmentData.message ||
          "Failed to load assignments."
        );

      }

      console.log(
        "Assignments:",
        assignmentData
      );

      setAssignments(
        assignmentData.assignments || []
      );

      /*
      |--------------------------------------------------------------------------
      | GET SUBJECTS AND SECTIONS
      |--------------------------------------------------------------------------
      */

      const subjectAndSectionResponse =
        await fetch(
          `${API_BASE_URL}/api/auth/professor/getProfAssignmentOption?profId=${professorId}&academicTermId=${academicTermId}`,
          {
            method: "GET",
            headers,
          }
        );

      const subAndSecData =
        await subjectAndSectionResponse.json();

      if (!subjectAndSectionResponse.ok) {

        throw new Error(
          subAndSecData.message ||
          "Failed to load subjects and sections."
        );

      }

      const assignmentOptions =
        subAndSecData.assignmentOptions || [];

      console.log(
        "Assignment Options:",
        assignmentOptions
      );

      /*
      |--------------------------------------------------------------------------
      | SUBJECTS
      |--------------------------------------------------------------------------
      */

      const uniqueSubjects =
        Array.from(
          new Map(
            assignmentOptions.map((item) => [
              item.subject_id,
              {
                subject_id:
                  item.subject_id,

                subject_code:
                  item.subject_code,

                subject_name:
                  item.subject_name,
              },
            ])
          ).values()
        );

      setSubjects(uniqueSubjects);

      /*
      |--------------------------------------------------------------------------
      | SECTIONS
      |--------------------------------------------------------------------------
      */

      const uniqueSections =
        Array.from(
          new Map(
            assignmentOptions.map((item) => [
              item.section_id,
              {
                section_id:
                  item.section_id,

                section_name:
                  item.section_name,

                program_id:
                  item.program_id,

                year_level:
                  item.year_level,
              },
            ])
          ).values()
        );

      setSections(uniqueSections);

    } catch (error) {

      console.error(
        "Failed to load assignment data:",
        error
      );

      alert(
        error.message ||
        "Failed to load assignment data."
      );

    } finally {

      setLoading(false);

    }
  };

  /*
  |--------------------------------------------------------------------------
  | FILTER
  |--------------------------------------------------------------------------
  */

  const filteredAssignments =
    useMemo(() => {

      return assignments.filter(
        (assignment) => {

          const searchValue =
            search.toLowerCase().trim();

          const title =
            assignment.title
              ?.toLowerCase() || "";

          const subject =
            assignment.subject_name
              ?.toLowerCase() ||
            assignment.subject
              ?.toLowerCase() ||
            "";

          const section =
            assignment.section_name
              ?.toLowerCase() || "";

          const matchesSearch =
            title.includes(searchValue) ||
            subject.includes(searchValue) ||
            section.includes(searchValue);

          const matchesStatus =
            statusFilter === "all" ||
            assignment.status === statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );

    }, [
      assignments,
      search,
      statusFilter,
    ]);

  /*
  |--------------------------------------------------------------------------
  | CREATE MODAL
  |--------------------------------------------------------------------------
  */

  const openCreateModal = () => {

    setEditingAssignment(null);

    setForm({
      title: "",
      subject_id: "",
      section_id: "",
      description: "",
      points: "",
      dueDate: "",
      dueTime: "23:59",
      status: "open",
      file: null,
    });

    setShowModal(true);
  };

  /*
  |--------------------------------------------------------------------------
  | EDIT MODAL
  |--------------------------------------------------------------------------
  */

  const openEditModal = (
    assignment
  ) => {

    setEditingAssignment(
      assignment
    );

    let dueDate = "";
    let dueTime = "23:59";

    if (assignment.due_date) {

      const date =
        new Date(
          assignment.due_date
        );

      if (
        !Number.isNaN(
          date.getTime()
        )
      ) {

        dueDate =
          date
            .toISOString()
            .split("T")[0];

        dueTime =
          date
            .toTimeString()
            .slice(0, 5);
      }
    }

    setForm({

      title:
        assignment.title || "",

      subject_id:
        assignment.subject_id || "",

      section_id:
        assignment.section_id || "",

      description:
        assignment.description || "",

      points:
        assignment.points || "",

      dueDate,

      dueTime,

      status:
        assignment.status || "open",

      file: null,
    });

    setShowModal(true);
  };

  /*
  |--------------------------------------------------------------------------
  | CLOSE MODAL
  |--------------------------------------------------------------------------
  */

  const closeModal = () => {

    if (saving) return;

    setShowModal(false);

    setEditingAssignment(null);

  };

  /*
  |--------------------------------------------------------------------------
  | FORM CHANGE
  |--------------------------------------------------------------------------
  */

  const handleChange = (
    event
  ) => {

    const {
      name,
      value,
    } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /*
  |--------------------------------------------------------------------------
  | FILE CHANGE
  |--------------------------------------------------------------------------
  */

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
        return;
    }

    const allowedExtensions = [
        "pdf",
        "doc",
        "docx",
        "ppt",
        "pptx",
        "xls",
        "xlsx",
        "txt",
        "csv"
    ];

    const extension = file.name
        .split(".")
        .pop()
        .toLowerCase();

    // Validate file type
    if (!allowedExtensions.includes(extension)) {
        alert(
            "Unsupported file type. Please upload PDF, Word, PowerPoint, Excel, TXT, or CSV."
        );

        event.target.value = "";

        setForm((prev) => ({
            ...prev,
            file: null,
        }));

        return;
    }

    // Validate file size - 10 MB
    if (file.size > 10 * 1024 * 1024) {
        alert("File size must not exceed 10 MB.");

        event.target.value = "";

        setForm((prev) => ({
            ...prev,
            file: null,
        }));

        return;
    }

    // Valid file
    setForm((prev) => ({
        ...prev,
        file: file,
    }));
}

  /*
  |--------------------------------------------------------------------------
  | CREATE / UPDATE
  |--------------------------------------------------------------------------
  */

  const handleSubmit = async (
    event
  ) => {

    event.preventDefault();

    /*
    |--------------------------------------------------------------------------
    | VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
      !form.title.trim() ||
      !form.subject_id ||
      !form.section_id ||
      !form.points ||
      !form.dueDate
    ) {

      alert(
        "Please complete all required fields."
      );

      return;
    }

    try {

      setSaving(true);

      const token =
        getToken();

      const professorId =
        user?.profile?.id;

      /*
      |--------------------------------------------------------------------------
      | DUE DATE
      |--------------------------------------------------------------------------
      */

      const dueDate =
        `${form.dueDate} ${
          form.dueTime || "23:59"
        }:00`;

      /*
      |--------------------------------------------------------------------------
      | FORM DATA
      |--------------------------------------------------------------------------
      */

      const formData =
        new FormData();

      formData.append(
        "subject_id",
        Number(form.subject_id)
      );

      formData.append(
        "section_id",
        Number(form.section_id)
      );

      formData.append(
        "title",
        form.title.trim()
      );

      formData.append(
        "description",
        form.description.trim() || ""
      );

      formData.append(
        "points",
        Number(form.points)
      );

      formData.append(
        "due_date",
        dueDate
      );

      formData.append(
        "status",
        form.status
      );

      /*
      |--------------------------------------------------------------------------
      | PDF
      |--------------------------------------------------------------------------
      |
      | If a new PDF is selected, upload it.
      |
      | If editing and no new PDF is selected,
      | we do NOT append a file.
      |
      | Backend should then preserve the existing
      | file_path.
      |--------------------------------------------------------------------------
      */

      if (form.file) {

        formData.append(
          "file",
          form.file
        );

      }

      /*
      |--------------------------------------------------------------------------
      | CREATE
      |--------------------------------------------------------------------------
      */

      if (!editingAssignment) {

        console.log(
          "Creating assignment..."
        );

        console.log(
          "PDF:",
          form.file
        );

        const response =
          await fetch(
            `${API_BASE_URL}/api/auth/professor/createAssignment`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              body: formData,
            }
          );

        const data =
          await response.json();

        if (!response.ok) {

          throw new Error(
            data.message ||
            "Failed to create assignment."
          );
        }

        console.log(
          "Create assignment response:",
          data
        );

        if (data.assignment) {

          setAssignments(
            (prev) => [
              data.assignment,
              ...prev,
            ]
          );

        } else {

          await loadData();

        }

        alert(
          "Assignment created successfully."
        );

      }

      /*
      |--------------------------------------------------------------------------
      | UPDATE
      |--------------------------------------------------------------------------
      */

      else {

        console.log(
          "Updating assignment..."
        );

        console.log(
          "PDF:",
          form.file
        );

        const response =
          await fetch(
            `${API_BASE_URL}/api/auth/professor/updateAssignment?professorId=${professorId}&assignmentId=${editingAssignment.id}`,
            {
              method: "PUT",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              body: formData,
            }
          );

        const data =
          await response.json();

        if (!response.ok) {

          throw new Error(
            data.message ||
            "Failed to update assignment."
          );
        }

        console.log(
          "Update assignment response:",
          data
        );

        if (data.assignment) {

          setAssignments(
            (prev) =>
              prev.map(
                (assignment) =>
                  assignment.id ===
                  editingAssignment.id
                    ? data.assignment
                    : assignment
              )
          );

        } else {

          await loadData();

        }

        alert(
          "Assignment updated successfully."
        );

      }

      closeModal();

    } catch (error) {

      console.error(
        "Assignment save error:",
        error
      );

      alert(
        error.message ||
        "Something went wrong."
      );

    } finally {

      setSaving(false);

    }

  };

  /*
  |--------------------------------------------------------------------------
  | TOGGLE STATUS
  |--------------------------------------------------------------------------
  */

  const handleToggleStatus =
    async (assignment) => {

      const newStatus =
        assignment.status === "open"
          ? "closed"
          : "open";

      try {

        const token =
          getToken();

        const response =
          await fetch(
            `${API_BASE_URL}/api/auth/professor/toggleStatusAssignment?assignId=${assignment.id}`,
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body: JSON.stringify({
                status: newStatus,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {

          throw new Error(
            data.message ||
            "Failed to update status."
          );
        }

        setAssignments(
          (prev) =>
            prev.map(
              (item) =>
                item.id === assignment.id
                  ? {
                      ...item,
                      status:
                        data.assignment
                          ?.status ||
                        newStatus,
                    }
                  : item
            )
        );

      } catch (error) {

        console.error(
          "Status update error:",
          error
        );

        alert(
          error.message ||
          "Failed to update assignment status."
        );

      }

    };

  /*
  |--------------------------------------------------------------------------
  | DELETE
  |--------------------------------------------------------------------------
  */

  const handleDelete =
    async (id) => {

      const confirmed =
        window.confirm(
          "Are you sure you want to delete this assignment?"
        );

      if (!confirmed) return;

      try {

        const token =
          getToken();

        const professorId =
          user?.profile?.id;

        const response =
          await fetch(
            `${API_BASE_URL}/api/auth/professor/deleteAssignment?profId=${professorId}&assignId=${id}`,
            {
              method: "DELETE",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {

          throw new Error(
            data.message ||
            "Failed to delete assignment."
          );
        }

        setAssignments(
          (prev) =>
            prev.filter(
              (assignment) =>
                assignment.id !== id
            )
        );

      } catch (error) {

        console.error(
          "Delete assignment error:",
          error
        );

        alert(
          error.message ||
          "Failed to delete assignment."
        );

      }

    };

  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  if (loading) {

    return (
      <div className="professor-assignments">

        <div className="assignment-loading">

          <div className="loading-spinner"></div>

          <p>
            Loading assignments...
          </p>

        </div>

      </div>
    );

  }

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (

    <div className="professor-assignments">

      {/* HEADER */}

      <div className="assignments-header">

        <div className="assignments-header-text">

          <h1>
            Assignments
          </h1>

          <p>
            Create, manage, and monitor
            assignments for your students.
          </p>

        </div>

        <button
          className="create-assignment-btn"
          onClick={openCreateModal}
        >
          <span className="btn-plus">
            +
          </span>

          Create Assignment

        </button>

      </div>

      {/* CONTROLS */}

      <div className="assignment-controls">

        <div className="assignment-search">

          <span className="search-icon">
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
              className="clear-search"
              onClick={() =>
                setSearch("")
              }
              type="button"
            >
              ×
            </button>

          )}

        </div>

        <div className="status-filter">

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

      </div>

      {/* COUNT */}

      <div className="assignment-results">

        <span>

          {filteredAssignments.length}{" "}

          {
            filteredAssignments.length === 1
              ? "assignment"
              : "assignments"
          }

        </span>

      </div>

      {/* LIST */}

      <div className="assignment-list">

        {filteredAssignments.length > 0 ? (

          filteredAssignments.map(
            (assignment) => (

              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onEdit={() =>
                  openEditModal(
                    assignment
                  )
                }
                onToggleStatus={() =>
                  handleToggleStatus(
                    assignment
                  )
                }
                onDelete={() =>
                  handleDelete(
                    assignment.id
                  )
                }
              />

            )
          )

        ) : (

          <div className="empty-state">

            <div className="empty-icon">
              📄
            </div>

            <h3>
              No assignments found
            </h3>

            <p>

              {search ||
              statusFilter !== "all"
                ? "Try changing your search or filter."
                : "Create your first assignment to get started."
              }

            </p>

            {!search &&
              statusFilter === "all" && (

                <button
                  onClick={
                    openCreateModal
                  }
                >
                  Create Assignment
                </button>

              )}

          </div>

        )}

      </div>

      {/* MODAL */}

      {showModal && (

        <div
          className="assignment-modal-overlay"
          onMouseDown={closeModal}
        >

          <div
            className="assignment-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <h2>

                  {editingAssignment
                    ? "Edit Assignment"
                    : "Create Assignment"}

                </h2>

                <p>

                  {editingAssignment
                    ? "Update the assignment details."
                    : "Create a new assignment for your students."}

                </p>

              </div>

              <button
                className="modal-close"
                onClick={closeModal}
                type="button"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
            >

              <div className="modal-body">

                {/* TITLE */}

                <div className="form-group">

                  <label>
                    Assignment Title
                    <span>*</span>
                  </label>

                  <input
                    type="text"
                    name="title"
                    placeholder="e.g. Midterm Essay"
                    value={form.title}
                    onChange={handleChange}
                    required
                  />

                </div>

                {/* SUBJECT */}

                <div className="form-group">

                  <label>
                    Subject
                    <span>*</span>
                  </label>

                  <select
                    name="subject_id"
                    value={form.subject_id}
                    onChange={handleChange}
                    required
                  >

                    <option value="">
                      Select Subject
                    </option>

                    {subjects.map(
                      (subject) => (

                        <option
                          key={
                            subject.subject_id
                          }
                          value={
                            subject.subject_id
                          }
                        >

                          {subject.subject_code
                            ? `${subject.subject_code} - `
                            : ""
                          }

                          {
                            subject.subject_name
                          }

                        </option>

                      )
                    )}

                  </select>

                  {subjects.length === 0 && (

                    <small className="form-warning">
                      No subjects assigned to you.
                    </small>

                  )}

                </div>

                {/* SECTION */}

                <div className="form-group">

                  <label>
                    Section
                    <span>*</span>
                  </label>

                  <select
                    name="section_id"
                    value={form.section_id}
                    onChange={handleChange}
                    required
                  >

                    <option value="">
                      Select Section
                    </option>

                    {sections.map(
                      (section) => (

                        <option
                          key={
                            section.section_id
                          }
                          value={
                            section.section_id
                          }
                        >

                          {
                            section.section_name
                          }

                        </option>

                      )
                    )}

                  </select>

                  {sections.length === 0 && (

                    <small className="form-warning">
                      No sections assigned to you.
                    </small>

                  )}

                </div>

                {/* DESCRIPTION */}

                <div className="form-group">

                  <label>
                    Description / Instructions
                  </label>

                  <textarea
                    name="description"
                    placeholder="Write instructions for this assignment..."
                    value={form.description}
                    onChange={handleChange}
                    rows="4"
                  />

                </div>

                {/* FILE */}

                <div className="form-group">

                  <label>
                    Assignment PDF
                  </label>

                  <label className="file-upload">

                    <input
                      type="file"
                      accept="
                          .pdf,
                          .doc,
                          .docx,
                          .ppt,
                          .pptx,
                          .xls,
                          .xlsx,
                          .txt,
                          .csv
                      "
                      onChange={handleFileChange}
                  />

                    <div className="file-upload-icon">
                      ↑
                    </div>

                    <div className="file-upload-content">

                      <strong>

                        {form.file
                          ? form.file.name
                          : editingAssignment?.file_path
                            ? "Existing PDF attached"
                            : "Upload assignment PDF"}

                      </strong>

                      <span>
                        PDF only • Maximum 10 MB
                      </span>

                    </div>

                    <span className="file-browse">
                      Browse
                    </span>

                  </label>

                  {editingAssignment?.file_path &&
                    !form.file && (

                      <small className="form-file-info">

                        Existing file will be kept
                        unless you select a new PDF.

                      </small>

                    )}

                </div>

                {/* POINTS + STATUS */}

                <div className="form-row">

                  <div className="form-group">

                    <label>
                      Points
                      <span>*</span>
                    </label>

                    <input
                      type="number"
                      name="points"
                      min="1"
                      step="0.01"
                      placeholder="100"
                      value={form.points}
                      onChange={handleChange}
                      required
                    />

                  </div>

                  <div className="form-group">

                    <label>
                      Status
                    </label>

                    <select
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                    >

                      <option value="open">
                        Open
                      </option>

                      <option value="closed">
                        Closed
                      </option>

                    </select>

                  </div>

                </div>

                {/* DUE DATE */}

                <div className="form-row">

                  <div className="form-group">

                    <label>
                      Due Date
                      <span>*</span>
                    </label>

                    <input
                      type="date"
                      name="dueDate"
                      value={form.dueDate}
                      onChange={handleChange}
                      required
                    />

                  </div>

                  <div className="form-group">

                    <label>
                      Due Time
                    </label>

                    <input
                      type="time"
                      name="dueTime"
                      value={form.dueTime}
                      onChange={handleChange}
                    />

                  </div>

                </div>

              </div>

              {/* FOOTER */}

              <div className="modal-footer">

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="submit-assignment-btn"
                  disabled={saving}
                >

                  {saving
                    ? "Uploading..."
                    : editingAssignment
                      ? "Save Changes"
                      : "Create Assignment"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );

}

/*
|--------------------------------------------------------------------------
| ASSIGNMENT CARD
|--------------------------------------------------------------------------
*/

function AssignmentCard({
  assignment,
  onEdit,
  onToggleStatus,
  onDelete,
}) {

  const isOpen =
    assignment.status === "open";

  const students =
    Number(
      assignment.students ??
      assignment.student_count ??
      0
    );

  const submitted =
    Number(
      assignment.submitted ??
      assignment.submission_count ??
      0
    );

  const submissionPercentage =
    students > 0
      ? Math.min(
          (submitted / students) * 100,
          100
        )
      : 0;

  return (

    <article className="assignment-card">

      <div className="assignment-card-main">

        <div className="assignment-icon">
          <span>▤</span>
        </div>

        <div className="assignment-info">

          <div className="assignment-title-row">

            <h2>
              {assignment.title}
            </h2>

            <span
              className={`assignment-status ${
                isOpen
                  ? "status-open"
                  : "status-closed"
              }`}
            >

              <span className="status-dot"></span>

              {isOpen
                ? "Open"
                : "Closed"}

            </span>

          </div>

          <span className="assignment-subject">

            {assignment.subject_code
              ? `${assignment.subject_code} • `
              : ""
            }

            {assignment.subject_name ||
              assignment.subject ||
              "Unknown Subject"}

          </span>

          <span className="assignment-section">

            Section:{" "}

            {assignment.section_name ||
              "Unknown Section"}

          </span>

          <p className="assignment-description">

            {assignment.description ||
              "No description provided."}

          </p>

          <div className="assignment-meta">

            <span>

              <strong>
                {assignment.points}
              </strong>{" "}
              points

            </span>

            <span className="meta-divider"></span>

            <span>

              Due{" "}

              {assignment.due_date
                ? new Date(
                    assignment.due_date
                  ).toLocaleString(
                    "en-US",
                    {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }
                  )
                : "No due date"}

            </span>

            <span className="meta-divider"></span>

            <span>
              {students} students
            </span>

          </div>

          <div className="assignment-submission-progress">

            <div className="submission-progress-header">

              <span>
                Submissions
              </span>

              <strong>
                {submitted}/{students}
              </strong>

            </div>

            <div className="progress-track">

              <div
                className="progress-fill"
                style={{
                  width:
                    `${submissionPercentage}%`,
                }}
              />

            </div>

          </div>

        </div>

      </div>

      <div className="assignment-actions">

        <button
          className="action-btn view-btn"
          type="button"
          onClick={() => {
            if (assignment.file_path) {
              window.open(
                assignment.file_path,
                "_blank",
                "noopener,noreferrer"
              );
            } else {
              alert(
                "This assignment has no attached PDF."
              );
            }
          }}
        >
          View
        </button>

        <button
          className="action-btn edit-btn"
          type="button"
          onClick={onEdit}
        >
          Edit
        </button>

        <button
          className={`action-btn ${
            isOpen
              ? "close-btn"
              : "open-btn"
          }`}
          type="button"
          onClick={onToggleStatus}
        >

          {isOpen
            ? "Close"
            : "Open"}

        </button>

        <button
          className="delete-btn"
          type="button"
          onClick={onDelete}
          aria-label="Delete assignment"
        >
          🗑
        </button>

      </div>

    </article>
  );
}

export default ProfAssignment;