# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files for layer caching
COPY HealthTech.sln .
COPY src/HealthTech.Api/HealthTech.Api.csproj src/HealthTech.Api/
COPY src/HealthTech.Client/HealthTech.Client.csproj src/HealthTech.Client/
COPY src/HealthTech.Shared/HealthTech.Shared.csproj src/HealthTech.Shared/
RUN dotnet restore

# Copy everything and publish
COPY . .
RUN dotnet publish src/HealthTech.Api/HealthTech.Api.csproj -c Release -o /app/publish --no-restore

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app

# Security: run as non-root user
RUN adduser -D appuser
USER appuser

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:3003
EXPOSE 3003

ENTRYPOINT ["dotnet", "HealthTech.Api.dll"]
