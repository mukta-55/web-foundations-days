# Library API Design: Books

This is a REST API design for the `books` resource of a library. Each book has an `id`, a `title`, an `author` and a `year`.

## Endpoints

### 1. List books

- **Method and path:** GET /books
- **Description:** Returns all books.
- **Example request body:** none (GET requests have no body)
- **Success status code:** 200 OK

### 2. Get one book

- **Method and path:** GET /books/7
- **Description:** Returns the book with id 7.
- **Example request body:** none
- **Success status code:** 200 OK

### 3. Create a book

- **Method and path:** POST /books
- **Description:** Creates a new book from the data in the body.
- **Example request body:**

```json
{ "title": "Things Fall Apart", "author": "Chinua Achebe", "year": 1958 }
```

- **Success status code:** 201 Created

### 4. Update a book

- **Method and path:** PATCH /books/7
- **Description:** Updates only the fields sent in the body for book 7.
- **Example request body:**

```json
{ "year": 1959 }
```

- **Success status code:** 200 OK

### 5. Delete a book

- **Method and path:** DELETE /books/7
- **Description:** Removes the book with id 7.
- **Example request body:** none
- **Success status code:** 204 No Content

### 6. List books by an author

- **Method and path:** GET /books?author=Chinua%20Achebe
- **Description:** Returns only the books whose author matches the `author` query parameter.
- **Example request body:** none
- **Success status code:** 200 OK

## Error codes

- **400 Bad Request:** the request was invalid. Example: POST /books with an empty title.
- **404 Not Found:** the book or URL does not exist. Example: GET /books/999 when no book has id 999.
