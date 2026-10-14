import os
import re

from datetime import date, datetime, timedelta, timezone
from typing import Optional

import jwt

from dotenv import load_dotenv
from pwdlib import PasswordHash

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from database import get_connection


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is missing. Configure it in the .env file."
    )

if JWT_ALGORITHM != "HS256":
    raise RuntimeError(
        "This implementation expects JWT_ALGORITHM=HS256."
    )

password_hash = PasswordHash.recommended()
security = HTTPBearer(auto_error=False)

app = FastAPI(
    title="CareerTrack API",
    description="Job application management with user authentication",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


# --------------------------------------------------
# CONSTANTS
# --------------------------------------------------

VALID_STATUSES = {
    "Applied",
    "Assessment",
    "Interview",
    "Selected",
    "Rejected",
}


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class ApplicationCreate(BaseModel):
    company: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=150)
    status: str = "Applied"
    application_date: date = Field(default_factory=date.today)
    notes: str = ""


class StatusUpdate(BaseModel):
    status: str


class ApplicationDetailsUpdate(BaseModel):
    application_date: Optional[date] = None
    notes: Optional[str] = None


# --------------------------------------------------
# VALIDATION HELPERS
# --------------------------------------------------

def validate_status(application_status: str):
    if application_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid status. Choose one of: "
                + ", ".join(sorted(VALID_STATUSES))
            ),
        )


def normalize_email(email: str) -> str:
    email = email.strip().lower()

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(
            status_code=422,
            detail="Enter a valid email address.",
        )

    return email


def get_application_or_404(cursor, application_id: int, user_id: int):
    cursor.execute(
        """
        SELECT id, company, role, status, created_at,
               application_date, notes
        FROM applications
        WHERE id = %s AND user_id = %s
        """,
        (application_id, user_id),
    )

    row = cursor.fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found.",
        )

    return row


def application_to_dict(row):
    return {
        "id": row[0],
        "company": row[1],
        "role": row[2],
        "status": row[3],
        "created_at": row[4],
        "application_date": row[5],
        "notes": row[6],
    }


# --------------------------------------------------
# JWT HELPERS
# --------------------------------------------------

def create_access_token(user_id: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=JWT_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please log in to access this resource.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        subject = payload.get("sub")

        if not subject:
            raise jwt.InvalidTokenError("Missing user ID")

        user_id = int(subject)

    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, name, email
                    FROM users
                    WHERE id = %s
                    """,
                    (user_id,),
                )

                user = cursor.fetchone()

                if user is None:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="User account not found.",
                    )

                return {
                    "id": user[0],
                    "name": user[1],
                    "email": user[2],
                }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not verify the user account.",
        )


# --------------------------------------------------
# PUBLIC ENDPOINT
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Welcome to CareerTrack API",
        "version": "3.0.0",
        "authentication": "JWT",
        "docs": "/docs",
    }


# --------------------------------------------------
# USER REGISTRATION
# --------------------------------------------------

@app.post("/auth/register", status_code=201)
def register_user(user: UserRegister):
    name = user.name.strip()

    if not name:
        raise HTTPException(
            status_code=422,
            detail="Name cannot be empty.",
        )

    email = normalize_email(user.email)

    hashed_password = password_hash.hash(user.password)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:

                # Serialize registrations so the first account
                # can safely receive the existing unowned records.
                cursor.execute(
                    "LOCK TABLE users IN EXCLUSIVE MODE"
                )

                cursor.execute(
                    "SELECT id FROM users WHERE email = %s",
                    (email,),
                )

                if cursor.fetchone() is not None:
                    raise HTTPException(
                        status_code=409,
                        detail="An account with this email already exists.",
                    )

                cursor.execute("SELECT COUNT(*) FROM users")
                user_count = cursor.fetchone()[0]

                cursor.execute(
                    """
                    INSERT INTO users (name, email, password_hash)
                    VALUES (%s, %s, %s)
                    RETURNING id, name, email, created_at
                    """,
                    (name, email, hashed_password),
                )

                new_user = cursor.fetchone()

                # Assign the existing applications to the first
                # registered user only.
                if user_count == 0:
                    cursor.execute(
                        """
                        UPDATE applications
                        SET user_id = %s
                        WHERE user_id IS NULL
                        """,
                        (new_user[0],),
                    )

                return {
                    "message": "Account created successfully.",
                    "user": {
                        "id": new_user[0],
                        "name": new_user[1],
                        "email": new_user[2],
                        "created_at": new_user[3],
                    },
                }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not register the account.",
        )


# --------------------------------------------------
# USER LOGIN
# --------------------------------------------------

@app.post("/auth/login")
def login_user(credentials: UserLogin):
    email = normalize_email(credentials.email)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, name, email, password_hash
                    FROM users
                    WHERE email = %s
                    """,
                    (email,),
                )

                user = cursor.fetchone()

                if (
                    user is None
                    or not password_hash.verify(
                        credentials.password,
                        user[3],
                    )
                ):
                    raise HTTPException(
                        status_code=401,
                        detail="Incorrect email or password.",
                        headers={"WWW-Authenticate": "Bearer"},
                    )

                token = create_access_token(user[0])

                return {
                    "access_token": token,
                    "token_type": "bearer",
                    "expires_in": JWT_EXPIRE_MINUTES * 60,
                    "user": {
                        "id": user[0],
                        "name": user[1],
                        "email": user[2],
                    },
                }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not log in.",
        )


