import os

import psycopg
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "dbname": os.getenv("DB_NAME", "careertrack_db"),
    "user": os.getenv("DB_USER", "careertrack_user"),
    "password": os.getenv("DB_PASSWORD"),
    "port": int(os.getenv("DB_PORT", "5432")),
}


def get_connection():
    if not DB_CONFIG["password"]:
        raise RuntimeError("DB_PASSWORD is missing from the .env file")

    return psycopg.connect(**DB_CONFIG)


if __name__ == "__main__":
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT version();")
                result = cursor.fetchone()

                print("PostgreSQL connection successful!")
                print(result[0])

    except Exception as error:
        print("Database connection failed:", error)
