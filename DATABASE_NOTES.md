# Database Management with PlanetScale CLI

This document outlines how to connect to and manage database records in the RefList application using PlanetScale CLI.

## Setup and Connection

1. Ensure you have PlanetScale CLI installed:
   ```bash
   pscale --version
   # Should return something like: pscale version 0.241.0
   ```

2. Install MySQL Client if needed:
   ```bash
   brew install mysql-client@8.4
   export PATH="/opt/homebrew/opt/mysql-client@8.4/bin:$PATH"
   ```

3. Authenticate with PlanetScale (if not already done):
   ```bash
   pscale auth login
   ```

4. Create a secure connection to the database:
   ```bash
   pscale connect reflist main --port 3309
   # You should see: "Secure connection to database reflist and branch main is established!"
   ```

5. In a separate terminal, connect to the database using MySQL:
   ```bash
   /opt/homebrew/opt/mysql-client@8.4/bin/mysql -h 127.0.0.1 -P 3309 -u root
   ```

## Common Database Operations

### Viewing Records

Query records from a table:
```sql
USE reflist;
SELECT * FROM Commission LIMIT 10;
```

Find specific records:
```sql
USE reflist;
SELECT id, type, status, amount, eventId 
FROM Commission 
WHERE eventId LIKE 'manual_%';
```

Count records:
```sql
USE reflist;
SELECT COUNT(*) FROM Commission WHERE type = 'sale';
```

### Modifying Records

Delete a record by ID:
```sql
USE reflist;
DELETE FROM Commission WHERE id = 'cm_1JT51VPVT5X25WNE8NY65A7WG';
```

Update a record's status:
```sql
USE reflist;
UPDATE Commission SET status = 'processed' WHERE id = 'cm_12345ABCDE';
```

## Example: Cleaning up Test Data

To find and delete a test commission record:

1. Connect to PlanetScale:
   ```bash
   pscale connect reflist main --port 3309
   ```

2. In a separate terminal, find the records:
   ```bash
   /opt/homebrew/opt/mysql-client@8.4/bin/mysql -h 127.0.0.1 -P 3309 -u root -e "USE reflist; SELECT id, type, status, amount, eventId FROM Commission WHERE eventId LIKE 'manual_%'"
   ```

3. Delete the record by ID:
   ```bash
   /opt/homebrew/opt/mysql-client@8.4/bin/mysql -h 127.0.0.1 -P 3309 -u root -e "USE reflist; DELETE FROM Commission WHERE id = 'cm_1JT51VPVT5X25WNE8NY65A7WG'"
   ```

4. Verify deletion:
   ```bash
   /opt/homebrew/opt/mysql-client@8.4/bin/mysql -h 127.0.0.1 -P 3309 -u root -e "USE reflist; SELECT COUNT(*) FROM Commission WHERE eventId LIKE 'manual_%'"
   ```

## Notes

- PlanetScale connections are temporary and will close when you press Ctrl+C in the terminal running the `pscale connect` command
- Tinybird events (used for analytics) are stored in a separate system and not directly accessible through this connection
- Be careful with DELETE and UPDATE operations without a WHERE clause as they will affect all records in a table 