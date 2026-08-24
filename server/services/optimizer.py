"""
Independent LMS Scheduling Simulation Scheduler
-----------------------------------------------

Purpose:
    Simulate the real scheduling problem without inserting/updating/deleting
    anything in the LMS database.

Design:
    - Reads programs, academic term, curriculum, subjects, professors,
      professor_subjects, rooms, time_slots, and existing schedules.
    - Creates the requested number of virtual sections.
    - Uses the same resource types as the real scheduler.
    - Uses actual lecture/lab duration.
    - Enforces professor qualification, professor workload, professor/room/
      section time conflicts, and room type.
    - Ranks qualified professors by remaining workload and current usage.
    - Uses fail-first ordering so difficult requirements are scheduled first.
    - Uses bounded backtracking.
    - NEVER writes to the database.

Expected integration:
    Replace the old simulation service with this module and call:

        result = await simulate_program(
            program_id,
            academic_term_id,
            students,
            section_capacity=50
        )

    result["success"] tells whether ALL virtual sections were scheduled.
"""

import math
import time
from collections import defaultdict
from copy import deepcopy

import mysql.connector


# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

START_STUDENTS = 2500
LARGE_STEP = 500
FINE_STEP = 50
SECTION_CAPACITY = 50
MAX_SIMULATED_STUDENTS = 20000

# Safety limits. These prevent an impossible case from running forever.
MAX_BACKTRACK_NODES = 250000
MAX_SECONDS = 30.0

DAY_ORDER = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}

# Keep this consistent with the LMS database.
DAY_NAMES = ["Monday", "Tuesday", "Wednesday",
             "Thursday", "Friday", "Saturday", "Sunday"]


# ---------------------------------------------------------------------------
# DATABASE
# ---------------------------------------------------------------------------

def get_connection():
    """
    Change these values to your existing LMS DB credentials.
    """
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="ken_09096068957",
        database="lms_db",
    )


# ---------------------------------------------------------------------------
# BASIC HELPERS
# ---------------------------------------------------------------------------

def time_to_minutes(value):
    if value is None:
        return 0

    if hasattr(value, "hour"):
        return value.hour * 60 + value.minute + value.second / 60

    text = str(value)
    parts = text.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def normalize_year(value):
    """
    Converts:
        1
        '1'
        '1st Year'
    into integer 1.
    """
    text = str(value).strip().lower()

    if text.startswith("1"):
        return 1
    if text.startswith("2"):
        return 2
    if text.startswith("3"):
        return 3
    if text.startswith("4"):
        return 4

    return int(value)


