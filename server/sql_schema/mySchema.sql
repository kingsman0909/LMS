create database lms_db;
use lms_db;

drop database lms_db;

show tables;

CREATE TABLE student_applications (

    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,

    password VARCHAR(255) NOT NULL,

    firstname VARCHAR(50) NOT NULL,

    middlename VARCHAR(50),

    lastname VARCHAR(50) NOT NULL,

    course_id INT NOT NULL,

    year_level INT NOT NULL,

    section VARCHAR(20),

    phone VARCHAR(20),

    gender VARCHAR(20),

    birthdate DATE,

    address TEXT,

    status ENUM(
        'pending',
        'approved',
        'rejected'
    ) DEFAULT 'pending',

    reviewed_by INT NULL,

    reviewed_at TIMESTAMP NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (course_id)
        REFERENCES programs(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (reviewed_by)
        REFERENCES users(id)
        ON DELETE SET NULL

);

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,

    email VARCHAR(100) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,

    role ENUM('student', 'professor', 'admin') NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT UNIQUE NOT NULL,

    firstname VARCHAR(50) NOT NULL,
    lastname VARCHAR(50) NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE student (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT UNIQUE NOT NULL,

    student_id VARCHAR(20) UNIQUE NOT NULL,

    firstname VARCHAR(50) NOT NULL,
    middlename VARCHAR(50),
    lastname VARCHAR(50) NOT NULL,

    course VARCHAR(100) NOT NULL,
    year_level INT NOT NULL,
    section_id int,
    
    phone VARCHAR(20),
    gender VARCHAR(20),
    birthdate DATE,
    address TEXT,
    profile_picture VARCHAR(255),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);



CREATE TABLE profesor (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT UNIQUE NOT NULL,

    employee_id VARCHAR(20) UNIQUE NOT NULL,

    firstname VARCHAR(50) NOT NULL,
    middlename VARCHAR(50),
    lastname VARCHAR(50) NOT NULL,

    department VARCHAR(100) NOT NULL,
    position VARCHAR(50),

    phone VARCHAR(20),
    gender VARCHAR(20),
    birthdate DATE,
    address TEXT,
    profile_picture VARCHAR(255),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE programs (
    id INT AUTO_INCREMENT PRIMARY KEY,

    program_code VARCHAR(20) UNIQUE NOT NULL,
    program_name VARCHAR(100) UNIQUE NOT NULL,

    description TEXT,

    status ENUM('active', 'inactive')
        DEFAULT 'active',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

show tables;

CREATE TABLE announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,

    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,

    created_by INT NOT NULL,
    created_role ENUM('student', 'professor', 'admin') NOT NULL,

    target_role ENUM('student', 'professor', 'all')
        NOT NULL DEFAULT 'all',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
);

CREATE TABLE professor_subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,

    professor_id INT NOT NULL,
    subject_id INT NOT NULL,

    FOREIGN KEY (professor_id)
        REFERENCES profesor(id)
        ON DELETE CASCADE,

    FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON DELETE CASCADE,

    UNIQUE (professor_id, subject_id)
);

CREATE TABLE subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,

    subject_code VARCHAR(20) UNIQUE NOT NULL,
    subject_name VARCHAR(100) NOT NULL,
    description TEXT,

    units INT NOT NULL DEFAULT 3,
    lecture_units INT NOT NULL DEFAULT 0,
    lab_units INT NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE curriculum_subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,

    program_id INT NOT NULL,
    subject_id INT NOT NULL,

    year_level ENUM(
        '1st Year',
        '2nd Year',
        '3rd Year',
        '4th Year'
    ) NOT NULL,

    semester ENUM(
        '1st Semester',
        '2nd Semester',
        'Summer'
    ) NOT NULL,

    FOREIGN KEY (program_id)
        REFERENCES programs(id)
        ON DELETE CASCADE,

    FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON DELETE CASCADE,

    UNIQUE (program_id, subject_id)
);

