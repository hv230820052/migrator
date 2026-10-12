"""
Author Mapping Module
Validation, authors-file generation, email verification, and duplicate warnings.
"""
import re
from typing import List, Dict, Any, Tuple, Optional

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$")
UNVERIFIABLE_DOMAINS = {"example.com", "example.org", "example.net", "localhost", "test", "local", "invalid"}

def validate_email(email: str) -> bool:
    """Validate email format per standard pattern"""
    if not email or not isinstance(email, str):
        return False
    clean = email.strip()
    if ".." in clean:
        return False
    return bool(EMAIL_REGEX.match(clean))

def is_unverifiable_domain(email: str) -> bool:
    """Check if email domain is typically unverifiable (e.g. example.com, localhost)"""
    if not email or "@" not in email:
        return True
    domain = email.split("@", 1)[1].strip().lower()
    if domain in UNVERIFIABLE_DOMAINS or domain.endswith(".local") or domain.endswith(".test"):
        return True
    return False

def check_mapping_warnings(mappings: List[Dict[str, Any]]) -> List[str]:
    """Check for duplicate emails and unverifiable email domains"""
    warnings = []
    email_to_users: Dict[str, List[str]] = {}

    for m in mappings:
        u = m.get("username") or m.get("legacy_id")
        email = (m.get("email") or m.get("proposed_email") or "").strip().lower()
        if not u or not email:
            continue

        email_to_users.setdefault(email, []).append(u)

        if is_unverifiable_domain(email):
            warnings.append(
                f"Email '{email}' for user '{u}' uses an unverifiable domain (e.g. example.com/localhost). Commits will not link to a personal GitHub profile."
            )

    for email, users in email_to_users.items():
        if len(users) > 1:
            users_str = ", ".join(f"'{usr}'" for usr in users)
            warnings.append(
                f"Users {users_str} share email '{email}'. GitHub will merge them into a single contributor on the Insights graph."
            )

    return warnings

def check_unmapped_authors(discovered_usernames: List[str], mappings: List[Dict[str, Any]]) -> Tuple[bool, List[str]]:
    """Verify every discovered author has a valid mapping with name and valid email"""
    mapped_dict = {}
    for m in mappings:
        u = m.get("username") or m.get("legacy_id")
        email = (m.get("email") or m.get("proposed_email") or "").strip()
        if u and validate_email(email):
            mapped_dict[u] = email

    unmapped = [u for u in discovered_usernames if u not in mapped_dict]
    return (len(unmapped) == 0, unmapped)

def generate_authors_file_content(mappings: List[Dict[str, Any]]) -> str:
    """
    Generate git-svn authors file format:
    username = Name <email>
    """
    lines = []
    seen = set()
    for m in mappings:
        u = (m.get("username") or m.get("legacy_id") or "").strip()
        name = (m.get("name") or m.get("github_username") or u).strip()
        email = (m.get("email") or m.get("proposed_email") or "").strip()
        if not u or not email or u in seen:
            continue
        seen.add(u)
        lines.append(f"{u} = {name} <{email}>")
    return "\n".join(lines) + "\n"

def parse_authors_file_content(text: str) -> List[Dict[str, str]]:
    """
    Parse an imported authors file with 'username = Name <email>' per line.
    """
    results = []
    pattern = re.compile(r"^([^\s=#]+)\s*=\s*([^<]+?)\s*<([^>]+)>")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = pattern.match(line)
        if m:
            u, name, email = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
            results.append({
                "username": u,
                "name": name,
                "email": email,
                "github_username": name if " " not in name else u
            })
    return results
