#!/bin/bash

# Create a temporary directory
mkdir -p temp

# Start with the base configuration
cat > temp/combined.prisma << EOL
datasource db {
  provider     = "mysql"
  url          = env("DATABASE_URL")
  relationMode = "prisma"
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "fullTextIndex", "driverAdapters", "prismaSchemaFolder", "omitApi"]
}
EOL

# Append all model definitions from other schema files
for file in schema/*.prisma; do
  if [ "$file" != "schema/schema.prisma" ] && [ "$file" != "schema/combined.prisma" ]; then
    # Skip the datasource and generator blocks and only copy model definitions
    awk '/^model|^enum|^type/ {p=1} /^}/ {print; p=0} p' "$file" >> temp/combined.prisma
  fi
done

# Move the combined file to the schema directory
mv temp/combined.prisma schema/schema.prisma

# Clean up
rm -rf temp 