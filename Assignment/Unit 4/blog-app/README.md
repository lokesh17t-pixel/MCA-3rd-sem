# Blog Application with Role-Based Access Control (RBAC)

This project extends the Blog Application developed in class by adding **Role-Based Access Control (RBAC)**.

---

## Authentication vs Authorization

| Concept          | Meaning                                                                 |
|------------------|-------------------------------------------------------------------------|
| **Authentication** | Verifying *who* the user is (login / session cookie).                 |
| **Authorization**  | Deciding *what* the authenticated user is allowed to do (roles).    |

Flow for every protected request:

```
Request
  ↓
Authentication (authMiddleware)  →  identifies the user via signed cookie
  ↓
Authorization (authorizeRoles / checkBlogOwnership)  →  checks role + ownership
  ↓
Allow / Deny (200 or 403)
```

---

## Roles & Permissions

| Role     | Permissions                                                                 |
|----------|-----------------------------------------------------------------------------|
| **Admin**  | • Manage all users (list, change role, delete)<br>• Create, update & delete **any** blog<br>• Manage comments<br>• Full administrative access |
| **Author** | • Create blogs<br>• Update / delete **only their own** blogs<br>• Manage their own content<br>• Add comments & likes |
| **User**   | • View blogs<br>• Add comments<br>• Like blogs<br>• No blog create / update / delete |

Default role on registration: **`user`**.  
Self-registration allows choosing `user` or `author`.  
Admin accounts should be created manually (or by promoting a user via the admin API).

---

## Protected APIs

### Blog Routes (`/blogs`)

| Method   | Endpoint              | Auth required | Allowed Roles      | Ownership check |
|----------|-----------------------|---------------|--------------------|-----------------|
| GET      | `/blogs`              | No            | Public             | –               |
| GET      | `/blogs/search`       | No            | Public             | –               |
| GET      | `/blogs/:id`          | No            | Public             | –               |
| **POST** | `/blogs`              | Yes           | admin, author      | –               |
| **PUT**  | `/blogs/:id`          | Yes           | admin, author      | Yes (owner or admin) |
| **PATCH**| `/blogs/:id`          | Yes           | admin, author      | Yes (owner or admin) |
| **DELETE**| `/blogs/:id`         | Yes           | admin, author      | Yes (owner or admin) |
| POST     | `/blogs/:id/comment`  | Yes           | admin, author, user| –               |
| POST     | `/blogs/:id/likes`    | Yes           | admin, author, user| –               |

### User / Admin Routes (`/users`)

| Method   | Endpoint            | Auth required | Allowed Roles |
|----------|---------------------|---------------|---------------|
| POST     | `/users/register`   | No            | Public        |
| POST     | `/users/login`      | No            | Public        |
| POST     | `/users/logout`     | Yes           | Any logged-in |
| POST     | `/users/logout-all` | Yes           | Any logged-in |
| **GET**  | `/users`            | Yes           | **admin**     |
| **PATCH**| `/users/:id/role`   | Yes           | **admin**     |
| **DELETE**| `/users/:id`       | Yes           | **admin**     |

---

## How Authorization Works

### 1. Authentication Middleware (`middleware/authMiddleware.js`)
- Reads the signed `sid` cookie.
- Loads the session and the corresponding user.
- Attaches `req.user` (without password) for downstream middlewares.

### 2. Role Authorization Middleware (`middleware/rbacMiddleware.js`)
```js
authorizeRoles("admin", "author")
```
- Checks that `req.user.role` is one of the allowed roles.
- Returns **403 Forbidden** with a clear message if the role is not permitted.

### 3. Ownership Check Middleware (`checkBlogOwnership`)
- Loads the blog by `:id`.
- **Admin** → always allowed.
- **Author** → allowed only when `blog.userId === req.user._id`.
- **User** → always denied for update/delete.
- Returns **403** when ownership rules are violated.

---

## Unauthorized Access Responses

| Situation                        | HTTP Status | Example message |
|----------------------------------|-------------|-----------------|
| Not logged in                    | **401**     | Please login first |
| Session expired / invalid        | **401**     | Session expired. Please login again. |
| Wrong role                       | **403**     | Access denied. Required role(s): admin, author. Your role: user |
| Author tries to edit another's blog | **403**  | Access denied. You can only modify or delete your own blogs. |
| Resource not found               | **404**     | Blog not found |

---

## Project Structure

```
blog-app/
├── app.js
├── package.json
├── .gitignore
├── README.md
├── controllers/
│   └── userController.js
├── db/
│   └── db.js
├── middleware/
│   ├── authMiddleware.js      # Authentication
│   └── rbacMiddleware.js      # Authorization (roles + ownership)
├── models/
│   ├── User.js                # role field added
│   ├── Blog.js
│   ├── Session.js
│   └── OTP.js
├── routes/
│   ├── blogRoutes.js          # RBAC applied on POST/PUT/PATCH/DELETE
│   └── userRoutes.js          # Admin user-management routes
└── uploads/
```

---

## Setup

1. Clone the repository.
2. `cd "Assignment/Unit 4/blog-app"`
3. `npm install`
4. Create a `.env` file (never commit it):
   ```
   PORT=8000
   SECRET_KEY=your-secret-key
   MONGODB_URL=your-mongodb-connection-string
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   SMTP_USER=...
   SMTP_PASS=...
   ```
5. `npm start`

---

## Creating an Admin User

After registering a normal user, promote them with the admin API (or directly in MongoDB):

```bash
# After logging in as an existing admin
PATCH /users/<userId>/role
Body: { "role": "admin" }
```

Or insert an admin document manually in the database.

---

## Key Concepts Demonstrated

- **Authentication vs Authorization**
- **RBAC** (Role-Based Access Control)
- **Roles and Permissions** matrix
- **Authorization middleware** chain
- **Resource ownership** checks
- **Protected routes** with proper HTTP status codes
- **Unauthorized access handling** (401 / 403)
