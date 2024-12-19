<?php
$log_file = 'uwsgi.log'; // Path to the uWSGI log file

if (file_exists($log_file)) {
    $logs = file_get_contents($log_file);
    echo nl2br(htmlspecialchars($logs)); // Display logs with line breaks in plain text
} else {
    echo "No logs available.";
}
?>
