<?php
session_start();

// Check if uWSGI process is running
if (isset($_SESSION['uwsgi_pid'])) {

    $uwsgi_pid = $_SESSION['uwsgi_pid'];
    $check_command = "ps -p $uwsgi_pid";
    exec($check_command, $output, $return_var);
    
    if ($return_var === 0) {
        echo "Process with PID $uwsgi_pid is running.<br>";
    } else {
        echo "Process with PID $uwsgi_pid is not running.<br>";
        unset($_SESSION['uwsgi_pid']); // Clear the invalid PID from the session
        exit;
    }
    

    $uwsgi_pid = $_SESSION['uwsgi_pid'];
    $command = "kill -9 $uwsgi_pid";
    exec($command, $output, $return_var); // Send kill signal to the uWSGI process

    if ($return_var === 0) {
        echo "uWSGI server stopped with PID: $uwsgi_pid<br>";
        // Remove PID from session after stopping the server
        unset($_SESSION['uwsgi_pid']);
    } else {
        echo "Failed to stop uWSGI server. You may need to kill it manually.<br>";
    }
} else {
    echo "uWSGI server is not running.<br>";
}
?>
