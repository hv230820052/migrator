"""
Integration Test for SVN-to-Git Contributor / Author Mapping Pipeline
Requirement 7:
Integration test using a local SVN repo (`svnadmin create` + `file://` URL)
with commits from two users (`abhaypundora17` and `abhaypundora`), mapped to two different emails,
asserting the converted Git history has two distinct author emails.
Also asserts that running without a complete mapping is blocked with a clear error.
"""
import unittest
import os
import shutil
import tempfile
import subprocess
from app.connectors.svn import SvnConnector
from app.author_mapping import (
    generate_authors_file_content,
    check_unmapped_authors,
    validate_email
)

class TestSvnAuthorIntegration(unittest.TestCase):

    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="svn_test_")
        self.svn_repo_path = os.path.join(self.test_dir, "repo")
        self.wc_path = os.path.join(self.test_dir, "wc")
        self.git_clone_path = os.path.join(self.test_dir, "git_repo")
        self.authors_file_path = os.path.join(self.test_dir, "authors.txt")
        self.svn_url = f"file://{self.svn_repo_path}"

        # 1. Create SVN repo
        subprocess.run(["svnadmin", "create", self.svn_repo_path], check=True, capture_output=True)

        # 2. Configure repo for anonymous write
        conf_path = os.path.join(self.svn_repo_path, "conf", "svnserve.conf")
        if os.path.exists(conf_path):
            with open(conf_path, "a") as f:
                f.write("\n[general]\nanon-access = write\nauth-access = write\n")

        # 3. Checkout working copy
        subprocess.run(["svn", "checkout", self.svn_url, self.wc_path], check=True, capture_output=True)

        # 4. Create standard layout: trunk, branches, tags
        trunk_dir = os.path.join(self.wc_path, "trunk")
        branches_dir = os.path.join(self.wc_path, "branches")
        tags_dir = os.path.join(self.wc_path, "tags")
        os.makedirs(trunk_dir, exist_ok=True)
        os.makedirs(branches_dir, exist_ok=True)
        os.makedirs(tags_dir, exist_ok=True)
        subprocess.run(["svn", "add", trunk_dir, branches_dir, tags_dir], cwd=self.wc_path, check=True, capture_output=True)
        subprocess.run(
            ["svn", "commit", "-m", "Initial standard layout", "--username", "abhaypundora17", "--non-interactive"],
            cwd=self.wc_path, check=True, capture_output=True
        )

        # 5. Commit 1 by abhaypundora17
        file1 = os.path.join(trunk_dir, "feature_alpha.py")
        with open(file1, "w") as f:
            f.write("# Feature alpha by abhaypundora17\nprint('Alpha active')\n")
        subprocess.run(["svn", "add", file1], cwd=self.wc_path, check=True, capture_output=True)
        subprocess.run(
            ["svn", "commit", "-m", "Add feature alpha", "--username", "abhaypundora17", "--non-interactive"],
            cwd=self.wc_path, check=True, capture_output=True
        )

        # 6. Commit 2 by abhaypundora
        file2 = os.path.join(trunk_dir, "feature_beta.py")
        with open(file2, "w") as f:
            f.write("# Feature beta by abhaypundora\nprint('Beta active')\n")
        subprocess.run(["svn", "add", file2], cwd=self.wc_path, check=True, capture_output=True)
        subprocess.run(
            ["svn", "commit", "-m", "Add feature beta", "--username", "abhaypundora", "--non-interactive"],
            cwd=self.wc_path, check=True, capture_output=True
        )

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_svn_author_discovery(self):
        """Test VCSAdapter list_authors extracts both unique users from real SVN history"""
        connector = SvnConnector(self.svn_url)
        authors = connector.list_authors()
        
        usernames = [a.username for a in authors]
        self.assertIn("abhaypundora17", usernames)
        self.assertIn("abhaypundora", usernames)

        author_map = {a.username: a for a in authors}
        # abhaypundora17 committed initial layout + feature_alpha = 2 commits
        self.assertEqual(author_map["abhaypundora17"].commits, 2)
        # abhaypundora committed feature_beta = 1 commit
        self.assertEqual(author_map["abhaypundora"].commits, 1)

    def test_incomplete_author_mapping_blocked(self):
        """Test unmapped author verification blocks execution before conversion"""
        connector = SvnConnector(self.svn_url)
        discovered = [a.username for a in connector.list_authors()]

        # Missing abhaypundora
        incomplete_mappings = [
            {"username": "abhaypundora17", "email": "abhaypundora17@gmail.com"}
        ]
        all_mapped, unmapped = check_unmapped_authors(discovered, incomplete_mappings)
        self.assertFalse(all_mapped)
        self.assertIn("abhaypundora", unmapped)

        # Attempting conversion with incomplete authors file fails
        incomplete_file = os.path.join(self.test_dir, "incomplete_authors.txt")
        with open(incomplete_file, "w") as f:
            f.write("abhaypundora17 = Abhay Pundora <abhaypundora17@gmail.com>\n")

        bad_clone_dir = os.path.join(self.test_dir, "bad_clone")
        res = subprocess.run(
            ["git", "svn", "clone", self.svn_url, "--stdlayout", f"--authors-file={incomplete_file}", bad_clone_dir],
            capture_output=True,
            text=True
        )
        # git svn clone must fail because abhaypundora is not defined in authors.txt
        self.assertNotEqual(res.returncode, 0)
        self.assertTrue(
            "Author: abhaypundora not defined" in res.stderr or
            "Author: abhaypundora not defined" in res.stdout or
            "not defined in" in (res.stderr + res.stdout)
        )

    def test_complete_mapping_conversion_preserves_distinct_authors(self):
        """
        Acceptance Criteria:
        A repo with commits by abhaypundora17 and abhaypundora migrates with two distinct authors,
        matching the mapped emails. No fallback to token owner or placeholder uuid.
        """
        mappings = [
            {"username": "abhaypundora17", "name": "Abhay Pundora", "email": "abhaypundora17@gmail.com"},
            {"username": "abhaypundora", "name": "Abhay Pundora", "email": "abhaypundora@gmail.com"}
        ]
        authors_content = generate_authors_file_content(mappings)
        with open(self.authors_file_path, "w") as f:
            f.write(authors_content)

        # Clone SVN into Git using --stdlayout and --authors-file
        clone_res = subprocess.run(
            ["git", "svn", "clone", self.svn_url, "--stdlayout", f"--authors-file={self.authors_file_path}", self.git_clone_path],
            capture_output=True,
            text=True
        )
        self.assertEqual(clone_res.returncode, 0, f"git svn clone failed: {clone_res.stderr}")

        # Run git log --format="%an <%ae>" to inspect converted authors
        log_res = subprocess.run(
            ["git", "log", "--format=%an <%ae>"],
            cwd=self.git_clone_path,
            capture_output=True,
            text=True,
            check=True
        )
        git_authors = [line.strip() for line in log_res.stdout.splitlines() if line.strip()]

        # Verify both distinct mapped author emails exist in Git history
        self.assertIn("Abhay Pundora <abhaypundora17@gmail.com>", git_authors)
        self.assertIn("Abhay Pundora <abhaypundora@gmail.com>", git_authors)

        # Verify distinct emails count
        emails_found = {a.split("<")[1].split(">")[0] for a in git_authors}
        self.assertEqual(len(emails_found), 2)
        self.assertIn("abhaypundora17@gmail.com", emails_found)
        self.assertIn("abhaypundora@gmail.com", emails_found)

        # Verify NO commits have SVN UUID or fallback noreply placeholder addresses
        for author_line in git_authors:
            self.assertNotIn("@", author_line.split("<")[0]) # Name before email
            self.assertNotIn("none@none", author_line)
            self.assertNotIn("localhost", author_line)

if __name__ == "__main__":
    unittest.main()