CREATE TABLE academic_terms (
    id INT AUTO_INCREMENT PRIMARY KEY,

    school_year VARCHAR(20) NOT NULL,
    semester ENUM('1st Semester', '2nd Semester', 'Summer') NOT NULL,

    status ENUM('active', 'inactive') DEFAULT 'inactive',

    enrollment_open BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE student_enrollments (

    id INT AUTO_INCREMENT PRIMARY KEY,

    student_id INT NOT NULL,

    section_id INT NOT NULL,

    status ENUM(
        'pending',
        'approved',
        'rejected',
        'dropped'
    ) DEFAULT 'pending',

    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    approved_at TIMESTAMP NULL,

    approved_by INT NULL,

    remarks TEXT NULL,

    FOREIGN KEY (student_id)
        REFERENCES student(id)
        ON DELETE CASCADE,

    FOREIGN KEY (section_id)
        REFERENCES sections(id)
        ON DELETE CASCADE,

    FOREIGN KEY (approved_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    UNIQUE (
        student_id,
        section_id
    )

);


-- 5. Test announcement created by professor user_id = 2

CREATE TABLE sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    program_id INT NOT NULL,
    section_name VARCHAR(50) NOT NULL,
	academic_term_id INT NOT NULL,
	
    FOREIGN KEY (academic_term_id)
		REFERENCES academic_terms(id)
        ON DELETE CASCADE,
        
    FOREIGN KEY (program_id)
        REFERENCES programs(id)
        ON DELETE CASCADE,

    UNIQUE (
        program_id,
        section_name,
        academic_term_id
    )
);

CREATE TABLE rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_name VARCHAR(50) NOT NULL,
    room_type ENUM('lecture', 'laboratory') NOT NULL DEFAULT 'lecture',
    capacity INT NOT NULL DEFAULT 30,
    status ENUM('available', 'unavailable') NOT NULL DEFAULT 'available'
);

CREATE TABLE time_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day ENUM(
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday'
    ) NOT NULL,

    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    status ENUM('available', 'unavailable')
        NOT NULL DEFAULT 'available'
);


CREATE TABLE class_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,

    section_id INT NOT NULL,
    subject_id INT NOT NULL,
    professor_id INT NOT NULL,

    room_id INT NOT NULL,
    time_slot_id INT NOT NULL,

    academic_term_id INT NOT NULL,

    FOREIGN KEY (section_id)
        REFERENCES sections(id),

    FOREIGN KEY (subject_id)
        REFERENCES subjects(id),

    FOREIGN KEY (professor_id)
        REFERENCES profesor(id),

    FOREIGN KEY (room_id)
        REFERENCES rooms(id),

    FOREIGN KEY (time_slot_id)
        REFERENCES time_slots(id),

    FOREIGN KEY (academic_term_id)
        REFERENCES academic_terms(id)
);

CREATE TABLE student_sections (
    id INT AUTO_INCREMENT PRIMARY KEY,

    student_id INT NOT NULL,
    section_id INT NOT NULL,

    academic_term_id int not null,

    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (academic_term_id) 
		REFERENCES academic_terms (id),

    UNIQUE (
        student_id,
        school_year,
        semester
    )
);

CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_code VARCHAR(20) NOT NULL UNIQUE,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);



delete from student
where username = "princessThea";


drop table courses;
drop table enrollments;
SET FOREIGN_KEY_CHECKS = 1; -- enable foreign key checks turn it to 0 to delete table with foreign key
	
delete from sections
where id > 0;

select * from users;
select * from time_slots;
select * from student_applications;
select * from users;
select * from time_slots;
select * from professor_subjects;
select * from rooms;
select * from subjects;
select * from curriculum_subjects;
select * from programs;
select * from student;
select * from profesor;
select * from sections;
select * from student_sections;
select * from announcements;
select * from academic_terms;
select * from student_enrollments;
select * from class_schedules;
select * from departments;


