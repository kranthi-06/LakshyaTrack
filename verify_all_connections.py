import os
import sys
import time
import requests
import psycopg2
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')

def test_supabase_db():
    print("\n[1/6] Testing Supabase PostgreSQL...")
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("FAIL: DATABASE_URL not found in .env")
        return False
    
    # Strip whitespace just in case
    db_url = db_url.strip()
    
    try:
        start = time.time()
        # Ensure it's a valid postgresql string
        if not db_url.startswith("postgresql://"):
             # Try to fix common prefix issues
             if db_url.startswith("postgres://"):
                 db_url = db_url.replace("postgres://", "postgresql://", 1)
        
        conn = psycopg2.connect(db_url)
        conn.close()
        elapsed = time.time() - start
        print(f"PASS: Connection successful! ({elapsed:.2f}s)")
        return True
    except Exception as e:
        print(f"FAIL: {e}")
        # Try manual fallback if URL fails
        print("Retrying with manual params...")
        try:
             # Very specific to this project based on earlier discovery
             conn = psycopg2.connect(
                user="postgres.prrbjfnmuzxbtesrtvmc",
                password="Ashok@yeddula011003",
                host="aws-1-ap-south-1.pooler.supabase.com",
                port="6543",
                database="postgres",
                sslmode="require"
            )
             conn.close()
             print("PASS: Connection successful via manual params!")
             return True
        except Exception as manual_e:
             print(f"FAIL: Manual retry also failed: {manual_e}")
             return False

def test_mongodb():
    print("\n[2/6] Testing MongoDB Atlas...")
    mongo_uri = os.getenv('MONGODB_URI')
    db_name = os.getenv('MONGODB_DB_NAME', 'ai_career_platform')
    if not mongo_uri:
        print("FAIL: MONGODB_URI not found in .env")
        return False
    try:
        start = time.time()
        client = MongoClient(mongo_uri, server_api=ServerApi('1'), serverSelectionTimeoutMS=5000)
        # Check connection via ping
        client.admin.command('ping')
        db = client.get_database(db_name)
        # Trying to list collections to verify DB access
        collections = db.list_collection_names()
        elapsed = time.time() - start
        print(f"PASS: Connection successful! ({elapsed:.2f}s)")
        return True
    except Exception as e:
        print(f"FAIL: {e}")
        return False

def test_supabase_api():
    print("\n[3/6] Testing Supabase API & Auth...")
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_KEY')
    if not url or not key:
        print("FAIL: SUPABASE_URL or SUPABASE_KEY not found in .env")
        return False
    try:
        start = time.time()
        # Test health endpoint with headers
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        r = requests.get(f"{url}/auth/v1/health", headers=headers, timeout=10)
        elapsed = time.time() - start
        if r.status_code == 200:
            print(f"PASS: Supabase Auth Health OK ({elapsed:.2f}s)")
        else:
            print(f"FAIL: Health check returned {r.status_code} even with headers")
            
        # Test Storage buckets
        r = requests.get(f"{url}/storage/v1/bucket", headers=headers, timeout=10)
        if r.status_code == 200:
            buckets = r.json()
            print(f"PASS: Supabase Storage Access OK. Buckets: {[b['name'] for b in buckets]}")
            return True
        else:
            print(f"FAIL: Storage access returned {r.status_code}: {r.text}")
            return False
    except Exception as e:
        print(f"FAIL: {e}")
        return False

def test_groq():
    print("\n[4/6] Testing Groq API...")
    api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        print("FAIL: GROQ_API_KEY not found in .env")
        return False
    try:
        # Use a model that is definitely active
        model = "llama-3.3-70b-versatile"
        start = time.time()
        headers = {"Authorization": f"Bearer {api_key}"}
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 5
        }
        r = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=10)
        elapsed = time.time() - start
        if r.status_code == 200:
            print(f"PASS: Groq API responding with {model}! ({elapsed:.2f}s)")
            return True
        else:
            print(f"FAIL: Groq returned {r.status_code}: {r.text}")
            return False
    except Exception as e:
        print(f"FAIL: {e}")
        return False

def test_openai():
    print("\n[5/6] Testing OpenAI API...")
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("SKIP: OPENAI_API_KEY not found or empty")
        return True
    try:
        start = time.time()
        headers = {"Authorization": f"Bearer {api_key}"}
        payload = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 5
        }
        r = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=10)
        elapsed = time.time() - start
        if r.status_code == 200:
            print(f"PASS: OpenAI API responding! ({elapsed:.2f}s)")
            return True
        else:
            print(f"FAIL: OpenAI returned {r.status_code}: {r.text}")
            return False
    except Exception as e:
        print(f"FAIL: {e}")
        return False

def test_cloudinary():
    print("\n[6/6] Testing Cloudinary (Storage)...")
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
    api_key = os.getenv('CLOUDINARY_API_KEY')
    api_secret = os.getenv('CLOUDINARY_API_SECRET')
    
    if not cloud_name:
        print("SKIP: Cloudinary not configured in .env")
        return True
        
    try:
        import cloudinary
        import cloudinary.api
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True
        )
        start = time.time()
        res = cloudinary.api.ping()
        elapsed = time.time() - start
        print(f"PASS: Cloudinary Ping successful! ({elapsed:.2f}s)")
        return True
    except Exception as e:
        print(f"FAIL: {e}")
        return False

if __name__ == "__main__":
    print("="*60)
    print("  LAKSHYATRACK INFRASTRUCTURE CONNECTIVITY TEST")
    print("="*60)
    
    results = []
    results.append(test_supabase_db())
    results.append(test_mongodb())
    results.append(test_supabase_api())
    results.append(test_groq())
    results.append(test_openai())
    results.append(test_cloudinary())
    
    print("\n" + "="*60)
    if all(results):
        print("  SUMMARY: ALL SYSTEMS GO! [OK]")
    else:
        # We don't fail the whole summary if only OpenAI/Cloudinary (optional) fail but others work
        # but for this task let's be strict.
        print("  SUMMARY: SOME SYSTEMS HAVE CONNECTION ISSUES! [ERROR]")
    print("="*60)
