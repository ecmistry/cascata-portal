#!/bin/bash
# View incremental sync reports
echo "=== Incremental Sync Reports ==="
echo ""
grep -E "\[INCREMENTAL SYNC REPORT\]" /home/ec2-user/.pm2/logs/hubspot-connector-out.log | tail -20