select * from subjects where id in (142, 143, 144, 145, 146);
delete from class_schedules
where id > 0;

SHOW CREATE TABLE class_schedules;
SHOW CREATE TABLE time_slots;
SHOW CREATE TABLE rooms;
SHOW CREATE TABLE profesor;
SHOW CREATE TABLE programs;
SHOW CREATE TABLE users;
SHOW CREATE TABLE departments;
SHOW CREATE TABLE professor_subjects;
SHOW CREATE TABLE curriculum_subjects;
SHOW CREATE TABLE subjects;
SHOW CREATE TABLE academic_terms;
show create table student_sections;

show create table class_schedules;
SHOW CREATE TABLE sections;
describe student_applications;
SELECT
    cs.id,
    s.subject_code,
    s.subject_name,
    p.firstname,
    p.lastname,
    r.room_name,
    ts.day,
    ts.start_time,
    ts.end_time
FROM class_schedules cs
JOIN subjects s
    ON s.id = cs.subject_id
JOIN profesor p
    ON p.id = cs.professor_id
JOIN rooms r
    ON r.id = cs.room_id
JOIN time_slots ts
    ON ts.id = cs.time_slot_id
WHERE cs.section_id = 1
AND cs.academic_term_id = 1
ORDER BY ts.day, ts.start_time;

SELECT
    s.id AS section_id,
    s.section_name,
    s.program_id,
    s.year_level,
    at.school_year,
    at.semester
FROM sections s
JOIN academic_terms at
    ON at.id = s.academic_term_id
WHERE s.id = 1;

delete from sections
where id > 0;

delete from profesor
where id = 3;
delete from users
where username = "cyrus";

delete from users
where id > 2;
SET SESSION cte_max_recursion_depth = 5000;


INSERT INTO student_applications
(
    email,
    username,
    password,
    firstname,
    middlename,
    lastname,
    course_id,
    year_level,
    section,
    phone,
    gender,
    birthdate,
    address,
    status
)
SELECT
    CONCAT(
        CASE course_id
            WHEN 1 THEN 'bscs'
            WHEN 2 THEN 'bsit'
            WHEN 3 THEN 'bsie'
            WHEN 4 THEN 'bsn'
        END,
        '_test_',
        n,
        '@example.com'
    ) AS email,

    CONCAT(
        CASE course_id
            WHEN 1 THEN 'bscs'
            WHEN 2 THEN 'bsit'
            WHEN 3 THEN 'bsie'
            WHEN 4 THEN 'bsn'
        END,
        '_test_',
        n
    ) AS username,

    '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
        AS password,

    CONCAT(
        CASE course_id
            WHEN 1 THEN 'BSCSFirst'
            WHEN 2 THEN 'BSITFirst'
            WHEN 3 THEN 'BSIEFirst'
            WHEN 4 THEN 'BSNFirst'
        END,
        n
    ) AS firstname,

    'Test' AS middlename,

    CONCAT(
        CASE course_id
            WHEN 1 THEN 'BSCSStudent'
            WHEN 2 THEN 'BSITStudent'
            WHEN 3 THEN 'BSIEStudent'
            WHEN 4 THEN 'BSNStudent'
        END,
        n
    ) AS lastname,

    course_id,

    CASE
        WHEN n <= 750 THEN 1
        WHEN n <= 1000 THEN 2
        WHEN n <= 1250 THEN 3
        ELSE 4
    END AS year_level,

    NULL AS section,

    CONCAT(
        '09',
        LPAD(
            ((course_id - 1) * 2000) + n,
            9,
            '0'
        )
    ) AS phone,

    CASE
        WHEN MOD(n, 2) = 0 THEN 'Male'
        ELSE 'Female'
    END AS gender,

    DATE_ADD(
        '2000-01-01',
        INTERVAL MOD(
            ((course_id - 1) * 2000) + n,
            3000
        ) DAY
    ) AS birthdate,

    CONCAT(
        'Test Address ',
        CASE course_id
            WHEN 1 THEN 'BSCS'
            WHEN 2 THEN 'BSIT'
            WHEN 3 THEN 'BSIE'
            WHEN 4 THEN 'BSN'
        END,
        ' ',
        n
    ) AS address,


    'pending' AS status

