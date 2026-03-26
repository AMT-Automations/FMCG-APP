#!/usr/bin/env python3
"""
Debug send report issue specifically
"""

import requests
import json

# Backend URL from environment
BASE_URL = "https://fmcg-delivery-app-2.preview.emergentagent.com/api"
ADMIN_CREDS = {"phone": "0800000001", "pin": "0000"}

def login_user(credentials):
    """Login user and get auth token"""
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=credentials, timeout=30)
        if response.status_code == 200:
            return response.json().get('token')
    except Exception as e:
        print(f"Login failed: {e}")
    return None

admin_token = login_user(ADMIN_CREDS)
headers = {"Authorization": f"Bearer {admin_token}"}

# Set up email config
email_config = {
    "sender_email": "reports@mzansitracker.co.za",
    "sender_password": "test_password",
    "smtp_server": "mail.mzansitracker.co.za",
    "smtp_port": 465
}
response = requests.post(f"{BASE_URL}/admin/settings/email", json=email_config, headers=headers, timeout=30)
print(f"Email config setup: {response.status_code}")

# Add recipient
test_recipient = {"email": "manager@mzansitracker.co.za"}
response = requests.post(f"{BASE_URL}/admin/email-recipients", json=test_recipient, headers=headers, timeout=30)
print(f"Add recipient: {response.status_code}")

# Check recipients
response = requests.get(f"{BASE_URL}/admin/email-recipients", headers=headers, timeout=30)
print(f"Get recipients: {response.status_code}")
if response.status_code == 200:
    recipients = response.json()
    print(f"Recipients count: {len(recipients)}")
    active_count = sum(1 for r in recipients if r.get('is_active', True))
    print(f"Active recipients: {active_count}")

# Try to send report
response = requests.post(f"{BASE_URL}/admin/send-report?report_type=sales", headers=headers, timeout=30)
print(f"Send report status: {response.status_code}")
print(f"Send report response: {response.text}")