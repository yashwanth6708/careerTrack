from database import get_connection


VALID_STATUSES = [
    "Applied",
    "Assessment",
    "Interview",
    "Selected",
    "Rejected",
]


def add_application():
    company = input("Enter company name: ").strip()
    role = input("Enter job role: ").strip()

    if not company or not role:
        print("Company name and job role cannot be empty.")
        return

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO applications (company, role, status)
                    VALUES (%s, %s, %s)
                    RETURNING id;
                    """,
                    (company, role, "Applied"),
                )
                application_id = cursor.fetchone()[0]

        print(f"Application added successfully! ID: {application_id}")

    except Exception as error:
        print("Could not add application:", error)


def view_applications():
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, company, role, status, created_at
                    FROM applications
                    ORDER BY id;
                    """
                )
                applications = cursor.fetchall()

        if not applications:
            print("\nNo applications found.")
            return

        print("\n--- YOUR JOB APPLICATIONS ---")

        for app in applications:
            print("-" * 45)
            print(f"ID: {app[0]}")
            print(f"Company: {app[1]}")
            print(f"Role: {app[2]}")
            print(f"Status: {app[3]}")
            print(f"Created: {app[4]}")

        print("-" * 45)

    except Exception as error:
        print("Could not retrieve applications:", error)


def update_status():
    try:
        application_id = int(input("Enter application ID: "))

        print("\nAvailable statuses:")
        for index, status in enumerate(VALID_STATUSES, start=1):
            print(f"{index}. {status}")

        choice = int(input("Choose a status number: "))

        if not 1 <= choice <= len(VALID_STATUSES):
            print("Invalid status choice.")
            return

        new_status = VALID_STATUSES[choice - 1]

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE applications
                    SET status = %s
                    WHERE id = %s
                    RETURNING id;
                    """,
                    (new_status, application_id),
                )
                updated = cursor.fetchone()

        if updated:
            print("Application status updated successfully!")
        else:
            print("Application ID not found.")

    except ValueError:
        print("Please enter a valid number.")

    except Exception as error:
        print("Could not update application:", error)


def delete_application():
    try:
        application_id = int(input("Enter application ID to delete: "))

        confirmation = input(
            "Are you sure you want to delete this application? (yes/no): "
        ).strip().lower()

        if confirmation != "yes":
            print("Deletion cancelled.")
            return

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE FROM applications
                    WHERE id = %s
                    RETURNING id;
                    """,
                    (application_id,),
                )
                deleted = cursor.fetchone()

        if deleted:
            print("Application deleted successfully!")
        else:
            print("Application ID not found.")

    except ValueError:
        print("Please enter a valid application ID.")

    except Exception as error:
        print("Could not delete application:", error)


def main():
    while True:
        print("\n========== CAREERTRACK ==========")
        print("1. Add job application")
        print("2. View all applications")
        print("3. Update application status")
        print("4. Delete application")
        print("5. Exit")

        choice = input("Enter your choice (1-5): ").strip()

        if choice == "1":
            add_application()
        elif choice == "2":
            view_applications()
        elif choice == "3":
            update_status()
        elif choice == "4":
            delete_application()
        elif choice == "5":
            print("Thank you for using CareerTrack!")
            break
        else:
            print("Invalid choice. Please enter a number from 1 to 5.")


if __name__ == "__main__":
    main()
