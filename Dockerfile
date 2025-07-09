FROM maven:3.8.4-openjdk-11-slim AS build

WORKDIR /app

# Copy pom.xml first for better Docker layer caching
COPY pom.xml .

# Download dependencies
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Build the application
RUN mvn clean package -DskipTests

# Runtime stage
FROM openjdk:11-jre-slim

# Install necessary packages for text rendering and fonts
RUN apt-get update && apt-get install -y \
    fontconfig \
    fonts-dejavu-core \
    fonts-dejavu-extra \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the built JAR from the build stage
COPY --from=build /app/target/epub-to-pdf-converter-1.0.0.jar app.jar

# Create directories for input and output
RUN mkdir -p /app/input /app/output

# Set proper permissions
RUN chmod 755 /app/input /app/output

# Expose volume mounts
VOLUME ["/app/input", "/app/output"]

# Set the entry point
ENTRYPOINT ["java", "-jar", "app.jar"]

# Default command (can be overridden)
CMD ["--help"] 