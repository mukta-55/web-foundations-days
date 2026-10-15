# School Database Design

## Tables

- **students**: one row per student. Columns: `id` (primary key), `name` and `email`. The email is unique, so no two students can share one.
- **courses**: one row per course. Columns: `id` (primary key) and `title`.
- **enrolments**: one row for each time a student is enrolled on a course. Columns: `student_id`, `course_id` and `grade`. Both ids are foreign keys, and together they form the primary key.

## Relationships

- **One-to-many:** one student has many enrolments, and one course has many enrolments. Each enrolment row belongs to exactly one student and one course.
- **Many-to-many:** students and courses. A student can take many courses, and a course can have many students.
- **Why a join table is needed:** a single column cannot hold many values, and storing a list in one column makes data hard to search and update. The `enrolments` table is the join table. It stores one pair of ids for each enrolment and holds the grade. Its primary key (`student_id`, `course_id`) stops the same student enrolling on the same course twice.

## Index

I would add an index on `enrolments(course_id)`. Queries such as "all students on one course" and "the number of students per course" look up enrolments by course. The primary key already covers lookups that start with `student_id`, but not lookups by `course_id`, so this index lets the database jump straight to the right rows instead of checking every row. The cost is that inserts and updates become slightly slower and the index uses extra space, which is a fair trade for a column we search often.

## SQL or NoSQL?

I would choose SQL for this system. The data is clearly structured, with students, courses and enrolments that follow fixed columns, and it has a real many-to-many relationship that SQL handles well with a join table and JOINs. Rules such as a unique email and no double enrolment are enforced by the database itself, which matters for records like grades where correctness is critical. A document database would suit data that changes shape often or must spread across very many servers, and a school's records need neither.
