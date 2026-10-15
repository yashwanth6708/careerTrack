from datetime import date
from typing import Optional

import psycopg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import get_connection

app = FastAPI(
    title="CareerTrack API",
    description="API for managing job applications",
    version="2.0.0",
)

# Allow the frontend to communicate with the backend.
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
    allow_headers=["Content-Type"],
)

VALID_STATUSES = {
    "Applied",
    "Assessment",
    "Interview",
    "Selected",
    "Rejected",
}


# Request model for creating an application.
class ApplicationCreate(BaseModel):
    company: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=150)
    status: str = "Applied"
    application_date: date = Field(default_factory=date.today)
    notes: str = ""

    def validate_status(self):
        if self.status not in VALID_STATUSES:
            raise ValueError("Invalid application status")


# Request model for updating application status.
class StatusUpdate(BaseModel):
    status: str


# Request model for updating application date and notes.
class ApplicationDetailsUpdate(BaseModel):
    application_date: Optional[date] = None
    notes: Optional[str] = None


def validate_status(status: str):
    if status not in VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status. Choose one of: {', '.join(sorted(VALID_STATUSES))}",
        )


def get_application_or_404(cursor, application_id: int):
    cursor.execute(
        """
        SELECT id, company, role, status, created_at,
               application_date, notes
        FROM applications
        WHERE id = %s
        """,
        (application_id,),
    )

    row = cursor.fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )

    return row


@app.get("/")
def home():
    return {
        "message": "Welcome to CareerTrack API",
        "docs": "/docs",
    }


@app.get("/applications")
def get_applications():
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, company, role, status, created_at,
                           application_date, notes
                    FROM applications
                    ORDER BY id
                    """
                )

                rows = cursor.fetchall()

                return [
                    {
                        "id": row[0],
                        "company": row[1],
                        "role": row[2],
                        "status": row[3],
                        "created_at": row[4],
                        "application_date": row[5],
                        "notes": row[6],
                    }
                    for row in rows
                ]

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve applications",
        )


@app.post("/applications", status_code=201)
def create_application(application: ApplicationCreate):
    company = application.company.strip()
    role = application.role.strip()

    if not company:
        raise HTTPException(
            status_code=422,
            detail="Company name cannot be empty",
        )

    if not role:
        raise HTTPException(
            status_code=422,
            detail="Job role cannot be empty",
        )

    validate_status(application.status)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO applications
                        (company, role, status, application_date, notes)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, company, role, status, created_at,
                              application_date, notes
                    """,
                    (
                        company,
                        role,
                        application.status,
                        application.application_date,
                        application.notes,
                    ),
                )

                row = cursor.fetchone()

                return {
                    "id": row[0],
                    "company": row[1],
                    "role": row[2],
                    "status": row[3],
                    "created_at": row[4],
                    "application_date": row[5],
                    "notes": row[6],
                }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not create application",
        )


@app.patch("/applications/{application_id}")
def update_application_status(
    application_id: int,
    update: StatusUpdate,
):
    validate_status(update.status)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE applications
                    SET status = %s
                    WHERE id = %s
                    RETURNING id, company, role, status, created_at,
                              application_date, notes
                    """,
                    (update.status, application_id),
                )

                row = cursor.fetchone()

                if row is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Application not found",
                    )

                return {
                    "id": row[0],
                    "company": row[1],
                    "role": row[2],
                    "status": row[3],
                    "created_at": row[4],
                    "application_date": row[5],
                    "notes": row[6],
                }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not update application",
        )


@app.patch("/applications/{application_id}/details")
def update_application_details(
    application_id: int,
    update: ApplicationDetailsUpdate,
):
    if update.application_date is None and update.notes is None:
        raise HTTPException(
            status_code=422,
            detail="Provide an application date or notes to update",
        )

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                get_application_or_404(cursor, application_id)

                if update.application_date is not None:
                    cursor.execute(
                        """
                        UPDATE applications
                        SET application_date = %s
                        WHERE id = %s
                        """,
                        (update.application_date, application_id),
                    )

                if update.notes is not None:
                    cursor.execute(
                        """
                        UPDATE applications
                        SET notes = %s
                        WHERE id = %s
                        """,
                        (update.notes, application_id),
                    )

                row = get_application_or_404(cursor, application_id)

                return {
                    "id": row[0],
                    "company": row[1],
                    "role": row[2],
                    "status": row[3],
                    "created_at": row[4],
                    "application_date": row[5],
                    "notes": row[6],
                }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not update application details",
        )


@app.delete("/applications/{application_id}")
def delete_application(application_id: int):
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE FROM applications
                    WHERE id = %s
                    RETURNING id, company
                    """,
                    (application_id,),
                )

                row = cursor.fetchone()

                if row is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Application not found",
                    )

                return {
                    "message": "Application deleted successfully",
                    "id": row[0],
                    "company": row[1],
                }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not delete application",
        )
