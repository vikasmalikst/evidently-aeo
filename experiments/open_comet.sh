#!/bin/bash

# Script to automate opening of Comet Browser on macOS
# This script attempts to open the application named "Comet" or "Comet Browser".

# Define the application names to try
APP_NAMES=("Comet" "Comet Browser")

echo "Attempting to open Comet Browser..."

for app in "${APP_NAMES[@]}"; do
    if open -a "$app" 2>/dev/null; then
        echo "Successfully opened '$app'."
        
        # Wait for the application to load
        echo "Waiting for browser to initialize..."
        sleep 3

        # Simulate Option + A to open Comet Assistant
        echo "Simulating Option + A to open Comet Assistant..."
        osascript -e "tell application \"$app\" to activate"
        osascript -e 'tell application "System Events" to keystroke "a" using option down'
        
        # Wait for Assistant to open
        echo "Waiting for Assistant to open..."
        sleep 1

        # Type the query and press Enter
        QUERY="Open reddit.com and search for all posts in last 24 hours on Nike. Summarize the posts with positive sentiment as well as negative sentiments"
        echo "Typing query: $QUERY"
        
        osascript -e "tell application \"System Events\"
            keystroke \"$QUERY\"
            delay 0.5
            keystroke return
        end tell"
        
        exit 0
    fi
done

echo "Error: Could not find 'Comet' or 'Comet Browser' application."
echo "Please ensure the application is installed in /Applications or ~/Applications."
echo "If the application has a different name, please update this script."
exit 1
