<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
// Get the package name from the query string
if (isset($_GET['package'])) {
    $packageName = escapeshellarg($_GET['package']);  // Sanitize the package name

    // Define the path to the virtual environment
    $venvPath = '../venv/bin/pip';  // Path to the pip executable in the virtual environment

    // Run the pip install command within the virtual environment
    $command = "$venvPath install $packageName";
    
    // Execute the command and capture the output
    $output = exec($command);

    // Return the output of the command
    echo $output;
} else {
    echo 'No package specified.';
}
?>