FROM
(
    SELECT
        500
        + ones.n
        + tens.n * 10
        + hundreds.n * 100
        + thousands.n * 1000
        + 1 AS n,

        programs.course_id

    FROM
    (
        SELECT 1 AS course_id
        UNION ALL SELECT 2
        UNION ALL SELECT 3
        UNION ALL SELECT 4
    ) programs

    CROSS JOIN
    (
        SELECT 0 AS n
        UNION ALL SELECT 1
        UNION ALL SELECT 2
        UNION ALL SELECT 3
        UNION ALL SELECT 4
        UNION ALL SELECT 5
        UNION ALL SELECT 6
        UNION ALL SELECT 7
        UNION ALL SELECT 8
        UNION ALL SELECT 9
    ) ones

    CROSS JOIN
    (
        SELECT 0 AS n
        UNION ALL SELECT 1
        UNION ALL SELECT 2
        UNION ALL SELECT 3
        UNION ALL SELECT 4
        UNION ALL SELECT 5
        UNION ALL SELECT 6
        UNION ALL SELECT 7
        UNION ALL SELECT 8
        UNION ALL SELECT 9
    ) tens

    CROSS JOIN
    (
        SELECT 0 AS n
        UNION ALL SELECT 1
        UNION ALL SELECT 2
        UNION ALL SELECT 3
        UNION ALL SELECT 4
        UNION ALL SELECT 5
        UNION ALL SELECT 6
        UNION ALL SELECT 7
        UNION ALL SELECT 8
        UNION ALL SELECT 9
    ) hundreds

    CROSS JOIN
    (
        SELECT 0 AS n
        UNION ALL SELECT 1
        UNION ALL SELECT 2
        UNION ALL SELECT 3
        UNION ALL SELECT 4
        UNION ALL SELECT 5
        UNION ALL SELECT 6
        UNION ALL SELECT 7
        UNION ALL SELECT 8
        UNION ALL SELECT 9
    ) thousands

) numbers

WHERE n BETWEEN 501 AND 1500;



SELECT
    p.id,
    p.employee_id,
    CONCAT(p.firstname, ' ', p.lastname) AS professor,
    COUNT(cs.id) AS current_workload
FROM profesor p
LEFT JOIN class_schedules cs
    ON cs.professor_id = p.id
WHERE p.employee_id IN (
    'EMP-IT021',
    'EMP-IT022',
    'EMP-IT023',
    'EMP-IT024',
    'EMP-IT025',
    'EMP-IT026',
    'EMP-IT027',
    'EMP-IT028',
    'EMP-IT029',
    'EMP-IT030'
)
GROUP BY
    p.id,
    p.employee_id,
    p.firstname,
    p.lastname
ORDER BY p.id;


START TRANSACTION;

DELETE FROM sections where id > 0;
DELETE FROM student where id > 0;
DELETE FROM student_applications where id > 0;
DELETE FROM users WHERE role = 'student' and id > 0;

-- inspect everything

COMMIT;

delete from professor_subjects
where id > 0;

delete from class_schedules
where id > 0;



delete from curriculum_subjects
where id > 0;

select * from sections;

show create table subjects;
select * from profesor;


select count(*) from class_schedules;
SELECT
    p.id AS professor_id,
    p.employee_id,
    p.firstname,
    p.lastname,
    p.max_weekly_hours,
    s.id AS subject_id,
    s.subject_code,
    s.subject_name
FROM profesor p
INNER JOIN professor_subjects ps
    ON ps.professor_id = p.id
INNER JOIN subjects s
    ON s.id = ps.subject_id
WHERE s.subject_code = 'CS306'
ORDER BY p.id;