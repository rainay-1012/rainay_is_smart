<?php
session_start();

// Use relative paths
$venv_dir = '../.venv';  // Virtual environment in the current directory
$requirements_file = '../requirements.txt';  // Relative path to requirements file

// Step 1: Remove the existing virtual environment
echo "Removing existing virtual environment...<br>";
exec("rm -rf $venv_dir", $output, $return_var);
if ($return_var !== 0) {
    echo "Error removing existing virtual environment:<br>";
    echo "<pre>" . implode("\n", $output) . "</pre>";
    exit;
}
echo "Existing virtual environment removed.<br>";

// Step 2: Create a new virtual environment
echo "Creating new virtual environment...<br>";
exec("/usr/bin/python3 -m venv $venv_dir 2>&1", $output, $return_var);
if ($return_var !== 0) {
    echo "Error creating virtual environment:<br>";
    echo "<pre>" . implode("\n", $output) . "</pre>";
    exit;
} else {
    echo "Virtual environment created successfully.<br>";
}

// Step 3: Install the required dependencies from requirements.txt
echo "Installing dependencies from requirements.txt...<br>";
$install_command = "$venv_dir/bin/python -m pip install -r $requirements_file 2>&1";
exec($install_command, $output, $return_var);
if ($return_var === 0) {
    echo "Dependencies installed successfully.<br>";
} else {
    echo "Error installing dependencies:<br>";
    echo "<pre>" . implode("\n", $output) . "</pre>";
    exit;
}
?>