def overlap(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end


def requirement_duration(subject):
    """
    Real scheduling duration:
        1 lecture unit = 1 hour
        1 laboratory unit = 3 hours

    If a subject contains both lecture and lab, the two components are
    scheduled independently.
    """
    return subject["lecture_units"], subject["lab_units"]


def requirement_type(component):
    return "laboratory" if component == "lab" else "lecture"


def component_hours(component):
    return 3 if component == "lab" else 1


# ---------------------------------------------------------------------------
# DATABASE LOAD
# ---------------------------------------------------------------------------

def load_program(cursor, program_id):
    cursor.execute(
        """
        SELECT id, program_code, program_name, department_id
        FROM programs
        WHERE id = %s
        """,
        (program_id,),
    )

    row = cursor.fetchone()

    if not row:
        raise ValueError(f"Program {program_id} not found.")

    return row


def load_term(cursor, academic_term_id):
    cursor.execute(
        """
        SELECT id, school_year, semester
        FROM academic_terms
        WHERE id = %s
        """,
        (academic_term_id,),
    )

    row = cursor.fetchone()

    if not row:
        raise ValueError(
            f"Academic term {academic_term_id} not found."
        )

    return row


def load_curriculum(cursor, program_id, semester):
    cursor.execute(
        """
        SELECT
            cs.id AS curriculum_id,
            cs.year_level,
            s.id AS subject_id,
            s.subject_code,
            s.subject_name,
            s.units,
            s.lecture_units,
            s.lab_units
        FROM curriculum_subjects cs
        JOIN subjects s
            ON s.id = cs.subject_id
        WHERE cs.program_id = %s
          AND cs.semester = %s
        ORDER BY
            cs.year_level,
            s.id
        """,
        (program_id, semester),
    )

    rows = cursor.fetchall()

    curriculum = defaultdict(list)

    for row in rows:
        year = normalize_year(row["year_level"])

        curriculum[year].append({
            "curriculum_id": row["curriculum_id"],
            "subject_id": row["subject_id"],
            "subject_code": row["subject_code"],
            "subject_name": row["subject_name"],
            "units": int(row["units"] or 0),
            "lecture_units": int(row["lecture_units"] or 0),
            "lab_units": int(row["lab_units"] or 0),
        })

    return curriculum


def load_professors(cursor):
    cursor.execute(
        """
        SELECT
            id,
            employee_id,
            firstname,
            lastname,
            department_id,
            position,
            max_weekly_hours
        FROM profesor
        """
    )

    professors = {}

    for row in cursor.fetchall():
        max_hours = row["max_weekly_hours"]

        if max_hours is None:
            max_hours = 0

        professors[row["id"]] = {
            "id": row["id"],
            "employee_id": row["employee_id"],
            "name": f'{row["firstname"]} {row["lastname"]}',
            "department_id": row["department_id"],
            "position": row["position"],
            "max_hours": float(max_hours),
            "qualified_subjects": set(),
        }

    return professors


def load_professor_subjects(cursor, professors):
    cursor.execute(
        """
        SELECT professor_id, subject_id
        FROM professor_subjects
        """
    )

    for row in cursor.fetchall():
        professor = professors.get(row["professor_id"])

        if professor:
            professor["qualified_subjects"].add(
                row["subject_id"]
            )


def load_rooms(cursor):
    cursor.execute(
        """
        SELECT
            id,
            room_name,
            room_type,
            capacity
        FROM rooms
        WHERE status = 'available'
        ORDER BY capacity ASC, id ASC
        """
    )

    rooms = {}

    for row in cursor.fetchall():
        rooms[row["id"]] = {
            "id": row["id"],
            "name": row["room_name"],
            "type": row["room_type"],
            "capacity": int(row["capacity"]),
        }

    return rooms


def load_time_slots(cursor):
    cursor.execute(
        """
        SELECT
            id,
            day,
            start_time,
            end_time
        FROM time_slots
        WHERE status = 'available'
        ORDER BY id
        """
    )

    slots = {}

    for row in cursor.fetchall():
        start = time_to_minutes(row["start_time"])
        end = time_to_minutes(row["end_time"])

        if end <= start:
            continue

        slots[row["id"]] = {
            "id": row["id"],
            "day": row["day"],
            "day_index": DAY_ORDER.get(row["day"], 99),
            "start": start,
            "end": end,
        }

    return slots


def load_existing_schedules(cursor, academic_term_id):
    """
    Existing database schedules are treated as already occupied resources.

    This makes the simulation aware of the current real scheduler state
    without modifying it.
    """
    cursor.execute(
        """
        SELECT
            section_id,
            subject_id,
            professor_id,
            room_id,
            time_slot_id
        FROM class_schedules
        WHERE academic_term_id = %s
        """,
        (academic_term_id,),
    )

    return cursor.fetchall()


# ---------------------------------------------------------------------------
# TIME SLOT EXPANSION
# ---------------------------------------------------------------------------

def build_virtual_time_blocks(slots):
    """
    A database time slot may represent a one-hour or multi-hour interval.

    For a 3-hour laboratory we need a slot/block that is at least 3 hours
    long. We do NOT silently turn three unrelated slots into a lab.

    If the DB has 7:00-10:00, that is a valid 3-hour block.
    If it has 7:00-8:00, 8:00-9:00, 9:00-10:00, those are combined only
    when they are contiguous on the same day.
    """

    by_day = defaultdict(list)

    for slot in slots.values():
        by_day[slot["day"]].append(slot)

    blocks = []

    for day, day_slots in by_day.items():
        day_slots.sort(
            key=lambda x: (x["start"], x["end"], x["id"])
        )

        # Every database slot itself is a valid block.
        for slot in day_slots:
            blocks.append({
                "slot_ids": [slot["id"]],
                "day": day,
                "day_index": slot["day_index"],
                "start": slot["start"],
                "end": slot["end"],
            })

        # Build contiguous blocks from one-hour-ish slots.
        for i in range(len(day_slots)):
            chain = [day_slots[i]]
            current_end = day_slots[i]["end"]

            for j in range(i + 1, len(day_slots)):
                nxt = day_slots[j]

                if nxt["start"] != current_end:
                    break

                chain.append(nxt)
                current_end = nxt["end"]

                blocks.append({
                    "slot_ids": [x["id"] for x in chain],
                    "day": day,
                    "day_index": day_slots[i]["day_index"],
                    "start": day_slots[i]["start"],
                    "end": current_end,
                })

    # Remove duplicates.
    unique = {}
    for block in blocks:
        key = (
            tuple(block["slot_ids"]),
            block["day"],
            block["start"],
            block["end"],
        )
        unique[key] = block

    return list(unique.values())


# ---------------------------------------------------------------------------
# RESOURCE STATE
# ---------------------------------------------------------------------------

class ResourceState:
    def __init__(self, professors, rooms):
        self.professor_hours = {
            pid: 0.0
            for pid in professors
        }

        self.professor_busy = defaultdict(list)
        self.room_busy = defaultdict(list)
        self.section_busy = defaultdict(list)

        self.assignments = []

        # Fast occupancy lookup.
        self.professor_busy_keys = defaultdict(set)
        self.room_busy_keys = defaultdict(set)
        self.section_busy_keys = defaultdict(set)

        self.professors = professors
        self.rooms = rooms

    def can_use_professor(
        self,
        professor_id,
        day,
        start,
        end,
        hours,
    ):
        professor = self.professors[professor_id]

        if (
            self.professor_hours[professor_id] + hours
            > professor["max_hours"] + 1e-9
        ):
            return False

        for item in self.professor_busy[professor_id]:
            if (
                item["day"] == day
                and overlap(
                    start,
                    end,
                    item["start"],
                    item["end"],
                )
            ):
                return False

        return True

    def can_use_room(
        self,
        room_id,
        day,
        start,
        end,
    ):
        for item in self.room_busy[room_id]:
            if (
                item["day"] == day
                and overlap(
                    start,
                    end,
                    item["start"],
                    item["end"],
                )
            ):
                return False

        return True

    def can_use_section(
        self,
        section_id,
        day,
        start,
        end,
    ):
        for item in self.section_busy[section_id]:
            if (
                item["day"] == day
                and overlap(
                    start,
                    end,
                    item["start"],
                    item["end"],
                )
            ):
                return False

        return True

    def assign(
        self,
        requirement,
        professor_id,
        room_id,
        block,
    ):
        hours = requirement["hours"]

        assignment = {
            "section_id": requirement["section_id"],
            "year_level": requirement["year_level"],
            "subject_id": requirement["subject_id"],
            "subject_code": requirement["subject_code"],
            "component": requirement["component"],
            "professor_id": professor_id,
            "room_id": room_id,
            "slot_ids": list(block["slot_ids"]),
            "day": block["day"],
            "start": block["start"],
            "end": block["end"],
            "hours": hours,
        }

        self.professor_hours[professor_id] += hours

        self.professor_busy[professor_id].append(assignment)
        self.room_busy[room_id].append(assignment)
        self.section_busy[requirement["section_id"]].append(
            assignment
        )

        self.assignments.append(assignment)

        return assignment

    def unassign(self, assignment):
        pid = assignment["professor_id"]
        rid = assignment["room_id"]
        sid = assignment["section_id"]

        self.professor_hours[pid] -= assignment["hours"]

        self.professor_busy[pid].remove(assignment)
        self.room_busy[rid].remove(assignment)
        self.section_busy[sid].remove(assignment)

        self.assignments.remove(assignment)


# ---------------------------------------------------------------------------
# EXISTING RESOURCE OCCUPANCY
# ---------------------------------------------------------------------------

def seed_existing_schedules(
    state,
    existing_schedules,
    slots,
):
    """
    Existing schedules are seeded into the simulation state.

    We intentionally do not modify them.
    """

    for row in existing_schedules:
        slot = slots.get(row["time_slot_id"])

        if not slot:
            continue

        # Existing schedules are assumed to occupy one DB time slot.
        # If the real scheduler stores multi-slot labs as multiple rows,
        # each row will correctly occupy its own interval.
        state.professor_busy[
            row["professor_id"]
        ].append({
            "day": slot["day"],
            "start": slot["start"],
            "end": slot["end"],
            "existing": True,
        })

        state.room_busy[
            row["room_id"]
        ].append({
            "day": slot["day"],
            "start": slot["start"],
            "end": slot["end"],
            "existing": True,
        })


# ---------------------------------------------------------------------------
# PROFESSOR RANKING
# ---------------------------------------------------------------------------

def professor_rank(
    professor,
    current_hours,
    requirement,
):
    """
    Lower score = higher priority.

    Priority:
        1. Qualified professor.
        2. Prefer professor with more remaining workload.
        3. Prefer professor with less currently assigned workload.
        4. Prefer same department when department data exists.
        5. Stable professor ID as final tie breaker.

    This prevents one professor from being consumed unnecessarily while
    still prioritizing professors who can actually carry the workload.
    """

    remaining = (
        professor["max_hours"]
        - current_hours
    )

    same_department = 0

    # Department matching is only a weak tie-breaker because the actual
    # qualification relation is professor_subjects.
    if requirement.get("program_department_id") is not None:
        same_department = int(
            professor["department_id"]
            == requirement["program_department_id"]
        )

    return (
        -same_department,
        -remaining,
        current_hours,
        professor["id"],
    )


# ---------------------------------------------------------------------------
# CANDIDATES
# ---------------------------------------------------------------------------

def build_candidates(
    requirement,
    professors,
    rooms,
    blocks,
    state,
):
    candidates = []

    subject_id = requirement["subject_id"]
    room_type = requirement["room_type"]
    hours = requirement["hours"]
    section_id = requirement["section_id"]

    qualified = []

    for professor in professors.values():
        if subject_id not in professor["qualified_subjects"]:
            continue

        if professor["max_hours"] < hours:
            continue

        qualified.append(professor)

    qualified.sort(
        key=lambda p: professor_rank(
            p,
            state.professor_hours[p["id"]],
            requirement,
        )
    )

    compatible_rooms = [
        room
        for room in rooms.values()
        if room["type"] == room_type
        and room["capacity"] >= requirement["section_capacity"]
    ]

    # Smaller room first so large rooms remain available for sections
    # that actually need them.
    compatible_rooms.sort(
        key=lambda r: (r["capacity"], r["id"])
    )

    for professor in qualified:

        for room in compatible_rooms:

            for block in blocks:

                if block["end"] - block["start"] < hours * 60:
                    continue

                if not state.can_use_professor(
                    professor["id"],
                    block["day"],
                    block["start"],
                    block["end"],
                    hours,
                ):
                    continue

                if not state.can_use_room(
                    room["id"],
                    block["day"],
                    block["start"],
                    block["end"],
                ):
                    continue

                if not state.can_use_section(
                    section_id,
                    block["day"],
                    block["start"],
                    block["end"],
                ):
                    continue

                candidates.append({
                    "professor_id": professor["id"],
                    "room_id": room["id"],
                    "block": block,
                })

    return candidates


# ---------------------------------------------------------------------------
# REQUIREMENT CREATION
# ---------------------------------------------------------------------------

def make_requirements(
    program,
    curriculum,
    section_count,
    section_capacity,
):
    requirements = []

    next_section_id = 1

    for section_index in range(1, section_count + 1):

        for year_level, subjects in curriculum.items():

            # Every virtual section represents a year level section.
            # The section/year relationship is determined by the curriculum.
            #
            # For a realistic simulation, create requirements only for the
            # subjects belonging to the section's year level.
            section_id = (
                (section_index - 1) * 1000
                + year_level
            )

            for subject in subjects:

                lecture_units = subject["lecture_units"]
                lab_units = subject["lab_units"]

                if lecture_units > 0:
                    requirements.append({
                        "section_id": section_id,
                        "section_number": section_index,
                        "year_level": year_level,
                        "subject_id": subject["subject_id"],
                        "subject_code": subject["subject_code"],
                        "subject_name": subject["subject_name"],
                        "component": "lecture",
                        "hours": lecture_units,
                        "room_type": "lecture",
                        "section_capacity": section_capacity,
                        "program_department_id":
                            program["department_id"],
                    })

                if lab_units > 0:
                    requirements.append({
                        "section_id": section_id,
                        "section_number": section_index,
                        "year_level": year_level,
                        "subject_id": subject["subject_id"],
                        "subject_code": subject["subject_code"],
                        "subject_name": subject["subject_name"],
                        "component": "lab",
                        "hours": lab_units * 3,
                        "room_type": "laboratory",
                        "section_capacity": section_capacity,
                        "program_department_id":
                            program["department_id"],
                    })

        next_section_id += 1

    return requirements


# ---------------------------------------------------------------------------
# FAIL-FIRST ORDERING
# ---------------------------------------------------------------------------

def requirement_sort_key(requirement, candidate_counts):
    """
    Hardest requirements first.

    Priority:
        - fewer candidates
        - laboratory before lecture
        - longer duration
        - larger section
        - stable identifiers
    """

    return (
        candidate_counts.get(
            id(requirement),
            10**9,
        ),
        0 if requirement["component"] == "lab" else 1,
        -requirement["hours"],
        requirement["year_level"],
        requirement["section_number"],
        requirement["subject_id"],
    )


# ---------------------------------------------------------------------------
# BACKTRACK SOLVER
# ---------------------------------------------------------------------------

class SimulationSolver:

    def __init__(
        self,
        requirements,
        professors,
        rooms,
        blocks,
        existing_schedules,
    ):
        self.requirements = requirements
        self.professors = professors
        self.rooms = rooms
        self.blocks = blocks

        self.state = ResourceState(
            professors,
            rooms,
        )

        self.nodes = 0
        self.started = time.monotonic()
        self.stop_reason = None

        self.candidate_cache = {}

        seed_existing_schedules(
            self.state,
            existing_schedules,
            {
                block["slot_ids"][0]: {
                    "day": block["day"],
                    "start": block["start"],
                    "end": block["end"],
                }
                for block in blocks
                if len(block["slot_ids"]) == 1
            },
        )

    def timed_out(self):
        if self.nodes >= MAX_BACKTRACK_NODES:
            self.stop_reason = "node_limit"
            return True

        if (
            time.monotonic() - self.started
            >= MAX_SECONDS
        ):
            self.stop_reason = "time_limit"
            return True

        return False

    def candidates_for(self, requirement):
        # Do not cache candidates permanently because professor workload and
        # resource occupancy change after every assignment.
        return build_candidates(
            requirement,
            self.professors,
            self.rooms,
            self.blocks,
            self.state,
        )

    def choose_next_requirement(self, remaining):
        best = None
        best_candidates = None

        for requirement in remaining:
            if self.timed_out():
                return None, None

            candidates = self.candidates_for(requirement)

            if (
                best is None
                or len(candidates)
                < len(best_candidates)
            ):
                best = requirement
                best_candidates = candidates

                if len(candidates) == 0:
                    break

        return best, best_candidates

    def solve(self, remaining=None):
        if self.timed_out():
            return False

        if remaining is None:
            remaining = list(self.requirements)

        if not remaining:
            return True

        requirement, candidates = (
            self.choose_next_requirement(
                remaining
            )
        )

        if requirement is None:
            return False

        if not candidates:
            self.stop_reason = (
                "no_candidate_for_requirement"
            )
            return False

        # Candidates have already been professor-ranked by build_candidates.
        for candidate in candidates:

            if self.timed_out():
                return False

            assignment = self.state.assign(
                requirement,
                candidate["professor_id"],
                candidate["room_id"],
                candidate["block"],
            )

            next_remaining = [
                item
                for item in remaining
                if item is not requirement
            ]

            if self.solve(next_remaining):
                return True

            self.state.unassign(assignment)

        self.stop_reason = (
            "backtracking_exhausted"
        )

        return False


# ---------------------------------------------------------------------------
# SIMULATE ONE PROGRAM
# ---------------------------------------------------------------------------

def simulate_program_sync(
    program_id,
    academic_term_id,
    students,
    section_capacity=SECTION_CAPACITY,
):
    started = time.monotonic()

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        program = load_program(
            cursor,
            program_id,
        )

        term = load_term(
            cursor,
            academic_term_id,
        )

        curriculum = load_curriculum(
            cursor,
            program_id,
            term["semester"],
        )

        professors = load_professors(cursor)

        load_professor_subjects(
            cursor,
            professors,
        )

        rooms = load_rooms(cursor)

        slots = load_time_slots(cursor)

        existing_schedules = load_existing_schedules(
            cursor,
            academic_term_id,
        )

        if not curriculum:
            raise ValueError(
                f"No curriculum found for "
                f"{program['program_code']} "
                f"and {term['semester']}."
            )

        if not professors:
            raise ValueError(
                "No professors found."
            )

        if not rooms:
            raise ValueError(
                "No available rooms found."
            )

        if not slots:
            raise ValueError(
                "No available time slots found."
            )

        # Important: ceil, not floor.
        # 51 students means 2 sections when capacity is 50.
        section_count = math.ceil(
            students / section_capacity
        )

        blocks = build_virtual_time_blocks(
            slots
        )

        requirements = make_requirements(
            program,
            curriculum,
            section_count,
            section_capacity,
        )

        # Early diagnostics.
        curriculum_summary = {
            year: len(subjects)
            for year, subjects
            in curriculum.items()
        }

        professor_subject_counts = {
            professor["id"]:
                len(professor["qualified_subjects"])
            for professor
            in professors.values()
        }

        solver = SimulationSolver(
            requirements=requirements,
            professors=professors,
            rooms=rooms,
            blocks=blocks,
            existing_schedules=existing_schedules,
        )

        success = solver.solve()

        elapsed = (
            time.monotonic() - started
        )

        assigned = len(
            solver.state.assignments
        )

        total = len(requirements)

        professor_workload = []

        for professor in professors.values():
            hours = solver.state.professor_hours[
                professor["id"]
            ]

            if hours > 0:
                professor_workload.append({
                    "professor_id":
                        professor["id"],
                    "employee_id":
                        professor["employee_id"],
                    "name":
                        professor["name"],
                    "hours":
                        round(hours, 2),
                    "max_hours":
                        professor["max_hours"],
                    "remaining_hours":
                        round(
                            professor["max_hours"]
                            - hours,
                            2,
                        ),
                })

        professor_workload.sort(
            key=lambda x: (
                -x["hours"],
                x["professor_id"],
            )
        )

        return {
            "success": success,

            "programId":
                program["id"],

            "programCode":
                program["program_code"],

            "programName":
                program["program_name"],

            "academicTermId":
                term["id"],

            "semester":
                term["semester"],

            "students":
                students,

            "sectionCapacity":
                section_capacity,

            "sections":
                section_count,

            "requirements":
                total,

            "assigned":
                assigned,

            "unassigned":
                total - assigned,

            "nodes":
                solver.nodes,

            "elapsedSeconds":
                round(elapsed, 3),

            "stopReason":
                solver.stop_reason,

            "curriculum":
                curriculum_summary,

            "professors":
                len(professors),

            "rooms":
                len(rooms),

            "timeBlocks":
                len(blocks),

            "existingSchedules":
                len(existing_schedules),

            "professorWorkload":
                professor_workload,

            "simulationOnly":
                True,
        }

    finally:
        cursor.close()
        connection.close()


async def simulate_program(
    program_id,
    academic_term_id,
    students,
    section_capacity=SECTION_CAPACITY,
):
    """
    Async wrapper.

    The actual scheduler is CPU-bound, so in a production FastAPI/Flask
    server you may want to run this in a worker thread/process.
    """
    return simulate_program_sync(
        program_id=program_id,
        academic_term_id=academic_term_id,
        students=students,
        section_capacity=section_capacity,
    )


# ---------------------------------------------------------------------------
# CAPACITY SEARCH
# ---------------------------------------------------------------------------

def find_program_capacity_sync(
    program_id,
    academic_term_id,
    section_capacity=SECTION_CAPACITY,
    start_students=START_STUDENTS,
    large_step=LARGE_STEP,
    fine_step=FINE_STEP,
    maximum=MAX_SIMULATED_STUDENTS,
):
    """
    Search:

        2500
        3000
        3500
        ...

    until failure.

    Then search the failed interval using 50-student increments.

    The returned maxStudents is the latest successful simulation.
    """

    print("\n========================================")
    print("INDEPENDENT REAL-SCHEDULER SIMULATION")
    print("========================================")

    last_success = None
    first_failure = None
    attempts = []

    students = start_students

    while students <= maximum:

        print(
            f"\n[SIMULATION] "
            f"students={students}"
        )

        result = simulate_program_sync(
            program_id,
            academic_term_id,
            students,
            section_capacity,
        )

        attempts.append(result)

        print(
            f"[RESULT] "
            f"students={students} "
            f"sections={result['sections']} "
            f"success={result['success']} "
            f"assigned={result['assigned']}/"
            f"{result['requirements']} "
            f"nodes={result['nodes']} "
            f"time={result['elapsedSeconds']}s"
        )

        if result["success"]:
            last_success = students
            students += large_step
        else:
            first_failure = students
            break

    if first_failure is None:
        return {
            "success": True,
            "programId": program_id,
            "maxStudents": last_success or 0,
            "maxSections":
                math.floor(
                    (last_success or 0)
                    / section_capacity
                ),
            "firstFailedStudents": None,
            "sectionCapacity":
                section_capacity,
            "reachedSimulationLimit": True,
            "simulationOnly": True,
            "attempts": attempts,
        }

    # Fine search.
    candidate = (
        (last_success or 0)
        + fine_step
    )

    while candidate < first_failure:

        print(
            f"\n[FINE SEARCH] "
            f"students={candidate}"
        )

        result = simulate_program_sync(
            program_id,
            academic_term_id,
            candidate,
            section_capacity,
        )

        attempts.append(result)

        print(
            f"[RESULT] "
            f"students={candidate} "
            f"sections={result['sections']} "
            f"success={result['success']} "
            f"assigned={result['assigned']}/"
            f"{result['requirements']} "
            f"nodes={result['nodes']} "
            f"time={result['elapsedSeconds']}s"
        )

        if result["success"]:
            last_success = candidate
            candidate += fine_step
        else:
            break

    max_students = last_success or 0

    final_sections = (
        math.ceil(
            max_students
            / section_capacity
        )
        if max_students
        else 0
    )

    print("\n========================================")
    print("CAPACITY RESULT")
    print("========================================")
    print(
        f"Maximum students: {max_students}"
    )
    print(
        f"Maximum sections: {final_sections}"
    )
    print(
        f"First failed students: "
        f"{first_failure}"
    )

    return {
        "success": True,
        "programId": program_id,
        "maxStudents": max_students,
        "maxSections": final_sections,
        "firstFailedStudents":
            first_failure,
        "sectionCapacity":
            section_capacity,
        "reachedSimulationLimit": False,
        "simulationOnly": True,
        "attempts": attempts,
    }


async def find_program_capacity(
    program_id,
    academic_term_id,
    section_capacity=SECTION_CAPACITY,
):
    return find_program_capacity_sync(
        program_id,
        academic_term_id,
        section_capacity,
    )


# ---------------------------------------------------------------------------
# ALL PROGRAMS
# ---------------------------------------------------------------------------

def get_all_programs_sync():
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                id,
                program_code,
                program_name,
                department_id
            FROM programs
            WHERE status = 'active'
            ORDER BY id
            """
        )

        return cursor.fetchall()

    finally:
        cursor.close()
        connection.close()


def get_active_term_sync():
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                id,
                school_year,
                semester
            FROM academic_terms
            WHERE status = 'active'
            ORDER BY id DESC
            LIMIT 1
            """
        )

        row = cursor.fetchone()

        if not row:
            raise ValueError(
                "No active academic term found."
            )

        return row

    finally:
        cursor.close()
        connection.close()