# --------------------------------------------------
# CURRENT USER
# --------------------------------------------------

@app.get("/auth/me")
def get_my_profile(current_user: dict = Depends(get_current_user)):
    return current_user


# --------------------------------------------------
# GET APPLICATIONS
# --------------------------------------------------

@app.get("/applications")
def get_applications(
    current_user: dict = Depends(get_current_user),
):
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, company, role, status, created_at,
                           application_date, notes
                    FROM applications
                    WHERE user_id = %s
                    ORDER BY id
                    """,
                    (current_user["id"],),
                )

                rows = cursor.fetchall()

                return [application_to_dict(row) for row in rows]

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve applications.",
        )


# --------------------------------------------------
# CREATE APPLICATION
# --------------------------------------------------

@app.post("/applications", status_code=201)
def create_application(
    application: ApplicationCreate,
    current_user: dict = Depends(get_current_user),
):
    company = application.company.strip()
    role = application.role.strip()

    if not company:
        raise HTTPException(
            status_code=422,
            detail="Company name cannot be empty.",
        )

    if not role:
        raise HTTPException(
            status_code=422,
            detail="Job role cannot be empty.",
        )

    validate_status(application.status)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO applications
                        (
                            company,
                            role,
                            status,
                            application_date,
                            notes,
                            user_id
                        )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, company, role, status, created_at,
                              application_date, notes
                    """,
                    (
                        company,
                        role,
                        application.status,
                        application.application_date,
                        application.notes,
                        current_user["id"],
                    ),
                )

                row = cursor.fetchone()

                return application_to_dict(row)

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not create application.",
        )


# --------------------------------------------------
# UPDATE APPLICATION STATUS
# --------------------------------------------------

@app.patch("/applications/{application_id}")
def update_application_status(
    application_id: int,
    update: StatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    validate_status(update.status)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE applications
                    SET status = %s
                    WHERE id = %s AND user_id = %s
                    RETURNING id, company, role, status, created_at,
                              application_date, notes
                    """,
                    (
                        update.status,
                        application_id,
                        current_user["id"],
                    ),
                )

                row = cursor.fetchone()

                if row is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Application not found.",
                    )

                return application_to_dict(row)

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not update application status.",
        )


# --------------------------------------------------
# UPDATE APPLICATION DETAILS
# --------------------------------------------------

@app.patch("/applications/{application_id}/details")
def update_application_details(
    application_id: int,
    update: ApplicationDetailsUpdate,
    current_user: dict = Depends(get_current_user),
):
    if update.application_date is None and update.notes is None:
        raise HTTPException(
            status_code=422,
            detail="Provide an application date or notes to update.",
        )

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                get_application_or_404(
                    cursor,
                    application_id,
                    current_user["id"],
                )

                if update.application_date is not None:
                    cursor.execute(
                        """
                        UPDATE applications
                        SET application_date = %s
                        WHERE id = %s AND user_id = %s
                        """,
                        (
                            update.application_date,
                            application_id,
                            current_user["id"],
                        ),
                    )

                if update.notes is not None:
                    cursor.execute(
                        """
                        UPDATE applications
                        SET notes = %s
                        WHERE id = %s AND user_id = %s
                        """,
                        (
                            update.notes,
                            application_id,
                            current_user["id"],
                        ),
                    )

                row = get_application_or_404(
                    cursor,
                    application_id,
                    current_user["id"],
                )

                return application_to_dict(row)

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not update application details.",
        )


# --------------------------------------------------
# DELETE APPLICATION
# --------------------------------------------------

@app.delete("/applications/{application_id}")
def delete_application(
    application_id: int,
    current_user: dict = Depends(get_current_user),
):
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE FROM applications
                    WHERE id = %s AND user_id = %s
                    RETURNING id, company
                    """,
                    (application_id, current_user["id"]),
                )

                row = cursor.fetchone()

                if row is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Application not found.",
                    )

                return {
                    "message": "Application deleted successfully.",
                    "id": row[0],
                    "company": row[1],
                }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not delete application.",
        )
