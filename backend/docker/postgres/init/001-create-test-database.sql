SELECT 'CREATE DATABASE yor_tokens_test OWNER yor_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'yor_tokens_test')\gexec