def check_all_program_capacities_sync():
    term = get_active_term_sync()
    programs = get_all_programs_sync()

    results = []
    skipped = []

    print("\n========================================")
    print("UNIVERSITY CAPACITY SIMULATION")
    print("========================================")
    print(
        f"Academic Term: {term['id']}"
    )
    print(
        f"Semester: {term['semester']}"
    )
    print(
        f"Programs: {len(programs)}"
    )

    for program in programs:

        print("\n----------------------------------------")
        print(
            f"[PROGRAM] "
            f"{program['program_code']} - "
            f"{program['program_name']}"
        )
        print("----------------------------------------")

        try:
            result = find_program_capacity_sync(
                program_id=program["id"],
                academic_term_id=term["id"],
                section_capacity=SECTION_CAPACITY,
            )

            result["programCode"] = (
                program["program_code"]
            )

            result["programName"] = (
                program["program_name"]
            )

            results.append(result)

        except Exception as exc:
            print(
                f"[PROGRAM SKIPPED] "
                f"{program['program_code']}: "
                f"{exc}"
            )

            skipped.append({
                "programId": program["id"],
                "programCode":
                    program["program_code"],
                "programName":
                    program["program_name"],
                "reason": str(exc),
            })

    capacity = {
        result["programCode"]:
            result["maxStudents"]
        for result in results
    }

    print("\n========================================")
    print("FINAL UNIVERSITY CAPACITY")
    print("========================================")

    for result in results:
        print(
            f"{result['programCode']}: "
            f"{result['maxStudents']} students "
            f"({result['maxSections']} sections)"
        )

    return {
        "success": True,
        "academicTermId": term["id"],
        "academicTerm":
            f"{term['school_year']} - "
            f"{term['semester']}",
        "sectionCapacity":
            SECTION_CAPACITY,
        "totalPrograms":
            len(programs),
        "simulatedPrograms":
            len(results),
        "skippedPrograms":
            len(skipped),
        "programs":
            results,
        "skipped":
            skipped,
        "capacity":
            capacity,
        "simulationOnly":
            True,
    }


async def check_all_program_capacities():
    return check_all_program_capacities_sync()


# ---------------------------------------------------------------------------
# OPTIONAL CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Example:
    #
    # python simulation_scheduler.py
    #
    # It will use the active term and test all active programs.

    result = check_all_program_capacities_sync()

    print("\nDONE")
    print(result["capacity"])