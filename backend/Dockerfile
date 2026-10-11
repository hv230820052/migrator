FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (git, svn for connectors)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git subversion \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . /app

# Create data directory
RUN mkdir -p /app/data

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 8000

# Run with entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]