<?php
session_start();

// Use relative paths
$venv_dir = '../../venv';  // Virtual environment in the current directory
$uwsgi_ini_file = '../../uwsgi.ini';  // Relative path to your uWSGI config file

// Check if uWSGI process is already running
if (!isset($_SESSION['uwsgi_pid'])) {
    // Step 1: Check if the virtual environment exists
    if (is_dir($venv_dir)) {
        echo "Virtual environment already exists.<br>";
    } else {
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

        // Step 3: Install uWSGI and other dependencies from requirements.txt
        echo "Installing dependencies from requirements.txt...<br>";
        $requirements_file = '../requirements.txt'; // Path to requirements file
        $install_command = "$venv_dir/bin/python -m pip install uwsgi -r $requirements_file 2>&1";
        exec($install_command, $output, $return_var);
        if ($return_var === 0) {
            echo "Dependencies installed successfully.<br>";
        } else {
            echo "Error installing dependencies:<br>";
            echo "<pre>" . implode("\n", $output) . "</pre>";
            exit;
        }
    }

    // Step 4: Start uWSGI in the background using the ini configuration file
    echo "Starting uWSGI server...<br>";
    $command = "nohup $venv_dir/bin/uwsgi --ini $uwsgi_ini_file > uwsgi.log 2>&1 & echo $!";
    $uwsgi_pid = exec($command, $output, $return_var);

    if ($return_var === 0) {
        // Step 5: Store the uWSGI process ID in the session to track it
        $_SESSION['uwsgi_pid'] = $uwsgi_pid;
        echo "uWSGI server started with PID: $uwsgi_pid<br>";
    } else {
        echo "Error starting uWSGI server:<br>";
        echo "<pre>" . implode("\n", $output) . "</pre>";
    }
} else {
    echo "uWSGI server is already running with PID: " . $_SESSION['uwsgi_pid'] . "<br>";
}
?>
