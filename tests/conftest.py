"""
Pytest global fixtures and environment configuration.
"""

import os
import pytest

# Configure mock AWS environment variables
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
os.environ["AWS_REGION"] = "us-east-1"
os.environ["AWS_ACCESS_KEY_ID"] = "testing"
os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
os.environ["AWS_SECURITY_TOKEN"] = "testing"
os.environ["AWS_SESSION_TOKEN"] = "testing"
os.environ["TABLE_NAME"] = "AnkiSaaS-Test"
os.environ["DOCUMENTS_BUCKET"] = "ultra-docs-test"
