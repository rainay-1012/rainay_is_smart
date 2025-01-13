import os
import subprocess
from ftplib import FTP

# FTP credentials
FTP_HOST = "139.180.216.23"
FTP_USER = "vendosync"
FTP_PASS = "5fByDd\\fs5!F%f;DK'LL="

# Directories to upload
CURRENT_DIR = os.getcwd()
DIST_DIR = os.path.join(CURRENT_DIR, "dist")
PYTHON_DIR = os.path.join(CURRENT_DIR, "python")

# FTP target directories
PUBLIC_DIR = "/public"
DIST_PUBLIC_DIR = "/public/dist"
PYTHON_PUBLIC_DIR = "/public/python"


def list_files_and_folders(ftp, remote_dir):
    """Lists files and folders in the specified remote directory."""
    try:
        items = ftp.nlst(remote_dir)
        print(f"Contents of {remote_dir}:")
        for item in items:
            print(item)
    except Exception as e:
        print(f"Failed to list directory {remote_dir}. Error: {e}")


def upload_file(ftp, local_file_path, remote_file_path):
    """Uploads a single file to the FTP server."""
    with open(local_file_path, "rb") as file:
        ftp.storbinary(f"STOR {remote_file_path}", file)
        print(f"Uploaded: {local_file_path} -> {remote_file_path}")


def upload_directory(ftp, local_dir, remote_dir):
    """Recursively uploads a directory to the FTP server."""
    # Ensure the remote directory exists or create it
    try:
        ftp.mkd(remote_dir)
        print(f"Created directory: {remote_dir}")
    except Exception as e:
        print(f"Directory {remote_dir} may already exist. {e}")

    # Walk through local directory
    for root, _, files in os.walk(local_dir):
        relative_path = os.path.relpath(root, local_dir)
        remote_subdir = os.path.join(remote_dir, relative_path).replace("\\", "/")

        for file_name in files:
            local_file_path = os.path.join(root, file_name)
            remote_file_path = os.path.join(remote_subdir, file_name).replace("\\", "/")
            upload_file(ftp, local_file_path, remote_file_path)


def run_npm_build():
    """Runs `npm run build` in the current directory."""
    try:
        print("Running npm run build...")
        result = subprocess.run(
            ["npm", "run", "build"], check=True, capture_output=True, text=True
        )
        print(result.stdout)
        print("npm run build completed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Error during npm run build: {e.stderr}")
        raise


def main():
    # Run npm build
    run_npm_build()

    # Connect to FTP
    ftp = FTP(FTP_HOST)
    ftp.login(FTP_USER, FTP_PASS)

    try:
        # List files and folders in /public
        list_files_and_folders(ftp, PUBLIC_DIR)

        # Upload /python directory to /public/python
        # if os.path.exists(PYTHON_DIR) and os.path.isdir(PYTHON_DIR):
        #     upload_directory(ftp, PYTHON_DIR, PYTHON_PUBLIC_DIR)
        # else:
        #     print(f"Directory {PYTHON_DIR} does not exist.")

        # Upload /dist directory to /public/dist
        if os.path.exists(DIST_DIR) and os.path.isdir(DIST_DIR):
            upload_directory(ftp, DIST_DIR, DIST_PUBLIC_DIR)
        else:
            print(f"Directory {DIST_DIR} does not exist.")
    finally:
        ftp.quit()
        print("FTP session closed.")


if __name__ == "__main__":
    main()
