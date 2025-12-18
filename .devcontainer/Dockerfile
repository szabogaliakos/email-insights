FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install additional tools if needed
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Add Google Cloud SDK apt repo
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] http://packages.cloud.google.com/apt cloud-sdk main" \
    > /etc/apt/sources.list.d/google-cloud-sdk.list

RUN curl https://packages.cloud.google.com/apt/doc/apt-key.gpg \
    | gpg --dearmor \
    | tee /usr/share/keyrings/cloud.google.gpg > /dev/null

# Install gcloud
RUN apt-get update && apt-get install -y google-cloud-cli
# Set working directory
WORKDIR /workspaces

# Default to bash for development
SHELL ["/bin/bash", "-c"]

# Create a non-root user for development (node user already exists in base image)
USER node

# Keep container running
CMD ["sleep", "infinity"]
