# CareerTrack - Job Application Manager
import json
import os

DATA_FILE = "applications.json"


def load_applications():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as file:
                data = json.load(file)

                if isinstance(data, list):
                    return data

                print("Invalid data format. Starting with an empty list.")

        except (json.JSONDecodeError, OSError):
            print("Could not read saved applications.")

    return []


def save_applications():
    with open(DATA_FILE, "w", encoding="utf-8") as file:
        json.dump(applications, file, indent=4)

    print("Applications saved successfully.")

applications = load_applications()

def display_applications():
    print("\n===== CAREERTRACK =====")
    print("Your Job Applications\n")

    if not applications:
        print("No job applications found.")
        return

    for index, application in enumerate(applications, start=1):
        print(f"\nApplication {index}")
        print(f"Company: {application['company']}")
        print(f"Role: {application['role']}")
        print(f"Status: {application['status']}")

def update_application():
    display_applications()

    if not applications:
        return

    try:
        index = int(input("\nEnter application number to update: "))

        if index < 1 or index > len(applications):
            print("Invalid application number.")
            return

        print("\nAvailable statuses:")
        print("1. Applied")
        print("2. Assessment")
        print("3. Interview")
        print("4. Selected")
        print("5. Rejected")

        choice = input("Choose new status: ").strip()

        statuses = {
            "1": "Applied",
            "2": "Assessment",
            "3": "Interview",
            "4": "Selected",
            "5": "Rejected"
        }

        if choice not in statuses:
            print("Invalid status choice.")
            return

        applications[index - 1]["status"] = statuses[choice]

        applications[index - 1]["status"] = statuses[choice]
        save_applications()
    except ValueError:
        print("Please enter a valid number.")

def delete_application():
    display_applications()

    if not applications:
        return

    try:
        index = int(input("\nEnter application number to delete: "))

        if index < 1 or index > len(applications):
            print("Invalid application number.")
            return

        deleted = applications.pop(index - 1)

        print(
            f"Deleted application for {deleted['company']} successfully!"
        )
        applications[index - 1]["status"] = statuses[choice]
        save_applications()

    except ValueError:
        print("Please enter a valid number.")

def add_application():
    print("\n===== ADD NEW APPLICATION =====")

    company = input("Enter company name: ").strip()
    role = input("Enter job role: ").strip()
    status = input("Enter application status: ").strip()

    if not company or not role or not status:
        print("Error: All fields are required.")
        return

    application = {
        "company": company,
        "role": role,
        "status": status
    }

    applications.append(application)
    save_applications()

    print("\nApplication added successfully!")


def main():
    while True:
        print("\n===== CAREERTRACK MENU =====")
        print("1. View applications")
        print("2. Add application")
        print("3. Update application status")
        print("4. Delete application")
        print("5. Exit")

        choice = input("Choose an option: ").strip()

        if choice == "1":
            display_applications()

        elif choice == "2":
            add_application()

        elif choice == "3":
            update_application()

        elif choice == "4":
            delete_application()

        elif choice == "5":
            print("Thank you for using CareerTrack!")
            break

        else:
            print("Invalid choice. Please try again.")


if __name__ == "__main__":
    main()

