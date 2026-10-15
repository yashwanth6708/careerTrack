import psycopg

DB_CONFIG = {
    "host": "localhost",
    "dbname": "careertrack_db",
    "user": "careertrack_user",
    "password": "123456789",
    "port": 5432,
}


def get_connection():
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
