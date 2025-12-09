FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install additional tools if needed
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspaces

# Default to bash for development
SHELL ["/bin/bash", "-c"]

# Create a non-root user for development (node user already exists in base image)
USER node

# Keep container running
CMD ["sleep", "infinity"]
