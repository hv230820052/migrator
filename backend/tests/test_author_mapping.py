"""
Unit Tests for VCS Contributor / Author Mapping Pipeline
Covers:
- SVN log parsing (commit counts, first/last dates, usernames)
- Authors file generation and parsing (username = Name <email>)
- Email syntax validation
- Duplicate email warning generation (GitHub contributor merge warning)
- Unverifiable domain warning generation (example.com, localhost)
- Unmapped author blocking verification
"""
import unittest
from app.connectors.base import parse_svn_log_authors, AuthorInfo
from app.author_mapping import (
    validate_email,
    is_unverifiable_domain,
    check_mapping_warnings,
    check_unmapped_authors,
    generate_authors_file_content,
    parse_authors_file_content
)

class TestAuthorMappingUnit(unittest.TestCase):

    def test_svn_log_parsing(self):
        """Test SVN log parsing extracts authors, commit counts, and date ranges correctly"""
        sample_log = """
------------------------------------------------------------------------
r1 | abhaypundora17 | 2024-01-10 10:00:00 +0000 (Wed, 10 Jan 2024)
------------------------------------------------------------------------
r2 | abhaypundora | 2024-01-11 11:30:00 +0000 (Thu, 11 Jan 2024)
------------------------------------------------------------------------
r3 | abhaypundora17 | 2024-01-12 14:15:00 +0000 (Fri, 12 Jan 2024)
------------------------------------------------------------------------
r4 | abhaypundora17 | 2024-01-15 16:20:00 +0000 (Mon, 15 Jan 2024)
------------------------------------------------------------------------
"""
        authors = parse_svn_log_authors(sample_log)
        self.assertEqual(len(authors), 2)
        
        auth_map = {a.username: a for a in authors}
        self.assertIn("abhaypundora17", auth_map)
        self.assertIn("abhaypundora", auth_map)
        
        # Check abhaypundora17 stats
        user1 = auth_map["abhaypundora17"]
        self.assertEqual(user1.commits, 3)
        self.assertEqual(user1.first_commit_date, "2024-01-10 10:00:00 +0000")
        self.assertEqual(user1.last_commit_date, "2024-01-15 16:20:00 +0000")
        
        # Check abhaypundora stats
        user2 = auth_map["abhaypundora"]
        self.assertEqual(user2.commits, 1)
        self.assertEqual(user2.first_commit_date, "2024-01-11 11:30:00 +0000")
        self.assertEqual(user2.last_commit_date, "2024-01-11 11:30:00 +0000")

    def test_email_validation(self):
        """Test strict and valid email formatting checks"""
        valid_emails = [
            "abhaypundora17@gmail.com",
            "developer@company.co.uk",
            "first.last+tag@sub.domain.org",
            "12345+octocat@users.noreply.github.com"
        ]
        for em in valid_emails:
            self.assertTrue(validate_email(em), f"Expected '{em}' to be valid")

        invalid_emails = [
            "",
            "   ",
            "plainaddress",
            "@missingusername.com",
            "username@.com",
            "username@com",
            "user@domain..com",
            "user name@domain.com"
        ]
        for em in invalid_emails:
            self.assertFalse(validate_email(em), f"Expected '{em}' to be invalid")

    def test_unverifiable_domain_warning(self):
        """Test identification of placeholder or unverifiable domain names"""
        self.assertTrue(is_unverifiable_domain("user@example.com"))
        self.assertTrue(is_unverifiable_domain("admin@localhost"))
        self.assertTrue(is_unverifiable_domain("dev@test.local"))
        self.assertFalse(is_unverifiable_domain("user@github.com"))
        self.assertFalse(is_unverifiable_domain("abhay@gmail.com"))

    def test_duplicate_email_warning(self):
        """Test warning generation when two different source users map to the same email"""
        mappings_with_dups = [
            {"username": "abhaypundora17", "email": "shared@company.com"},
            {"username": "abhaypundora", "email": "shared@company.com"}
        ]
        warnings = check_mapping_warnings(mappings_with_dups)
        self.assertTrue(any("merge them into a single contributor" in w for w in warnings))

        mappings_distinct = [
            {"username": "abhaypundora17", "email": "abhay17@company.com"},
            {"username": "abhaypundora", "email": "abhay@company.com"}
        ]
        clean_warnings = check_mapping_warnings(mappings_distinct)
        self.assertEqual(len(clean_warnings), 0)

    def test_unmapped_author_blocking(self):
        """Test verification blocks execution if any discovered author lacks a valid email"""
        discovered = ["abhaypundora17", "abhaypundora", "guest"]
        
        # Incomplete mapping: guest is missing, abhaypundora has empty email
        incomplete_mappings = [
            {"username": "abhaypundora17", "email": "abhay17@company.com"},
            {"username": "abhaypundora", "email": ""}
        ]
        all_mapped, unmapped = check_unmapped_authors(discovered, incomplete_mappings)
        self.assertFalse(all_mapped)
        self.assertIn("abhaypundora", unmapped)
        self.assertIn("guest", unmapped)

        # Complete mapping
        complete_mappings = [
            {"username": "abhaypundora17", "email": "abhay17@company.com"},
            {"username": "abhaypundora", "email": "abhay@company.com"},
            {"username": "guest", "email": "guest@company.com"}
        ]
        all_mapped, unmapped = check_unmapped_authors(discovered, complete_mappings)
        self.assertTrue(all_mapped)
        self.assertEqual(len(unmapped), 0)

    def test_authors_file_generation_and_parsing(self):
        """Test authors.txt generation format: username = Full Name <email@example.com>"""
        mappings = [
            {"username": "abhaypundora17", "name": "Abhay Pundora", "email": "abhaypundora17@gmail.com"},
            {"username": "abhaypundora", "name": "Abhay Pundora", "email": "abhaypundora@gmail.com"}
        ]
        generated = generate_authors_file_content(mappings)
        expected_lines = [
            "abhaypundora17 = Abhay Pundora <abhaypundora17@gmail.com>",
            "abhaypundora = Abhay Pundora <abhaypundora@gmail.com>"
        ]
        for line in expected_lines:
            self.assertIn(line, generated)

        # Parse it back
        parsed = parse_authors_file_content(generated)
        self.assertEqual(len(parsed), 2)
        parsed_by_u = {p["username"]: p for p in parsed}
        self.assertEqual(parsed_by_u["abhaypundora17"]["name"], "Abhay Pundora")
        self.assertEqual(parsed_by_u["abhaypundora17"]["email"], "abhaypundora17@gmail.com")
        self.assertEqual(parsed_by_u["abhaypundora"]["email"], "abhaypundora@gmail.com")

if __name__ == "__main__":
    unittest.main()
