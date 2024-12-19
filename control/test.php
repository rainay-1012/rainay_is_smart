<?php
// Define potential directories and files for Nginx configurations
$nginx_conf_paths = [
    '/usr/local/nginx/conf/nginx.conf',
    '/usr/local/nginx/conf/conf.d/virtual.conf',
    '/usr/local/nginx/conf/conf.d/vendosync.adiwidget.com.conf',
    '/usr/local/nginx/conf/conf.d/vendosync.adiwidget.com.ssl.conf',
    '/usr/local/nginx/conf/ssl/vendosync.adiwidget.com/', // SSL certificates
];

// Flag to track if any configuration file is found
$file_found = false;

// Check each path for the Nginx configuration file
foreach ($nginx_conf_paths as $path) {
    if (file_exists($path)) {
        $file_found = true;

        // Execute the command to display the contents of the config file
        $output = [];
        $return_var = 0;
        exec("cat $path", $output, $return_var);

        // Check if the exec command was successful
        if ($return_var === 0) {
            // Display the contents of the configuration file
            echo "<h3>Contents of $path:</h3>";
            echo "<pre>" . htmlspecialchars(implode("\n", $output)) . "</pre>";
        } else {
            echo "Failed to read the Nginx configuration file at $path.";
        }

    }
}

// If no configuration files were found, display a message
if (!$file_found) {
    echo "No Nginx configuration file found for vendosync.adiwidget.com.";
}
?>
