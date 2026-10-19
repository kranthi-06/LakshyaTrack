import os
from sqlalchemy import create_engine, text
import sys

# Suppress all output except what we explicitly print
# sys.stdout = open(os.devnull, 'w')

regions = [
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3",
    "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
    "ap-south-1", "sa-east-1", "ca-central-1"
]

project_ref = os.environ['SUPABASE_PROJECT_REF']
# User format for Supabase Pooler: matches the direct DB user usually
# But for pooler, it is explicitly: role.project_ref
user = f"postgres.{project_ref}"
password = os.environ['SUPABASE_DB_PASSWORD']
dbname = "postgres"

found_region = None

for region in regions:
    host = f"aws-0-{region}.pooler.supabase.com"
    url = f"postgresql://{user}:{password}@{host}:5432/{dbname}"
    
    try:
        # Short timeout to fail fast on wrong regions
        engine = create_engine(url, connect_args={"connect_timeout": 3})
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            found_region = region
            break
    except Exception as e:
        error_str = str(e).lower()
        # If we get an auth error, it means we reached the server!
        if "password authentication failed" in error_str:
            found_region = region
            print(f"REGION_FOUND: {region} (Auth Failed)")
            break
        elif "no pg_hba.conf entry" in error_str:
             found_region = region
             print(f"REGION_FOUND: {region} (SSL/HBA Error)")
             break
        # If we get "database ... does not exist", we reached the server
        elif "database" in error_str and "does not exist" in error_str:
             found_region = region
             print(f"REGION_FOUND: {region} (DB Name Error)")
             break

if found_region:
    print(f"REGION_FOUND: {found_region}")
else:
    print("REGION_NOT_FOUND")
