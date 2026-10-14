# CareerTrack - Job Application Management System

CareerTrack is a full-stack web application that helps job seekers
organize and track their job applications in one place.

## Features

- User registration and login
- Secure password hashing
- JWT-based authentication
- Add, view, update, and delete job applications
- Track application statuses
- Search and filter applications
- Dashboard with application statistics
- Analytics and charts
- PostgreSQL database integration
- User-specific application data

## Tech Stack

- Python
- FastAPI
- PostgreSQL
- HTML
- CSS
- JavaScript
- Chart.js
- JWT Authentication

## Project Structure

```text
careertrack/
├── api.py
├── database.py
├── main.py
├── requirements.txt
├── README.md
├── .gitignore
└── frontend/
    ├── index.html
    ├── style.css
    └── script.js

## Prerequisites

- Python 3
- PostgreSQL
- pip

## Installation

### 1. Clone the repository

After creating your GitHub repository, replace the URL below with your actual repository URL.

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd careertrack
```

### 2. Create and activate a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the project root and add your own database credentials and a securely generated JWT secret.

```env
DB_HOST=localhost
DB_NAME=careertrack_db
DB_USER=careertrack_user
DB_PASSWORD=YOUR_DATABASE_PASSWORD
DB_PORT=5432
JWT_SECRET_KEY=YOUR_GENERATED_SECRET
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
```

Never upload your `.env` file to GitHub.

### 5. Run the backend

```bash
uvicorn api:app --reload
```

API documentation: http://127.0.0.1:8000/docs

### 6. Run the frontend

Open a second terminal:

```bash
python3 -m http.server 5500 --directory frontend
```

Open http://127.0.0.1:5500 in your browser.

## Security

- Passwords are hashed before storage.
- JWT is used for authentication.
- Database credentials and JWT secrets are loaded from environment variables.
- Application records are associated with individual users.

## Future Improvements

- Deploy the application online.
- Add automated tests.
- Improve reporting and analytics.
