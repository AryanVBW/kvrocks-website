#!/bin/bash
# This script is designed to be run as a cron job on the web server
# It downloads GitHub avatars for committers and stores them locally
# Recommended cron schedule: 0 0 * * 0 (weekly on Sunday at midnight)

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Navigate to the project root directory
cd "$SCRIPT_DIR/.."

# Log file for tracking execution
LOG_FILE="$SCRIPT_DIR/avatar-download.log"

# Create log entry with timestamp
echo "===== Avatar Download Started: $(date) =====" >> "$LOG_FILE"

# Run the avatar download script
node "$SCRIPT_DIR/download-avatars.js" >> "$LOG_FILE" 2>&1

# Add completion timestamp
echo "===== Avatar Download Completed: $(date) =====" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Trim log file if it gets too large (keep last 10000 lines)
if [ $(wc -l < "$LOG_FILE") -gt 10000 ]; then
  tail -n 10000 "$LOG_FILE" > "$LOG_FILE.tmp"
  mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

exit 0
